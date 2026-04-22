from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.middleware.security import SecurityHeadersMiddleware
from app.core.database import init_db
from app.api.v1 import api_router
from app.obs import get_obs_manager

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
