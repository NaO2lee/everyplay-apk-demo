"""OBS WebSocket 단일 클라이언트 래퍼.

obsws-python 기반. 스테이션 1개당 1개 인스턴스.

주요 기능:
- 연결/해제
- 녹화 시작/중지 + 녹화 파일 경로 수집
- 스트리밍 시작/중지
- 상태 조회 (통계, 드롭 프레임 등)
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class ObsState:
    """런타임 OBS 상태 스냅샷."""
    connected: bool = False
    recording_active: bool = False
    streaming_active: bool = False
    recording_path: Optional[str] = None
    recording_started_at: Optional[datetime] = None
    dropped_frames: int = 0
    bitrate_kbps: float = 0.0
    last_error: Optional[str] = None
    last_updated: datetime = field(default_factory=datetime.utcnow)


class ObsClient:
    """OBS WebSocket 단일 연결 래퍼 (비동기 친화 헬퍼)."""

    def __init__(self, host: str, port: int = 4455, password: Optional[str] = None, station_id: Optional[str] = None):
        self.host = host
        self.port = port
        self.password = password
        self.station_id = station_id
        self.state = ObsState()
        self._client = None  # obsws.ReqClient
        self._lock = asyncio.Lock()
        self._last_bytes: Optional[int] = None
        self._last_bytes_at: Optional[datetime] = None

    # ------------- Connection -------------

    async def connect(self) -> bool:
        """연결 시도. 성공 시 True, 실패 시 False + state.last_error 설정.

        연결 성공 직후 refresh_state 1회 호출해 OBS 실제 상태 즉시 반영.
        """
        async with self._lock:
            try:
                import obsws_python as obs  # type: ignore
            except ImportError:
                self.state.last_error = "obsws-python 미설치"
                logger.error("obsws-python not installed")
                return False

            try:
                self._client = await asyncio.to_thread(
                    obs.ReqClient,
                    host=self.host,
                    port=self.port,
                    password=self.password or "",
                    timeout=5,
                )
                self.state.connected = True
                self.state.last_error = None
                self.state.last_updated = datetime.utcnow()
                self._last_bytes = None
                self._last_bytes_at = None
                logger.info(f"[OBS {self.station_id}] connected {self.host}:{self.port}")
            except Exception as e:
                self.state.connected = False
                self.state.last_error = str(e)
                logger.warning(f"[OBS {self.station_id}] connect failed: {e}")
                return False

        await self.refresh_state()
        return self.state.connected

    async def disconnect(self) -> None:
        async with self._lock:
            if self._client:
                try:
                    await asyncio.to_thread(self._client.disconnect)
                except Exception:
                    pass
            self._client = None
            self.state.connected = False

    # ------------- Recording -------------

    # OBS WebSocket 프로토콜 에러 코드
    # https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md#requeststatus
    _ERR_OUTPUT_RUNNING = 500      # start 시 이미 돌고 있음
    _ERR_OUTPUT_NOT_RUNNING = 501  # stop 시 이미 꺼져 있음

    @staticmethod
    def _error_code(exc: Exception) -> Optional[int]:
        """OBSSDKRequestError 에서 코드 추출. 다른 예외면 None."""
        import re
        msg = str(exc)
        m = re.search(r"code\s+(\d+)", msg)
        return int(m.group(1)) if m else None

    async def start_recording(self) -> Optional[datetime]:
        """녹화 시작. 이미 돌고 있으면 성공으로 간주. 성공 시 현재 시각 반환."""
        if not self._client:
            return None
        try:
            await asyncio.to_thread(self._client.start_record)
        except Exception as e:
            if self._error_code(e) == self._ERR_OUTPUT_RUNNING:
                logger.info(f"[OBS {self.station_id}] start_record: already running — treated as success")
            else:
                self.state.last_error = f"start_record: {e}"
                logger.error(f"[OBS {self.station_id}] start_record failed: {e}")
                return None
        started = datetime.utcnow()
        self.state.recording_active = True
        self.state.recording_started_at = started
        self.state.last_updated = started
        return started

    async def stop_recording(self) -> Optional[str]:
        """녹화 중지. 이미 꺼져 있으면 성공으로 간주. 성공 시 파일 경로(있으면) 반환."""
        if not self._client:
            return None
        path: Optional[str] = None
        try:
            resp = await asyncio.to_thread(self._client.stop_record)
            path = getattr(resp, "output_path", None) if resp else None
        except Exception as e:
            if self._error_code(e) == self._ERR_OUTPUT_NOT_RUNNING:
                logger.info(f"[OBS {self.station_id}] stop_record: already stopped — treated as success")
            else:
                self.state.last_error = f"stop_record: {e}"
                logger.error(f"[OBS {self.station_id}] stop_record failed: {e}")
                return None
        self.state.recording_active = False
        if path:
            self.state.recording_path = path
        self.state.last_updated = datetime.utcnow()
        return path or ""

    # ------------- Streaming -------------

    async def start_streaming(self) -> bool:
        """방송 시작. 이미 돌고 있으면 성공으로 간주."""
        if not self._client:
            return False
        try:
            await asyncio.to_thread(self._client.start_stream)
        except Exception as e:
            if self._error_code(e) == self._ERR_OUTPUT_RUNNING:
                logger.info(f"[OBS {self.station_id}] start_stream: already running — treated as success")
            else:
                self.state.last_error = f"start_stream: {e}"
                logger.error(f"[OBS {self.station_id}] start_stream failed: {e}")
                return False
        self.state.streaming_active = True
        self.state.last_updated = datetime.utcnow()
        return True

    async def stop_streaming(self) -> bool:
        """방송 중지. 이미 꺼져 있으면 성공으로 간주."""
        if not self._client:
            return False
        try:
            await asyncio.to_thread(self._client.stop_stream)
        except Exception as e:
            if self._error_code(e) == self._ERR_OUTPUT_NOT_RUNNING:
                logger.info(f"[OBS {self.station_id}] stop_stream: already stopped — treated as success")
            else:
                self.state.last_error = f"stop_stream: {e}"
                logger.error(f"[OBS {self.station_id}] stop_stream failed: {e}")
                return False
        self.state.streaming_active = False
        self.state.last_updated = datetime.utcnow()
        return True

    # ------------- Timecode -------------

    async def get_record_timecode(self) -> Optional[float]:
        """현재 녹화 파일의 내부 경과 시간(초). 녹화 중 아니거나 실패 시 None."""
        if not self._client:
            return None
        try:
            rec = await asyncio.to_thread(self._client.get_record_status)
        except Exception as e:
            logger.warning(f"[OBS {self.station_id}] get_record_timecode failed: {e}")
            return None
        if not bool(getattr(rec, "output_active", False)):
            return None
        duration_ms = getattr(rec, "output_duration", None)
        if duration_ms is None:
            return None
        try:
            return float(duration_ms) / 1000.0
        except (TypeError, ValueError):
            return None

    async def get_video_settings(self) -> Optional[dict]:
        """OBS 출력 해상도 조회. {"width": 1920, "height": 1080} 반환."""
        if not self._client:
            return None
        try:
            vs = await asyncio.to_thread(self._client.get_video_settings)
            w = getattr(vs, "output_width", None) or getattr(vs, "base_width", None)
            h = getattr(vs, "output_height", None) or getattr(vs, "base_height", None)
            if w and h:
                return {"width": int(w), "height": int(h)}
        except Exception as e:
            logger.warning(f"[OBS {self.station_id}] get_video_settings failed: {e}")
        return None

    async def get_stream_timecode(self) -> Optional[float]:
        """현재 스트리밍 내부 경과 시간(초). 방송 중 아니거나 실패 시 None.

        유튜브 VOD 타임스탬프 계산용 기준. OBS 내부 스트림 시계를 그대로 사용하므로
        서버 시계와 무관.
        """
        if not self._client:
            return None
        try:
            st = await asyncio.to_thread(self._client.get_stream_status)
        except Exception as e:
            logger.warning(f"[OBS {self.station_id}] get_stream_timecode failed: {e}")
            return None
        if not bool(getattr(st, "output_active", False)):
            return None
        duration_ms = getattr(st, "output_duration", None)
        if duration_ms is None:
            return None
        try:
            return float(duration_ms) / 1000.0
        except (TypeError, ValueError):
            return None

    # ------------- Stats -------------

    async def refresh_state(self) -> None:
        """OBS 에서 녹화/스트리밍 상태를 직접 조회해 메모리 스냅샷을 동기화.

        호출 순서:
          1) GetRecordStatus → 녹화 on/off, 경과 시간
          2) GetStreamStatus → 스트리밍 on/off, 누적 송출 바이트, 드롭 프레임
          3) GetStats → 렌더 드롭 프레임 (보조)

        출력 바이트 증분으로 실제 송출 비트레이트(kbps) 계산.
        연결이 끊긴 경우 connected=False 로 전환하고 필드 초기화.
        """
        if not self._client:
            return
        try:
            rec = await asyncio.to_thread(self._client.get_record_status)
            stream = await asyncio.to_thread(self._client.get_stream_status)
            stats = await asyncio.to_thread(self._client.get_stats)
        except Exception as e:
            self.state.connected = False
            self.state.last_error = f"refresh: {e}"
            logger.warning(f"[OBS {self.station_id}] refresh failed: {e}")
            self._client = None
            return

        now = datetime.utcnow()

        self.state.recording_active = bool(getattr(rec, "output_active", False))
        rec_path = getattr(rec, "output_path", None)
        if rec_path:
            self.state.recording_path = rec_path

        streaming = bool(getattr(stream, "output_active", False))
        self.state.streaming_active = streaming

        current_bytes = int(getattr(stream, "output_bytes", 0) or 0)
        if streaming and self._last_bytes is not None and self._last_bytes_at is not None:
            elapsed = (now - self._last_bytes_at).total_seconds()
            delta = current_bytes - self._last_bytes
            if elapsed > 0 and delta >= 0:
                self.state.bitrate_kbps = round(delta * 8 / 1000 / elapsed, 1)
        elif not streaming:
            self.state.bitrate_kbps = 0.0
        self._last_bytes = current_bytes
        self._last_bytes_at = now

        skipped = getattr(stream, "output_skipped_frames", None)
        if skipped is None:
            skipped = getattr(stats, "output_skipped_frames", 0)
        self.state.dropped_frames = int(skipped or 0)

        self.state.connected = True
        self.state.last_error = None
        self.state.last_updated = now
