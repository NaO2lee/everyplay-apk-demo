import uuid
from typing import Optional, List

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Participant
from app.schemas import ParticipantCreate, ParticipantUpdate


async def create_participant(
    db: AsyncSession,
    event_id: uuid.UUID,
    participant_data: ParticipantCreate,
) -> Participant:
    """Create a new participant"""
    participant = Participant(
        event_id=event_id,
        name=participant_data.name,
        phone=participant_data.phone,
        team=participant_data.team,
        category=participant_data.category,
    )
    db.add(participant)
    await db.commit()
    await db.refresh(participant)
    return participant


async def get_participant(db: AsyncSession, participant_id: uuid.UUID) -> Optional[Participant]:
    """Get participant by ID"""
    query = select(Participant).where(Participant.id == participant_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_participants(
    db: AsyncSession,
    event_id: uuid.UUID,
    search: Optional[str] = None,
    team: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[List[Participant], int]:
    """Get participants for an event"""
    query = select(Participant).where(Participant.event_id == event_id)
    count_query = select(func.count(Participant.id)).where(Participant.event_id == event_id)

    if search:
        search_filter = or_(
            Participant.name.ilike(f"%{search}%"),
            Participant.phone.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if team:
        query = query.where(Participant.team == team)
        count_query = count_query.where(Participant.team == team)

    query = query.order_by(Participant.name).offset(skip).limit(limit)

    result = await db.execute(query)
    count_result = await db.execute(count_query)

    return result.scalars().all(), count_result.scalar()


async def update_participant(
    db: AsyncSession,
    participant_id: uuid.UUID,
    participant_data: ParticipantUpdate,
) -> Optional[Participant]:
    """Update participant"""
    participant = await get_participant(db, participant_id)
    if not participant:
        return None

    update_data = participant_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(participant, field, value)

    await db.commit()
    await db.refresh(participant)
    return participant


async def delete_participant(db: AsyncSession, participant_id: uuid.UUID) -> bool:
    """Delete participant"""
    participant = await get_participant(db, participant_id)
    if not participant:
        return False

    await db.delete(participant)
    await db.commit()
    return True


async def bulk_create_participants(
    db: AsyncSession,
    event_id: uuid.UUID,
    participants_data: List[dict],
) -> tuple[int, int, List[dict]]:
    """Bulk create participants from CSV data.

    각 row 를 savepoint 로 격리해서 실패한 row 가 전체 트랜잭션을 오염시키지 않도록 한다.
    """
    imported = 0
    failed = 0
    errors: List[dict] = []

    for idx, data in enumerate(participants_data, start=1):
        name = (data.get("name") or "").strip()
        phone = (data.get("phone") or "").replace("-", "").replace(" ", "")
        team = (data.get("team") or "").strip() or None
        category = (data.get("category") or "").strip() or None

        if not name or not phone:
            failed += 1
            errors.append({"row": idx, "message": "이름과 전화번호는 필수입니다"})
            continue

        try:
            # 각 row 마다 nested savepoint 로 격리
            async with db.begin_nested():
                participant = Participant(
                    event_id=event_id,
                    name=name,
                    phone=phone,
                    team=team,
                    category=category,
                )
                db.add(participant)
                # flush 로 개별 row 검증 (unique, length 등)
                await db.flush()
            imported += 1
        except Exception as e:
            failed += 1
            errors.append({"row": idx, "message": str(e)[:200]})

    if imported > 0:
        try:
            await db.commit()
        except Exception as e:
            await db.rollback()
            # 최종 commit 실패 — 전부 실패로 처리
            return 0, len(participants_data), [
                {"row": 0, "message": f"최종 commit 실패: {str(e)[:200]}"}
            ]

    return imported, failed, errors
