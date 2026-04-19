"""
YouTube 업로드 서비스 — 클립을 YouTube에 비공개(unlisted)로 업로드

인증 방식 (우선순위):
  1. 저장된 OAuth2 토큰 파일 (YOUTUBE_TOKEN_FILE)
  2. OAuth2 환경변수 (YOUTUBE_CLIENT_ID + YOUTUBE_REFRESH_TOKEN)
  3. 서비스 계정 (YOUTUBE_SERVICE_ACCOUNT_FILE)

일일 할당량: 기본 10,000 단위 (업로드 1건 = 1,600 단위 → 하루 ~6건)
"""

import asyncio
import json
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import Heat

_thread_pool = ThreadPoolExecutor(max_workers=2)

# ── 환경변수 ──────────────────────────────────────────────
YOUTUBE_CLIENT_ID = os.environ.get("YOUTUBE_CLIENT_ID", "")
YOUTUBE_CLIENT_SECRET = os.environ.get("YOUTUBE_CLIENT_SECRET", "")
YOUTUBE_REFRESH_TOKEN = os.environ.get("YOUTUBE_REFRESH_TOKEN", "")
YOUTUBE_TOKEN_FILE = os.environ.get("YOUTUBE_TOKEN_FILE", "")
YOUTUBE_SERVICE_ACCOUNT_FILE = os.environ.get(
    "YOUTUBE_SERVICE_ACCOUNT_FILE",
    os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", ""),
)

YOUTUBE_API_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
]


class YouTubeQuotaExceededError(Exception):
    """YouTube API 일일 할당량 초과"""
    pass


class YouTubeAuthError(Exception):
    """YouTube API 인증 실패"""
    pass


def _get_youtube_service():
    """YouTube Data API v3 서비스 객체 생성 (동기).

    우선순위:
      1. 저장된 OAuth2 토큰 파일 (YOUTUBE_TOKEN_FILE)
      2. 환경변수 OAuth2 (YOUTUBE_CLIENT_ID + YOUTUBE_REFRESH_TOKEN)
      3. 서비스 계정 (YOUTUBE_SERVICE_ACCOUNT_FILE)
    """
    from googleapiclient.discovery import build

    credentials = None

    # 방법 1: 저장된 OAuth2 토큰 파일
    if YOUTUBE_TOKEN_FILE and os.path.exists(YOUTUBE_TOKEN_FILE):
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request

        credentials = Credentials.from_authorized_user_file(YOUTUBE_TOKEN_FILE, YOUTUBE_API_SCOPES)
        if credentials and credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(Request())
                with open(YOUTUBE_TOKEN_FILE, "w") as f:
                    f.write(credentials.to_json())
            except Exception as e:
                raise YouTubeAuthError(f"토큰 갱신 실패: {e}")

    # 방법 2: 환경변수 OAuth2
    if not credentials and YOUTUBE_CLIENT_ID and YOUTUBE_REFRESH_TOKEN:
        from google.oauth2.credentials import Credentials
        credentials = Credentials(
            token=None,
            refresh_token=YOUTUBE_REFRESH_TOKEN,
            client_id=YOUTUBE_CLIENT_ID,
            client_secret=YOUTUBE_CLIENT_SECRET,
            token_uri="https://oauth2.googleapis.com/token",
        )

    # 방법 3: 서비스 계정
    if not credentials and YOUTUBE_SERVICE_ACCOUNT_FILE and os.path.exists(YOUTUBE_SERVICE_ACCOUNT_FILE):
        from google.oauth2 import service_account
        credentials = service_account.Credentials.from_service_account_file(
            YOUTUBE_SERVICE_ACCOUNT_FILE,
            scopes=YOUTUBE_API_SCOPES,
        )

    if not credentials:
        raise YouTubeAuthError(
            "YouTube API 인증 정보 없음. "
            "YOUTUBE_TOKEN_FILE, YOUTUBE_CLIENT_ID+YOUTUBE_REFRESH_TOKEN, "
            "또는 YOUTUBE_SERVICE_ACCOUNT_FILE 환경변수를 설정하세요."
        )

    return build("youtube", "v3", credentials=credentials)


