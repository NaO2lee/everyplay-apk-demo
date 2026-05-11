"""OBS 제어 라우터.

- 운영 시작/종료 (이벤트 단위로 모든 스테이션 OBS 동시 제어)
- 스테이션별 OBS 연결/해제
- 상태 조회
"""

import asyncio
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


@router.get("/log-stream", response_model=APIResponse[dict])
async def obs_log_stream(since: int = 0, limit: int = 200):
    """서버 이벤트 버퍼에서 since 이후의 이벤트 목록을 반환. 대시보드 실시간 로그용."""
    from app.core.event_bus import get_events_since, latest_seq
    return APIResponse(data={
        "events": get_events_since(since, limit),
        "latest_seq": latest_seq(),
    })


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
        if getattr(c, "is_active", True)
        and c.obs_host and c.obs_port and c.obs_password and c.youtube_stream_url
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
    # 롤백 결과를 스테이션별로 추적 — STOP 명령 자체가 실패하면 운영자에게 수동 정리 안내 필요.
    if failures:
        rolled_back: list[int] = []         # OBS STOP 깨끗이 성공 (정리 OK)
        needs_manual_stop: list[dict] = []  # OBS STOP 자체 실패 (운영자가 OBS 화면에서 직접 STOP 필요)
        for key, info in started.items():
            sn = info["station_number"]
            client = mgr.get(info["station"].id)
            if not client:
                # 클라이언트 없음 — 사실상 OBS 와 통신 불가. 매뉴얼 정리 대상.
                needs_manual_stop.append({
                    "station_number": sn,
                    "stream_stop_ok": False,
                    "record_stop_ok": False,
                    "reason": "OBS 클라이언트 연결 없음",
                })
                continue
            stream_ok_stop = False
            record_ok_stop = False
            stop_error = None
            try:
                stream_ok_stop = await client.stop_streaming()
            except Exception as e:
                stop_error = f"stop_streaming: {type(e).__name__}: {str(e)[:120]}"
            try:
                record_path = await client.stop_recording()
                # stop_recording 은 None 이면 실패, "" 또는 path 면 성공
                record_ok_stop = record_path is not None
            except Exception as e:
                stop_error = (stop_error + " / " if stop_error else "") + f"stop_recording: {type(e).__name__}: {str(e)[:120]}"
            if stream_ok_stop and record_ok_stop:
                rolled_back.append(sn)
            else:
                needs_manual_stop.append({
                    "station_number": sn,
                    "stream_stop_ok": stream_ok_stop,
                    "record_stop_ok": record_ok_stop,
                    "reason": stop_error or "STOP 응답 실패",
                })
        log_event(
            "obs_event_start_rollback",
            event_id=str(event_id),
            rolled_back=rolled_back,
            needs_manual_stop=[m["station_number"] for m in needs_manual_stop],
            failures=[f["station_number"] for f in failures],
        )
        raise HTTPException(
            status_code=500,
            detail={
                "type": "operation_start_failed",
                "message": "운영 시작 실패",
                "failures": [
                    {
                        "station_number": f["station_number"],
                        "recording": f.get("recording", False),
                        "streaming": f.get("streaming", False),
                        "error": f.get("error"),
                    }
                    for f in failures
                ],
                "rolled_back": rolled_back,
                "needs_manual_stop": needs_manual_stop,
            },
        )

    # 3단계: 전원 성공 — 세션 생성 + DB commit
    from datetime import datetime, date as date_type
    comp_date = None
    if body and body.competition_date:
        try:
            comp_date = date_type.fromisoformat(body.competition_date)
        except ValueError:
            pass

    # 방어 로직: 혹시 이전 ACTIVE 세션이 닫히지 않고 남아있으면 먼저 종료 처리.
    # (정상 흐름이라면 운영 종료 시 닫히지만, 비정상 종료/중복 시작 등으로
    # 여러 건이 열려있을 가능성이 있으므로 새 세션 생성 전에 정리한다.)
    existing_active = (await db.execute(
        select(OperationSession).where(
            OperationSession.event_id == event_id,
            OperationSession.status == SessionStatus.ACTIVE,
        )
    )).scalars().all()
    now_utc = datetime.utcnow()
    for prev in existing_active:
        prev.ended_at = now_utc
        prev.status = SessionStatus.COMPLETED

    session = OperationSession(
        event_id=event_id,
        competition_date=comp_date,
        started_at=now_utc,
        status=SessionStatus.ACTIVE,
    )
    db.add(session)
    # SessionBroadcast FK 를 걸기 위해 session.id 가 필요 — flush 로 default UUID 를 생성시킴
    await db.flush()

    results = {}
    from app.models import SessionBroadcast
    for key, info in started.items():
        c = info["station"]
        c.recording_started_at = info["started_at"]
        c.stream_started_at = info["started_at"]
        c.status = StationStatus.STREAMING
        # 세션 단위로 방송 정보 저장 — 스테이션에 남겨두면 이전 세션 값과 꼬임.
        db.add(SessionBroadcast(
            session_id=session.id,
            station_id=c.id,
            broadcast_actual_start_time=None,
            youtube_live_url=None,
        ))
        results[key] = {
            "recording": True,
            "streaming": True,
            "started_at": info["started_at"].isoformat(),
        }

    try:
        await db.commit()
    except Exception as commit_err:
        # DB 저장 실패 — OBS 는 돌고 있으니 원상복구. STOP 도 실패하면 운영자에게 수동 정리 안내.
        try:
            await db.rollback()
        except Exception:
            pass
        rolled_back: list[int] = []
        needs_manual_stop: list[dict] = []
        for key, info in started.items():
            sn = info["station_number"]
            client = mgr.get(info["station"].id)
            if not client:
                needs_manual_stop.append({
                    "station_number": sn,
                    "stream_stop_ok": False,
                    "record_stop_ok": False,
                    "reason": "OBS 클라이언트 연결 없음",
                })
                continue
            stream_ok_stop = False
            record_ok_stop = False
            stop_error = None
            try:
                stream_ok_stop = await client.stop_streaming()
            except Exception as e:
                stop_error = f"stop_streaming: {type(e).__name__}: {str(e)[:120]}"
            try:
                record_path = await client.stop_recording()
                record_ok_stop = record_path is not None
            except Exception as e:
                stop_error = (stop_error + " / " if stop_error else "") + f"stop_recording: {type(e).__name__}: {str(e)[:120]}"
            if stream_ok_stop and record_ok_stop:
                rolled_back.append(sn)
            else:
                needs_manual_stop.append({
                    "station_number": sn,
                    "stream_stop_ok": stream_ok_stop,
                    "record_stop_ok": record_ok_stop,
                    "reason": stop_error or "STOP 응답 실패",
                })
        log_event(
            "obs_event_start_db_commit_failed",
            event_id=str(event_id),
            rolled_back=rolled_back,
            needs_manual_stop=[m["station_number"] for m in needs_manual_stop],
            error=str(commit_err)[:500],
        )
        raise HTTPException(
            status_code=500,
            detail={
                "type": "operation_start_db_commit_failed",
                "message": f"운영 시작 중 DB 저장 실패: {commit_err}",
                "rolled_back": rolled_back,
                "needs_manual_stop": needs_manual_stop,
            },
        )

    log_event(
        "obs_event_start",
        event_id=str(event_id),
        session_id=str(session.id),
        stations=len(stations),
        success=len(results),
    )

    # OAuth 로 실제 라이브 방송 영상 ID 자동 해석 — 실패해도 운영 시작 자체는 성공 처리.
    try:
        from app.services.youtube_service import resolve_live_video_id_by_stream_key, LATENCY_OFFSET_DEFAULTS
        from app.models import YoutubeAccount
        from app.core.event_bus import push_event
        from sqlalchemy import select as _sel
        account_cache: dict = {}
        resolved = 0
        for c in stations:
            if not (c.youtube_account_id and c.youtube_stream_key):
                push_event("info", f"스테이션 {c.station_number} OAuth skip — 계정·스트림키 없음")
                continue
            acc = account_cache.get(c.youtube_account_id)
            if acc is None:
                acc_res = await db.execute(_sel(YoutubeAccount).where(YoutubeAccount.id == c.youtube_account_id))
                acc = acc_res.scalar_one_or_none()
                account_cache[c.youtube_account_id] = acc
            if not acc:
                continue
            try:
                info = await resolve_live_video_id_by_stream_key(
                    acc.client_id or "", acc.client_secret or "", acc.refresh_token or "", c.youtube_stream_key,
                )
            except Exception:
                info = None
            if info and info.get("video_id"):
                sb_res = await db.execute(
                    _sel(SessionBroadcast).where(
                        SessionBroadcast.session_id == session.id,
                        SessionBroadcast.station_id == c.id,
                    )
                )
                sb = sb_res.scalar_one_or_none()
                if sb:
                    from datetime import timedelta as _td
                    valid_cutoff = now_utc - _td(seconds=180)
                    candidates_valid = []
                    total_cand = len(info.get("candidates") or [])
                    for cand in (info.get("candidates") or []):
                        ast_iso = cand.get("actual_start_time")
                        if not ast_iso:
                            continue
                        try:
                            ast_dt = datetime.fromisoformat(ast_iso.replace("Z", "+00:00")).replace(tzinfo=None)
                        except Exception:
                            continue
                        if ast_dt >= valid_cutoff:
                            candidates_valid.append((ast_dt, cand))
                    push_event(
                        "info" if candidates_valid else "warn",
                        f"스테이션 {c.station_number} OAuth 후보 {total_cand}개 중 유효 {len(candidates_valid)}개",
                    )
                    if candidates_valid:
                        candidates_valid.sort(key=lambda x: x[0])
                        chosen_dt, chosen_cand = candidates_valid[0]
                        sb.broadcast_actual_start_time = chosen_dt
                        sb.youtube_live_url = f"https://youtube.com/watch?v={chosen_cand['video_id']}"
                        push_event("success", f"스테이션 {c.station_number} Go Live 감지: {chosen_dt.strftime('%H:%M:%S')} UTC → {chosen_cand['video_id']}")
                    else:
                        push_event("warn", f"스테이션 {c.station_number} Go Live 전 — 첫 히트 시작 시 재시도 예정")
                resolved += 1
            else:
                push_event("warn", f"스테이션 {c.station_number} OAuth 결과 없음 (스트림키 매치 실패)")
        if resolved > 0:
            await db.commit()
        log_event(
            "obs_event_start_yt_resolve",
            event_id=str(event_id),
            resolved=resolved,
            total=len(stations),
        )
    except Exception as yt_err:
        log_event(
            "obs_event_start_yt_resolve_error",
            event_id=str(event_id),
            error=str(yt_err)[:300],
        )

    return APIResponse(data={"results": results, "session_id": str(session.id)})


