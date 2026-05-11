"""시상 흐름 라우터 (v3.3 신규).

엔드포인트:
- POST /awards/from-heat/{heat_id}    히트 결과 기반 1·2·3위 award 자동 생성
- GET  /awards/event/{event_id}        이벤트 내 모든 award (관리자·관객)
- GET  /awards/me                      본인이 받은 award (선수 PWA — Phase 5)
- POST /awards/{id}/transition         status 변경 (called/confirmed/done)

라이프사이클:
  pending → called(관리자가 호명 시작) → confirmed(시상자 본인 확인) → done(시상 완료)
"""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import (
    ROLE_ADMIN,
    ROLE_OPERATOR,
    ROLE_PLAYER,
    ROLE_COACH,
    TokenData,
    require_role,
)
from app.core.database import get_db
from app.models import Award, AuditLog, Heat, Station
from app.schemas import APIResponse
from app.services.result_engine import aggregate_heat


def _to_uuid_or_none(v):
    try:
        return UUID(str(v))
    except (ValueError, TypeError):
        return None

router = APIRouter(prefix="/awards", tags=["awards"])


class AwardItem(BaseModel):
    id: UUID
    event_id: UUID
    rank: int
    participant_id: UUID
    participant_name: str | None = None
    category: str | None = None
    status: str
    called_at: datetime | None = None
    confirmed_at: datetime | None = None
    done_at: datetime | None = None


class AwardTransition(BaseModel):
    to_status: Literal["called", "confirmed", "done"]


def _to_item(a: Award, name: str | None = None) -> AwardItem:
    return AwardItem(
        id=a.id, event_id=a.event_id, rank=a.rank,
        participant_id=a.participant_id, participant_name=name,
        category=a.category, status=a.status,
        called_at=a.called_at, confirmed_at=a.confirmed_at, done_at=a.done_at,
    )


class AwardCreateResult(BaseModel):
    awards: list[AwardItem]
    tied_groups: list[dict]  # 1~3위 boundary에 걸린 동점 그룹
    tiebreakers_created: list[str]  # 자동 생성된 tiebreaker UUID
    note: str | None = None


@router.post("/from-heat/{heat_id}", response_model=APIResponse[AwardCreateResult])
async def create_awards_from_heat(
    heat_id: UUID,
    force: bool = False,  # True면 동점 무시하고 임의 순서로 강제 생성
    td: TokenData = Depends(require_role(ROLE_ADMIN, ROLE_OPERATOR)),
    db: AsyncSession = Depends(get_db),
):
    """히트 1개 결과 → 1·2·3위 award 자동 생성.

    동점 보호:
    - 1~3위 경계에 동점 있으면 award 생성 보류 + tiebreakers 자동 row 생성
    - force=true → 동점 무시 강제 생성 (admin 책임)
    - 이미 존재하는 award는 중복 생성 안 함
    """
    # heat → station → event 추적
    hres = await db.execute(select(Heat).where(Heat.id == heat_id))
    heat = hres.scalar_one_or_none()
    if not heat:
        raise HTTPException(status_code=404, detail="히트를 찾을 수 없습니다")
    sres = await db.execute(select(Station).where(Station.id == heat.station_id))
    station = sres.scalar_one_or_none()
    if not station:
        raise HTTPException(status_code=404, detail="스테이션을 찾을 수 없습니다")
    event_id = station.event_id

    # 결과 집계
    result = await aggregate_heat(db, heat_id)
    scored = [r for r in result.rankings if r.judge_count > 0]
    if len(scored) == 0:
        raise HTTPException(status_code=400, detail="채점이 완료된 선수가 없습니다")

    # ─── 동점 boundary 체크 ────────────────────────────────────
    # 1·2·3위 score 추출 후 같은 score selene 모으기
    top_scores = sorted({r.score for r in scored}, reverse=True)[:3]
    boundary_tied = []  # [{rank, score, participant_ids}]
    for rank_idx, sc in enumerate(top_scores, start=1):
        ids = [r.participant_id for r in scored if r.score == sc]
        if len(ids) > 1:
            boundary_tied.append({"rank": rank_idx, "score": sc, "participant_ids": ids})

    # 동점이고 force=False면 award 생성 안 함 + tiebreaker 자동 생성
    tiebreakers_created = []
    if boundary_tied and not force:
        from app.models import Tiebreaker
        for grp in boundary_tied:
            # 중복 방지: 이미 같은 selene·event에 tiebreaker 있는지 확인
            ex_q = await db.execute(
                select(Tiebreaker).where(
                    and_(
                        Tiebreaker.event_id == event_id,
                        Tiebreaker.original_heat_id == heat_id,
                    )
                )
            )
            ex_list = ex_q.scalars().all()
            already = any(set(map(str, e.tied_participant_ids or [])) == set(map(str, grp["participant_ids"])) for e in ex_list)
            if already:
                continue
            tb = Tiebreaker(
                event_id=event_id,
                original_heat_id=heat_id,
                program_id=None,
                tied_participant_ids=[str(pid) for pid in grp["participant_ids"]],
                detection_method="auto",
                status="pending",
            )
            db.add(tb)
            await db.flush()
            tiebreakers_created.append(str(tb.id))
            db.add(AuditLog(
                actor_id=_to_uuid_or_none(td.user_id), actor_role=td.role,
                action_type="tiebreaker_auto_created", target_type="tiebreaker", target_id=tb.id,
                after_value={"rank_boundary": grp["rank"], "score": grp["score"], "tied_count": len(grp["participant_ids"])},
                reason="award boundary 동점 자동 감지",
                timestamp=datetime.utcnow(),
            ))
        await db.commit()
        return APIResponse(data=AwardCreateResult(
            awards=[],
            tied_groups=boundary_tied,
            tiebreakers_created=tiebreakers_created,
            note=f"1~3위 경계에 {len(boundary_tied)}개 동점 그룹 — 재경기(tiebreaker) 자동 생성. force=true로 동점 무시 가능.",
        ))

    # ─── 정상 (동점 없음 또는 force) ──────────────────────────
    qualifiers = scored[:3]
    existing_q = await db.execute(
        select(Award).where(
            and_(
                Award.event_id == event_id,
                Award.participant_id.in_([q.participant_id for q in qualifiers]),
                Award.category == (result.event_code or "default"),
            )
        )
    )
    existing = {(a.participant_id, a.rank) for a in existing_q.scalars().all()}

    created = []
    for idx, q in enumerate(qualifiers, start=1):
        if (q.participant_id, idx) in existing:
            continue
        a = Award(
            event_id=event_id,
            program_id=None,
            rank=idx,
            participant_id=q.participant_id,
            category=result.event_code or "default",
            status="pending",
        )
        db.add(a)
        created.append((a, q.name))
    await db.commit()
    for a, _ in created:
        await db.refresh(a)

    return APIResponse(data=AwardCreateResult(
        awards=[_to_item(a, name) for a, name in created],
        tied_groups=[],
        tiebreakers_created=[],
        note="강제 생성 (force=true)" if force and boundary_tied else None,
    ))


