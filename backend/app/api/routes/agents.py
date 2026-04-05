"""
Agents API Router
=================
Endpoints to manually trigger agents and monitor their status.
"""

from datetime import date
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Query
from pydantic import BaseModel

from app.agents.orchestrator import orchestrator
from app.models.database import AsyncSessionLocal, AgentLog
from sqlalchemy import select

router = APIRouter()


class PipelineResponse(BaseModel):
    status: str
    message: str
    job_id: Optional[str] = None


@router.post("/run/pipeline", response_model=PipelineResponse)
async def trigger_full_pipeline(
    background_tasks: BackgroundTasks,
    target_date: Optional[date] = Query(default=None),
):
    """Trigger the full analytics pipeline in the background."""
    if orchestrator.is_running:
        return PipelineResponse(
            status="skipped",
            message="Pipeline is already running"
        )

    async def run_pipeline():
        await orchestrator.run_full_pipeline(target_date=target_date)

    background_tasks.add_task(run_pipeline)
    return PipelineResponse(
        status="started",
        message=f"Full pipeline started for {target_date or 'today'}",
    )


@router.post("/run/odds", response_model=PipelineResponse)
async def trigger_odds_refresh(
    background_tasks: BackgroundTasks,
    target_date: Optional[date] = Query(default=None),
):
    """Trigger odds refresh only."""
    async def run_odds():
        await orchestrator.run_odds_only(target_date=target_date)

    background_tasks.add_task(run_odds)
    return PipelineResponse(status="started", message="Odds refresh started")


@router.post("/run/predictions", response_model=PipelineResponse)
async def trigger_predictions_refresh(
    background_tasks: BackgroundTasks,
    target_date: Optional[date] = Query(default=None),
):
    """Trigger predictions refresh only."""
    async def run_preds():
        await orchestrator.run_predictions_only(target_date=target_date)

    background_tasks.add_task(run_preds)
    return PipelineResponse(status="started", message="Predictions refresh started")


@router.get("/status")
async def agent_status():
    """Get current status of all agents."""
    health = await orchestrator.health_check()
    return health


@router.get("/logs")
async def get_agent_logs(
    agent_name: Optional[str] = None,
    limit: int = Query(default=50, le=200),
):
    """Get recent agent execution logs."""
    async with AsyncSessionLocal() as session:
        query = select(AgentLog).order_by(AgentLog.created_at.desc()).limit(limit)
        if agent_name:
            query = query.where(AgentLog.agent_name == agent_name)

        result = await session.execute(query)
        logs = result.scalars().all()

        return {
            "logs": [
                {
                    "id": log.id,
                    "agent": log.agent_name,
                    "status": log.status.value,
                    "message": log.message,
                    "records_processed": log.records_processed,
                    "duration_ms": log.duration_ms,
                    "error": log.error,
                    "created_at": log.created_at.isoformat(),
                }
                for log in logs
            ]
        }