def upload_video_sync(
    file_path: str,
    title: str,
    description: str = "",
    tags: list = None,
    privacy: str = "unlisted",
) -> dict:
    """
    YouTube에 동영상 업로드 (동기, 스레드풀에서 실행).

    Returns: {"video_id": "...", "url": "https://youtu.be/..."}
    Raises: YouTubeQuotaExceededError, YouTubeAuthError, FileNotFoundError
    """
    from googleapiclient.http import MediaFileUpload
    from googleapiclient.errors import HttpError

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"업로드할 파일 없음: {file_path}")

    service = _get_youtube_service()

    body = {
        "snippet": {
            "title": title[:100],
            "description": description[:5000],
            "tags": (tags or [])[:30],
            "categoryId": "17",  # Sports
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(
        file_path,
        mimetype="video/mp4",
        resumable=True,
        chunksize=10 * 1024 * 1024,
    )

    try:
        request = service.videos().insert(
            part="snippet,status",
            body=body,
            media_body=media,
        )

        response = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                print(f"[YouTube] 업로드 진행: {int(status.progress() * 100)}%")

    except HttpError as e:
        if e.resp.status == 403:
            error_reason = ""
            try:
                error_detail = json.loads(e.content.decode())
                error_reason = error_detail.get("error", {}).get("errors", [{}])[0].get("reason", "")
            except Exception:
                pass
            if "quotaExceeded" in str(e) or error_reason == "quotaExceeded":
                raise YouTubeQuotaExceededError(
                    "YouTube API 일일 할당량 초과 (기본 ~6건/일). 내일 다시 시도하거나 할당량 증가를 요청하세요."
                )
            raise YouTubeAuthError(f"YouTube API 권한 오류: {e}")
        raise

    video_id = response["id"]
    url = f"https://youtu.be/{video_id}"

    print(f"[YouTube] 업로드 완료: {url}")
    return {"video_id": video_id, "url": url}


def get_upload_status_sync(video_id: str) -> dict:
    """
    YouTube 동영상 처리 상태 조회 (동기).

    Returns: {"status": "processed"|"processing"|"failed"|..., "url": "https://youtu.be/..."}
    """
    from googleapiclient.errors import HttpError

    service = _get_youtube_service()

    try:
        response = service.videos().list(
            part="status,processingDetails",
            id=video_id,
        ).execute()
    except HttpError as e:
        return {"status": "error", "url": f"https://youtu.be/{video_id}", "error": str(e)}

    items = response.get("items", [])
    if not items:
        return {"status": "not_found", "url": f"https://youtu.be/{video_id}"}

    video = items[0]
    upload_status = video.get("status", {}).get("uploadStatus", "unknown")

    if upload_status == "processed":
        status = "processed"
    elif upload_status == "uploaded":
        status = "processing"
    elif upload_status in ("failed", "rejected"):
        status = "failed"
    else:
        status = upload_status

    return {
        "status": status,
        "url": f"https://youtu.be/{video_id}",
        "upload_status": upload_status,
    }


async def get_upload_status(video_id: str) -> dict:
    """YouTube 동영상 처리 상태 조회 (비동기 래퍼)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_thread_pool, get_upload_status_sync, video_id)


async def upload_clip_to_youtube(
    db: AsyncSession,
    heat_id: uuid.UUID,
    event_name: str = "",
    privacy: str = "unlisted",
) -> dict:
    """
    히트 클립을 YouTube에 업로드하고 clip_url을 DB에 저장.

    Returns: {"video_id": "...", "url": "https://youtu.be/..."}
    Raises: ValueError, FileNotFoundError, YouTubeAuthError, YouTubeQuotaExceededError
    """
    query = (
        select(Heat)
        .options(selectinload(Heat.station), selectinload(Heat.participants))
        .where(Heat.id == heat_id)
    )
    result = await db.execute(query)
    heat = result.scalar_one_or_none()

    if not heat:
        raise ValueError("히트를 찾을 수 없습니다")

    if heat.clip_status != "ready":
        raise ValueError(f"클립 상태가 'ready'가 아닙니다 (현재: {heat.clip_status})")

    if not heat.clip_path or not os.path.exists(heat.clip_path):
        raise FileNotFoundError(f"클립 파일 없음: {heat.clip_path}")

    # 제목: {대회명} - 스테이션{번호} HIT{번호} - {선수명}
    station_num = heat.station.station_number if heat.station else "?"
    participant_names = ", ".join([p.name for p in heat.participants]) if heat.participants else ""
    title_parts = []
    if event_name:
        title_parts.append(event_name)
    title_parts.append(f"스테이션{station_num} HIT{heat.heat_number}")
    if participant_names:
        title_parts.append(participant_names)
    title = " - ".join(title_parts)

    # 설명
    desc_lines = []
    if event_name:
        desc_lines.append(f"대회: {event_name}")
    desc_lines.append(f"스테이션: {station_num}")
    desc_lines.append(f"히트: #{heat.heat_number}")
    if participant_names:
        desc_lines.append(f"선수: {participant_names}")
    if heat.started_at:
        desc_lines.append(f"시작: {heat.started_at.strftime('%Y-%m-%d %H:%M:%S')}")
    if heat.duration_seconds:
        mm = heat.duration_seconds // 60
        ss = heat.duration_seconds % 60
        desc_lines.append(f"기록: {mm:02d}:{ss:02d}")
    description = "\n".join(desc_lines)

    # 태그
    tags = ["줄넘기", "jump rope", "모두의플레이"]
    if event_name:
        tags.append(event_name)
    if heat.participants:
        tags.extend([p.name for p in heat.participants])

    # 업로드 (스레드풀)
    loop = asyncio.get_event_loop()
    upload_result = await loop.run_in_executor(
        _thread_pool,
        upload_video_sync,
        heat.clip_path, title, description, tags, privacy,
    )

    heat.clip_url = upload_result["url"]
    heat.clip_status = "uploaded"
    await db.commit()

    return upload_result
