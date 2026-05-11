"""별도 동점 재경기(Tiebreaker) 모델 (v3.3 신규).

awards 자동 생성 시 1~3위 경계에 동점 발견 → 자동으로 행 생성.
operator가 새 heat 편성하여 결정. tiebreakers와 reruns는 다름:
- tiebreakers: 별도 시간/코트 (동점 결정용)
- reruns: 같은 heat 내 즉시 (음악 오류 등)
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class Tiebreaker(Base):
    __tablename__ = "tiebreakers"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("events.id"), nullable=False)
    original_heat_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("heats.id"), nullable=True)
    program_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("programs.id"), nullable=True)
    tied_participant_ids: Mapped[list] = mapped_column(JSON, nullable=False)  # list of UUID strings
    detection_method: Mapped[str] = mapped_column(String(20), nullable=False, default="auto")
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    court_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("stations.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending/scheduled/completed/cancelled
    result_heat_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("heats.id"), nullable=True)
