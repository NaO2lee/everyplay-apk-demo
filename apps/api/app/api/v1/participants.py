from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
import csv
import io

from app.core.database import get_db
from app.schemas import (
    APIResponse,
    ParticipantCreate,
    ParticipantUpdate,
    ParticipantResponse,
    ParticipantListResponse,
    BulkImportResult,
)
from app.services import participant_service

router = APIRouter(prefix="/events/{event_id}/participants", tags=["participants"])


@router.post("", response_model=APIResponse[ParticipantResponse])
async def create_participant(
    event_id: UUID,
    participant_data: ParticipantCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new participant"""
    participant = await participant_service.create_participant(
        db, event_id, participant_data
    )
    return APIResponse(data=ParticipantResponse.from_orm_with_mask(participant))


@router.get("", response_model=APIResponse[ParticipantListResponse])
async def list_participants(
    event_id: UUID,
    q: Optional[str] = None,
    team: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(20, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List participants for an event"""
    participants, total = await participant_service.get_participants(
        db, event_id, q, team, skip, limit
    )
    return APIResponse(
        data=ParticipantListResponse(
            items=[ParticipantResponse.from_orm_with_mask(p) for p in participants],
            total=total,
        )
    )


@router.get("/{participant_id}", response_model=APIResponse[ParticipantResponse])
async def get_participant(
    event_id: UUID,
    participant_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get participant details"""
    participant = await participant_service.get_participant(db, participant_id)
    if not participant or participant.event_id != event_id:
        raise HTTPException(status_code=404, detail="Participant not found")
    return APIResponse(data=ParticipantResponse.from_orm_with_mask(participant))


@router.patch("/{participant_id}", response_model=APIResponse[ParticipantResponse])
async def update_participant(
    event_id: UUID,
    participant_id: UUID,
    participant_data: ParticipantUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update participant"""
    participant = await participant_service.get_participant(db, participant_id)
    if not participant or participant.event_id != event_id:
        raise HTTPException(status_code=404, detail="Participant not found")
    
    updated = await participant_service.update_participant(
        db, participant_id, participant_data
    )
    return APIResponse(data=ParticipantResponse.from_orm_with_mask(updated))


@router.delete("/{participant_id}", response_model=APIResponse[dict])
async def delete_participant(
    event_id: UUID,
    participant_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete participant"""
    participant = await participant_service.get_participant(db, participant_id)
    if not participant or participant.event_id != event_id:
        raise HTTPException(status_code=404, detail="Participant not found")
    
    await participant_service.delete_participant(db, participant_id)
    return APIResponse(data={"deleted": True})


MAX_CSV_BYTES = 5 * 1024 * 1024  # 5 MB (~수만 row)
MAX_CSV_ROWS = 10000


@router.post("/bulk", response_model=APIResponse[BulkImportResult])
async def bulk_import_participants(
    event_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Bulk import participants from CSV"""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="CSV 파일만 업로드 가능합니다")

    content = await file.read()
    if len(content) > MAX_CSV_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"파일이 너무 큽니다 ({len(content) / 1024 / 1024:.1f} MB). 최대 {MAX_CSV_BYTES // 1024 // 1024} MB 허용",
        )

    try:
        decoded = content.decode("utf-8-sig")  # Handle BOM
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV 인코딩은 UTF-8 이어야 합니다")

    reader = csv.DictReader(io.StringIO(decoded))
    
    # Map Korean headers to English
    header_map = {
        "이름": "name",
        "연락처": "phone",
        "소속": "team",
        "종별": "category",
    }
    
    participants_data = []
    for row in reader:
        if len(participants_data) >= MAX_CSV_ROWS:
            raise HTTPException(
                status_code=413,
                detail=f"행 개수 너무 많음 (최대 {MAX_CSV_ROWS}행)",
            )
        mapped_row = {}
        for k, v in row.items():
            key = header_map.get(k, k)
            mapped_row[key] = v
        participants_data.append(mapped_row)
    
    imported, failed, errors = await participant_service.bulk_create_participants(
        db, event_id, participants_data
    )
    
    return APIResponse(
        data=BulkImportResult(
            imported=imported,
            failed=failed,
            errors=errors,
        )
    )


MAX_PDF_BYTES = 30 * 1024 * 1024  # 30 MB


@router.post("/import-pdf", response_model=APIResponse[BulkImportResult])
async def import_participants_pdf(
    event_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """대진표 PDF 에서 참가자 추출 후 일괄 등록.

    한국어/영어 이름 패턴을 매칭. 휴대전화는 PDF에 없으면 dummy 값(`pdf-NNNN`)으로 채움.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다")

    content = await file.read()
    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"파일이 너무 큽니다 ({len(content)/1024/1024:.1f} MB). 최대 {MAX_PDF_BYTES//1024//1024} MB",
        )

    imported, failed, errors = await participant_service.import_from_pdf(db, event_id, content)

    return APIResponse(
        data=BulkImportResult(
            imported=imported,
            failed=failed,
            errors=errors,
        )
    )
