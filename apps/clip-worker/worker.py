#!/usr/bin/env python3
"""클립 추출 워커 — HTTP API 기반.

DB 직접 접속 없이 백엔드 API 만 호출하여 동작.
각 OBS PC 에서 실행. PyInstaller 로 exe 빌드 가능.

플로우:
1. 서버 로그인 → 토큰 획득
2. GET /worker/heats/pending → 자를 히트 목록
3. POST /worker/heats/{id}/claim → 선점 (pending → processing)
4. ffmpeg 로 로컬 녹화 파일에서 구간 추출
5. POST /worker/heats/{id}/clip-complete → 결과 보고

설정: config.ini 또는 환경변수
"""

from __future__ import annotations

import asyncio
import configparser
import json
import logging
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("clip-worker")

# ── 설정 로드 ──

def load_config() -> dict:
    """config.ini 또는 환경변수에서 설정 로드."""
    cfg = {
        "api_url": os.environ.get("API_URL", "http://localhost:20002/api/v1"),
        "admin_username": os.environ.get("ADMIN_USERNAME", "admin"),
        "admin_password": os.environ.get("ADMIN_PASSWORD", "admin"),
        "station_id": os.environ.get("STATION_ID", ""),
        "output_dir": os.environ.get("CLIP_OUTPUT_DIR", "./clips"),
        "poll_interval": int(os.environ.get("POLL_INTERVAL", "5")),
        "ffmpeg_path": os.environ.get("FFMPEG_PATH", "ffmpeg"),
    }

    config_path = Path(os.path.dirname(os.path.abspath(__file__))) / "config.ini"
    if config_path.exists():
        parser = configparser.ConfigParser()
        parser.read(str(config_path), encoding="utf-8")
        if parser.has_section("server"):
            cfg["api_url"] = parser.get("server", "api_url", fallback=cfg["api_url"])
            cfg["admin_username"] = parser.get("server", "admin_username", fallback=cfg["admin_username"])
            cfg["admin_password"] = parser.get("server", "admin_password", fallback=cfg["admin_password"])
        if parser.has_section("worker"):
            cfg["station_id"] = parser.get("worker", "station_id", fallback=cfg["station_id"])
            cfg["output_dir"] = parser.get("worker", "output_dir", fallback=cfg["output_dir"])
            cfg["poll_interval"] = parser.getint("worker", "poll_interval", fallback=cfg["poll_interval"])
            cfg["ffmpeg_path"] = parser.get("worker", "ffmpeg_path", fallback=cfg["ffmpeg_path"])

    return cfg


# ── HTTP 헬퍼 ──

