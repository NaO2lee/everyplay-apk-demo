import uuid
from datetime import date, datetime
from enum import Enum
from typing import List, Optional

import sqlalchemy as sa
from sqlalchemy import String, Date, DateTime, Integer, Float, Boolean, Enum as SQLEnum, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.types import GUID


class EventStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"        # 기존 v3.3 유지 (backward compat)
    COMPLETED = "completed"  # 기존 v3.3 유지 (backward compat)
    CANCELLED = "cancelled"  # 기존 v3.3 유지 (backward compat)
    PUBLISHED = "published"  # 5/11 운영 — 준비 완료, LIVE/예정/다시보기는 날짜로 자동


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_en: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # 5/11
    date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[EventStatus] = mapped_column(SQLEnum(EventStatus), default=EventStatus.DRAFT)
    event_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    youtube_channel_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    station_count: Mapped[int] = mapped_column(Integer, default=6)
    overlay_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # 5/11 — 녹화 파일 경로 템플릿 ({date}, {station})
    recording_path_template: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    memo: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    # 5/11 — 관람자 UI 부가 정보
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    hero_color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    poster_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    poster_position: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="center")
    poster_zoom: Mapped[int] = mapped_column(Integer, default=100, nullable=False, server_default="100")
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default=sa.false())
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # 5/11 — 소프트 삭제. NULL=활성, 값 있으면 휴지통.
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

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

    # 5/11 — 다른 스테이션의 탑뷰/보조 카메라 (heat_assignments 매칭 시 mirror의 station_number 사용)
    mirror_of_station_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(), ForeignKey("stations.id", ondelete="SET NULL"), nullable=True
    )

    # OBS WebSocket 접속
    obs_host: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    obs_port: Mapped[int] = mapped_column(Integer, default=4455)
    obs_password: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # 시청자용 유튜브 URL (운영자가 수동 붙여넣는 기본값)
    youtube_stream_url: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # 5/11 — OAuth로 자동 해석한 실제 라이브 방송 URL (관람자 표시 우선)
    youtube_live_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # OBS 스트리밍용 유튜브 스트림 키
    youtube_stream_key: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # 스테이션별 유튜브 VOD 보정 오프셋 (초)
    youtube_offset_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False, server_default="0")
    # 5/11 — 이 스테이션이 사용하는 YouTube OAuth 계정 (자동 영상 ID 해석용)
    youtube_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(), ForeignKey("youtube_accounts.id", ondelete="SET NULL"), nullable=True
    )

    # 상태 (OBS 연결/녹화/스트리밍 상태는 런타임에 업데이트)
    status: Mapped[StationStatus] = mapped_column(SQLEnum(StationStatus), default=StationStatus.IDLE)

    # OBS 녹화 메타데이터 (클립 추출용)
    recording_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    recording_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    stream_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # 5/11 — OAuth 해석한 YouTube Go Live 시각 (히트 타임스탬프 계산 기준)
    broadcast_actual_start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # v3.3 — 코트 동적 메타데이터
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default="1")
    position_x: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    position_y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    event: Mapped["Event"] = relationship("Event", back_populates="stations")
    heats: Mapped[List["Heat"]] = relationship("Heat", back_populates="station", cascade="all, delete-orphan")
