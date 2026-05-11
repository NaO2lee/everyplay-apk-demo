"""관리자 인증 라우터.

토큰 저장소는 JSON 파일 기반 (재기동 내성).
프로덕션에서는 Redis/DB 권장이지만, 단일 프로세스 + 행사용 단기 운영에는 파일이 충분하다.

v3.3 확장: 토큰 메타에 role/user_id 포함. 레거시 플랫 형식(value=str ISO)은 자동 마이그레이션.
역할: admin / operator / judge / player / coach
"""

import json
import os
import sys
from uuid import UUID as UUID_TYPE

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
from typing import Callable, Optional

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

ADMIN_USERNAME = settings.ADMIN_USERNAME
ADMIN_PASSWORD = settings.ADMIN_PASSWORD
TOKEN_EXPIRY_HOURS = 24
TOKEN_STORE_PATH = Path(os.environ.get("TOKEN_STORE_PATH", "/tmp/safety-tokens.json"))

# v3.3 — 역할 상수 (UserRole enum 미러)
ROLE_ADMIN = "admin"
ROLE_OPERATOR = "operator"
ROLE_JUDGE = "judge"
ROLE_PLAYER = "player"
ROLE_COACH = "coach"
ALL_ROLES = {ROLE_ADMIN, ROLE_OPERATOR, ROLE_JUDGE, ROLE_PLAYER, ROLE_COACH}


class TokenData(BaseModel):
    token: str
    role: str
    user_id: str
    exp: str  # ISO


def _normalize_token_value(value) -> dict:
    """레거시 플랫 ISO 문자열 또는 v3.3 dict 형식을 통일된 dict로."""
    if isinstance(value, str):
        return {"exp": value, "role": ROLE_ADMIN, "user_id": "admin-builtin"}
    if isinstance(value, dict):
        return {
            "exp": value.get("exp", ""),
            "role": value.get("role", ROLE_ADMIN),
            "user_id": value.get("user_id", "admin-builtin"),
        }
    return {"exp": "", "role": ROLE_ADMIN, "user_id": "admin-builtin"}


def _load_tokens() -> dict[str, dict]:
    """디스크에서 토큰 로드. 레거시 플랫 ISO 문자열은 자동으로 dict 형식으로 마이그레이션.

    Returns: dict[token_str, {exp, role, user_id}]
    """
    if not TOKEN_STORE_PATH.exists():
        return {}
    try:
        with open(TOKEN_STORE_PATH, "r") as f:
            fcntl.flock(f, fcntl.LOCK_SH)
            try:
                raw = json.load(f) or {}
            finally:
                fcntl.flock(f, fcntl.LOCK_UN)
        return {t: _normalize_token_value(v) for t, v in raw.items()}
    except Exception:
        return {}


def _save_tokens(tokens: dict[str, dict]) -> None:
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


def _cleanup_expired(tokens: dict[str, dict]) -> dict[str, dict]:
    now = datetime.utcnow()
    out = {}
    for t, meta in tokens.items():
        try:
            if datetime.fromisoformat(meta["exp"]) > now:
                out[t] = meta
        except Exception:
            continue
    return out


class LoginRequest(BaseModel):
    username: str
    password: str


def _resolve_token(authorization: Optional[str]) -> TokenData:
    """공통 토큰 해석 + 검증 + 만료 처리. 실패 시 HTTPException."""
    if not authorization:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")

    token = authorization.replace("Bearer ", "").strip()
    tokens = _load_tokens()

    meta = tokens.get(token)
    if not meta:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")

    try:
        exp = datetime.fromisoformat(meta["exp"])
    except Exception:
        del tokens[token]
        _save_tokens(tokens)
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")

    if exp < datetime.utcnow():
        del tokens[token]
        _save_tokens(tokens)
        raise HTTPException(status_code=401, detail="토큰이 만료되었습니다")

    return TokenData(token=token, role=meta.get("role", ROLE_ADMIN), user_id=meta.get("user_id", "admin-builtin"), exp=meta["exp"])


def verify_token(authorization: Optional[str] = Header(None)) -> bool:
    """기존 라우터 호환용 — 토큰 존재·유효성만 체크."""
    _resolve_token(authorization)
    return True


def get_token_data(authorization: Optional[str] = Header(None)) -> TokenData:
    """v3.3 — 토큰 메타데이터(role 포함) 반환."""
    return _resolve_token(authorization)


def require_role(*allowed_roles: str) -> Callable:
    """역할 가드 dependency 팩토리.

    Usage:
        @router.get("/", dependencies=[Depends(require_role(ROLE_JUDGE))])
        # 또는 함수에서 TokenData 받기:
        async def endpoint(td: TokenData = Depends(require_role(ROLE_JUDGE, ROLE_OPERATOR))):
            ...
    """
    invalid = [r for r in allowed_roles if r not in ALL_ROLES]
    if invalid:
        raise ValueError(f"Unknown role(s): {invalid}")

    async def _check(td: TokenData = Depends(get_token_data)) -> TokenData:
        if td.role not in allowed_roles:
            raise HTTPException(status_code=403, detail=f"권한 부족 (필요: {', '.join(allowed_roles)})")
        return td

    return _check


@router.post("/login")
async def login(data: LoginRequest):
    """관리자 로그인 — 토큰 발급 (role=admin)."""
    if data.username != ADMIN_USERNAME or data.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")

    tokens = _cleanup_expired(_load_tokens())
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS)
    tokens[token] = {
        "exp": expires_at.isoformat(),
        "role": ROLE_ADMIN,
        "user_id": ADMIN_USERNAME,
    }
    _save_tokens(tokens)

    return {
        "success": True,
        "data": {
            "token": token,
            "expires_at": expires_at.isoformat(),
            "role": ROLE_ADMIN,
        },
    }


