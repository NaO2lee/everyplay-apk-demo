"""YouTube OAuth 계정 풀 관리 — 여러 대회·스테이션에서 재사용.

client_secret / refresh_token 은 응답 시 마스킹 처리. 내부 시스템이라 DB 에는 평문 저장.
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import YoutubeAccount
from app.schemas import APIResponse

router = APIRouter(prefix="/youtube-accounts", tags=["youtube-accounts"])


class YoutubeAccountItem(BaseModel):
    id: UUID
    email: str
    label: Optional[str] = None
    client_id_masked: Optional[str] = None
    client_secret_masked: Optional[str] = None
    refresh_token_masked: Optional[str] = None
    has_credentials: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class YoutubeAccountCreate(BaseModel):
    email: str
    label: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    refresh_token: Optional[str] = None


class YoutubeAccountUpdate(BaseModel):
    email: Optional[str] = None
    label: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    refresh_token: Optional[str] = None


def _mask(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}...{value[-4:]}"


def _to_item(acc: YoutubeAccount) -> YoutubeAccountItem:
    return YoutubeAccountItem(
        id=acc.id,
        email=acc.email,
        label=acc.label,
        client_id_masked=_mask(acc.client_id),
        client_secret_masked=_mask(acc.client_secret),
        refresh_token_masked=_mask(acc.refresh_token),
        has_credentials=bool(acc.client_id and acc.client_secret and acc.refresh_token),
        created_at=acc.created_at,
        updated_at=acc.updated_at,
    )


@router.get("", response_model=APIResponse[List[YoutubeAccountItem]])
async def list_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(YoutubeAccount).order_by(YoutubeAccount.email))
    accounts = result.scalars().all()
    return APIResponse(data=[_to_item(a) for a in accounts])


@router.post("", response_model=APIResponse[YoutubeAccountItem])
async def create_account(body: YoutubeAccountCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(YoutubeAccount).where(YoutubeAccount.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="이미 등록된 이메일")
    acc = YoutubeAccount(
        email=body.email,
        label=body.label,
        client_id=body.client_id,
        client_secret=body.client_secret,
        refresh_token=body.refresh_token,
    )
    db.add(acc)
    await db.commit()
    await db.refresh(acc)
    from app.core.event_bus import push_event
    push_event("success", f"유튜브 계정 추가됨: {acc.email}")
    return APIResponse(data=_to_item(acc))


@router.put("/{account_id}", response_model=APIResponse[YoutubeAccountItem])
async def update_account(
    account_id: UUID,
    body: YoutubeAccountUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(YoutubeAccount).where(YoutubeAccount.id == account_id))
    acc = result.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="계정 없음")
    fields = body.model_dump(exclude_unset=True)
    for k, v in fields.items():
        if isinstance(v, str) and v == "":
            v = None
        setattr(acc, k, v)
    await db.commit()
    await db.refresh(acc)
    from app.core.event_bus import push_event
    changed = [k for k in fields.keys() if k not in ("client_secret", "refresh_token")]
    push_event("info", f"유튜브 계정 수정됨 ({acc.email}): {', '.join(changed) if changed else '크리덴셜'}")
    return APIResponse(data=_to_item(acc))


@router.delete("/{account_id}", response_model=APIResponse[dict])
async def delete_account(account_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(YoutubeAccount).where(YoutubeAccount.id == account_id))
    acc = result.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="계정 없음")
    email = acc.email
    await db.delete(acc)
    await db.commit()
    from app.core.event_bus import push_event
    push_event("warn", f"유튜브 계정 삭제됨: {email}")
    return APIResponse(data={"deleted": True})