@router.post("/events/{event_id}/stop", response_model=APIResponse[dict])
async def stop_event_operation(
    event_id: UUID,
    end_youtube: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """이벤트의 모든 스테이션 OBS 녹화+스트리밍을 중지하고,
    실제 파일이 닫힐 때까지 기다린 뒤 세션을 종료한다.

    OBS 는 StopRecord 응답이 돌아온 뒤에도 파일 finalize 가 끝나야 output_active=False 로
    전환되며, 그 이전에 StartRecord 를 다시 보내면 이전 파일에 이어붙는 문제가 있다
    (2026-04-19 식별). 따라서 여기서 스테이션마다 output_active=False 를 확인할 때까지
    폴링 대기한 뒤에야 세션 종료 시간을 DB 에 쓴다.

    end_youtube=True 면 OBS 정지 후 각 스테이션의 youtube_live_url 에서 broadcast id 추출해
    YouTube API 로 'complete' 전이까지 시도. 실패해도 운영 종료 자체는 성공 처리.
    """
    from sqlalchemy import select
    from datetime import datetime

    # 활성 세션 모두 조회 (정상 흐름이라면 하나지만, 중복이 쌓여있을 수 있음)
    active_sessions = (await db.execute(
        select(OperationSession).where(
            OperationSession.event_id == event_id,
            OperationSession.status == SessionStatus.ACTIVE,
        )
    )).scalars().all()

    result = await db.execute(select(Station).where(Station.event_id == event_id))
    all_stations = result.scalars().all()

    mgr = get_obs_manager()
    stopped = {}
    wait_timeouts = []  # 파일 저장 완료 확인 실패한 스테이션 번호

    # 코트별 stop+wait 을 병렬 실행. 한 코트가 hang 되더라도 다른 코트가 막히지 않음.
    async def _stop_one(station):
        client = mgr.get(station.id)
        if not client or not client.state.connected:
            return station, None, False, "not_connected"
        try:
            await client.stop_streaming()
        except Exception:
            pass
        try:
            path = await client.stop_recording()
        except Exception:
            path = None
        confirmed = await client.wait_for_recording_stopped(timeout=30.0, interval=0.5)
        return station, path, confirmed, None

    stop_results = await asyncio.gather(
        *(_stop_one(c) for c in all_stations), return_exceptions=True
    )

    for r in stop_results:
        if isinstance(r, Exception):
            log_event("obs_stop_unhandled_exc", event_id=str(event_id), error=str(r)[:200])
            continue
        station, path, confirmed, reason = r
        if reason == "not_connected":
            station.status = StationStatus.IDLE
            station.recording_started_at = None
            station.stream_started_at = None
            continue
        if not confirmed:
            wait_timeouts.append(station.station_number)
            log_event(
                "obs_stop_wait_timeout",
                event_id=str(event_id),
                station_id=str(station.id),
                station_number=station.station_number,
            )
        if path:
            station.recording_path = path
        station.status = StationStatus.IDLE
        # 재운영 시 오프셋 오염 방지 — 시작 시각 초기화
        station.recording_started_at = None
        station.stream_started_at = None
        stopped[str(station.id)] = {"recording_path": path, "finalize_confirmed": confirmed}

    # 세션 종료는 모든 스테이션 파일 finalize 확인 이후
    now_utc = datetime.utcnow()
    for s in active_sessions:
        s.ended_at = now_utc
        s.status = SessionStatus.COMPLETED

    await db.commit()

    # YouTube 라이브 방송 종료 (옵션) — 실패해도 무시. 코트별 OAuth 호출 병렬화.
    youtube_results: list[dict] = []
    if end_youtube:
        from app.services.youtube_service import end_live_broadcast
        from app.models import YoutubeAccount
        from app.core.event_bus import push_event
        import re as _re

        # 1) 사전 — 모든 yt account 한 번에 fetch (계정 cache).
        account_ids = list({c.youtube_account_id for c in all_stations if c.youtube_account_id})
        account_cache: dict = {}
        if account_ids:
            acc_rows = (await db.execute(
                select(YoutubeAccount).where(YoutubeAccount.id.in_(account_ids))
            )).scalars().all()
            account_cache = {a.id: a for a in acc_rows}

        # 2) 각 스테이션별 entry 사전 작성 + transition 호출 가능한 것만 코루틴으로.
        async def _end_one(c):
            entry = {"station_number": c.station_number, "ok": False, "error": None, "video_id": None}
            url = c.youtube_live_url or ""
            m = _re.search(r"(?:watch\?v=|live/)([A-Za-z0-9_-]{11})", url)
            if not m:
                entry["error"] = "라이브 영상 ID 없음 (해석 안 됨)"
                return entry
            video_id = m.group(1)
            entry["video_id"] = video_id
            if not c.youtube_account_id:
                entry["error"] = "유튜브 계정 미지정"
                return entry
            acc = account_cache.get(c.youtube_account_id)
            if not acc:
                entry["error"] = "유튜브 계정 레코드 없음"
                return entry
            try:
                res = await end_live_broadcast(
                    acc.client_id or "", acc.client_secret or "", acc.refresh_token or "", video_id,
                )
            except Exception as _exc:
                entry["error"] = f"호출 예외: {str(_exc)[:120]}"
                return entry
            entry.update(res)
            return entry

        # 3) 병렬 실행 — 한 계정 hang 이 다른 코트 막지 않음.
        yt_tasks = await asyncio.gather(
            *(_end_one(c) for c in all_stations), return_exceptions=True
        )
        for c, entry in zip(all_stations, yt_tasks):
            if isinstance(entry, Exception):
                entry = {"station_number": c.station_number, "ok": False, "error": str(entry)[:200], "video_id": None}
            youtube_results.append(entry)
            try:
                if entry.get("ok"):
                    push_event("success", f"스테이션 {c.station_number} YouTube 방송 종료 ({entry.get('video_id')})")
                else:
                    push_event("warn", f"스테이션 {c.station_number} YouTube 종료 실패: {entry.get('error', '')}")
            except Exception:
                pass

    log_event(
        "obs_event_stop",
        event_id=str(event_id),
        stopped_stations=len(stopped),
        sessions_closed=len(active_sessions),
        wait_timeouts=wait_timeouts,
        youtube_ended=sum(1 for r in youtube_results if r.get("ok")),
    )
    return APIResponse(data={
        "results": stopped,
        "sessions_closed": len(active_sessions),
        "wait_timeouts": wait_timeouts,
        "youtube_results": youtube_results,
    })


def _render_path_template(template: str, station_number: int, comp_date: str) -> str:
    """`{date}` / `{station}` 치환. 기타 표기는 그대로 둠."""
    return (template or "").replace("{date}", comp_date).replace("{station}", str(station_number))


def _normalize_path(p: Optional[str]) -> str:
    """경로 비교용 정규화. 대소문자·슬래시 방향·끝 슬래시 차이를 흡수."""
    if not p:
        return ""
    s = str(p).strip().replace("\\", "/").rstrip("/")
    return s.lower()


@router.get("/events/{event_id}/verify-record-paths", response_model=APIResponse[list])
async def verify_record_paths(
    event_id: UUID,
    competition_date: Optional[str] = None,  # "YYYY-MM-DD"
    db: AsyncSession = Depends(get_db),
):
    """이벤트의 각 스테이션이 기대 녹화 경로와 일치하는지 OBS 에 직접 물어 검증."""
    from sqlalchemy import select
    from datetime import date as date_type
    from app.models import Event

    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다")
    template = event.recording_path_template or ""
    if not template.strip():
        raise HTTPException(
            status_code=400,
            detail="녹화 경로 규칙이 설정되지 않았습니다. 기본정보 탭에서 먼저 입력하세요.",
        )

    comp_date = competition_date or date_type.today().isoformat()

    stations_result = await db.execute(
        select(Station).where(Station.event_id == event_id).order_by(Station.station_number)
    )
    stations_list = stations_result.scalars().all()

    mgr = get_obs_manager()
    items: list[dict] = []
    for s in stations_list:
        expected = _render_path_template(template, s.station_number, comp_date)
        client = mgr.get(s.id)
        if client is None or not client.state.connected:
            items.append({
                "station_id": str(s.id),
                "station_number": s.station_number,
                "expected": expected,
                "actual": None,
                "match": False,
                "error": "OBS 연결 안 됨",
            })
            continue
        actual = await client.get_record_directory()
        match = _normalize_path(expected) == _normalize_path(actual)
        items.append({
            "station_id": str(s.id),
            "station_number": s.station_number,
            "expected": expected,
            "actual": actual,
            "match": match,
            "error": None if match else ("OBS 경로가 다릅니다" if actual else "OBS 경로 조회 실패"),
        })

    log_event(
        "obs_verify_record_paths",
        event_id=str(event_id),
        competition_date=comp_date,
        total=len(items),
        matched=sum(1 for it in items if it["match"]),
    )
    return APIResponse(data=items)


_YOUTUBE_RTMP_HOSTS = ("rtmp.youtube.com", "rtmps.youtube.com", "a.rtmp.youtube.com", "a.rtmps.youtube.com")


def _is_youtube_rtmp(server: Optional[str]) -> bool:
    if not server:
        return False
    s = server.lower()
    return any(host in s for host in _YOUTUBE_RTMP_HOSTS)


@router.get("/events/{event_id}/verify-stream-keys", response_model=APIResponse[list])
async def verify_stream_keys(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """이벤트의 각 스테이션 OBS 의 스트림 키 / 서버 설정이 어드민 등록값과 일치하는지 검증.

    운영 시작 전 게이트 — 한 스테이션이라도 mismatch 면 운영자에게 모달로 안내.
    """
    from sqlalchemy import select

    stations_result = await db.execute(
        select(Station).where(Station.event_id == event_id).order_by(Station.station_number)
    )
    stations_list = stations_result.scalars().all()
    if not stations_list:
        raise HTTPException(status_code=404, detail="이벤트의 스테이션이 없습니다")

    # 비활성 스테이션은 검증 대상에서 제외 (5/4 처럼 일부 스테이션만 사용하는 일정 지원)
    stations_list = [s for s in stations_list if getattr(s, "is_active", True)]

    mgr = get_obs_manager()
    items: list[dict] = []
    for s in stations_list:
        db_key = (s.youtube_stream_key or "").strip()
        client = mgr.get(s.id)
        if client is None or not client.state.connected:
            items.append({
                "station_id": str(s.id),
                "station_number": s.station_number,
                "ok": False,
                "match": False,
                "obs_key_present": False,
                "db_key_present": bool(db_key),
                "service_type": None,
                "obs_server": None,
                "server_is_youtube": False,
                "error": "OBS 연결 안 됨",
            })
            continue
        settings = await client.get_stream_service_settings()
        if settings is None:
            items.append({
                "station_id": str(s.id),
                "station_number": s.station_number,
                "ok": False,
                "match": False,
                "obs_key_present": False,
                "db_key_present": bool(db_key),
                "service_type": None,
                "obs_server": None,
                "server_is_youtube": False,
                "error": "OBS 스트림 설정 조회 실패",
            })
            continue
        obs_key = (settings.get("key") or "").strip()
        obs_server = settings.get("server")
        service_type = settings.get("service_type")
        match = bool(db_key) and obs_key == db_key
        server_is_yt = _is_youtube_rtmp(obs_server)
        ok = match and server_is_yt and service_type == "rtmp_common"
        if ok:
            err = None
        elif not db_key:
            err = "어드민에 스트림 키 미등록"
        elif not obs_key:
            err = "OBS 에 스트림 키 미입력"
        elif obs_key != db_key:
            err = "OBS 스트림 키가 등록값과 다름"
        elif not server_is_yt:
            err = f"OBS 서버가 YouTube 가 아님 ({obs_server})"
        elif service_type != "rtmp_common":
            err = f"OBS 서비스 타입이 일반 RTMP 가 아님 ({service_type})"
        else:
            err = "알 수 없는 불일치"
        items.append({
            "station_id": str(s.id),
            "station_number": s.station_number,
            "ok": ok,
            "match": match,
            "obs_key_present": bool(obs_key),
            "db_key_present": bool(db_key),
            "service_type": service_type,
            "obs_server": obs_server,
            "server_is_youtube": server_is_yt,
            "error": err,
        })

    log_event(
        "obs_verify_stream_keys",
        event_id=str(event_id),
        total=len(items),
        ok=sum(1 for it in items if it["ok"]),
    )
    return APIResponse(data=items)


@router.post("/stations/{station_id}/refresh-youtube-video-id", response_model=APIResponse[dict])
async def refresh_station_youtube_video_id(
    station_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """단일 스테이션의 YouTube 라이브 방송 영상 ID 를 OAuth 로 해석해 갱신.
    OBS 테스트 버튼이 호출 — 한 스테이션 단위 테스트 흐름에서 OBS 연결 직후 같이 호출됨.
    """
    from sqlalchemy import select
    from app.services.youtube_service import resolve_live_video_id_by_stream_key
    from app.models import YoutubeAccount

    s_result = await db.execute(select(Station).where(Station.id == station_id))
    s = s_result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="스테이션이 없습니다")

    entry = {
        "station_id": str(s.id),
        "station_number": s.station_number,
        "account_id": str(s.youtube_account_id) if s.youtube_account_id else None,
        "matched": False,
        "video_id": None,
        "error": None,
    }
    if not s.youtube_account_id:
        entry["error"] = "유튜브 계정 미지정"
        return APIResponse(data=entry)
    if not s.youtube_stream_key:
        entry["error"] = "스트림 키 미설정"
        return APIResponse(data=entry)
    acc_res = await db.execute(select(YoutubeAccount).where(YoutubeAccount.id == s.youtube_account_id))
    acc = acc_res.scalar_one_or_none()
    if not acc:
        entry["error"] = "유튜브 계정 레코드 없음"
        return APIResponse(data=entry)
    entry["account_email"] = acc.email
    try:
        info = await resolve_live_video_id_by_stream_key(
            acc.client_id or "", acc.client_secret or "", acc.refresh_token or "", s.youtube_stream_key,
        )
    except Exception as e:
        entry["error"] = f"해석 중 예외: {type(e).__name__}: {str(e)[:120]}"
        return APIResponse(data=entry)
    if not info or not info.get("video_id"):
        entry["error"] = "일치하는 라이브 방송 없음 (크리덴셜 또는 스트림 키 확인 필요)"
        return APIResponse(data=entry)

    s.youtube_live_url = f"https://youtube.com/watch?v={info['video_id']}"
    ast_iso = info.get("actual_start_time")
    if ast_iso:
        try:
            s.broadcast_actual_start_time = datetime.fromisoformat(ast_iso.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            pass
    await db.commit()
    entry["matched"] = True
    entry["video_id"] = info["video_id"]
    entry["actual_start_time"] = ast_iso
    log_event(
        "obs_refresh_station_youtube_video_id",
        station_id=str(station_id),
        matched=True,
        video_id=info["video_id"],
    )
    return APIResponse(data=entry)


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
