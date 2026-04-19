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


class ParticipantResponse(BaseModel):
    id: UUID
    name: str
    phone: str  # Will be masked in the response
    team: Optional[str]
    category: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_mask(cls, participant):
        from app.core.mappings import DIVISION_DISPLAY
        phone = participant.phone or ""
        if len(phone) >= 8:
            # 010-****-1234 형식
            masked_phone = phone[:3] + "-" + "*" * 4 + "-" + phone[-4:]
        elif phone:
            masked_phone = "***"
        else:
            masked_phone = "-"

        # category 한글 표시
        category_display = DIVISION_DISPLAY.get(participant.category, participant.category) if participant.category else None

        return cls(
            id=participant.id,
            name=participant.name,
            phone=masked_phone,
            team=participant.team,
            category=category_display,
            created_at=participant.created_at,
        )


class ParticipantListResponse(BaseModel):
    items: List[ParticipantResponse]
    total: int


class BulkImportResult(BaseModel):
    imported: int
    failed: int
    errors: List[dict] = []
