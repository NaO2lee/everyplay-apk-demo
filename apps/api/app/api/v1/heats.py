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
        raise HTTPException(status_code=409, detail=f"HIT {heat_data.heat_number} 이 이미 진행 중입니다")

    heat = await heat_service.start_heat(
        db,
        station_id,
        heat_data.heat_number,
        heat_data.participant_ids,
    )
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
    from app.models import Program, heat_participants

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

        for prog in programs:
            for assignment in (prog.heat_assignments or []):
                if (
                    assignment.get("heat_number") == heat_data.heat_number
                    and int(assignment.get("station", 0)) == station.station_number
                ):
                    heat.program_id = prog.id
                    # Auto-populate participants from assignment
                    assignment_pids = assignment.get("participant_ids", [])
                    if assignment_pids and not heat_data.participant_ids:
                        from uuid import UUID as UUID_type
                        for pid in assignment_pids:
                            try:
                                pid_uuid = UUID_type(pid) if isinstance(pid, str) else pid
                                await db.execute(
                                    heat_participants.insert().values(
                                        heat_id=heat.id, participant_id=pid_uuid
                                    )
                                )
                            except Exception:
                                pass
                    break
            if heat.program_id:
                break

    # 기존: 서버 시계 기반 오프셋 (station.recording_started_at 기준)
    if heat.started_at:
        offset = (heat.started_at - station.recording_started_at).total_seconds()
        heat.recording_offset_start = max(0.0, offset)

    # 추가: OBS 녹화·스트리밍 내부 타임코드도 같이 저장 (더 정확한 기준)
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
            # 스트림 타임코드 + 스테이션별 보정치로 유튜브 타임스탬프 재계산 (더 정확)
            offset_sec = float(getattr(station, "youtube_offset_seconds", 0.0) or 0.0)
            heat.youtube_timestamp = _format_youtube_timestamp(int(stream_tc + offset_sec))

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
            division_display = display_division(program.division)

    from app.api.v1.overlay import _utc_iso
    await get_broker().publish(str(station_id), {
        "type": "heat_started",
        "station_id": str(station_id),
        "heat_number": heat.heat_number,
        "participants": participant_names,
        "started_at": _utc_iso(heat.started_at),
        "event_type_display": event_type_display,
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
    auto_notify: bool = Query(False, description="자동 SMS 발송 여부"),
    db: AsyncSession = Depends(get_db),
):
    """히트 종료 — 종료 오프셋 기록 + 클립 추출 큐에 작업 등록."""
    heat = await heat_service.end_heat(db, heat_id)
    if not heat:
        raise HTTPException(status_code=404, detail="히트를 찾을 수 없거나 이미 종료되었습니다")

    # 기존: 서버 시계 기반 종료 오프셋
    station = await event_service.get_court(db, heat.station_id)
    if station and station.recording_started_at and heat.ended_at:
        offset_end = (heat.ended_at - station.recording_started_at).total_seconds()
        heat.recording_offset_end = max(0.0, offset_end)
        heat.clip_status = "pending"
    else:
        heat.clip_status = "failed"

    # 추가: OBS 녹화·스트리밍 내부 타임코드도 같이 저장 (더 정확한 기준)
    from app.obs import get_obs_manager
    mgr = get_obs_manager()
    client = mgr.get(heat.station_id)
    if client and client.state.connected:
        rec_tc = await client.get_record_timecode()
        if rec_tc is not None:
            heat.obs_timecode_end = float(rec_tc)
        stream_tc = await client.get_stream_timecode()
        if stream_tc is not None:
            heat.obs_stream_timecode_end = float(stream_tc)

    await db.commit()
    await db.refresh(heat)

    # overlay SSE broadcast — 히트 종료 + 다음 히트 미리보기
    from app.api.v1.overlay import _utc_iso
    next_heat_num = heat.heat_number + 1
    next_event_type_display = None
    next_division_display = None
    next_participants = []

    if station:
        from sqlalchemy import select as sa_select_next
        from app.models import Program

        # Use ended heat's program competition_date instead of today()
        target_date = None
        if heat.program_id:
            from sqlalchemy.orm import selectinload as sl_next
            prog_of_heat = await db.execute(
                sa_select_next(Program).where(Program.id == heat.program_id)
            )
            ended_prog = prog_of_heat.scalar_one_or_none()
            if ended_prog:
                target_date = ended_prog.competition_date

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
        for prog in candidates:
            for assignment in (prog.heat_assignments or []):
                if (
                    assignment.get("heat_number") == next_heat_num
                    and int(assignment.get("station", 0)) == station.station_number
                ):
                    from app.core.mappings import EVENT_TYPE_MAP, display_division
                    et_info = EVENT_TYPE_MAP.get(prog.event_type)
                    next_event_type_display = et_info["name"] if et_info else prog.event_type
                    next_division_display = display_division(prog.division)
                    assignment_pids = assignment.get("participant_ids", [])
                    if assignment_pids:
                        from uuid import UUID as UUID_type
                        resolved_pids = [UUID_type(pid) if isinstance(pid, str) else pid for pid in assignment_pids]
                        from app.models import Participant
                        p_result_next = await db.execute(
                            sa_select_next(Participant.name).where(Participant.id.in_(resolved_pids))
                        )
                        next_participants = [row[0] for row in p_result_next.fetchall()]
                    break
            if next_event_type_display:
                break

    await get_broker().publish(str(heat.station_id), {
        "type": "heat_ended",
        "station_id": str(heat.station_id),
        "heat_number": heat.heat_number,
        "ended_at": _utc_iso(heat.ended_at),
        "next_heat_number": next_heat_num,
        "next_event_type_display": next_event_type_display,
        "next_division_display": next_division_display,
        "next_participants": next_participants,
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
    """이벤트의 모든 히트 초기화 (삭제). HIT 1부터 다시 시작."""
    from sqlalchemy import select as sa_sel, delete
    from app.models import Station
    from app.models import Heat as HeatModel
    station_ids = (await db.execute(
        sa_sel(Station.id).where(Station.event_id == event_id)
    )).scalars().all()
    if station_ids:
        from app.models.heat import heat_participants
        # 히트-참가자 관계 먼저 삭제
        heat_ids = (await db.execute(
            sa_sel(HeatModel.id).where(HeatModel.station_id.in_(station_ids))
        )).scalars().all()
        if heat_ids:
            await db.execute(delete(heat_participants).where(heat_participants.c.heat_id.in_(heat_ids)))
        count = (await db.execute(
            delete(HeatModel).where(HeatModel.station_id.in_(station_ids))
        )).rowcount
    else:
        count = 0

    # 스테이션 녹화 상태도 초기화
    stations_result = await db.execute(
        sa_sel(Station).where(Station.event_id == event_id)
    )
    for station in stations_result.scalars().all():
        station.recording_started_at = None
        station.stream_started_at = None

    await db.commit()
    return APIResponse(data={"deleted": count})


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
    if body.error_message:
        # error_message 필드가 없으면 무시 — 현재 Heat 모델에 없으므로 로그만
        log_event(
            "clip_complete_error",
            heat_id=str(heat.id),
            error=body.error_message[:500],
        )

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
