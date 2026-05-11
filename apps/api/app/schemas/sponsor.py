from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.sponsor import SponsorSlotType, SponsorKind


class SponsorCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    logo_url: Optional[str] = Field(None, max_length=500)
    banner_image_url: Optional[str] = Field(None, max_length=500)
    banner_position: Optional[str] = Field(None, max_length=50)
    banner_zoom: int = Field(100, ge=50, le=300)
    tagline: Optional[str] = Field(None, max_length=300)
    kind: SponsorKind = SponsorKind.AD
    cta_text: Optional[str] = Field(None, max_length=100)
    cta_url: Optional[str] = Field(None, max_length=500)


class SponsorUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    logo_url: Optional[str] = Field(None, max_length=500)
    banner_image_url: Optional[str] = Field(None, max_length=500)
    banner_position: Optional[str] = Field(None, max_length=50)
    banner_zoom: Optional[int] = Field(None, ge=50, le=300)
    tagline: Optional[str] = Field(None, max_length=300)
    kind: Optional[SponsorKind] = None
    cta_text: Optional[str] = Field(None, max_length=100)
    cta_url: Optional[str] = Field(None, max_length=500)


class SponsorResponse(BaseModel):
    id: UUID
    name: str
    logo_url: Optional[str] = None
    banner_image_url: Optional[str] = None
    banner_position: Optional[str] = None
    banner_zoom: int = 100
    tagline: Optional[str] = None
    kind: SponsorKind = SponsorKind.AD
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EventSponsorCreate(BaseModel):
    sponsor_id: UUID
    slot_type: SponsorSlotType = SponsorSlotType.INLINE
    weight: int = 0
    active: bool = True


class EventSponsorUpdate(BaseModel):
    slot_type: Optional[SponsorSlotType] = None
    weight: Optional[int] = None
    active: Optional[bool] = None


class EventSponsorResponse(BaseModel):
    id: UUID
    event_id: UUID
    sponsor_id: UUID
    slot_type: SponsorSlotType
    weight: int
    active: bool
    sponsor: SponsorResponse

    class Config:
        from_attributes = True


class SponsorListResponse(BaseModel):
    items: List[SponsorResponse]
    total: int


class EventSponsorListResponse(BaseModel):
    items: List[EventSponsorResponse]
    total: int
