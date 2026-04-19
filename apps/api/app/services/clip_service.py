"""
클립 서비스 — HIT 단위 영상 클립 추출 + 자동 업로드 + 알림 파이프라인

흐름: HIT 종료 → Worker 클립 추출 → save_clip() → Google Drive 업로드 → SMS 발송
"""

import asyncio
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import Heat, Station

CLIP_STORAGE_DIR = Path(os.environ.get("CLIP_STORAGE_DIR", "/tmp/everyplay_clips"))
CLIP_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
CLIP_URL_PREFIX = os.environ.get("CLIP_URL_PREFIX", "")


async def save_clip(
    db: AsyncSession,
    heat_id: uuid.UUID,
    clip_data: bytes,
    filename: str,
) -> Optional[str]:
    """
    Worker에서 받은 클립을 로컬 저장 + Google Drive 업로드 + SMS 발송.
    """
    query = (
        select(Heat)
        .options(selectinload(Heat.station), selectinload(Heat.participants))
        .where(Heat.id == heat_id)
    )
    result = await db.execute(query)
    heat = result.scalar_one_or_none()
    if not heat:
        return None

    # 로컬 저장
    clip_path = str(CLIP_STORAGE_DIR / filename)
    with open(clip_path, 'wb') as f:
        f.write(clip_data)

    heat.clip_path = clip_path
    heat.clip_status = "ready"

    # 로컬 URL 생성 — PREFIX 없으면 clip_url을 비워둠 (로컬 경로 유출 방지)
    if CLIP_URL_PREFIX:
        heat.clip_url = f"{CLIP_URL_PREFIX}/{filename}"
    else:
        heat.clip_url = None

    await db.commit()

    # Google Drive 업로드 시도
    try:
        from app.services.google_drive_service import upload_clip_to_drive
        drive_url = await upload_clip_to_drive(db, heat_id)
        if drive_url:
            heat.clip_url = drive_url
            await db.commit()
    except Exception as e:
        print(f"[Clip] Drive 업로드 실패 (로컬 URL 유지): {e}")

    # 자동 SMS 발송
    await auto_notify_on_clip_ready(db, heat_id)

    return heat.clip_url


async def auto_notify_on_clip_ready(
    db: AsyncSession,
    heat_id: uuid.UUID,
) -> int:
    """클립 준비 완료 시 참가자에게 자동 SMS 발송"""
    try:
        from app.services import notification_service

        query = (
            select(Heat)
            .options(selectinload(Heat.participants))
            .where(Heat.id == heat_id)
        )
        result = await db.execute(query)
        heat = result.scalar_one_or_none()
        if not heat or not heat.clip_url:
            return 0

        # 알림 생성 + 발송
        notifications = await notification_service.create_notifications(db, heat_id)
        sent = 0
        for notif in notifications:
            success = await notification_service.send_notification(db, notif.id)
            if success:
                sent += 1

        return sent
    except Exception as e:
        print(f"[Clip] 자동 알림 실패: {e}")
        return 0


async def extract_clip_from_recording(
    db: AsyncSession,
    heat_id: uuid.UUID,
    recording_path: Optional[str] = None,
) -> Optional[str]:
    """
    로컬 녹화 파일에서 HIT 구간 클립 추출 (서버 사이드).
    Worker가 못하는 경우 fallback용.
    """
    query = (
        select(Heat)
        .options(selectinload(Heat.station), selectinload(Heat.participants))
        .where(Heat.id == heat_id)
    )
    result = await db.execute(query)
    heat = result.scalar_one_or_none()

    if not heat or not heat.started_at or not heat.ended_at:
        return None

    if not recording_path:
        recording_path = heat.station.recording_path
    if not recording_path or not os.path.exists(recording_path):
        heat.clip_status = "failed"
        await db.commit()
        return None

    # 클립 파일명 생성
    participant_names = '_'.join([p.name for p in heat.participants][:3]) if heat.participants else ''
    safe_name = participant_names.replace(' ', '_').replace('/', '_')
    clip_filename = f"station{heat.station.station_number}_heat{heat.heat_number}_{safe_name}_{heat.started_at.strftime('%H%M%S')}.mp4"
    clip_path = str(CLIP_STORAGE_DIR / clip_filename)

    # 타이밍 계산 (OBS 녹화 시작 기준 오프셋 우선, 없으면 실시간 계산)
    if heat.recording_offset_start is not None and heat.recording_offset_end is not None:
        start_offset = max(0, heat.recording_offset_start - 2)
        duration = (heat.recording_offset_end - heat.recording_offset_start) + 4
    else:
        recording_start = heat.station.recording_started_at or heat.station.stream_started_at or heat.started_at
        start_offset = max(0, (heat.started_at - recording_start).total_seconds() - 2)
        duration = (heat.ended_at - heat.started_at).total_seconds() + 4

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_offset),
        "-i", recording_path,
        "-t", str(duration),
        "-c", "copy",
        "-movflags", "+faststart",
        clip_path,
    ]

    heat.clip_status = "processing"
    await db.commit()

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(process.communicate(), timeout=120)

        if process.returncode == 0 and os.path.exists(clip_path):
            heat.clip_path = clip_path
            heat.clip_status = "ready"
            heat.clip_url = f"{CLIP_URL_PREFIX}/{clip_filename}" if CLIP_URL_PREFIX else None
            await db.commit()
            return clip_path
        else:
            heat.clip_status = "failed"
            await db.commit()
            return None
    except (asyncio.TimeoutError, Exception) as e:
        heat.clip_status = "failed"
        await db.commit()
        return None


async def get_clip_status(db: AsyncSession, heat_id: uuid.UUID) -> dict:
    """클립 상태 조회"""
    result = await db.execute(select(Heat).where(Heat.id == heat_id))
    heat = result.scalar_one_or_none()
    if not heat:
        return {"status": "not_found"}
    return {
        "status": heat.clip_status or "none",
        "clip_path": heat.clip_path,
        "clip_url": heat.clip_url,
    }
