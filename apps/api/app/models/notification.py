import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import String, DateTime, Text, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.types import GUID


class NotificationChannel(str, Enum):
    SMS = "sms"
    KAKAO = "kakao"


class NotificationStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    heat_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("heats.id"), nullable=False)
    participant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("participants.id"), nullable=False)
    channel: Mapped[NotificationChannel] = mapped_column(SQLEnum(NotificationChannel), default=NotificationChannel.SMS)
    status: Mapped[NotificationStatus] = mapped_column(SQLEnum(NotificationStatus), default=NotificationStatus.PENDING)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    heat: Mapped["Heat"] = relationship("Heat", back_populates="notifications")
    participant: Mapped["Participant"] = relationship("Participant", back_populates="notifications")


# Import here to avoid circular imports
from app.models.heat import Heat
from app.models.participant import Participant
