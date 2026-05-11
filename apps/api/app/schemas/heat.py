from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.heat import HeatStatus


class HeatStart(BaseModel):
    heat_number: int = Field(..., ge=1)
    participant_ids: Optional[List[UUID]] = None
    competition_date: Optional[str] = None  # "YYYY-MM-DD"


class HeatResponse(BaseModel):
    id: UUID
    station_id: UUID
    heat_number: int
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    youtube_timestamp: Optional[str] = None
    youtube_link: Optional[str] = None
    clip_path: Optional[str] = None
    clip_url: Optional[str] = None
    clip_status: Optional[str] = None
    clip_error: Optional[str] = None
    # OBS 녹화 시작 기준 오프셋 (초) — 서버 시계 계산
    recording_offset_start: Optional[float] = None
    recording_offset_end: Optional[float] = None
    # OBS 에서 직접 받은 녹화 파일 내부 타임코드 (초)
    obs_timecode_start: Optional[float] = None
    obs_timecode_end: Optional[float] = None
    # OBS 에서 직접 받은 스트리밍 내부 타임코드 (초) — 유튜브 VOD 기준
    obs_stream_timecode_start: Optional[float] = None
    obs_stream_timecode_end: Optional[float] = None
    session_id: Optional[UUID] = None
    status: HeatStatus

    class Config:
        from_attributes = True


class HeatDetailResponse(HeatResponse):
    station_number: int
    participants: List["ParticipantBrief"] = []
    notification_status: Optional[str] = None


class HeatListResponse(BaseModel):
    items: List[HeatDetailResponse]
    total: int
    page: int
    per_page: int


class ParticipantBrief(BaseModel):
    id: UUID
    name: str
    team: Optional[str]
    country_code: Optional[str] = None  # v3.3 — 국기 표시

    class Config:
        from_attributes = True


class ParticipantMapping(BaseModel):
    participant_ids: List[UUID]


# Update forward reference
HeatDetailResponse.model_rebuild()
