"""Station endpoints — OBS 기반 버전.

스트리밍/워커 관련 엔드포인트 제거됨. OBS 제어는 /obs 라우터에서 담당.
여기서는 스테이션 메타데이터(OBS 접속 정보, 상태)만 관리.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.schemas import APIResponse, StationResponse, StationStatusUpdate
from app.services import event_service

router = APIRouter(prefix="/stations", tags=["stations"])


class StationObsConfig(BaseModel):
    obs_host: Optional[str] = None
    obs_port: Optional[int] = 4455
    obs_password: Optional[str] = None
    youtube_stream_url: Optional[str] = None
    youtube_stream_key: Optional[str] = None
    youtube_offset_seconds: Optional[float] = None


@router.put("/{station_id}/obs-config", response_model=APIResponse[StationResponse])
async def set_obs_config(
    station_id: UUID,
    body: StationObsConfig,
    db: AsyncSession = Depends(get_db),
):
    """스테이션별 OBS WebSocket 접속 정보 설정.

    요청 body 에 포함되지 않은 필드는 기존 값 유지 (특히 비밀번호를 빈 칸으로
    저장해도 덮어쓰지 않음).
    """
    update_fields = body.model_dump(exclude_unset=True)
    station = await event_service.update_court_obs_config(
        db,
        station_id,
        **update_fields,
    )
    if not station:
        raise HTTPException(status_code=404, detail="스테이션를 찾을 수 없습니다")
    return APIResponse(data=StationResponse.from_orm_with_mask(station))


@router.delete("/{station_id}/obs-config", response_model=APIResponse[StationResponse])
async def clear_obs_config(
    station_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """스테이션의 OBS 접속 정보 전체 초기화 (host / port / password / youtube URL 모두 NULL)."""
    station = await event_service.clear_court_obs_config(db, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="스테이션를 찾을 수 없습니다")
    return APIResponse(data=StationResponse.from_orm_with_mask(station))


@router.get("/{station_id}/stream-key", response_model=APIResponse[dict])
async def get_stream_key(
    station_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """스테이션의 스트림키 원본 반환 (복사용)."""
    from sqlalchemy import select
    from app.models import Station
    result = await db.execute(select(Station).where(Station.id == station_id))
    station = result.scalar_one_or_none()
    if not station:
        raise HTTPException(status_code=404, detail="스테이션을 찾을 수 없습니다")
    return APIResponse(data={"youtube_stream_key": station.youtube_stream_key or ""})


@router.put("/{station_id}/status", response_model=APIResponse[StationResponse])
async def update_court_status(
    station_id: UUID,
    status_data: StationStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """스테이션 상태 갱신 (내부 서비스용)"""
    station = await event_service.update_court_status(db, station_id, status_data.status)
    if not station:
        raise HTTPException(status_code=404, detail="스테이션를 찾을 수 없습니다")
    return APIResponse(data=StationResponse.from_orm_with_mask(station))