# === v3.3 개발용: 임의 역할 토큰 발급 (UI 작업 전 테스트용, 운영 시 제거 또는 환경 게이트) ===
class DevGrantRequest(BaseModel):
    role: str  # admin / operator / judge / player / coach
    user_id: str = "dev-test-user"


@router.post("/dev-grant", include_in_schema=False)
async def dev_grant_role(data: DevGrantRequest):
    """[DEV ONLY] 역할 가드 테스트용 임의 토큰 발급. 운영 배포 전 제거.

    Postgres FK 호환을 위해 user_id에 해당하는 User row를 자동 upsert.
    """
    if data.role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail=f"unknown role: {data.role}")

    # user_id를 결정론적 UUID로 변환 (judge.py의 _to_uuid와 동일 로직)
    import hashlib
    try:
        user_uuid = UUID_TYPE(str(data.user_id))
    except (ValueError, TypeError):
        h = hashlib.md5(str(data.user_id).encode()).hexdigest()
        user_uuid = UUID_TYPE(h)

    # User row upsert (Postgres FK 보장)
    from app.core.database import async_session
    from app.core.security import get_password_hash
    from app.models import User, UserRole
    from sqlalchemy import select as _sel
    async with async_session() as s:
        existing = await s.execute(_sel(User).where(User.id == user_uuid))
        u = existing.scalar_one_or_none()
        if not u:
            try:
                u = User(
                    id=user_uuid,
                    email=f"dev-{user_uuid.hex[:8]}@local.dev",
                    hashed_password=get_password_hash("dev"),
                    name=f"dev-{data.user_id[:20]}",
                    role=UserRole(data.role),
                    is_active=True,
                )
                s.add(u)
                await s.commit()
            except Exception:
                await s.rollback()  # race / duplicate email — skip

    tokens = _cleanup_expired(_load_tokens())
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS)
    tokens[token] = {
        "exp": expires_at.isoformat(),
        "role": data.role,
        "user_id": str(user_uuid),  # UUID로 저장 (FK 호환)
    }
    _save_tokens(tokens)
    return {"success": True, "data": {"token": token, "role": data.role, "user_id": str(user_uuid), "expires_at": expires_at.isoformat()}}


# === v3.3 회원가입 ===

class SignupRequest(BaseModel):
    email: str
    password: str
    name: str
    phone_number: Optional[str] = None
    country_code: Optional[str] = None  # ISO 3166: KR, US, JP …
    role: str = ROLE_PLAYER  # 기본 selene


@router.post("/signup")
async def signup(data: SignupRequest):
    """v3.3 회원가입 — selene/coach 옵트인. 이메일 + 폰 + 비번 + 국적.

    SMS OTP 검증은 Phase 5에서 추가. 지금은 자유 가입(데모 단계).
    """
    if data.role not in (ROLE_PLAYER, ROLE_COACH):
        raise HTTPException(status_code=400, detail=f"signup으로는 player/coach만 가능 (받은 role: {data.role})")
    if "@" not in data.email or len(data.email) < 5:
        raise HTTPException(status_code=400, detail="유효한 이메일이 필요합니다")
    if len(data.password) < 4:
        raise HTTPException(status_code=400, detail="비밀번호 4자 이상")

    from app.core.database import async_session
    from app.core.security import get_password_hash
    from app.models import User, UserRole
    from sqlalchemy import select as _sel

    async with async_session() as s:
        existing = await s.execute(_sel(User).where(User.email == data.email))
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=400, detail="이미 가입된 이메일입니다")

        role_enum = UserRole(data.role)
        user = User(
            email=data.email,
            hashed_password=get_password_hash(data.password),
            name=data.name,
            role=role_enum,
            is_active=True,
            phone_number=data.phone_number,
            country_code=data.country_code,
        )
        s.add(user)
        await s.commit()
        await s.refresh(user)

    # 가입 직후 토큰 발급
    tokens = _cleanup_expired(_load_tokens())
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS)
    tokens[token] = {
        "exp": expires_at.isoformat(),
        "role": data.role,
        "user_id": str(user.id),
    }
    _save_tokens(tokens)

    return {
        "success": True,
        "data": {
            "user_id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role.value,
            "country_code": user.country_code,
            "token": token,
            "expires_at": expires_at.isoformat(),
        },
    }


@router.post("/signin")
async def signin(data: LoginRequest):
    """v3.3 회원 로그인 — 이메일 + 비번. selene/coach 가입자용.

    admin은 /auth/login (admin/admin)을 계속 사용.
    """
    from app.core.database import async_session
    from app.core.security import verify_password
    from app.models import User
    from sqlalchemy import select as _sel

    async with async_session() as s:
        res = await s.execute(_sel(User).where(User.email == data.username))
        user = res.scalar_one_or_none()
        if not user or not verify_password(data.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")

        user.last_login = datetime.utcnow()
        await s.commit()
        role_value = user.role.value if hasattr(user.role, "value") else user.role
        user_id = str(user.id)
        country = user.country_code

    tokens = _cleanup_expired(_load_tokens())
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS)
    tokens[token] = {
        "exp": expires_at.isoformat(),
        "role": role_value,
        "user_id": user_id,
    }
    _save_tokens(tokens)

    return {
        "success": True,
        "data": {
            "token": token,
            "expires_at": expires_at.isoformat(),
            "role": role_value,
            "user_id": user_id,
            "country_code": country,
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
async def verify(td: TokenData = Depends(get_token_data)):
    return {"success": True, "data": {"role": td.role, "user_id": td.user_id, "expires_at": td.exp}}
