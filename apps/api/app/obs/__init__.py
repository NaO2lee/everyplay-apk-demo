"""OBS WebSocket 통합 모듈.

OBS Studio 28+ 내장 WebSocket(v5.x) 기반.
코트별 OBS 인스턴스 제어: 녹화 시작/중지, 스트리밍 시작/중지, 상태 조회.

주요 의존성: obsws-python
"""

from app.obs.client import ObsClient
from app.obs.manager import ObsManager, get_obs_manager

__all__ = ["ObsClient", "ObsManager", "get_obs_manager"]
