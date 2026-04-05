"""Odds API router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from app.models.database import AsyncSession, get_db, GameOdds

router = APIRouter()

@router.get("/latest")
async def get_latest_odds(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GameOdds).where(GameOdds.is_latest == True).limit(100)
    )
    odds = result.scalars().all()
    return {
        "odds": [
            {
                "game_id": o.game_id,
                "sportsbook": o.sportsbook,
                "home_ml": o.home_ml,
                "away_ml": o.away_ml,
                "home_spread": o.home_spread,
                "total": o.total,
                "fetched_at": o.fetched_at.isoformat(),
            }
            for o in odds
        ]
    }
