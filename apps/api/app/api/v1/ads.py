"""광고 그리드 API (관리자 전용).

전역 그리드 설정 + 슬롯 매핑 CRUD.
공개 조회는 public.py 의 `/public/ads/grid`.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas import (
    APIResponse,
    AdSettingResponse,
    AdSettingUpdate,
    AdSlotCreate,
    AdSlotUpdate,
    AdSlotResponse,
    AdSlotListResponse,
)
from app.services import ad_service

router = APIRouter(tags=["ads"])


@router.get("/ads/settings", response_model=APIResponse[AdSettingResponse])
async def get_ad_settings(db: AsyncSession = Depends(get_db)):
    row = await ad_service.get_settings(db)
    return APIResponse(data=AdSettingResponse.model_validate(row))


@router.patch("/ads/settings", response_model=APIResponse[AdSettingResponse])
async def update_ad_settings(data: AdSettingUpdate, db: AsyncSession = Depends(get_db)):
    row = await ad_service.update_settings(db, data)
    return APIResponse(data=AdSettingResponse.model_validate(row))


@router.get("/ads/slots", response_model=APIResponse[AdSlotListResponse])
async def list_ad_slots(only_active: bool = False, db: AsyncSession = Depends(get_db)):
    rows = await ad_service.list_slots(db, only_active=only_active)
    return APIResponse(data=AdSlotListResponse(
        items=[AdSlotResponse.model_validate(r) for r in rows],
        total=len(rows),
    ))


@router.post("/ads/slots", response_model=APIResponse[AdSlotResponse])
async def create_ad_slot(data: AdSlotCreate, db: AsyncSession = Depends(get_db)):
    row = await ad_service.create_slot(db, data)
    return APIResponse(data=AdSlotResponse.model_validate(row))


@router.patch("/ads/slots/{slot_id}", response_model=APIResponse[AdSlotResponse])
async def update_ad_slot(slot_id: UUID, data: AdSlotUpdate, db: AsyncSession = Depends(get_db)):
    row = await ad_service.update_slot(db, slot_id, data)
    if row is None:
        raise HTTPException(status_code=404, detail="Slot not found")
    return APIResponse(data=AdSlotResponse.model_validate(row))


@router.delete("/ads/slots/{slot_id}", response_model=APIResponse[dict])
async def delete_ad_slot(slot_id: UUID, db: AsyncSession = Depends(get_db)):
    ok = await ad_service.delete_slot(db, slot_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Slot not found")
    return APIResponse(data={"ok": True})
