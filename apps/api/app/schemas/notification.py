from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel

from app.models.notification import NotificationChannel, NotificationStatus


class NotifyRequest(BaseModel):
    channel: NotificationChannel = NotificationChannel.SMS
    participant_ids: Optional[List[UUID]] = None  # None = all participants of the heat


class NotifyAllRequest(BaseModel):
    channel: NotificationChannel = NotificationChannel.SMS
    filter: Optional[dict] = None  # e.g., {"notification_status": "pending"}


class NotificationResponse(BaseModel):
    id: UUID
    heat_id: UUID
    participant_id: UUID
    channel: NotificationChannel
    status: NotificationStatus
    sent_at: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class NotifyResult(BaseModel):
    queued: int
    notification_ids: List[UUID]


class BulkNotifyResult(BaseModel):
    queued: int
    estimated_time_minutes: int
