"""채점 결과 조회 라우터 (v3.3 신규).

엔드포인트:
- GET  /results/heat/{heat_id}            히트 1개 집계 + 순위
- GET  /results/event/{event_id}/heats    이벤트의 모든 히트 결과 (관전 페이지용)
- GET  /results/event/{event_id}/leaderboard 종목별 전체 리더보드 (Phase 6에서 라운드 진행)

인증: 관객 페이지에서 폴링하므로 무인증 공개. 민감 정보(점수 외) 노출 없음.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Heat, Station
from app.schemas import APIResponse
from app.services.result_engine import HeatResult, aggregate_heat

router = APIRouter(prefix="/results", tags=["results"])


@router.get("/heat/{heat_id}", response_model=APIResponse[HeatResult])
async def get_heat_result(heat_id: UUID, db: AsyncSession = Depends(get_db)):
    """히트 1개의 집계 결과 + 선수 순위. 관객·중계·관리자 공통 사용."""
    res = await aggregate_heat(db, heat_id)
    return APIResponse(data=res)


@router.get("/event/{event_id}/heats", response_model=APIResponse[list[HeatResult]])
async def get_event_heat_results(event_id: UUID, db: AsyncSession = Depends(get_db)):
    """이벤트 내 모든 히트의 집계 결과. /watch 페이지에서 코트별 카드로 표시.

    활성 코트(stations.is_active=True)의 히트만 반환.
    """
    # 활성 station id 조회
    sres = await db.execute(
        select(Station.id).where(
            (Station.event_id == event_id) & (Station.is_active.is_(True))
        )
    )
    station_ids = [r[0] for r in sres.all()]
    if not station_ids:
        return APIResponse(data=[])

    # heat 목록
    hres = await db.execute(
        select(Heat).where(Heat.station_id.in_(station_ids)).order_by(Heat.heat_number)
    )
    heats = hres.scalars().all()

    results = []
    for h in heats:
        results.append(await aggregate_heat(db, h.id))
    return APIResponse(data=results)


# ─── 라운드 자동 진행 (단순 추천) ─────────────────────────────

@router.get("/heat/{heat_id}/advance", response_model=APIResponse[dict])
async def suggest_advance(
    heat_id: UUID,
    top: int = 3,
    db: AsyncSession = Depends(get_db),
):
    """이 히트에서 다음 라운드로 올릴 상위 N명 추천.

    동점이 N번째와 N+1번째 사이에 걸리면 ambiguous 표시.
    실제 라운드 편성은 admin 검토 후 별도 액션 (Phase 6).
    """
    if top < 1 or top > 50:
        raise HTTPException(status_code=400, detail="top 1~50")
    res = await aggregate_heat(db, heat_id)
    scored = [r for r in res.rankings if r.judge_count > 0]
    advancing = scored[:top]
    last_score = advancing[-1].score if advancing else None
    boundary_tied = (
        last_score is not None
        and len(scored) > top
        and scored[top].score == last_score
    )
    return APIResponse(data={
        "heat_id": str(heat_id),
        "event_code": res.event_code,
        "top": top,
        "advancing": [
            {"participant_id": str(r.participant_id), "name": r.name, "team": r.team, "country_code": r.country_code, "score": r.score, "rank": idx + 1}
            for idx, r in enumerate(advancing)
        ],
        "boundary_tied": boundary_tied,
        "boundary_score": last_score,
        "tied_groups": [tg.model_dump() for tg in res.tied_groups],
        "_note": "POST /heats/from-advance/{heat_id}로 새 heat 자동 생성 가능.",
    })


# ─── 라운드 자동 편성 (advance → 새 heat 생성) ────────────────

from pydantic import BaseModel as _BM
from app.api.v1.auth import (
    ROLE_ADMIN as _ROLE_ADMIN, ROLE_OPERATOR as _ROLE_OP,
    TokenData as _TD, require_role as _req_role,
)
from app.models import AuditLog, Heat
from app.models.heat import heat_participants


class _CreateNextRound(_BM):
    top: int = 3
    target_court_id: UUID | None = None  # None → 같은 코트
    force_when_tied: bool = False  # boundary 동점 무시 (단순 top-N)


@router.post("/heat/{heat_id}/create-next-round", response_model=APIResponse[dict])
async def create_next_round_heat(
    heat_id: UUID,
    body: _CreateNextRound,
    td: _TD = Depends(_req_role(_ROLE_ADMIN, _ROLE_OP)),
    db: AsyncSession = Depends(get_db),
):
    """advance 추천 → 실제 새 heat 자동 생성 + selene 배정.

    boundary 동점 있으면 force_when_tied=False면 거부 (Tiebreaker 우선).
    """
    # 원본 heat → station → event
    src = (await db.execute(select(Heat).where(Heat.id == heat_id))).scalar_one_or_none()
    if not src:
        raise HTTPException(status_code=404, detail="원본 히트 찾을 수 없음")
    src_station = (await db.execute(select(Station).where(Station.id == src.station_id))).scalar_one_or_none()
    if not src_station:
        raise HTTPException(status_code=404, detail="원본 station 찾을 수 없음")

    # 결과 집계
    res = await aggregate_heat(db, heat_id)
    scored = [r for r in res.rankings if r.judge_count > 0]
    if len(scored) == 0:
        raise HTTPException(status_code=400, detail="채점 결과 없음")
    advancing = scored[:body.top]
    if not advancing:
        raise HTTPException(status_code=400, detail="advance 대상 없음")

    # boundary 동점 체크
    last_score = advancing[-1].score
    boundary_tied = (len(scored) > body.top and scored[body.top].score == last_score)
    if boundary_tied and not body.force_when_tied:
        raise HTTPException(
            status_code=400,
            detail=f"boundary 동점 ({last_score}점) — Tiebreaker 먼저 진행하거나 force_when_tied=true 필요",
        )

    # 대상 코트
    target_court = body.target_court_id or src.station_id
    target_st = (await db.execute(select(Station).where(Station.id == target_court))).scalar_one_or_none()
    if not target_st:
        raise HTTPException(status_code=404, detail="대상 코트 찾을 수 없음")

    # 다음 heat_number
    last_q = await db.execute(
        select(Heat.heat_number).where(Heat.station_id == target_court).order_by(Heat.heat_number.desc()).limit(1)
    )
    last_n = last_q.scalar() or 0

    new_heat = Heat(
        station_id=target_court,
        heat_number=last_n + 1,
        started_at=datetime.utcnow(),
    )
    db.add(new_heat)
    await db.flush()

    # selene 배정
    for r in advancing:
        await db.execute(heat_participants.insert().values(heat_id=new_heat.id, participant_id=r.participant_id))

    db.add(AuditLog(
        actor_id=None, actor_role=td.role,
        action_type="next_round_heat_created", target_type="heat", target_id=new_heat.id,
        after_value={
            "from_heat_id": str(heat_id), "top": body.top, "court_id": str(target_court),
            "advancing_count": len(advancing), "force_when_tied": body.force_when_tied,
        },
        timestamp=datetime.utcnow(),
    ))
    await db.commit()
    await db.refresh(new_heat)

    return APIResponse(data={
        "new_heat_id": str(new_heat.id),
        "heat_number": new_heat.heat_number,
        "court_id": str(target_court),
        "advancing": [
            {"participant_id": str(r.participant_id), "name": r.name, "rank": idx + 1, "score": r.score}
            for idx, r in enumerate(advancing)
        ],
        "boundary_tied": boundary_tied,
    })


# datetime import (위에 있는 results 외부 함수에서 안 쓰지만 새 함수에서 필요)
from datetime import datetime  # noqa: E402, F811

# ─── CSV export ───────────────────────────────────────────────

import csv as _csv
import io as _io
from fastapi.responses import StreamingResponse


@router.get("/event/{event_id}/export.csv")
async def export_event_csv(event_id: UUID, db: AsyncSession = Depends(get_db)):
    """이벤트 전체 결과를 CSV로 다운로드 (관전·관리자 공용 무인증).

    컬럼: heat_id, heat_number, court, event_code, rank, participant_id, name, team, country_code, score, judge_count, tied
    """
    # 활성 station 조회
    sres = await db.execute(
        select(Station.id, Station.station_number, Station.display_name).where(Station.event_id == event_id)
    )
    stations_info = {row[0]: (row[1], row[2]) for row in sres.all()}

    # heat 목록
    hres = await db.execute(
        select(Heat).where(Heat.station_id.in_(list(stations_info.keys()))).order_by(Heat.heat_number)
    )
    heats = hres.scalars().all()

    buf = _io.StringIO()
    buf.write('﻿')  # UTF-8 BOM (Excel 한글 호환)
    writer = _csv.writer(buf)
    writer.writerow([
        "heat_id", "heat_number", "court_number", "court_name",
        "event_code", "rank", "participant_id", "name", "team", "country_code",
        "score", "judge_count", "is_tied_with_above",
    ])

    for h in heats:
        result = await aggregate_heat(db, h.id)
        court_num, court_name = stations_info.get(h.station_id, (0, ""))
        prev_score = None
        for idx, r in enumerate(result.rankings, start=1):
            tied = (prev_score is not None and r.score == prev_score and r.judge_count > 0)
            writer.writerow([
                str(h.id), h.heat_number, court_num, court_name or "",
                result.event_code or "", idx,
                str(r.participant_id), r.name, r.team or "", r.country_code or "",
                r.score, r.judge_count, "Y" if tied else "",
            ])
            prev_score = r.score if r.judge_count > 0 else prev_score

    buf.seek(0)
    filename = f"results_{event_id.hex[:8]}_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
