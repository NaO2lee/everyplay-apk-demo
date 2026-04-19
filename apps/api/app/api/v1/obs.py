"""OBS 제어 라우터.

- 운영 시작/종료 (이벤트 단위로 모든 스테이션 OBS 동시 제어)
- 스테이션별 OBS 연결/해제
- 상태 조회
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel
from typing import Optional

from app.core.audit import log_event
from app.core.database import get_db
from app.models import Station, StationStatus, OperationSession, SessionStatus
from app.obs import get_obs_manager
from app.obs.manager import load_clients_from_db
from app.schemas import APIResponse

router = APIRouter(prefix="/obs", tags=["obs"])


@router.post("/reload", response_model=APIResponse[dict])
async def reload_clients(db: AsyncSession = Depends(get_db)):
    """DB에서 스테이션별 OBS 설정 다시 로드 (설정 변경 후 호출)."""
    count = await load_clients_from_db(db)
    return APIResponse(data={"registered": count})


@router.get("/status", response_model=APIResponse[list])
async def obs_status():
    """모든 등록된 OBS 클라이언트의 현재 상태 스냅샷."""
    mgr = get_obs_manager()
    snapshots = []
    for client in mgr.all_clients():
        snapshots.append({
            "station_id": client.station_id,
            "host": client.host,
            "port": client.port,
            "connected": client.state.connected,
            "recording": client.state.recording_active,
            "streaming": client.state.streaming_active,
            "recording_path": client.state.recording_path,
            "recording_started_at": client.state.recording_started_at.isoformat() if client.state.recording_started_at else None,
            "dropped_frames": client.state.dropped_frames,
            "bitrate_kbps": client.state.bitrate_kbps,
            "last_error": client.state.last_error,
            "last_updated": client.state.last_updated.isoformat() if client.state.last_updated else None,
            "resolution": getattr(client, '_resolution', None),
        })
    return APIResponse(data=snapshots)


@router.post("/stations/{station_id}/connect", response_model=APIResponse[dict])
async def connect_court(station_id: UUID, db: AsyncSession = Depends(get_db)):
    """특정 스테이션의 OBS에 연결."""
    from sqlalchemy import select
    result = await db.execute(select(Station).where(Station.id == station_id))
    station = result.scalar_one_or_none()
    if not station:
        raise HTTPException(status_code=404, detail="스테이션를 찾을 수 없습니다")
    if not station.obs_host:
        raise HTTPException(status_code=400, detail="OBS 접속 정보가 설정되지 않았습니다")

    mgr = get_obs_manager()
    client = mgr.register(station.id, station.obs_host, station.obs_port or 4455, station.obs_password)
    ok = await client.connect()

    # OBS 연결 성공 시 출력 해상도 자동 가져오기
    obs_resolution = None
    if ok:
        vs = await client.get_video_settings()
        if vs:
            obs_resolution = vs
            client._resolution = vs

    log_event(
        "obs_connect",
        station_id=str(station_id),
        station_number=station.station_number,
        host=station.obs_host,
        port=station.obs_port,
        connected=ok,
        error=client.state.last_error,
        resolution=obs_resolution,
    )
    return APIResponse(data={
        "connected": ok,
        "last_error": client.state.last_error,
        "resolution": obs_resolution,
    })


class StartOperationBody(BaseModel):
    competition_date: Optional[str] = None  # "YYYY-MM-DD"


@router.post("/events/{event_id}/start", response_model=APIResponse[dict])
async def start_event_operation(
    event_id: UUID,
    body: Optional[StartOperationBody] = None,
    db: AsyncSession = Depends(get_db),
):
    """이벤트의 OBS 설정이 완전한 스테이션에만 녹화 + 스트리밍 시작 명령.

    네 필드(obs_host, obs_port, obs_password, youtube_stream_url) 모두 채워진
    스테이션만 "운영 대상"으로 간주한다. 하나라도 빠진 스테이션는 스킵.
    대상 스테이션 중 OBS 연결 실패가 하나라도 있으면 400.
    """
    from sqlalchemy import select
    result = await db.execute(select(Station).where(Station.event_id == event_id))
    all_stations = result.scalars().all()
    if not all_stations:
        raise HTTPException(status_code=404, detail="스테이션가 없습니다")

    stations = [
        c for c in all_stations
        if c.obs_host and c.obs_port and c.obs_password and c.youtube_stream_url
    ]
    if not stations:
        raise HTTPException(
            status_code=400,
            detail="설정이 완료된 스테이션가 없습니다. 스테이션 설정 탭에서 Host / 포트 / 비밀번호 / YouTube URL 네 가지를 모두 입력하세요."
        )

    mgr = get_obs_manager()
    unready = []
    for c in stations:
        client = mgr.get(c.id)
        if not client or not client.state.connected:
            unready.append(c.station_number)
    if unready:
        raise HTTPException(
            status_code=400,
            detail=f"OBS가 연결되지 않은 스테이션: {unready}. 먼저 연결하세요."
        )

    # 1단계: 모든 스테이션 녹화/스트리밍 시도 (아직 DB commit 안 함)
    started = {}
    failures = []
    for c in stations:
        client = mgr.get(c.id)
        rec_started_at = await client.start_recording()
        stream_ok = await client.start_streaming()
        if rec_started_at and stream_ok:
            started[str(c.id)] = {
                "station": c,
                "station_number": c.station_number,
                "recording": True,
                "streaming": True,
                "started_at": rec_started_at,
            }
        else:
            failures.append({
                "station_number": c.station_number,
                "recording": bool(rec_started_at),
                "streaming": stream_ok,
                "error": client.state.last_error,
            })

    # 2단계: 하나라도 실패하면 이미 시작된 스테이션를 롤백 (보상 로직)
    if failures:
        rollback_info = []
        for key, info in started.items():
            client = mgr.get(info["station"].id)
            if client:
                try:
                    await client.stop_streaming()
                    await client.stop_recording()
                except Exception:
                    pass
                rollback_info.append(info["station_number"])
        log_event(
            "obs_event_start_rollback",
            event_id=str(event_id),
            rolled_back=rollback_info,
            failures=[f["station_number"] for f in failures],
        )
        raise HTTPException(
            status_code=500,
            detail=f"운영 시작 실패. 실패 스테이션: {[f['station_number'] for f in failures]}. 이미 시작된 스테이션는 롤백됨: {rollback_info}",
        )

    # 3단계: 전원 성공 — 세션 생성 + DB commit
    from datetime import datetime, date as date_type
    comp_date = None
    if body and body.competition_date:
        try:
            comp_date = date_type.fromisoformat(body.competition_date)
        except ValueError:
            pass

    session = OperationSession(
        event_id=event_id,
        competition_date=comp_date,
        started_at=datetime.utcnow(),
        status=SessionStatus.ACTIVE,
    )
    db.add(session)

    results = {}
    for key, info in started.items():
        c = info["station"]
        c.recording_started_at = info["started_at"]
        c.stream_started_at = info["started_at"]
        c.status = StationStatus.STREAMING
        results[key] = {
            "recording": True,
            "streaming": True,
            "started_at": info["started_at"].isoformat(),
        }

    await db.commit()
    log_event(
        "obs_event_start",
        event_id=str(event_id),
        session_id=str(session.id),
        stations=len(stations),
        success=len(results),
    )
    return APIResponse(data={"results": results, "session_id": str(session.id)})


@router.post("/events/{event_id}/stop", response_model=APIResponse[dict])
async def stop_event_operation(event_id: UUID, db: AsyncSession = Depends(get_db)):
    """이벤트의 모든 스테이션 OBS에 녹화 + 스트리밍 중지 명령."""
    from sqlalchemy import select
    from datetime import datetime

    # 활성 세션 종료
    active_session = (await db.execute(
        select(OperationSession).where(
            OperationSession.event_id == event_id,
            OperationSession.status == SessionStatus.ACTIVE,
        )
    )).scalar_one_or_none()
    if active_session:
        active_session.ended_at = datetime.utcnow()
        active_session.status = SessionStatus.COMPLETED

    result = await db.execute(select(Station).where(Station.event_id == event_id))
    all_stations = result.scalars().all()

    mgr = get_obs_manager()
    stopped = {}
    for c in all_stations:
        client = mgr.get(c.id)
        if not client or not client.state.connected:
            # 연결 안 된 스테이션은 DB 상태만 초기화
            c.status = StationStatus.IDLE
            c.recording_started_at = None
            c.stream_started_at = None
            continue
        try:
            await client.stop_streaming()
        except Exception:
            pass
        try:
            path = await client.stop_recording()
        except Exception:
            path = None
        if path:
            c.recording_path = path
        c.status = StationStatus.IDLE
        # 재운영 시 오프셋 오염 방지 — 시작 시각 초기화
        c.recording_started_at = None
        c.stream_started_at = None
        stopped[str(c.id)] = {"recording_path": path}

    await db.commit()
    log_event(
        "obs_event_stop",
        event_id=str(event_id),
        stopped_stations=len(stopped),
    )
    return APIResponse(data={"results": stopped})


@router.get("/events/{event_id}/sessions", response_model=APIResponse[list])
async def list_sessions(event_id: UUID, db: AsyncSession = Depends(get_db)):
    """이벤트의 운영 세션 이력 조회."""
    from sqlalchemy import select, func

    sessions_result = await db.execute(
        select(OperationSession)
        .where(OperationSession.event_id == event_id)
        .order_by(OperationSession.started_at.desc())
    )
    sessions = sessions_result.scalars().all()

    items = []
    for s in sessions:
        # 세션에 속한 히트 수 조회
        from app.models import Heat
        heat_count = (await db.execute(
            select(func.count(Heat.id)).where(Heat.session_id == s.id)
        )).scalar() or 0

        items.append({
            "id": str(s.id),
            "event_id": str(s.event_id),
            "competition_date": str(s.competition_date) if s.competition_date else None,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "status": s.status.value,
            "heat_count": heat_count,
        })
    return APIResponse(data=items)
