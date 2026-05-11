"""Web Push 라우터 (v3.3 신규).

엔드포인트:
- GET  /push/vapid-public-key       클라이언트 구독 시 사용하는 공개 키
- POST /push/subscribe              구독 정보 저장 (selene/coach)
- POST /push/test                   본인에게 테스트 푸시 (개발용)

VAPID 키:
- 환경변수 VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY 가 있으면 그것 사용
- 없으면 메모리에 즉석 생성 (재시작 시 바뀜 — 개발용)

운영 시: `python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); v.save_key('vapid_priv.pem'); v.save_public_key('vapid_pub.pem')"` 로 영구 키 생성 후 환경변수 등록.
"""

import base64
import json
import os
from datetime import datetime
from typing import Optional
from uuid import UUID

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import (
    ROLE_ADMIN,
    ROLE_COACH,
    ROLE_OPERATOR,
    ROLE_PLAYER,
    TokenData,
    require_role,
)
from app.core.database import get_db
from app.models import PushSubscription
from app.schemas import APIResponse

router = APIRouter(prefix="/push", tags=["push"])


# ─── VAPID 키 (메모리 캐시) ────────────────────────────────────

_VAPID_PRIVATE_PEM: Optional[bytes] = None
_VAPID_PUBLIC_B64: Optional[str] = None
_VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@weplaykorea.com")


def _ensure_vapid():
    """env에서 키 로드, 없으면 즉석 생성 (개발용 임시)."""
    global _VAPID_PRIVATE_PEM, _VAPID_PUBLIC_B64
    if _VAPID_PRIVATE_PEM and _VAPID_PUBLIC_B64:
        return
    env_priv = os.environ.get("VAPID_PRIVATE_KEY_PEM")
    env_pub = os.environ.get("VAPID_PUBLIC_KEY_B64")
    if env_priv and env_pub:
        _VAPID_PRIVATE_PEM = env_priv.encode()
        _VAPID_PUBLIC_B64 = env_pub
        return
    # 즉석 생성 (P-256 EC keypair)
    private_key = ec.generate_private_key(ec.SECP256R1())
    _VAPID_PRIVATE_PEM = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    pub_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    _VAPID_PUBLIC_B64 = base64.urlsafe_b64encode(pub_bytes).decode().rstrip("=")


@router.get("/vapid-public-key", response_model=APIResponse[dict])
async def get_vapid_public_key():
    """클라이언트가 PushManager.subscribe() 호출 시 applicationServerKey로 사용."""
    _ensure_vapid()
    return APIResponse(data={
        "public_key": _VAPID_PUBLIC_B64,
        "subject": _VAPID_SUBJECT,
        "_warning": "환경변수 VAPID_PRIVATE_KEY_PEM/VAPID_PUBLIC_KEY_B64 미설정 — 메모리 임시 키 사용 (재시작 시 변경)",
    })


# ─── 구독 ─────────────────────────────────────────────────────

class PushSubscribeBody(BaseModel):
    endpoint: str
    keys: dict  # {p256dh, auth}
    expirationTime: Optional[int] = None


def _to_uuid_or_none(value):
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        return None


