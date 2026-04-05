"""Teams API router."""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from pydantic import BaseModel
from app.models.database import AsyncSession, get_db, Team

router = APIRouter()


class TeamResponse(BaseModel):
    id: int
    nba_id: str
    name: str
    abbreviation: str
    city: str
    conference: str
    division: str
    elo_rating: float
    off_rating: Optional[float]
    def_rating: Optional[float]
    pace: Optional[float]
    net_rating: Optional[float]
    wins: int
    losses: int

    class Config:
        from_attributes = True


@router.get("/", response_model=List[TeamResponse])
async def get_teams(
    conference: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Get all NBA teams, optionally filtered by conference."""
    query = select(Team).order_by(Team.elo_rating.desc())
    if conference:
        query = query.where(Team.conference.ilike(conference))

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(team_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single team by ID."""
    team = await db.get(Team, team_id)
    if not team:
        from fastapi import HTTPException
        raise HTTPException(404, f"Team {team_id} not found")
    return team


@router.get("/abbreviation/{abbr}", response_model=TeamResponse)
async def get_team_by_abbr(abbr: str, db: AsyncSession = Depends(get_db)):
    """Get a team by its abbreviation (e.g. LAL, GSW)."""
    result = await db.execute(select(Team).where(Team.abbreviation == abbr.upper()))
    team = result.scalar_one_or_none()
    if not team:
        from fastapi import HTTPException
        raise HTTPException(404, f"Team {abbr} not found")
    return team
