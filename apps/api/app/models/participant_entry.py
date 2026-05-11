"""참가자 출전 종목 (1 참가자 ↔ N 종목 매핑).

동일 인물 (이름 + 팀 동일) 이 여러 종목에 출전하는 Korea Open 포맷을 정규화하기 위해
참가자 본인 정보(이름, 팀)는 Participant 에 1행으로 두고, 종목·배번·연령대는 이 테이블에
N 행으로 기록한다.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.types import GUID


class ParticipantEntry(Base):
    __tablename__ = "participant_entries"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    participant_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False
    )
    event_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    entry_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    participant: Mapped["Participant"] = relationship("Participant", back_populates="entries")


# 순환 import 회피
from app.models.participant import Participant  # noqa: E402
