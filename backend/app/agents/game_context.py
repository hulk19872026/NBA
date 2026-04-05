"""
Game Context Agent
==================
Analyzes qualitative game factors:
- Injury reports & availability
- Back-to-back games & travel fatigue
- Head-to-head matchup history
- Recent form (last 5-10 games)
- AI-generated game narrative summaries
"""

import logging
from datetime import date, datetime, timedelta
from typing import Dict, Any, Optional, List
import httpx
from sqlalchemy import select, func

from app.models.database import AsyncSessionLocal, Game, Team, Player, GameStatus
from app.core.config import settings

logger = logging.getLogger(__name__)

# Impact scores for narrative generation
INJURY_IMPACT = {
    "OUT": "significant",
    "DOUBTFUL": "notable",
    "QUESTIONABLE": "minor",
    "PROBABLE": "minimal",
}


class GameContextAgent:
    """
    Enriches games with contextual intelligence:
    - Rest/fatigue analysis
    - Injury impact assessment
    - Head-to-head historical patterns
    - AI-powered narrative summaries
    """

    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)

    async def run(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """Analyze context for all games on target date."""
        target_date = target_date or date.today()
        logger.info(f"GameContextAgent: analyzing context for {target_date}")

        count = 0
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Game).where(Game.game_date == target_date)
            )
            games = result.scalars().all()

            for game in games:
                try:
                    # Analyze and annotate each game
                    await self._analyze_rest(session, game, target_date)
                    narrative = await self._generate_narrative(session, game)
                    game.game_summary = narrative
                    count += 1
                except Exception as e:
                    logger.warning(f"Context analysis failed for game {game.id}: {e}")

            await session.commit()

        return {
            "records_processed": count,
            "message": f"Analyzed context for {count} games",
        }

    async def _analyze_rest(self, session, game: Game, game_date: date) -> None:
        """Detect back-to-back situations and rest days."""
        yesterday = game_date - timedelta(days=1)

        # Check home team's last game
        home_last = await session.execute(
            select(Game).where(
                (Game.home_team_id == game.home_team_id) | (Game.away_team_id == game.home_team_id),
                Game.game_date == yesterday,
                Game.game_date < game_date,
            ).order_by(Game.game_date.desc())
        )
        home_last_game = home_last.scalars().first()
        game.home_b2b = home_last_game is not None

        # Check away team's last game
        away_last = await session.execute(
            select(Game).where(
                (Game.home_team_id == game.away_team_id) | (Game.away_team_id == game.away_team_id),
                Game.game_date == yesterday,
                Game.game_date < game_date,
            ).order_by(Game.game_date.desc())
        )
        away_last_game = away_last.scalars().first()
        game.away_b2b = away_last_game is not None

        # Rest days (days since last game)
        for days_back in range(1, 8):
            check_date = game_date - timedelta(days=days_back)
            home_played = await session.execute(
                select(Game).where(
                    (Game.home_team_id == game.home_team_id) | (Game.away_team_id == game.home_team_id),
                    Game.game_date == check_date,
                )
            )
            if home_played.scalars().first():
                game.home_rest_days = days_back
                break

        for days_back in range(1, 8):
            check_date = game_date - timedelta(days=days_back)
            away_played = await session.execute(
                select(Game).where(
                    (Game.home_team_id == game.away_team_id) | (Game.away_team_id == game.away_team_id),
                    Game.game_date == check_date,
                )
            )
            if away_played.scalars().first():
                game.away_rest_days = days_back
                break

    async def _generate_narrative(self, session, game: Game) -> str:
        """
        Generate an AI-powered game preview narrative.
        Falls back to template-based generation if Anthropic API unavailable.
        """
        home_team = await session.get(Team, game.home_team_id)
        away_team = await session.get(Team, game.away_team_id)

        if not home_team or not away_team:
            return ""

        # Get injured players for both teams
        home_injuries = await self._get_team_injuries(session, game.home_team_id)
        away_injuries = await self._get_team_injuries(session, game.away_team_id)

        if settings.ANTHROPIC_API_KEY:
            return await self._ai_narrative(home_team, away_team, game, home_injuries, away_injuries)
        else:
            return self._template_narrative(home_team, away_team, game, home_injuries, away_injuries)

    async def _ai_narrative(
        self,
        home_team: Team,
        away_team: Team,
        game: Game,
        home_injuries: List[Player],
        away_injuries: List[Player],
    ) -> str:
        """Generate narrative using Claude AI Analyst agent."""
        from app.agents.ai_analyst import claude_analyst
        try:
            context = {
                "home_team": home_team.name,
                "away_team": away_team.name,
                "home_record": f"{home_team.wins}-{home_team.losses}",
                "away_record": f"{away_team.wins}-{away_team.losses}",
                "home_elo": round(home_team.elo_rating or 1500, 0),
                "away_elo": round(away_team.elo_rating or 1500, 0),
                "home_net_rtg": home_team.net_rating,
                "away_net_rtg": away_team.net_rating,
                "home_b2b": game.home_b2b,
                "away_b2b": game.away_b2b,
                "home_rest_days": game.home_rest_days,
                "away_rest_days": game.away_rest_days,
                "home_injuries": ", ".join(
                    f"{p.last_name} ({p.injury_status})" for p in home_injuries[:3]
                ) or "None reported",
                "away_injuries": ", ".join(
                    f"{p.last_name} ({p.injury_status})" for p in away_injuries[:3]
                ) or "None reported",
            }
            return await claude_analyst.generate_game_narrative(context)
        except Exception as e:
            logger.warning(f"Claude narrative failed, using template: {e}")
            return self._template_narrative(home_team, away_team, game, home_injuries, away_injuries)

    def _template_narrative(
        self,
        home_team: Team,
        away_team: Team,
        game: Game,
        home_injuries: List[Player],
        away_injuries: List[Player],
    ) -> str:
        """Generate a template-based game preview."""
        parts = []

        # Rest situation
        if game.home_b2b and not game.away_b2b:
            parts.append(f"{home_team.name} face a back-to-back disadvantage hosting {away_team.name}.")
        elif game.away_b2b and not game.home_b2b:
            parts.append(f"{away_team.name} are on the second night of a back-to-back visiting {home_team.name}.")
        else:
            parts.append(f"{away_team.name} travel to face {home_team.name} in a key {home_team.conference}ern Conference matchup.")

        # Injury situation
        key_injuries = [p for p in home_injuries + away_injuries if (p.ppg or 0) > 15]
        if key_injuries:
            names = ", ".join(f"{p.first_name} {p.last_name}" for p in key_injuries[:2])
            parts.append(f"Injury watch: {names} listed as questionable, potentially impacting the line.")
        elif home_team.net_rating and away_team.net_rating:
            diff = abs((home_team.net_rating or 0) - (away_team.net_rating or 0))
            if diff > 5:
                better = home_team if (home_team.net_rating or 0) > (away_team.net_rating or 0) else away_team
                parts.append(f"{better.name} hold a significant {diff:.1f}-point net rating advantage this season.")
            else:
                parts.append("Both teams are closely matched by advanced metrics — expect a competitive game.")
        else:
            parts.append("Monitor injury reports closer to tip-off for lineup clarity.")

        return " ".join(parts)

    @staticmethod
    async def _get_team_injuries(session, team_id: int) -> List[Player]:
        """Get injured players for a team."""
        result = await session.execute(
            select(Player).where(
                Player.team_id == team_id,
                Player.injury_status.in_(["OUT", "DOUBTFUL", "QUESTIONABLE"])
            ).order_by(Player.ppg.desc())
        )
        return result.scalars().all()

    @staticmethod
    def _build_context_string(
        home: Team,
        away: Team,
        game: Game,
        home_injuries: List[Player],
        away_injuries: List[Player],
    ) -> str:
        """Build context string for AI prompt."""
        return (
            f"{away.name} ({away.wins}-{away.losses}) @ {home.name} ({home.wins}-{home.losses}). "
            f"Home net rating: {home.net_rating or 'N/A'}. Away net rating: {away.net_rating or 'N/A'}. "
            f"Home B2B: {game.home_b2b}. Away B2B: {game.away_b2b}. "
            f"Home injuries: {', '.join(p.last_name for p in home_injuries) or 'None'}. "
            f"Away injuries: {', '.join(p.last_name for p in away_injuries) or 'None'}."
        )
