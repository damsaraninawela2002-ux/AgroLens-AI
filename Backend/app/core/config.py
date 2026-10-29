import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from Backend/.env
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)


class Settings:
    """Application configuration loaded from environment variables."""

    def __init__(self) -> None:
        self.MONGODB_URI: str = (os.getenv("MONGODB_URI") or "").strip()
        self.DATABASE_NAME: str = (
            os.getenv("DATABASE_NAME")
            or os.getenv("DB_NAME")
            or "agrolens_db"
        ).strip()
        self.JWT_SECRET_KEY: str = (
            os.getenv("JWT_SECRET_KEY")
            or os.getenv("SECRET_KEY")
            or "agrolens-default-jwt-secret-key"
        ).strip()
        self.JWT_ALGORITHM: str = (
            os.getenv("JWT_ALGORITHM") or "HS256"
        ).strip()
        self.ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
            (os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES") or "15").strip()
        )
        self.REFRESH_TOKEN_EXPIRE_DAYS: int = int(
            (os.getenv("REFRESH_TOKEN_EXPIRE_DAYS") or "7").strip()
        )
        raw_origins = (
            os.getenv("ALLOWED_ORIGINS") or "http://localhost:5173"
        ).strip()
        parsed_origins = [
            origin.strip()
            for origin in raw_origins.split(",")
            if origin.strip()
        ]
        self.ALLOWED_ORIGINS: list[str] = (
            parsed_origins if parsed_origins else ["http://localhost:5173"]
        )
        self.COOKIE_SECURE: bool = (
            os.getenv("COOKIE_SECURE") or "false"
        ).strip().lower() in ("true", "1", "yes")
        self.GEMINI_API_KEY: str = (os.getenv("GEMINI_API_KEY") or "").strip()
        self.GEMINI_MODEL: str = (
            os.getenv("GEMINI_MODEL") or "gemini-2.5-flash"
        ).strip()


settings = Settings()
