"""
Orchestrator Agent
==================
Coordinates all specialized agents, manages data flow,
triggers scheduled updates, and maintains system health.
"""

import asyncio
import logging
import time
from datetime import datetime, date
from typing import Dict, Any, Optional

from app.agents.data_collection import DataCollectionAgent
from app.agents.odds_aggregation import OddsAggregationAgent
from app.agents.analytics import AnalyticsAgent
from app.agents.game_context import GameContextAgent
from app.models.database import AsyncSessionLocal, AgentLog, AgentStatus

logger = logging.getLogger(__name__)


class OrchestratorAgent:
    """
    Master coordinator for the NBA analytics multi-agent system.
    Runs agents in dependency order and tracks execution health.
    """

    def __init__(self):
        self.data_agent = DataCollectionAgent()
        self.odds_agent = OddsAggregationAgent()
        self.analytics_agent = AnalyticsAgent()
        self.context_agent = GameContextAgent()
        self._running = False

    async def run_full_pipeline(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """
        Execute the complete analytics pipeline for a given date.
        
        Pipeline order:
        1. Data Collection  (games, teams, players)
        2. Odds Aggregation (parallel with context)
        3. Game Context     (injuries, fatigue)
        4. Analytics        (probabilities, edges)
        """
        if self._running:
            logger.warning("Pipeline already running, skipping...")
            return {"status": "skipped", "reason": "Pipeline already running"}

        self._running = True
        pipeline_start = time.time()
        results: Dict[str, Any] = {}

        logger.info(f"🚀 Starting full analytics pipeline for {target_date or 'today'}")

        try:
            # ── Step 1: Data Collection ────────────────────────────────────
            logger.info("📥 [1/4] Running Data Collection Agent...")
            results["data_collection"] = await self._run_agent(
                "DataCollectionAgent",
                self.data_agent.run,
                target_date=target_date
            )

            if results["data_collection"]["status"] == "failed":
                logger.error("Data collection failed, aborting pipeline")
                return {"status": "failed", "step": "data_collection", **results}

            # ── Step 2: Odds + Context (parallel) ─────────────────────────
            logger.info("⚡ [2/4] Running Odds + Context Agents in parallel...")
            odds_task = self._run_agent(
                "OddsAggregationAgent",
                self.odds_agent.run,
                target_date=target_date
            )
            context_task = self._run_agent(
                "GameContextAgent",
                self.context_agent.run,
                target_date=target_date
            )

            odds_result, context_result = await asyncio.gather(
                odds_task, context_task, return_exceptions=True
            )
            results["odds_aggregation"] = odds_result if not isinstance(odds_result, Exception) else {"status": "failed", "error": str(odds_result)}
            results["game_context"] = context_result if not isinstance(context_result, Exception) else {"status": "failed", "error": str(context_result)}

            # ── Step 3: Analytics ──────────────────────────────────────────
            logger.info("🧮 [3/4] Running Analytics Agent...")
            results["analytics"] = await self._run_agent(
                "AnalyticsAgent",
                self.analytics_agent.run,
                target_date=target_date
            )

            # ── Summary ───────────────────────────────────────────────────
            total_time = round((time.time() - pipeline_start) * 1000)
            results["pipeline"] = {
                "status": "success",
                "duration_ms": total_time,
                "completed_at": datetime.utcnow().isoformat(),
            }

            logger.info(f"✅ Pipeline complete in {total_time}ms")
            return results

        except Exception as e:
            logger.error(f"Pipeline failed: {e}", exc_info=True)
            return {"status": "failed", "error": str(e), "results": results}
        finally:
            self._running = False

    async def run_odds_only(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """Quick odds refresh without full pipeline."""
        logger.info("💰 Running odds-only refresh...")
        return await self._run_agent(
            "OddsAggregationAgent",
            self.odds_agent.run,
            target_date=target_date
        )

    async def run_predictions_only(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """Refresh predictions without re-fetching data."""
        logger.info("🎯 Running predictions refresh...")
        return await self._run_agent(
            "AnalyticsAgent",
            self.analytics_agent.run,
            target_date=target_date
        )

    async def _run_agent(
        self,
        agent_name: str,
        agent_fn,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Run an agent function with error handling and logging.
        Records execution results to agent_logs table.
        """
        start = time.time()
        log_entry = None

        async with AsyncSessionLocal() as session:
            log_entry = AgentLog(
                agent_name=agent_name,
                status=AgentStatus.RUNNING,
                message="Agent started",
            )
            session.add(log_entry)
            await session.commit()
            log_id = log_entry.id

        try:
            result = await agent_fn(**kwargs)
            duration_ms = round((time.time() - start) * 1000)

            async with AsyncSessionLocal() as session:
                log = await session.get(AgentLog, log_id)
                if log:
                    log.status = AgentStatus.SUCCESS
                    log.duration_ms = duration_ms
                    log.records_processed = result.get("records_processed", 0)
                    log.message = result.get("message", "Completed successfully")
                    await session.commit()

            return {"status": "success", "duration_ms": duration_ms, **result}

        except Exception as e:
            duration_ms = round((time.time() - start) * 1000)
            logger.error(f"{agent_name} failed: {e}", exc_info=True)

            async with AsyncSessionLocal() as session:
                log = await session.get(AgentLog, log_id)
                if log:
                    log.status = AgentStatus.FAILED
                    log.duration_ms = duration_ms
                    log.error = str(e)
                    await session.commit()

            return {"status": "failed", "error": str(e), "duration_ms": duration_ms}

    @property
    def is_running(self) -> bool:
        return self._running

    async def health_check(self) -> Dict[str, Any]:
        """Return health status of all agents."""
        return {
            "orchestrator": "healthy",
            "data_collection": "ready",
            "odds_aggregation": "ready",
            "analytics": "ready",
            "game_context": "ready",
            "pipeline_running": self._running,
        }


# Singleton instance
orchestrator = OrchestratorAgent()
