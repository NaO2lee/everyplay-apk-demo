"""
Google Drive 서비스 — 클립 업로드 + 비공개 링크 생성

서비스 계정(Service Account) 방식으로 인증.
YouTube API 할당량 제한 대안으로 Google Drive를 우선 사용.
"""

import asyncio
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import Heat

_thread_pool = ThreadPoolExecutor(max_workers=2)

GOOGLE_SERVICE_ACCOUNT_FILE = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "")
GOOGLE_DRIVE_FOLDER_ID = os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "")


def _get_drive_service():
    """Google Drive API 서비스 생성 (동기)"""
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    if not GOOGLE_SERVICE_ACCOUNT_FILE or not os.path.exists(GOOGLE_SERVICE_ACCOUNT_FILE):
        raise FileNotFoundError(f"서비스 계정 키 파일 없음: {GOOGLE_SERVICE_ACCOUNT_FILE}")

    credentials = service_account.Credentials.from_service_account_file(
        GOOGLE_SERVICE_ACCOUNT_FILE,
        scopes=["https://www.googleapis.com/auth/drive.file"]
    )
    return build("drive", "v3", credentials=credentials)


def upload_to_drive_sync(file_path: str, filename: str, folder_id: str = None) -> dict:
    """
    Google Drive에 파일 업로드 (동기, 스레드풀에서 실행).
    Returns: {"view_url": "...", "download_url": "..."}
    """
    from googleapiclient.http import MediaFileUpload

    service = _get_drive_service()

    file_metadata = {"name": filename}
    if folder_id:
        file_metadata["parents"] = [folder_id]

    media = MediaFileUpload(file_path, mimetype="video/mp4", resumable=True, chunksize=10 * 1024 * 1024)

    request = service.files().create(body=file_metadata, media_body=media, fields="id, webViewLink")

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"[Drive] 업로드 진행: {int(status.progress() * 100)}%")

    file_id = response["id"]

    # 링크가 있는 사람 누구나 보기 (비공개 공유)
    service.permissions().create(
        fileId=file_id,
        body={"type": "anyone", "role": "reader"},
    ).execute()

    view_url = response.get("webViewLink", f"https://drive.google.com/file/d/{file_id}/view")
    download_url = f"https://drive.google.com/uc?export=download&id={file_id}"

    print(f"[Drive] 업로드 완료: {view_url}")
    return {"view_url": view_url, "download_url": download_url}


async def upload_clip_to_drive(
    db: AsyncSession,
    heat_id: uuid.UUID,
    folder_id: str = None,
) -> Optional[str]:
    """
    클립을 Google Drive에 업로드하고 공유 링크를 DB에 저장.
    """
    query = (
        select(Heat)
        .options(selectinload(Heat.station), selectinload(Heat.participants))
        .where(Heat.id == heat_id)
    )
    result = await db.execute(query)
    heat = result.scalar_one_or_none()

    if not heat or not heat.clip_path or not os.path.exists(heat.clip_path):
        return None

    # 파일명 생성
    participant_names = '_'.join([p.name for p in heat.participants]) if heat.participants else ''
    date_str = heat.started_at.strftime('%Y%m%d') if heat.started_at else ''
    filename = f"{participant_names}_HIT{heat.heat_number}_스테이션{heat.station.station_number}_{date_str}.mp4"

    target_folder = folder_id or GOOGLE_DRIVE_FOLDER_ID

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            _thread_pool,
            upload_to_drive_sync,
            heat.clip_path, filename, target_folder
        )

        clip_url = result["view_url"]
        heat.clip_url = clip_url
        await db.commit()

        return clip_url

    except FileNotFoundError:
        print("[Drive] 서비스 계정 키 파일 미설정 — 업로드 스킵")
        return None
    except ImportError:
        print("[Drive] google-api-python-client 미설치 — 업로드 스킵")
        return None
    except Exception as e:
        print(f"[Drive] 업로드 실패: {e}")
        return None
