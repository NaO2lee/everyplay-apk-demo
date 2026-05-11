"""운영위원/중계자 라우터 (v3.3 신규).

엔드포인트:
- GET  /operator/no-shows                최근 N분 호명 큐 (audit_log 기반)
- POST /operator/no-shows/{id}/handled   처리 완료 표시 (audit_log 추가)
- GET  /operator/matrix                  심판×히트 제출 매트릭스 (alias for /judge/submissions/matrix)

후속:
- POST /operator/announce/start          TTS 호명 트리거 (Phase 3에서 ElevenLabs 연동)
- SSE /operator/stream                   대시보드 실시간 갱신 (Phase 3)
"""

from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import (
    ROLE_ADMIN,
    ROLE_OPERATOR,
    TokenData,
    require_role,
)
from app.core.database import get_db
from app.models import AuditLog, Rerun
from app.schemas import APIResponse

router = APIRouter(prefix="/operator", tags=["operator"])


class NoShowItem(BaseModel):
    audit_id: UUID
    actor_id: UUID | None
    actor_role: str | None
    target_id: UUID | None
    heat_id: str | None
    note: str | None
    timestamp: datetime
    handled: bool = False


@router.get("/no-shows", response_model=APIResponse[list[NoShowItem]])
async def list_no_shows(
    minutes: int = Query(60, ge=1, le=1440, description="조회 범위(분)"),
    td: TokenData = Depends(require_role(ROLE_OPERATOR, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """최근 N분 안에 발생한 '안왔음' 호출. 처리 완료된 항목 표시 포함."""
    since = datetime.utcnow() - timedelta(minutes=minutes)

    # no_show_called 이벤트 조회
    res = await db.execute(
        select(AuditLog).where(
            and_(
                AuditLog.action_type == "no_show_called",
                AuditLog.timestamp >= since,
            )
        ).order_by(AuditLog.timestamp.desc())
    )
    calls = res.scalars().all()

    # handled 표시 조회 (target_id가 같은 no_show_handled가 같은 시각 이후 있으면 처리됨)
    res2 = await db.execute(
        select(AuditLog).where(
            and_(
                AuditLog.action_type == "no_show_handled",
                AuditLog.timestamp >= since,
            )
        )
    )
    handled = {a.target_id for a in res2.scalars().all() if a.target_id}

    items = []
    for c in calls:
        after = c.after_value or {}
        items.append(NoShowItem(
            audit_id=c.id,
            actor_id=c.actor_id,
            actor_role=c.actor_role,
            target_id=c.target_id,
            heat_id=after.get("heat_id"),
            note=c.reason,
            timestamp=c.timestamp,
            handled=(c.target_id in handled) if c.target_id else False,
        ))

    return APIResponse(data=items)


@router.post("/no-shows/{audit_id}/handled", response_model=APIResponse[dict])
async def mark_handled(
    audit_id: UUID,
    td: TokenData = Depends(require_role(ROLE_OPERATOR, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """호명 처리 완료 표시. 대상 audit log에서 target_id 가져와 새 audit log 추가."""
    res = await db.execute(select(AuditLog).where(AuditLog.id == audit_id))
    src = res.scalar_one_or_none()
    if not src or src.action_type != "no_show_called":
        raise HTTPException(status_code=404, detail="해당 호명 기록을 찾을 수 없습니다")

    from app.api.v1.judge import _to_uuid
    op_uuid = _to_uuid(td.user_id)
    log = AuditLog(
        actor_id=op_uuid,
        actor_role=td.role,
        action_type="no_show_handled",
        target_type=src.target_type,
        target_id=src.target_id,
        after_value={"original_audit_id": str(src.id)},
        timestamp=datetime.utcnow(),
    )
    db.add(log)
    await db.commit()

    return APIResponse(data={"handled": True, "audit_id": str(log.id)})


# ─── 재진행(Rerun) 승인 큐 ────────────────────────────────────

@router.get("/reruns/pending", response_model=APIResponse[list[dict]])
async def list_pending_reruns(
    td: TokenData = Depends(require_role(ROLE_OPERATOR, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """승인 대기 중인 rerun (rerun_started_at IS NULL)."""
    res = await db.execute(
        select(Rerun).where(Rerun.rerun_started_at.is_(None)).order_by(Rerun.created_at.desc())
    )
    items = res.scalars().all()
    return APIResponse(data=[
        {
            "id": str(r.id),
            "heat_id": str(r.heat_id),
            "participant_id": str(r.participant_id),
            "reason_code": r.reason_code,
            "reason_text": r.reason_text,
            "requested_at": r.created_at.isoformat(),
        } for r in items
    ])


@router.post("/reruns/{rerun_id}/approve", response_model=APIResponse[dict])
async def approve_rerun(
    rerun_id: UUID,
    td: TokenData = Depends(require_role(ROLE_OPERATOR, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """운영자 30초 안 승인 → rerun_started_at 기록 → audit log."""
    res = await db.execute(select(Rerun).where(Rerun.id == rerun_id))
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="rerun 찾을 수 없음")
    if r.rerun_started_at is not None:
        raise HTTPException(status_code=400, detail="이미 승인됨")

    from app.api.v1.judge import _to_uuid
    op_uuid = _to_uuid(td.user_id)
    r.approved_by_operator_id = op_uuid
    r.rerun_started_at = datetime.utcnow()

    db.add(AuditLog(
        actor_id=op_uuid, actor_role=td.role,
        action_type="rerun_approved", target_type="rerun", target_id=r.id,
        after_value={"approved_at": r.rerun_started_at.isoformat()},
        timestamp=datetime.utcnow(),
    ))
    await db.commit()
    return APIResponse(data={"approved": True, "rerun_started_at": r.rerun_started_at.isoformat()})


@router.delete("/reruns/{rerun_id}", response_model=APIResponse[dict])
async def cancel_rerun(
    rerun_id: UUID,
    reason: str | None = None,
    td: TokenData = Depends(require_role(ROLE_OPERATOR, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """대기 중 rerun 취소. 이미 승인된 (rerun_started_at not null)는 admin만."""
    res = await db.execute(select(Rerun).where(Rerun.id == rerun_id))
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="rerun not found")
    if r.rerun_started_at is not None and td.role != ROLE_ADMIN:
        raise HTTPException(status_code=400, detail="이미 승인된 rerun은 admin만 취소 가능")

    from app.api.v1.judge import _to_uuid
    db.add(AuditLog(
        actor_id=_to_uuid(td.user_id), actor_role=td.role,
        action_type="rerun_cancelled", target_type="rerun", target_id=r.id,
        before_value={"heat_id": str(r.heat_id), "reason_code": r.reason_code, "approved": r.rerun_started_at is not None},
        reason=reason or "취소 (사유 없음)",
        timestamp=datetime.utcnow(),
    ))
    await db.delete(r)
    await db.commit()
    return APIResponse(data={"deleted": True, "rerun_id": str(rerun_id)})


# ─── Audit Log 조회 (관리자용) ────────────────────────────────

@router.get("/audit-logs", response_model=APIResponse[list[dict]])
async def list_audit_logs(
    action_type: str | None = None,
    target_type: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    td: TokenData = Depends(require_role(ROLE_OPERATOR, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """모든 audit log 조회 (시간 역순). action_type/target_type으로 필터."""
    q = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
    if action_type:
        q = q.where(AuditLog.action_type == action_type)
    if target_type:
        q = q.where(AuditLog.target_type == target_type)
    res = await db.execute(q)
    logs = res.scalars().all()
    return APIResponse(data=[
        {
            "id": str(l.id),
            "actor_id": str(l.actor_id) if l.actor_id else None,
            "actor_role": l.actor_role,
            "action_type": l.action_type,
            "target_type": l.target_type,
            "target_id": str(l.target_id) if l.target_id else None,
            "before_value": l.before_value,
            "after_value": l.after_value,
            "reason": l.reason,
            "ip_address": l.ip_address,
            "timestamp": l.timestamp.isoformat(),
        } for l in logs
    ])
