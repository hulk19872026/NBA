"""
Data Collection Agent
=====================
Fetches and normalizes NBA data from multiple sources:
- NBA Stats API (games, player stats, team stats)
- BallDontLie API (supplemental data)
- Injury reports
"""

import asyncio
import logging
from datetime import date, datetime, timedelta
from typing import Dict, Any, Optional, List
import httpx

from sqlalchemy import select, update
from app.models.database import AsyncSessionLocal, Team, Player, Game, GameStatus
from app.core.config import settings

logger = logging.getLogger(__name__)

# NBA.com headers to bypass basic bot detection
NBA_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://www.nba.com/",
    "Accept": "application/json",
    "x-nba-stats-origin": "stats",
    "x-nba-stats-token": "true",
}

# Team color palette for UI
NBA_TEAM_COLORS = {
    "ATL": {"primary": "#E03A3E", "secondary": "#C1D32F"},
    "BOS": {"primary": "#007A33", "secondary": "#BA9653"},
    "BKN": {"primary": "#000000", "secondary": "#FFFFFF"},
    "CHA": {"primary": "#1D1160", "secondary": "#00788C"},
    "CHI": {"primary": "#CE1141", "secondary": "#000000"},
    "CLE": {"primary": "#860038", "secondary": "#FDBB30"},
    "DAL": {"primary": "#00538C", "secondary": "#B8C4CA"},
    "DEN": {"primary": "#0E2240", "secondary": "#FEC524"},
    "DET": {"primary": "#C8102E", "secondary": "#006BB6"},
    "GSW": {"primary": "#1D428A", "secondary": "#FFC72C"},
    "HOU": {"primary": "#CE1141", "secondary": "#000000"},
    "IND": {"primary": "#002D62", "secondary": "#FDBB30"},
    "LAC": {"primary": "#C8102E", "secondary": "#1D428A"},
    "LAL": {"primary": "#552583", "secondary": "#FDB927"},
    "MEM": {"primary": "#5D76A9", "secondary": "#12173F"},
    "MIA": {"primary": "#98002E", "secondary": "#F9A01B"},
    "MIL": {"primary": "#00471B", "secondary": "#EEE1C6"},
    "MIN": {"primary": "#0C2340", "secondary": "#236192"},
    "NOP": {"primary": "#0C2340", "secondary": "#C8102E"},
    "NYK": {"primary": "#006BB6", "secondary": "#F58426"},
    "OKC": {"primary": "#007AC1", "secondary": "#EF3B24"},
    "ORL": {"primary": "#0077C0", "secondary": "#C4CED4"},
    "PHI": {"primary": "#006BB6", "secondary": "#ED174C"},
    "PHX": {"primary": "#1D1160", "secondary": "#E56020"},
    "POR": {"primary": "#E03A3E", "secondary": "#000000"},
    "SAC": {"primary": "#5A2D81", "secondary": "#63727A"},
    "SAS": {"primary": "#C4CED4", "secondary": "#000000"},
    "TOR": {"primary": "#CE1141", "secondary": "#000000"},
    "UTA": {"primary": "#002B5C", "secondary": "#00471B"},
    "WAS": {"primary": "#002B5C", "secondary": "#E31837"},
}


