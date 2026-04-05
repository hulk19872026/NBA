"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, Clock, Zap } from "lucide-react";
import { clsx } from "clsx";
import type { Game } from "@/lib/api";
import { formatMoneyline, formatSpread, formatEdge, isFavorite } from "@/lib/api";
import { ProbabilityBar, EdgeBadge } from "./ProbabilityBar";

interface GameCardProps {
  game: Game;
  className?: string;
}

// NBA team color map for accent styling
const TEAM_COLORS: Record<string, string> = {
  ATL: "#E03A3E", BOS: "#007A33", BKN: "#AAAAAA", CHA: "#00788C",
  CHI: "#CE1141", CLE: "#860038", DAL: "#00538C", DEN: "#FEC524",
  DET: "#C8102E", GSW: "#FFC72C", HOU: "#CE1141", IND: "#FDBB30",
  LAC: "#C8102E", LAL: "#FDB927", MEM: "#5D76A9", MIA: "#F9A01B",
  MIL: "#00471B", MIN: "#78BE20", NOP: "#C8102E", NYK: "#F58426",
  OKC: "#EF3B24", ORL: "#0077C0", PHI: "#ED174C", PHX: "#E56020",
  POR: "#E03A3E", SAC: "#5A2D81", SAS: "#C4CED4", TOR: "#CE1141",
  UTA: "#00471B", WAS: "#E31837",
};

function TeamAbbr({ abbr, color }: { abbr: string; color?: string }) {
  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-lg"
      style={{
        background: color ? `${color}20` : "rgba(255,255,255,0.06)",
        border: `1px solid ${color ? `${color}30` : "rgba(255,255,255,0.08)"}`,
        color: color || "#94a3b8",
      }}
    >
      {abbr}
    </div>
  );
}

