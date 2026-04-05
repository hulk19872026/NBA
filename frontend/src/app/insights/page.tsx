"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, TrendingUp, RefreshCw, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { predictionsApi, api, type TopEdge } from "@/lib/api";

const TEAM_COLORS: Record<string, string> = {
  ATL:"#E03A3E",BOS:"#007A33",BKN:"#AAAAAA",CHA:"#00788C",CHI:"#CE1141",
  CLE:"#860038",DAL:"#00538C",DEN:"#FEC524",DET:"#C8102E",GSW:"#FFC72C",
  HOU:"#CE1141",IND:"#FDBB30",LAC:"#C8102E",LAL:"#FDB927",MEM:"#5D76A9",
  MIA:"#F9A01B",MIL:"#00471B",MIN:"#78BE20",NOP:"#C8102E",NYK:"#F58426",
  OKC:"#EF3B24",ORL:"#0077C0",PHI:"#ED174C",PHX:"#E56020",POR:"#E03A3E",
  SAC:"#5A2D81",SAS:"#C4CED4",TOR:"#CE1141",UTA:"#00471B",WAS:"#E31837",
};

const DEMO_EDGES = [
  {game_id:3,home_win_prob:57.8,away_win_prob:42.2,home_edge:0.4,away_edge:-5.4,best_edge:5.4,recommended_bet:"AWAY_ML",recommended_units:1.5,confidence_score:61,matchup:"MIN @ DEN"},
  {game_id:2,home_win_prob:72.1,away_win_prob:27.9,home_edge:4.4,away_edge:-4.4,best_edge:4.4,recommended_bet:"HOME_ML",recommended_units:1.2,confidence_score:84,matchup:"DAL @ OKC"},
  {game_id:4,home_win_prob:51.4,away_win_prob:48.6,home_edge:3.8,away_edge:-3.8,best_edge:3.8,recommended_bet:"HOME_ML",recommended_units:1.0,confidence_score:54,matchup:"NYK @ MIA"},
];

const DEMO_SLATE = `**TODAY'S SLATE SUMMARY**
3 actionable edge plays from 8 games. Edge quality is above average — two plays exceed 4%. Moderate bankroll day recommended.

**TOP PLAYS**
• MIN +115 ML | Edge: +5.4% | Conf: 61% | Gobert neutralizes Jokic's post game — market undervalues Minnesota's defensive ceiling
• OKC -210 ML | Edge: +4.4% | Conf: 84% | 98-point ELO gap is season's widest H2H — Thunder correctly priced but still undervalued
• MIA +110 ML | Edge: +3.8% | Conf: 54% | NYK B2B road favorite — Brunson usage falls 22% on 0 rest days

**TOTALS WATCH**
MIL/IND 236.5 — Model projects 238.4. Marginal over lean (1.9 pts) — playable at -108 for volume game.

**FADES TO CONSIDER**
• Golden State (-155 spread) — On a B2B at the league's best home team. Public backing the brand.
• New York Knicks (-130) — Overvalued road favorite on 0 days rest. Sharp money on Miami.

**BANKROLL NOTE**
3 plays totaling 3.7 units. Moderate day — below 5u threshold. Standard allocation appropriate.`;

