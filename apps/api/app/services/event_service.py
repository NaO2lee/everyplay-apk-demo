import uuid
import random
import string
from datetime import datetime
from typing import Optional, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Event, Station, EventStatus, StationStatus
from app.schemas import EventCreate, EventUpdate


def generate_event_code() -> str:
    """Generate unique event code like EP2026-ABC"""
    year = datetime.now().year
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=3))
    return f"EP{year}-{suffix}"


DEFAULT_OVERLAY_CONFIG = {
    "elements": [
        {"id": "courtLabel", "color": "#ffffff", "label": "스테이션 번호", "binding": "station_number", "content": "", "offsetX": 3, "offsetY": 19, "visible": True, "fontSize": 36, "fontFamily": "Pretendard", "fontWeight": "bold", "borderColor": "transparent", "borderWidth": 0, "elementType": "text", "backgroundColor": "#000000b3"},
        {"id": "liveBadge", "color": "#ffffff", "label": "LIVE 뱃지", "binding": "live_badge", "content": "", "offsetX": 92, "offsetY": 19, "visible": True, "fontSize": 28, "fontFamily": "Pretendard", "fontWeight": "bold", "borderColor": "transparent", "borderWidth": 0, "elementType": "text", "backgroundColor": "#dc2626e6"},
        {"id": "timer", "color": "#34d399", "label": "타이머", "binding": "none", "content": "", "offsetX": 98, "offsetY": 96, "visible": True, "fontSize": 48, "fontFamily": "JetBrains Mono, monospace", "fontWeight": "bold", "borderColor": "transparent", "borderWidth": 0, "elementType": "timer", "backgroundColor": "#000000cc"},
        {"id": "hitNumber", "color": "#facc15", "label": "HIT 번호", "binding": "heat_number", "content": "", "offsetX": 15, "offsetY": 19, "visible": True, "fontSize": 36, "fontFamily": "Pretendard", "fontWeight": "bold", "borderColor": "transparent", "borderWidth": 0, "elementType": "text", "backgroundColor": "transparent"},
        {"id": "participant", "color": "#ffffff", "label": "선수 이름", "binding": "participants", "content": "", "offsetX": 4, "offsetY": 93, "visible": True, "fontSize": 30, "fontFamily": "Pretendard", "fontWeight": "normal", "borderColor": "transparent", "borderWidth": 0, "elementType": "text", "backgroundColor": "#1f2937"},
        {"id": "eventType", "color": "#ffffff", "label": "종목", "binding": "event_type", "content": "", "offsetX": 84, "offsetY": 95, "visible": True, "fontSize": 30, "fontFamily": "Pretendard", "fontWeight": "normal", "borderColor": "transparent", "borderWidth": 0, "elementType": "text", "backgroundColor": "#000000b3"},
    ],
    "resolution": {"width": 1920, "height": 1080},
}


async def create_event(db: AsyncSession, event_data: EventCreate) -> Event:
    """Create with stations"""
    event = Event(
        name=event_data.name,
        date=event_data.date,
        end_date=event_data.end_date,
        station_count=event_data.station_count,
        youtube_channel_id=event_data.youtube_channel_id,
        event_code=generate_event_code(),
        overlay_config=DEFAULT_OVERLAY_CONFIG,
    )
    db.add(event)
    await db.flush()

    # Create stations
    for i in range(1, event_data.station_count + 1):
        station = Station(
            event_id=event.id,
            station_number=i,
        )
        db.add(station)

    await db.commit()
    
    # Reload with courts eagerly loaded
    return await get_event(db, event.id)


