"use client";

import { clsx } from "clsx";

// ── ProbabilityBar ──────────────────────────────────────────────────────────

interface ProbabilityBarProps {
  homeProb: number;
  awayProb: number;
  homeAbbr: string;
  awayAbbr: string;
  homeColor?: string;
  awayColor?: string;
}

export function ProbabilityBar({
  homeProb,
  awayProb,
  homeAbbr,
  awayAbbr,
  homeColor = "#00e5ff",
  awayColor = "#ffd700",
}: ProbabilityBarProps) {
  const homeWidth = Math.max(10, Math.min(90, homeProb));
  const awayWidth = 100 - homeWidth;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          {awayAbbr} Win Prob
        </span>
        <span className="text-[10px] font-mono text-slate-400 font-semibold">
          Model Probability
        </span>
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          {homeAbbr} Win Prob
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-bold w-10 text-right"
          style={{ color: awayColor }}>
          {awayProb.toFixed(0)}%
        </span>

        <div className="flex-1 h-2 rounded-full overflow-hidden bg-white/[0.06] flex">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${awayWidth}%`, background: awayColor, opacity: 0.7 }}
          />
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${homeWidth}%`, background: homeColor, opacity: 0.85 }}
          />
        </div>

        <span className="font-mono text-sm font-bold w-10"
          style={{ color: homeColor }}>
          {homeProb.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// ── EdgeBadge ───────────────────────────────────────────────────────────────

interface EdgeBadgeProps {
  label: string;
  edge: number | null;
  impliedProb: number | null;
  modelProb: number;
}

export function EdgeBadge({ label, edge, impliedProb, modelProb }: EdgeBadgeProps) {
  const isPositive = (edge ?? 0) >= 3;
  const isNegative = (edge ?? 0) <= -3;

  return (
    <div
      className={clsx(
        "rounded-lg p-2.5 border text-center transition-all",
        isPositive
          ? "bg-green-400/[0.06] border-green-400/20"
          : isNegative
          ? "bg-red-400/[0.06] border-red-400/20"
          : "bg-white/[0.03] border-white/[0.06]"
      )}
    >
      <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">{label}</div>
      <div className={clsx(
        "font-mono text-base font-bold",
        isPositive ? "text-green-400" : isNegative ? "text-red-400" : "text-slate-400"
      )}>
        {edge !== null ? `${edge > 0 ? "+" : ""}${edge.toFixed(1)}%` : "—"}
      </div>
      {impliedProb !== null && (
        <div className="flex justify-between mt-1.5 text-[9px] font-mono text-slate-600">
          <span>Model: {modelProb.toFixed(0)}%</span>
          <span>Book: {impliedProb.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}

// ── SkeletonCard ────────────────────────────────────────────────────────────

export function SkeletonCard() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex justify-between mb-4">
        <div className="h-5 w-16 bg-white/[0.06] rounded-full" />
        <div className="h-5 w-12 bg-white/[0.06] rounded-full" />
      </div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 bg-white/[0.06] rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 bg-white/[0.06] rounded" />
          <div className="h-3 w-16 bg-white/[0.04] rounded" />
        </div>
        <div className="w-8 h-6 bg-white/[0.04] rounded" />
        <div className="flex-1 space-y-2 items-end flex flex-col">
          <div className="h-4 w-24 bg-white/[0.06] rounded" />
          <div className="h-3 w-16 bg-white/[0.04] rounded" />
        </div>
        <div className="w-12 h-12 bg-white/[0.06] rounded-xl" />
      </div>
      <div className="h-2 bg-white/[0.06] rounded-full mb-4" />
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-white/[0.04] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
