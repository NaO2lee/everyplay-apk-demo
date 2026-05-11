"""심판 BYOD 라우터 (v3.3).

엔드포인트:
- GET  /judge/me                    심판 컨텍스트 (배정 코트, 다음 히트)
- POST /judge/scores                점수 제출 (4단계 wizard 4단계)
- GET  /judge/scores/heat/{id}      해당 히트의 내 채점 목록
- POST /judge/no-show               "선수 안왔음" 호출 트리거
- GET  /judge/submissions/matrix    심판×히트 제출 매트릭스 (관리자도 사용)
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import (
    ROLE_ADMIN,
    ROLE_JUDGE,
    ROLE_OPERATOR,
    TokenData,
    require_role,
)
from app.core.database import get_db
from app.models import AuditLog, Rerun, Score, ScoreStatus, ScoreSubmission
from app.schemas import (
    APIResponse,
    ScoreResponse,
    ScoreSubmit,
    SubmissionStatusItem,
    expected_payload_kind,
)

router = APIRouter(prefix="/judge", tags=["judge"])


# ─── 컨텍스트 ─────────────────────────────────────────────────

@router.get("/me", response_model=APIResponse[dict])
async def judge_me(td: TokenData = Depends(require_role(ROLE_JUDGE, ROLE_OPERATOR, ROLE_ADMIN))):
    """현재 심판 컨텍스트. Phase 3에서 배정 코트·다음 히트 채워짐."""
    return APIResponse(data={
        "user_id": td.user_id,
        "role": td.role,
        "court": None,      # Phase 3
        "next_heat": None,  # Phase 3
    })


# ─── 채점 제출 ─────────────────────────────────────────────────

class _NoShowRequest(BaseModel):
    heat_id: UUID
    participant_id: UUID
    note: Optional[str] = None


def _to_uuid(value) -> UUID:
    """user_id가 'admin' / 'admin-builtin' 같은 비-UUID 문자열일 수 있어 정규화."""
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except (ValueError, AttributeError):
        # dev/admin built-in 사용자는 결정론적 UUID로 매핑
        import hashlib
        h = hashlib.md5(str(value).encode()).hexdigest()
        return UUID(h)


@router.post("/scores", response_model=APIResponse[ScoreResponse])
async def submit_score(
    body: ScoreSubmit,
    td: TokenData = Depends(require_role(ROLE_JUDGE, ROLE_OPERATOR, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """4단계 wizard 마지막 단계 — 점수 제출.

    검증:
    - event_code → 기대 payload kind 확인 (불일치 시 400)
    - heat × participant × judge 중복 시 400 (재제출은 별도 PATCH로)
    """
    # 1. event_code 와 payload kind 일치 확인
    expected_kind = expected_payload_kind(body.event_code)
    if expected_kind and body.payload.kind != expected_kind:
        raise HTTPException(
            status_code=400,
            detail=f"event_code '{body.event_code}'는 payload kind '{expected_kind}'를 기대합니다 (받은 것: {body.payload.kind})",
        )

    judge_uuid = _to_uuid(td.user_id)

    # 2. 중복 체크
    existing = await db.execute(
        select(Score).where(
            and_(
                Score.heat_id == body.heat_id,
                Score.participant_id == body.participant_id,
                Score.judge_user_id == judge_uuid,
            )
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="이미 채점한 선수입니다 (수정은 별도 API)")

    # 3. 저장
    score = Score(
        heat_id=body.heat_id,
        participant_id=body.participant_id,
        judge_user_id=judge_uuid,
        event_code=body.event_code,
        payload=body.payload.model_dump(),
        status=ScoreStatus.SUBMITTED,
        submitted_at=datetime.utcnow(),
    )
    db.add(score)

    # 4. ScoreSubmission 매트릭스 업데이트 (없으면 생성)
    # expected_count = 이 히트의 selene 수 (실제 큰 heat 50명 지원)
    # submitted_count = COUNT(DISTINCT participant_id) FROM scores WHERE heat=heat AND judge=judge
    from app.models.heat import heat_participants
    from sqlalchemy import func as _func
    expected_q = await db.execute(
        select(_func.count()).select_from(heat_participants).where(heat_participants.c.heat_id == body.heat_id)
    )
    expected_count = max(1, expected_q.scalar() or 1)

    distinct_q = await db.execute(
        select(_func.count(_func.distinct(Score.participant_id))).where(
            and_(Score.heat_id == body.heat_id, Score.judge_user_id == judge_uuid)
        )
    )
    submitted_distinct = distinct_q.scalar() or 0

    sub_q = await db.execute(
        select(ScoreSubmission).where(
            and_(
                ScoreSubmission.heat_id == body.heat_id,
                ScoreSubmission.judge_user_id == judge_uuid,
            )
        )
    )
    submission = sub_q.scalar_one_or_none()
    new_status = "done" if submitted_distinct >= expected_count else ("in_progress" if submitted_distinct > 0 else "pending")
    if submission is None:
        submission = ScoreSubmission(
            heat_id=body.heat_id,
            judge_user_id=judge_uuid,
            expected_count=expected_count,
            submitted_count=submitted_distinct,
            status=new_status,
            updated_at=datetime.utcnow(),
        )
        db.add(submission)
    else:
        submission.expected_count = expected_count  # heat에 selene 추가/제거 시 갱신
        submission.submitted_count = submitted_distinct
        submission.status = new_status
        submission.updated_at = datetime.utcnow()

    db.add(AuditLog(
        actor_id=judge_uuid, actor_role=td.role,
        action_type="score_submitted", target_type="score", target_id=score.id,
        after_value={"event_code": body.event_code, "heat_id": str(body.heat_id), "participant_id": str(body.participant_id), "payload": body.payload.model_dump()},
        timestamp=datetime.utcnow(),
    ))

    await db.commit()
    await db.refresh(score)

    # SSE 푸시 — heat → station → event_id 추적해서 publish
    try:
        from app.api.v1.realtime import event_broker
        from app.models import Heat, Station
        from sqlalchemy import select as _sel
        h = (await db.execute(_sel(Heat).where(Heat.id == body.heat_id))).scalar_one_or_none()
        if h:
            st = (await db.execute(_sel(Station).where(Station.id == h.station_id))).scalar_one_or_none()
            if st:
                await event_broker.publish(str(st.event_id), {
                    "type": "score_submitted",
                    "heat_id": str(body.heat_id),
                    "participant_id": str(body.participant_id),
                    "event_code": body.event_code,
                })
    except Exception:
        pass

    return APIResponse(data=ScoreResponse.model_validate(score))


class ScorePatch(BaseModel):
    payload: Optional[dict] = None  # ScorePayload dict (kind 필수). 검증은 client 또는 후속 phase
    reason: Optional[str] = None  # 정정 사유 (audit 기록)


@router.patch("/scores/{score_id}", response_model=APIResponse[ScoreResponse])
async def update_score(
    score_id: UUID,
    body: ScorePatch,
    td: TokenData = Depends(require_role(ROLE_JUDGE, ROLE_OPERATOR, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """점수 정정. 본인이 입력한 점수만 수정 가능 (admin/operator는 모두). audit 기록 필수."""
    res = await db.execute(select(Score).where(Score.id == score_id))
    score = res.scalar_one_or_none()
    if not score:
        raise HTTPException(status_code=404, detail="score not found")

    judge_uuid = _to_uuid(td.user_id)
    if td.role == ROLE_JUDGE and score.judge_user_id != judge_uuid:
        raise HTTPException(status_code=403, detail="본인이 입력한 점수만 정정 가능")

    before = {"payload": score.payload}
    if body.payload is not None:
        score.payload = body.payload
    db.add(AuditLog(
        actor_id=judge_uuid, actor_role=td.role,
        action_type="score_updated", target_type="score", target_id=score.id,
        before_value=before, after_value={"payload": score.payload},
        reason=body.reason or "정정 (사유 없음)",
        timestamp=datetime.utcnow(),
    ))
    await db.commit()
    await db.refresh(score)
    return APIResponse(data=ScoreResponse.model_validate(score))


@router.delete("/scores/{score_id}", response_model=APIResponse[dict])
async def delete_score(
    score_id: UUID,
    reason: Optional[str] = None,
    td: TokenData = Depends(require_role(ROLE_OPERATOR, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """점수 삭제. operator/admin만. audit_log에 before 저장 후 hard delete.

    매트릭스 카운트도 -1.
    """
    res = await db.execute(select(Score).where(Score.id == score_id))
    score = res.scalar_one_or_none()
    if not score:
        raise HTTPException(status_code=404, detail="score not found")

    actor_uuid = _to_uuid(td.user_id)
    db.add(AuditLog(
        actor_id=actor_uuid, actor_role=td.role,
        action_type="score_deleted", target_type="score", target_id=score.id,
        before_value={
            "heat_id": str(score.heat_id), "participant_id": str(score.participant_id),
            "judge_user_id": str(score.judge_user_id), "event_code": score.event_code,
            "payload": score.payload,
        },
        reason=reason or "삭제 (사유 없음)",
        timestamp=datetime.utcnow(),
    ))

    score_heat = score.heat_id
    score_judge = score.judge_user_id
    await db.delete(score)
    await db.flush()

    # 매트릭스 재계산 (DISTINCT participant)
    from sqlalchemy import func as _func
    distinct_q = await db.execute(
        select(_func.count(_func.distinct(Score.participant_id))).where(
            and_(Score.heat_id == score_heat, Score.judge_user_id == score_judge)
        )
    )
    submitted_distinct = distinct_q.scalar() or 0
    sub_q = await db.execute(
        select(ScoreSubmission).where(
            and_(ScoreSubmission.heat_id == score_heat, ScoreSubmission.judge_user_id == score_judge)
        )
    )
    sub = sub_q.scalar_one_or_none()
    if sub:
        sub.submitted_count = submitted_distinct
        sub.status = "done" if submitted_distinct >= sub.expected_count else ("in_progress" if submitted_distinct > 0 else "pending")

    await db.commit()
    return APIResponse(data={"deleted": True, "score_id": str(score_id)})


@router.get("/scores/heat/{heat_id}", response_model=APIResponse[list[ScoreResponse]])
async def list_my_scores_for_heat(
    heat_id: UUID,
    td: TokenData = Depends(require_role(ROLE_JUDGE, ROLE_OPERATOR, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """해당 히트에서 내가 입력한 채점 목록."""
    judge_uuid = _to_uuid(td.user_id)
    res = await db.execute(
        select(Score).where(
            and_(
                Score.heat_id == heat_id,
                Score.judge_user_id == judge_uuid,
            )
        ).order_by(Score.submitted_at.desc())
    )
    items = [ScoreResponse.model_validate(s) for s in res.scalars().all()]
    return APIResponse(data=items)


# ─── 호명 트리거 ──────────────────────────────────────────────

@router.post("/no-show", response_model=APIResponse[dict])
async def judge_no_show(
    body: _NoShowRequest,
    td: TokenData = Depends(require_role(ROLE_JUDGE, ROLE_OPERATOR, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """심판 '선수 안왔음' 버튼 → audit_log에 기록 → operator 대시보드가 polling.

    Phase 3에서 SSE 브로드캐스트 + ElevenLabs TTS 자동 호명으로 확장.
    """
    judge_uuid = _to_uuid(td.user_id)
    log = AuditLog(
        actor_id=judge_uuid,
        actor_role=td.role,
        action_type="no_show_called",
        target_type="participant",
        target_id=body.participant_id,
        after_value={
            "heat_id": str(body.heat_id),
            "participant_id": str(body.participant_id),
            "note": body.note,
        },
        reason=body.note,
        timestamp=datetime.utcnow(),
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)

    return APIResponse(data={
        "queued": True,
        "audit_id": str(log.id),
        "heat_id": str(body.heat_id),
        "participant_id": str(body.participant_id),
        "note": body.note,
    })


# ─── 현장 즉시 재진행 (Reruns) ─────────────────────────────────

class _RerunRequest(BaseModel):
    heat_id: UUID
    participant_id: UUID
    reason_code: str  # music_failed / system / disturbance / other
    reason_text: Optional[str] = None


@router.post("/reruns", response_model=APIResponse[dict])
async def request_rerun(
    body: _RerunRequest,
    td: TokenData = Depends(require_role(ROLE_JUDGE, ROLE_OPERATOR, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """심판 '음악 오류 등' 즉시 재진행 요청 → operator 승인 대기."""
    judge_uuid = _to_uuid(td.user_id)
    rerun = Rerun(
        heat_id=body.heat_id,
        participant_id=body.participant_id,
        reason_code=body.reason_code,
        reason_text=body.reason_text,
        requested_by_judge_id=judge_uuid,
        original_started_at=datetime.utcnow(),
    )
    db.add(rerun)
    await db.flush()

    db.add(AuditLog(
        actor_id=judge_uuid, actor_role=td.role,
        action_type="rerun_requested", target_type="rerun", target_id=rerun.id,
        after_value={"heat_id": str(body.heat_id), "reason_code": body.reason_code},
        reason=body.reason_text,
        timestamp=datetime.utcnow(),
    ))
    await db.commit()
    await db.refresh(rerun)
    return APIResponse(data={
        "id": str(rerun.id),
        "status": "pending_approval",
        "heat_id": str(rerun.heat_id),
        "participant_id": str(rerun.participant_id),
        "reason_code": rerun.reason_code,
        "created_at": rerun.created_at.isoformat(),
    })


# ─── 제출 매트릭스 (관리자 위젯용) ───────────────────────────

def _indicator(submitted: int, expected: int) -> str:
    if submitted == 0:
        return "red"
    if submitted < expected:
        return "yellow"
    return "green"


@router.get("/submissions/matrix", response_model=APIResponse[list[SubmissionStatusItem]])
async def submission_matrix(
    heat_id: Optional[UUID] = None,
    td: TokenData = Depends(require_role(ROLE_JUDGE, ROLE_OPERATOR, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """심판×히트 제출 매트릭스. heat_id 필터 가능. 🟢/🟡/🔴 indicator 포함."""
    q = select(ScoreSubmission)
    if heat_id is not None:
        q = q.where(ScoreSubmission.heat_id == heat_id)
    res = await db.execute(q)
    rows = res.scalars().all()
    items = [
        SubmissionStatusItem(
            heat_id=r.heat_id,
            judge_user_id=r.judge_user_id,
            expected_count=r.expected_count,
            submitted_count=r.submitted_count,
            status=r.status,
            indicator=_indicator(r.submitted_count, r.expected_count),
        )
        for r in rows
    ]
    return APIResponse(data=items)
