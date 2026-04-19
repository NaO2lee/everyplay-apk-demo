from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import NotificationStatus
from app.schemas import (
    APIResponse,
    NotifyRequest,
    NotifyAllRequest,
    NotifyResult,
    BulkNotifyResult,
    NotificationResponse,
)
from app.services import notification_service

router = APIRouter(tags=["notifications"])


@router.post("/heats/{heat_id}/notify", response_model=APIResponse[NotifyResult])
async def notify_heat_participants(
    heat_id: UUID,
    notify_data: NotifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Send notifications for a heat"""
    notifications = await notification_service.create_notifications(
        db,
        heat_id,
        notify_data.channel,
        notify_data.participant_ids,
    )
    
    if not notifications:
        raise HTTPException(
            status_code=400,
            detail="No participants to notify or notifications already sent"
        )
    
    # Queue notifications for sending (async)
    # In production, this would be done via Celery
    for notification in notifications:
        await notification_service.send_notification(db, notification.id)
    
    return APIResponse(
        data=NotifyResult(
            queued=len(notifications),
            notification_ids=[n.id for n in notifications],
        )
    )


@router.post("/events/{event_id}/notify-all", response_model=APIResponse[BulkNotifyResult])
async def notify_all_participants(
    event_id: UUID,
    notify_data: NotifyAllRequest,
    db: AsyncSession = Depends(get_db),
):
    """Send notifications for all heats in an event"""
    # Get all heats that haven't been notified
    from app.services import heat_service
    # 페이지네이션으로 전체 히트를 순회 (최대 제한 방지)
    all_heats = []
    page_skip = 0
    page_size = 100
    while True:
        batch, _ = await heat_service.get_heats_by_event(
            db, event_id, status=None, skip=page_skip, limit=page_size
        )
        all_heats.extend(batch)
        if len(batch) < page_size:
            break
        page_skip += page_size
    heats = all_heats
    
    total_queued = 0
    for heat in heats:
        # 클립 URL 또는 YouTube link 가 있는 완료 히트만 대상
        if heat.clip_url or heat.youtube_link:
            notifications = await notification_service.create_notifications(
                db,
                heat.id,
                notify_data.channel,
            )
            total_queued += len(notifications)
            
            # Queue for sending
            for notification in notifications:
                await notification_service.send_notification(db, notification.id)
    
    # Estimate time (assuming ~100 SMS per minute)
    estimated_minutes = max(1, total_queued // 100)
    
    return APIResponse(
        data=BulkNotifyResult(
            queued=total_queued,
            estimated_time_minutes=estimated_minutes,
        )
    )


@router.get("/notifications/{notification_id}", response_model=APIResponse[NotificationResponse])
async def get_notification(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get notification status"""
    from sqlalchemy import select
    from app.models import Notification
    
    query = select(Notification).where(Notification.id == notification_id)
    result = await db.execute(query)
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return APIResponse(data=NotificationResponse.model_validate(notification))


@router.get("/events/{event_id}/notifications", response_model=APIResponse[list])
async def list_event_notifications(
    event_id: UUID,
    status: NotificationStatus = None,
    db: AsyncSession = Depends(get_db),
):
    """List notifications for an event"""
    notifications = await notification_service.get_notifications(
        db,
        event_id=event_id,
        status=status,
    )
    return APIResponse(
        data=[NotificationResponse.model_validate(n) for n in notifications]
    )
