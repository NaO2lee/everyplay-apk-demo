"""Overlay 페이지가 구독하는 SSE 스트림.

OBS 브라우저 소스가 /overlay/sse?station=<id>를 구독하면,
히트 시작/종료/업데이트 시점에 백엔드가 이 채널에 broadcast.

Server-Sent Events 사용 (WebSocket보다 단순, 브라우저 소스에서 안정적).
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, Optional, Set
from uuid import UUID


def _utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """저장된 naive UTC datetime 을 +00:00 표기 ISO 문자열로 내려보냄.

    브라우저가 타임존 없는 문자열을 로컬 시간으로 오해석하는 걸 방지.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas import APIResponse

router = APIRouter(prefix="/overlay", tags=["overlay"])


class OverlayBroker:
    """스테이션별 SSE 구독자 관리. 메모리 기반, 단일 프로세스."""

    def __init__(self):
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}

    def subscribe(self, station_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers.setdefault(station_id, set()).add(queue)
        return queue

    def unsubscribe(self, station_id: str, queue: asyncio.Queue) -> None:
        subs = self._subscribers.get(station_id)
        if subs:
            subs.discard(queue)
            if not subs:
                self._subscribers.pop(station_id, None)

    async def publish(self, station_id: str, event: dict) -> None:
        subs = list(self._subscribers.get(station_id, set()))
        for q in subs:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass


_broker = OverlayBroker()


def get_broker() -> OverlayBroker:
    return _broker


@router.get("/sse")
async def overlay_sse(
    station: Optional[UUID] = Query(None, description="스테이션 ID"),
    court: Optional[UUID] = Query(None, description="스테이션 ID (하위호환)"),
):
    """SSE 스트림 — overlay.html이 구독.

    DB 세션은 초기 스냅샷 조회 시점에만 짧게 열고 즉시 닫는다 (커넥션 풀 보호).
    `court` 파라미터도 하위호환으로 지원.
    """
    resolved = station or court
    if not resolved:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="station 파라미터가 필요합니다")
    station_id = str(resolved)

    async def event_generator():
        queue = _broker.subscribe(station_id)
        try:
            # 초기 스냅샷 (짧은 DB 세션만 사용)
            from app.core.database import async_session
            async with async_session() as snap_db:
                snapshot = await _fetch_current_snapshot(snap_db, station_id)
            yield f"event: snapshot\ndata: {json.dumps(snapshot, ensure_ascii=False)}\n\n"

            # 이후 이벤트는 push 대기 (DB 세션 없이)
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    event_type = event.get("type", "update")
                    yield f"event: {event_type}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            _broker.unsubscribe(station_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


