"""심판 채점 모델 (v3.3 신규).

각 심판의 채점은 종목별로 다른 형태(JSON Schema 기반 동적 폼)이지만,
DB 저장은 통일된 구조: heat × participant × judge 조합 + JSON payload.

집계는 종목별 엔진(scoring_engines/*.py)이 payload를 해석해서 수행.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import String, DateTime, Integer, JSON, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class ScoreStatus(str, Enum):
    DRAFT = "draft"          # 입력 중, 미제출
    SUBMITTED = "submitted"  # 제출 완료
    VERIFIED = "verified"    # 검증 완료 (교차 확인 등)


class Score(Base):
    """심판 1명이 입력한 1개 채점 결과.

    Unique: (heat_id, participant_id, judge_user_id) — 한 심판은 같은 선수에 1번만 채점.
    Payload 예시:
      Speed (SRSS):  {"count": 87}
      Freestyle (SRIF): {"technical": 4.5, "presentation": 3.8, "difficulty": 4.0}
      DD (DDSS): {"count": 145, "miss_count": 2}
    """
    __tablename__ = "scores"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    heat_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("heats.id"), nullable=False, index=True)
    participant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("participants.id"), nullable=False)
    judge_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False, index=True)

    event_code: Mapped[str] = mapped_column(String(20), nullable=False)  # SRSS, SRIF, DDSS …
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[ScoreStatus] = mapped_column(String(20), nullable=False, default=ScoreStatus.SUBMITTED)

    submitted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("heat_id", "participant_id", "judge_user_id", name="uq_score_heat_participant_judge"),
    )


class ScoreSubmission(Base):
    """심판×히트 매트릭스 — 제출 추적용.

    한 심판이 한 히트에 대해 몇 명 채점해야 하는지(expected_count) 대비
    얼마나 제출했는지(submitted_count) 추적. 관리자 대시보드 🟢/🟡/🔴 위젯의 데이터 소스.
    """
    __tablename__ = "score_submissions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    heat_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("heats.id"), nullable=False)
    judge_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    expected_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    submitted_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending / in_progress / done
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("heat_id", "judge_user_id", name="uq_submission_heat_judge"),
    )
