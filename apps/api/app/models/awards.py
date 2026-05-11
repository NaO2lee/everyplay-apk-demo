"""시상(Award) 모델 (v3.3 신규).

라이프사이클 6단계 마지막 — 결과 확정 → 시상자 호명 → 본인 확인 → 시상 완료.
status: pending → called → confirmed → done
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class Award(Base):
    __tablename__ = "awards"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("events.id"), nullable=False)
    program_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("programs.id"), nullable=True)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 / 2 / 3
    participant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("participants.id"), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending/called/confirmed/done
    called_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    done_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
