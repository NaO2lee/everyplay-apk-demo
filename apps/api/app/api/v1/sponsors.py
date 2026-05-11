"""스폰서 CRUD + 이벤트 스폰서 연결 (관리자 전용).

공개 조회 `/public/events/{code}/sponsors` 는 public.py 참조.
"""
import os
import shutil
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas import (
    APIResponse,
    SponsorCreate,
    SponsorUpdate,
    SponsorResponse,
    SponsorListResponse,
    EventSponsorCreate,
    EventSponsorUpdate,
    EventSponsorResponse,
    EventSponsorListResponse,
)
from app.services import sponsor_service

router = APIRouter(tags=["sponsors"])

# 배너 이미지 저장 위치 — 백엔드 정적 파일 마운트 (`/media`) 와 짝
# 카테고리별로 디렉토리 분리: media/sponsors/, media/posters/, ...
# 나중에 클라우드 스토리지 (S3) 로 옮길 때 prefix 그대로 매핑 가능.
MEDIA_ROOT = Path(__file__).resolve().parents[3] / "media"
SPONSORS_DIR = MEDIA_ROOT / "sponsors"
ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MAX_BYTES = 10 * 1024 * 1024  # 10MB


# ─────────── 스폰서 마스터 ───────────

@router.get("/sponsors", response_model=APIResponse[SponsorListResponse])
async def list_sponsors(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    rows, total = await sponsor_service.list_sponsors(db, skip, limit)
    return APIResponse(data=SponsorListResponse(
        items=[SponsorResponse.model_validate(s) for s in rows],
        total=total,
    ))


@router.post("/sponsors", response_model=APIResponse[SponsorResponse])
async def create_sponsor(data: SponsorCreate, db: AsyncSession = Depends(get_db)):
    sp = await sponsor_service.create_sponsor(db, data)
    return APIResponse(data=SponsorResponse.model_validate(sp))


@router.patch("/sponsors/{sponsor_id}", response_model=APIResponse[SponsorResponse])
async def update_sponsor(sponsor_id: UUID, data: SponsorUpdate, db: AsyncSession = Depends(get_db)):
    sp = await sponsor_service.update_sponsor(db, sponsor_id, data)
    if not sp:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    return APIResponse(data=SponsorResponse.model_validate(sp))


@router.delete("/sponsors/{sponsor_id}", response_model=APIResponse[dict])
async def delete_sponsor(sponsor_id: UUID, db: AsyncSession = Depends(get_db)):
    ok = await sponsor_service.delete_sponsor(db, sponsor_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    return APIResponse(data={"ok": True})


@router.post("/sponsors/{sponsor_id}/banner", response_model=APIResponse[SponsorResponse])
async def upload_sponsor_banner(
    sponsor_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """스폰서 배너 이미지 업로드.

    저장 위치: `apps/api/media/sponsors/<sponsor_id>.<ext>`
    `banner_image_url` 컬럼은 `/media/sponsors/<sponsor_id>.<ext>?v=<unix>` 로 저장
    (브라우저/CDN 캐시 무효화 자동).
    """
    import time
    sp = await sponsor_service.get_sponsor(db, sponsor_id)
    if not sp:
        raise HTTPException(status_code=404, detail="Sponsor not found")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}. Allowed: {sorted(ALLOWED_EXT)}")

    SPONSORS_DIR.mkdir(parents=True, exist_ok=True)

    # 같은 스폰서의 기존 배너 파일 모두 정리 (확장자 다를 수 있음)
    for old in SPONSORS_DIR.glob(f"{sponsor_id}.*"):
        try:
            old.unlink()
        except Exception:
            pass

    # 1) 원본 임시 파일에 저장
    tmp_path = SPONSORS_DIR / f"{sponsor_id}.upload-tmp{ext}"
    bytes_written = 0
    with tmp_path.open("wb") as out:
        while chunk := await file.read(64 * 1024):
            bytes_written += len(chunk)
            if bytes_written > MAX_BYTES:
                out.close()
                tmp_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail=f"File too large (>{MAX_BYTES} bytes)")
            out.write(chunk)

    # 2) 압축/리사이즈 — 스폰서 배너는 가로 최대 1600px 로
    from app.utils.images import compress_image
    try:
        final_path, final_ext = compress_image(tmp_path, SPONSORS_DIR / str(sponsor_id), max_width=1600, jpeg_quality=85)
    except Exception as e:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"이미지 처리 실패: {e}")
    finally:
        tmp_path.unlink(missing_ok=True)

    public_url = f"/media/sponsors/{sponsor_id}{final_ext}?v={int(time.time())}"
    update = SponsorUpdate(banner_image_url=public_url)
    sp = await sponsor_service.update_sponsor(db, sponsor_id, update)
    return APIResponse(data=SponsorResponse.model_validate(sp))


# ─────────── 이벤트-스폰서 연결 ───────────

@router.get("/events/{event_id}/sponsors", response_model=APIResponse[EventSponsorListResponse])
async def list_event_sponsors(event_id: UUID, only_active: bool = False, db: AsyncSession = Depends(get_db)):
    rows = await sponsor_service.list_event_sponsors(db, event_id, only_active=only_active)
    return APIResponse(data=EventSponsorListResponse(
        items=[EventSponsorResponse.model_validate(r) for r in rows],
        total=len(rows),
    ))


@router.post("/events/{event_id}/sponsors", response_model=APIResponse[EventSponsorResponse])
async def link_sponsor(event_id: UUID, data: EventSponsorCreate, db: AsyncSession = Depends(get_db)):
    link = await sponsor_service.link_sponsor_to_event(db, event_id, data)
    return APIResponse(data=EventSponsorResponse.model_validate(link))


@router.patch("/events/{event_id}/sponsors/{link_id}", response_model=APIResponse[EventSponsorResponse])
async def update_event_sponsor(event_id: UUID, link_id: UUID, data: EventSponsorUpdate, db: AsyncSession = Depends(get_db)):
    link = await sponsor_service.update_event_sponsor(db, link_id, data)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    return APIResponse(data=EventSponsorResponse.model_validate(link))


@router.delete("/events/{event_id}/sponsors/{link_id}", response_model=APIResponse[dict])
async def unlink_sponsor(event_id: UUID, link_id: UUID, db: AsyncSession = Depends(get_db)):
    ok = await sponsor_service.unlink_sponsor_from_event(db, link_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Link not found")
    return APIResponse(data={"ok": True})