export default function InsightsPage() {
  const [edges, setEdges] = useState<(TopEdge & { matchup?: string })[]>(DEMO_EDGES as any);
  const [minEdge, setMinEdge] = useState(3.0);
  const [slateText, setSlateText] = useState("");
  const [slateLoading, setSlateLoading] = useState(false);
  const [slateGenerated, setSlateGenerated] = useState(false);
  const slateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    predictionsApi.topEdges(minEdge)
      .then(d => setEdges(d.edges as any))
      .catch(() => setEdges(DEMO_EDGES.filter(e => e.best_edge >= minEdge) as any));
  }, [minEdge]);

  const generateSlate = async () => {
    setSlateLoading(true);
    setSlateText("");
    setSlateGenerated(true);

    try {
      const res = await api.get("/ai/slate");
      const text = res.data.analysis || DEMO_SLATE;
      streamText(text);
    } catch {
      streamText(DEMO_SLATE);
    } finally {
      setSlateLoading(false);
    }
  };

  const streamText = (text: string) => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setSlateText(text.slice(0, i + 3));
        i += 3;
        slateRef.current?.scrollTo({ top: slateRef.current.scrollHeight });
      } else {
        setSlateText(text);
        clearInterval(interval);
      }
    }, 10);
  };

  const formatSlate = (text: string) =>
    text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
      .replace(/•/g, '<span class="text-electric-400">•</span>')
      .replace(/\n/g, "<br>");

  const edgeColor = (e: number) =>
    e >= 5 ? "text-green-400" : e >= 3 ? "text-emerald-400" : "text-slate-400";

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-white uppercase tracking-wide">
            Betting <span className="text-electric-400">Edge</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-mono">
            Model vs. market · {edges.length} plays above {minEdge}% threshold
          </p>
        </div>
        <button
          onClick={generateSlate}
          disabled={slateLoading}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all",
            "border border-electric-400/20 bg-electric-400/08 text-electric-400",
            "hover:bg-electric-400/15 hover:shadow-electric",
            slateLoading && "opacity-60 cursor-wait"
          )}
        >
          {slateLoading ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <span className="text-base">✦</span>
          )}
          {slateLoading ? "Generating..." : "Claude AI Slate Analysis"}
        </button>
      </div>

      {/* Claude Slate Card */}
      {slateGenerated && (
        <div className="relative overflow-hidden rounded-xl border border-electric-400/15 bg-surface-2">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-electric-400 via-electric-400/50 to-transparent" />
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-electric-400 text-base">✦</span>
              <span className="font-display text-sm font-bold uppercase tracking-widest text-electric-400">
                Claude AI Daily Slate
              </span>
              <span className="font-mono text-[9px] text-slate-500 ml-auto">claude-sonnet-4-6</span>
            </div>
            {slateLoading && !slateText ? (
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="h-3 bg-white/[0.04] rounded animate-pulse" style={{ width: `${85 - i * 10}%` }} />
                ))}
              </div>
            ) : (
              <div
                ref={slateRef}
                className="text-sm text-slate-300 leading-relaxed max-h-72 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: formatSlate(slateText) }}
              />
            )}
          </div>
        </div>
      )}

      {/* Edge threshold filter */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Min Edge:</span>
        <div className="flex gap-1.5">
          {[2, 3, 5, 8].map(val => (
            <button
              key={val}
              onClick={() => setMinEdge(val)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all",
                minEdge === val
                  ? "bg-green-400/10 text-green-400 border border-green-400/20"
                  : "text-slate-500 hover:text-slate-300 border border-white/[0.06]"
              )}
            >
              {val}%+
            </button>
          ))}
        </div>
      </div>

      {/* Edge cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {edges.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-slate-500">
            No games above {minEdge}% edge today. Try lowering the threshold.
          </div>
        ) : (
          edges.map((edge, idx) => {
            const isHomeEdge = !edge.recommended_bet?.includes("AWAY");
            const edgePct = edge.best_edge;
            const confPct = edge.confidence_score;
            const circumference = 2 * Math.PI * 22;

            return (
              <div
                key={edge.game_id}
                className={clsx(
                  "card p-5 relative overflow-hidden",
                  edgePct >= 5 && "ring-1 ring-green-400/25"
                )}
              >
                {edgePct >= 5 && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-400/60 to-transparent" />
                )}

                {/* Rank badge */}
                <div className="absolute top-4 right-4">
                  <div className="font-display text-4xl font-bold text-white/[0.04]">#{idx + 1}</div>
                </div>

                <div className="flex items-start gap-4 mb-5">
                  {/* Confidence ring */}
                  <div className="relative flex-shrink-0">
                    <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3.5" />
                      <circle
                        cx="26" cy="26" r="22" fill="none"
                        stroke={edgePct >= 5 ? "#00e676" : edgePct >= 3 ? "#00e5ff" : "#64748b"}
                        strokeWidth="3.5"
                        strokeDasharray={`${circumference * (confPct / 100)} ${circumference}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-mono text-[11px] font-semibold text-white">{confPct.toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-display text-lg font-bold text-white truncate">
                      {(edge as any).matchup || `Game #${edge.game_id}`}
                    </div>
                    <div className="font-mono text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                      {edge.recommended_bet?.replace("_", " ")} · {edge.recommended_units?.toFixed(1)}u Kelly
                    </div>
                  </div>
                </div>

                {/* Edge vs implied */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-white/[0.025] rounded-lg p-2.5 text-center">
                    <div className={clsx("font-mono text-lg font-bold", edgeColor(edgePct))}>
                      +{edgePct.toFixed(1)}%
                    </div>
                    <div className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">Edge</div>
                  </div>
                  <div className="bg-white/[0.025] rounded-lg p-2.5 text-center">
                    <div className="font-mono text-sm font-semibold text-white">
                      {isHomeEdge ? edge.home_win_prob.toFixed(0) : edge.away_win_prob.toFixed(0)}%
                    </div>
                    <div className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">Model</div>
                  </div>
                  <div className="bg-white/[0.025] rounded-lg p-2.5 text-center">
                    <div className="font-mono text-sm font-semibold text-slate-300">
                      {(isHomeEdge
                        ? (edge.home_win_prob - edge.home_edge!)
                        : (edge.away_win_prob - edge.away_edge!)
                      ).toFixed(0)}%
                    </div>
                    <div className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">Implied</div>
                  </div>
                </div>

                {/* EV indicator */}
                <div className="flex items-center gap-1.5">
                  <Zap size={12} className={edgePct >= 3 ? "text-green-400" : "text-slate-500"} />
                  <span className="text-[10px] font-mono text-slate-400">
                    +EV · {edge.recommended_units?.toFixed(1)}u recommended stake
                  </span>
                  <ChevronRight size={12} className="text-slate-600 ml-auto" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Model explanation */}
      <div className="card p-6">
        <div className="font-display text-lg font-bold uppercase tracking-wide text-white mb-4">
          How Edge is Calculated
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-400 leading-relaxed">
          <div>
            <div className="font-mono text-electric-400 text-xs uppercase tracking-widest mb-2">Step 1 · Model Probability</div>
            Composite of ELO rating (40%), net rating (30%), rest/fatigue (10%), injury impact (10%), and H2H pace factors (10%).
          </div>
          <div>
            <div className="font-mono text-electric-400 text-xs uppercase tracking-widest mb-2">Step 2 · Implied Probability</div>
            Convert sportsbook moneyline to probability, then remove the vig (overround) to get the true market implied probability.
          </div>
          <div>
            <div className="font-mono text-electric-400 text-xs uppercase tracking-widest mb-2">Step 3 · Edge Detection</div>
            Edge % = Model Prob − Implied Prob. Bets with ≥3% edge are flagged. Kelly criterion sizes the stake for optimal growth.
          </div>
        </div>
      </div>
    </div>
  );
}
