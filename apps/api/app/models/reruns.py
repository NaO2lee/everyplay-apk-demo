"""현장 즉시 재진행(Rerun) 모델 (v3.3 신규).

별도 재경기(tiebreaker)와 구분 — 같은 코트에서 즉시 다시 (Freestyle 음악 오류 등).
운영자 30초 안에 승인 → 다음 selene 진행 전 재시작.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class Rerun(Base):
    __tablename__ = "reruns"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    heat_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("heats.id"), nullable=False)
    participant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("participants.id"), nullable=False)
    reason_code: Mapped[str] = mapped_column(String(40), nullable=False)  # music_failed / system / disturbance / other
    reason_text: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    requested_by_judge_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    approved_by_operator_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    original_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    rerun_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    audit_note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
