"""
NBA Analytics Platform - FastAPI Backend
Multi-agent architecture for NBA intelligence
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.scheduler import scheduler
from app.api.routes import games, teams, players, odds, predictions, agents, health, ai
from app.models.database import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle management."""
    logger.info("🏀 NBA Analytics Platform starting up...")

    # Initialize database (non-fatal — app can serve health checks without DB)
    # Use a short timeout so this doesn't block startup past the health check window
    try:
        await asyncio.wait_for(init_db(), timeout=10)
        logger.info("✅ Database initialized")
    except asyncio.TimeoutError:
        logger.warning("⚠️ Database connection timed out (10s), continuing without DB")
    except Exception as e:
        logger.warning(f"⚠️ Database not available, continuing without DB: {e}")

    # Start background scheduler (non-fatal)
    try:
        scheduler.start()
        logger.info("✅ Agent scheduler started")
    except Exception as e:
        logger.warning(f"⚠️ Scheduler failed to start: {e}")

    yield

    # Graceful shutdown
    try:
        scheduler.shutdown(wait=False)
    except Exception:
        pass
    logger.info("🛑 NBA Analytics Platform shutting down...")


app = FastAPI(
    title="NBA Analytics Platform",
    description="Multi-agent NBA intelligence system with real-time odds and probability analytics",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(games.router, prefix="/api/games", tags=["Games"])
app.include_router(teams.router, prefix="/api/teams", tags=["Teams"])
app.include_router(players.router, prefix="/api/players", tags=["Players"])
app.include_router(odds.router, prefix="/api/odds", tags=["Odds"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(agents.router, prefix="/api/agents", tags=["Agents"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI Analyst"])


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else 4,
    )
