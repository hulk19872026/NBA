"""
NBA Analytics Platform - FastAPI Backend
Multi-agent architecture for NBA intelligence
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)
logger = logging.getLogger(__name__)


async def _deferred_startup():
    """Run slow startup tasks in background so health checks pass immediately."""
    await asyncio.sleep(1)

    try:
        from app.models.database import init_db
        await asyncio.wait_for(init_db(), timeout=10)
        logger.info("✅ Database initialized")
    except Exception as e:
        logger.warning(f"⚠️ Database not available: {e}")

    try:
        from app.core.scheduler import scheduler
        scheduler.start()
        logger.info("✅ Agent scheduler started")
    except Exception as e:
        logger.warning(f"⚠️ Scheduler failed to start: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle management."""
    logger.info("🏀 NBA Analytics Platform starting up...")
    startup_task = asyncio.create_task(_deferred_startup())
    logger.info("✅ Server ready — accepting requests")
    yield
    startup_task.cancel()
    try:
        from app.core.scheduler import scheduler
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# API Routers
from app.api.routes import health  # noqa: E402
app.include_router(health.router, prefix="/api", tags=["Health"])

from app.api.routes import games, teams, players, odds, predictions, agents, ai  # noqa: E402
app.include_router(games.router, prefix="/api/games", tags=["Games"])
app.include_router(teams.router, prefix="/api/teams", tags=["Teams"])
app.include_router(players.router, prefix="/api/players", tags=["Players"])
app.include_router(odds.router, prefix="/api/odds", tags=["Odds"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(agents.router, prefix="/api/agents", tags=["Agents"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI Analyst"])

# Serve Next.js static frontend
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.isdir(FRONTEND_DIR):
    # Serve _next/static assets
    app.mount("/_next", StaticFiles(directory=os.path.join(FRONTEND_DIR, "_next")), name="next-assets")

    # Serve all frontend pages as a catch-all
    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve the Next.js static export for all non-API routes."""
        file_path = os.path.join(FRONTEND_DIR, full_path)

        # Try exact file
        if os.path.isfile(file_path):
            return FileResponse(file_path)

        # Try as directory with index.html
        index_path = os.path.join(file_path, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)

        # Fallback to root index.html (SPA routing)
        root_index = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.isfile(root_index):
            return FileResponse(root_index)

        return JSONResponse(status_code=404, content={"detail": "Not found"})
else:
    logger.warning(f"⚠️ Frontend directory not found at {FRONTEND_DIR}, serving API only")


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)}
    )
