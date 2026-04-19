from datetime import date, datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.event import EventStatus, StationStatus


class EventCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    date: date
    end_date: Optional[date] = None
    station_count: int = Field(default=6, ge=1, le=20)
    youtube_channel_id: Optional[str] = None


class EventUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    date: Optional[str] = None  # "YYYY-MM-DD"
    end_date: Optional[str] = None  # "YYYY-MM-DD"
    status: Optional[EventStatus] = None
    youtube_channel_id: Optional[str] = None
    station_count: Optional[int] = Field(None, ge=1, le=20)
    memo: Optional[str] = Field(None, max_length=2000)


def _mask_password(pw: Optional[str]) -> Optional[str]:
    if not pw:
        return None
    if len(pw) <= 3:
        return "*" * len(pw)
    return "*" * (len(pw) - 3) + pw[-3:]


class StationResponse(BaseModel):
    id: UUID
    station_number: int
    status: StationStatus
    obs_host: Optional[str] = None
    obs_port: Optional[int] = None
    obs_password_masked: Optional[str] = None
    obs_configured: bool = False
    youtube_stream_url: Optional[str] = None
    youtube_stream_key_masked: Optional[str] = None
    youtube_offset_seconds: float = 0.0
    recording_path: Optional[str] = None
    recording_started_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_mask(cls, station):
        return cls(
            id=station.id,
            station_number=station.station_number,
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
            youtube_stream_key_masked=_mask_password(station.youtube_stream_key),
            youtube_offset_seconds=float(station.youtube_offset_seconds or 0),
            recording_path=station.recording_path,
            recording_started_at=station.recording_started_at,
        )


class EventResponse(BaseModel):
    id: UUID
    name: str
    date: date
    end_date: Optional[date] = None
    status: EventStatus
    event_code: str
    youtube_channel_id: Optional[str]
    station_count: int
    overlay_config: Optional[dict] = None
    memo: Optional[str] = None
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
