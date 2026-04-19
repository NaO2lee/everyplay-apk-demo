"""OBS 설정 프리셋 CRUD."""

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.preset import ObsPreset
from app.schemas import APIResponse

router = APIRouter(prefix="/presets", tags=["presets"])


class PresetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    obs_host: Optional[str] = None
    obs_port: int = 4455
    obs_password: Optional[str] = None
    youtube_stream_url: Optional[str] = None
    youtube_stream_key: Optional[str] = None
    youtube_offset_seconds: float = 0.0


class PresetResponse(BaseModel):
    id: UUID
    name: str
    obs_host: Optional[str] = None
    obs_port: int = 4455
    obs_password: Optional[str] = None
    youtube_stream_url: Optional[str] = None
    youtube_stream_key: Optional[str] = None  # 프리셋은 원본 반환 (복사용)
    youtube_offset_seconds: float = 0.0

    class Config:
        from_attributes = True


@router.get("", response_model=APIResponse[list])
async def list_presets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ObsPreset).order_by(ObsPreset.name))
    items = result.scalars().all()
    return APIResponse(data=[PresetResponse.model_validate(p) for p in items])


@router.post("", response_model=APIResponse[PresetResponse])
async def create_or_update_preset(
    body: PresetCreate,
    db: AsyncSession = Depends(get_db),
):
    """프리셋 생성. 같은 이름이면 덮어쓰기."""
    result = await db.execute(select(ObsPreset).where(ObsPreset.name == body.name))
    preset = result.scalar_one_or_none()
    if preset:
        preset.obs_host = body.obs_host
        preset.obs_port = body.obs_port
        preset.obs_password = body.obs_password
        preset.youtube_stream_url = body.youtube_stream_url
        preset.youtube_stream_key = body.youtube_stream_key
        preset.youtube_offset_seconds = body.youtube_offset_seconds
    else:
        preset = ObsPreset(**body.model_dump())
        db.add(preset)
    await db.commit()
    await db.refresh(preset)
    return APIResponse(data=PresetResponse.model_validate(preset))


@router.delete("/{preset_id}", response_model=APIResponse[dict])
async def delete_preset(preset_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ObsPreset).where(ObsPreset.id == preset_id))
    preset = result.scalar_one_or_none()
    if not preset:
        raise HTTPException(status_code=404, detail="프리셋을 찾을 수 없습니다")
    await db.delete(preset)
    await db.commit()
    return APIResponse(data={"deleted": True})
