from datetime import date, datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.event import EventStatus, StationStatus


class EventCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    name_en: Optional[str] = Field(None, max_length=500)
    date: date
    end_date: Optional[date] = None
    station_count: int = Field(default=6, ge=1, le=20)
    youtube_channel_id: Optional[str] = None
    location: Optional[str] = Field(None, max_length=200)
    hero_color: Optional[str] = Field(None, max_length=20)
    poster_url: Optional[str] = Field(None, max_length=500)
    poster_position: Optional[str] = Field(None, max_length=50)
    poster_zoom: int = Field(100, ge=50, le=300)


class EventUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    name_en: Optional[str] = Field(None, max_length=500)
    date: Optional[str] = None  # "YYYY-MM-DD"
    end_date: Optional[str] = None  # "YYYY-MM-DD"
    status: Optional[EventStatus] = None
    youtube_channel_id: Optional[str] = None
    station_count: Optional[int] = Field(None, ge=1, le=20)
    memo: Optional[str] = Field(None, max_length=2000)
    recording_path_template: Optional[str] = Field(None, max_length=500)
    location: Optional[str] = Field(None, max_length=200)
    hero_color: Optional[str] = Field(None, max_length=20)
    poster_url: Optional[str] = Field(None, max_length=500)
    poster_position: Optional[str] = Field(None, max_length=50)
    poster_zoom: Optional[int] = Field(None, ge=50, le=300)
    pinned: Optional[bool] = None


def _mask_password(pw: Optional[str]) -> Optional[str]:
    if not pw:
        return None
    if len(pw) <= 3:
        return "*" * len(pw)
    return "*" * (len(pw) - 3) + pw[-3:]


class StationResponse(BaseModel):
    id: UUID
    station_number: int
    is_active: bool = True
    mirror_of_station_id: Optional[UUID] = None
    status: StationStatus
    obs_host: Optional[str] = None
    obs_port: Optional[int] = None
    obs_password_masked: Optional[str] = None
    obs_configured: bool = False
    youtube_stream_url: Optional[str] = None
    youtube_live_url: Optional[str] = None
    youtube_stream_key_masked: Optional[str] = None
    youtube_offset_seconds: float = 0.0
    youtube_account_id: Optional[UUID] = None
    recording_path: Optional[str] = None
    recording_started_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_mask(cls, station):
        return cls(
            id=station.id,
            station_number=station.station_number,
            is_active=bool(getattr(station, "is_active", True)),
            mirror_of_station_id=getattr(station, "mirror_of_station_id", None),
            status=station.status,
            obs_host=station.obs_host,
            obs_port=station.obs_port,
            obs_password_masked=_mask_password(station.obs_password),
            obs_configured=bool(
                station.obs_host
                and station.obs_port
                and station.obs_password
                and station.youtube_stream_url
            ),
            youtube_stream_url=station.youtube_stream_url,
            youtube_live_url=station.youtube_live_url,
            youtube_stream_key_masked=_mask_password(station.youtube_stream_key),
            youtube_offset_seconds=float(station.youtube_offset_seconds or 0),
            youtube_account_id=station.youtube_account_id,
            recording_path=station.recording_path,
            recording_started_at=station.recording_started_at,
        )


class EventResponse(BaseModel):
    id: UUID
    name: str
    name_en: Optional[str] = None
    date: date
    end_date: Optional[date] = None
    status: EventStatus
    event_code: str
    youtube_channel_id: Optional[str]
    station_count: int
    overlay_config: Optional[dict] = None
    memo: Optional[str] = None
    recording_path_template: Optional[str] = None
    location: Optional[str] = None
    hero_color: Optional[str] = None
    poster_url: Optional[str] = None
    poster_position: Optional[str] = None
    poster_zoom: int = 100
    pinned: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EventDetailResponse(EventResponse):
    stations: List[StationResponse] = []
    stats: Optional[dict] = None


class EventListResponse(BaseModel):
    items: List[EventResponse]
    total: int


class StationStatusUpdate(BaseModel):
    status: StationStatus
