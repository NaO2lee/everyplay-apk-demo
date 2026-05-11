"""채점 결과 집계 엔진 (v3.3 신규).

Score(payload) → 종목별 산출 → 순위 정렬.

종목 종류별 집계 룰:
- speed         : 모든 심판의 count 평균 (반올림 1자리). 높을수록 좋음.
- freestyle     : technical + presentation + difficulty - deductions, 심판 평균. 높을수록 좋음.
- triple_under  : 모든 심판 count 평균. 높을수록 좋음.
- show          : artistic + technical + impression, 심판 평균. 높을수록 좋음.

Phase 6에서 IJRU 정식 룰(가중치, 중간값 제거 등)으로 정교화 예정.
"""

from typing import Optional
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Score, Heat, Participant
from app.models.heat import heat_participants
from app.schemas.score import expected_payload_kind


class ParticipantResult(BaseModel):
    participant_id: UUID
    name: str
    team: Optional[str] = None
    country_code: Optional[str] = None
    score: float
    judge_count: int
    detail: dict  # raw aggregation values for transparency


class TiedGroup(BaseModel):
    """동점 그룹 — 같은 점수의 selene 2명 이상."""
    score: float
    participant_ids: list[UUID]
    suggested_action: str  # "video_review" / "extra_trial" / "subscore_priority"


class HeatResult(BaseModel):
    heat_id: UUID
    event_code: Optional[str] = None
    payload_kind: Optional[str] = None
    rankings: list[ParticipantResult]
    tied_groups: list[TiedGroup] = []


# ─── 종목별 집계 함수 ─────────────────────────────────────────

def _agg_speed(payloads: list[dict]) -> tuple[float, dict]:
    counts = [int(p.get("count", 0)) for p in payloads]
    misses = [int(p.get("miss_count", 0)) for p in payloads]
    avg = round(sum(counts) / len(counts), 1) if counts else 0.0
    return avg, {"counts": counts, "miss_counts": misses, "avg_count": avg}


def _agg_freestyle(payloads: list[dict]) -> tuple[float, dict]:
    totals = []
    for p in payloads:
        t = float(p.get("technical", 0))
        pres = float(p.get("presentation", 0))
        d = float(p.get("difficulty", 0))
        ded = float(p.get("deductions", 0))
        totals.append(t + pres + d - ded)
    avg = round(sum(totals) / len(totals), 2) if totals else 0.0
    return avg, {"totals_per_judge": totals, "avg_total": avg}


def _agg_triple_under(payloads: list[dict]) -> tuple[float, dict]:
    counts = [int(p.get("count", 0)) for p in payloads]
    avg = round(sum(counts) / len(counts), 1) if counts else 0.0
    return avg, {"counts": counts, "avg_count": avg}


def _agg_show(payloads: list[dict]) -> tuple[float, dict]:
    totals = []
    for p in payloads:
        a = float(p.get("artistic", 0))
        t = float(p.get("technical", 0))
        i = float(p.get("impression", 0))
        totals.append(a + t + i)
    avg = round(sum(totals) / len(totals), 2) if totals else 0.0
    return avg, {"totals_per_judge": totals, "avg_total": avg}


_AGG_FUNCS = {
    "speed": _agg_speed,
    "freestyle": _agg_freestyle,
    "triple_under": _agg_triple_under,
    "show": _agg_show,
}


def aggregate_payloads(payloads: list[dict], payload_kind: str) -> tuple[float, dict]:
    fn = _AGG_FUNCS.get(payload_kind)
    if not fn:
        return 0.0, {"error": f"unknown payload_kind: {payload_kind}"}
    return fn(payloads)


# ─── 히트 단위 집계 ───────────────────────────────────────────

async def aggregate_heat(db: AsyncSession, heat_id: UUID) -> HeatResult:
    """히트 1개의 모든 selene 채점 결과를 집계 후 순위 산출."""

    # 1. heat에 배정된 selene 목록 (heat_participants 조인)
    pres = await db.execute(
        select(Participant)
        .join(heat_participants, Participant.id == heat_participants.c.participant_id)
        .where(heat_participants.c.heat_id == heat_id)
    )
    participants = pres.scalars().all()

    # 2. heat의 모든 score
    sres = await db.execute(select(Score).where(Score.heat_id == heat_id))
    scores = sres.scalars().all()

    # 3. event_code 추출 (모든 score가 같다고 가정)
    event_code = scores[0].event_code if scores else None
    payload_kind = expected_payload_kind(event_code) if event_code else None

    # 4. participant별 score payload 수집
    by_part: dict[UUID, list[dict]] = {}
    for sc in scores:
        by_part.setdefault(sc.participant_id, []).append(sc.payload)

    # 5. 집계
    results = []
    for p in participants:
        payloads = by_part.get(p.id, [])
        if payloads and payload_kind:
            score, detail = aggregate_payloads(payloads, payload_kind)
        else:
            score, detail = 0.0, {"note": "no scores yet"}
        results.append(ParticipantResult(
            participant_id=p.id,
            name=p.name,
            team=p.team,
            country_code=p.country_code,
            score=score,
            judge_count=len(payloads),
            detail=detail,
        ))

    # 6. 정렬: 모든 종목이 "높을수록 좋음" — 단순 내림차순
    results.sort(key=lambda r: r.score, reverse=True)

    # 7. 동점 자동 감지 — score 같은 selene 2명+ 그룹화 (judge_count > 0인 selene만)
    by_score: dict[float, list[UUID]] = {}
    for r in results:
        if r.judge_count > 0:
            by_score.setdefault(r.score, []).append(r.participant_id)
    tied = []
    for score, ids in by_score.items():
        if len(ids) >= 2:
            action = (
                "video_review_then_extra_trial" if payload_kind == "speed"
                else "subscore_priority" if payload_kind == "freestyle"
                else "extra_trial"
            )
            tied.append(TiedGroup(score=score, participant_ids=ids, suggested_action=action))

    return HeatResult(
        heat_id=heat_id,
        event_code=event_code,
        payload_kind=payload_kind,
        rankings=results,
        tied_groups=tied,
    )
