import uuid
from datetime import date, datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import String, Date, DateTime, Integer, Float, Enum as SQLEnum, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.types import GUID


class EventStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[EventStatus] = mapped_column(SQLEnum(EventStatus), default=EventStatus.DRAFT)
    event_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    youtube_channel_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    station_count: Mapped[int] = mapped_column(Integer, default=6)
    overlay_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    memo: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    stations: Mapped[List["Station"]] = relationship("Station", back_populates="event", cascade="all, delete-orphan")
    participants: Mapped[List["Participant"]] = relationship("Participant", back_populates="event", cascade="all, delete-orphan")
    programs: Mapped[List["Program"]] = relationship("Program", back_populates="event", cascade="all, delete-orphan")


class StationStatus(str, Enum):
    IDLE = "idle"
    CONNECTING = "connecting"
    STREAMING = "streaming"
    ERROR = "error"


class Station(Base):
    """OBS 기반 스테이션 모델.
    스트리밍 송출/녹화는 OBS가 담당. 여기서는 OBS 접속 정보와 상태만 추적.
    """
    __tablename__ = "stations"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("events.id"), nullable=False)
    station_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # OBS WebSocket 접속
    obs_host: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    obs_port: Mapped[int] = mapped_column(Integer, default=4455)
    obs_password: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # 시청자용 유튜브 URL (관객에게 공유)
    youtube_stream_url: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # OBS 스트리밍용 유튜브 스트림 키
    youtube_stream_key: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # 스테이션별 유튜브 VOD 보정 오프셋 (초). 각 PC-카메라 지연이 다를 수 있어 스테이션 단위로 설정.
    youtube_offset_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False, server_default="0")

    # 상태 (OBS 연결/녹화/스트리밍 상태는 런타임에 업데이트)
    status: Mapped[StationStatus] = mapped_column(SQLEnum(StationStatus), default=StationStatus.IDLE)

    # OBS 녹화 메타데이터 (클립 추출용)
    recording_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    recording_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    stream_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    event: Mapped["Event"] = relationship("Event", back_populates="stations")
    heats: Mapped[List["Heat"]] = relationship("Heat", back_populates="station", cascade="all, delete-orphan")
