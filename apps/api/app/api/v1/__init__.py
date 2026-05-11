from fastapi import APIRouter, Depends

from app.api.v1 import auth, events, courts, heats, participants, notifications, health, obs, overlay, public, programs, presets, judge, me, operator, results, awards as awards_api, appeals as appeals_api, push as push_api, realtime, users as users_api, tiebreakers as tb_api
# 5/11 운영 머지 — Phase 2
from app.api.v1 import sponsors as sponsors_api, ads as ads_api, youtube_accounts as ytacc_api
from app.api.v1.auth import verify_token

api_router = APIRouter()

# 공개 엔드포인트 (인증 불필요)
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(overlay.router)  # /overlay/sse는 OBS 브라우저 소스가 접근 — 인증 예외
api_router.include_router(public.router)   # /public/* 관람자 페이지용 — 인증 예외
api_router.include_router(results.router)  # /results/* 관전 페이지용 — 인증 예외
api_router.include_router(realtime.router) # /realtime/* SSE — 무인증

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

# v3.3 — 역할별 라우터 (각 라우터가 require_role 데코레이터로 권한 체크)
api_router.include_router(judge.router)
api_router.include_router(me.router)
api_router.include_router(operator.router)
api_router.include_router(awards_api.router)
api_router.include_router(appeals_api.router)
api_router.include_router(push_api.router)
api_router.include_router(users_api.router)
api_router.include_router(tb_api.router)
# 5/11 운영 머지 (admin 토큰 필요)
api_router.include_router(sponsors_api.router, dependencies=auth_dep)
api_router.include_router(ads_api.router, dependencies=auth_dep)
api_router.include_router(ytacc_api.router, dependencies=auth_dep)
