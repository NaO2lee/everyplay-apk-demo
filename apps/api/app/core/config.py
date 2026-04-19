from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "Everyone's Play Safety API"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # 데이터베이스 — safety 버전 전용 DB (.env 파일로 덮어쓸 것)
    DATABASE_URL: str = "mysql+aiomysql://root:@localhost:3306/everyoneplay_safety"

    # Auth
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    DEVICE_TOKEN_EXPIRE_DAYS: int = 7
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin"

    # YouTube RTMP (유지, 유튜브 라이브 메타데이터 참조용)
    YOUTUBE_RTMP_URL: str = "rtmp://a.rtmp.youtube.com/live2"

    # SMS (NHN Cloud)
    NHN_APP_KEY: str = ""
    NHN_SECRET_KEY: str = ""
    SMS_SENDER_NUMBER: str = ""

    # Google Drive (클립 업로드)
    GOOGLE_SERVICE_ACCOUNT_FILE: str = ""
    GOOGLE_DRIVE_FOLDER_ID: str = ""

    # 클립 저장 경로
    CLIP_STORAGE_DIR: str = "/home/weplay/dev/everyone-play-safety/clips"

    # Audit 로그 경로
    AUDIT_LOG_PATH: str = "/tmp/safety-audit.log"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
