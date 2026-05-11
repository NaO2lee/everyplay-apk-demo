from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.middleware.security import SecurityHeadersMiddleware
from app.core.database import init_db
from app.api.v1 import api_router
from app.obs import get_obs_manager


class PublicCacheMiddleware(BaseHTTPMiddleware):
    """공개 GET 엔드포인트 응답에 Cache-Control 부착 (5/11 — Cloudflare 캐시 활용).

    /api/v1/public/* + /api/v1/results/* 60초 클라이언트 + 5분 CDN 캐시.
    SSE / overlay 스트림은 제외.
    """
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        is_public = (
            path.startswith(f"{settings.API_V1_PREFIX}/public/")
            or path.startswith(f"{settings.API_V1_PREFIX}/results/")
        )
        if (
            request.method == "GET"
            and response.status_code == 200
            and is_public
            and "/sse" not in path
        ):
            response.headers["Cache-Control"] = "public, max-age=60, s-maxage=300, stale-while-revalidate=60"
        return response

# 업로드된 오버레이 이미지(로고/워터마크) 저장 위치
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
(UPLOADS_DIR / "overlay-images").mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # OBS 클라이언트 DB 에서 로드 + 폴러 시작
    from app.core.database import async_session
    from app.obs.manager import load_clients_from_db
    async with async_session() as db:
        count = await load_clients_from_db(db)
    mgr = get_obs_manager()
    mgr.start_poller()
    try:
        yield
    finally:
        await mgr.stop_poller()


app = FastAPI(
    title=settings.APP_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(PublicCacheMiddleware)

# 5/11 — CORS 화이트리스트 (와일드카드+credentials 보안 이슈 차단)
# env CORS_ALLOW_ORIGINS (콤마 구분) 또는 기본 로컬/사설망 + Cloudflare Tunnel.
import os as _os
_cors_env = _os.environ.get("CORS_ALLOW_ORIGINS", "").strip()
if _cors_env:
    _cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
    _cors_regex = None
else:
    _cors_origins = []
    _cors_regex = (
        r"^https?://("
        r"localhost(:\d+)?"
        r"|127\.0\.0\.1(:\d+)?"
        r"|192\.168\.\d+\.\d+(:\d+)?"
        r"|10\.\d+\.\d+\.\d+(:\d+)?"
        r"|172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+(:\d+)?"
        r"|100\.\d+\.\d+\.\d+(:\d+)?"  # Tailscale CGNAT
        r"|[a-z0-9-]+\.weplaykorea\.com"  # Cloudflare tunnel subdomains (madelee 등)
        r")$"
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# 업로드된 정적 파일 (로고 등) 서빙
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": "0.1.0-safety",
        "docs": "/docs",
    }
