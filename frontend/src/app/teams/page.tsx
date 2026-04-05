"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { clsx } from "clsx";
import { teamsApi, type TeamSummary } from "@/lib/api";

const TEAM_COLORS: Record<string, string> = {
  ATL:"#E03A3E",BOS:"#007A33",BKN:"#AAAAAA",CHA:"#00788C",CHI:"#CE1141",
  CLE:"#860038",DAL:"#00538C",DEN:"#FEC524",DET:"#C8102E",GSW:"#FFC72C",
  HOU:"#CE1141",IND:"#FDBB30",LAC:"#C8102E",LAL:"#FDB927",MEM:"#5D76A9",
  MIA:"#F9A01B",MIL:"#00471B",MIN:"#78BE20",NOP:"#C8102E",NYK:"#F58426",
  OKC:"#EF3B24",ORL:"#0077C0",PHI:"#ED174C",PHX:"#E56020",POR:"#E03A3E",
  SAC:"#5A2D81",SAS:"#C4CED4",TOR:"#CE1141",UTA:"#00471B",WAS:"#E31837",
};

const DEMO_TEAMS: TeamSummary[] = [
  {id:1,nba_id:"21",name:"Oklahoma City Thunder",abbreviation:"OKC",city:"Oklahoma City",conference:"West",division:"Northwest",elo_rating:1641,net_rating:10.2,off_rating:118.9,def_rating:108.7,wins:58,losses:17},
  {id:2,nba_id:"2",name:"Boston Celtics",abbreviation:"BOS",city:"Boston",conference:"East",division:"Atlantic",elo_rating:1623,net_rating:8.4,off_rating:120.1,def_rating:111.7,wins:54,losses:21},
  {id:3,nba_id:"6",name:"Cleveland Cavaliers",abbreviation:"CLE",city:"Cleveland",conference:"East",division:"Central",elo_rating:1601,net_rating:6.8,off_rating:116.4,def_rating:109.6,wins:51,losses:24},
  {id:4,nba_id:"8",name:"Denver Nuggets",abbreviation:"DEN",city:"Denver",conference:"West",division:"Northwest",elo_rating:1578,net_rating:4.7,off_rating:116.2,def_rating:111.5,wins:44,losses:31},
  {id:5,nba_id:"18",name:"Minnesota Timberwolves",abbreviation:"MIN",city:"Minneapolis",conference:"West",division:"Northwest",elo_rating:1562,net_rating:3.9,off_rating:114.8,def_rating:110.9,wins:42,losses:33},
  {id:6,nba_id:"10",name:"Golden State Warriors",abbreviation:"GSW",city:"San Francisco",conference:"West",division:"Pacific",elo_rating:1571,net_rating:3.2,off_rating:117.4,def_rating:114.2,wins:41,losses:34},
  {id:7,nba_id:"20",name:"New York Knicks",abbreviation:"NYK",city:"New York",conference:"East",division:"Atlantic",elo_rating:1548,net_rating:2.4,off_rating:113.7,def_rating:111.3,wins:40,losses:35},
  {id:8,nba_id:"12",name:"Indiana Pacers",abbreviation:"IND",city:"Indianapolis",conference:"East",division:"Central",elo_rating:1527,net_rating:0.6,off_rating:117.8,def_rating:117.2,wins:39,losses:36},
  {id:9,nba_id:"14",name:"Los Angeles Lakers",abbreviation:"LAL",city:"Los Angeles",conference:"West",division:"Pacific",elo_rating:1534,net_rating:0.8,off_rating:113.2,def_rating:112.4,wins:38,losses:37},
  {id:10,nba_id:"7",name:"Dallas Mavericks",abbreviation:"DAL",city:"Dallas",conference:"West",division:"Southwest",elo_rating:1543,net_rating:1.8,off_rating:115.6,def_rating:113.8,wins:37,losses:38},
  {id:11,nba_id:"17",name:"Milwaukee Bucks",abbreviation:"MIL",city:"Milwaukee",conference:"East",division:"Central",elo_rating:1539,net_rating:1.3,off_rating:114.2,def_rating:112.9,wins:35,losses:40},
  {id:12,nba_id:"16",name:"Miami Heat",abbreviation:"MIA",city:"Miami",conference:"East",division:"Southeast",elo_rating:1512,net_rating:-1.2,off_rating:111.4,def_rating:112.6,wins:33,losses:42},
  {id:13,nba_id:"24",name:"Phoenix Suns",abbreviation:"PHX",city:"Phoenix",conference:"West",division:"Pacific",elo_rating:1491,net_rating:-2.1,off_rating:111.1,def_rating:113.2,wins:31,losses:44},
  {id:14,nba_id:"23",name:"Philadelphia 76ers",abbreviation:"PHI",city:"Philadelphia",conference:"East",division:"Atlantic",elo_rating:1448,net_rating:-5.8,off_rating:109.2,def_rating:115.0,wins:24,losses:51},
];

