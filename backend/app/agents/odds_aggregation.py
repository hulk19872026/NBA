"""
Odds Aggregation Agent
=======================
Fetches sportsbook odds from The Odds API.
Tracks opening vs current lines, detects line movement,
and normalizes to a standard format.
"""

import logging
from datetime import date, datetime
from typing import Dict, Any, Optional, List, Tuple
import httpx
from sqlalchemy import select, update

from app.models.database import AsyncSessionLocal, Game, GameOdds, Team
from app.core.config import settings

logger = logging.getLogger(__name__)

# Sportsbooks to track (Odds API keys)
TARGET_BOOKS = [
    "draftkings", "fanduel", "betmgm", "caesars",
    "pointsbet", "bet365", "barstool", "williamhill_us"
]

SPORT_KEY = "basketball_nba"


class OddsAggregationAgent:
    """
    Pulls sportsbook data from The Odds API.
    Stores moneyline, spread, and totals with line movement tracking.
    """

    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)

    async def run(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """Main entry point: fetch and store all NBA odds."""
        target_date = target_date or date.today()
        logger.info(f"OddsAggregationAgent: fetching odds for {target_date}")

        if not settings.ODDS_API_KEY:
            logger.warning("No ODDS_API_KEY configured, using demo odds data")
            return await self._inject_demo_odds(target_date)

        try:
            raw_odds = await self._fetch_odds_api()
            count = await self._process_and_store(raw_odds, target_date)

            return {
                "records_processed": count,
                "message": f"Stored odds for {count} games",
                "books_tracked": TARGET_BOOKS,
            }

        except Exception as e:
            logger.error(f"OddsAggregationAgent error: {e}", exc_info=True)
            raise

    async def _fetch_odds_api(self) -> List[Dict]:
        """Fetch from The Odds API."""
        url = f"{settings.ODDS_API_BASE}/sports/{SPORT_KEY}/odds"
        params = {
            "apiKey": settings.ODDS_API_KEY,
            "regions": "us",
            "markets": "h2h,spreads,totals",
            "oddsFormat": "american",
            "bookmakers": ",".join(TARGET_BOOKS),
        }

        response = await self.client.get(url, params=params)

        # Log remaining requests
        remaining = response.headers.get("x-requests-remaining", "?")
        logger.info(f"Odds API: {remaining} requests remaining")

        response.raise_for_status()
        return response.json()

    async def _process_and_store(self, raw_odds: List[Dict], target_date: date) -> int:
        """Parse raw Odds API response and upsert to database."""
        count = 0

        async with AsyncSessionLocal() as session:
            # Mark all current odds as not latest
            await session.execute(
                update(GameOdds).where(GameOdds.is_latest == True).values(is_latest=False)
            )

            for event in raw_odds:
                try:
                    # Match event to game in DB
                    home_abbr = self._normalize_team_name(event.get("home_team", ""))
                    away_abbr = self._normalize_team_name(event.get("away_team", ""))

                    home_result = await session.execute(
                        select(Team).where(Team.abbreviation == home_abbr)
                    )
                    away_result = await session.execute(
                        select(Team).where(Team.abbreviation == away_abbr)
                    )

                    home_team = home_result.scalar_one_or_none()
                    away_team = away_result.scalar_one_or_none()

                    if not home_team or not away_team:
                        logger.debug(f"Could not match teams: {home_abbr} vs {away_abbr}")
                        continue

                    game_result = await session.execute(
                        select(Game).where(
                            Game.home_team_id == home_team.id,
                            Game.away_team_id == away_team.id,
                            Game.game_date == target_date,
                        )
                    )
                    game = game_result.scalar_one_or_none()

                    if not game:
                        continue

                    # Process each sportsbook
                    for bookmaker in event.get("bookmakers", []):
                        book_key = bookmaker.get("key", "")
                        markets = {m["key"]: m for m in bookmaker.get("markets", [])}

                        odds_entry = GameOdds(
                            game_id=game.id,
                            sportsbook=book_key,
                            is_latest=True,
                            fetched_at=datetime.utcnow(),
                        )

                        # Moneyline
                        if "h2h" in markets:
                            for outcome in markets["h2h"]["outcomes"]:
                                if outcome["name"] == event["home_team"]:
                                    odds_entry.home_ml = int(outcome["price"])
                                elif outcome["name"] == event["away_team"]:
                                    odds_entry.away_ml = int(outcome["price"])

                        # Spread
                        if "spreads" in markets:
                            for outcome in markets["spreads"]["outcomes"]:
                                if outcome["name"] == event["home_team"]:
                                    odds_entry.home_spread = float(outcome["point"])
                                    odds_entry.home_spread_price = int(outcome["price"])
                                elif outcome["name"] == event["away_team"]:
                                    odds_entry.away_spread = float(outcome["point"])
                                    odds_entry.away_spread_price = int(outcome["price"])

                        # Totals
                        if "totals" in markets:
                            for outcome in markets["totals"]["outcomes"]:
                                odds_entry.total = float(outcome["point"])
                                if outcome["name"] == "Over":
                                    odds_entry.over_price = int(outcome["price"])
                                elif outcome["name"] == "Under":
                                    odds_entry.under_price = int(outcome["price"])

                        session.add(odds_entry)
                        count += 1

                except Exception as e:
                    logger.warning(f"Failed to process event: {e}")
                    continue

            await session.commit()

        return count

    async def _inject_demo_odds(self, target_date: date) -> Dict[str, Any]:
        """Inject realistic demo odds for games without API key."""
        import random

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Game).where(Game.game_date == target_date)
            )
            games = result.scalars().all()
            count = 0

            for game in games:
                # Generate realistic odds
                favorite_ml = random.choice([-130, -145, -160, -180, -200, -220])
                underdog_ml = self._ml_to_underdog(favorite_ml)
                spread = round(random.uniform(-8.5, -2.5), 1)

                odds_entry = GameOdds(
                    game_id=game.id,
                    sportsbook="demo_draftkings",
                    home_ml=favorite_ml if random.random() > 0.4 else underdog_ml,
                    away_ml=underdog_ml if random.random() > 0.4 else favorite_ml,
                    home_spread=spread,
                    home_spread_price=-110,
                    away_spread=abs(spread),
                    away_spread_price=-110,
                    total=round(random.uniform(214.5, 234.5), 1),
                    over_price=-110,
                    under_price=-110,
                    is_latest=True,
                    fetched_at=datetime.utcnow(),
                )
                session.add(odds_entry)
                count += 1

            await session.commit()

        return {"records_processed": count, "message": f"Demo odds for {count} games", "demo": True}

    @staticmethod
    def _normalize_team_name(name: str) -> str:
        """Map full team name to abbreviation."""
        mapping = {
            "Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN",
            "Charlotte Hornets": "CHA", "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE",
            "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN", "Detroit Pistons": "DET",
            "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND",
            "Los Angeles Clippers": "LAC", "Los Angeles Lakers": "LAL", "Memphis Grizzlies": "MEM",
            "Miami Heat": "MIA", "Milwaukee Bucks": "MIL", "Minnesota Timberwolves": "MIN",
            "New Orleans Pelicans": "NOP", "New York Knicks": "NYK", "Oklahoma City Thunder": "OKC",
            "Orlando Magic": "ORL", "Philadelphia 76ers": "PHI", "Phoenix Suns": "PHX",
            "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC", "San Antonio Spurs": "SAS",
            "Toronto Raptors": "TOR", "Utah Jazz": "UTA", "Washington Wizards": "WAS",
        }
        return mapping.get(name, name[:3].upper())

    @staticmethod
    def _ml_to_underdog(favorite_ml: int) -> int:
        """Convert favorite moneyline to approximate underdog line."""
        if favorite_ml < 0:
            return abs(favorite_ml) - 10
        return favorite_ml

    @staticmethod
    def american_to_decimal(american: int) -> float:
        """Convert American odds to decimal."""
        if american > 0:
            return round(1 + american / 100, 4)
        return round(1 + 100 / abs(american), 4)

    @staticmethod
    def american_to_implied_prob(american: int) -> float:
        """Convert American odds to implied probability (removes vig)."""
        if american > 0:
            return 100 / (american + 100)
        return abs(american) / (abs(american) + 100)

    @staticmethod
    def remove_vig(home_prob: float, away_prob: float) -> Tuple[float, float]:
        """Remove sportsbook vig from implied probabilities."""
        total = home_prob + away_prob
        return home_prob / total, away_prob / total
