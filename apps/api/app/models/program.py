"""대회 프로그램 (진행표) 모델.

대회 종목·종별·라운드 정보를 담는 테이블.
히트가 program_id 로 참조하여 "이 히트가 어떤 종목인지" 를 태깅.
"""

import uuid
import datetime as _dt
from typing import Optional, List

from sqlalchemy import String, Integer, ForeignKey, JSON, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.types import GUID


class Program(Base):
    __tablename__ = "programs"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("events.id"), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    division: Mapped[str] = mapped_column(String(50), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    event_code: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    round: Mapped[str] = mapped_column(String(20), nullable=False, default="본선")
    heat_duration_sec: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    participants_per_heat: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    note: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    competition_date: Mapped[Optional[_dt.date]] = mapped_column(Date, nullable=True)
    # 히트 배정표 JSON: [{heat_number: 1, participant_ids: ["uuid", ...]}, ...]
    heat_assignments: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    event: Mapped["Event"] = relationship("Event", back_populates="programs")
    heats: Mapped[List["Heat"]] = relationship("Heat", back_populates="program")


# Forward ref imports
from app.models.event import Event  # noqa: E402, F811
