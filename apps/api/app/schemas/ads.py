"""광고 그리드 스키마.

전역 그리드 설정 + 셀별 스폰서 매핑.
"""
import json
import re
from datetime import datetime
from typing import Dict, List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.sponsor import SponsorResponse


# row_heights 항목 타입: int(px) 또는 "W:H" 문자열(가로세로 비율).
# 비율 모드는 디바이스 폭과 무관하게 셀 모양이 동일 → 모든 폰에서 같은 위치만 잘림.
RowHeightItem = Union[int, str]
_RATIO_RE = re.compile(r"^\s*(\d+)\s*:\s*(\d+)\s*$")


def _coerce_row_height_item(v):
    """단일 row_heights 항목을 정규화. int(px, 20~400) 또는 "W:H"(비율) 만 통과."""
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        n = int(v)
        return n if 20 <= n <= 400 else None
    if isinstance(v, str):
        s = v.strip()
        # 숫자만 들어온 경우 px 로 처리
        if s.isdigit():
            n = int(s)
            return n if 20 <= n <= 400 else None
        m = _RATIO_RE.match(s)
        if m:
            w, h = int(m.group(1)), int(m.group(2))
            if 1 <= w <= 100 and 1 <= h <= 100:
                return f"{w}:{h}"
    return None


def _parse_slot_modes(raw):
    """DB 의 JSON 문자열 → dict. dict 면 그대로."""
    if raw is None or raw == "":
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        v = json.loads(raw)
        return v if isinstance(v, dict) else {}
    except Exception:
        return {}


def _parse_row_heights(raw):
    if raw is None or raw == "":
        return []
    items = raw if isinstance(raw, list) else None
    if items is None:
        try:
            v = json.loads(raw)
            if isinstance(v, list):
                items = v
        except Exception:
            return []
    if items is None:
        return []
    out = []
    for x in items:
        c = _coerce_row_height_item(x)
        if c is not None:
            out.append(c)
    return out


class AdSettingResponse(BaseModel):
    grid_template: Optional[str] = None
    cell_height: Optional[int] = None
    row_heights: List[RowHeightItem] = []
    slot_modes: Dict[str, str] = {}
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @field_validator("slot_modes", mode="before")
    @classmethod
    def _coerce_slot_modes(cls, v):
        return _parse_slot_modes(v)

    @field_validator("row_heights", mode="before")
    @classmethod
    def _coerce_row_heights(cls, v):
        return _parse_row_heights(v)


class AdSettingUpdate(BaseModel):
    grid_template: Optional[str] = Field(None, max_length=50)
    cell_height: Optional[int] = Field(None, ge=20, le=400)
    row_heights: Optional[List[RowHeightItem]] = None
    slot_modes: Optional[Dict[str, str]] = None

    @field_validator("row_heights", mode="before")
    @classmethod
    def _coerce_row_heights(cls, v):
        if v is None:
            return None
        return _parse_row_heights(v)


class AdSlotCreate(BaseModel):
    sponsor_id: UUID
    slot_index: int = Field(..., ge=0, le=99)
    banner_position: Optional[str] = Field(None, max_length=50)
    # 어드민 입력 중간값(타이핑 1→10→100) 도 통과시키기 위해 넓은 범위.
    banner_zoom: Optional[int] = Field(None, ge=1, le=1000)
    banner_fit: Optional[str] = Field(None, max_length=20)
    banner_offset_x: Optional[int] = Field(None, ge=-200, le=200)
    banner_offset_y: Optional[int] = Field(None, ge=-200, le=200)
    weight: int = 0
    active: bool = True


class AdSlotUpdate(BaseModel):
    slot_index: Optional[int] = Field(None, ge=0, le=99)
    banner_position: Optional[str] = Field(None, max_length=50)
    banner_zoom: Optional[int] = Field(None, ge=1, le=1000)
    banner_fit: Optional[str] = Field(None, max_length=20)
    banner_offset_x: Optional[int] = Field(None, ge=-200, le=200)
    banner_offset_y: Optional[int] = Field(None, ge=-200, le=200)
    weight: Optional[int] = None
    active: Optional[bool] = None


class AdSlotResponse(BaseModel):
    id: UUID
    sponsor_id: UUID
    slot_index: int
    banner_position: Optional[str] = None
    banner_zoom: Optional[int] = None
    banner_fit: Optional[str] = None
    banner_offset_x: Optional[int] = None
    banner_offset_y: Optional[int] = None
    weight: int
    active: bool
    sponsor: SponsorResponse

    class Config:
        from_attributes = True


class AdSlotListResponse(BaseModel):
    items: List[AdSlotResponse]
    total: int


# 공개 응답 — 시청자 페이지에서 사용
class PublicAdSlotItem(BaseModel):
    id: UUID
    name: str
    logo_url: Optional[str] = None
    banner_image_url: Optional[str] = None
    banner_position: Optional[str] = None
    banner_zoom: int = 100
    banner_fit: str = "contain"
    banner_offset_x: int = 0
    banner_offset_y: int = 0
    tagline: Optional[str] = None
    kind: str = "AD"
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    slot_index: int
    weight: int


class PublicAdGridResponse(BaseModel):
    grid_template: Optional[str] = None
    cell_height: Optional[int] = None
    row_heights: List[RowHeightItem] = []
    slot_modes: Dict[str, str] = {}
    items: List[PublicAdSlotItem] = []

    @field_validator("row_heights", mode="before")
    @classmethod
    def _coerce_row_heights(cls, v):
        return _parse_row_heights(v)
