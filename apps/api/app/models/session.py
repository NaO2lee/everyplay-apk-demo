import uuid
from datetime import datetime
from enum import Enum
from typing import Optional, List

from sqlalchemy import String, DateTime, Date, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.types import GUID


class SessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"


class OperationSession(Base):
    __tablename__ = "operation_sessions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("events.id"), nullable=False)
    competition_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[SessionStatus] = mapped_column(SQLEnum(SessionStatus), default=SessionStatus.ACTIVE)

    # Relationships
    event: Mapped["Event"] = relationship("Event")
    heats: Mapped[List["Heat"]] = relationship("Heat", back_populates="session")
