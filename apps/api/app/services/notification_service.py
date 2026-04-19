import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Notification, Heat, Participant, NotificationChannel, NotificationStatus
from app.core.config import settings


def build_notification_message(
    event_name: str,
    participant_name: str,
    station_number: int,
    heat_time: datetime,
    video_url: str,
) -> str:
    """Build notification message.

    video_url: 우선순위 — Google Drive 클립 URL > YouTube 링크 > 빈 문자열
    """
    time_str = heat_time.strftime("%H:%M")
    link_line = f"\n▶ 영상 보기: {video_url}" if video_url else ""

    return f"""[모두의플레이] {event_name}

{participant_name}님의 경기 영상입니다.
스테이션: {station_number}번
시간: {time_str}{link_line}

* 본 메시지는 발신 전용입니다."""


async def create_notifications(
    db: AsyncSession,
    heat_id: uuid.UUID,
    channel: NotificationChannel = NotificationChannel.SMS,
    participant_ids: Optional[List[uuid.UUID]] = None,
) -> List[Notification]:
    """Create notifications for a heat"""
    # Get heat with participants
    query = (
        select(Heat)
        .options(
            selectinload(Heat.participants),
            selectinload(Heat.station),
        )
        .where(Heat.id == heat_id)
    )
    result = await db.execute(query)
    heat = result.scalar_one_or_none()

    if not heat:
        return []

    # Determine which participants to notify
    participants = heat.participants
    if participant_ids:
        participants = [p for p in participants if p.id in participant_ids]

    if not participants:
        return []

    # Get event name
    from app.models import Event
    event_query = select(Event).where(Event.id == heat.station.event_id)
    event_result = await db.execute(event_query)
    event = event_result.scalar_one_or_none()

    notifications = []
    for participant in participants:
        # Check if notification already exists
        existing_query = select(Notification).where(
            Notification.heat_id == heat_id,
            Notification.participant_id == participant.id,
        )
        existing_result = await db.execute(existing_query)
        if existing_result.scalar_one_or_none():
            continue

        # 클립 URL 우선, 없으면 YouTube link
        video_url = heat.clip_url or heat.youtube_link or ""
        message = build_notification_message(
            event_name=event.name if event else "줄넘기 대회",
            participant_name=participant.name,
            station_number=heat.station.station_number,
            heat_time=heat.started_at,
            video_url=video_url,
        )

        notification = Notification(
            heat_id=heat_id,
            participant_id=participant.id,
            channel=channel,
            message=message,
        )
        db.add(notification)
        notifications.append(notification)

    await db.commit()
    return notifications


async def send_notification(
    db: AsyncSession,
    notification_id: uuid.UUID,
) -> bool:
    """Send a single notification via SMS"""
    from app.services.sms_service import sms_service
    
    query = (
        select(Notification)
        .options(selectinload(Notification.participant))
        .where(Notification.id == notification_id)
    )
    result = await db.execute(query)
    notification = result.scalar_one_or_none()

    if not notification:
        return False
    
    if not notification.participant or not notification.participant.phone:
        notification.status = NotificationStatus.FAILED
        notification.error_message = "전화번호 없음"
        await db.commit()
        return False

    try:
        # SMS 발송
        result = await sms_service.send_sms(
            recipient=notification.participant.phone,
            message=notification.message,
        )
        
        if result["success"]:
            notification.status = NotificationStatus.SENT
            notification.sent_at = datetime.utcnow()
            notification.error_message = None
        else:
            notification.status = NotificationStatus.FAILED
            notification.error_message = result.get("error", "발송 실패")[:500]
        
        await db.commit()
        return result["success"]

    except Exception as e:
        notification.status = NotificationStatus.FAILED
        notification.error_message = str(e)[:500]
        await db.commit()
        return False


async def get_notifications(
    db: AsyncSession,
    heat_id: Optional[uuid.UUID] = None,
    event_id: Optional[uuid.UUID] = None,
    status: Optional[NotificationStatus] = None,
) -> List[Notification]:
    """Get notifications with filters"""
    query = select(Notification)

    if heat_id:
        query = query.where(Notification.heat_id == heat_id)

    if event_id:
        from app.models import Heat, Station
        query = (
            query
            .join(Heat)
            .join(Station)
            .where(Station.event_id == event_id)
        )

    if status:
        query = query.where(Notification.status == status)

    result = await db.execute(query)
    return result.scalars().all()
