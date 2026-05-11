"""광고 그리드 서비스 — 전역 설정 + 슬롯 매핑."""
import json
import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import AdSetting, AdSlot
from app.schemas import AdSettingUpdate, AdSlotCreate, AdSlotUpdate


SETTINGS_ID = 1  # 단일 행 PK


async def get_settings(db: AsyncSession) -> AdSetting:
    """전역 설정 한 행. 없으면 생성."""
    row = (await db.execute(select(AdSetting).where(AdSetting.id == SETTINGS_ID))).scalar_one_or_none()
    if row is None:
        row = AdSetting(id=SETTINGS_ID, grid_template=None)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


async def update_settings(db: AsyncSession, data: AdSettingUpdate) -> AdSetting:
    row = await get_settings(db)
    payload = data.model_dump(exclude_unset=True)
    if "slot_modes" in payload and payload["slot_modes"] is not None:
        payload["slot_modes"] = json.dumps(payload["slot_modes"])
    if "row_heights" in payload and payload["row_heights"] is not None:
        payload["row_heights"] = json.dumps(payload["row_heights"])
    for k, v in payload.items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row


async def list_slots(db: AsyncSession, only_active: bool = False) -> List[AdSlot]:
    q = (
        select(AdSlot)
        .options(selectinload(AdSlot.sponsor))
        .order_by(AdSlot.slot_index.asc(), AdSlot.weight.desc(), AdSlot.created_at.asc())
    )
    if only_active:
        q = q.where(AdSlot.active == True)  # noqa: E712
    return list((await db.execute(q)).scalars().all())


async def create_slot(db: AsyncSession, data: AdSlotCreate) -> AdSlot:
    slot = AdSlot(
        sponsor_id=data.sponsor_id,
        slot_index=data.slot_index,
        banner_position=data.banner_position,
        banner_zoom=data.banner_zoom,
        banner_fit=data.banner_fit,
        banner_offset_x=data.banner_offset_x,
        banner_offset_y=data.banner_offset_y,
        weight=data.weight,
        active=data.active,
    )
    db.add(slot)
    await db.commit()
    return (await db.execute(
        select(AdSlot).options(selectinload(AdSlot.sponsor)).where(AdSlot.id == slot.id)
    )).scalar_one()


async def update_slot(db: AsyncSession, slot_id: uuid.UUID, data: AdSlotUpdate) -> Optional[AdSlot]:
    slot = (await db.execute(
        select(AdSlot).options(selectinload(AdSlot.sponsor)).where(AdSlot.id == slot_id)
    )).scalar_one_or_none()
    if slot is None:
        return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(slot, k, v)
    await db.commit()
    await db.refresh(slot)
    return slot


async def delete_slot(db: AsyncSession, slot_id: uuid.UUID) -> bool:
    slot = (await db.execute(select(AdSlot).where(AdSlot.id == slot_id))).scalar_one_or_none()
    if slot is None:
        return False
    await db.delete(slot)
    await db.commit()
    return True
