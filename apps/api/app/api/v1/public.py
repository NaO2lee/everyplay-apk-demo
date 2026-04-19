"""공개 API 엔드포인트 — 인증 불필요.

관람자 페이지에서 사용하는 읽기 전용 이벤트/스테이션 정보 제공.
OBS 접속 정보(host, port, password)는 노출하지 않는다.
"""

from typing import Optional, List
from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import EventStatus
from app.models.event import StationStatus
from app.schemas import APIResponse
from app.services import event_service

router = APIRouter(prefix="/public", tags=["public"])


# ── 공개용 스키마 (민감 정보 제외) ──────────────────────────


class PublicStationResponse(BaseModel):
    id: UUID
    station_number: int
    status: StationStatus
    youtube_stream_url: Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, station):
        return cls(
            id=station.id,
            station_number=station.station_number,
            status=station.status,
            youtube_stream_url=station.youtube_stream_url,
        )


class PublicEventResponse(BaseModel):
    id: UUID
    name: str
    date: date
    status: EventStatus
    event_code: str
    station_count: int
    overlay_config: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PublicEventDetailResponse(PublicEventResponse):
    stations: List[PublicStationResponse] = []


class PublicEventListResponse(BaseModel):
    items: List[PublicEventResponse]
    total: int


# ── 엔드포인트 ──────────────────────────────────────────


@router.get("/events", response_model=APIResponse[PublicEventListResponse])
async def list_public_events(
    db: AsyncSession = Depends(get_db),
):
    """공개 이벤트 목록 (active, completed만 — draft/cancelled 제외)"""
    from sqlalchemy import select, func
    from app.models import Event

    allowed = [EventStatus.ACTIVE, EventStatus.COMPLETED]
    query = (
        select(Event)
        .where(Event.status.in_(allowed))
        .order_by(Event.date.desc())
        .limit(50)
    )
    count_query = select(func.count(Event.id)).where(Event.status.in_(allowed))

    result = await db.execute(query)
    events = result.scalars().all()
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    return APIResponse(
        data=PublicEventListResponse(
            items=[PublicEventResponse.model_validate(e) for e in events],
            total=total,
        )
    )


@router.get("/events/{event_code}", response_model=APIResponse[PublicEventDetailResponse])
async def get_public_event(
    event_code: str,
    db: AsyncSession = Depends(get_db),
):
    """공개 이벤트 상세 (스테이션 포함, OBS 정보 제외)"""
    event = await event_service.get_event_by_code(db, event_code)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # draft 이벤트는 공개하지 않음
    if event.status == EventStatus.DRAFT:
        raise HTTPException(status_code=404, detail="Event not found")

    stations = [PublicStationResponse.from_orm(c) for c in event.stations]
    response = PublicEventDetailResponse(
        **PublicEventResponse.model_validate(event).model_dump(),
        stations=stations,
    )
    return APIResponse(data=response)