@router.get("/event/{event_id}", response_model=APIResponse[list[AwardItem]])
async def list_event_awards(event_id: UUID, db: AsyncSession = Depends(get_db)):
    """이벤트의 모든 award 목록 (status별 정렬). 무인증 — 관전 페이지 사용."""
    res = await db.execute(
        select(Award).where(Award.event_id == event_id).order_by(Award.category, Award.rank)
    )
    awards = res.scalars().all()

    # selene 이름 join
    from app.models import Participant
    pids = list({a.participant_id for a in awards})
    if pids:
        pres = await db.execute(select(Participant).where(Participant.id.in_(pids)))
        names = {p.id: p.name for p in pres.scalars().all()}
    else:
        names = {}

    return APIResponse(data=[_to_item(a, names.get(a.participant_id)) for a in awards])


@router.post("/{award_id}/transition", response_model=APIResponse[AwardItem])
async def transition_award(
    award_id: UUID,
    body: AwardTransition,
    td: TokenData = Depends(require_role(ROLE_ADMIN, ROLE_OPERATOR, ROLE_PLAYER, ROLE_COACH)),
    db: AsyncSession = Depends(get_db),
):
    """Award status 변경.

    - admin/operator: pending → called, called → done
    - player/coach (본인): called → confirmed (본인 확인 토글)

    Phase 5에서 본인 확인 권한 체크 (award.participant_id == 본인 매핑).
    """
    res = await db.execute(select(Award).where(Award.id == award_id))
    a = res.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="award not found")

    now = datetime.utcnow()
    new_status = body.to_status
    before = {"status": a.status}

    # 단순 상태 전이 (Phase 5에서 정교화)
    if new_status == "called":
        a.status = "called"
        a.called_at = now
    elif new_status == "confirmed":
        a.status = "confirmed"
        a.confirmed_at = now
    elif new_status == "done":
        a.status = "done"
        a.done_at = now

    db.add(AuditLog(
        actor_id=_to_uuid_or_none(td.user_id),
        actor_role=td.role,
        action_type="award_transitioned",
        target_type="award",
        target_id=a.id,
        before_value=before,
        after_value={"status": a.status, "rank": a.rank, "category": a.category},
        timestamp=now,
    ))

    await db.commit()
    await db.refresh(a)

    # SSE 푸시
    try:
        from app.api.v1.realtime import event_broker
        await event_broker.publish(str(a.event_id), {
            "type": "award_changed",
            "award_id": str(a.id),
            "rank": a.rank,
            "category": a.category,
            "status": a.status,
        })
    except Exception:
        pass

    return APIResponse(data=_to_item(a))


@router.delete("/{award_id}", response_model=APIResponse[dict])
async def delete_award(
    award_id: UUID,
    reason: Optional[str] = None,
    td: TokenData = Depends(require_role(ROLE_ADMIN, ROLE_OPERATOR)),
    db: AsyncSession = Depends(get_db),
):
    """잘못 생성된 award 삭제. status=done 인 award는 삭제 불가."""
    res = await db.execute(select(Award).where(Award.id == award_id))
    a = res.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="award not found")
    if a.status == "done":
        raise HTTPException(status_code=400, detail="시상 완료된 award는 삭제 불가")
    db.add(AuditLog(
        actor_id=_to_uuid_or_none(td.user_id), actor_role=td.role,
        action_type="award_deleted", target_type="award", target_id=a.id,
        before_value={"rank": a.rank, "category": a.category, "participant_id": str(a.participant_id), "status": a.status},
        reason=reason or "삭제 (사유 없음)",
        timestamp=datetime.utcnow(),
    ))
    await db.delete(a)
    await db.commit()
    return APIResponse(data={"deleted": True, "award_id": str(award_id)})
