from fastapi import APIRouter, Depends

from app.api.v1 import auth, events, courts, heats, participants, notifications, health, obs, overlay, public, programs, presets
from app.api.v1.auth import verify_token

api_router = APIRouter()

# 공개 엔드포인트 (인증 불필요)
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(overlay.router)  # /overlay/sse는 OBS 브라우저 소스가 접근 — 인증 예외
api_router.include_router(public.router)   # /public/* 관람자 페이지용 — 인증 예외

# 관리자 전용 엔드포인트 (토큰 필요)
auth_dep = [Depends(verify_token)]
api_router.include_router(events.router, dependencies=auth_dep)
api_router.include_router(courts.router, dependencies=auth_dep)
api_router.include_router(heats.router, dependencies=auth_dep)
api_router.include_router(participants.router, dependencies=auth_dep)
api_router.include_router(notifications.router, dependencies=auth_dep)
api_router.include_router(obs.router, dependencies=auth_dep)
api_router.include_router(programs.router, dependencies=auth_dep)
api_router.include_router(presets.router, dependencies=auth_dep)
