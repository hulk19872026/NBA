"""
Analytics / Probability Agent
==============================
Calculates win probabilities using a multi-factor model:
- ELO ratings (team strength)
- Offensive / Defensive ratings
- Pace adjustments
- Injury impact
- Home court advantage
- Rest days & back-to-back

Compares model probability vs sportsbook implied probability
to detect positive expected value (EV) betting edges.
"""

import math
import logging
from datetime import date, datetime
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy import select

from app.models.database import (
    AsyncSessionLocal, Game, Team, Player, GameOdds, Prediction, GameStatus
)
from app.agents.odds_aggregation import OddsAggregationAgent
from app.core.config import settings

logger = logging.getLogger(__name__)

# Model weights
WEIGHTS = {
    "elo": 0.40,
    "net_rating": 0.30,
    "rest_adjustment": 0.10,
    "injury_adjustment": 0.10,
    "h2h_adjustment": 0.05,
    "pace": 0.05,
}

# Kelly criterion fraction (fractional Kelly for safety)
KELLY_FRACTION = 0.25


class AnalyticsAgent:
    """
    Multi-factor probability model for NBA game predictions.
    Outputs win probability, implied probability, edge %, and bet sizing.
    """

    async def run(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """Calculate predictions for all games on target date."""
        target_date = target_date or date.today()
        logger.info(f"AnalyticsAgent: calculating predictions for {target_date}")

        count = 0
        high_edge_games = []

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Game).where(
                    Game.game_date == target_date,
                    Game.status == GameStatus.SCHEDULED,
                )
            )
            games = result.scalars().all()

            for game in games:
                try:
                    prediction = await self._generate_prediction(session, game)
                    if prediction:
                        # Upsert prediction
                        existing = await session.execute(
                            select(Prediction).where(Prediction.game_id == game.id)
                        )
                        pred_record = existing.scalar_one_or_none()

                        if pred_record:
                            for key, value in prediction.items():
                                setattr(pred_record, key, value)
                            pred_record.updated_at = datetime.utcnow()
                        else:
                            pred_record = Prediction(game_id=game.id, **prediction)
                            session.add(pred_record)

                        count += 1

                        # Track high-edge opportunities
                        edge = max(
                            abs(prediction.get("home_edge", 0) or 0),
                            abs(prediction.get("away_edge", 0) or 0)
                        )
                        if edge >= settings.MIN_EDGE_THRESHOLD:
                            high_edge_games.append({
                                "game_id": game.id,
                                "edge": edge,
                                "recommended_bet": prediction.get("recommended_bet"),
                            })

                except Exception as e:
                    logger.warning(f"Failed to generate prediction for game {game.id}: {e}")

            await session.commit()

        return {
            "records_processed": count,
            "high_edge_games": len(high_edge_games),
            "message": f"Generated predictions for {count} games, {len(high_edge_games)} high-edge opportunities",
            "top_edges": sorted(high_edge_games, key=lambda x: x["edge"], reverse=True)[:5],
        }

    async def _generate_prediction(self, session, game: Game) -> Optional[Dict]:
        """Generate a full prediction for a single game."""
        # Load teams with their ratings
        home_team = await session.get(Team, game.home_team_id)
        away_team = await session.get(Team, game.away_team_id)

        if not home_team or not away_team:
            return None

        # ── Factor 1: ELO win probability ────────────────────────────────
        elo_prob = self._elo_win_probability(
            home_team.elo_rating,
            away_team.elo_rating,
            home_court_advantage=settings.HOME_COURT_ADVANTAGE,
        )

        # ── Factor 2: Net rating adjustment ──────────────────────────────
        rating_prob = self._net_rating_probability(
            home_team.net_rating or 0,
            away_team.net_rating or 0,
        )

        # ── Factor 3: Rest/back-to-back adjustment ────────────────────────
        rest_adj = self._rest_adjustment(
            home_b2b=game.home_b2b,
            away_b2b=game.away_b2b,
            home_rest=game.home_rest_days,
            away_rest=game.away_rest_days,
        )

        # ── Factor 4: Injury impact ───────────────────────────────────────
        home_injury_adj, away_injury_adj = await self._injury_adjustment(session, game)

        # ── Composite probability ─────────────────────────────────────────
        raw_home_prob = (
            WEIGHTS["elo"] * elo_prob
            + WEIGHTS["net_rating"] * rating_prob
            + WEIGHTS["rest_adjustment"] * (0.5 + rest_adj)
            + WEIGHTS["injury_adjustment"] * (0.5 + home_injury_adj - away_injury_adj)
            + WEIGHTS["h2h_adjustment"] * 0.5
            + WEIGHTS["pace"] * 0.5
        )

        # Clamp to reasonable range
        raw_home_prob = max(0.15, min(0.85, raw_home_prob))
        raw_away_prob = 1 - raw_home_prob

        # ── Confidence score ──────────────────────────────────────────────
        confidence = self._confidence_score(home_team, away_team, game)

        # ── Sportsbook implied probability ────────────────────────────────
        latest_odds = await self._get_best_odds(session, game.id)
        home_implied = None
        away_implied = None
        home_edge = None
        away_edge = None
        recommended_bet = "NONE"
        recommended_units = 0.0

        if latest_odds and latest_odds.home_ml and latest_odds.away_ml:
            home_raw_implied = OddsAggregationAgent.american_to_implied_prob(latest_odds.home_ml)
            away_raw_implied = OddsAggregationAgent.american_to_implied_prob(latest_odds.away_ml)

            # Remove vig
            home_implied, away_implied = OddsAggregationAgent.remove_vig(
                home_raw_implied, away_raw_implied
            )

            # Edge = model prob - implied prob
            home_edge = round((raw_home_prob - home_implied) * 100, 2)
            away_edge = round((raw_away_prob - away_implied) * 100, 2)

            # Kelly criterion bet sizing
            if home_edge >= settings.MIN_EDGE_THRESHOLD:
                recommended_bet = "HOME_ML"
                recommended_units = self._kelly_units(raw_home_prob, latest_odds.home_ml)
            elif away_edge >= settings.MIN_EDGE_THRESHOLD:
                recommended_bet = "AWAY_ML"
                recommended_units = self._kelly_units(raw_away_prob, latest_odds.away_ml)

        # ── Projected total ───────────────────────────────────────────────
        projected_total = self._project_total(home_team, away_team)

        return {
            "home_win_prob": round(raw_home_prob * 100, 1),
            "away_win_prob": round(raw_away_prob * 100, 1),
            "home_implied_prob": round(home_implied * 100, 1) if home_implied else None,
            "away_implied_prob": round(away_implied * 100, 1) if away_implied else None,
            "home_edge": home_edge,
            "away_edge": away_edge,
            "projected_total": projected_total,
            "confidence_score": round(confidence * 100, 1),
            "model_version": "v1.0",
            "recommended_bet": recommended_bet,
            "recommended_units": round(recommended_units, 2),
            "factors": {
                "elo_prob": round(elo_prob * 100, 1),
                "rating_prob": round(rating_prob * 100, 1),
                "rest_adjustment": round(rest_adj * 100, 2),
                "home_elo": home_team.elo_rating,
                "away_elo": away_team.elo_rating,
                "home_net_rating": home_team.net_rating,
                "away_net_rating": away_team.net_rating,
            },
        }

    @staticmethod
    def _elo_win_probability(home_elo: float, away_elo: float, home_court_advantage: float = 3.5) -> float:
        """
        Calculate win probability from ELO ratings.
        Home court advantage is worth ~3.5 points = ~100 ELO points.
        """
        elo_diff = home_elo - away_elo + (home_court_advantage * 28.57)  # Convert points to ELO
        return 1 / (1 + 10 ** (-elo_diff / 400))

    @staticmethod
    def _net_rating_probability(home_net: float, away_net: float) -> float:
        """Win probability from net ratings (pts per 100 possessions)."""
        diff = home_net - away_net
        # Logistic function: each net rating point ≈ 3.5% win prob change
        return 1 / (1 + math.exp(-diff * 0.15))

    @staticmethod
    def _rest_adjustment(
        home_b2b: bool,
        away_b2b: bool,
        home_rest: Optional[int],
        away_rest: Optional[int],
    ) -> float:
        """
        Rest advantage factor.
        Returns value between -0.05 and +0.05 relative to home team.
        """
        adj = 0.0
        if home_b2b and not away_b2b:
            adj -= 0.03   # Home team disadvantaged
        elif away_b2b and not home_b2b:
            adj += 0.03   # Away team disadvantaged

        # Rest days
        if home_rest and away_rest:
            rest_diff = home_rest - away_rest
            adj += max(-0.02, min(0.02, rest_diff * 0.005))

        return adj

    @staticmethod
    async def _injury_adjustment(session, game: Game) -> Tuple[float, float]:
        """
        Calculate injury impact on win probability.
        Returns (home_adjustment, away_adjustment) each in [-0.05, 0.05].
        """
        from sqlalchemy import select
        from app.models.database import Player

        home_adj = 0.0
        away_adj = 0.0

        try:
            home_players = await session.execute(
                select(Player).where(
                    Player.team_id == game.home_team_id,
                    Player.injury_status.in_(["OUT", "DOUBTFUL"])
                )
            )
            away_players = await session.execute(
                select(Player).where(
                    Player.team_id == game.away_team_id,
                    Player.injury_status.in_(["OUT", "DOUBTFUL"])
                )
            )

            for player in home_players.scalars():
                ppg = player.ppg or 0
                home_adj -= min(0.03, ppg * 0.001)  # Impact scales with star power

            for player in away_players.scalars():
                ppg = player.ppg or 0
                away_adj -= min(0.03, ppg * 0.001)

        except Exception as e:
            logger.debug(f"Injury adjustment error: {e}")

        return home_adj, away_adj

    @staticmethod
    def _confidence_score(home_team: Team, away_team: Team, game: Game) -> float:
        """
        Confidence in prediction based on data completeness.
        Returns 0.0 - 1.0
        """
        score = 0.5  # Base confidence

        if home_team.net_rating:
            score += 0.15
        if away_team.net_rating:
            score += 0.15
        if home_team.elo_rating != 1500.0:
            score += 0.10
        if away_team.elo_rating != 1500.0:
            score += 0.10

        return min(1.0, score)

    @staticmethod
    def _project_total(home_team: Team, away_team: Team) -> float:
        """Project game total based on pace and offensive ratings."""
        home_pace = home_team.pace or 100.0
        away_pace = away_team.pace or 100.0
        avg_pace = (home_pace + away_pace) / 2

        home_off = home_team.off_rating or 112.0
        away_off = away_team.off_rating or 112.0
        home_def = home_team.def_rating or 112.0
        away_def = away_team.def_rating or 112.0

        # Expected points = (off_rating + opp_def_rating) / 2 * pace / 100
        home_pts = (home_off + away_def) / 2 * avg_pace / 100
        away_pts = (away_off + home_def) / 2 * avg_pace / 100

        return round(home_pts + away_pts, 1)

    @staticmethod
    def _kelly_units(win_prob: float, american_odds: int) -> float:
        """
        Calculate Kelly criterion bet size (in units).
        Uses fractional Kelly for risk management.
        """
        decimal = OddsAggregationAgent.american_to_decimal(american_odds)
        b = decimal - 1  # Net odds received on bet
        q = 1 - win_prob

        kelly = (b * win_prob - q) / b
        fractional_kelly = kelly * KELLY_FRACTION

        return max(0, min(2.0, fractional_kelly * 10))  # Scale to units (max 2u)

    @staticmethod
    async def _get_best_odds(session, game_id: int) -> Optional[GameOdds]:
        """Get the most favorable moneyline odds for a game."""
        result = await session.execute(
            select(GameOdds).where(
                GameOdds.game_id == game_id,
                GameOdds.is_latest == True,
                GameOdds.home_ml.is_not(None),
            ).order_by(GameOdds.fetched_at.desc())
        )
        return result.scalars().first()

    @staticmethod
    def update_elo(winner_elo: float, loser_elo: float, k: float = 20.0) -> Tuple[float, float]:
        """Update ELO ratings after a game result."""
        expected_winner = 1 / (1 + 10 ** ((loser_elo - winner_elo) / 400))
        new_winner = winner_elo + k * (1 - expected_winner)
        new_loser = loser_elo + k * (0 - (1 - expected_winner))
        return round(new_winner, 1), round(new_loser, 1)
