"""중앙 알림 디스패처 (v3.3 R8).

단일 진입점: send_notification(user_id, title, body, data, channels=None)
사용자별 채널 우선순위:
  1. PWA Push (WebPush) — 가장 빠름, 무료
  2. SMS (NHN Cloud) — 폴백, 외부 키 필요
  3. Kakao 비즈채널 (알림톡) — 폴백, 외부 채널 필요

각 provider는 독립 모듈. 미설정 provider는 자동 skip.
모든 시도/성공/실패는 audit_log 기록.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog, PushSubscription, User

logger = logging.getLogger(__name__)


class NotificationResult:
    def __init__(self, channel: str, success: bool, detail: str = ""):
        self.channel = channel
        self.success = success
        self.detail = detail

    def __repr__(self):
        return f"<{self.channel}: {'OK' if self.success else 'FAIL'} {self.detail}>"


# ─── PWA Push provider ───────────────────────────────────────

async def _send_pwa_push(db: AsyncSession, user_id: UUID, title: str, body: str, data: Optional[dict]) -> NotificationResult:
    try:
        res = await db.execute(
            select(PushSubscription).where(
                (PushSubscription.user_id == user_id) & (PushSubscription.revoked_at.is_(None))
            )
        )
        subs = res.scalars().all()
        if not subs:
            return NotificationResult("pwa_push", False, "no active subscription")

        from app.api.v1.push import _ensure_vapid, _VAPID_PRIVATE_PEM, _VAPID_SUBJECT
        from pywebpush import webpush, WebPushException
        _ensure_vapid()

        # 다시 import (전역 변수 갱신 후)
        from app.api.v1 import push as _push_mod

        payload = json.dumps({
            "title": title, "body": body,
            "tag": (data or {}).get("tag", "mop"),
            "data": data or {"url": "/me"},
        })

        sent = 0
        for sub in subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh_key, "auth": sub.auth_key},
                    },
                    data=payload,
                    vapid_private_key=_push_mod._VAPID_PRIVATE_PEM,
                    vapid_claims={"sub": _push_mod._VAPID_SUBJECT},
                )
                sent += 1
                sub.last_used_at = datetime.utcnow()
            except WebPushException as e:
                if e.response is not None and e.response.status_code == 410:
                    sub.revoked_at = datetime.utcnow()
        await db.commit()
        return NotificationResult("pwa_push", sent > 0, f"sent={sent}/{len(subs)}")
    except Exception as e:
        return NotificationResult("pwa_push", False, str(e))


# ─── SMS provider (NHN Cloud) — 외부 키 받으면 활성 ──────────

async def _send_sms(db: AsyncSession, user_id: UUID, title: str, body: str) -> NotificationResult:
    """NHN Cloud SMS. 환경변수 NHN_APP_KEY / NHN_SECRET_KEY / SMS_SENDER_NUMBER 필요."""
    import os
    if not all([os.environ.get(k) for k in ("NHN_APP_KEY", "NHN_SECRET_KEY", "SMS_SENDER_NUMBER")]):
        return NotificationResult("sms", False, "skipped: NHN env vars not set")

    # User → phone_number
    ures = await db.execute(select(User).where(User.id == user_id))
    user = ures.scalar_one_or_none()
    if not user or not user.phone_number:
        return NotificationResult("sms", False, "no phone_number on user")

    # TODO: 실제 NHN Cloud SMS HTTP 호출 (외부 키 받으면 구현)
    # 기존 app/services/sms_service.py 활용 가능
    logger.info(f"[SMS stub] to={user.phone_number} title={title}")
    return NotificationResult("sms", False, "stub — implement when NHN keys provided")


# ─── Kakao 비즈채널 — 외부 계약 받으면 활성 ──────────────────

async def _send_kakao(db: AsyncSession, user_id: UUID, title: str, body: str) -> NotificationResult:
    """Kakao 알림톡(Bizmessage). 외부 계약 + 채널 ID + 템플릿 필요."""
    import os
    if not os.environ.get("KAKAO_CHANNEL_KEY"):
        return NotificationResult("kakao", False, "skipped: KAKAO_CHANNEL_KEY not set")

    ures = await db.execute(select(User).where(User.id == user_id))
    user = ures.scalar_one_or_none()
    if not user or not user.phone_number:
        return NotificationResult("kakao", False, "no phone_number on user")

    # TODO: Kakao Bizmessage API
    logger.info(f"[Kakao stub] to={user.phone_number} title={title}")
    return NotificationResult("kakao", False, "stub — implement when Kakao biz channel ready")


# ─── 디스패처 ────────────────────────────────────────────────

DEFAULT_CHANNEL_PRIORITY = ["pwa_push", "sms", "kakao"]


async def send_notification(
    db: AsyncSession,
    user_id: UUID,
    title: str,
    body: str,
    data: Optional[dict] = None,
    channels: Optional[list[str]] = None,
    actor_role: str = "system",
) -> list[NotificationResult]:
    """사용자에게 알림 발송. 첫 성공한 채널까지만 시도 (cascade).

    Returns: list of NotificationResult (시도한 모든 채널).
    audit_log 자동 기록.
    """
    chans = channels or DEFAULT_CHANNEL_PRIORITY
    results = []
    for ch in chans:
        if ch == "pwa_push":
            r = await _send_pwa_push(db, user_id, title, body, data)
        elif ch == "sms":
            r = await _send_sms(db, user_id, title, body)
        elif ch == "kakao":
            r = await _send_kakao(db, user_id, title, body)
        else:
            r = NotificationResult(ch, False, "unknown channel")
        results.append(r)
        if r.success:
            break  # 한 채널 성공하면 종료 (cascade)

    # audit
    try:
        db.add(AuditLog(
            actor_id=user_id, actor_role=actor_role,
            action_type="notification_sent", target_type="user", target_id=user_id,
            after_value={
                "title": title, "body": body,
                "results": [{"channel": r.channel, "success": r.success, "detail": r.detail} for r in results],
            },
            timestamp=datetime.utcnow(),
        ))
        await db.commit()
    except Exception as e:
        logger.warning(f"notification audit failed: {e}")

    return results
