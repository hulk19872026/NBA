"use client";

import { useState } from "react";
import { Zap, Activity, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";

const GAMES = [
  {
    id: 1, home: "BOS", away: "GSW", homeCity: "Boston", awayCity: "Golden State",
    homeRecord: "54-21", awayRecord: "41-34", status: "scheduled",
    homeML: -185, awayML: 155, spread: -5.5, total: 228.5,
    homeProb: 67.3, awayProb: 32.7, homeEdge: 2.4, awayEdge: -2.4,
    confidence: 78, bet: "HOME_ML", units: 0.8, awayB2B: true,
    summary: "Golden State travel to Boston on a back-to-back. Celtics' defensive rating advantage is even more pronounced against fatigued opponents.",
  },
  {
    id: 2, home: "OKC", away: "DAL", homeCity: "Oklahoma City", awayCity: "Dallas",
    homeRecord: "58-17", awayRecord: "37-38", status: "live",
    homeML: -210, awayML: 175, spread: -6.5, total: 222.0,
    homeProb: 72.1, awayProb: 27.9, homeEdge: 4.4, awayEdge: -4.4,
    confidence: 84, bet: "HOME_ML", units: 1.2, homeScore: 68, awayScore: 61,
    summary: "OKC's historic pace continues. SGA's efficiency edge over Luka is the key matchup.",
  },
  {
    id: 3, home: "DEN", away: "MIN", homeCity: "Denver", awayCity: "Minnesota",
    homeRecord: "44-31", awayRecord: "42-33", status: "scheduled",
    homeML: -135, awayML: 115, spread: -3.0, total: 218.5,
    homeProb: 57.8, awayProb: 42.2, homeEdge: 0.4, awayEdge: -5.4,
    confidence: 61, bet: "AWAY_ML", units: 1.5,
    summary: "Tight divisional rematch at altitude. Denver's home court provides a measurable boost analytics undervalue.",
  },
  {
    id: 4, home: "MIA", away: "NYK", homeCity: "Miami", awayCity: "New York",
    homeRecord: "33-42", awayRecord: "40-35", status: "scheduled",
    homeML: 110, awayML: -130, spread: 2.5, total: 209.0,
    homeProb: 51.4, awayProb: 48.6, homeEdge: 3.8, awayEdge: -3.8,
    confidence: 54, bet: "HOME_ML", units: 1.0, awayB2B: true,
    summary: "NYK on zero days rest. Heat historically exploit B2B opponents with their defensive scheme.",
  },
  {
    id: 5, home: "LAL", away: "PHX", homeCity: "Los Angeles", awayCity: "Phoenix",
    homeRecord: "38-37", awayRecord: "31-44", status: "final",
    homeML: -155, awayML: 130, spread: -4.5, total: 215.5,
    homeProb: 63.1, awayProb: 36.9, homeEdge: 2.3, awayEdge: -2.3,
    confidence: 69, homeScore: 118, awayScore: 104,
    summary: "Lakers controlled from Q1. LeBron's playmaking set the tone against Phoenix's struggling transition D.",
  },
  {
    id: 6, home: "MIL", away: "IND", homeCity: "Milwaukee", awayCity: "Indiana",
    homeRecord: "35-40", awayRecord: "39-36", status: "scheduled",
    homeML: -120, awayML: 100, spread: -1.5, total: 236.5,
    homeProb: 52.8, awayProb: 47.2, homeEdge: -1.7, awayEdge: 1.7,
    confidence: 48,
    summary: "Indiana's league-leading pace will test Milwaukee's transition defense.",
  },
];

const TEAM_COLORS: Record<string, string> = {
  BOS: "#007A33", GSW: "#FFC72C", OKC: "#EF3B24", DAL: "#00538C",
  DEN: "#FEC524", MIN: "#78BE20", MIA: "#F9A01B", NYK: "#F58426",
  LAL: "#FDB927", PHX: "#E56020", MIL: "#00471B", IND: "#FDBB30",
};

function GameCard({ game }: { game: typeof GAMES[0] }) {
  const [expanded, setExpanded] = useState(false);
  const isLive = game.status === "live";
  const isFinal = game.status === "final";
  const bestEdge = Math.max(Math.abs(game.homeEdge), Math.abs(game.awayEdge));
  const hasEdge = bestEdge >= 3;

  return (
    <div className={`card relative overflow-hidden ${hasEdge ? "ring-1 ring-green-400/20" : ""}`}>
      {hasEdge && (
        <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
          style={{ background: "radial-gradient(circle at top right, rgba(0,230,118,0.08), transparent 70%)" }} />
      )}
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            {isLive ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                <span className="live-dot" />
                <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider">Live</span>
              </div>
            ) : isFinal ? (
              <span className="badge-electric">Final</span>
            ) : (
              <span className="text-xs font-mono text-slate-500">7:00 PM</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasEdge && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-400/10 border border-green-400/20">
                <Zap size={11} className="text-green-400" />
                <span className="text-[10px] font-mono text-green-400 font-semibold uppercase tracking-wider">Edge</span>
              </div>
            )}
            {game.awayB2B && (
              <div className="px-2 py-0.5 rounded-full bg-yellow-400/10 border border-yellow-400/20">
                <span className="text-[10px] font-mono text-yellow-400 uppercase tracking-wider">B2B</span>
              </div>
            )}
          </div>
        </div>

        {/* Matchup */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-lg"
              style={{ background: `${TEAM_COLORS[game.away]}20`, border: `1px solid ${TEAM_COLORS[game.away]}30`, color: TEAM_COLORS[game.away] }}>
              {game.away}
            </div>
            <div>
              <div className="font-display text-lg font-bold text-white">{game.awayCity}</div>
              <div className="text-[11px] font-mono text-slate-500">{game.awayRecord}</div>
            </div>
          </div>
          <div className="flex-shrink-0">
            {(isLive || isFinal) && game.homeScore ? (
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-bold text-white">{game.awayScore}</span>
                <span className="text-slate-600 font-display text-lg">-</span>
                <span className="font-display text-2xl font-bold text-white">{game.homeScore}</span>
              </div>
            ) : (
              <div className="font-display text-slate-600 text-lg font-bold">@</div>
            )}
          </div>
          <div className="flex-1 flex items-center gap-3 justify-end text-right">
            <div>
              <div className="font-display text-lg font-bold text-white">{game.homeCity}</div>
              <div className="text-[11px] font-mono text-slate-500">{game.homeRecord}</div>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-lg"
              style={{ background: `${TEAM_COLORS[game.home]}20`, border: `1px solid ${TEAM_COLORS[game.home]}30`, color: TEAM_COLORS[game.home] }}>
              {game.home}
            </div>
          </div>
        </div>

        {/* Probability bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{game.away}</span>
            <span className="text-[10px] font-mono text-slate-400 font-semibold">Model Probability</span>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{game.home}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold w-10 text-right" style={{ color: TEAM_COLORS[game.away] }}>
              {game.awayProb.toFixed(0)}%
            </span>
            <div className="flex-1 h-2 rounded-full overflow-hidden bg-white/[0.06] flex">
              <div className="h-full rounded-full" style={{ width: `${game.awayProb}%`, background: TEAM_COLORS[game.away], opacity: 0.7 }} />
              <div className="h-full rounded-full" style={{ width: `${game.homeProb}%`, background: TEAM_COLORS[game.home], opacity: 0.85 }} />
            </div>
            <span className="font-mono text-sm font-bold w-10" style={{ color: TEAM_COLORS[game.home] }}>
              {game.homeProb.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Odds */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-white/[0.05]">
            <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">ML</div>
            <div className="flex justify-between px-1">
              <span className="font-mono text-sm font-semibold text-gold-400">{game.awayML > 0 ? `+${game.awayML}` : game.awayML}</span>
              <span className="font-mono text-sm font-semibold text-electric-400">{game.homeML > 0 ? `+${game.homeML}` : game.homeML}</span>
            </div>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-white/[0.05]">
            <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">Spread</div>
            <div className="font-mono text-sm font-semibold text-slate-300">{game.spread > 0 ? `+${game.spread}` : game.spread}</div>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-white/[0.05]">
            <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">O/U</div>
            <div className="font-mono text-sm font-semibold text-slate-300">{game.total}</div>
          </div>
        </div>

        {/* Edge badges */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: `${game.away} Edge`, edge: game.awayEdge },
            { label: `${game.home} Edge`, edge: game.homeEdge },
          ].map(({ label, edge }) => (
            <div key={label} className={`rounded-lg p-2.5 border text-center ${
              edge >= 3 ? "bg-green-400/[0.06] border-green-400/20" :
              edge <= -3 ? "bg-red-400/[0.06] border-red-400/20" :
              "bg-white/[0.03] border-white/[0.06]"
            }`}>
              <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">{label}</div>
              <div className={`font-mono text-base font-bold ${
                edge >= 3 ? "text-green-400" : edge <= -3 ? "text-red-400" : "text-slate-400"
              }`}>
                {edge > 0 ? "+" : ""}{edge.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>

        {/* Recommended bet */}
        {game.bet && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-green-400/[0.07] border border-green-400/20 mb-4">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-green-400" />
              <span className="text-xs font-mono text-green-400 font-semibold uppercase tracking-wider">
                Recommended: {game.bet.replace("_", " ")}
              </span>
            </div>
            <span className="text-xs font-mono text-green-300">{game.units?.toFixed(1)}u</span>
          </div>
        )}

        {/* Expand */}
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          {expanded ? <><ChevronUp size={14} /> Less</> : <><ChevronDown size={14} /> Details</>}
        </button>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-white/[0.05] animate-fade-in">
            <p className="text-xs text-slate-400 leading-relaxed italic">&ldquo;{game.summary}&rdquo;</p>
            <div className="mt-2 text-[10px] font-mono text-slate-500">
              Confidence: {game.confidence}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const live = GAMES.filter(g => g.status === "live");
  const upcoming = GAMES.filter(g => g.status === "scheduled");
  const final_ = GAMES.filter(g => g.status === "final");
  const edgeCount = GAMES.filter(g => Math.max(Math.abs(g.homeEdge), Math.abs(g.awayEdge)) >= 3).length;
  const allGames = [...live, ...upcoming, ...final_];

  return (
    <div className="space-y-8 animate-slide-up">
      <div>
        <h1 className="font-display text-4xl font-bold text-white uppercase tracking-wide">
          Today&apos;s <span className="text-electric-400">Games</span>
        </h1>
        <p className="text-slate-500 text-sm mt-1 font-mono">
          {GAMES.length} games &middot; {edgeCount} edge opportunities
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Games", value: GAMES.length, icon: Activity, color: "text-slate-300" },
          { label: "Live Now", value: live.length, icon: Activity, color: "text-red-400" },
          { label: "Upcoming", value: upcoming.length, icon: TrendingUp, color: "text-electric-400" },
          { label: "Edge Picks", value: edgeCount, icon: Zap, color: "text-green-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <Icon size={18} className={color} />
            <div>
              <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
        {allGames.map(game => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
}
