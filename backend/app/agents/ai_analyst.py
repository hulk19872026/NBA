"""
Claude AI Analyst Agent
=======================
Deep integration with Anthropic's Claude API for:

1. Game narrative generation — rich pre-game analysis
2. Betting edge explanations — why our model disagrees with the market
3. Injury impact assessment — natural language injury reports
4. Daily betting slate analysis — ranked opportunities with reasoning
5. Live game commentary — in-game context and momentum
6. Chat Q&A — answer user questions about games, teams, odds

Uses claude-sonnet-4-6 for complex analysis, claude-haiku-4-5-20251001 for
high-frequency lightweight tasks (narratives per game).
"""

import json
import logging
from datetime import date, datetime
from typing import Dict, Any, Optional, List, AsyncGenerator
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

ANTHROPIC_BASE = "https://api.anthropic.com/v1"
SONNET_MODEL   = "claude-sonnet-4-6"
HAIKU_MODEL    = "claude-haiku-4-5-20251001"

SYSTEM_NBA_ANALYST = """You are CourtEdge, an elite NBA analytics AI embedded in a professional sports intelligence platform.

Your expertise:
- Advanced NBA statistics (PER, ORTG, DRTG, TS%, BPM, RAPTOR, EPM)
- Betting markets: line movement, sharp action, public bias, closing line value
- ELO-based win probability models and their limitations
- Injury impact modeling based on player usage and positional value
- Back-to-back fatigue research and schedule analysis
- Historical matchup patterns and coaching tendencies

Tone: Sharp, analytical, confident. Like a quant who also watches every game.
Format: Concise. No filler. Lead with the most important insight.
Numbers: Always cite specific stats when available. Round to 1 decimal.
Never: Hedge excessively, use generic phrases like "it's a tough game", or give obvious takes."""


