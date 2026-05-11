"""스폰서/광고 모델.

- Sponsor: 대회 무관하게 공통 마스터 (재사용 가능)
- EventSponsor: 이벤트 ↔ 스폰서 N:N 연결, 슬롯 타입 + 우선순위
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import String, DateTime, Integer, Boolean, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.types import GUID


class SponsorSlotType(str, Enum):
    INLINE = "inline"  # 리스트 중간 가로 배너
    HERO = "hero"      # 전면 카드형


class SponsorKind(str, Enum):
    """광고 / 협회 홍보 / 공식 파트너 — 표시 라벨 분기용."""
    AD = "AD"                 # 우상단 "광고" 뱃지
    PROMOTION = "PROMOTION"   # 뱃지 없음 (협회 홍보 / 일반 콘텐츠)
    PARTNER = "PARTNER"       # "공식 파트너" 뱃지


class Sponsor(Base):
    __tablename__ = "sponsors"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    banner_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # objectPosition CSS 값. 예: "center" / "left center" / "50% 50%"
    banner_position: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="center")
    # CSS scale 비율 (퍼센트). 100 = 원본 contain fit, 150 = 1.5배 확대, 50 = 절반.
    banner_zoom: Mapped[int] = mapped_column(Integer, default=100, nullable=False, server_default="100")
    tagline: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    kind: Mapped[SponsorKind] = mapped_column(
        SQLEnum(SponsorKind, values_callable=lambda x: [e.value for e in x]),
        default=SponsorKind.AD,
        nullable=False,
    )
    cta_text: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cta_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    event_links: Mapped[List["EventSponsor"]] = relationship(
        "EventSponsor", back_populates="sponsor", cascade="all, delete-orphan"
    )


class EventSponsor(Base):
    __tablename__ = "event_sponsors"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    sponsor_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("sponsors.id", ondelete="CASCADE"), nullable=False
    )
    slot_type: Mapped[SponsorSlotType] = mapped_column(
        SQLEnum(SponsorSlotType), default=SponsorSlotType.INLINE, nullable=False
    )
    weight: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sponsor: Mapped["Sponsor"] = relationship("Sponsor", back_populates="event_links")
