"""심판 채점 입출력 스키마 (v3.3 신규).

종목별 동적 폼은 Pydantic discriminated union으로 표현.
백엔드는 event_code로 적절한 PayloadModel을 선택해 검증.
"""

from datetime import datetime
from typing import Annotated, Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


# ─── 종목별 Payload 모델 ────────────────────────────────────────────

class SpeedPayload(BaseModel):
    """Single Rope Speed 계열 (SRSS / SRSE / DDSS / DDSE).
    심판이 카운트한 횟수만 입력.
    """
    kind: Literal["speed"] = "speed"
    count: int = Field(ge=0, le=10000, description="총 카운트")
    miss_count: int = Field(default=0, ge=0, le=1000, description="실수 횟수 (선택)")


class FreestylePayload(BaseModel):
    """Freestyle 계열 (SRIF / SRPF / DDPF / DDTF).
    여러 채점 항목 — 기술 / 표현 / 난이도 / 페널티.
    """
    kind: Literal["freestyle"] = "freestyle"
    technical: float = Field(ge=0.0, le=10.0)
    presentation: float = Field(ge=0.0, le=10.0)
    difficulty: float = Field(default=0.0, ge=0.0, le=10.0)
    deductions: float = Field(default=0.0, ge=0.0, le=10.0, description="페널티")


class TripleUnderPayload(BaseModel):
    """Triple Under (SRTU). 성공 횟수 + 외발 여부."""
    kind: Literal["triple_under"] = "triple_under"
    count: int = Field(ge=0, le=10000)
    foot: Literal["left", "right", "both"] = "both"


class ShowPayload(BaseModel):
    """Show / Performance 종목."""
    kind: Literal["show"] = "show"
    artistic: float = Field(ge=0.0, le=10.0)
    technical: float = Field(ge=0.0, le=10.0)
    impression: float = Field(default=0.0, ge=0.0, le=10.0)


# Discriminated union — Pydantic이 kind 필드로 자동 분기
ScorePayload = Annotated[
    Union[SpeedPayload, FreestylePayload, TripleUnderPayload, ShowPayload],
    Field(discriminator="kind"),
]


# ─── 종목 코드 → Payload 종류 매핑 ──────────────────────────────────

EVENT_TO_PAYLOAD_KIND: dict[str, str] = {
    # Speed
    "SRSS": "speed", "SRSR": "speed", "SRRE": "speed", "SRSE": "speed",
    "DDSS": "speed", "DDSR": "speed", "DDRE": "speed", "DDSE": "speed", "DDSC": "speed",
    # Freestyle
    "SRIF": "freestyle", "SRPF": "freestyle",
    "DDPF": "freestyle", "DDTF": "freestyle",
    # Triple Under
    "SRTU": "triple_under",
    # Endurance / Other
    "SRDR": "speed",
    "LR-8M": "speed",
}


def expected_payload_kind(event_code: str) -> Optional[str]:
    """종목 코드에서 기대 payload 종류. 알 수 없으면 None."""
    code = (event_code or "").split()[0]
    return EVENT_TO_PAYLOAD_KIND.get(code)


# ─── 입력 / 출력 ────────────────────────────────────────────────────

class ScoreSubmit(BaseModel):
    """POST /judge/scores 입력."""
    heat_id: UUID
    participant_id: UUID
    event_code: str
    payload: ScorePayload


class ScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    heat_id: UUID
    participant_id: UUID
    judge_user_id: UUID
    event_code: str
    payload: dict
    status: str
    submitted_at: datetime
    verified_at: Optional[datetime] = None


class SubmissionStatusItem(BaseModel):
    """관리자 매트릭스 1셀."""
    heat_id: UUID
    judge_user_id: UUID
    expected_count: int
    submitted_count: int
    status: str  # pending / in_progress / done
    indicator: Literal["green", "yellow", "red"]
