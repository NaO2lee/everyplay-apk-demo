"""Audit 로그 모듈.

QA 테스트 시 핵심 이벤트(히트 시작/종료, OBS 연결, 녹화 시작/중지 등)를
파일에 JSON Lines 형태로 남겨서 사후 검증 가능하게 한다.

파일: /tmp/safety-audit.log (환경변수 AUDIT_LOG_PATH로 변경 가능)
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

AUDIT_LOG_PATH = os.environ.get("AUDIT_LOG_PATH", "/tmp/safety-audit.log")


def log_event(event: str, **fields: Any) -> None:
    """단일 audit 이벤트 기록.

    event: 이벤트 종류 키 (예: heat_start, obs_connect)
    fields: 추가 컨텍스트 (station_id, heat_id 등)
    """
    try:
        record = {
            "ts": datetime.utcnow().isoformat() + "Z",
            "event": event,
            **{k: _safe(v) for k, v in fields.items()},
        }
        Path(AUDIT_LOG_PATH).parent.mkdir(parents=True, exist_ok=True)
        with open(AUDIT_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception:
        pass


def _safe(v: Any) -> Any:
    if v is None or isinstance(v, (str, int, float, bool)):
        return v
    if isinstance(v, datetime):
        return v.isoformat()
    return str(v)
