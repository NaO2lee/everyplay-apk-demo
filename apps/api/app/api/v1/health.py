"""Health + QA audit endpoints.

QA 테스트 시 사후에 상태를 검증하기 위한 심층 상태 엔드포인트 포함.
"""

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Event, Station, Heat, Participant, Notification
from app.obs import get_obs_manager

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Basic health check."""
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy" if db_status == "connected" else "unhealthy",
        "database": db_status,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/health/deep")
async def deep_health(db: AsyncSession = Depends(get_db)):
    """심층 상태 스냅샷 — QA 테스트 사후 검증용.

    DB 카운트, OBS 클라이언트 상태, 최근 활동 등 한 번에 수집.
    """
    try:
        events_count = (await db.execute(select(func.count(Event.id)))).scalar() or 0
        courts_count = (await db.execute(select(func.count(Station.id)))).scalar() or 0
        heats_count = (await db.execute(select(func.count(Heat.id)))).scalar() or 0
        participants_count = (await db.execute(select(func.count(Participant.id)))).scalar() or 0
        notifications_count = (await db.execute(select(func.count(Notification.id)))).scalar() or 0

        recent_events_result = await db.execute(
            select(Event.id, Event.name, Event.event_code, Event.status, Event.created_at)
            .order_by(Event.created_at.desc())
            .limit(5)
        )
        recent_events = [
            {
                "id": str(row.id),
                "name": row.name,
                "event_code": row.event_code,
                "status": row.status.value if hasattr(row.status, "value") else str(row.status),
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in recent_events_result.fetchall()
        ]

        configured_stations_result = await db.execute(
            select(Station.id, Station.station_number, Station.obs_host, Station.obs_port, Station.status,
                   Station.recording_path, Station.recording_started_at)
            .where(Station.obs_host.isnot(None))
        )
        configured_stations = [
            {
                "id": str(row.id),
                "station_number": row.station_number,
                "obs_host": row.obs_host,
                "obs_port": row.obs_port,
                "status": row.status.value if hasattr(row.status, "value") else str(row.status),
                "recording_path": row.recording_path,
                "recording_started_at": row.recording_started_at.isoformat() if row.recording_started_at else None,
            }
            for row in configured_stations_result.fetchall()
        ]

        recent_heats_result = await db.execute(
            select(Heat.id, Heat.station_id, Heat.heat_number, Heat.status,
                   Heat.started_at, Heat.ended_at,
                   Heat.recording_offset_start, Heat.recording_offset_end,
                   Heat.clip_status, Heat.clip_path)
            .order_by(Heat.started_at.desc())
            .limit(10)
        )
        recent_heats = [
            {
                "id": str(row.id),
                "station_id": str(row.station_id),
                "heat_number": row.heat_number,
                "status": row.status.value if hasattr(row.status, "value") else str(row.status),
                "started_at": row.started_at.isoformat() if row.started_at else None,
                "ended_at": row.ended_at.isoformat() if row.ended_at else None,
                "recording_offset_start": row.recording_offset_start,
                "recording_offset_end": row.recording_offset_end,
                "clip_status": row.clip_status,
                "clip_path": row.clip_path,
            }
            for row in recent_heats_result.fetchall()
        ]

        clip_stats_result = await db.execute(
            select(Heat.clip_status, func.count(Heat.id))
            .group_by(Heat.clip_status)
        )
        clip_stats = {row[0] or "none": row[1] for row in clip_stats_result.fetchall()}

        db_ok = True
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }

    obs_mgr = get_obs_manager()
    obs_snapshots = []
    for client in obs_mgr.all_clients():
        obs_snapshots.append({
            "station_id": client.station_id,
            "host": client.host,
            "port": client.port,
            "connected": client.state.connected,
            "recording": client.state.recording_active,
            "streaming": client.state.streaming_active,
            "recording_path": client.state.recording_path,
            "recording_started_at": client.state.recording_started_at.isoformat() if client.state.recording_started_at else None,
            "dropped_frames": client.state.dropped_frames,
            "last_error": client.state.last_error,
            "last_updated": client.state.last_updated.isoformat() if client.state.last_updated else None,
        })

    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "db": {
            "ok": db_ok,
            "counts": {
                "events": events_count,
                "stations": courts_count,
                "heats": heats_count,
                "participants": participants_count,
                "notifications": notifications_count,
            },
            "recent_events": recent_events,
            "configured_stations": configured_stations,
            "recent_heats": recent_heats,
            "clip_stats": clip_stats,
        },
        "obs": {
            "registered_clients": len(obs_snapshots),
            "snapshots": obs_snapshots,
        },
    }
