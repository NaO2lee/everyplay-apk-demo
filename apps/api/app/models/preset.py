"""OBS 설정 프리셋 모델."""

import uuid
from typing import Optional

from sqlalchemy import String, Integer, Float
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class ObsPreset(Base):
    __tablename__ = "obs_presets"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    obs_host: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    obs_port: Mapped[int] = mapped_column(Integer, default=4455)
    obs_password: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    youtube_stream_url: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    youtube_stream_key: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    youtube_offset_seconds: Mapped[float] = mapped_column(Float, default=0.0)