class DataCollectionAgent:
    """
    Collects and normalizes NBA data from multiple sources.
    Stores clean, structured data in PostgreSQL.
    """

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={"User-Agent": "NBAAnalytics/1.0 (+https://github.com/you/nba-analytics)"}
        )

    async def run(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """Main entry point for the data collection agent."""
        target_date = target_date or date.today()
        logger.info(f"DataCollectionAgent: collecting data for {target_date}")

        results = {
            "date": str(target_date),
            "records_processed": 0,
        }

        try:
            # Run collections concurrently
            teams_task = self.sync_teams()
            games_task = self.sync_games(target_date)
            injuries_task = self.sync_injuries()

            teams_count, games_count, injuries_count = await asyncio.gather(
                teams_task, games_task, injuries_task, return_exceptions=True
            )

            results["teams_synced"] = teams_count if isinstance(teams_count, int) else 0
            results["games_synced"] = games_count if isinstance(games_count, int) else 0
            results["injuries_updated"] = injuries_count if isinstance(injuries_count, int) else 0
            results["records_processed"] = sum(
                v for v in [teams_count, games_count, injuries_count]
                if isinstance(v, int)
            )
            results["message"] = f"Collected {results['records_processed']} records for {target_date}"

        except Exception as e:
            logger.error(f"DataCollectionAgent error: {e}", exc_info=True)
            raise

        return results

    async def sync_teams(self) -> int:
        """Sync all NBA teams from BallDontLie API."""
        logger.info("Syncing NBA teams...")
        count = 0

        try:
            url = f"{settings.BALLDONTLIE_BASE}/teams"
            headers = {}
            if settings.BALLDONTLIE_API_KEY:
                headers["Authorization"] = settings.BALLDONTLIE_API_KEY

            response = await self.client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            teams_data = data.get("data", [])

        except Exception as e:
            logger.warning(f"Failed to fetch from BallDontLie, using seed data: {e}")
            teams_data = self._get_seed_teams()

        async with AsyncSessionLocal() as session:
            for team_raw in teams_data:
                abbr = team_raw.get("abbreviation", "")
                colors = NBA_TEAM_COLORS.get(abbr, {"primary": "#1a1a2e", "secondary": "#e94560"})

                # Upsert team
                result = await session.execute(
                    select(Team).where(Team.nba_id == str(team_raw.get("id", abbr)))
                )
                team = result.scalar_one_or_none()

                if not team:
                    team = Team(
                        nba_id=str(team_raw.get("id", abbr)),
                        name=team_raw.get("full_name", ""),
                        abbreviation=abbr,
                        city=team_raw.get("city", ""),
                        conference=team_raw.get("conference", ""),
                        division=team_raw.get("division", ""),
                    )
                    session.add(team)

                count += 1

            await session.commit()

        logger.info(f"Synced {count} teams")
        return count

    async def sync_games(self, target_date: date) -> int:
        """Sync games for target date and surrounding days."""
        logger.info(f"Syncing games for {target_date}...")
        count = 0

        # Fetch games for today + next 7 days
        for delta in range(-1, 8):
            check_date = target_date + timedelta(days=delta)
            try:
                games = await self._fetch_games_for_date(check_date)
                count += await self._upsert_games(games, check_date)
            except Exception as e:
                logger.warning(f"Failed to fetch games for {check_date}: {e}")

        return count

    async def _fetch_games_for_date(self, game_date: date) -> List[Dict]:
        """Fetch games from BallDontLie API for a specific date."""
        try:
            url = f"{settings.BALLDONTLIE_BASE}/games"
            params = {
                "dates[]": str(game_date),
                "per_page": 100,
            }
            headers = {}
            if settings.BALLDONTLIE_API_KEY:
                headers["Authorization"] = settings.BALLDONTLIE_API_KEY

            response = await self.client.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("data", [])
        except Exception as e:
            logger.warning(f"BallDontLie games fetch failed: {e}")
            return self._get_seed_games(game_date)

    async def _upsert_games(self, games_data: List[Dict], game_date: date) -> int:
        """Insert or update games in database."""
        count = 0
        async with AsyncSessionLocal() as session:
            for game_raw in games_data:
                game_id = str(game_raw.get("id", ""))
                if not game_id:
                    continue

                # Determine status
                status_str = game_raw.get("status", "").lower()
                if "final" in status_str:
                    status = GameStatus.FINAL
                elif "in progress" in status_str or "halftime" in status_str:
                    status = GameStatus.LIVE
                else:
                    status = GameStatus.SCHEDULED

                # Find team records
                home_team_id_nba = str(game_raw.get("home_team", {}).get("id", ""))
                away_team_id_nba = str(game_raw.get("visitor_team", {}).get("id", ""))

                home_result = await session.execute(select(Team).where(Team.nba_id == home_team_id_nba))
                away_result = await session.execute(select(Team).where(Team.nba_id == away_team_id_nba))

                home_team = home_result.scalar_one_or_none()
                away_team = away_result.scalar_one_or_none()

                if not home_team or not away_team:
                    continue

                # Upsert
                result = await session.execute(select(Game).where(Game.nba_game_id == game_id))
                game = result.scalar_one_or_none()

                if not game:
                    game = Game(
                        nba_game_id=game_id,
                        game_date=game_date,
                        season="2024-25",
                        home_team_id=home_team.id,
                        away_team_id=away_team.id,
                        status=status,
                        home_score=game_raw.get("home_team_score"),
                        away_score=game_raw.get("visitor_team_score"),
                    )
                    session.add(game)
                else:
                    game.status = status
                    game.home_score = game_raw.get("home_team_score")
                    game.away_score = game_raw.get("visitor_team_score")

                count += 1

            await session.commit()

        return count

    async def sync_injuries(self) -> int:
        """
        Sync player injury statuses.
        Uses ESPN injury API as primary source.
        """
        logger.info("Syncing injury reports...")
        count = 0

        try:
            url = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries"
            response = await self.client.get(url)
            response.raise_for_status()
            data = response.json()

            async with AsyncSessionLocal() as session:
                for team_data in data.get("injuries", []):
                    for player_data in team_data.get("injuries", []):
                        player_name = player_data.get("athlete", {}).get("displayName", "")
                        status = player_data.get("status", "HEALTHY")
                        description = player_data.get("details", {}).get("detail", "")

                        # Match to player in DB
                        result = await session.execute(
                            select(Player).where(
                                Player.first_name + " " + Player.last_name == player_name
                            )
                        )
                        player = result.scalar_one_or_none()
                        if player:
                            player.injury_status = status
                            player.injury_description = description
                            player.injury_updated_at = datetime.utcnow()
                            count += 1

                await session.commit()

        except Exception as e:
            logger.warning(f"Injury sync failed: {e}")

        return count

    def _get_seed_teams(self) -> List[Dict]:
        """Fallback seed data for all 30 NBA teams."""
        return [
            {"id": "1", "full_name": "Atlanta Hawks", "abbreviation": "ATL", "city": "Atlanta", "conference": "East", "division": "Southeast"},
            {"id": "2", "full_name": "Boston Celtics", "abbreviation": "BOS", "city": "Boston", "conference": "East", "division": "Atlantic"},
            {"id": "3", "full_name": "Brooklyn Nets", "abbreviation": "BKN", "city": "Brooklyn", "conference": "East", "division": "Atlantic"},
            {"id": "4", "full_name": "Charlotte Hornets", "abbreviation": "CHA", "city": "Charlotte", "conference": "East", "division": "Southeast"},
            {"id": "5", "full_name": "Chicago Bulls", "abbreviation": "CHI", "city": "Chicago", "conference": "East", "division": "Central"},
            {"id": "6", "full_name": "Cleveland Cavaliers", "abbreviation": "CLE", "city": "Cleveland", "conference": "East", "division": "Central"},
            {"id": "7", "full_name": "Dallas Mavericks", "abbreviation": "DAL", "city": "Dallas", "conference": "West", "division": "Southwest"},
            {"id": "8", "full_name": "Denver Nuggets", "abbreviation": "DEN", "city": "Denver", "conference": "West", "division": "Northwest"},
            {"id": "9", "full_name": "Detroit Pistons", "abbreviation": "DET", "city": "Detroit", "conference": "East", "division": "Central"},
            {"id": "10", "full_name": "Golden State Warriors", "abbreviation": "GSW", "city": "San Francisco", "conference": "West", "division": "Pacific"},
            {"id": "11", "full_name": "Houston Rockets", "abbreviation": "HOU", "city": "Houston", "conference": "West", "division": "Southwest"},
            {"id": "12", "full_name": "Indiana Pacers", "abbreviation": "IND", "city": "Indianapolis", "conference": "East", "division": "Central"},
            {"id": "13", "full_name": "LA Clippers", "abbreviation": "LAC", "city": "Los Angeles", "conference": "West", "division": "Pacific"},
            {"id": "14", "full_name": "Los Angeles Lakers", "abbreviation": "LAL", "city": "Los Angeles", "conference": "West", "division": "Pacific"},
            {"id": "15", "full_name": "Memphis Grizzlies", "abbreviation": "MEM", "city": "Memphis", "conference": "West", "division": "Southwest"},
            {"id": "16", "full_name": "Miami Heat", "abbreviation": "MIA", "city": "Miami", "conference": "East", "division": "Southeast"},
            {"id": "17", "full_name": "Milwaukee Bucks", "abbreviation": "MIL", "city": "Milwaukee", "conference": "East", "division": "Central"},
            {"id": "18", "full_name": "Minnesota Timberwolves", "abbreviation": "MIN", "city": "Minneapolis", "conference": "West", "division": "Northwest"},
            {"id": "19", "full_name": "New Orleans Pelicans", "abbreviation": "NOP", "city": "New Orleans", "conference": "West", "division": "Southwest"},
            {"id": "20", "full_name": "New York Knicks", "abbreviation": "NYK", "city": "New York", "conference": "East", "division": "Atlantic"},
            {"id": "21", "full_name": "Oklahoma City Thunder", "abbreviation": "OKC", "city": "Oklahoma City", "conference": "West", "division": "Northwest"},
            {"id": "22", "full_name": "Orlando Magic", "abbreviation": "ORL", "city": "Orlando", "conference": "East", "division": "Southeast"},
            {"id": "23", "full_name": "Philadelphia 76ers", "abbreviation": "PHI", "city": "Philadelphia", "conference": "East", "division": "Atlantic"},
            {"id": "24", "full_name": "Phoenix Suns", "abbreviation": "PHX", "city": "Phoenix", "conference": "West", "division": "Pacific"},
            {"id": "25", "full_name": "Portland Trail Blazers", "abbreviation": "POR", "city": "Portland", "conference": "West", "division": "Northwest"},
            {"id": "26", "full_name": "Sacramento Kings", "abbreviation": "SAC", "city": "Sacramento", "conference": "West", "division": "Pacific"},
            {"id": "27", "full_name": "San Antonio Spurs", "abbreviation": "SAS", "city": "San Antonio", "conference": "West", "division": "Southwest"},
            {"id": "28", "full_name": "Toronto Raptors", "abbreviation": "TOR", "city": "Toronto", "conference": "East", "division": "Atlantic"},
            {"id": "29", "full_name": "Utah Jazz", "abbreviation": "UTA", "city": "Salt Lake City", "conference": "West", "division": "Northwest"},
            {"id": "30", "full_name": "Washington Wizards", "abbreviation": "WAS", "city": "Washington", "conference": "East", "division": "Southeast"},
        ]

    def _get_seed_games(self, game_date: date) -> List[Dict]:
        """Return empty list - real data comes from API."""
        return []
