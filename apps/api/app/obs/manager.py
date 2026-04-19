"""스테이션별 ObsClient 인스턴스 관리자 (싱글턴).

- 모든 스테이션의 OBS 접속 정보를 DB에서 로드
- 각 스테이션별 ObsClient 생성 및 연결
- 이벤트 단위 일괄 제어 (운영 시작/종료)
- 연결된 클라이언트 상태 주기 폴링
"""

from __future__ import annotations

import asyncio
import logging
from typing import Dict, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.obs.client import ObsClient

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 3.0
# OBS 연결 끊김 후 이 시간(초) 이상 지나면 해당 스테이션의 active 히트를 자동 종료
ZOMBIE_HEAT_TIMEOUT_SECONDS = 30.0


class ObsManager:
    """스테이션 ID → ObsClient 매핑 관리."""

    def __init__(self):
        self._clients: Dict[str, ObsClient] = {}
        self._poller_task: Optional[asyncio.Task] = None
        # 스테이션별 연결 끊김 최초 감지 시각 (좀비 히트 타임아웃 계산용)
        self._disconnect_since: Dict[str, float] = {}

    def get(self, station_id: UUID) -> Optional[ObsClient]:
        return self._clients.get(str(station_id))

    def register(self, station_id: UUID, host: str, port: int, password: Optional[str]) -> ObsClient:
        key = str(station_id)
        if key in self._clients:
            existing = self._clients[key]
            if existing.host == host and existing.port == port and existing.password == password:
                return existing
            # 설정 변경된 경우 재연결 필요
            logger.info(f"[OBS {station_id}] config changed, replacing client")
        client = ObsClient(host=host, port=port, password=password, station_id=key)
        self._clients[key] = client
        return client

    def remove(self, station_id: UUID) -> None:
        self._clients.pop(str(station_id), None)

    def all_clients(self):
        return list(self._clients.values())

    async def connect_all(self) -> Dict[str, bool]:
        """등록된 모든 클라이언트 연결 시도. 결과 dict 반환."""
        results = {}
        for key, client in self._clients.items():
            ok = await client.connect()
            results[key] = ok
        return results

    async def disconnect_all(self) -> None:
        for client in self._clients.values():
            await client.disconnect()

    async def _poll_loop(self) -> None:
        """주기적으로 연결된 클라이언트 상태 폴링 + 좀비 히트 자동 종료."""
        import time
        logger.info(f"OBS poller started (interval={POLL_INTERVAL_SECONDS}s)")
        try:
            while True:
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
                clients = list(self._clients.items())
                for key, client in clients:
                    if not client.state.connected:
                        # 끊김 시각 기록
                        if key not in self._disconnect_since:
                            self._disconnect_since[key] = time.monotonic()
                            logger.info(f"[OBS {key}] disconnected — tracking for zombie heat timeout")
                        elif time.monotonic() - self._disconnect_since[key] >= ZOMBIE_HEAT_TIMEOUT_SECONDS:
                            # 타임아웃 초과 — 해당 스테이션의 active 히트 자동 종료
                            await self._auto_end_zombie_heats(key)
                            self._disconnect_since.pop(key, None)
                        continue
                    # 연결 복구됨 — 끊김 추적 제거
                    self._disconnect_since.pop(key, None)
                    try:
                        await client.refresh_state()
                    except Exception as e:
                        logger.debug(f"[OBS {client.station_id}] poll error: {e}")
        except asyncio.CancelledError:
            logger.info("OBS poller stopped")
            raise

    async def _auto_end_zombie_heats(self, station_id: str) -> None:
        """OBS 연결이 일정 시간 이상 끊긴 스테이션의 active 히트를 자동 종료."""
        try:
            from app.core.database import async_session
            from sqlalchemy import select, update
            from app.models import Heat, HeatStatus
            from datetime import datetime

            async with async_session() as db:
                result = await db.execute(
                    select(Heat).where(
                        Heat.station_id == station_id,
                        Heat.status == HeatStatus.ACTIVE,
                    )
                )
                zombie_heats = result.scalars().all()
                if not zombie_heats:
                    return
                now = datetime.utcnow()
                for heat in zombie_heats:
                    heat.status = HeatStatus.COMPLETED
                    heat.ended_at = now
                    logger.warning(
                        f"[OBS {station_id}] auto-ended zombie heat #{heat.heat_number} "
                        f"(OBS disconnected for >{ZOMBIE_HEAT_TIMEOUT_SECONDS}s)"
                    )
                await db.commit()
        except Exception as e:
            logger.error(f"[OBS {station_id}] failed to auto-end zombie heats: {e}")

    def start_poller(self) -> None:
        if self._poller_task and not self._poller_task.done():
            return
        self._poller_task = asyncio.create_task(self._poll_loop())

    async def stop_poller(self) -> None:
        if self._poller_task and not self._poller_task.done():
            self._poller_task.cancel()
            try:
                await self._poller_task
            except asyncio.CancelledError:
                pass
        self._poller_task = None


_manager: Optional[ObsManager] = None


def get_obs_manager() -> ObsManager:
    global _manager
    if _manager is None:
        _manager = ObsManager()
    return _manager


async def load_clients_from_db(db: AsyncSession) -> int:
    """DB의 모든 스테이션에 대해 OBS 설정이 있으면 클라이언트 등록. 등록된 수 반환."""
    from sqlalchemy import select
    from app.models import Station

    mgr = get_obs_manager()
    result = await db.execute(select(Station).where(Station.obs_host.isnot(None)))
    stations_list = result.scalars().all()
    count = 0
    for c in stations_list:
        if c.obs_host:
            mgr.register(c.id, c.obs_host, c.obs_port or 4455, c.obs_password)
            count += 1
    return count