class ClaudeAnalystAgent:
    """
    All Claude AI-powered features for the NBA Analytics Platform.
    Handles everything from per-game narratives to the live chat assistant.
    """

    def __init__(self):
        self.client = httpx.AsyncClient(timeout=60.0)
        self._ready = bool(settings.ANTHROPIC_API_KEY)
        if not self._ready:
            logger.warning("ANTHROPIC_API_KEY not set — AI features will use fallback templates")

    # ── Core Claude call ────────────────────────────────────────────────────

    async def _call_claude(
        self,
        messages: List[Dict],
        system: str = SYSTEM_NBA_ANALYST,
        model: str = HAIKU_MODEL,
        max_tokens: int = 600,
        stream: bool = False,
    ) -> str:
        """Single Claude API call with error handling."""
        if not self._ready:
            raise ValueError("ANTHROPIC_API_KEY not configured")

        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": messages,
        }

        response = await self.client.post(
            f"{ANTHROPIC_BASE}/messages",
            headers={
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data["content"][0]["text"].strip()

    async def _call_claude_stream(
        self,
        messages: List[Dict],
        system: str = SYSTEM_NBA_ANALYST,
        model: str = SONNET_MODEL,
        max_tokens: int = 1000,
    ) -> AsyncGenerator[str, None]:
        """Streaming Claude API call — yields text chunks for SSE."""
        if not self._ready:
            yield "AI analyst requires ANTHROPIC_API_KEY to be configured."
            return

        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": messages,
            "stream": True,
        }

        async with self.client.stream(
            "POST",
            f"{ANTHROPIC_BASE}/messages",
            headers={
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    chunk = line[6:]
                    if chunk == "[DONE]":
                        break
                    try:
                        event = json.loads(chunk)
                        if event.get("type") == "content_block_delta":
                            delta = event.get("delta", {})
                            if delta.get("type") == "text_delta":
                                yield delta.get("text", "")
                    except json.JSONDecodeError:
                        continue

    # ── 1. Game Narratives ──────────────────────────────────────────────────

    async def generate_game_narrative(self, game_context: Dict) -> str:
        """
        Generate a 2-3 sentence pre-game analysis for a single matchup.
        Called by GameContextAgent for each scheduled game.

        game_context keys:
          home_team, away_team, home_record, away_record,
          home_net_rtg, away_net_rtg, home_elo, away_elo,
          home_b2b, away_b2b, home_rest_days, away_rest_days,
          home_injuries, away_injuries,
          home_win_prob, away_win_prob, edge, recommended_bet
        """
        home = game_context.get("home_team", "Home")
        away = game_context.get("away_team", "Away")

        prompt = f"""Write a 2-sentence pre-game analysis for this NBA matchup:

{away} ({game_context.get('away_record','?-?')}) @ {home} ({game_context.get('home_record','?-?')})

Key data:
- Home ELO: {game_context.get('home_elo', 'N/A')} | Away ELO: {game_context.get('away_elo', 'N/A')}
- Home Net Rating: {game_context.get('home_net_rtg', 'N/A')} | Away Net Rating: {game_context.get('away_net_rtg', 'N/A')}
- Home B2B: {game_context.get('home_b2b', False)} | Away B2B: {game_context.get('away_b2b', False)}
- Home Rest Days: {game_context.get('home_rest_days', 'N/A')} | Away Rest Days: {game_context.get('away_rest_days', 'N/A')}
- Key Home Injuries: {game_context.get('home_injuries', 'None reported')}
- Key Away Injuries: {game_context.get('away_injuries', 'None reported')}
- Model Win Probability: {home} {game_context.get('home_win_prob', '?')}% | {away} {game_context.get('away_win_prob', '?')}%
- Detected Edge: {game_context.get('edge', 'None')}

Focus on the #1 factor that will decide this game. Be specific and analytical."""

        try:
            return await self._call_claude(
                [{"role": "user", "content": prompt}],
                model=HAIKU_MODEL,
                max_tokens=200,
            )
        except Exception as e:
            logger.warning(f"Narrative generation failed: {e}")
            return self._fallback_narrative(game_context)

    # ── 2. Edge Explanation ─────────────────────────────────────────────────

    async def explain_betting_edge(self, edge_context: Dict) -> str:
        """
        Generate a detailed explanation of WHY our model disagrees with
        the sportsbook on a specific game.

        Used in the Betting Edge insights page for high-edge picks.
        """
        prompt = f"""Explain why our model disagrees with the sportsbook on this game.

Matchup: {edge_context.get('away_team')} @ {edge_context.get('home_team')}
Bet recommendation: {edge_context.get('recommended_bet')}

Our model probability: {edge_context.get('model_prob')}%
Sportsbook implied probability (no-vig): {edge_context.get('implied_prob')}%
Edge: +{edge_context.get('edge')}%

Moneyline: Home {edge_context.get('home_ml')} | Away {edge_context.get('away_ml')}
Spread: {edge_context.get('spread')}
Total: {edge_context.get('total')}

Model factors:
- ELO differential: {edge_context.get('elo_diff', 'N/A')}
- Net rating differential: {edge_context.get('net_rtg_diff', 'N/A')}
- Rest advantage: {edge_context.get('rest_advantage', 'None')}
- Injury impact: {edge_context.get('injury_impact', 'None')}

Write 3 bullet points explaining:
1. The primary reason the model finds value here
2. What the market is likely mis-pricing
3. The main risk to this thesis

Be specific. Cite numbers. Max 20 words per bullet."""

        try:
            return await self._call_claude(
                [{"role": "user", "content": prompt}],
                model=HAIKU_MODEL,
                max_tokens=300,
            )
        except Exception as e:
            logger.warning(f"Edge explanation failed: {e}")
            return "• Model detects statistical value vs. market pricing.\n• Sportsbook likely over-reacting to recent results.\n• Key risk: injury status closer to tip-off."

    # ── 3. Daily Slate Analysis ─────────────────────────────────────────────

    async def analyze_daily_slate(self, games: List[Dict]) -> str:
        """
        Generate a comprehensive daily betting slate analysis.
        Ranks all games by opportunity quality with detailed reasoning.
        Called once per day after all agent data is collected.
        """
        if not games:
            return "No games scheduled today."

        games_summary = "\n".join([
            f"- {g.get('away_abbr')} @ {g.get('home_abbr')}: "
            f"ML {g.get('away_ml')}/{g.get('home_ml')}, "
            f"Edge: {g.get('best_edge', 0):.1f}%, "
            f"Model: {g.get('home_win_prob', 50):.0f}% home, "
            f"Conf: {g.get('confidence', 50):.0f}%"
            for g in games
        ])

        prompt = f"""You are analyzing today's NBA betting slate ({len(games)} games).

Game data:
{games_summary}

Provide a structured daily slate breakdown:

**TODAY'S SLATE SUMMARY**
[2 sentences on the overall day — volume, quality of edges, any standout spots]

**TOP PLAYS** (only games with edge ≥ 3%)
For each: Team ML | Edge % | Confidence | 1-sentence rationale

**TOTALS WATCH**
[Any totals with notable model vs. market discrepancy]

**FADES TO CONSIDER**
[1-2 public teams the model thinks are overvalued]

**BANKROLL NOTE**
[Kelly-based suggestion on overall day sizing — conservative/moderate/aggressive]

Keep each section tight. Total response under 300 words."""

        try:
            return await self._call_claude(
                [{"role": "user", "content": prompt}],
                model=SONNET_MODEL,
                max_tokens=500,
            )
        except Exception as e:
            logger.warning(f"Slate analysis failed: {e}")
            return "Slate analysis unavailable — check ANTHROPIC_API_KEY configuration."

    # ── 4. Injury Impact Report ─────────────────────────────────────────────

    async def assess_injury_impact(
        self,
        team_name: str,
        injured_players: List[Dict],
        team_stats: Dict,
    ) -> str:
        """
        Assess how a team's injury situation affects their win probability.
        Returns a structured impact assessment.
        """
        if not injured_players:
            return f"{team_name} are at full strength — no injury concerns."

        players_str = "\n".join([
            f"  - {p.get('name')}: {p.get('status')} ({p.get('injury', 'undisclosed')}) "
            f"— {p.get('ppg', 0):.1f} PPG, {p.get('minutes', 0):.1f} MPG"
            for p in injured_players
        ])

        prompt = f"""Assess the injury situation for {team_name}.

Team stats: {team_stats.get('net_rtg', 'N/A')} net rating, {team_stats.get('off_rtg', 'N/A')} ORTG, {team_stats.get('def_rtg', 'N/A')} DRTG

Injured/questionable players:
{players_str}

Provide:
1. **Win probability impact**: Estimated % change (e.g., -4.2%) with reasoning
2. **Lineup implications**: How does the rotation change?  
3. **Matchup effect**: Which opponent schemes now become more dangerous?

Be quantitative where possible. Max 150 words total."""

        try:
            return await self._call_claude(
                [{"role": "user", "content": prompt}],
                model=HAIKU_MODEL,
                max_tokens=250,
            )
        except Exception as e:
            logger.warning(f"Injury assessment failed: {e}")
            return f"{team_name} injury report: {len(injured_players)} player(s) listed. Monitor status closer to tip-off."

    # ── 5. Chat Q&A (Streaming) ─────────────────────────────────────────────

    async def chat_stream(
        self,
        user_message: str,
        conversation_history: List[Dict],
        platform_context: Dict,
    ) -> AsyncGenerator[str, None]:
        """
        Streaming chat for the dashboard AI assistant.
        Has full access to today's game data, odds, predictions.
        Streams text chunks for real-time UI updates.
        """
        # Build context string from platform data
        today_games = platform_context.get("games", [])
        top_edges = platform_context.get("top_edges", [])

        context_block = f"""
Current platform data (as of {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}):

TODAY'S GAMES ({len(today_games)} total):
{self._format_games_for_context(today_games)}

TOP EDGE OPPORTUNITIES:
{self._format_edges_for_context(top_edges)}
"""

        system_with_context = f"""{SYSTEM_NBA_ANALYST}

You have access to real-time NBA analytics data:
{context_block}

Answer questions about today's games, odds, predictions, or general NBA analytics.
If asked about specific games, reference the actual data above.
If data isn't available, say so clearly rather than guessing."""

        messages = conversation_history + [
            {"role": "user", "content": user_message}
        ]

        async for chunk in self._call_claude_stream(
            messages=messages,
            system=system_with_context,
            model=SONNET_MODEL,
            max_tokens=800,
        ):
            yield chunk

    # ── 6. Line Movement Interpretation ────────────────────────────────────

    async def interpret_line_movement(
        self,
        game: Dict,
        opening_odds: Dict,
        current_odds: Dict,
    ) -> str:
        """
        Interpret what line movement signals about sharp money or public action.
        """
        home = game.get("home_team", "Home")
        away = game.get("away_team", "Away")

        open_home_ml = opening_odds.get("home_ml", "N/A")
        curr_home_ml = current_odds.get("home_ml", "N/A")
        open_spread = opening_odds.get("spread", "N/A")
        curr_spread = current_odds.get("spread", "N/A")
        open_total = opening_odds.get("total", "N/A")
        curr_total = current_odds.get("total", "N/A")

        prompt = f"""Interpret this line movement for {away} @ {home}:

MONEYLINE: {open_home_ml} → {curr_home_ml} (home)
SPREAD: {open_spread} → {curr_spread}
TOTAL: {open_total} → {curr_total}

In 2 sentences:
1. What does this movement signal (sharp action, public fade, injury news, etc.)?
2. Does it confirm or conflict with a model edge on this game?"""

        try:
            return await self._call_claude(
                [{"role": "user", "content": prompt}],
                model=HAIKU_MODEL,
                max_tokens=150,
            )
        except Exception as e:
            logger.warning(f"Line movement interpretation failed: {e}")
            return "Line movement analysis unavailable."

    # ── 7. Post-game Recap ──────────────────────────────────────────────────

    async def generate_post_game_recap(self, game_result: Dict) -> str:
        """
        After a game goes final, generate a brief recap that includes
        whether our model's prediction was correct and why/why not.
        """
        prompt = f"""Write a 2-sentence post-game recap for:

{game_result.get('away_team')} {game_result.get('away_score')} @ {game_result.get('home_team')} {game_result.get('home_score')}

Our model predicted: {game_result.get('model_pick')} ({game_result.get('model_prob')}%)
Bet result: {game_result.get('bet_result', 'No bet recommended')}
Key factors that played out: {game_result.get('key_factors', 'Standard game')}

Briefly explain what happened and whether the model's reasoning held up. Be honest if the model was wrong."""

        try:
            return await self._call_claude(
                [{"role": "user", "content": prompt}],
                model=HAIKU_MODEL,
                max_tokens=180,
            )
        except Exception as e:
            logger.warning(f"Recap generation failed: {e}")
            return "Post-game recap unavailable."

    # ── Helpers ─────────────────────────────────────────────────────────────

    @staticmethod
    def _format_games_for_context(games: List[Dict]) -> str:
        if not games:
            return "  No games data available."
        lines = []
        for g in games[:8]:
            status = g.get("status", "scheduled").upper()
            score = ""
            if g.get("home_score") is not None:
                score = f" [{g.get('away_score')}-{g.get('home_score')}]"
            pred = g.get("prediction", {})
            edge_str = ""
            if pred:
                home_e = pred.get("home_edge", 0) or 0
                away_e = pred.get("away_edge", 0) or 0
                best_e = max(abs(home_e), abs(away_e))
                if best_e >= 2:
                    edge_str = f" | EDGE: {best_e:.1f}%"
            lines.append(
                f"  {g.get('away_abbr','?')} @ {g.get('home_abbr','?')}{score} "
                f"[{status}] ML: {g.get('away_ml','?')}/{g.get('home_ml','?')}"
                f"{edge_str}"
            )
        return "\n".join(lines)

    @staticmethod
    def _format_edges_for_context(edges: List[Dict]) -> str:
        if not edges:
            return "  No significant edges detected today."
        lines = []
        for e in edges[:5]:
            lines.append(
                f"  Game {e.get('game_id')}: {e.get('recommended_bet','?')} "
                f"| Edge: +{e.get('best_edge',0):.1f}% "
                f"| Confidence: {e.get('confidence_score',0):.0f}%"
            )
        return "\n".join(lines)

    @staticmethod
    def _fallback_narrative(ctx: Dict) -> str:
        home = ctx.get("home_team", "Home")
        away = ctx.get("away_team", "Away")
        if ctx.get("away_b2b"):
            return f"{away} face a back-to-back disadvantage visiting {home}. Fatigue is a measurable factor — B2B road teams cover the spread at below 45% historically."
        if ctx.get("home_b2b"):
            return f"{home} are hosting on the second night of a back-to-back. Their defensive rotations typically suffer — {away} should have opportunities in transition."
        return f"Closely matched contest between {away} and {home}. Advanced metrics are tight — monitor injury reports and lineup news closer to tip-off."


# Singleton
claude_analyst = ClaudeAnalystAgent()