type SortKey = "elo_rating" | "net_rating" | "wins" | "off_rating" | "def_rating";

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamSummary[]>(DEMO_TEAMS);
  const [conference, setConference] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("elo_rating");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    teamsApi.list(conference || undefined)
      .then(setTeams)
      .catch(() => {
        const filtered = conference
          ? DEMO_TEAMS.filter(t => t.conference === conference)
          : DEMO_TEAMS;
        setTeams(filtered);
      })
      .finally(() => setLoading(false));
  }, [conference]);

  const sorted = [...teams].sort((a, b) => {
    if (sortKey === "def_rating") return (a.def_rating ?? 999) - (b.def_rating ?? 999);
    return (b[sortKey] ?? 0) - (a[sortKey] ?? 0);
  });

  const NetRatingIcon = ({ val }: { val: number | null }) => {
    if (!val) return <Minus size={12} className="text-slate-500" />;
    if (val > 0) return <TrendingUp size={12} className="text-green-400" />;
    return <TrendingDown size={12} className="text-red-400" />;
  };

  const columns: { key: SortKey; label: string }[] = [
    { key: "elo_rating", label: "ELO" },
    { key: "net_rating", label: "NET RTG" },
    { key: "off_rating", label: "OFF RTG" },
    { key: "def_rating", label: "DEF RTG" },
    { key: "wins", label: "W-L" },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-white uppercase tracking-wide">
            Team <span className="text-electric-400">Rankings</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-mono">
            2024–25 season · sorted by {sortKey.replace("_", " ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["", "East", "West"].map((conf) => (
            <button
              key={conf}
              onClick={() => setConference(conf)}
              className={clsx(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                conference === conf
                  ? "bg-electric-400/10 text-electric-400 border border-electric-400/20"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              {conf || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {/* Column headers */}
        <div className="grid items-center gap-0 px-5 py-3 border-b border-white/[0.05] bg-white/[0.02]"
          style={{ gridTemplateColumns: "32px 1fr 70px 80px 80px 80px 100px" }}>
          <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">#</div>
          <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Team</div>
          {columns.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={clsx(
                "text-right text-[9px] font-mono uppercase tracking-widest transition-colors",
                sortKey === key ? "text-electric-400" : "text-slate-500 hover:text-slate-300"
              )}
            >
              {label} {sortKey === key ? "↓" : ""}
            </button>
          ))}
        </div>

        {/* Rows */}
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid gap-0 px-5 py-3 border-b border-white/[0.03] animate-pulse"
              style={{ gridTemplateColumns: "32px 1fr 70px 80px 80px 80px 100px" }}>
              <div className="h-3 w-4 bg-white/[0.06] rounded" />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-white/[0.06] rounded-lg" />
                <div className="h-3 w-32 bg-white/[0.06] rounded" />
              </div>
              {[1,2,3,4,5].map(n => <div key={n} className="h-3 w-12 bg-white/[0.04] rounded ml-auto" />)}
            </div>
          ))
          : sorted.map((team, idx) => {
            const color = TEAM_COLORS[team.abbreviation] || "#64748b";
            const netPos = (team.net_rating ?? 0) >= 0;
            const eloBar = Math.max(5, Math.min(95, ((team.elo_rating - 1400) / 300) * 100));

            return (
              <div
                key={team.id}
                className="grid items-center gap-0 px-5 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group"
                style={{ gridTemplateColumns: "32px 1fr 70px 80px 80px 80px 100px" }}
              >
                {/* Rank */}
                <div className="text-[11px] font-mono text-slate-600">{idx + 1}</div>

                {/* Team */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-[10px] flex-shrink-0"
                    style={{ background: `${color}20`, border: `1px solid ${color}30`, color }}
                  >
                    {team.abbreviation}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{team.name}</div>
                    <div className="text-[9px] font-mono text-slate-500">{team.conference} · {team.division}</div>
                  </div>
                </div>

                {/* W-L */}
                <div className="text-right font-mono text-xs text-white font-medium">
                  {team.wins}–{team.losses}
                </div>

                {/* ELO with bar */}
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-xs font-mono text-slate-300">{team.elo_rating.toFixed(0)}</span>
                  <div className="w-12 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${eloBar}%`, background: color }} />
                  </div>
                </div>

                {/* Net Rating */}
                <div className={clsx(
                  "flex items-center justify-end gap-1 font-mono text-xs font-semibold",
                  netPos ? "text-green-400" : "text-red-400"
                )}>
                  <NetRatingIcon val={team.net_rating} />
                  {team.net_rating !== null ? `${team.net_rating > 0 ? "+" : ""}${team.net_rating.toFixed(1)}` : "—"}
                </div>

                {/* Off Rating */}
                <div className="text-right font-mono text-xs text-slate-300">
                  {team.off_rating?.toFixed(1) ?? "—"}
                </div>

                {/* Def Rating */}
                <div className="text-right font-mono text-xs text-slate-300">
                  {team.def_rating?.toFixed(1) ?? "—"}
                </div>
              </div>
            );
          })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 text-[10px] font-mono text-slate-500">
        <span><span className="text-electric-400">ELO</span> — Strength rating (avg 1500)</span>
        <span><span className="text-electric-400">NET RTG</span> — Points per 100 possessions differential</span>
        <span><span className="text-electric-400">OFF RTG</span> — Offensive efficiency (pts/100 poss)</span>
        <span><span className="text-electric-400">DEF RTG</span> — Defensive efficiency (lower = better)</span>
      </div>
    </div>
  );
}
