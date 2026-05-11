"""공개 API 엔드포인트 — 인증 불필요.

관람자 페이지에서 사용하는 읽기 전용 이벤트/스테이션 정보 제공.
OBS 접속 정보(host, port, password)는 노출하지 않는다.
"""

from typing import Optional, List
from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import EventStatus
from app.models.event import StationStatus
from app.schemas import APIResponse
from app.services import event_service

router = APIRouter(prefix="/public", tags=["public"])


# ── 공개용 스키마 (민감 정보 제외) ──────────────────────────


class PublicStationResponse(BaseModel):
    id: UUID
    station_number: int
    status: StationStatus
    youtube_stream_url: Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, station):
        return cls(
            id=station.id,
            station_number=station.station_number,
            status=station.status,
            youtube_stream_url=station.youtube_stream_url,
        )


class PublicEventResponse(BaseModel):
    id: UUID
    name: str
    name_en: Optional[str] = None
    date: date
    end_date: Optional[date] = None
    status: EventStatus
    event_code: str
    station_count: int
    overlay_config: Optional[dict] = None
    location: Optional[str] = None
    hero_color: Optional[str] = None
    poster_url: Optional[str] = None
    poster_position: Optional[str] = None
    poster_zoom: int = 100
    pinned: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class PublicEventDetailResponse(PublicEventResponse):
    stations: List[PublicStationResponse] = []


class PublicEventListResponse(BaseModel):
    items: List[PublicEventResponse]
    total: int


# ── 엔드포인트 ──────────────────────────────────────────


@router.get("/events", response_model=APIResponse[PublicEventListResponse])
async def list_public_events(
    db: AsyncSession = Depends(get_db),
):
    """공개 이벤트 목록 (PUBLISHED 만, 휴지통 제외, 핀 우선)"""
    from sqlalchemy import select, func
    from app.models import Event

    query = (
        select(Event)
        .where(Event.status == EventStatus.PUBLISHED)
        .where(Event.deleted_at.is_(None))
        .order_by(Event.pinned.desc(), Event.date.desc())
        .limit(50)
    )
    count_query = (
        select(func.count(Event.id))
        .where(Event.status == EventStatus.PUBLISHED)
        .where(Event.deleted_at.is_(None))
    )

    result = await db.execute(query)
    events = result.scalars().all()
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    return APIResponse(
        data=PublicEventListResponse(
            items=[PublicEventResponse.model_validate(e) for e in events],
            total=total,
        )
    )


@router.get("/events/{event_code}", response_model=APIResponse[PublicEventDetailResponse])
async def get_public_event(
    event_code: str,
    db: AsyncSession = Depends(get_db),
):
    """공개 이벤트 상세 (스테이션 포함, OBS 정보 제외)"""
    event = await event_service.get_event_by_code(db, event_code)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # draft / 휴지통 이벤트는 공개하지 않음
    if event.status == EventStatus.DRAFT or event.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Event not found")

    stations = [PublicStationResponse.from_orm(c) for c in event.stations]
    response = PublicEventDetailResponse(
        **PublicEventResponse.model_validate(event).model_dump(),
        stations=stations,
    )
    return APIResponse(data=response)


class PublicClipResult(BaseModel):
    heat_id: UUID
    heat_number: int
    station_number: int
    event_type_display: Optional[str] = None
    division_display: Optional[str] = None
    participants: List[str]
    status: Optional[str] = None  # COMPLETED / ACTIVE / PENDING
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    youtube_link: Optional[str] = None  # heat.started_at 와 offset 기준 즉석 계산
    youtube_timestamp: Optional[str] = None
    station_live_url: Optional[str] = None  # 히트 안 시작했을 때 폴백


class PublicClipSearchResponse(BaseModel):
    query: str
    total: int
    items: List[PublicClipResult]


