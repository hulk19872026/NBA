"""Predictions API router."""
from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.database import AsyncSession, get_db, Prediction, Game

router = APIRouter()

@router.get("/top-edges")
async def get_top_edges(
    min_edge: float = Query(default=3.0, description="Minimum edge % threshold"),
    limit: int = Query(default=10, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get top betting edge opportunities."""
    today = date.today()
    result = await db.execute(
        select(Prediction)
        .options(selectinload(Prediction.game))
        .join(Game)
        .where(Game.game_date == today)
        .order_by(Prediction.confidence_score.desc())
        .limit(limit)
    )
    predictions = result.scalars().all()

    edges = []
    for pred in predictions:
        home_edge = pred.home_edge or 0
        away_edge = pred.away_edge or 0
        best_edge = max(abs(home_edge), abs(away_edge))
        if best_edge >= min_edge:
            edges.append({
                "game_id": pred.game_id,
                "home_win_prob": pred.home_win_prob,
                "away_win_prob": pred.away_win_prob,
                "home_edge": home_edge,
                "away_edge": away_edge,
                "best_edge": best_edge,
                "recommended_bet": pred.recommended_bet,
                "recommended_units": pred.recommended_units,
                "confidence_score": pred.confidence_score,
            })

    edges.sort(key=lambda x: x["best_edge"], reverse=True)
    return {"edges": edges, "count": len(edges), "min_edge_threshold": min_edge}
