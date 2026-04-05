"""
AI API Router
=============
All Claude-powered endpoints:
  POST /api/ai/chat          — Streaming chat with platform context
  POST /api/ai/chat/sync     — Non-streaming chat (for simple clients)
  GET  /api/ai/slate         — Daily slate analysis
  GET  /api/ai/edge/{game_id} — Betting edge explanation for a game
  GET  /api/ai/injuries/{team_id} — Injury impact assessment
  POST /api/ai/line-movement — Interpret line movement signals
  GET  /api/ai/recap/{game_id}   — Post-game recap with model review
"""

import json
import logging
from datetime import date
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.agents.ai_analyst import claude_analyst
from app.models.database import (
    AsyncSession, get_db, AsyncSessionLocal,
    Game, Team, Player, GameOdds, Prediction, GameStatus
)
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Request/Response models ───────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    response: str
    model: str

class LineMovementRequest(BaseModel):
    game_id: int
    opening_home_ml: Optional[int] = None
    opening_away_ml: Optional[int] = None
    opening_spread: Optional[float] = None
    opening_total: Optional[float] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_platform_context(db: AsyncSession) -> Dict[str, Any]:
    """Build today's platform context for Claude's system prompt."""
    today = date.today()

    result = await db.execute(
        select(Game)
        .options(
            selectinload(Game.home_team),
            selectinload(Game.away_team),
            selectinload(Game.prediction),
            selectinload(Game.odds),
        )
        .where(Game.game_date == today)
        .order_by(Game.game_time.asc().nullslast())
    )
    games = result.scalars().unique().all()

    games_context = []
    for g in games:
        latest_odds = next((o for o in g.odds if o.is_latest), None)
        pred = g.prediction
        games_context.append({
            "home_abbr": g.home_team.abbreviation,
            "away_abbr": g.away_team.abbreviation,
            "home_team": g.home_team.name,
            "away_team": g.away_team.name,
            "status": g.status.value,
            "home_score": g.home_score,
            "away_score": g.away_score,
            "home_ml": latest_odds.home_ml if latest_odds else None,
            "away_ml": latest_odds.away_ml if latest_odds else None,
            "spread": latest_odds.home_spread if latest_odds else None,
            "total": latest_odds.total if latest_odds else None,
            "prediction": {
                "home_win_prob": pred.home_win_prob if pred else None,
                "away_win_prob": pred.away_win_prob if pred else None,
                "home_edge": pred.home_edge if pred else None,
                "away_edge": pred.away_edge if pred else None,
                "recommended_bet": pred.recommended_bet if pred else None,
                "confidence_score": pred.confidence_score if pred else None,
            } if pred else None,
        })

    # Top edges
    top_edges = []
    for g in games:
        if g.prediction:
            home_e = abs(g.prediction.home_edge or 0)
            away_e = abs(g.prediction.away_edge or 0)
            best = max(home_e, away_e)
            if best >= 3:
                top_edges.append({
                    "game_id": g.id,
                    "best_edge": best,
                    "recommended_bet": g.prediction.recommended_bet,
                    "confidence_score": g.prediction.confidence_score,
                })
    top_edges.sort(key=lambda x: x["best_edge"], reverse=True)

    return {"games": games_context, "top_edges": top_edges[:5]}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat_streaming(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Streaming chat endpoint. Returns Server-Sent Events.
    Frontend consumes with EventSource or fetch + ReadableStream.
    """
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(503, "AI features require ANTHROPIC_API_KEY to be configured")

    platform_context = await _get_platform_context(db)

    history = [{"role": m.role, "content": m.content} for m in request.history[-10:]]

    async def event_stream():
        try:
            async for chunk in claude_analyst.chat_stream(
                user_message=request.message,
                conversation_history=history,
                platform_context=platform_context,
            ):
                # SSE format
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Chat stream error: {e}", exc_info=True)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chat/sync", response_model=ChatResponse)
async def chat_sync(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """Non-streaming chat for simpler integrations."""
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(503, "AI features require ANTHROPIC_API_KEY")

    platform_context = await _get_platform_context(db)
    history = [{"role": m.role, "content": m.content} for m in request.history[-10:]]

    full_response = ""
    async for chunk in claude_analyst.chat_stream(
        user_message=request.message,
        conversation_history=history,
        platform_context=platform_context,
    ):
        full_response += chunk

    return ChatResponse(response=full_response, model="claude-sonnet-4-6")


@router.get("/slate")
async def get_slate_analysis(
    target_date: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Full AI-generated betting slate analysis for the day."""
    target_date = target_date or date.today()

    result = await db.execute(
        select(Game)
        .options(
            selectinload(Game.home_team),
            selectinload(Game.away_team),
            selectinload(Game.prediction),
            selectinload(Game.odds),
        )
        .where(Game.game_date == target_date, Game.status == GameStatus.SCHEDULED)
    )
    games = result.scalars().unique().all()

    games_data = []
    for g in games:
        latest = next((o for o in g.odds if o.is_latest), None)
        pred = g.prediction
        games_data.append({
            "home_abbr": g.home_team.abbreviation,
            "away_abbr": g.away_team.abbreviation,
            "home_ml": latest.home_ml if latest else None,
            "away_ml": latest.away_ml if latest else None,
            "home_win_prob": pred.home_win_prob if pred else 50,
            "away_win_prob": pred.away_win_prob if pred else 50,
            "best_edge": max(abs(pred.home_edge or 0), abs(pred.away_edge or 0)) if pred else 0,
            "confidence": pred.confidence_score if pred else 50,
        })

    analysis = await claude_analyst.analyze_daily_slate(games_data)

    return {
        "date": str(target_date),
        "games_analyzed": len(games_data),
        "analysis": analysis,
        "model": "claude-sonnet-4-6",
        "generated_at": date.today().isoformat(),
    }


@router.get("/edge/{game_id}")
async def get_edge_explanation(
    game_id: int,
    db: AsyncSession = Depends(get_db),
):
    """AI explanation of why our model disagrees with the sportsbook on a game."""
    result = await db.execute(
        select(Game)
        .options(
            selectinload(Game.home_team),
            selectinload(Game.away_team),
            selectinload(Game.prediction),
            selectinload(Game.odds),
        )
        .where(Game.id == game_id)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, f"Game {game_id} not found")

    pred = game.prediction
    latest = next((o for o in game.odds if o.is_latest), None)

    if not pred:
        return {"explanation": "No prediction available for this game yet.", "model": None}

    home_edge = pred.home_edge or 0
    away_edge = pred.away_edge or 0
    is_home_edge = abs(home_edge) > abs(away_edge)
    best_edge = home_edge if is_home_edge else away_edge
    model_prob = pred.home_win_prob if is_home_edge else pred.away_win_prob
    implied_prob = pred.home_implied_prob if is_home_edge else pred.away_implied_prob

    edge_context = {
        "home_team": game.home_team.name,
        "away_team": game.away_team.name,
        "recommended_bet": pred.recommended_bet,
        "model_prob": model_prob,
        "implied_prob": implied_prob,
        "edge": round(best_edge, 1),
        "home_ml": latest.home_ml if latest else None,
        "away_ml": latest.away_ml if latest else None,
        "spread": latest.home_spread if latest else None,
        "total": latest.total if latest else None,
        "elo_diff": round((game.home_team.elo_rating or 1500) - (game.away_team.elo_rating or 1500), 0),
        "net_rtg_diff": round((game.home_team.net_rating or 0) - (game.away_team.net_rating or 0), 1),
        "rest_advantage": "Home B2B" if game.home_b2b else ("Away B2B" if game.away_b2b else "Even"),
        "injury_impact": "See injury report",
    }

    explanation = await claude_analyst.explain_betting_edge(edge_context)

    return {
        "game_id": game_id,
        "matchup": f"{game.away_team.abbreviation} @ {game.home_team.abbreviation}",
        "edge": round(best_edge, 1),
        "recommended_bet": pred.recommended_bet,
        "explanation": explanation,
        "model": "claude-haiku-4-5-20251001",
    }


@router.get("/injuries/{team_id}")
async def get_injury_impact(
    team_id: int,
    db: AsyncSession = Depends(get_db),
):
    """AI assessment of a team's injury situation and its impact."""
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(404, f"Team {team_id} not found")

    result = await db.execute(
        select(Player).where(
            Player.team_id == team_id,
            Player.injury_status.in_(["OUT", "DOUBTFUL", "QUESTIONABLE"])
        ).order_by(Player.ppg.desc().nullslast())
    )
    injured = result.scalars().all()

    injured_data = [
        {
            "name": f"{p.first_name} {p.last_name}",
            "status": p.injury_status,
            "injury": p.injury_description or "undisclosed",
            "ppg": p.ppg or 0,
            "minutes": p.minutes or 0,
        }
        for p in injured
    ]

    team_stats = {
        "net_rtg": team.net_rating,
        "off_rtg": team.off_rating,
        "def_rtg": team.def_rating,
    }

    assessment = await claude_analyst.assess_injury_impact(
        team_name=team.name,
        injured_players=injured_data,
        team_stats=team_stats,
    )

    return {
        "team_id": team_id,
        "team": team.name,
        "injured_count": len(injured),
        "players": injured_data,
        "assessment": assessment,
        "model": "claude-haiku-4-5-20251001",
    }


@router.post("/line-movement")
async def interpret_line_movement(
    request: LineMovementRequest,
    db: AsyncSession = Depends(get_db),
):
    """AI interpretation of line movement — sharp action vs. public money."""
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.home_team), selectinload(Game.away_team), selectinload(Game.odds))
        .where(Game.id == request.game_id)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, f"Game {request.game_id} not found")

    latest = next((o for o in game.odds if o.is_latest), None)

    opening = {
        "home_ml": request.opening_home_ml or (latest.opening_home_ml if latest else None),
        "away_ml": request.opening_away_ml or (latest.opening_away_ml if latest else None),
        "spread": request.opening_spread or (latest.opening_spread if latest else None),
        "total": request.opening_total or (latest.opening_total if latest else None),
    }
    current = {
        "home_ml": latest.home_ml if latest else None,
        "away_ml": latest.away_ml if latest else None,
        "spread": latest.home_spread if latest else None,
        "total": latest.total if latest else None,
    }

    interpretation = await claude_analyst.interpret_line_movement(
        game={"home_team": game.home_team.name, "away_team": game.away_team.name},
        opening_odds=opening,
        current_odds=current,
    )

    return {
        "game_id": request.game_id,
        "matchup": f"{game.away_team.abbreviation} @ {game.home_team.abbreviation}",
        "opening": opening,
        "current": current,
        "interpretation": interpretation,
        "model": "claude-haiku-4-5-20251001",
    }


