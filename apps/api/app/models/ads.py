"""광고 그리드 (전역).

- AdSetting: 단일 행. 그리드 템플릿(예: '3-2-1') 보유.
- AdSlot: 셀 인덱스에 스폰서 매핑. 같은 slot_index 다중 → 자동 슬라이드.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Integer, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.types import GUID


class AdSetting(Base):
    __tablename__ = "ad_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # 그리드 템플릿 문자열. NULL=비활성(스택 표시).
    grid_template: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # 모든 셀의 고정 높이(px). NULL = 기본 80px. row_heights 우선.
    cell_height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # 행별 높이(px) JSON 배열. 예: "[60,80,120]" 행 순서대로. NULL = cell_height 폴백.
    row_heights: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # 슬롯 인덱스별 모드 JSON. {"0":"fixed","5":"slider"}. 미지정=자동(레코드 수로 판단).
    slot_modes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class AdSlot(Base):
    __tablename__ = "ad_slots"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    sponsor_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("sponsors.id", ondelete="CASCADE"), nullable=False
    )
    slot_index: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 슬롯별 오버라이드 — 같은 스폰서가 다른 크기 셀에 들어갈 때 위치/줌을 셀마다 다르게.
    # NULL = 스폰서 마스터 기본값 사용.
    banner_position: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    banner_zoom: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # 'contain' | 'cover'. NULL = 'contain' 기본.
    banner_fit: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # transform: translate(X%, Y%) — 이미지 자체 폭/높이의 % 단위. NULL = 0 (가운데).
    banner_offset_x: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    banner_offset_y: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    weight: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sponsor: Mapped["Sponsor"] = relationship("Sponsor")
