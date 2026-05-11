"""Tiebreaker(별도 동점 재경기) 라우터 (v3.3).

자동 감지된 tiebreaker를 실제 새 heat로 편성·진행·결과 적용.

엔드포인트:
- GET  /tiebreakers/event/{event_id}        이벤트 내 모든 tiebreaker (status별)
- POST /tiebreakers/{id}/schedule           court_id + scheduled_at 지정 → status=scheduled
- POST /tiebreakers/{id}/start              새 heat 자동 생성 (court에 selene 배정) → status=in_progress
- POST /tiebreakers/{id}/resolve            결과 적용: 새 heat 채점 결과 → award rank 부여
- POST /tiebreakers/{id}/cancel             취소

라이프사이클: pending → scheduled → in_progress → completed / cancelled
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import (
    ROLE_ADMIN,
    ROLE_OPERATOR,
    TokenData,
    require_role,
)
from app.core.database import get_db
from app.models import (
    AuditLog, Award, Heat, Participant, Station, Tiebreaker,
)
from app.models.heat import heat_participants
from app.schemas import APIResponse
from app.services.result_engine import aggregate_heat


router = APIRouter(prefix="/tiebreakers", tags=["tiebreakers"])


def _to_uuid_or_none(v):
    try:
        return UUID(str(v))
    except (ValueError, TypeError):
        return None


class TiebreakerItem(BaseModel):
    id: UUID
    event_id: UUID
    original_heat_id: Optional[UUID]
    tied_participant_ids: list[str]
    detection_method: str
    scheduled_at: Optional[datetime]
    court_id: Optional[UUID]
    status: str
    result_heat_id: Optional[UUID]


class ScheduleBody(BaseModel):
    court_id: UUID
    scheduled_at: Optional[datetime] = None


@router.get("/event/{event_id}", response_model=APIResponse[list[TiebreakerItem]])
async def list_event_tiebreakers(event_id: UUID, db: AsyncSession = Depends(get_db)):
    """이벤트 내 모든 tiebreaker (status별 정렬)."""
    res = await db.execute(
        select(Tiebreaker).where(Tiebreaker.event_id == event_id).order_by(Tiebreaker.status)
    )
    items = res.scalars().all()
    return APIResponse(data=[
        TiebreakerItem(
            id=t.id, event_id=t.event_id, original_heat_id=t.original_heat_id,
            tied_participant_ids=t.tied_participant_ids or [], detection_method=t.detection_method,
            scheduled_at=t.scheduled_at, court_id=t.court_id, status=t.status,
            result_heat_id=t.result_heat_id,
        ) for t in items
    ])


@router.post("/{tb_id}/schedule", response_model=APIResponse[TiebreakerItem])
async def schedule_tiebreaker(
    tb_id: UUID,
    body: ScheduleBody,
    td: TokenData = Depends(require_role(ROLE_ADMIN, ROLE_OPERATOR)),
    db: AsyncSession = Depends(get_db),
):
    """tiebreaker court + 시각 지정. status=scheduled."""
    res = await db.execute(select(Tiebreaker).where(Tiebreaker.id == tb_id))
    t = res.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="tiebreaker not found")
    if t.status not in ("pending", "scheduled"):
        raise HTTPException(status_code=400, detail=f"이미 진행/완료됨 (status={t.status})")

    t.court_id = body.court_id
    t.scheduled_at = body.scheduled_at or datetime.utcnow()
    t.status = "scheduled"
    db.add(AuditLog(
        actor_id=_to_uuid_or_none(td.user_id), actor_role=td.role,
        action_type="tiebreaker_scheduled", target_type="tiebreaker", target_id=t.id,
        after_value={"court_id": str(body.court_id), "scheduled_at": t.scheduled_at.isoformat()},
        timestamp=datetime.utcnow(),
    ))
    await db.commit()
    await db.refresh(t)
    return APIResponse(data=TiebreakerItem(
        id=t.id, event_id=t.event_id, original_heat_id=t.original_heat_id,
        tied_participant_ids=t.tied_participant_ids or [], detection_method=t.detection_method,
        scheduled_at=t.scheduled_at, court_id=t.court_id, status=t.status,
        result_heat_id=t.result_heat_id,
    ))


@router.post("/{tb_id}/start", response_model=APIResponse[dict])
async def start_tiebreaker(
    tb_id: UUID,
    td: TokenData = Depends(require_role(ROLE_ADMIN, ROLE_OPERATOR)),
    db: AsyncSession = Depends(get_db),
):
    """tiebreaker 새 heat 자동 생성 (court에 selene 배정) → status=in_progress.

    새 heat = 마지막 heat_number + 1.
    """
    res = await db.execute(select(Tiebreaker).where(Tiebreaker.id == tb_id))
    t = res.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="tiebreaker not found")
    if not t.court_id:
        raise HTTPException(status_code=400, detail="먼저 schedule로 court 지정 필요")
    if t.status not in ("scheduled", "pending"):
        raise HTTPException(status_code=400, detail=f"이미 시작됨 (status={t.status})")

    # 다음 heat_number
    max_q = await db.execute(
        select(Heat.heat_number).where(Heat.station_id == t.court_id).order_by(Heat.heat_number.desc()).limit(1)
    )
    last = max_q.scalar() or 0
    new_heat = Heat(
        station_id=t.court_id,
        heat_number=last + 1,
        started_at=datetime.utcnow(),
    )
    db.add(new_heat)
    await db.flush()

    # selene 배정
    for pid_str in (t.tied_participant_ids or []):
        try:
            pid = UUID(pid_str)
            await db.execute(heat_participants.insert().values(heat_id=new_heat.id, participant_id=pid))
        except (ValueError, TypeError):
            pass

    t.result_heat_id = new_heat.id
    t.status = "in_progress"
    db.add(AuditLog(
        actor_id=_to_uuid_or_none(td.user_id), actor_role=td.role,
        action_type="tiebreaker_started", target_type="tiebreaker", target_id=t.id,
        after_value={"new_heat_id": str(new_heat.id), "heat_number": new_heat.heat_number, "court_id": str(t.court_id)},
        timestamp=datetime.utcnow(),
    ))
    await db.commit()
    await db.refresh(new_heat)
    return APIResponse(data={
        "tiebreaker_id": str(tb_id),
        "new_heat_id": str(new_heat.id),
        "heat_number": new_heat.heat_number,
        "court_id": str(t.court_id),
        "participants_count": len(t.tied_participant_ids or []),
        "next_step": f"심판이 새 heat({new_heat.heat_number})에서 채점 → POST /tiebreakers/{tb_id}/resolve",
    })


@router.post("/{tb_id}/resolve", response_model=APIResponse[dict])
async def resolve_tiebreaker(
    tb_id: UUID,
    td: TokenData = Depends(require_role(ROLE_ADMIN, ROLE_OPERATOR)),
    db: AsyncSession = Depends(get_db),
):
    """tiebreaker 결과 적용. result_heat 결과 집계 → 동점 selene에 award rank 부여.

    boundary 동점이 또 발생하면 새 tiebreaker 자동 생성 (recursive).
    """
    res = await db.execute(select(Tiebreaker).where(Tiebreaker.id == tb_id))
    t = res.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="tiebreaker not found")
    if t.status != "in_progress":
        raise HTTPException(status_code=400, detail=f"start 후 resolve (현재 status={t.status})")
    if not t.result_heat_id:
        raise HTTPException(status_code=400, detail="result_heat 없음")

    # tiebreaker heat 결과 집계
    result = await aggregate_heat(db, t.result_heat_id)
    scored = [r for r in result.rankings if r.judge_count > 0]
    if not scored:
        raise HTTPException(status_code=400, detail="새 heat에 채점이 없습니다")

    # 다시 boundary 동점이면 → 재귀 tiebreaker 자동 생성
    top_score = scored[0].score
    still_tied = [r for r in scored if r.score == top_score]

    if len(still_tied) > 1:
        # 또 동점 → 새 tiebreaker
        new_tb = Tiebreaker(
            event_id=t.event_id,
            original_heat_id=t.result_heat_id,
            tied_participant_ids=[str(r.participant_id) for r in still_tied],
            detection_method="auto",
            status="pending",
        )
        db.add(new_tb)
        t.status = "completed"  # 이번 tiebreaker는 종료, 새 거 시작
        db.add(AuditLog(
            actor_id=_to_uuid_or_none(td.user_id), actor_role=td.role,
            action_type="tiebreaker_recursive", target_type="tiebreaker", target_id=t.id,
            after_value={"new_tiebreaker_id": str(new_tb.id) if new_tb.id else None, "still_tied_count": len(still_tied)},
            reason="resolve 후에도 동점 — 재귀 tiebreaker",
            timestamp=datetime.utcnow(),
        ))
        await db.commit()
        await db.refresh(new_tb)
        return APIResponse(data={
            "resolved": False,
            "still_tied": True,
            "new_tiebreaker_id": str(new_tb.id),
            "tied_count": len(still_tied),
            "_note": "또 동점 — 새 tiebreaker 자동 생성. 다시 schedule → start → resolve.",
        })

    # 정상 — 단독 1위 결정. award rank 1 부여.
    winner = scored[0]
    # 기존 award (이 selene에 동일 event/category) 있는지 확인
    # tiebreaker는 boundary가 어디인지(1·2·3위) 모르니 일단 1위로 부여
    # 실제로는 award 보호 흐름과 연동 필요 (Phase 6에서 정교화)
    a = Award(
        event_id=t.event_id,
        program_id=None,
        rank=1,  # tiebreaker는 단순화: 승자 = rank 1
        participant_id=winner.participant_id,
        category=result.event_code or "tiebreaker",
        status="pending",
    )
    db.add(a)
    t.status = "completed"
    db.add(AuditLog(
        actor_id=_to_uuid_or_none(td.user_id), actor_role=td.role,
        action_type="tiebreaker_resolved", target_type="tiebreaker", target_id=t.id,
        after_value={
            "winner_participant_id": str(winner.participant_id),
            "winner_score": winner.score,
            "award_id": None,  # refresh 후 채움
        },
        timestamp=datetime.utcnow(),
    ))
    await db.commit()
    await db.refresh(a)
    return APIResponse(data={
        "resolved": True,
        "winner": {"participant_id": str(winner.participant_id), "name": winner.name, "score": winner.score},
        "award_id": str(a.id),
    })


@router.post("/{tb_id}/cancel", response_model=APIResponse[dict])
async def cancel_tiebreaker(
    tb_id: UUID,
    reason: Optional[str] = None,
    td: TokenData = Depends(require_role(ROLE_ADMIN, ROLE_OPERATOR)),
    db: AsyncSession = Depends(get_db),
):
    """tiebreaker 취소."""
    res = await db.execute(select(Tiebreaker).where(Tiebreaker.id == tb_id))
    t = res.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="tiebreaker not found")
    if t.status == "completed":
        raise HTTPException(status_code=400, detail="이미 완료됨")
    t.status = "cancelled"
    db.add(AuditLog(
        actor_id=_to_uuid_or_none(td.user_id), actor_role=td.role,
        action_type="tiebreaker_cancelled", target_type="tiebreaker", target_id=t.id,
        before_value={"status": "pending/scheduled/in_progress"},
        after_value={"status": "cancelled"},
        reason=reason or "취소",
        timestamp=datetime.utcnow(),
    ))
    await db.commit()
    return APIResponse(data={"cancelled": True})