@router.get("/recap/{game_id}")
async def get_game_recap(
    game_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Post-game recap with model accuracy review."""
    result = await db.execute(
        select(Game)
        .options(
            selectinload(Game.home_team),
            selectinload(Game.away_team),
            selectinload(Game.prediction),
        )
        .where(Game.id == game_id, Game.status == GameStatus.FINAL)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, "Final game not found")

    pred = game.prediction
    home_won = (game.home_score or 0) > (game.away_score or 0)
    model_correct = None
    bet_result = "No bet recommended"

    if pred:
        model_pick = game.home_team.abbreviation if pred.home_win_prob > 50 else game.away_team.abbreviation
        model_correct = (model_pick == game.home_team.abbreviation) == home_won
        if pred.recommended_bet and pred.recommended_bet != "NONE":
            if "HOME" in pred.recommended_bet:
                bet_result = "WIN" if home_won else "LOSS"
            elif "AWAY" in pred.recommended_bet:
                bet_result = "WIN" if not home_won else "LOSS"

    game_result = {
        "home_team": game.home_team.name,
        "away_team": game.away_team.name,
        "home_score": game.home_score,
        "away_score": game.away_score,
        "model_pick": game.home_team.abbreviation if (pred and pred.home_win_prob > 50) else game.away_team.abbreviation,
        "model_prob": pred.home_win_prob if pred else 50,
        "model_correct": model_correct,
        "bet_result": bet_result,
        "recommended_bet": pred.recommended_bet if pred else None,
        "key_factors": game.game_summary or "Game completed",
    }

    recap = await claude_analyst.generate_post_game_recap(game_result)

    return {
        "game_id": game_id,
        "matchup": f"{game.away_team.abbreviation} @ {game.home_team.abbreviation}",
        "score": f"{game.away_score}-{game.home_score}",
        "model_correct": model_correct,
        "bet_result": bet_result,
        "recap": recap,
        "model": "claude-haiku-4-5-20251001",
    }
