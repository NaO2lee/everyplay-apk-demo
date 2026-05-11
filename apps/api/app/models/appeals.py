"""이의신청 모델 (v3.3 신규).

코치/선수가 결과에 이의 → 30분 창 안에 신청 → Chief Judge + 운영위원장 검토 → 결정 → 자동 갱신.
모든 변경은 audit_logs에 immutable 기록.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class Appeal(Base):
    __tablename__ = "appeals"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("events.id"), nullable=False)
    heat_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("heats.id"), nullable=True)
    participant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("participants.id"), nullable=False)
    appellant_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    reason_code: Mapped[str] = mapped_column(String(40), nullable=False)  # scoring_error / video_review / wrong_athlete / other
    reason_text: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    video_timestamp: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending / approved / rejected / escalated
    filed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    decided_by: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    decision_text: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)

    __table_args__ = (
        Index("ix_appeals_event_id", "event_id"),
        Index("ix_appeals_status", "status"),
    )
