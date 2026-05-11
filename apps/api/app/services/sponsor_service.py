"""스폰서 + 이벤트-스폰서 연결 CRUD."""
import uuid
from typing import Optional, List, Tuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Sponsor, EventSponsor, SponsorSlotType
from app.schemas import SponsorCreate, SponsorUpdate, EventSponsorCreate, EventSponsorUpdate


async def list_sponsors(db: AsyncSession, skip: int = 0, limit: int = 100) -> Tuple[List[Sponsor], int]:
    total = (await db.execute(select(func.count(Sponsor.id)))).scalar_one()
    rows = (await db.execute(select(Sponsor).order_by(Sponsor.name).offset(skip).limit(limit))).scalars().all()
    return list(rows), total


async def get_sponsor(db: AsyncSession, sponsor_id: uuid.UUID) -> Optional[Sponsor]:
    return (await db.execute(select(Sponsor).where(Sponsor.id == sponsor_id))).scalar_one_or_none()


async def create_sponsor(db: AsyncSession, data: SponsorCreate) -> Sponsor:
    sp = Sponsor(**data.model_dump())
    db.add(sp)
    await db.commit()
    await db.refresh(sp)
    return sp


async def update_sponsor(db: AsyncSession, sponsor_id: uuid.UUID, data: SponsorUpdate) -> Optional[Sponsor]:
    sp = await get_sponsor(db, sponsor_id)
    if not sp:
        return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(sp, k, v)
    await db.commit()
    await db.refresh(sp)
    return sp


async def delete_sponsor(db: AsyncSession, sponsor_id: uuid.UUID) -> bool:
    sp = await get_sponsor(db, sponsor_id)
    if not sp:
        return False
    await db.delete(sp)
    await db.commit()
    return True


async def list_event_sponsors(db: AsyncSession, event_id: uuid.UUID, only_active: bool = False) -> List[EventSponsor]:
    q = (
        select(EventSponsor)
        .options(selectinload(EventSponsor.sponsor))
        .where(EventSponsor.event_id == event_id)
        .order_by(EventSponsor.weight.desc(), EventSponsor.created_at.asc())
    )
    if only_active:
        q = q.where(EventSponsor.active == True)  # noqa: E712
    return list((await db.execute(q)).scalars().all())


async def link_sponsor_to_event(db: AsyncSession, event_id: uuid.UUID, data: EventSponsorCreate) -> EventSponsor:
    link = EventSponsor(
        event_id=event_id,
        sponsor_id=data.sponsor_id,
        slot_type=data.slot_type,
        weight=data.weight,
        active=data.active,
    )
    db.add(link)
    await db.commit()
    # sponsor 필드 eager 로드를 위해 재조회
    return (await db.execute(
        select(EventSponsor).options(selectinload(EventSponsor.sponsor)).where(EventSponsor.id == link.id)
    )).scalar_one()


async def update_event_sponsor(db: AsyncSession, link_id: uuid.UUID, data: EventSponsorUpdate) -> Optional[EventSponsor]:
    link = (await db.execute(
        select(EventSponsor).options(selectinload(EventSponsor.sponsor)).where(EventSponsor.id == link_id)
    )).scalar_one_or_none()
    if not link:
        return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(link, k, v)
    await db.commit()
    await db.refresh(link)
    return link


async def unlink_sponsor_from_event(db: AsyncSession, link_id: uuid.UUID) -> bool:
    link = (await db.execute(select(EventSponsor).where(EventSponsor.id == link_id))).scalar_one_or_none()
    if not link:
        return False
    await db.delete(link)
    await db.commit()
    return True
