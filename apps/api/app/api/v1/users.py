"""사용자 관리 라우터 (v3.3 신규).

엔드포인트:
- GET    /users                목록 (admin만, role/active 필터)
- GET    /users/{id}            상세
- PATCH  /users/{id}            role/is_active 변경 (admin만, audit)
- DELETE /users/{id}            soft delete (is_active=False, audit)

회원가입은 /auth/signup. 비밀번호 변경은 추후.
"""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import (
    ALL_ROLES,
    ROLE_ADMIN,
    TokenData,
    require_role,
)
from app.core.database import get_db
from app.models import AuditLog, User, UserRole
from app.schemas import APIResponse

router = APIRouter(prefix="/users", tags=["users"])


class UserItem(BaseModel):
    id: UUID
    email: str
    name: str
    role: str
    is_active: bool
    phone_number: Optional[str] = None
    country_code: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None


class UserPatch(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    name: Optional[str] = None
    phone_number: Optional[str] = None
    country_code: Optional[str] = None


def _to_item(u: User) -> UserItem:
    return UserItem(
        id=u.id, email=u.email, name=u.name,
        role=u.role.value if hasattr(u.role, "value") else u.role,
        is_active=u.is_active,
        phone_number=u.phone_number, country_code=u.country_code,
        created_at=u.created_at, last_login=u.last_login,
    )


def _to_uuid_or_none(v):
    try:
        return UUID(str(v))
    except (ValueError, TypeError):
        return None


@router.get("", response_model=APIResponse[list[UserItem]])
async def list_users(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = Query(200, ge=1, le=1000),
    td: TokenData = Depends(require_role(ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """admin만. role/is_active 필터."""
    q = select(User).order_by(User.created_at.desc()).limit(limit)
    if role:
        if role not in ALL_ROLES:
            raise HTTPException(status_code=400, detail=f"unknown role: {role}")
        q = q.where(User.role == UserRole(role))
    if is_active is not None:
        q = q.where(User.is_active == is_active)
    res = await db.execute(q)
    return APIResponse(data=[_to_item(u) for u in res.scalars().all()])


@router.get("/{user_id}", response_model=APIResponse[UserItem])
async def get_user(
    user_id: UUID,
    td: TokenData = Depends(require_role(ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(User).where(User.id == user_id))
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="user not found")
    return APIResponse(data=_to_item(u))


@router.patch("/{user_id}", response_model=APIResponse[UserItem])
async def update_user(
    user_id: UUID,
    body: UserPatch,
    td: TokenData = Depends(require_role(ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """admin만. role 변경 / 활성/비활성 / 이름·폰·국적 수정. audit 자동."""
    res = await db.execute(select(User).where(User.id == user_id))
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="user not found")

    before = {
        "role": u.role.value if hasattr(u.role, "value") else u.role,
        "is_active": u.is_active, "name": u.name,
        "phone_number": u.phone_number, "country_code": u.country_code,
    }
    changed = {}
    if body.role is not None and body.role in ALL_ROLES:
        u.role = UserRole(body.role)
        changed["role"] = body.role
    if body.is_active is not None and body.is_active != u.is_active:
        u.is_active = body.is_active
        changed["is_active"] = body.is_active
    if body.name is not None and body.name != u.name:
        u.name = body.name
        changed["name"] = body.name
    if body.phone_number is not None and body.phone_number != u.phone_number:
        u.phone_number = body.phone_number
        changed["phone_number"] = body.phone_number
    if body.country_code is not None and body.country_code != u.country_code:
        u.country_code = body.country_code
        changed["country_code"] = body.country_code

    if changed:
        db.add(AuditLog(
            actor_id=_to_uuid_or_none(td.user_id), actor_role=td.role,
            action_type="user_updated", target_type="user", target_id=u.id,
            before_value={k: before[k] for k in changed.keys()}, after_value=changed,
            timestamp=datetime.utcnow(),
        ))

    await db.commit()
    await db.refresh(u)
    return APIResponse(data=_to_item(u))


@router.delete("/{user_id}", response_model=APIResponse[dict])
async def deactivate_user(
    user_id: UUID,
    reason: Optional[str] = None,
    td: TokenData = Depends(require_role(ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """soft delete — is_active=False. 실제 행 삭제 안 함 (audit log + FK 보존)."""
    res = await db.execute(select(User).where(User.id == user_id))
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="user not found")
    if not u.is_active:
        raise HTTPException(status_code=400, detail="이미 비활성")

    u.is_active = False
    db.add(AuditLog(
        actor_id=_to_uuid_or_none(td.user_id), actor_role=td.role,
        action_type="user_deactivated", target_type="user", target_id=u.id,
        before_value={"is_active": True, "email": u.email, "role": u.role.value if hasattr(u.role, "value") else u.role},
        reason=reason or "비활성화 (사유 없음)",
        timestamp=datetime.utcnow(),
    ))
    await db.commit()
    return APIResponse(data={"deactivated": True, "user_id": str(user_id)})
