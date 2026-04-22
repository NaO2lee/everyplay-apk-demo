"""관리자 인증 라우터.

토큰 저장소는 JSON 파일 기반 (재기동 내성).
프로덕션에서는 Redis/DB 권장이지만, 단일 프로세스 + 행사용 단기 운영에는 파일이 충분하다.
"""

import json
import os
import sys

if sys.platform == "win32":
    class _FcntlShim:
        LOCK_SH = 0
        LOCK_EX = 0
        LOCK_UN = 0
        @staticmethod
        def flock(f, op): pass
    fcntl = _FcntlShim()
else:
    import fcntl
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

ADMIN_USERNAME = settings.ADMIN_USERNAME
ADMIN_PASSWORD = settings.ADMIN_PASSWORD
TOKEN_EXPIRY_HOURS = 24
TOKEN_STORE_PATH = Path(os.environ.get("TOKEN_STORE_PATH", "/tmp/safety-tokens.json"))


def _load_tokens() -> dict[str, str]:
    """디스크에서 토큰 로드 (value 는 ISO datetime 문자열). 파일 잠금으로 동시 접근 보호."""
    if not TOKEN_STORE_PATH.exists():
        return {}
    try:
        with open(TOKEN_STORE_PATH, "r") as f:
            fcntl.flock(f, fcntl.LOCK_SH)
            try:
                return json.load(f) or {}
            finally:
                fcntl.flock(f, fcntl.LOCK_UN)
    except Exception:
        return {}


def _save_tokens(tokens: dict[str, str]) -> None:
    try:
        TOKEN_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(TOKEN_STORE_PATH, "r+") as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            try:
                f.seek(0)
                json.dump(tokens, f)
                f.truncate()
            finally:
                fcntl.flock(f, fcntl.LOCK_UN)
    except FileNotFoundError:
        with open(TOKEN_STORE_PATH, "w") as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            try:
                json.dump(tokens, f)
            finally:
                fcntl.flock(f, fcntl.LOCK_UN)
    except Exception:
        pass


def _cleanup_expired(tokens: dict[str, str]) -> dict[str, str]:
    now = datetime.utcnow()
    return {t: exp for t, exp in tokens.items() if datetime.fromisoformat(exp) > now}


class LoginRequest(BaseModel):
    username: str
    password: str


def verify_token(authorization: Optional[str] = Header(None)) -> bool:
    """토큰 검증 (파일 저장소 기준)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")

    token = authorization.replace("Bearer ", "").strip()
    tokens = _load_tokens()

    if token not in tokens:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")

    try:
        exp = datetime.fromisoformat(tokens[token])
    except Exception:
        del tokens[token]
        _save_tokens(tokens)
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")

    if exp < datetime.utcnow():
        del tokens[token]
        _save_tokens(tokens)
        raise HTTPException(status_code=401, detail="토큰이 만료되었습니다")

    return True


@router.post("/login")
async def login(data: LoginRequest):
    """관리자 로그인 — 토큰 발급."""
    if data.username != ADMIN_USERNAME or data.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")

    tokens = _cleanup_expired(_load_tokens())
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS)
    tokens[token] = expires_at.isoformat()
    _save_tokens(tokens)

    return {
        "success": True,
        "data": {
            "token": token,
            "expires_at": expires_at.isoformat(),
        },
    }


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        tokens = _load_tokens()
        if tokens.pop(token, None) is not None:
            _save_tokens(tokens)
    return {"success": True}


@router.get("/verify")
async def verify(authorized: bool = Depends(verify_token)):
    return {"success": True}
