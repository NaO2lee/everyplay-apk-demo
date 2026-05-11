import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.types import GUID
from app.models.heat import heat_participants


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("events.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # 5/11 — 휴대폰 번호가 없는 대회(예: Korea Open) 대응으로 nullable
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    team: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    country_code: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)  # ISO 3166: KR, US, JP …
    # 5/11 — IJRU Korea Open 배번 "#571" (DB는 숫자만)
    entry_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # 5/11 — 종목 코드 (SRSS, SRIF, DDPF 등). 일반 CSV는 NULL, Korea Open 엑셀에서 채움
    event_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    event: Mapped["Event"] = relationship("Event", back_populates="participants")
    heats: Mapped[List["Heat"]] = relationship(
        "Heat",
        secondary=heat_participants,
        back_populates="participants"
    )
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="participant")
    # 5/11 — 다종목 출전 매핑 (ParticipantEntry)
    entries: Mapped[List["ParticipantEntry"]] = relationship(
        "ParticipantEntry", back_populates="participant",
        cascade="all, delete-orphan", lazy="selectin",
    )


# Import here to avoid circular imports
from app.models.event import Event
from app.models.heat import Heat
