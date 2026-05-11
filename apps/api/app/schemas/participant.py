from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, field_validator
import re


class ParticipantCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=10, max_length=20)
    team: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, max_length=100)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        # Remove hyphens and spaces
        cleaned = re.sub(r"[-\s]", "", v)
        if not cleaned.isdigit() or len(cleaned) < 10:
            raise ValueError("Invalid phone number format")
        return cleaned


class ParticipantUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    team: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, max_length=100)


class ParticipantEntryItem(BaseModel):
    event_code: Optional[str] = None
    event_type_display: Optional[str] = None
    entry_number: Optional[str] = None
    category: Optional[str] = None
    category_display: Optional[str] = None

    class Config:
        from_attributes = True


class ParticipantResponse(BaseModel):
    id: UUID
    name: str
    phone: Optional[str] = None  # Will be masked in the response
    entry_number: Optional[str] = None
    event_code: Optional[str] = None
    event_type_display: Optional[str] = None
    team: Optional[str] = None
    category: Optional[str] = None
    entries: List[ParticipantEntryItem] = []
    created_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_mask(cls, participant):
        from app.core.mappings import DIVISION_DISPLAY, EVENT_TYPE_MAP
        phone = participant.phone or ""
        if len(phone) >= 8:
            # 010-****-1234 형식
            masked_phone = phone[:3] + "-" + "*" * 4 + "-" + phone[-4:]
        elif phone:
            masked_phone = "***"
        else:
            masked_phone = None

        # category 한글 표시
        category_display = DIVISION_DISPLAY.get(participant.category, participant.category) if participant.category else None

        # event_code → 한글 표시명
        event_code = getattr(participant, "event_code", None)
        event_type_info = EVENT_TYPE_MAP.get(event_code) if event_code else None
        event_type_display = event_type_info["name"] if event_type_info else event_code

        # entries (N종목) — 정규화된 출전 내역
        raw_entries = getattr(participant, "entries", None) or []
        entries_list: List[ParticipantEntryItem] = []
        for e in raw_entries:
            ec = e.event_code
            info = EVENT_TYPE_MAP.get(ec) if ec else None
            entries_list.append(ParticipantEntryItem(
                event_code=ec,
                event_type_display=(info["name"] if info else ec),
                entry_number=e.entry_number,
                category=e.category,
                category_display=DIVISION_DISPLAY.get(e.category, e.category) if e.category else None,
            ))

        return cls(
            id=participant.id,
            name=participant.name,
            phone=masked_phone,
            entry_number=getattr(participant, "entry_number", None),
            event_code=event_code,
            event_type_display=event_type_display,
            team=participant.team,
            category=category_display,
            entries=entries_list,
            created_at=participant.created_at,
        )


class ParticipantListResponse(BaseModel):
    items: List[ParticipantResponse]
    total: int


class BulkImportResult(BaseModel):
    imported: int
    failed: int
    errors: List[dict] = []
