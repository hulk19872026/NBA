"""
Games API Router
================
Endpoints for NBA game data including odds, predictions, and analytics.
"""

from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.models.database import AsyncSession, get_db, Game, GameOdds, Prediction, Team, GameStatus

router = APIRouter()


# ── Response Schemas ──────────────────────────────────────────────────────────

class TeamSummary(BaseModel):
    id: int
    name: str
    abbreviation: str
    city: str
    elo_rating: float
    net_rating: Optional[float]
    wins: int
    losses: int

    class Config:
        from_attributes = True


class OddsSummary(BaseModel):
    sportsbook: str
    home_ml: Optional[int]
    away_ml: Optional[int]
    home_spread: Optional[float]
    away_spread: Optional[float]
    total: Optional[float]
    over_price: Optional[int]
    under_price: Optional[int]
    fetched_at: datetime

    class Config:
        from_attributes = True


class PredictionSummary(BaseModel):
    home_win_prob: float
    away_win_prob: float
    home_implied_prob: Optional[float]
    away_implied_prob: Optional[float]
    home_edge: Optional[float]
    away_edge: Optional[float]
    projected_total: Optional[float]
    confidence_score: float
    recommended_bet: Optional[str]
    recommended_units: Optional[float]
    factors: Optional[dict]

    class Config:
        from_attributes = True


class GameResponse(BaseModel):
    id: int
    nba_game_id: str
    game_date: date
    game_time: Optional[datetime]
    status: str
    season: str
    home_team: TeamSummary
    away_team: TeamSummary
    home_score: Optional[int]
    away_score: Optional[int]
    home_b2b: bool
    away_b2b: bool
    home_rest_days: Optional[int]
    away_rest_days: Optional[int]
    game_summary: Optional[str]
    odds: List[OddsSummary]
    prediction: Optional[PredictionSummary]

    class Config:
        from_attributes = True


class GamesListResponse(BaseModel):
    games: List[GameResponse]
    total: int
    date: str
    high_edge_count: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=GamesListResponse)
async def get_games(
    game_date: Optional[date] = Query(default=None, description="Date (YYYY-MM-DD). Defaults to today."),
    status: Optional[str] = Query(default=None, description="Filter by status: scheduled, live, final"),
    team: Optional[str] = Query(default=None, description="Filter by team abbreviation"),
    min_edge: Optional[float] = Query(default=None, description="Minimum edge % to filter"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all NBA games for a date with odds, predictions, and analytics.
    Default returns today's games.
    """
    target_date = game_date or date.today()

    # Build query
    conditions = [Game.game_date == target_date]

    if status:
        try:
            conditions.append(Game.status == GameStatus(status.lower()))
        except ValueError:
            raise HTTPException(400, f"Invalid status: {status}")

    query = (
        select(Game)
        .options(
            selectinload(Game.home_team),
            selectinload(Game.away_team),
            selectinload(Game.prediction),
            selectinload(Game.odds),
        )
        .where(and_(*conditions))
        .order_by(Game.game_time.asc().nullslast())
    )

    result = await db.execute(query)
    games = result.scalars().unique().all()

    # Filter by team
    if team:
        team_upper = team.upper()
        games = [
            g for g in games
            if g.home_team.abbreviation == team_upper or g.away_team.abbreviation == team_upper
        ]

    # Filter by edge
    if min_edge is not None:
        games = [
            g for g in games
            if g.prediction and (
                abs(g.prediction.home_edge or 0) >= min_edge or
                abs(g.prediction.away_edge or 0) >= min_edge
            )
        ]

    # Count high-edge games
    high_edge_count = sum(
        1 for g in games
        if g.prediction and (
            abs(g.prediction.home_edge or 0) >= 3 or
            abs(g.prediction.away_edge or 0) >= 3
        )
    )

    # Build response - filter odds to latest only
    game_responses = []
    for game in games:
        latest_odds = [o for o in game.odds if o.is_latest]
        game_dict = {
            "id": game.id,
            "nba_game_id": game.nba_game_id,
            "game_date": game.game_date,
            "game_time": game.game_time,
            "status": game.status.value,
            "season": game.season,
            "home_team": game.home_team,
            "away_team": game.away_team,
            "home_score": game.home_score,
            "away_score": game.away_score,
            "home_b2b": game.home_b2b,
            "away_b2b": game.away_b2b,
            "home_rest_days": game.home_rest_days,
            "away_rest_days": game.away_rest_days,
            "game_summary": game.game_summary,
            "odds": latest_odds,
            "prediction": game.prediction,
        }
        game_responses.append(GameResponse(**game_dict))

    return GamesListResponse(
        games=game_responses,
        total=len(game_responses),
        date=str(target_date),
        high_edge_count=high_edge_count,
    )


@router.get("/{game_id}", response_model=GameResponse)
async def get_game(
    game_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a single game with full details."""
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

    latest_odds = [o for o in game.odds if o.is_latest]

    return GameResponse(
        id=game.id,
        nba_game_id=game.nba_game_id,
        game_date=game.game_date,
        game_time=game.game_time,
        status=game.status.value,
        season=game.season,
        home_team=game.home_team,
        away_team=game.away_team,
        home_score=game.home_score,
        away_score=game.away_score,
        home_b2b=game.home_b2b,
        away_b2b=game.away_b2b,
        home_rest_days=game.home_rest_days,
        away_rest_days=game.away_rest_days,
        game_summary=game.game_summary,
        odds=latest_odds,
        prediction=game.prediction,
    )


@router.get("/{game_id}/odds-history")
async def get_odds_history(
    game_id: int,
    sportsbook: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get full odds history for a game (line movement tracking)."""
    conditions = [GameOdds.game_id == game_id]
    if sportsbook:
        conditions.append(GameOdds.sportsbook == sportsbook)

    result = await db.execute(
        select(GameOdds)
        .where(and_(*conditions))
        .order_by(GameOdds.fetched_at.asc())
    )
    history = result.scalars().all()

    return {
        "game_id": game_id,
        "history": [
            {
                "sportsbook": o.sportsbook,
                "home_ml": o.home_ml,
                "away_ml": o.away_ml,
                "home_spread": o.home_spread,
                "total": o.total,
                "fetched_at": o.fetched_at.isoformat(),
            }
            for o in history
        ],
    }
