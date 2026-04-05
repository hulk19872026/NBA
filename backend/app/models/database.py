"""
Database models using SQLAlchemy 2.0 async ORM.
Schema: games, teams, players, odds, predictions, agent_logs
"""

from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, Date, Text,
    ForeignKey, JSON, Enum as SAEnum, Index, UniqueConstraint
)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
import enum

from app.core.config import settings

# Engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


# ── Enums ────────────────────────────────────────────────────────────────────

class GameStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    FINAL = "final"
    POSTPONED = "postponed"


class AgentStatus(str, enum.Enum):
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    IDLE = "idle"


# ── Models ───────────────────────────────────────────────────────────────────

class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nba_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    abbreviation: Mapped[str] = mapped_column(String(5))
    city: Mapped[str] = mapped_column(String(100))
    conference: Mapped[str] = mapped_column(String(20))
    division: Mapped[str] = mapped_column(String(30))
    logo_url: Mapped[Optional[str]] = mapped_column(String(255))

    # ELO rating
    elo_rating: Mapped[float] = mapped_column(Float, default=1500.0)
    off_rating: Mapped[Optional[float]] = mapped_column(Float)
    def_rating: Mapped[Optional[float]] = mapped_column(Float)
    pace: Mapped[Optional[float]] = mapped_column(Float)
    net_rating: Mapped[Optional[float]] = mapped_column(Float)

    # Season record
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    home_games: Mapped[List["Game"]] = relationship("Game", foreign_keys="Game.home_team_id", back_populates="home_team")
    away_games: Mapped[List["Game"]] = relationship("Game", foreign_keys="Game.away_team_id", back_populates="away_team")
    players: Mapped[List["Player"]] = relationship("Player", back_populates="team")


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nba_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    position: Mapped[Optional[str]] = mapped_column(String(10))
    jersey_number: Mapped[Optional[str]] = mapped_column(String(5))
    team_id: Mapped[Optional[int]] = mapped_column(ForeignKey("teams.id"))
    headshot_url: Mapped[Optional[str]] = mapped_column(String(255))

    # Season averages
    ppg: Mapped[Optional[float]] = mapped_column(Float)
    rpg: Mapped[Optional[float]] = mapped_column(Float)
    apg: Mapped[Optional[float]] = mapped_column(Float)
    minutes: Mapped[Optional[float]] = mapped_column(Float)

    # Injury status
    injury_status: Mapped[Optional[str]] = mapped_column(String(50))  # OUT, QUESTIONABLE, PROBABLE, HEALTHY
    injury_description: Mapped[Optional[str]] = mapped_column(Text)
    injury_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    team: Mapped[Optional["Team"]] = relationship("Team", back_populates="players")


class Game(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nba_game_id: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    game_date: Mapped[date] = mapped_column(Date, index=True)
    game_time: Mapped[Optional[datetime]] = mapped_column(DateTime)
    status: Mapped[GameStatus] = mapped_column(SAEnum(GameStatus), default=GameStatus.SCHEDULED, index=True)
    season: Mapped[str] = mapped_column(String(10))  # e.g. "2024-25"

    home_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)
    away_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)

    # Scores
    home_score: Mapped[Optional[int]] = mapped_column(Integer)
    away_score: Mapped[Optional[int]] = mapped_column(Integer)
    period: Mapped[Optional[int]] = mapped_column(Integer)
    game_clock: Mapped[Optional[str]] = mapped_column(String(10))

    # Context flags
    home_b2b: Mapped[bool] = mapped_column(Boolean, default=False)
    away_b2b: Mapped[bool] = mapped_column(Boolean, default=False)
    home_rest_days: Mapped[Optional[int]] = mapped_column(Integer)
    away_rest_days: Mapped[Optional[int]] = mapped_column(Integer)

    # AI narrative
    game_summary: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    home_team: Mapped["Team"] = relationship("Team", foreign_keys=[home_team_id], back_populates="home_games")
    away_team: Mapped["Team"] = relationship("Team", foreign_keys=[away_team_id], back_populates="away_games")
    odds: Mapped[List["GameOdds"]] = relationship("GameOdds", back_populates="game", cascade="all, delete-orphan")
    prediction: Mapped[Optional["Prediction"]] = relationship("Prediction", back_populates="game", uselist=False)

    __table_args__ = (
        Index("ix_games_date_status", "game_date", "status"),
    )


class GameOdds(Base):
    __tablename__ = "odds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True)
    sportsbook: Mapped[str] = mapped_column(String(50))

    # Moneyline (American format)
    home_ml: Mapped[Optional[int]] = mapped_column(Integer)
    away_ml: Mapped[Optional[int]] = mapped_column(Integer)

    # Spread
    home_spread: Mapped[Optional[float]] = mapped_column(Float)
    home_spread_price: Mapped[Optional[int]] = mapped_column(Integer)
    away_spread: Mapped[Optional[float]] = mapped_column(Float)
    away_spread_price: Mapped[Optional[int]] = mapped_column(Integer)

    # Totals (over/under)
    total: Mapped[Optional[float]] = mapped_column(Float)
    over_price: Mapped[Optional[int]] = mapped_column(Integer)
    under_price: Mapped[Optional[int]] = mapped_column(Integer)

    # Opening line snapshot
    opening_home_ml: Mapped[Optional[int]] = mapped_column(Integer)
    opening_away_ml: Mapped[Optional[int]] = mapped_column(Integer)
    opening_spread: Mapped[Optional[float]] = mapped_column(Float)
    opening_total: Mapped[Optional[float]] = mapped_column(Float)

    is_latest: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    game: Mapped["Game"] = relationship("Game", back_populates="odds")

    __table_args__ = (
        Index("ix_odds_game_book", "game_id", "sportsbook"),
    )


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), unique=True, index=True)

    # Win probability (our model)
    home_win_prob: Mapped[float] = mapped_column(Float)
    away_win_prob: Mapped[float] = mapped_column(Float)

    # Implied probability from best available odds
    home_implied_prob: Mapped[Optional[float]] = mapped_column(Float)
    away_implied_prob: Mapped[Optional[float]] = mapped_column(Float)

    # Edge (model - implied)
    home_edge: Mapped[Optional[float]] = mapped_column(Float)
    away_edge: Mapped[Optional[float]] = mapped_column(Float)

    # Projected total score
    projected_total: Mapped[Optional[float]] = mapped_column(Float)

    # Confidence & model metadata
    confidence_score: Mapped[float] = mapped_column(Float)
    model_version: Mapped[str] = mapped_column(String(20), default="v1.0")
    factors: Mapped[Optional[dict]] = mapped_column(JSON)

    # Recommended bet
    recommended_bet: Mapped[Optional[str]] = mapped_column(String(50))  # HOME_ML, AWAY_ML, OVER, UNDER, NONE
    recommended_units: Mapped[Optional[float]] = mapped_column(Float)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    game: Mapped["Game"] = relationship("Game", back_populates="prediction")


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_name: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[AgentStatus] = mapped_column(SAEnum(AgentStatus))
    message: Mapped[Optional[str]] = mapped_column(Text)
    records_processed: Mapped[Optional[int]] = mapped_column(Integer)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer)
    error: Mapped[Optional[str]] = mapped_column(Text)
    metadata: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ── Session dependency ────────────────────────────────────────────────────────

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