async def _fetch_current_snapshot(db: AsyncSession, station_id: str) -> dict:
    """현재 스테이션 상태 스냅샷 (현재 히트, 스테이션 번호 등)."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models import Station, Event, Heat, HeatStatus

    snapshot = {
        "type": "snapshot",
        "station_id": station_id,
        "station_number": None,
        "status": "idle",
        "heat_number": None,
        "participants": [],
        "started_at": None,
        "overlay_config": None,
        "event_type_display": None,
        "division_display": None,
        "next_heat_number": None,
        "next_event_type_display": None,
        "next_division_display": None,
        "next_participants": [],
    }
    result = await db.execute(select(Station).where(Station.id == station_id))
    station = result.scalar_one_or_none()
    if not station:
        return snapshot

    snapshot["station_number"] = station.station_number

    # 이벤트에서 overlay_config 가져오기
    event_result = await db.execute(select(Event).where(Event.id == station.event_id))
    event = event_result.scalar_one_or_none()
    if event and event.overlay_config:
        config = dict(event.overlay_config)
        # OBS 해상도가 있으면 overlay_config 의 resolution 을 자동 오버라이드
        from app.obs import get_obs_manager
        mgr = get_obs_manager()
        client = mgr.get(station.id)
        if client and hasattr(client, '_resolution') and client._resolution:
            config["resolution"] = client._resolution
        snapshot["overlay_config"] = config

    from sqlalchemy.orm import selectinload

    heat_result = await db.execute(
        select(Heat)
        .options(selectinload(Heat.program), selectinload(Heat.participants))
        .where(Heat.station_id == station.id, Heat.status == HeatStatus.ACTIVE)
        .order_by(Heat.started_at.desc())
        .limit(1)
    )
    heat = heat_result.scalar_one_or_none()
    if heat:
        snapshot["status"] = "live"
        snapshot["heat_number"] = heat.heat_number
        snapshot["started_at"] = _utc_iso(heat.started_at)
        snapshot["participants"] = [p.name for p in (heat.participants or [])]

        # Program-based display data
        if heat.program:
            from app.core.mappings import EVENT_TYPE_MAP, display_division
            et_info = EVENT_TYPE_MAP.get(heat.program.event_type)
            snapshot["event_type_display"] = et_info["name"] if et_info else heat.program.event_type
            snapshot["division_display"] = display_division(heat.program.division)
    else:
        # No active heat — find next heat preview (현재 세션 기준)
        from datetime import date as date_today
        from app.core.mappings import EVENT_TYPE_MAP, display_division
        from app.models import Program, OperationSession, SessionStatus

        # 현재 active 세션 찾기
        active_session = (await db.execute(
            select(OperationSession).where(
                OperationSession.event_id == station.event_id,
                OperationSession.status == SessionStatus.ACTIVE,
            )
        )).scalar_one_or_none()

        # Find last completed heat for this station (현재 세션만)
        heat_query = select(Heat).where(
            Heat.station_id == station.id,
            Heat.status == HeatStatus.COMPLETED,
        )
        if active_session:
            heat_query = heat_query.where(Heat.session_id == active_session.id)
        last_heat_result = await db.execute(
            heat_query.order_by(Heat.heat_number.desc()).limit(1)
        )
        last_heat = last_heat_result.scalar_one_or_none()
        next_heat_num = (last_heat.heat_number + 1) if last_heat else 1
        snapshot["next_heat_number"] = next_heat_num

        # Find matching program via heat_assignments
        # 마지막 히트의 프로그램 날짜를 기준으로, 없으면 첫 번째 프로그램 날짜
        target_date = None
        if last_heat and last_heat.program_id:
            last_prog_result = await db.execute(select(Program).where(Program.id == last_heat.program_id))
            last_prog = last_prog_result.scalar_one_or_none()
            if last_prog:
                target_date = last_prog.competition_date
        event_result2 = await db.execute(
            select(Event)
            .options(selectinload(Event.programs))
            .where(Event.id == station.event_id)
        )
        ev = event_result2.scalar_one_or_none()
        if ev and ev.programs:
            if not target_date:
                # 프로그램 날짜 중 가장 빠른 날짜
                prog_dates = sorted(set(p.competition_date for p in ev.programs if p.competition_date))
                target_date = prog_dates[0] if prog_dates else None
            candidates = [p for p in ev.programs if p.competition_date == target_date] if target_date else ev.programs
            for prog in candidates:
                for assignment in (prog.heat_assignments or []):
                    if (
                        assignment.get("heat_number") == next_heat_num
                        and int(assignment.get("station", 0)) == station.station_number
                    ):
                        et_info = EVENT_TYPE_MAP.get(prog.event_type)
                        snapshot["next_event_type_display"] = et_info["name"] if et_info else prog.event_type
                        snapshot["next_division_display"] = display_division(prog.division)
                        # Resolve participant names
                        assignment_pids = assignment.get("participant_ids", [])
                        if assignment_pids:
                            from uuid import UUID as UUID_type
                            resolved_pids = [UUID_type(pid) if isinstance(pid, str) else pid for pid in assignment_pids]
                            from app.models import Participant
                            p_result = await db.execute(
                                select(Participant.name).where(Participant.id.in_(resolved_pids))
                            )
                            snapshot["next_participants"] = [row[0] for row in p_result.fetchall()]
                        if not snapshot["next_participants"]:
                            # Fallback to names stored in assignment
                            snapshot["next_participants"] = assignment.get("participant_names", [])
                        break
                if snapshot["next_event_type_display"]:
                    break

    return snapshot


@router.get("/status", response_model=APIResponse[dict])
async def overlay_status():
    """구독자 수 조회 (디버깅용)."""
    return APIResponse(data={
        "stations": {k: len(v) for k, v in _broker._subscribers.items()},
    })
