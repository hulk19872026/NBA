"""
Application configuration using Pydantic Settings.
All secrets loaded from environment variables.
"""

from typing import List
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "NBA Analytics Platform"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    PORT: int = 8000

    # Security
    SECRET_KEY: str = "change-me-in-production-use-long-random-string"
    API_KEY_HEADER: str = "X-API-Key"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/nba_analytics"

    # Redis (for caching + BullMQ-style queues via arq)
    REDIS_URL: str = "redis://localhost:6379"

    # External APIs
    ODDS_API_KEY: str = ""           # https://the-odds-api.com
    BALLDONTLIE_API_KEY: str = ""    # https://www.balldontlie.io
    SPORTSDATA_API_KEY: str = ""     # https://sportsdata.io
    ANTHROPIC_API_KEY: str = ""      # For AI narrative generation

    # NBA Data Sources
    NBA_API_BASE: str = "https://stats.nba.com/stats"
    ODDS_API_BASE: str = "https://api.the-odds-api.com/v4"
    BALLDONTLIE_BASE: str = "https://api.balldontlie.io/v1"

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://your-frontend.railway.app",
    ]

    # Scheduler intervals (seconds)
    ODDS_REFRESH_INTERVAL: int = 300       # 5 minutes
    STATS_REFRESH_INTERVAL: int = 1800     # 30 minutes
    PREDICTIONS_REFRESH_INTERVAL: int = 3600  # 1 hour

    # Analytics
    ELO_K_FACTOR: float = 20.0
    HOME_COURT_ADVANTAGE: float = 3.5     # Points
    MIN_EDGE_THRESHOLD: float = 3.0       # Minimum % edge to flag

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
