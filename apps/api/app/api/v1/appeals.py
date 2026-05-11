"""이의신청 라우터 (v3.3 신규).

엔드포인트:
- POST /appeals                       이의 신청 (selene/coach/admin)
- GET  /appeals/event/{event_id}      이벤트 내 모든 이의 (관리자/관전 무인증)
- POST /appeals/{id}/decide           결정 (Chief Judge=admin/operator)

상태:
  pending → approved / rejected / escalated
모든 변경은 audit_logs에 기록.
"""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import (
    ROLE_ADMIN,
    ROLE_COACH,
    ROLE_OPERATOR,
    ROLE_PLAYER,
    TokenData,
    require_role,
)
from app.core.database import get_db
from app.models import Appeal, AuditLog
from app.schemas import APIResponse

router = APIRouter(prefix="/appeals", tags=["appeals"])


REASON_CODES = {"scoring_error", "video_review", "wrong_athlete", "other"}


class AppealCreate(BaseModel):
    event_id: UUID
    heat_id: Optional[UUID] = None
    participant_id: UUID
    reason_code: str
    reason_text: Optional[str] = None
    video_timestamp: Optional[str] = None


class AppealDecide(BaseModel):
    status: Literal["approved", "rejected", "escalated"]
    decision_text: Optional[str] = None


class AppealItem(BaseModel):
    id: UUID
    event_id: UUID
    heat_id: Optional[UUID]
    participant_id: UUID
    appellant_user_id: Optional[UUID]
    reason_code: str
    reason_text: Optional[str]
    video_timestamp: Optional[str]
    status: str
    filed_at: datetime
    decided_at: Optional[datetime]
    decided_by: Optional[UUID]
    decision_text: Optional[str]


def _to_uuid_or_none(value):
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        return None


@router.post("", response_model=APIResponse[AppealItem])
async def file_appeal(
    body: AppealCreate,
    td: TokenData = Depends(require_role(ROLE_PLAYER, ROLE_COACH, ROLE_OPERATOR, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """이의 신청. selene/coach/admin이 신청 가능. 30분 창 검증은 클라이언트 측."""
    if body.reason_code not in REASON_CODES:
        raise HTTPException(status_code=400, detail=f"reason_code는 {REASON_CODES} 중")
    appellant_uuid = _to_uuid_or_none(td.user_id)

    appeal = Appeal(
        event_id=body.event_id,
        heat_id=body.heat_id,
        participant_id=body.participant_id,
        appellant_user_id=appellant_uuid,
        reason_code=body.reason_code,
        reason_text=body.reason_text,
        video_timestamp=body.video_timestamp,
        status="pending",
    )
    db.add(appeal)
    await db.flush()

    # audit log
    db.add(AuditLog(
        actor_id=appellant_uuid, actor_role=td.role,
        action_type="appeal_filed", target_type="appeal", target_id=appeal.id,
        after_value={"reason_code": body.reason_code, "participant_id": str(body.participant_id)},
        reason=body.reason_text,
        timestamp=datetime.utcnow(),
    ))
    await db.commit()
    await db.refresh(appeal)
    return APIResponse(data=AppealItem(**{c.name: getattr(appeal, c.name) for c in appeal.__table__.columns}))


@router.delete("/{appeal_id}", response_model=APIResponse[dict])
async def cancel_appeal(
    appeal_id: UUID,
    reason: Optional[str] = None,
    td: TokenData = Depends(require_role(ROLE_PLAYER, ROLE_COACH, ROLE_OPERATOR, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """이의 취소.
    - status=pending: 신청자 본인 또는 admin/operator
    - status=approved/rejected/escalated: admin만 (행정 처리)
    """
    res = await db.execute(select(Appeal).where(Appeal.id == appeal_id))
    a = res.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="appeal not found")

    actor_uuid = _to_uuid_or_none(td.user_id)
    is_appellant = (a.appellant_user_id is not None and a.appellant_user_id == actor_uuid)
    if a.status != "pending" and td.role != ROLE_ADMIN:
        raise HTTPException(status_code=400, detail="결정된 이의는 admin만 취소 가능")
    if a.status == "pending" and td.role in (ROLE_PLAYER, ROLE_COACH) and not is_appellant:
        raise HTTPException(status_code=403, detail="본인이 신청한 이의만 취소 가능")

    db.add(AuditLog(
        actor_id=actor_uuid, actor_role=td.role,
        action_type="appeal_cancelled", target_type="appeal", target_id=a.id,
        before_value={"status": a.status, "reason_code": a.reason_code, "participant_id": str(a.participant_id)},
        reason=reason or "취소 (사유 없음)",
        timestamp=datetime.utcnow(),
    ))
    await db.delete(a)
    await db.commit()
    return APIResponse(data={"deleted": True, "appeal_id": str(appeal_id)})


@router.get("/event/{event_id}", response_model=APIResponse[list[AppealItem]])
async def list_event_appeals(event_id: UUID, db: AsyncSession = Depends(get_db)):
    """이벤트의 모든 이의 (status별 정렬). 무인증 — 관전 페이지 사용."""
    res = await db.execute(
        select(Appeal).where(Appeal.event_id == event_id).order_by(Appeal.filed_at.desc())
    )
    items = res.scalars().all()
    return APIResponse(data=[AppealItem(**{c.name: getattr(a, c.name) for c in a.__table__.columns}) for a in items])


@router.post("/{appeal_id}/decide", response_model=APIResponse[AppealItem])
async def decide_appeal(
    appeal_id: UUID,
    body: AppealDecide,
    td: TokenData = Depends(require_role(ROLE_ADMIN, ROLE_OPERATOR)),
    db: AsyncSession = Depends(get_db),
):
    """이의 결정. admin/operator(Chief Judge)만. 모든 변경 audit_logs."""
    res = await db.execute(select(Appeal).where(Appeal.id == appeal_id))
    a = res.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="appeal not found")
    if a.status != "pending":
        raise HTTPException(status_code=400, detail=f"이미 결정된 이의 (status={a.status})")

    decider_uuid = _to_uuid_or_none(td.user_id)
    before = {"status": a.status}
    a.status = body.status
    a.decided_at = datetime.utcnow()
    a.decided_by = decider_uuid
    a.decision_text = body.decision_text

    db.add(AuditLog(
        actor_id=decider_uuid, actor_role=td.role,
        action_type="appeal_decided", target_type="appeal", target_id=a.id,
        before_value=before, after_value={"status": a.status, "decision_text": body.decision_text},
        reason=body.decision_text,
        timestamp=datetime.utcnow(),
    ))
    await db.commit()
    await db.refresh(a)
    return APIResponse(data=AppealItem(**{c.name: getattr(a, c.name) for c in a.__table__.columns}))
