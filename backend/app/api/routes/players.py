"""Players API router."""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
from app.models.database import AsyncSession, get_db, Player

router = APIRouter()


class PlayerResponse(BaseModel):
    id: int
    nba_id: str
    first_name: str
    last_name: str
    position: Optional[str]
    jersey_number: Optional[str]
    team_id: Optional[int]
    ppg: Optional[float]
    rpg: Optional[float]
    apg: Optional[float]
    minutes: Optional[float]
    injury_status: Optional[str]
    injury_description: Optional[str]

    class Config:
        from_attributes = True


@router.get("/", response_model=List[PlayerResponse])
async def get_players(
    team_id: Optional[int] = None,
    injured_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    query = select(Player)
    if team_id:
        query = query.where(Player.team_id == team_id)
    if injured_only:
        query = query.where(Player.injury_status.in_(["OUT", "DOUBTFUL", "QUESTIONABLE"]))
    query = query.order_by(Player.ppg.desc().nullslast())
    result = await db.execute(query)
    return result.scalars().all()
