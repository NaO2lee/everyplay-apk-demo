import re
import uuid
from datetime import datetime
from typing import Optional, List
from urllib.parse import urlparse, parse_qs

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Heat, Station, Participant, HeatStatus


def _extract_youtube_video_id(url: str) -> Optional[str]:
    """YouTube URL에서 video id 안전하게 추출.

    지원 포맷:
      - https://www.youtube.com/watch?v=abc123
      - https://youtu.be/abc123
      - https://www.youtube.com/live/abc123
      - https://youtube.com/live/abc123?si=...
    """
    if not url:
        return None
    try:
        parsed = urlparse(url)
        host = (parsed.netloc or "").lower()
        path = parsed.path or ""

        # watch?v=VIDEOID
        if "youtube" in host and path.startswith("/watch"):
            qs = parse_qs(parsed.query)
            v = qs.get("v", [None])[0]
            if v:
                return v

        # youtu.be/VIDEOID
        if host == "youtu.be" and len(path) > 1:
            return path.strip("/").split("/")[0]

        # youtube.com/live/VIDEOID
        if "youtube" in host and "/live/" in path:
            m = re.search(r"/live/([A-Za-z0-9_\-]+)", path)
            if m:
                return m.group(1)

        # youtube.com/embed/VIDEOID
        if "youtube" in host and "/embed/" in path:
            m = re.search(r"/embed/([A-Za-z0-9_\-]+)", path)
            if m:
                return m.group(1)
    except Exception:
        pass
    return None


def _format_youtube_timestamp(total_seconds: int) -> str:
    """초 숫자 → 유튜브 t 파라미터 포맷 (`1h2m3s` / `2m3s` / `3s`)."""
    total_seconds = max(0, int(total_seconds))
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    if hours > 0:
        return f"{hours}h{minutes}m{seconds}s"
    if minutes > 0:
        return f"{minutes}m{seconds}s"
    return f"{seconds}s"


def calculate_youtube_timestamp(started_at: datetime, stream_start: datetime = None) -> str:
    """서버 시계 기반 유튜브 타임스탬프 (폴백용).

    OBS 스트림 타임코드가 있으면 호출자가 `_format_youtube_timestamp` 를 직접 사용할 것.
    """
    if stream_start:
        delta = started_at - stream_start
        total_seconds = int(delta.total_seconds())
    else:
        total_seconds = started_at.hour * 3600 + started_at.minute * 60 + started_at.second
    return _format_youtube_timestamp(total_seconds)


async def start_heat(
    db: AsyncSession,
    station_id: uuid.UUID,
    heat_number: int,
    participant_ids: Optional[List[uuid.UUID]] = None,
) -> Optional[Heat]:
    """Start a new heat"""
    # Get station
    court_query = select(Station).where(Station.id == station_id)
    result = await db.execute(court_query)
    station = result.scalar_one_or_none()

    if not station:
        return None

    # Create heat
    started_at = datetime.utcnow()
    
    # 스트림 시작 시간 기준으로 타임스탬프 계산
    stream_start = station.stream_started_at
    youtube_ts = calculate_youtube_timestamp(started_at, stream_start)
    
    heat = Heat(
        station_id=station_id,
        heat_number=heat_number,
        started_at=started_at,
        youtube_timestamp=youtube_ts,
    )
    db.add(heat)
    await db.flush()

    # Add participants if provided
    if participant_ids:
        from app.models.heat import heat_participants
        for pid in participant_ids:
            await db.execute(
                heat_participants.insert().values(heat_id=heat.id, participant_id=pid)
            )

    await db.commit()

    # reload with relationships
    reload_query = (
        select(Heat)
        .options(selectinload(Heat.participants), selectinload(Heat.station))
        .where(Heat.id == heat.id)
    )
    result = await db.execute(reload_query)
    return result.scalar_one_or_none()


async def end_heat(
    db: AsyncSession,
    heat_id: uuid.UUID,
) -> Optional[Heat]:
    """End a heat"""
    query = (
        select(Heat)
        .options(selectinload(Heat.station), selectinload(Heat.participants))
        .where(Heat.id == heat_id)
    )
    result = await db.execute(query)
    heat = result.scalar_one_or_none()

    if not heat or heat.status != HeatStatus.ACTIVE:
        return None

    ended_at = datetime.utcnow()
    heat.ended_at = ended_at
    heat.duration_seconds = int((ended_at - heat.started_at).total_seconds())
    heat.status = HeatStatus.COMPLETED

    # Generate YouTube link — URL 파싱으로 정확한 video_id 추출
    if heat.station.youtube_stream_url and heat.youtube_timestamp:
        video_id = _extract_youtube_video_id(heat.station.youtube_stream_url)
        if video_id:
            heat.youtube_link = f"https://youtube.com/watch?v={video_id}&t={heat.youtube_timestamp}"

    await db.commit()

    # reload with relationships
    reload_query = (
        select(Heat)
        .options(selectinload(Heat.station), selectinload(Heat.participants))
        .where(Heat.id == heat_id)
    )
    result = await db.execute(reload_query)
    return result.scalar_one_or_none()


async def get_heat(db: AsyncSession, heat_id: uuid.UUID) -> Optional[Heat]:
    """Get heat by ID"""
    query = (
        select(Heat)
        .options(
            selectinload(Heat.station),
            selectinload(Heat.participants),
        )
        .where(Heat.id == heat_id)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_heats_by_event(
    db: AsyncSession,
    event_id: uuid.UUID,
    station_id: Optional[uuid.UUID] = None,
    status: Optional[HeatStatus] = None,
    skip: int = 0,
    limit: int = 20,
    session_id: Optional[uuid.UUID] = None,
) -> tuple[List[Heat], int]:
    """Get heats for an event"""
    query = (
        select(Heat)
        .join(Station)
        .options(
            selectinload(Heat.station),
            selectinload(Heat.participants),
        )
        .where(Station.event_id == event_id)
    )
    count_query = (
        select(func.count(Heat.id))
        .join(Station)
        .where(Station.event_id == event_id)
    )

    if station_id:
        query = query.where(Heat.station_id == station_id)
        count_query = count_query.where(Heat.station_id == station_id)

    if status:
        query = query.where(Heat.status == status)
        count_query = count_query.where(Heat.status == status)

    if session_id:
        query = query.where(Heat.session_id == session_id)
        count_query = count_query.where(Heat.session_id == session_id)

    query = query.order_by(Heat.started_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    count_result = await db.execute(count_query)

    return result.scalars().all(), count_result.scalar()


async def update_heat_participants(
    db: AsyncSession,
    heat_id: uuid.UUID,
    participant_ids: List[uuid.UUID],
) -> Optional[Heat]:
    """Update participants for a heat"""
    heat = await get_heat(db, heat_id)
    if not heat:
        return None

    # Get participants
    participant_query = select(Participant).where(Participant.id.in_(participant_ids))
    result = await db.execute(participant_query)
    participants = result.scalars().all()

    heat.participants = list(participants)
    await db.commit()
    await db.refresh(heat)
    return heat