async def get_event(db: AsyncSession, event_id: uuid.UUID) -> Optional[Event]:
    """Get with stations"""
    query = (
        select(Event)
        .options(selectinload(Event.stations))
        .where(Event.id == event_id)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_event_by_code(db: AsyncSession, event_code: str) -> Optional[Event]:
    """Get with stations"""
    query = (
        select(Event)
        .options(selectinload(Event.stations))
        .where(Event.event_code == event_code)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_court(db: AsyncSession, station_id: uuid.UUID) -> Optional[Station]:
    """Get station by ID with event relationship"""
    query = select(Station).options(selectinload(Station.event)).where(Station.id == station_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_events(
    db: AsyncSession,
    status: Optional[EventStatus] = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[List[Event], int]:
    """Get list of events"""
    query = select(Event)
    count_query = select(func.count(Event.id))

    if status:
        query = query.where(Event.status == status)
        count_query = count_query.where(Event.status == status)

    query = query.order_by(Event.date.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    count_result = await db.execute(count_query)

    return result.scalars().all(), count_result.scalar()


async def update_event(
    db: AsyncSession,
    event_id: uuid.UUID,
    event_data: EventUpdate,
) -> Optional[Event]:
    """Update event"""
    event = await get_event(db, event_id)
    if not event:
        return None

    update_data = event_data.model_dump(exclude_unset=True)
    
    # date 문자열 → date 객체 변환
    from datetime import date as date_type
    if 'date' in update_data and update_data['date']:
        update_data['date'] = date_type.fromisoformat(update_data['date'])
    if 'end_date' in update_data:
        if update_data['end_date']:
            update_data['end_date'] = date_type.fromisoformat(update_data['end_date'])
        else:
            update_data['end_date'] = None
    
    # station_count 변경 처리
    new_station_count = update_data.pop('station_count', None)
    if new_station_count is not None and new_station_count != event.station_count:
        current_count = event.station_count
        
        if new_station_count > current_count:
            # 스테이션 추가
            for i in range(current_count + 1, new_station_count + 1):
                new_court = Station(
                    event_id=event.id,
                    station_number=i,
                    status=StationStatus.IDLE,
                )
                db.add(new_court)
        elif new_station_count < current_count:
            # 스테이션 삭제 (번호 높은 것부터)
            courts_to_delete = await db.execute(
                select(Station)
                .where(Station.event_id == event.id)
                .where(Station.station_number > new_station_count)
            )
            for station in courts_to_delete.scalars().all():
                await db.delete(station)
        
        event.station_count = new_station_count
    
    for field, value in update_data.items():
        setattr(event, field, value)

    event.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(event)
    return event


async def update_court_obs_config(
    db: AsyncSession,
    station_id: uuid.UUID,
    **fields,
) -> Optional[Station]:
    """스테이션별 OBS 접속 정보 업데이트.

    전달된 필드만 갱신한다 (키 자체가 없는 필드는 건드리지 않음).
    빈 문자열은 NULL 로 정규화.
    """
    query = select(Station).where(Station.id == station_id)
    result = await db.execute(query)
    station = result.scalar_one_or_none()

    if not station:
        return None

    allowed = {"obs_host", "obs_port", "obs_password", "youtube_stream_url", "youtube_stream_key", "youtube_offset_seconds"}
    for key, value in fields.items():
        if key not in allowed:
            continue
        if isinstance(value, str) and value == "":
            value = None
        setattr(station, key, value)

    await db.commit()
    await db.refresh(station)
    return station


async def clear_court_obs_config(
    db: AsyncSession,
    station_id: uuid.UUID,
) -> Optional[Station]:
    """스테이션의 OBS 접속 정보 전체 초기화.

    obs_port 는 DB 스키마상 NOT NULL 이라 기본값 4455 로 되돌림.
    나머지(host / password / youtube URL) 는 NULL 로.
    """
    query = select(Station).where(Station.id == station_id)
    result = await db.execute(query)
    station = result.scalar_one_or_none()
    if not station:
        return None
    station.obs_host = None
    station.obs_port = 4455
    station.obs_password = None
    station.youtube_stream_url = None
    station.youtube_stream_key = None
    station.youtube_offset_seconds = 0.0
    await db.commit()
    await db.refresh(station)
    return station


async def update_court_status(
    db: AsyncSession,
    station_id: uuid.UUID,
    status: StationStatus,
) -> Optional[Station]:
    """스테이션 상태만 갱신 (OBS 상태 동기화용)"""
    query = select(Station).where(Station.id == station_id)
    result = await db.execute(query)
    station = result.scalar_one_or_none()

    if not station:
        return None

    station.status = status
    await db.commit()
    await db.refresh(station)
    return station