@router.get("/events/{event_code}/clips/search", response_model=APIResponse[PublicClipSearchResponse])
async def search_event_clips(
    event_code: str,
    q: str = "",
    type: str = "name",  # name | entry | heat
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """관람객 뷰용 — 검색 타입별로 해당 히트 목록 검색.

    type:
      - name (기본): 선수 이름 부분 일치 (대소문자 무시)
      - entry: 엔트리 번호 정확 일치 (Participant.entry_number 또는 ParticipantEntry.entry_number)
      - heat: heat_number 정확 일치
    COMPLETED + ACTIVE 히트 반환.
    """
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models import Heat, HeatStatus, Participant, Station
    from app.models.heat import heat_participants
    from app.core.mappings import EVENT_TYPE_MAP, display_division
    from app.services.heat_service import (
        _extract_youtube_video_id,
        _format_youtube_timestamp,
    )

    q_trimmed = (q or "").strip()
    search_type = (type or "name").lower()
    if search_type not in ("name", "entry", "heat"):
        search_type = "name"

    event = await event_service.get_event_by_code(db, event_code)
    if not event or event.status == EventStatus.DRAFT:
        raise HTTPException(status_code=404, detail="Event not found")

    # 빈 쿼리: 전체 COMPLETED/ACTIVE 히트 반환 (catch-all 용도)
    # q 있을 때 type 별 매칭:
    #   name: Participant.name 부분 일치
    #   entry: entry_number 정확 일치만 (Participant.entry_number OR ParticipantEntry.entry_number)
    #   heat: heat_number 정확 일치 (참가자 무관)
    participant_ids: list = []
    heat_number_filter: Optional[int] = None
    if q_trimmed:
        if search_type == "heat":
            try:
                heat_number_filter = int(q_trimmed)
            except ValueError:
                return APIResponse(data=PublicClipSearchResponse(query=q_trimmed, total=0, items=[]))
        elif search_type == "entry":
            from app.models import ParticipantEntry
            # 정확 일치만 + (participant_id, event_code) 페어 매칭.
            # 같은 선수가 여러 종목에 참가할 때 종목별 다른 entry_number 가지므로,
            # heat 의 program.event_code 와 일치하는 heat 만 반환해야 함 (2026-05-02 인시던트).
            e_result = await db.execute(
                select(ParticipantEntry.participant_id, ParticipantEntry.event_code)
                .join(Participant, Participant.id == ParticipantEntry.participant_id)
                .where(Participant.event_id == event.id)
                .where(ParticipantEntry.entry_number == q_trimmed)
            )
            entry_pairs = list(e_result.all())  # [(pid, event_code), ...]
            if not entry_pairs:
                return APIResponse(data=PublicClipSearchResponse(query=q_trimmed, total=0, items=[]))
            participant_ids = list({p[0] for p in entry_pairs})
            entry_event_codes = list({p[1] for p in entry_pairs})
        else:  # name
            like = f"%{q_trimmed}%"
            p_result = await db.execute(
                select(Participant.id)
                .where(Participant.event_id == event.id)
                .where(Participant.name.ilike(like))
            )
            participant_ids = [row[0] for row in p_result.all()]
            if not participant_ids:
                return APIResponse(data=PublicClipSearchResponse(query=q_trimmed, total=0, items=[]))

    # entry 검색 시 event_code 필터를 위한 heat → program 조인용
    entry_event_codes_filter = locals().get("entry_event_codes")

    heats_stmt = (
        select(Heat)
        .join(Station, Heat.station_id == Station.id)
        .options(
            selectinload(Heat.station),
            selectinload(Heat.participants),
            selectinload(Heat.program),
        )
        .where(Station.event_id == event.id)
        .where(Heat.status.in_([HeatStatus.COMPLETED, HeatStatus.ACTIVE]))
        .order_by(Heat.started_at.desc())
        .limit(limit)
    )
    # heat 번호 정확 일치 필터
    if heat_number_filter is not None:
        heats_stmt = heats_stmt.where(Heat.heat_number == heat_number_filter)
    # entry 검색 시 program.event_code 가 매칭되는 heat 만
    if entry_event_codes_filter:
        from app.models import Program
        heats_stmt = heats_stmt.join(Program, Heat.program_id == Program.id).where(Program.event_code.in_(entry_event_codes_filter))
    # q 비었으면 이벤트 전체 히트, q 있으면 이름/엔트리 매치된 참가자 속한 히트만.
    if participant_ids:
        heats_stmt = (
            heats_stmt
            .join(heat_participants, Heat.id == heat_participants.c.heat_id)
            .where(heat_participants.c.participant_id.in_(participant_ids))
        )
    heats_result = await db.execute(heats_stmt)
    heats = list({h.id: h for h in heats_result.scalars().all()}.values())

    items: List[PublicClipResult] = []
    for h in heats:
        et_info = None
        division_disp = None
        if h.program:
            et_info = EVENT_TYPE_MAP.get(h.program.event_type)
            division_disp = display_division(h.program.division)

        station = h.station
        station_url = None
        youtube_link = None
        youtube_ts = None
        if station:
            # 수동 입력한 공유 URL 우선, OAuth 해석한 live_url 은 폴백 (폴백용 station_live_url 필드로 전달).
            station_url = station.youtube_stream_url or station.youtube_live_url

        # 1순위: 히트 종료 시 DB 에 저장된 완성본 URL — 세션별 정확한 video_id + timestamp 박제됨.
        #        운영 중간에 station.youtube_stream_url 이 다른 영상으로 바뀌어도 과거 히트 링크는 불변.
        if h.youtube_link:
            youtube_link = h.youtube_link
            youtube_ts = h.youtube_timestamp
        elif station:
            vid = _extract_youtube_video_id(station_url) if station_url else None
            # 계산 기준: 현재 히트 세션의 Go Live 시각 (session_broadcasts) 우선, 없으면 stream_started_at 폴백
            timestamp_base = None
            if h.session_id:
                from app.models import SessionBroadcast
                sb_res = await db.execute(
                    select(SessionBroadcast).where(
                        SessionBroadcast.session_id == h.session_id,
                        SessionBroadcast.station_id == station.id,
                    )
                )
                sb = sb_res.scalar_one_or_none()
                if sb and sb.broadcast_actual_start_time:
                    timestamp_base = sb.broadcast_actual_start_time
            if not timestamp_base:
                timestamp_base = station.stream_started_at
            if vid and h.started_at and timestamp_base:
                # 2순위: 종료 전 히트(ACTIVE) — Go Live 시각 또는 OBS 시작 기준 실시간 계산
                delta = int((h.started_at - timestamp_base).total_seconds())
                offset = int(station.youtube_offset_seconds or 0)
                total = max(0, delta + offset)
                youtube_ts = _format_youtube_timestamp(total)
                youtube_link = f"https://youtube.com/watch?v={vid}&t={youtube_ts}"
            elif vid and h.youtube_timestamp:
                # 3순위: timestamp 만 저장돼있고 link 조립 전인 비정상 상태 — 현재 URL 로 복구
                youtube_ts = h.youtube_timestamp
                youtube_link = f"https://youtube.com/watch?v={vid}&t={youtube_ts}"

        items.append(PublicClipResult(
            heat_id=h.id,
            heat_number=h.heat_number,
            station_number=station.station_number if station else 0,
            event_type_display=(et_info["name"] if et_info else (h.program.event_type if h.program else None)),
            division_display=division_disp,
            participants=[p.name for p in (h.participants or [])],
            status=h.status.value if h.status else None,
            started_at=h.started_at,
            ended_at=h.ended_at,
            duration_seconds=h.duration_seconds,
            youtube_link=youtube_link,
            youtube_timestamp=youtube_ts,
            station_live_url=station_url,
        ))

    return APIResponse(data=PublicClipSearchResponse(
        query=q_trimmed,
        total=len(items),
        items=items,
    ))


# ── 대진표 (프로그램 리스트) ─────────────────────────────────────

class PublicProgramItem(BaseModel):
    id: UUID
    order: int
    event_code: Optional[str] = None
    event_type: Optional[str] = None
    division: str
    competition_date: Optional[date] = None
    heat_assignments: Optional[list] = None


class PublicProgramListResponse(BaseModel):
    items: List[PublicProgramItem]
    total: int


@router.get("/events/{event_code}/preview-slots", response_model=APIResponse[dict])
async def public_preview_slots(
    event_code: str,
    station: int,
    heat_number: int,
    competition_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """오버레이 프리뷰용 — 운영 중이 아니어도 해당 스테이션·히트의 슬롯을 계산해 반환.

    heat_assignments + participant_entries 만으로 조립해서 실제 Heat 없이도 렌더 가능.
    공개 엔드포인트 — 관람자 뷰·OBS 브라우저 소스 프리뷰 모드 모두 접근.
    같은 히트 번호가 여러 종목에 걸쳐 있을 수 있어 competition_date 로 좁히는 걸 권장.
    """
    from sqlalchemy import select
    from app.models import Program, Station as StationModel
    from app.api.v1.overlay import _build_slots_for_heat
    from app.core.mappings import EVENT_TYPE_MAP, display_division
    from datetime import date as _date

    event = await event_service.get_event_by_code(db, event_code)
    if not event or event.status == EventStatus.DRAFT:
        raise HTTPException(status_code=404, detail="Event not found")

    st_result = await db.execute(
        select(StationModel).where(StationModel.event_id == event.id, StationModel.station_number == station)
    )
    st = st_result.scalar_one_or_none()
    if not st:
        raise HTTPException(status_code=404, detail="스테이션를 찾을 수 없습니다")

    prog_stmt = select(Program).where(Program.event_id == event.id)
    if competition_date:
        try:
            cd = _date.fromisoformat(competition_date)
            prog_stmt = prog_stmt.where(Program.competition_date == cd)
        except ValueError:
            pass
    progs_result = await db.execute(prog_stmt)
    programs = progs_result.scalars().all()
    matched_program_id = None
    matched_event_code = None
    matched_division = None
    for p in programs:
        for a in (p.heat_assignments or []):
            if a.get("heat_number") == heat_number and int(a.get("station", 0)) == station:
                matched_program_id = p.id
                matched_event_code = p.event_code or p.event_type
                matched_division = p.division
                break
        if matched_program_id:
            break

    if not matched_program_id:
        return APIResponse(data={
            "heat_number": heat_number,
            "station_number": station,
            "slots": [],
            "participants": [],
            "event_type_display": None,
            "division_display": None,
            "elapsed_seconds": 0.0,
            "started_at": None,
            "status": "idle",
            "error": "해당 히트 배정 없음",
        })

    slots = await _build_slots_for_heat(db, station, event.id, heat_number, matched_program_id)
    participants: list[str] = []
    for s in slots:
        if s.get("sub_labels"):
            participants.extend(s["sub_labels"])
        elif s.get("label"):
            participants.append(s["label"])

    et_info = EVENT_TYPE_MAP.get(matched_event_code) if matched_event_code else None
    return APIResponse(data={
        "heat_number": heat_number,
        "station_number": station,
        "slots": slots,
        "participants": participants,
        "event_name": event.name,
        "event_code": matched_event_code,
        "event_type_display": et_info["name"] if et_info else matched_event_code,
        "division_display": display_division(matched_division) if matched_division else None,
        "elapsed_seconds": 0.0,
        "started_at": None,
        "status": "live",
    })


@router.get("/events/{event_code}/programs", response_model=APIResponse[PublicProgramListResponse])
async def list_public_event_programs(
    event_code: str,
    db: AsyncSession = Depends(get_db),
):
    """관람객 뷰용 프로그램(대진표) 목록. heat_assignments JSON 포함.

    각 assignment 에 participant 별 entry_numbers 배열을 덧붙여 돌려준다 (프론트 표시용).
    - 팀 종목 (릴레이/프리): 팀원 전부 같은 entry 공유 → 배열이 같은 값으로 채워짐, 프론트에서 dedupe
    - 개인 종목 (SRSS 등): 각 선수 엔트리가 다름 → 배열 요소가 개별
    """
    from sqlalchemy import select
    from app.models import Program, ParticipantEntry

    event = await event_service.get_event_by_code(db, event_code)
    if not event or event.status == EventStatus.DRAFT:
        raise HTTPException(status_code=404, detail="Event not found")

    result = await db.execute(
        select(Program)
        .where(Program.event_id == event.id)
        .order_by(Program.order)
    )
    programs = result.scalars().all()

    # 모든 program 의 participant_ids 한 번에 수집해서 entry_number 매핑 계산 (N+1 방지)
    from uuid import UUID as _UUID
    pid_ec_pairs: set[tuple[str, str]] = set()
    for p in programs:
        ec = p.event_code or p.event_type
        for a in (p.heat_assignments or []):
            for pid in (a.get("participant_ids") or []):
                pid_ec_pairs.add((str(pid), ec))
    # (participant_id, event_code) → entry_number
    entry_map: dict[tuple[str, str], str] = {}
    if pid_ec_pairs:
        all_pids = {pid for pid, _ in pid_ec_pairs}
        resolved = [_UUID(p) if isinstance(p, str) else p for p in all_pids]
        rows = await db.execute(
            select(ParticipantEntry.participant_id, ParticipantEntry.event_code, ParticipantEntry.entry_number)
            .where(ParticipantEntry.participant_id.in_(resolved))
        )
        for pid, ec, entry_num in rows.all():
            if entry_num:
                entry_map[(str(pid), ec)] = entry_num

    items = []
    for p in programs:
        ec = p.event_code or p.event_type
        enriched = []
        for a in (p.heat_assignments or []):
            a_copy = dict(a)
            pids = a.get("participant_ids") or []
            a_copy["entry_numbers"] = [entry_map.get((str(pid), ec), "") for pid in pids]
            enriched.append(a_copy)
        items.append(PublicProgramItem(
            id=p.id,
            order=p.order,
            event_code=p.event_code,
            event_type=p.event_type,
            division=p.division,
            competition_date=p.competition_date,
            heat_assignments=enriched,
        ))
    return APIResponse(data=PublicProgramListResponse(items=items, total=len(items)))


# ── 출전자 명단 ────────────────────────────────────────────────

class PublicParticipantEntryItem(BaseModel):
    event_code: Optional[str] = None
    event_type_display: Optional[str] = None
    entry_number: Optional[str] = None
    category: Optional[str] = None


class PublicParticipantItem(BaseModel):
    id: UUID
    name: str
    entry_number: Optional[str] = None
    event_code: Optional[str] = None
    event_type_display: Optional[str] = None
    team: Optional[str] = None
    category: Optional[str] = None
    entries: List[PublicParticipantEntryItem] = []


class PublicParticipantListResponse(BaseModel):
    query: str
    total: int
    items: List[PublicParticipantItem]


@router.get("/events/{event_code}/participants", response_model=APIResponse[PublicParticipantListResponse])
async def list_public_event_participants(
    event_code: str,
    q: Optional[str] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """관람객 뷰용 참가자 검색. q 없으면 전체(limit 까지). 휴대전화·이메일은 노출 안 함.

    검색은 이름 부분일치 + 배번(Entry number) 부분일치 둘 다 지원.
    Entry 번호는 participant_entries 테이블에도 존재하므로 그쪽까지 매칭.
    "#571" 과 "571" 은 동일하게 취급.
    """
    from sqlalchemy import select, or_, exists
    from sqlalchemy.orm import selectinload
    from app.models import Participant, ParticipantEntry

    event = await event_service.get_event_by_code(db, event_code)
    if not event or event.status == EventStatus.DRAFT:
        raise HTTPException(status_code=404, detail="Event not found")

    query = (q or "").strip()
    entry_query = query.replace("#", "").strip()
    stmt = (
        select(Participant)
        .where(Participant.event_id == event.id)
        .options(selectinload(Participant.entries))
    )
    if query:
        name_like = f"%{query}%"
        conditions = [Participant.name.ilike(name_like)]
        # Entry 번호 검색은 부분일치 아닌 "정확 일치" — "232" 치면 "232" 만, "2320" 등 제외.
        if entry_query:
            conditions.append(Participant.entry_number == entry_query)
            conditions.append(
                exists().where(
                    (ParticipantEntry.participant_id == Participant.id)
                    & (ParticipantEntry.entry_number == entry_query)
                )
            )
        stmt = stmt.where(or_(*conditions))
    stmt = stmt.order_by(Participant.name).limit(limit)

    result = await db.execute(stmt)
    rows = result.scalars().all()
    from app.core.mappings import EVENT_TYPE_MAP
    items = []
    for p in rows:
        ec = p.event_code
        info = EVENT_TYPE_MAP.get(ec) if ec else None
        entries_list: List[PublicParticipantEntryItem] = []
        for e in (p.entries or []):
            e_info = EVENT_TYPE_MAP.get(e.event_code) if e.event_code else None
            entries_list.append(PublicParticipantEntryItem(
                event_code=e.event_code,
                event_type_display=(e_info["name"] if e_info else e.event_code),
                entry_number=e.entry_number,
                category=e.category,
            ))
        items.append(PublicParticipantItem(
            id=p.id,
            name=p.name,
            entry_number=p.entry_number,
            event_code=ec,
            event_type_display=(info["name"] if info else ec),
            team=p.team,
            category=p.category,
            entries=entries_list,
        ))
    return APIResponse(data=PublicParticipantListResponse(
        query=query,
        total=len(items),
        items=items,
    ))


# ── 이벤트 스폰서 (공개 조회) ───────────────────────────

class PublicSponsorItem(BaseModel):
    id: UUID
    name: str
    logo_url: Optional[str] = None
    banner_image_url: Optional[str] = None
    banner_position: Optional[str] = None
    banner_zoom: int = 100
    tagline: Optional[str] = None
    kind: str = "AD"
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    slot_type: str
    weight: int


class PublicSponsorListResponse(BaseModel):
    items: List[PublicSponsorItem]
    total: int


@router.get("/events/{event_code}/sponsors", response_model=APIResponse[PublicSponsorListResponse])
async def public_list_event_sponsors(event_code: str, db: AsyncSession = Depends(get_db)):
    """관람자 뷰용 이벤트 스폰서 목록. active=True 만 반환."""
    from sqlalchemy import select
    from app.models import Event
    from app.services import sponsor_service

    event = (await db.execute(select(Event).where(Event.event_code == event_code))).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    links = await sponsor_service.list_event_sponsors(db, event.id, only_active=True)
    items = [
        PublicSponsorItem(
            id=l.sponsor.id,
            name=l.sponsor.name,
            logo_url=l.sponsor.logo_url,
            banner_image_url=l.sponsor.banner_image_url,
            banner_position=l.sponsor.banner_position,
            banner_zoom=l.sponsor.banner_zoom or 100,
            tagline=l.sponsor.tagline,
            kind=l.sponsor.kind.value if l.sponsor.kind else "AD",
            cta_text=l.sponsor.cta_text,
            cta_url=l.sponsor.cta_url,
            slot_type=l.slot_type.value,
            weight=l.weight,
        )
        for l in links
    ]
    return APIResponse(data=PublicSponsorListResponse(items=items, total=len(items)))


# ── 광고 그리드 (전역, 공개 조회) ───────────────────────


@router.get("/ads/grid")
async def public_ad_grid(db: AsyncSession = Depends(get_db)):
    """전역 광고 그리드 — 시청자 홈 화면용. 활성 슬롯만 반환."""
    from app.schemas import PublicAdGridResponse, PublicAdSlotItem
    from app.services import ad_service

    settings = await ad_service.get_settings(db)
    slots = await ad_service.list_slots(db, only_active=True)
    items = [
        PublicAdSlotItem(
            id=s.sponsor.id,
            name=s.sponsor.name,
            logo_url=s.sponsor.logo_url,
            banner_image_url=s.sponsor.banner_image_url,
            # 슬롯 오버라이드 우선, 없으면 스폰서 마스터 값 폴백
            banner_position=s.banner_position if s.banner_position is not None else s.sponsor.banner_position,
            banner_zoom=(s.banner_zoom if s.banner_zoom is not None else s.sponsor.banner_zoom) or 100,
            banner_fit=s.banner_fit or "contain",
            banner_offset_x=s.banner_offset_x or 0,
            banner_offset_y=s.banner_offset_y or 0,
            tagline=s.sponsor.tagline,
            kind=s.sponsor.kind.value if s.sponsor.kind else "AD",
            cta_text=s.sponsor.cta_text,
            cta_url=s.sponsor.cta_url,
            slot_index=s.slot_index,
            weight=s.weight,
        )
        for s in slots
    ]
    import json as _json
    try:
        slot_modes = _json.loads(settings.slot_modes) if settings.slot_modes else {}
        if not isinstance(slot_modes, dict):
            slot_modes = {}
    except Exception:
        slot_modes = {}
    try:
        row_heights = _json.loads(settings.row_heights) if settings.row_heights else []
        if not isinstance(row_heights, list):
            row_heights = []
    except Exception:
        row_heights = []
    payload = PublicAdGridResponse(
        grid_template=settings.grid_template,
        cell_height=settings.cell_height,
        row_heights=row_heights,
        slot_modes=slot_modes,
        items=items,
    )
    return APIResponse(data=payload)
