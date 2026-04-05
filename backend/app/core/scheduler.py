"""
Background Scheduler
====================
APScheduler-based cron system for triggering agent pipelines.
Runs data collection, odds refresh, and prediction updates on schedule.
"""

import logging
from datetime import date
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings

logger = logging.getLogger(__name__)

# Lazy import to avoid circular dependency
_orchestrator = None


def get_orchestrator():
    global _orchestrator
    if _orchestrator is None:
        from app.agents.orchestrator import orchestrator
        _orchestrator = orchestrator
    return _orchestrator


async def run_daily_pipeline():
    """Full pipeline: runs once daily at 8 AM ET."""
    logger.info("⏰ Scheduled: Running daily full pipeline")
    try:
        result = await get_orchestrator().run_full_pipeline(target_date=date.today())
        logger.info(f"Daily pipeline complete: {result.get('pipeline', {}).get('status')}")
    except Exception as e:
        logger.error(f"Scheduled pipeline failed: {e}", exc_info=True)


async def run_odds_refresh():
    """Odds-only refresh: runs every 5 minutes."""
    logger.info("⏰ Scheduled: Refreshing odds")
    try:
        await get_orchestrator().run_odds_only()
    except Exception as e:
        logger.error(f"Odds refresh failed: {e}", exc_info=True)


async def run_predictions_refresh():
    """Predictions refresh: runs every hour."""
    logger.info("⏰ Scheduled: Refreshing predictions")
    try:
        await get_orchestrator().run_predictions_only()
    except Exception as e:
        logger.error(f"Predictions refresh failed: {e}", exc_info=True)


# Create scheduler
scheduler = AsyncIOScheduler(timezone="America/New_York")

# Daily full pipeline at 8 AM ET
scheduler.add_job(
    run_daily_pipeline,
    CronTrigger(hour=8, minute=0),
    id="daily_pipeline",
    replace_existing=True,
    max_instances=1,
    coalesce=True,
)

# Also run at noon to pick up lineup changes
scheduler.add_job(
    run_daily_pipeline,
    CronTrigger(hour=12, minute=0),
    id="noon_pipeline",
    replace_existing=True,
    max_instances=1,
    coalesce=True,
)

# Odds refresh every 5 minutes
# jitter=30 avoids thundering herd; next_run_time deferred so it doesn't fire at boot
from datetime import datetime as _dt, timedelta as _td

scheduler.add_job(
    run_odds_refresh,
    IntervalTrigger(seconds=settings.ODDS_REFRESH_INTERVAL),
    id="odds_refresh",
    replace_existing=True,
    max_instances=1,
    coalesce=True,
    next_run_time=_dt.now() + _td(seconds=settings.ODDS_REFRESH_INTERVAL),
)

# Predictions refresh every hour
scheduler.add_job(
    run_predictions_refresh,
    IntervalTrigger(seconds=settings.PREDICTIONS_REFRESH_INTERVAL),
    id="predictions_refresh",
    replace_existing=True,
    max_instances=1,
    coalesce=True,
    next_run_time=_dt.now() + _td(seconds=settings.PREDICTIONS_REFRESH_INTERVAL),
)
