from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import EventStatus
from app.schemas import (
    APIResponse,
    EventCreate,
    EventUpdate,
    EventResponse,
    EventDetailResponse,
    EventListResponse,
    StationResponse,
)
from app.services import event_service

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=APIResponse[EventDetailResponse])
async def create_event(
    event_data: EventCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new event with courts"""
    event = await event_service.create_event(db, event_data)
    stations = [StationResponse.from_orm_with_mask(c) for c in event.stations]
    response = EventDetailResponse(
        **EventResponse.model_validate(event).model_dump(),
        stations=stations,
    )
    return APIResponse(data=response)


@router.get("", response_model=APIResponse[EventListResponse])
async def list_events(
    status: Optional[EventStatus] = None,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """List all events"""
    events, total = await event_service.get_events(db, status, skip, limit)
    return APIResponse(
        data=EventListResponse(
            items=[EventResponse.model_validate(e) for e in events],
            total=total,
        )
    )


@router.get("/by-code/{event_code}", response_model=APIResponse[EventDetailResponse])
async def get_event_by_code(
    event_code: str,
    db: AsyncSession = Depends(get_db),
):
    """Get event details by event code"""
    event = await event_service.get_event_by_code(db, event_code)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    stations = [StationResponse.from_orm_with_mask(c) for c in event.stations]
    response = EventDetailResponse(
        **EventResponse.model_validate(event).model_dump(),
        stations=stations,
    )
    return APIResponse(data=response)


@router.get("/{event_id}", response_model=APIResponse[EventDetailResponse])
async def get_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get event details"""
    event = await event_service.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    stations = [StationResponse.from_orm_with_mask(c) for c in event.stations]
    response = EventDetailResponse(
        **EventResponse.model_validate(event).model_dump(),
        stations=stations,
    )
    return APIResponse(data=response)


MAX_OVERLAY_CONFIG_KB = 32  # 오버레이 설정 JSON 최대 크기 (방어적 제한)


@router.put("/{event_id}/overlay", response_model=APIResponse[dict])
async def save_overlay_config(
    event_id: UUID,
    config: dict,
    db: AsyncSession = Depends(get_db),
):
    """오버레이 설정 저장 (관리자 인증 필요 — router level dependency)"""
    import json
    if not isinstance(config, dict):
        raise HTTPException(status_code=400, detail="overlay_config 는 JSON 객체여야 합니다")

    payload = json.dumps(config, ensure_ascii=False)
    size_kb = len(payload.encode("utf-8")) / 1024
    if size_kb > MAX_OVERLAY_CONFIG_KB:
        raise HTTPException(
            status_code=413,
            detail=f"overlay_config 가 너무 큽니다 ({size_kb:.1f} KB). 최대 {MAX_OVERLAY_CONFIG_KB} KB 허용",
        )

    # 이벤트 존재 확인
    event = await event_service.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다")

    event.overlay_config = config
    await db.commit()

    # 오버레이 설정 변경을 모든 스테이션에 SSE broadcast
    from app.api.v1.overlay import get_broker
    broker = get_broker()
    for station in (event.stations or []):
        await broker.publish(str(station.id), {
            "type": "config_update",
            "overlay_config": config,
        })

    return APIResponse(data={"ok": True})


@router.patch("/{event_id}", response_model=APIResponse[EventResponse])
async def update_event(
    event_id: UUID,
    event_data: EventUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update event"""
    event = await event_service.update_event(db, event_id, event_data)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return APIResponse(data=EventResponse.model_validate(event))


@router.patch("/{event_id}/status", response_model=APIResponse[EventResponse])
async def update_event_status(
    event_id: UUID,
    status: EventStatus,
    db: AsyncSession = Depends(get_db),
):
    """Update event status"""
    event = await event_service.update_event(
        db, event_id, EventUpdate(status=status)
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return APIResponse(data=EventResponse.model_validate(event))
