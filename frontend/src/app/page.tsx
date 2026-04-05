"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { RefreshCw, ChevronLeft, ChevronRight, Filter, Zap, Activity, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import { GameCard } from "@/components/GameCard";
import { SkeletonCard } from "@/components/ProbabilityBar";
import { gamesApi, agentsApi, type Game } from "@/lib/api";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Live", value: "live" },
  { label: "Upcoming", value: "scheduled" },
  { label: "Final", value: "final" },
];

const EDGE_FILTERS = [
  { label: "All", value: 0 },
  { label: "3%+ Edge", value: 3 },
  { label: "5%+ Edge", value: 5 },
  { label: "8%+ Edge", value: 8 },
];

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState("");
  const [edgeFilter, setEdgeFilter] = useState(0);
  const [highEdgeCount, setHighEdgeCount] = useState(0);
  const [totalGames, setTotalGames] = useState(0);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const displayDate = format(selectedDate, "EEEE, MMMM d");
  const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;

  const fetchGames = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await gamesApi.list({
        game_date: dateStr,
        status: statusFilter || undefined,
        min_edge: edgeFilter > 0 ? edgeFilter : undefined,
      });
      setGames(data.games);
      setTotalGames(data.total);
      setHighEdgeCount(data.high_edge_count);
    } catch (err) {
      console.error(err);
      // Fallback demo data for preview
      setGames(getDemoGames());
      setTotalGames(getDemoGames().length);
      setHighEdgeCount(2);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, [dateStr, statusFilter, edgeFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await agentsApi.runPipeline(dateStr);
      toast.success("Pipeline triggered — refreshing in 10s");
      setTimeout(() => fetchGames(false), 10000);
    } catch {
      toast.error("Failed to trigger pipeline");
      setRefreshing(false);
    }
  };

  const liveGames = games.filter((g) => g.status === "live");
  const upcomingGames = games.filter((g) => g.status === "scheduled");
  const finalGames = games.filter((g) => g.status === "final");

  const groupedGames = statusFilter
    ? games
    : [...liveGames, ...upcomingGames, ...finalGames];

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-white uppercase tracking-wide">
            {isToday ? "Today's" : displayDate.split(",")[0] + "'s"}{" "}
            <span className="text-electric-400">Games</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-mono">
            {displayDate} · {totalGames} games · {highEdgeCount} edge opportunities
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date navigation */}
          <div className="flex items-center gap-1 bg-surface-2 rounded-xl border border-white/[0.06] p-1">
            <button
              onClick={() => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; })}
              className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 text-sm font-mono text-slate-300 min-w-[90px] text-center">
              {isToday ? "Today" : format(selectedDate, "MMM d")}
            </span>
            <button
              onClick={() => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; })}
              className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw size={14} className={clsx(refreshing && "animate-spin")} />
            {refreshing ? "Running..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Games", value: totalGames, icon: Activity, color: "text-slate-300" },
          { label: "Live Now", value: liveGames.length, icon: Activity, color: "text-red-400" },
          { label: "Upcoming", value: upcomingGames.length, icon: TrendingUp, color: "text-electric-400" },
          { label: "Edge Picks", value: highEdgeCount, icon: Zap, color: "text-green-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <Icon size={18} className={color} />
            <div>
              <div className={clsx("font-display text-2xl font-bold", color)}>{value}</div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status filter */}
        <div className="flex items-center gap-1.5 bg-surface-2 rounded-xl border border-white/[0.06] p-1">
          {STATUS_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === value
                  ? "bg-electric-400/10 text-electric-400 border border-electric-400/20"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Edge filter */}
        <div className="flex items-center gap-1.5 bg-surface-2 rounded-xl border border-white/[0.06] p-1">
          <Filter size={13} className="text-slate-500 ml-2" />
          {EDGE_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setEdgeFilter(value)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                edgeFilter === value
                  ? "bg-green-400/10 text-green-400 border border-green-400/20"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Games grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} className="animate-slide-up" />
          ))}
        </div>
      ) : groupedGames.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">🏀</div>
          <h3 className="font-display text-2xl font-bold text-white mb-2">No Games Found</h3>
          <p className="text-slate-500 text-sm">
            {edgeFilter > 0
              ? `No games with ${edgeFilter}%+ edge today. Try lowering the threshold.`
              : `No NBA games scheduled for ${displayDate}.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
          {groupedGames.map((game, i) => (
            <GameCard
              key={game.id}
              game={game}
              className="animate-slide-up"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Demo data for preview without backend ──────────────────────────────────

function getDemoGames(): Game[] {
  return [
    {
      id: 1, nba_game_id: "demo1", game_date: "2025-04-05", game_time: null,
      status: "scheduled", season: "2024-25",
      home_team: { id: 1, name: "Boston Celtics", abbreviation: "BOS", city: "Boston", conference: "East", division: "Atlantic", elo_rating: 1623, net_rating: 8.4, off_rating: 120.1, def_rating: 111.7, wins: 54, losses: 21 },
      away_team: { id: 2, name: "Golden State Warriors", abbreviation: "GSW", city: "San Francisco", conference: "West", division: "Pacific", elo_rating: 1571, net_rating: 3.2, off_rating: 117.4, def_rating: 114.2, wins: 41, losses: 34 },
      home_score: null, away_score: null, home_b2b: false, away_b2b: true,
      home_rest_days: 2, away_rest_days: 1,
      game_summary: "Golden State travel to Boston on the second night of a back-to-back, facing a Celtics squad with one of the league's best home records. Boston's defensive rating advantage becomes even more pronounced against fatigued opponents.",
      odds: [{ sportsbook: "draftkings", home_ml: -185, away_ml: 155, home_spread: -5.5, away_spread: 5.5, total: 228.5, over_price: -110, under_price: -110, fetched_at: new Date().toISOString() }],
      prediction: { home_win_prob: 67.3, away_win_prob: 32.7, home_implied_prob: 64.9, away_implied_prob: 35.1, home_edge: 2.4, away_edge: -2.4, projected_total: 226.8, confidence_score: 78, recommended_bet: "HOME_ML", recommended_units: 0.8, factors: { elo_prob: 65.1, rating_prob: 69.4, home_elo: 1623, away_elo: 1571 } },
    },
    {
      id: 2, nba_game_id: "demo2", game_date: "2025-04-05", game_time: null,
      status: "live", season: "2024-25",
      home_team: { id: 3, name: "Oklahoma City Thunder", abbreviation: "OKC", city: "Oklahoma City", conference: "West", division: "Northwest", elo_rating: 1641, net_rating: 10.2, off_rating: 118.9, def_rating: 108.7, wins: 58, losses: 17 },
      away_team: { id: 4, name: "Dallas Mavericks", abbreviation: "DAL", city: "Dallas", conference: "West", division: "Southwest", elo_rating: 1543, net_rating: 1.8, off_rating: 115.6, def_rating: 113.8, wins: 37, losses: 38 },
      home_score: 68, away_score: 61, home_b2b: false, away_b2b: false,
      home_rest_days: 2, away_rest_days: 2,
      game_summary: "OKC's historic pace continues as they host a Mavericks team that's struggled in road games. Shai Gilgeous-Alexander's efficiency edge over Luka Doncic is the key matchup to watch.",
      odds: [{ sportsbook: "draftkings", home_ml: -210, away_ml: 175, home_spread: -6.5, away_spread: 6.5, total: 222.0, over_price: -110, under_price: -110, fetched_at: new Date().toISOString() }],
      prediction: { home_win_prob: 72.1, away_win_prob: 27.9, home_implied_prob: 67.7, away_implied_prob: 32.3, home_edge: 4.4, away_edge: -4.4, projected_total: 219.4, confidence_score: 84, recommended_bet: "HOME_ML", recommended_units: 1.2, factors: { elo_prob: 70.8, rating_prob: 73.2, home_elo: 1641, away_elo: 1543 } },
    },
    {
      id: 3, nba_game_id: "demo3", game_date: "2025-04-05", game_time: null,
      status: "scheduled", season: "2024-25",
      home_team: { id: 5, name: "Denver Nuggets", abbreviation: "DEN", city: "Denver", conference: "West", division: "Northwest", elo_rating: 1578, net_rating: 4.7, off_rating: 116.2, def_rating: 111.5, wins: 44, losses: 31 },
      away_team: { id: 6, name: "Minnesota Timberwolves", abbreviation: "MIN", city: "Minneapolis", conference: "West", division: "Northwest", elo_rating: 1562, net_rating: 3.9, off_rating: 114.8, def_rating: 110.9, wins: 42, losses: 33 },
      home_score: null, away_score: null, home_b2b: false, away_b2b: false,
      home_rest_days: 3, away_rest_days: 3,
      game_summary: "Tight divisional rematch at altitude. Denver's home court advantage in the thin air of Ball Arena provides a measurable performance boost that analytics consistently undervalue in betting markets.",
      odds: [{ sportsbook: "fanduel", home_ml: -135, away_ml: 115, home_spread: -3.0, away_spread: 3.0, total: 218.5, over_price: -112, under_price: -108, fetched_at: new Date().toISOString() }],
      prediction: { home_win_prob: 57.8, away_win_prob: 42.2, home_implied_prob: 57.4, away_implied_prob: 47.6, home_edge: 0.4, away_edge: -5.4, projected_total: 221.2, confidence_score: 61, recommended_bet: "AWAY_ML", recommended_units: 1.5, factors: { elo_prob: 55.9, rating_prob: 58.2, home_elo: 1578, away_elo: 1562 } },
    },
    {
      id: 4, nba_game_id: "demo4", game_date: "2025-04-05", game_time: null,
      status: "scheduled", season: "2024-25",
      home_team: { id: 7, name: "Miami Heat", abbreviation: "MIA", city: "Miami", conference: "East", division: "Southeast", elo_rating: 1512, net_rating: -1.2, off_rating: 111.4, def_rating: 112.6, wins: 33, losses: 42 },
      away_team: { id: 8, name: "New York Knicks", abbreviation: "NYK", city: "New York", conference: "East", division: "Atlantic", elo_rating: 1548, net_rating: 2.4, off_rating: 113.7, def_rating: 111.3, wins: 40, losses: 35 },
      home_score: null, away_score: null, home_b2b: false, away_b2b: true,
      home_rest_days: 2, away_rest_days: 1,
      game_summary: "New York enter Miami on zero days rest. The Heat historically exploit back-to-back opponents, and their defensive scheme specifically neutralizes high-usage guards like Jalen Brunson late in games.",
      odds: [{ sportsbook: "betmgm", home_ml: 110, away_ml: -130, home_spread: 2.5, away_spread: -2.5, total: 209.0, over_price: -110, under_price: -110, fetched_at: new Date().toISOString() }],
      prediction: { home_win_prob: 51.4, away_win_prob: 48.6, home_implied_prob: 47.6, away_implied_prob: 52.4, home_edge: 3.8, away_edge: -3.8, projected_total: 211.6, confidence_score: 54, recommended_bet: "HOME_ML", recommended_units: 1.0, factors: { elo_prob: 48.2, rating_prob: 52.1, home_elo: 1512, away_elo: 1548 } },
    },
    {
      id: 5, nba_game_id: "demo5", game_date: "2025-04-05", game_time: null,
      status: "final", season: "2024-25",
      home_team: { id: 9, name: "Los Angeles Lakers", abbreviation: "LAL", city: "Los Angeles", conference: "West", division: "Pacific", elo_rating: 1534, net_rating: 0.8, off_rating: 113.2, def_rating: 112.4, wins: 38, losses: 37 },
      away_team: { id: 10, name: "Phoenix Suns", abbreviation: "PHX", city: "Phoenix", conference: "West", division: "Pacific", elo_rating: 1491, net_rating: -2.1, off_rating: 111.1, def_rating: 113.2, wins: 31, losses: 44 },
      home_score: 118, away_score: 104, home_b2b: false, away_b2b: false,
      home_rest_days: 2, away_rest_days: 2,
      game_summary: "Lakers controlled this contest from the first quarter, with LeBron's playmaking setting the tone against a Phoenix defense struggling with transition coverage all season.",
      odds: [{ sportsbook: "caesars", home_ml: -155, away_ml: 130, home_spread: -4.5, away_spread: 4.5, total: 215.5, over_price: -110, under_price: -110, fetched_at: new Date().toISOString() }],
      prediction: { home_win_prob: 63.1, away_win_prob: 36.9, home_implied_prob: 60.8, away_implied_prob: 39.2, home_edge: 2.3, away_edge: -2.3, projected_total: 217.8, confidence_score: 69, recommended_bet: null, recommended_units: null, factors: { elo_prob: 61.4, rating_prob: 64.8, home_elo: 1534, away_elo: 1491 } },
    },
    {
      id: 6, nba_game_id: "demo6", game_date: "2025-04-05", game_time: null,
      status: "scheduled", season: "2024-25",
      home_team: { id: 11, name: "Milwaukee Bucks", abbreviation: "MIL", city: "Milwaukee", conference: "East", division: "Central", elo_rating: 1539, net_rating: 1.3, off_rating: 114.2, def_rating: 112.9, wins: 35, losses: 40 },
      away_team: { id: 12, name: "Indiana Pacers", abbreviation: "IND", city: "Indianapolis", conference: "East", division: "Central", elo_rating: 1527, net_rating: 0.6, off_rating: 117.8, def_rating: 117.2, wins: 39, losses: 36 },
      home_score: null, away_score: null, home_b2b: false, away_b2b: false,
      home_rest_days: 2, away_rest_days: 2,
      game_summary: "Indiana's league-leading pace of 103.1 will test Milwaukee's ability to contain in transition. The Bucks have allowed opponents to score 12+ fast break points in 60% of games this season.",
      odds: [{ sportsbook: "draftkings", home_ml: -120, away_ml: 100, home_spread: -1.5, away_spread: 1.5, total: 236.5, over_price: -108, under_price: -112, fetched_at: new Date().toISOString() }],
      prediction: { home_win_prob: 52.8, away_win_prob: 47.2, home_implied_prob: 54.5, away_implied_prob: 45.5, home_edge: -1.7, away_edge: 1.7, projected_total: 238.4, confidence_score: 48, recommended_bet: null, recommended_units: null, factors: { elo_prob: 53.1, rating_prob: 52.4, home_elo: 1539, away_elo: 1527 } },
    },
  ] as Game[];
}
