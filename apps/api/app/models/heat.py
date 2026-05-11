import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import String, Text, DateTime, Integer, Float, Enum as SQLEnum, ForeignKey, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.types import GUID


class HeatStatus(str, Enum):
    SCHEDULED = "scheduled"  # 5/11 — 사전 대진표 임포트 (아직 시작 안 함)
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# Many-to-many relationship table
heat_participants = Table(
    "heat_participants",
    Base.metadata,
    Column("heat_id", GUID(), ForeignKey("heats.id"), primary_key=True),
    Column("participant_id", GUID(), ForeignKey("participants.id"), primary_key=True),
)


class Heat(Base):
    __tablename__ = "heats"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    station_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("stations.id"), nullable=False)
    heat_number: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    youtube_timestamp: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    youtube_link: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    clip_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    clip_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    clip_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, default=None)  # pending, processing, ready, failed, sent
    # 5/11 — 클립 추출 실패 사유 (워커가 채움)
    clip_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # OBS 녹화 시작 기준 오프셋 (서버 시계 계산, 기존 방식 유지)
    recording_offset_start: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    recording_offset_end: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # OBS 에서 직접 받은 녹화 파일 내부 타임코드 (초 단위, 클립 추출 기준)
    obs_timecode_start: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    obs_timecode_end: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # OBS 에서 직접 받은 스트리밍 내부 타임코드 (초 단위, 유튜브 VOD 타임스탬프 기준)
    obs_stream_timecode_start: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    obs_stream_timecode_end: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # 대회 프로그램 (종목/종별) 연결
    program_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("programs.id", ondelete="SET NULL"), nullable=True)
    # 운영 세션 연결
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("operation_sessions.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[HeatStatus] = mapped_column(SQLEnum(HeatStatus), default=HeatStatus.ACTIVE)

    # Relationships
    station: Mapped["Station"] = relationship("Station", back_populates="heats")
    program: Mapped[Optional["Program"]] = relationship("Program", back_populates="heats")
    participants: Mapped[List["Participant"]] = relationship(
        "Participant",
        secondary=heat_participants,
        back_populates="heats"
    )
    session: Mapped[Optional["OperationSession"]] = relationship("OperationSession", back_populates="heats")
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="heat", cascade="all, delete-orphan")


# Import here to avoid circular imports
from app.models.event import Station
from app.models.program import Program  # noqa: F811