export function GameCard({ game, className }: GameCardProps) {
  const [expanded, setExpanded] = useState(false);

  const { home_team, away_team, prediction, odds, status } = game;
  const primaryOdds = odds[0] || null;
  const isLive = status === "live";
  const isFinal = status === "final";

  const homeColor = TEAM_COLORS[home_team.abbreviation];
  const awayColor = TEAM_COLORS[away_team.abbreviation];

  const bestEdge = prediction
    ? Math.max(Math.abs(prediction.home_edge ?? 0), Math.abs(prediction.away_edge ?? 0))
    : 0;
  const hasEdge = bestEdge >= 3;
  const edgeSide = prediction?.home_edge && Math.abs(prediction.home_edge) > Math.abs(prediction.away_edge ?? 0)
    ? "home" : "away";

  return (
    <div
      className={clsx(
        "card relative overflow-hidden transition-all duration-300",
        hasEdge && "ring-1 ring-green-400/20",
        className
      )}
    >
      {/* Edge glow */}
      {hasEdge && (
        <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
          style={{ background: "radial-gradient(circle at top right, rgba(0,230,118,0.08), transparent 70%)" }}
        />
      )}

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isLive ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                <span className="live-dot" />
                <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider">
                  Live {game.period ? `Q${game.period}` : ""}
                </span>
              </div>
            ) : isFinal ? (
              <span className="badge-electric">Final</span>
            ) : (
              <div className="flex items-center gap-1 text-slate-500 text-xs font-mono">
                <Clock size={11} />
                {game.game_time
                  ? new Date(game.game_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                  : "TBD"}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasEdge && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-400/10 border border-green-400/20">
                <Zap size={11} className="text-green-400" />
                <span className="text-[10px] font-mono text-green-400 font-semibold uppercase tracking-wider">
                  Edge
                </span>
              </div>
            )}
            {(game.home_b2b || game.away_b2b) && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-400/10 border border-yellow-400/20">
                <AlertTriangle size={11} className="text-yellow-400" />
                <span className="text-[10px] font-mono text-yellow-400 uppercase tracking-wider">B2B</span>
              </div>
            )}
          </div>
        </div>

        {/* Matchup */}
        <div className="flex items-center gap-3 mb-5">
          {/* Away team */}
          <div className="flex-1 flex items-center gap-3">
            <TeamAbbr abbr={away_team.abbreviation} color={awayColor} />
            <div className="min-w-0">
              <div className="font-display text-lg font-bold text-white leading-tight truncate">
                {away_team.city}
              </div>
              <div className="font-display text-sm text-slate-400 leading-tight truncate">
                {away_team.name.split(" ").slice(-1)[0]}
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                {away_team.wins}–{away_team.losses}
              </div>
            </div>
          </div>

          {/* Score or separator */}
          <div className="flex-shrink-0 text-center">
            {(isLive || isFinal) && game.home_score !== null ? (
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-bold text-white">{game.away_score}</span>
                <span className="text-slate-600 font-display text-lg">–</span>
                <span className="font-display text-2xl font-bold text-white">{game.home_score}</span>
              </div>
            ) : (
              <div className="font-display text-slate-600 text-lg font-bold">@</div>
            )}
          </div>

          {/* Home team */}
          <div className="flex-1 flex items-center gap-3 justify-end text-right">
            <div className="min-w-0">
              <div className="font-display text-lg font-bold text-white leading-tight truncate">
                {home_team.city}
              </div>
              <div className="font-display text-sm text-slate-400 leading-tight truncate">
                {home_team.name.split(" ").slice(-1)[0]}
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                {home_team.wins}–{home_team.losses}
              </div>
            </div>
            <TeamAbbr abbr={home_team.abbreviation} color={homeColor} />
          </div>
        </div>

        {/* Win probability bar */}
        {prediction && (
          <div className="mb-4">
            <ProbabilityBar
              homeProb={prediction.home_win_prob}
              awayProb={prediction.away_win_prob}
              homeAbbr={home_team.abbreviation}
              awayAbbr={away_team.abbreviation}
              homeColor={homeColor}
              awayColor={awayColor}
            />
          </div>
        )}

        {/* Odds row */}
        {primaryOdds && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {/* Moneyline */}
            <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-white/[0.05]">
              <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">ML</div>
              <div className="flex justify-between px-1">
                <span className={clsx("font-mono text-sm font-semibold",
                  isFavorite(primaryOdds.away_ml) ? "text-electric-400" : "text-gold-400"
                )}>
                  {formatMoneyline(primaryOdds.away_ml)}
                </span>
                <span className={clsx("font-mono text-sm font-semibold",
                  isFavorite(primaryOdds.home_ml) ? "text-electric-400" : "text-gold-400"
                )}>
                  {formatMoneyline(primaryOdds.home_ml)}
                </span>
              </div>
            </div>

            {/* Spread */}
            <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-white/[0.05]">
              <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">Spread</div>
              <div className="flex justify-between px-1">
                <span className="font-mono text-sm font-semibold text-slate-300">
                  {formatSpread(primaryOdds.away_spread)}
                </span>
                <span className="font-mono text-sm font-semibold text-slate-300">
                  {formatSpread(primaryOdds.home_spread)}
                </span>
              </div>
            </div>

            {/* Total */}
            <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-white/[0.05]">
              <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">O/U</div>
              <div className="text-center">
                <span className="font-mono text-sm font-semibold text-slate-300">
                  {primaryOdds.total ?? "—"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Edge row */}
        {prediction && (prediction.home_edge !== null || prediction.away_edge !== null) && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <EdgeBadge
              label={`${away_team.abbreviation} Edge`}
              edge={prediction.away_edge}
              impliedProb={prediction.away_implied_prob}
              modelProb={prediction.away_win_prob}
            />
            <EdgeBadge
              label={`${home_team.abbreviation} Edge`}
              edge={prediction.home_edge}
              impliedProb={prediction.home_implied_prob}
              modelProb={prediction.home_win_prob}
            />
          </div>
        )}

        {/* Recommendation */}
        {prediction?.recommended_bet && prediction.recommended_bet !== "NONE" && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-green-400/[0.07] border border-green-400/20 mb-4">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-green-400" />
              <span className="text-xs font-mono text-green-400 font-semibold uppercase tracking-wider">
                Recommended: {prediction.recommended_bet.replace("_", " ")}
              </span>
            </div>
            <span className="text-xs font-mono text-green-300">
              {prediction.recommended_units?.toFixed(1)}u
            </span>
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {expanded ? (
            <><ChevronUp size={14} /> Less details</>
          ) : (
            <><ChevronDown size={14} /> More details</>
          )}
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-white/[0.05] animate-fade-in space-y-3">
            {/* Narrative */}
            {game.game_summary && (
              <p className="text-xs text-slate-400 leading-relaxed italic">
                "{game.game_summary}"
              </p>
            )}

            {/* Model factors */}
            {prediction?.factors && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "ELO Prob", value: `${prediction.factors.elo_prob?.toFixed(1)}%` },
                  { label: "Rating Prob", value: `${prediction.factors.rating_prob?.toFixed(1)}%` },
                  { label: "Confidence", value: `${prediction.confidence_score?.toFixed(0)}%` },
                  { label: "Home ELO", value: prediction.factors.home_elo?.toFixed(0) },
                  { label: "Away ELO", value: prediction.factors.away_elo?.toFixed(0) },
                  { label: "Proj Total", value: prediction.projected_total?.toFixed(1) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/[0.03] rounded-lg p-2 text-center">
                    <div className="font-mono text-xs font-semibold text-white">{value}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5 uppercase tracking-wider">{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Context */}
            <div className="flex gap-3 text-[11px] font-mono text-slate-500">
              {game.home_b2b && <span className="text-yellow-500">⚠ {home_team.abbreviation} B2B</span>}
              {game.away_b2b && <span className="text-yellow-500">⚠ {away_team.abbreviation} B2B</span>}
              {game.home_rest_days && <span>{home_team.abbreviation} {game.home_rest_days}d rest</span>}
              {game.away_rest_days && <span>{away_team.abbreviation} {game.away_rest_days}d rest</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
