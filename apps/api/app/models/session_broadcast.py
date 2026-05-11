"""세션별 스테이션 방송 정보 — 운영 세션마다 YouTube Go Live 시각과 라이브 URL 저장."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class SessionBroadcast(Base):
    """OperationSession × Station 조합마다 해당 세션 동안의 YouTube 방송 정보.

    스테이션에 저장하면 세션이 바뀌어도 값이 남아 꼬이므로 세션-스테이션 쌍으로 분리.
    히트 타임스탬프 계산 시 여기에 저장된 broadcast_actual_start_time 을 기준으로 사용.
    """
    __tablename__ = "session_broadcasts"

    session_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("operation_sessions.id", ondelete="CASCADE"), primary_key=True
    )
    station_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("stations.id", ondelete="CASCADE"), primary_key=True
    )
    broadcast_actual_start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    youtube_live_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