@router.post("/subscribe", response_model=APIResponse[dict])
async def subscribe(
    body: PushSubscribeBody,
    td: TokenData = Depends(require_role(ROLE_PLAYER, ROLE_COACH, ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """클라이언트에서 받은 PushSubscription을 DB에 저장. 같은 endpoint 중복 시 갱신."""
    user_uuid = _to_uuid_or_none(td.user_id)
    if not user_uuid:
        raise HTTPException(status_code=400, detail="유효한 user_id 토큰 필요 (가입자만)")

    p256dh = body.keys.get("p256dh")
    auth = body.keys.get("auth")
    if not p256dh or not auth:
        raise HTTPException(status_code=400, detail="keys.p256dh / keys.auth 필요")

    # 기존 구독 갱신 또는 신규
    existing_q = await db.execute(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint))
    sub = existing_q.scalar_one_or_none()
    if sub:
        sub.user_id = user_uuid
        sub.p256dh_key = p256dh
        sub.auth_key = auth
        sub.last_used_at = datetime.utcnow()
        sub.revoked_at = None
    else:
        sub = PushSubscription(
            user_id=user_uuid,
            endpoint=body.endpoint,
            p256dh_key=p256dh,
            auth_key=auth,
            last_used_at=datetime.utcnow(),
        )
        db.add(sub)
    await db.commit()
    return APIResponse(data={"subscribed": True, "subscription_id": str(sub.id)})


@router.get("/subscriptions", response_model=APIResponse[list[dict]])
async def list_my_subscriptions(
    td: TokenData = Depends(require_role(ROLE_PLAYER, ROLE_COACH, ROLE_ADMIN, ROLE_OPERATOR)),
    db: AsyncSession = Depends(get_db),
):
    """내 활성 구독 목록 (admin은 모든 구독)."""
    user_uuid = _to_uuid_or_none(td.user_id)
    q = select(PushSubscription).where(PushSubscription.revoked_at.is_(None))
    if td.role != ROLE_ADMIN and user_uuid:
        q = q.where(PushSubscription.user_id == user_uuid)
    res = await db.execute(q.order_by(PushSubscription.created_at.desc()))
    items = res.scalars().all()
    return APIResponse(data=[
        {
            "id": str(s.id),
            "user_id": str(s.user_id),
            "endpoint_short": (s.endpoint or '')[:60] + '...',
            "created_at": s.created_at.isoformat(),
            "last_used_at": s.last_used_at.isoformat() if s.last_used_at else None,
        } for s in items
    ])


@router.delete("/subscriptions/{subscription_id}", response_model=APIResponse[dict])
async def unsubscribe(
    subscription_id: UUID,
    td: TokenData = Depends(require_role(ROLE_PLAYER, ROLE_COACH, ROLE_ADMIN, ROLE_OPERATOR)),
    db: AsyncSession = Depends(get_db),
):
    """구독 해제. 본인 구독 또는 admin만. soft delete (revoked_at만 설정 — 재사용 가능)."""
    res = await db.execute(select(PushSubscription).where(PushSubscription.id == subscription_id))
    sub = res.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="subscription not found")
    user_uuid = _to_uuid_or_none(td.user_id)
    if td.role != ROLE_ADMIN and sub.user_id != user_uuid:
        raise HTTPException(status_code=403, detail="본인 구독만 해제 가능")
    sub.revoked_at = datetime.utcnow()
    await db.commit()
    return APIResponse(data={"unsubscribed": True, "subscription_id": str(subscription_id)})


@router.post("/test", response_model=APIResponse[dict])
async def test_push(
    td: TokenData = Depends(require_role(ROLE_PLAYER, ROLE_COACH, ROLE_ADMIN, ROLE_OPERATOR)),
    db: AsyncSession = Depends(get_db),
):
    """본인 활성 구독 모두에 테스트 푸시 발송."""
    _ensure_vapid()
    user_uuid = _to_uuid_or_none(td.user_id)
    if not user_uuid:
        raise HTTPException(status_code=400, detail="유효한 user_id 토큰 필요")

    res = await db.execute(
        select(PushSubscription).where(
            (PushSubscription.user_id == user_uuid) & (PushSubscription.revoked_at.is_(None))
        )
    )
    subs = res.scalars().all()
    if not subs:
        return APIResponse(data={"sent": 0, "_note": "활성 구독 없음 — 먼저 /push/subscribe"})

    payload = json.dumps({
        "title": "🏃 모두의 플레이 테스트",
        "body": "푸시 정상 수신 확인. 차례 알림은 N-10번 시점에 자동 발송됩니다.",
        "tag": "mop-test",
        "data": {"url": "/me"},
    })
    sent = 0
    failed = 0
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh_key, "auth": sub.auth_key},
                },
                data=payload,
                vapid_private_key=_VAPID_PRIVATE_PEM,
                vapid_claims={"sub": _VAPID_SUBJECT},
            )
            sent += 1
            sub.last_used_at = datetime.utcnow()
        except WebPushException as e:
            failed += 1
            # 410 Gone → revoke
            if e.response is not None and e.response.status_code == 410:
                sub.revoked_at = datetime.utcnow()
    await db.commit()
    return APIResponse(data={"sent": sent, "failed": failed})
