"""Heat endpoints — OBS 기반 버전.

start/end는 DB 상태 + 타임스탬프 기록에 집중. 오버레이는 SSE(overlay 라우터)로 브로드캐스트.
워커 WebSocket 호출 제거됨. 클립 추출은 DB 상태 변경 → clip-worker가 폴링으로 처리.
"""

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import HeatStatus
from app.schemas import (
    APIResponse,
    HeatStart,
    HeatResponse,
    HeatDetailResponse,
    HeatListResponse,
    ParticipantBrief,
    ParticipantMapping,
)
from app.api.v1.overlay import get_broker
from app.core.audit import log_event
from app.services import heat_service, event_service

router = APIRouter(tags=["heats"])


@router.post("/stations/{station_id}/heats/start", response_model=APIResponse[HeatResponse])
async def start_heat(
    station_id: UUID,
    heat_data: HeatStart,
    db: AsyncSession = Depends(get_db),
):
    """히트 시작 — OBS 녹화는 이미 운영 시작 시점에 돌고 있음을 전제.
    여기서는 타임스탬프를 기록하고 오프셋을 계산.
    """
    # 운영 시작 여부 사전 확인 (녹화 안 돌고 있으면 클립 추출 불가)
    station = await event_service.get_court(db, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="스테이션를 찾을 수 없습니다")
    if not station.recording_started_at:
        raise HTTPException(
            status_code=400,
            detail="운영이 시작되지 않았습니다. 운영 시작 후 히트를 시작하세요.",
        )

    # 중복 ACTIVE 히트 방지 (같은 스테이션 + 같은 히트 번호)
    from sqlalchemy import select as sa_select_dup
    from app.models import Heat as HeatCheck
    existing = await db.execute(
        sa_select_dup(HeatCheck).where(
            HeatCheck.station_id == station_id,
            HeatCheck.heat_number == heat_data.heat_number,
            HeatCheck.status == HeatStatus.ACTIVE,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"히트 {heat_data.heat_number} 이 이미 진행 중입니다")

    try:
        heat = await heat_service.start_heat(
            db,
            station_id,
            heat_data.heat_number,
            heat_data.participant_ids,
        )
    except heat_service.HeatStartGuardError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not heat:
        raise HTTPException(status_code=404, detail="히트 생성에 실패했습니다")

    # 활성 세션 연결
    from app.models import OperationSession, SessionStatus as SessStatus
    active_session = (await db.execute(
        sa_select_dup(OperationSession).where(
            OperationSession.event_id == station.event_id,
            OperationSession.status == SessStatus.ACTIVE,
        )
    )).scalar_one_or_none()
    if active_session:
        heat.session_id = active_session.id

    # Auto-link to program from bracket (heat_assignments)
    # Resolve competition_date: use provided value, or auto-detect from programs
    from datetime import date as date_type
    from sqlalchemy import select as sa_select_prog
    from app.models import Program, heat_participants, Station as _StationModel

    # 탑뷰/보조 카메라 스테이션은 mirror_of 의 station_number 로 assignment 매칭 (참가자 동일).
    match_station_number = station.station_number
    if getattr(station, "mirror_of_station_id", None):
        mirror_sn = (await db.execute(
            sa_select_prog(_StationModel.station_number).where(_StationModel.id == station.mirror_of_station_id)
        )).scalar_one_or_none()
        if mirror_sn:
            match_station_number = mirror_sn

    comp_date = None
    if heat_data.competition_date:
        comp_date = date_type.fromisoformat(heat_data.competition_date)
    else:
        # Auto-detect: find first available program date for this event
        all_progs = (await db.execute(
            sa_select_prog(Program).where(Program.event_id == station.event_id)
        )).scalars().all()
        prog_dates = sorted(set(p.competition_date for p in all_progs if p.competition_date))
        if prog_dates:
            today = date_type.today()
            comp_date = today if today in prog_dates else prog_dates[0]

    if comp_date:
        programs = (await db.execute(
            sa_select_prog(Program).where(
                Program.event_id == station.event_id,
                Program.competition_date == comp_date,
            )
        )).scalars().all()

        # 같은 (heat_number, station) 의 모든 court assignment 의 participant_ids 를 합쳐서 등록.
        # 멀티-코트 종목 (SRSS/SRSE/SRTU 등) 에서 1개 station 에 여러 court 가 있는 경우,
        # 이전 코드는 break 로 첫 court 의 참가자만 등록 → 나머지 court 의 참가자 누락 (2026-05-02 인시던트).
        from uuid import UUID as UUID_type
        for prog in programs:
            matched_in_prog = False
            for assignment in (prog.heat_assignments or []):
                if (
                    assignment.get("heat_number") == heat_data.heat_number
                    and int(assignment.get("station", 0)) == match_station_number
                ):
                    if not heat.program_id:
                        heat.program_id = prog.id
                    matched_in_prog = True
                    assignment_pids = assignment.get("participant_ids", [])
                    if assignment_pids and not heat_data.participant_ids:
                        for pid in assignment_pids:
                            try:
                                pid_uuid = UUID_type(pid) if isinstance(pid, str) else pid
                                await db.execute(
                                    heat_participants.insert()
                                    .prefix_with("IGNORE")
                                    .values(heat_id=heat.id, participant_id=pid_uuid)
                                )
                            except Exception:
                                pass
            if matched_in_prog:
                break

    # 기존: 서버 시계 기반 오프셋 (station.recording_started_at 기준)
    if heat.started_at:
        offset = (heat.started_at - station.recording_started_at).total_seconds()
        heat.recording_offset_start = max(0.0, offset)

    # 추가: OBS 녹화·스트리밍 내부 타임코드도 같이 저장 (참고용)
    from app.obs import get_obs_manager
    from app.services.heat_service import _format_youtube_timestamp
    mgr = get_obs_manager()
    client = mgr.get(station_id)
    if client and client.state.connected:
        rec_tc = await client.get_record_timecode()
        if rec_tc is not None:
            heat.obs_timecode_start = float(rec_tc)
        stream_tc = await client.get_stream_timecode()
        if stream_tc is not None:
            heat.obs_stream_timecode_start = float(stream_tc)

    # 유튜브 타임스탬프 재계산 — 세션 단위 방송 시각 기준.
    offset_sec = float(getattr(station, "youtube_offset_seconds", 0.0) or 0.0)
    broadcast_start = None
    from app.core.event_bus import push_event as _push_evt
    if heat.session_id:
        from app.models import SessionBroadcast
        sb_res = await db.execute(
            sa_select_dup(SessionBroadcast).where(
                SessionBroadcast.session_id == heat.session_id,
                SessionBroadcast.station_id == station.id,
            )
        )
        sb = sb_res.scalar_one_or_none()
        if sb is None:
            sb = SessionBroadcast(session_id=heat.session_id, station_id=station.id)
            db.add(sb)
        if sb.broadcast_actual_start_time:
            broadcast_start = sb.broadcast_actual_start_time
            _push_evt("info", f"스테이션 {station.station_number} 히트 {heat.heat_number}: 세션 Go Live 시각 기존 저장값 사용 ({broadcast_start.strftime('%H:%M:%S')} UTC)")
        elif station.youtube_account_id and station.youtube_stream_key:
            try:
                from app.services.youtube_service import resolve_live_video_id_by_stream_key
                from app.models import YoutubeAccount
                acc_res = await db.execute(sa_select_dup(YoutubeAccount).where(YoutubeAccount.id == station.youtube_account_id))
                acc = acc_res.scalar_one_or_none()
                if acc:
                    info = await resolve_live_video_id_by_stream_key(
                        acc.client_id or "", acc.client_secret or "", acc.refresh_token or "", station.youtube_stream_key,
                    )
                    if info:
                        from datetime import datetime as _dt, timedelta as _td
                        anchor = station.stream_started_at
                        valid_cutoff = (anchor - _td(seconds=180)) if anchor else None
                        candidates_valid = []
                        total = len(info.get("candidates") or [])
                        for cand in (info.get("candidates") or []):
                            ast_iso = cand.get("actual_start_time")
                            if not ast_iso:
                                continue
                            try:
                                ast_dt = _dt.fromisoformat(ast_iso.replace("Z", "+00:00")).replace(tzinfo=None)
                            except Exception:
                                continue
                            if valid_cutoff is None or ast_dt >= valid_cutoff:
                                candidates_valid.append((ast_dt, cand))
                        _push_evt("info", f"스테이션 {station.station_number} 히트 {heat.heat_number} OAuth: 후보 {total} 중 유효 {len(candidates_valid)}")
                        if candidates_valid:
                            candidates_valid.sort(key=lambda x: x[0])
                            chosen_dt, chosen_cand = candidates_valid[0]
                            sb.broadcast_actual_start_time = chosen_dt
                            broadcast_start = chosen_dt
                            sb.youtube_live_url = f"https://youtube.com/watch?v={chosen_cand['video_id']}"
                            _push_evt("success", f"스테이션 {station.station_number} Go Live 감지 (히트 시점): {chosen_dt.strftime('%H:%M:%S')} UTC")
                        else:
                            _push_evt("warn", f"스테이션 {station.station_number} 히트 {heat.heat_number}: 유효 방송 없음 — OBS 시계 폴백")
                    else:
                        _push_evt("warn", f"스테이션 {station.station_number} 히트 {heat.heat_number} OAuth: 결과 없음")
            except Exception as _exc:
                _push_evt("error", f"스테이션 {station.station_number} 히트 {heat.heat_number} OAuth 실패: {str(_exc)[:100]}")
        else:
            _push_evt("warn", f"스테이션 {station.station_number} 히트 {heat.heat_number}: 유튜브 계정/스트림키 미설정")

    if broadcast_start and heat.started_at:
        delta = (heat.started_at - broadcast_start).total_seconds()
        heat.youtube_timestamp = _format_youtube_timestamp(int(max(0, delta + offset_sec)))
    elif heat.obs_stream_timecode_start is not None:
        heat.youtube_timestamp = _format_youtube_timestamp(int(heat.obs_stream_timecode_start + offset_sec))

    await db.commit()
    await db.refresh(heat)

    # 참가자 이름 조회 후 overlay SSE broadcast (히트에 연결된 참가자 기준)
    participant_names = []
    # 히트를 다시 로드해서 participants 관계 가져오기
    from sqlalchemy.orm import selectinload as sl
    from sqlalchemy import select as sa_select
    from app.models import Heat as HeatModel
    reload = await db.execute(sa_select(HeatModel).options(sl(HeatModel.participants)).where(HeatModel.id == heat.id))
    heat_reloaded = reload.scalar_one_or_none()
    if heat_reloaded and heat_reloaded.participants:
        participant_names = [p.name for p in heat_reloaded.participants]

    # Fetch program display data if heat has a program
    event_type_display = None
    event_code = None
    division_display = None
    if heat.program_id:
        from app.models.program import Program
        from sqlalchemy import select as sa_select2
        prog_result = await db.execute(
            sa_select2(Program).where(Program.id == heat.program_id)
        )
        program = prog_result.scalar_one_or_none()
        if program:
            from app.core.mappings import EVENT_TYPE_MAP, display_division
            et_info = EVENT_TYPE_MAP.get(program.event_type)
            event_type_display = et_info["name"] if et_info else program.event_type
            event_code = program.event_code or program.event_type
            division_display = display_division(program.division)

    from app.api.v1.overlay import _utc_iso, _build_slots_for_heat
    # 종목별 슬롯 빌드 (오버레이가 이 데이터로 박스 렌더). mirror 의 station_number 사용.
    slots = []
    try:
        slots = await _build_slots_for_heat(
            db, match_station_number, station.event_id, heat.heat_number, heat.program_id,
        )
    except Exception:
        slots = []
    await get_broker().publish(str(station_id), {
        "type": "heat_started",
        "station_id": str(station_id),
        "heat_number": heat.heat_number,
        "participants": participant_names,
        "slots": slots,
        "started_at": _utc_iso(heat.started_at),
        # 오버레이 타이머는 서버 경과 시간 + 로컬 틱 누적 방식으로 계산 (PC 절대 시계 비의존)
        "elapsed_seconds": 0.0,
        "event_type_display": event_type_display,
        "event_code": event_code,
        "division_display": division_display,
    })

    log_event(
        "heat_start",
        station_id=str(station_id),
        heat_id=str(heat.id),
        heat_number=heat.heat_number,
        started_at=heat.started_at,
        recording_offset_start=heat.recording_offset_start,
        participants=",".join(participant_names),
    )

    return APIResponse(data=HeatResponse.model_validate(heat))


@router.post("/heats/{heat_id}/end", response_model=APIResponse[HeatResponse])
async def end_heat(
    heat_id: UUID,
    auto_notify: bool = Query(False, description="자동 SMS 발송 여부 — 현재 미구현"),
    db: AsyncSession = Depends(get_db),
):
    """히트 종료 — heat_service.end_heat 가 단일 트랜잭션으로 status/오프셋/OBS
    타임코드/clip_status/youtube_link 까지 모두 처리. 라우트는 broker.publish 와
    audit log 만 담당 (DB 추가 commit 없음).
    """
    heat = await heat_service.end_heat(db, heat_id)
    if not heat:
        raise HTTPException(status_code=404, detail="히트를 찾을 수 없거나 이미 종료되었습니다")
    station = heat.station

    # overlay SSE broadcast — 히트 종료 + 다음 히트 미리보기
    # 점프 인지: heat.heat_number + 1 에 assignment 가 없어도 그 station 의 더 큰
    # heat_number 중 가장 빠른 것을 찾아 preview 로 사용 (5/3 105→200 점프 케이스).
    # 진짜 마지막이면 hide_overlay=True 로 신호.
    from app.api.v1.overlay import _utc_iso
    next_heat_num = heat.heat_number + 1
    next_event_type_display = None
    next_event_code = None
    next_division_display = None
    next_participants = []
    next_slots: list = []
    hide_overlay = False

    if station:
        from sqlalchemy import select as sa_select_next
        from app.models import Program, OperationSession, Station as _StationModel

        # mirror_of 가 있는 station 은 그 station_number 로 assignment 조회 (탑뷰 카메라 지원).
        match_station_number = station.station_number
        if getattr(station, "mirror_of_station_id", None):
            mirror_sn_q = await db.execute(
                sa_select_next(_StationModel.station_number).where(_StationModel.id == station.mirror_of_station_id)
            )
            mirror_sn = mirror_sn_q.scalar_one_or_none()
            if mirror_sn:
                match_station_number = mirror_sn

        # target_date 우선순위:
        #   1) 이 heat 의 program.competition_date (가장 정확)
        #   2) 이 heat 가 속한 active OperationSession.competition_date
        #      (heat 가 program_id 없는 ghost 일 때 — 사용자가 수동 입력으로 점프 테스트 한 경우)
        #   3) 이벤트의 가장 빠른 program.competition_date (마지막 fallback)
        target_date = None
        if heat.program_id:
            from sqlalchemy.orm import selectinload as sl_next
            prog_of_heat = await db.execute(
                sa_select_next(Program).where(Program.id == heat.program_id)
            )
            ended_prog = prog_of_heat.scalar_one_or_none()
            if ended_prog:
                target_date = ended_prog.competition_date

        if target_date is None and heat.session_id:
            sess_res = await db.execute(
                sa_select_next(OperationSession).where(OperationSession.id == heat.session_id)
            )
            sess = sess_res.scalar_one_or_none()
            if sess and sess.competition_date:
                target_date = sess.competition_date

        prog_result_next = await db.execute(
            sa_select_next(Program).where(
                Program.event_id == station.event_id,
            )
        )
        programs_next = prog_result_next.scalars().all()

        # Fallback: if no target_date from ended heat, use first available program date
        if not target_date and programs_next:
            prog_dates = sorted(set(p.competition_date for p in programs_next if p.competition_date))
            target_date = prog_dates[0] if prog_dates else None

        # 날짜가 일치하는 프로그램만 사용 (다른 날짜 데이터 혼입 방지)
        candidates = [p for p in programs_next if p.competition_date == target_date] if target_date else programs_next

        def _collect_assignments_for(programs, target_heat: int) -> tuple[list[dict], "Program | None"]:
            matched: list[dict] = []
            owner_prog = None
            for prog in programs:
                hit_in_prog = False
                for assignment in (prog.heat_assignments or []):
                    if (
                        assignment.get("heat_number") == target_heat
                        and int(assignment.get("station", 0)) == match_station_number
                    ):
                        if owner_prog is None:
                            owner_prog = prog
                        matched.append(assignment)
                        hit_in_prog = True
                if hit_in_prog:
                    break
            return matched, owner_prog

        # 1차: heat_number + 1 에서 찾기
        matched_assignments, next_program = _collect_assignments_for(candidates, next_heat_num)

        # 2차 (점프): +1 에 없으면 이 station 의 더 큰 heat_number 중 최소값 탐색
        if not matched_assignments:
            future_heat_numbers: set[int] = set()
            for prog in candidates:
                for assignment in (prog.heat_assignments or []):
                    try:
                        hn = int(assignment.get("heat_number", 0) or 0)
                    except (TypeError, ValueError):
                        continue
                    if hn > heat.heat_number and int(assignment.get("station", 0)) == match_station_number:
                        future_heat_numbers.add(hn)
            if future_heat_numbers:
                next_heat_num = min(future_heat_numbers)
                matched_assignments, next_program = _collect_assignments_for(candidates, next_heat_num)
            else:
                # 이 스테이션에서 더 이상 진행할 heat 없음 → overlay 숨김 신호
                hide_overlay = True

        next_program_id = next_program.id if next_program else None
        next_participant_ids: list = []
        if next_program is not None:
            from app.core.mappings import EVENT_TYPE_MAP, display_division
            et_info = EVENT_TYPE_MAP.get(next_program.event_type)
            next_event_type_display = et_info["name"] if et_info else next_program.event_type
            next_event_code = next_program.event_code or next_program.event_type
            next_division_display = display_division(next_program.division)
            for assignment in matched_assignments:
                next_participant_ids.extend(assignment.get("participant_ids", []) or [])

        if next_participant_ids:
            from uuid import UUID as UUID_type
            resolved_pids = [UUID_type(pid) if isinstance(pid, str) else pid for pid in next_participant_ids]
            from app.models import Participant
            p_result_next = await db.execute(
                sa_select_next(Participant.name).where(Participant.id.in_(resolved_pids))
            )
            next_participants = [row[0] for row in p_result_next.fetchall()]
        # 다음 히트의 모든 코트 슬롯 (4명짜리 종목이면 4명 다 포함)
        if next_program_id:
            try:
                from app.api.v1.overlay import _build_slots_for_heat
                next_slots = await _build_slots_for_heat(
                    db, match_station_number, station.event_id, next_heat_num, next_program_id,
                )
            except Exception:
                next_slots = []

    await get_broker().publish(str(heat.station_id), {
        "type": "heat_ended",
        "station_id": str(heat.station_id),
        "heat_number": heat.heat_number,
        "ended_at": _utc_iso(heat.ended_at),
        "next_heat_number": None if hide_overlay else next_heat_num,
        "next_event_type_display": next_event_type_display,
        "next_event_code": next_event_code,
        "next_division_display": next_division_display,
        "next_participants": next_participants,
        "next_slots": next_slots,
        "hide_overlay": hide_overlay,
    })

    log_event(
        "heat_end",
        station_id=str(heat.station_id),
        heat_id=str(heat.id),
        heat_number=heat.heat_number,
        ended_at=heat.ended_at,
        recording_offset_end=heat.recording_offset_end,
        clip_status=heat.clip_status,
    )

    return APIResponse(data=HeatResponse.model_validate(heat))


@router.get("/heats/{heat_id}", response_model=APIResponse[HeatDetailResponse])
async def get_heat(
    heat_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    heat = await heat_service.get_heat(db, heat_id)
    if not heat:
        raise HTTPException(status_code=404, detail="히트를 찾을 수 없습니다")

    response = HeatDetailResponse(
        **HeatResponse.model_validate(heat).model_dump(),
        station_number=heat.station.station_number,
        participants=[ParticipantBrief.model_validate(p) for p in heat.participants],
    )
    return APIResponse(data=response)


@router.post("/heats/{heat_id}/extract", response_model=APIResponse[HeatResponse])
async def extract_clip(
    heat_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """단일 히트 클립 추출 요청. clip_status 를 pending 으로 돌려 워커가 집어가게 함."""
    from sqlalchemy import select
    from app.models import Heat
    result = await db.execute(select(Heat).where(Heat.id == heat_id))
    heat = result.scalar_one_or_none()
    if not heat:
        raise HTTPException(status_code=404, detail="히트를 찾을 수 없습니다")

    has_server_offsets = heat.recording_offset_start is not None and heat.recording_offset_end is not None
    has_obs_timecodes = heat.obs_timecode_start is not None and heat.obs_timecode_end is not None
    if not (has_server_offsets or has_obs_timecodes):
        raise HTTPException(
            status_code=400,
            detail="이 히트에 녹화 오프셋이 없어 자를 수 없습니다 (녹화 없이 종료됨).",
        )

    heat.clip_status = "pending"
    heat.clip_path = None
    heat.clip_url = None
    await db.commit()
    await db.refresh(heat)

    log_event(
        "heat_extract_requested",
        heat_id=str(heat.id),
        heat_number=heat.heat_number,
        station_id=str(heat.station_id),
    )
    return APIResponse(data=HeatResponse.model_validate(heat))


@router.delete("/events/{event_id}/heats/reset", response_model=APIResponse[dict])
async def reset_heats(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """현재 활성 세션의 히트만 초기화 (삭제). HIT 1부터 다시 시작.

    이전 세션 히트는 보존한다 (운영 이력 추적 목적).
    활성 세션이 없으면 400 — 운영 중이 아닐 때 초기화 대상이 모호하므로 막는다.
    스테이션 녹화 상태(recording_started_at/stream_started_at)는 건드리지 않는다
    (예전에 이걸 NULL 로 밀면서 "운영이 안 시작된 상태"처럼 보이는 이슈가 있었음)."""
    from sqlalchemy import select as sa_sel, delete
    from app.models import Heat as HeatModel
    from app.models import OperationSession, SessionStatus

    active_session = (await db.execute(
        sa_sel(OperationSession).where(
            OperationSession.event_id == event_id,
            OperationSession.status == SessionStatus.ACTIVE,
        ).order_by(OperationSession.started_at.desc())
    )).scalars().first()
    if not active_session:
        raise HTTPException(
            status_code=400,
            detail="활성 세션이 없습니다. 운영 중에만 히트 초기화가 가능합니다.",
        )

    from app.models.heat import heat_participants
    heat_ids = (await db.execute(
        sa_sel(HeatModel.id).where(HeatModel.session_id == active_session.id)
    )).scalars().all()
    if heat_ids:
        # 히트-참가자 관계 먼저 삭제
        await db.execute(delete(heat_participants).where(heat_participants.c.heat_id.in_(heat_ids)))
        count = (await db.execute(
            delete(HeatModel).where(HeatModel.id.in_(heat_ids))
        )).rowcount
    else:
        count = 0

    await db.commit()
    return APIResponse(data={"deleted": count, "session_id": str(active_session.id)})


class NextHeatNumberResponse(BaseModel):
    """다음 시작할 heat_number 자동 결정 결과."""
    next_heat_number: int
    program_id: Optional[UUID] = None
    event_code: Optional[str] = None
    has_remaining: bool
    used_count: int
    total_count: int


@router.get(
    "/events/{event_id}/heats/next-heat-number",
    response_model=APIResponse[NextHeatNumberResponse],
)
async def get_next_heat_number(
    event_id: UUID,
    date: Optional[str] = Query(None, description="경기일 YYYY-MM-DD. 없으면 첫 program 의 competition_date."),
    db: AsyncSession = Depends(get_db),
):
    """Program.heat_assignments 순서를 기준으로 다음에 시작할 heat_number 결정.

    - 활성 세션 + competition_date 기준
    - 이미 시작/종료된 heat_number 는 건너뜀 (heats 테이블 session_id 매칭)
    - 스케줄에 남은 heat 가 없으면 has_remaining=false + 마지막+1 (또는 1) fallback
    """
    from sqlalchemy import select as sa_sel
    import datetime as _dt
    from app.models import Program, Heat as HeatModel, OperationSession, SessionStatus, Event

    ev = (await db.execute(sa_sel(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다")

    target_date: Optional[_dt.date] = None
    if date:
        try:
            target_date = _dt.date.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="date 는 YYYY-MM-DD 형식이어야 합니다")

    progs_q = sa_sel(Program).where(Program.event_id == event_id).order_by(Program.order)
    programs = (await db.execute(progs_q)).scalars().all()

    if target_date is None:
        prog_dates = sorted({p.competition_date for p in programs if p.competition_date})
        target_date = prog_dates[0] if prog_dates else None

    candidates = [p for p in programs if (target_date is None or p.competition_date == target_date)]

    # heat_number 를 모두 모은 뒤 **숫자 오름차순** 으로 정렬해서 순회한다.
    # Program.order 순서로 그대로 쓰면 program A (order 2, 1~61) 다음 program B (order 55,
    # heat 200~) 가 와서 ordered 의 62 이후 자리에 200 이 와버림 → 'next > 61' 검색 시
    # 200 이 잡혀서 잘못 점프 (5/3 인시던트 — heat 61 끝났는데 200 으로 튐).
    heat_to_program: dict[int, Program] = {}
    seen: set[int] = set()
    for prog in candidates:
        for assignment in (prog.heat_assignments or []):
            try:
                hn = int(assignment.get("heat_number", 0) or 0)
            except (TypeError, ValueError):
                continue
            if hn <= 0 or hn in seen:
                continue
            seen.add(hn)
            heat_to_program[hn] = prog
    ordered: list[int] = sorted(seen)

    active_session = (await db.execute(
        sa_sel(OperationSession).where(
            OperationSession.event_id == event_id,
            OperationSession.status == SessionStatus.ACTIVE,
        ).order_by(OperationSession.started_at.desc())
    )).scalars().first()

    used: set[int] = set()
    if active_session:
        rows = (await db.execute(
            sa_sel(HeatModel.heat_number).where(HeatModel.session_id == active_session.id)
        )).all()
        used = {r[0] for r in rows}

    # 다음 후보: 가장 큰 used heat_number 보다 큰 미사용 heat_number 중 ordered 에서 가장 빠른 것.
    # 이 알고리즘은:
    #   - 새 세션 (used={}) → ordered 의 첫번째 (보통 1)
    #   - 정상 진행 (used={1..105}) → 105 보다 큰 첫 미사용 (200) — 점프 자동 처리
    #   - 테스트 점프 (사용자가 105 부터 시작, used={105}) → 200
    # 단, 점프 결과 없을 때 fallback 으로 "가장 작은 미사용" 사용 — 누락 채우기.
    largest_used = max(used) if used else 0
    next_hn: Optional[int] = None
    next_prog: Optional[Program] = None
    for hn in ordered:
        if hn > largest_used and hn not in used:
            next_hn = hn
            next_prog = heat_to_program.get(hn)
            break
    # 위에서 못 찾으면 (모든 미사용이 largest_used 이하 — 누락 보정 모드)
    if next_hn is None:
        for hn in ordered:
            if hn not in used:
                next_hn = hn
                next_prog = heat_to_program.get(hn)
                break

    used_in_schedule = len(used & set(ordered))
    total_count = len(ordered)

    if next_hn is None:
        fallback = (max(ordered) + 1) if ordered else 1
        return APIResponse(data=NextHeatNumberResponse(
            next_heat_number=fallback,
            program_id=None,
            event_code=None,
            has_remaining=False,
            used_count=used_in_schedule,
            total_count=total_count,
        ))

    return APIResponse(data=NextHeatNumberResponse(
        next_heat_number=next_hn,
        program_id=next_prog.id if next_prog else None,
        event_code=(next_prog.event_code or next_prog.event_type) if next_prog else None,
        has_remaining=True,
        used_count=used_in_schedule,
        total_count=total_count,
    ))


@router.get("/events/{event_id}/heats", response_model=APIResponse[HeatListResponse])
async def list_heats(
    event_id: UUID,
    station_id: Optional[UUID] = None,
    status: Optional[HeatStatus] = None,
    session_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    skip = (page - 1) * per_page
    heats, total = await heat_service.get_heats_by_event(
        db, event_id, station_id, status, skip, per_page, session_id=session_id
    )

    items = []
    for heat in heats:
        item = HeatDetailResponse(
            **HeatResponse.model_validate(heat).model_dump(),
            station_number=heat.station.station_number,
            participants=[ParticipantBrief.model_validate(p) for p in heat.participants],
        )
        items.append(item)

    return APIResponse(
        data=HeatListResponse(items=items, total=total, page=page, per_page=per_page)
    )


# ── 워커용 엔드포인트 (clip-worker.exe 가 호출) ──────────────

class ClipCompleteRequest(BaseModel):
    clip_path: Optional[str] = None
    clip_status: str  # "ready" or "failed"
    error_message: Optional[str] = None


class WorkerHeatInfo(BaseModel):
    """워커가 필요한 최소 히트 정보."""
    id: UUID
    station_id: UUID
    station_number: int
    heat_number: int
    recording_path: Optional[str] = None
    obs_timecode_start: Optional[float] = None
    obs_timecode_end: Optional[float] = None
    recording_offset_start: Optional[float] = None
    recording_offset_end: Optional[float] = None
    participant_names: List[str] = []

    class Config:
        from_attributes = True


@router.get("/worker/heats/pending", response_model=APIResponse[list])
async def get_pending_heats(
    station_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """워커가 처리할 pending 히트 목록 조회. 녹화 경로 + 오프셋 포함."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models import Heat, Station

    q = (
        select(Heat)
        .options(selectinload(Heat.station), selectinload(Heat.participants))
        .where(Heat.clip_status == "pending")
        .order_by(Heat.started_at)
        .limit(10)
    )
    if station_id:
        q = q.where(Heat.station_id == station_id)

    result = await db.execute(q)
    heats = result.scalars().all()

    items = []
    for h in heats:
        items.append(WorkerHeatInfo(
            id=h.id,
            station_id=h.station_id,
            station_number=h.station.station_number if h.station else 0,
            heat_number=h.heat_number,
            recording_path=h.station.recording_path if h.station else None,
            obs_timecode_start=h.obs_timecode_start,
            obs_timecode_end=h.obs_timecode_end,
            recording_offset_start=h.recording_offset_start,
            recording_offset_end=h.recording_offset_end,
            participant_names=[p.name for p in (h.participants or [])],
        ))
    return APIResponse(data=items)


@router.post("/worker/heats/{heat_id}/claim", response_model=APIResponse[dict])
async def claim_heat(
    heat_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """워커가 히트를 선점 (pending → processing). 이미 processing 이면 409."""
    from sqlalchemy import select
    from app.models import Heat

    result = await db.execute(select(Heat).where(Heat.id == heat_id))
    heat = result.scalar_one_or_none()
    if not heat:
        raise HTTPException(status_code=404, detail="히트를 찾을 수 없습니다")
    if heat.clip_status != "pending":
        raise HTTPException(status_code=409, detail=f"이미 {heat.clip_status} 상태입니다")

    heat.clip_status = "processing"
    await db.commit()
    return APIResponse(data={"claimed": True})


@router.post("/worker/heats/{heat_id}/clip-complete", response_model=APIResponse[dict])
async def complete_clip(
    heat_id: UUID,
    body: ClipCompleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """워커가 클립 추출 결과 보고. clip_path + status(ready/failed)."""
    from sqlalchemy import select
    from app.models import Heat

    result = await db.execute(select(Heat).where(Heat.id == heat_id))
    heat = result.scalar_one_or_none()
    if not heat:
        raise HTTPException(status_code=404, detail="히트를 찾을 수 없습니다")

    heat.clip_status = body.clip_status
    if body.clip_path:
        heat.clip_path = body.clip_path
    if body.clip_status == "ready":
        # 성공이면 이전 실패 기록 정리
        heat.clip_error = None
    elif body.error_message:
        heat.clip_error = body.error_message[:2000]
        log_event(
            "clip_complete_error",
            heat_id=str(heat.id),
            error=body.error_message[:500],
        )
    elif body.clip_status == "failed":
        heat.clip_error = heat.clip_error or "사유 미상 (워커에서 메시지 전달 안 됨)"

    await db.commit()
    log_event(
        "clip_complete",
        heat_id=str(heat.id),
        heat_number=heat.heat_number,
        clip_status=body.clip_status,
        clip_path=body.clip_path,
    )
    return APIResponse(data={"updated": True, "clip_status": body.clip_status})


@router.post("/heats/{heat_id}/upload-youtube", response_model=APIResponse[dict])
async def upload_heat_to_youtube(
    heat_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """히트 클립을 YouTube 에 비공개 업로드."""
    from app.services.youtube_service import (
        upload_clip_to_youtube,
        YouTubeAuthError,
        YouTubeQuotaExceededError,
    )

    # 이벤트명 가져오기
    heat = await heat_service.get_heat(db, heat_id)
    if not heat:
        raise HTTPException(status_code=404, detail="히트를 찾을 수 없습니다")

    event_name = ""
    if heat.station:
        station = await event_service.get_court(db, heat.station_id)
        if station and station.event:
            event_name = station.event.name

    try:
        result = await upload_clip_to_youtube(db, heat_id, event_name=event_name)
        return APIResponse(data=result)
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except YouTubeAuthError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except YouTubeQuotaExceededError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"업로드 실패: {str(e)[:500]}")


@router.put("/heats/{heat_id}/participants", response_model=APIResponse[HeatDetailResponse])
async def update_heat_participants(
    heat_id: UUID,
    mapping: ParticipantMapping,
    db: AsyncSession = Depends(get_db),
):
    heat = await heat_service.update_heat_participants(
        db, heat_id, mapping.participant_ids
    )
    if not heat:
        raise HTTPException(status_code=404, detail="히트를 찾을 수 없습니다")

    response = HeatDetailResponse(
        **HeatResponse.model_validate(heat).model_dump(),
        station_number=heat.station.station_number,
        participants=[ParticipantBrief.model_validate(p) for p in heat.participants],
    )
    return APIResponse(data=response)
