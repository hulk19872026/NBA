/**
 * NBA Analytics API Client
 * Typed axios wrapper for all backend endpoints.
 */

import axios from "axios";

const API_BASE = typeof window !== "undefined"
  ? `${window.location.origin}/api`
  : "/api";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ── Types ──────────────────────────────────────────────────────────────────

export interface TeamSummary {
  id: number;
  nba_id?: string;
  name: string;
  abbreviation: string;
  city: string;
  conference: string;
  division: string;
  elo_rating: number;
  net_rating: number | null;
  off_rating: number | null;
  def_rating: number | null;
  wins: number;
  losses: number;
}

export interface OddsSummary {
  sportsbook: string;
  home_ml: number | null;
  away_ml: number | null;
  home_spread: number | null;
  away_spread: number | null;
  total: number | null;
  over_price: number | null;
  under_price: number | null;
  fetched_at: string;
}

export interface PredictionSummary {
  home_win_prob: number;
  away_win_prob: number;
  home_implied_prob: number | null;
  away_implied_prob: number | null;
  home_edge: number | null;
  away_edge: number | null;
  projected_total: number | null;
  confidence_score: number;
  recommended_bet: string | null;
  recommended_units: number | null;
  factors: Record<string, number> | null;
}

export interface Game {
  id: number;
  nba_game_id: string;
  game_date: string;
  game_time: string | null;
  status: "scheduled" | "live" | "final" | "postponed";
  season: string;
  home_team: TeamSummary;
  away_team: TeamSummary;
  home_score: number | null;
  away_score: number | null;
  period?: number | null;
  game_clock?: string | null;
  home_b2b: boolean;
  away_b2b: boolean;
  home_rest_days: number | null;
  away_rest_days: number | null;
  game_summary: string | null;
  odds: OddsSummary[];
  prediction: PredictionSummary | null;
}

export interface GamesListResponse {
  games: Game[];
  total: number;
  date: string;
  high_edge_count: number;
}

export interface AgentLog {
  id: number;
  agent: string;
  status: "running" | "success" | "failed" | "idle";
  message: string | null;
  records_processed: number | null;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
}

export interface TopEdge {
  game_id: number;
  home_win_prob: number;
  away_win_prob: number;
  home_edge: number;
  away_edge: number;
  best_edge: number;
  recommended_bet: string | null;
  recommended_units: number | null;
  confidence_score: number;
}

// ── API Functions ──────────────────────────────────────────────────────────

export const gamesApi = {
  list: async (params?: {
    game_date?: string;
    status?: string;
    team?: string;
    min_edge?: number;
  }): Promise<GamesListResponse> => {
    const { data } = await api.get("/games", { params });
    return data;
  },

  get: async (id: number): Promise<Game> => {
    const { data } = await api.get(`/games/${id}`);
    return data;
  },

  oddsHistory: async (id: number, sportsbook?: string) => {
    const { data } = await api.get(`/games/${id}/odds-history`, {
      params: sportsbook ? { sportsbook } : {},
    });
    return data;
  },
};

export const teamsApi = {
  list: async (conference?: string): Promise<TeamSummary[]> => {
    const { data } = await api.get("/teams", {
      params: conference ? { conference } : {},
    });
    return data;
  },

  get: async (id: number): Promise<TeamSummary> => {
    const { data } = await api.get(`/teams/${id}`);
    return data;
  },

  getByAbbr: async (abbr: string): Promise<TeamSummary> => {
    const { data } = await api.get(`/teams/abbreviation/${abbr}`);
    return data;
  },
};

export const predictionsApi = {
  topEdges: async (minEdge = 3.0, limit = 10): Promise<{ edges: TopEdge[]; count: number }> => {
    const { data } = await api.get("/predictions/top-edges", {
      params: { min_edge: minEdge, limit },
    });
    return data;
  },
};

export const agentsApi = {
  runPipeline: async (targetDate?: string) => {
    const { data } = await api.post("/agents/run/pipeline", null, {
      params: targetDate ? { target_date: targetDate } : {},
    });
    return data;
  },

  runOdds: async () => {
    const { data } = await api.post("/agents/run/odds");
    return data;
  },

  runPredictions: async () => {
    const { data } = await api.post("/agents/run/predictions");
    return data;
  },

  status: async () => {
    const { data } = await api.get("/agents/status");
    return data;
  },

  logs: async (agentName?: string, limit = 50): Promise<{ logs: AgentLog[] }> => {
    const { data } = await api.get("/agents/logs", {
      params: { agent_name: agentName, limit },
    });
    return data;
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

export function formatMoneyline(ml: number | null): string {
  if (ml === null) return "—";
  return ml > 0 ? `+${ml}` : `${ml}`;
}

export function formatSpread(spread: number | null): string {
  if (spread === null) return "—";
  return spread > 0 ? `+${spread}` : `${spread}`;
}

export function formatEdge(edge: number | null): string {
  if (edge === null) return "—";
  return `${edge > 0 ? "+" : ""}${edge.toFixed(1)}%`;
}

export function isFavorite(ml: number | null): boolean {
  return ml !== null && ml < 0;
}

export function getEdgeColor(edge: number | null): string {
  if (!edge) return "text-slate-400";
  if (edge >= 5) return "text-green-400";
  if (edge >= 3) return "text-emerald-400";
  if (edge > 0) return "text-slate-300";
  return "text-red-400";
}

export function getEdgeBg(edge: number | null): string {
  if (!edge || Math.abs(edge) < 3) return "";
  if (edge >= 3) return "bg-green-400/10 border-green-400/20";
  return "bg-red-400/10 border-red-400/20";
}
