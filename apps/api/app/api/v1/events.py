import os
import time
from pathlib import Path
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import EventStatus
from app.schemas import (
    APIResponse,
    EventCreate,
    EventUpdate,
    EventResponse,
    EventDetailResponse,
    EventListResponse,
    StationResponse,
)
from app.services import event_service

router = APIRouter(prefix="/events", tags=["events"])

# 포스터 (하이라이트) 이미지 업로드 위치
POSTERS_DIR = Path(__file__).resolve().parents[3] / "media" / "posters"
ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MAX_BYTES = 30 * 1024 * 1024  # 30MB


@router.post("", response_model=APIResponse[EventDetailResponse])
async def create_event(
    event_data: EventCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new event with courts"""
    event = await event_service.create_event(db, event_data)
    stations = [StationResponse.from_orm_with_mask(c) for c in event.stations]
    response = EventDetailResponse(
        **EventResponse.model_validate(event).model_dump(),
        stations=stations,
    )
    return APIResponse(data=response)


@router.get("", response_model=APIResponse[EventListResponse])
async def list_events(
    status: Optional[EventStatus] = None,
    skip: int = 0,
    limit: int = 20,
    trash: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """대회 목록. 기본은 활성만, trash=true 로 휴지통 조회."""
    events, total = await event_service.get_events(db, status, skip, limit, trash=trash)
    return APIResponse(
        data=EventListResponse(
            items=[EventResponse.model_validate(e) for e in events],
            total=total,
        )
    )


@router.delete("/{event_id}", response_model=APIResponse[dict])
async def delete_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """대회를 휴지통으로 이동 (소프트 삭제). 데이터는 남아있고 복원 가능."""
    # ACTIVE 운영 세션이 있으면 차단
    from sqlalchemy import select as sa_select
    from app.models import OperationSession, SessionStatus
    active = (await db.execute(
        sa_select(OperationSession).where(
            OperationSession.event_id == event_id,
            OperationSession.status == SessionStatus.ACTIVE,
        )
    )).scalar_one_or_none()
    if active:
        raise HTTPException(status_code=400, detail="운영 중인 대회는 삭제할 수 없습니다. 먼저 운영을 종료해 주세요.")

    event = await event_service.soft_delete_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return APIResponse(data={"ok": True, "deleted_at": event.deleted_at.isoformat()})


@router.post("/{event_id}/restore", response_model=APIResponse[dict])
async def restore_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """휴지통의 대회를 활성 상태로 복원."""
    event = await event_service.restore_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return APIResponse(data={"ok": True})


@router.delete("/{event_id}/permanent", response_model=APIResponse[dict])
async def hard_delete_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """대회를 DB 에서 영구 삭제. cascade 로 히트/참가자/프로그램/스테이션까지 모두 제거된다. 복구 불가."""
    ok = await event_service.hard_delete_event(db, event_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Event not found")
    return APIResponse(data={"ok": True})


@router.get("/by-code/{event_code}", response_model=APIResponse[EventDetailResponse])
async def get_event_by_code(
    event_code: str,
    db: AsyncSession = Depends(get_db),
):
    """Get event details by event code"""
    event = await event_service.get_event_by_code(db, event_code)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    stations = [StationResponse.from_orm_with_mask(c) for c in event.stations]
    response = EventDetailResponse(
        **EventResponse.model_validate(event).model_dump(),
        stations=stations,
    )
    return APIResponse(data=response)


@router.get("/{event_id}", response_model=APIResponse[EventDetailResponse])
async def get_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get event details"""
    event = await event_service.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    stations = [StationResponse.from_orm_with_mask(c) for c in event.stations]
    response = EventDetailResponse(
        **EventResponse.model_validate(event).model_dump(),
        stations=stations,
    )
    return APIResponse(data=response)


MAX_OVERLAY_CONFIG_KB = 32  # 오버레이 설정 JSON 최대 크기 (방어적 제한)


@router.put("/{event_id}/overlay", response_model=APIResponse[dict])
async def save_overlay_config(
    event_id: UUID,
    config: dict,
    db: AsyncSession = Depends(get_db),
):
    """오버레이 설정 저장 (관리자 인증 필요 — router level dependency)"""
    import json
    if not isinstance(config, dict):
        raise HTTPException(status_code=400, detail="overlay_config 는 JSON 객체여야 합니다")

    payload = json.dumps(config, ensure_ascii=False)
    size_kb = len(payload.encode("utf-8")) / 1024
    if size_kb > MAX_OVERLAY_CONFIG_KB:
        raise HTTPException(
            status_code=413,
            detail=f"overlay_config 가 너무 큽니다 ({size_kb:.1f} KB). 최대 {MAX_OVERLAY_CONFIG_KB} KB 허용",
        )

    # 이벤트 존재 확인
    event = await event_service.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다")

    event.overlay_config = config
    await db.commit()

    # 오버레이 설정 변경을 모든 스테이션에 SSE broadcast
    from app.api.v1.overlay import get_broker
    broker = get_broker()
    for station in (event.stations or []):
        await broker.publish(str(station.id), {
            "type": "config_update",
            "overlay_config": config,
        })

    return APIResponse(data={"ok": True})


@router.patch("/{event_id}", response_model=APIResponse[EventResponse])
async def update_event(
    event_id: UUID,
    event_data: EventUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update event"""
    event = await event_service.update_event(db, event_id, event_data)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return APIResponse(data=EventResponse.model_validate(event))


@router.post("/{event_id}/poster", response_model=APIResponse[EventResponse])
async def upload_event_poster(
    event_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """대회 하이라이트(포스터) 이미지 업로드.

    저장: `apps/api/media/posters/<event_id>.<ext>`
    `poster_url` = `/media/posters/<event_id>.<ext>?v=<unix>` 로 자동 갱신.
    """
    event = await event_service.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}. Allowed: {sorted(ALLOWED_EXT)}")

    POSTERS_DIR.mkdir(parents=True, exist_ok=True)

    # 같은 이벤트의 기존 포스터 파일 모두 정리 (확장자 다를 수 있음)
    for old in POSTERS_DIR.glob(f"{event_id}.*"):
        try:
            old.unlink()
        except Exception:
            pass

    # 1) 원본 임시 저장
    tmp_path = POSTERS_DIR / f"{event_id}.upload-tmp{ext}"
    bytes_written = 0
    with tmp_path.open("wb") as out:
        while chunk := await file.read(64 * 1024):
            bytes_written += len(chunk)
            if bytes_written > MAX_BYTES:
                out.close()
                tmp_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail=f"File too large (>{MAX_BYTES} bytes)")
            out.write(chunk)

    # 2) 압축/리사이즈 — 포스터는 가로 최대 1920px (16:9 1080p 대응)
    from app.utils.images import compress_image
    try:
        final_path, final_ext = compress_image(tmp_path, POSTERS_DIR / str(event_id), max_width=1920, jpeg_quality=85)
    except Exception as e:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"이미지 처리 실패: {e}")
    finally:
        tmp_path.unlink(missing_ok=True)

    public_url = f"/media/posters/{event_id}{final_ext}?v={int(time.time())}"
    update = EventUpdate(poster_url=public_url)
    event = await event_service.update_event(db, event_id, update)
    return APIResponse(data=EventResponse.model_validate(event))


@router.patch("/{event_id}/status", response_model=APIResponse[EventResponse])
async def update_event_status(
    event_id: UUID,
    status: EventStatus,
    db: AsyncSession = Depends(get_db),
):
    """Update event status"""
    event = await event_service.update_event(
        db, event_id, EventUpdate(status=status)
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return APIResponse(data=EventResponse.model_validate(event))
