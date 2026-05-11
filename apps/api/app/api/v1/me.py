"""선수/코치 PWA 라우터 (v3.3).

엔드포인트:
- GET /me                  내 프로필 (User 테이블 조회)
- GET /me/awards           내가 받은 award (입상)
- GET /me/scores           내가 selene일 때 받은 점수 (heat 결과 집계)
- GET /me/heats            내 다음/전체 출전 히트 (Participant.heats)

선수/코치 가입자만. user_id로 selene을 자동 매칭 (이메일 기반 — Phase 5 정교화).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import (
    ROLE_ADMIN,
    ROLE_COACH,
    ROLE_PLAYER,
    TokenData,
    require_role,
)
from app.core.database import get_db
from app.models import Award, Participant, User
from app.models.heat import heat_participants
from app.models import Heat
from app.schemas import APIResponse


def _user_uuid(td: TokenData) -> UUID | None:
    """token user_id가 UUID면 반환, 아니면 None (admin-builtin 등)."""
    try:
        return UUID(td.user_id)
    except (ValueError, TypeError):
        return None


async def _resolve_participant(db: AsyncSession, td: TokenData) -> Participant | None:
    """가입한 selene를 매칭. 우선순위:
    1. User.email로 Participant.email 매칭
    2. User.phone_number로 Participant.phone 매칭
    """
    uid = _user_uuid(td)
    if uid is None:
        return None
    ures = await db.execute(select(User).where(User.id == uid))
    user = ures.scalar_one_or_none()
    if not user:
        return None
    # email or phone match
    pres = await db.execute(
        select(Participant).where(
            or_(
                Participant.email == user.email,
                Participant.phone == (user.phone_number or "")
            )
        )
    )
    return pres.scalars().first()


router = APIRouter(prefix="/me", tags=["me"])


@router.get("")
async def me(
    td: TokenData = Depends(require_role(ROLE_PLAYER, ROLE_COACH, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """본인 프로필 + 매칭된 selene 정보."""
    uid = _user_uuid(td)
    user_data = None
    if uid:
        ures = await db.execute(select(User).where(User.id == uid))
        user = ures.scalar_one_or_none()
        if user:
            user_data = {
                "user_id": str(user.id),
                "email": user.email,
                "name": user.name,
                "role": user.role.value if hasattr(user.role, "value") else user.role,
                "phone_number": user.phone_number,
                "country_code": user.country_code,
            }

    participant = await _resolve_participant(db, td)
    p_data = None
    if participant:
        p_data = {
            "participant_id": str(participant.id),
            "name": participant.name,
            "team": participant.team,
            "country_code": participant.country_code,
            "category": participant.category,
        }

    return APIResponse(data={
        "user": user_data or {"user_id": td.user_id, "role": td.role, "_note": "DEV 토큰 — DB User 없음"},
        "participant": p_data,
        "push_enabled": False,  # Phase 5에서 device_tokens 조회
    })


@router.get("/awards")
async def my_awards(
    td: TokenData = Depends(require_role(ROLE_PLAYER, ROLE_COACH, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """내가 받은 award (입상)."""
    p = await _resolve_participant(db, td)
    if not p:
        return APIResponse(data=[])
    res = await db.execute(
        select(Award).where(Award.participant_id == p.id).order_by(Award.rank)
    )
    awards = res.scalars().all()
    return APIResponse(data=[
        {
            "id": str(a.id),
            "rank": a.rank,
            "category": a.category,
            "status": a.status,
            "called_at": a.called_at.isoformat() if a.called_at else None,
            "confirmed_at": a.confirmed_at.isoformat() if a.confirmed_at else None,
            "done_at": a.done_at.isoformat() if a.done_at else None,
        } for a in awards
    ])


@router.get("/heats")
async def my_heats(
    td: TokenData = Depends(require_role(ROLE_PLAYER, ROLE_COACH, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """내가 출전하는 모든 히트."""
    p = await _resolve_participant(db, td)
    if not p:
        return APIResponse(data=[])
    res = await db.execute(
        select(Heat)
        .join(heat_participants, Heat.id == heat_participants.c.heat_id)
        .where(heat_participants.c.participant_id == p.id)
        .order_by(Heat.heat_number)
    )
    heats = res.scalars().all()
    return APIResponse(data=[
        {
            "heat_id": str(h.id),
            "station_id": str(h.station_id),
            "heat_number": h.heat_number,
            "started_at": h.started_at.isoformat() if h.started_at else None,
            "ended_at": h.ended_at.isoformat() if h.ended_at else None,
        } for h in heats
    ])