class ApiClient:
    """백엔드 API 호출 (urllib — 외부 의존성 없음)."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.token: str | None = None

    def _request(self, method: str, path: str, body: dict | None = None) -> dict:
        url = f"{self.base_url}{path}"
        data = json.dumps(body).encode("utf-8") if body else None
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body_text = e.read().decode("utf-8", errors="replace")[:500]
            raise RuntimeError(f"HTTP {e.code} {method} {path}: {body_text}") from e

    def login(self, username: str, password: str) -> bool:
        try:
            result = self._request("POST", "/auth/login", {"username": username, "password": password})
            self.token = result.get("data", {}).get("token")
            return bool(self.token)
        except Exception as e:
            logger.error(f"로그인 실패: {e}")
            return False

    def get_pending_heats(self, station_id: str = "") -> list[dict]:
        path = "/worker/heats/pending"
        if station_id:
            path += f"?station_id={station_id}"
        result = self._request("GET", path)
        return result.get("data", [])

    def claim_heat(self, heat_id: str) -> bool:
        try:
            self._request("POST", f"/worker/heats/{heat_id}/claim")
            return True
        except RuntimeError as e:
            if "409" in str(e):
                logger.info(f"[{heat_id}] 이미 다른 워커가 선점함")
            else:
                logger.error(f"[{heat_id}] claim 실패: {e}")
            return False

    def report_complete(self, heat_id: str, clip_path: str | None, status: str, error: str = "") -> bool:
        try:
            self._request("POST", f"/worker/heats/{heat_id}/clip-complete", {
                "clip_path": clip_path,
                "clip_status": status,
                "error_message": error,
            })
            return True
        except Exception as e:
            logger.error(f"[{heat_id}] 결과 보고 실패: {e}")
            return False


# ── 클립 추출 ──

def extract_clip(heat: dict, output_dir: Path, ffmpeg_path: str) -> tuple[bool, str, str]:
    """ffmpeg 로 클립 추출. (성공여부, 출력경로, 에러메시지) 반환."""
    recording_path = heat.get("recording_path")
    if not recording_path:
        return False, "", "녹화 파일 경로 없음"

    # 타임코드 우선순위: OBS 직접 > 서버 시계 오프셋
    start_tc = heat.get("obs_timecode_start") or heat.get("recording_offset_start")
    end_tc = heat.get("obs_timecode_end") or heat.get("recording_offset_end")

    if start_tc is None or end_tc is None:
        return False, "", "오프셋 없음"

    start = max(0.0, float(start_tc) - 2.0)
    duration = max(1.0, float(end_tc) - float(start_tc) + 4.0)

    output_dir.mkdir(parents=True, exist_ok=True)

    # 파일명: station{N}_heat{N}_{선수명들}_{타임스탬프}.mp4
    station_num = heat.get("station_number", 0)
    heat_num = heat.get("heat_number", 0)
    names = "_".join(heat.get("participant_names", [])[:3]) or "no_name"
    # 파일명에 사용 불가 문자 제거
    safe_names = "".join(c for c in names if c not in r'\/:*?"<>|')[:60]
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_name = f"station{station_num}_heat{heat_num}_{safe_names}_{ts}.mp4"
    out_path = output_dir / out_name

    cmd = [
        ffmpeg_path,
        "-y",
        "-ss", f"{start:.2f}",
        "-t", f"{duration:.2f}",
        "-i", recording_path,
        "-c", "copy",
        "-movflags", "+faststart",
        str(out_path),
    ]

    logger.info(f"[heat {heat.get('id')}] ffmpeg: ss={start:.1f} t={duration:.1f} src={recording_path}")
    try:
        proc = __import__("subprocess").run(
            cmd,
            capture_output=True,
            timeout=120,
        )
        if proc.returncode == 0 and out_path.exists():
            logger.info(f"[heat {heat.get('id')}] 클립 생성: {out_path}")
            return True, str(out_path), ""
        else:
            err = proc.stderr.decode("utf-8", errors="replace")[:500]
            logger.error(f"[heat {heat.get('id')}] ffmpeg 실패: {err}")
            return False, "", err
    except Exception as e:
        logger.exception(f"[heat {heat.get('id')}] 예외: {e}")
        return False, "", str(e)[:500]


# ── 메인 루프 ──

def main():
    cfg = load_config()
    output_dir = Path(cfg["output_dir"])
    station_id = cfg["station_id"].strip()

    logger.info("=" * 50)
    logger.info("clip-worker 시작")
    logger.info(f"  서버: {cfg['api_url']}")
    logger.info(f"  스테이션 ID: {station_id or '(전체)'}")
    logger.info(f"  출력: {output_dir.resolve()}")
    logger.info(f"  ffmpeg: {cfg['ffmpeg_path']}")
    logger.info(f"  폴링 주기: {cfg['poll_interval']}초")
    logger.info("=" * 50)

    api = ApiClient(cfg["api_url"])

    # 로그인
    if not api.login(cfg["admin_username"], cfg["admin_password"]):
        logger.error("서버 로그인 실패. config.ini 의 admin_username / admin_password 확인.")
        input("아무 키나 누르면 종료...")
        return

    logger.info("서버 로그인 성공")

    while True:
        try:
            heats = api.get_pending_heats(station_id)
            if heats:
                logger.info(f"대기 중인 히트 {len(heats)}개 발견")

            for heat in heats:
                heat_id = heat["id"]

                # 선점 시도
                if not api.claim_heat(heat_id):
                    continue

                # ffmpeg 추출
                ok, clip_path, error = extract_clip(heat, output_dir, cfg["ffmpeg_path"])

                # 결과 보고
                api.report_complete(
                    heat_id,
                    clip_path=clip_path if ok else None,
                    status="ready" if ok else "failed",
                    error=error,
                )

        except Exception as e:
            logger.exception(f"폴링 실패: {e}")
            # 토큰 만료 시 재로그인
            if "401" in str(e):
                logger.info("토큰 만료 — 재로그인 시도")
                api.login(cfg["admin_username"], cfg["admin_password"])

        import time
        time.sleep(cfg["poll_interval"])


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("종료")
