"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Send } from "lucide-react";

const AGENTS = [
  { name: "Orchestrator", desc: "Coordinates all agents & pipeline execution", status: "success", records: 847, duration_ms: 12400 },
  { name: "Data Collection", desc: "NBA stats, scores & schedules (BallDontLie, ESPN)", status: "success", records: 312, duration_ms: 4200 },
  { name: "Odds Aggregation", desc: "Sportsbook odds from 8 books (The Odds API)", status: "success", records: 144, duration_ms: 2800 },
  { name: "Analytics", desc: "ELO model, win probability & edge calculation", status: "running", records: 8, duration_ms: null },
  { name: "Game Context", desc: "Injuries, back-to-backs & Claude AI narratives", status: "success", records: 8, duration_ms: 6100 },
  { name: "Claude Analyst", desc: "Narratives, edge explanations, slate & chat Q&A", status: "success", records: 14, duration_ms: 8300 },
];

const LOGS = [
  { id: 6, agent: "ClaudeAnalyst", status: "success", message: "Generated 6 game narratives + 3 edge explanations", duration_ms: 8300 },
  { id: 5, agent: "GameContext", status: "success", message: "Analyzed context for 8 games", duration_ms: 6100 },
  { id: 4, agent: "OddsAggregation", status: "success", message: "Stored odds for 24 game-book combos", duration_ms: 2800 },
  { id: 3, agent: "DataCollection", status: "success", message: "Collected 312 records for today", duration_ms: 4200 },
  { id: 2, agent: "Analytics", status: "running", message: "Calculating predictions for 8 games...", duration_ms: null },
  { id: 1, agent: "Orchestrator", status: "success", message: "Full pipeline started — 6 agents coordinating", duration_ms: 12400 },
];

const AI_RESPONSES: Record<string, string> = {
  "pipeline": "The pipeline runs 6 agents in sequence:\n\n1. **Data Collection** — Fetches games, teams, players from NBA Stats API & BallDontLie\n2. **Odds Aggregation** — Pulls moneylines, spreads, totals from 8 sportsbooks via The Odds API\n3. **Game Context** — Analyzes B2Bs, rest days, injuries, generates narratives\n4. **Analytics** — Runs the ELO + net rating probability model, calculates edges vs. market\n5. **Claude Analyst** — Generates natural language analysis for each game\n\nSteps 2 & 3 run in parallel. Total runtime: ~12-15 seconds.",
  "elo": "The ELO model assigns each team a rating (starting at 1500). After each game:\n\n• **Winner gains** points proportional to upset likelihood\n• **K-factor** = 20 (moderate reactivity)\n• **Home court** = +100 ELO points (~3.5 points)\n\nWin probability: `P = 1 / (1 + 10^(-EloDiff/400))`\n\nThe model blends ELO (40%), Net Rating (30%), rest (10%), injuries (10%), and other factors.",
  "best": "Today's top edge plays:\n\n1. **MIN +115 at DEN** — 5.4% edge, 61% confidence. Gobert neutralizes Jokic's post game.\n2. **OKC -210 vs DAL** — 4.4% edge, 84% confidence. 98-point ELO gap is season's widest.\n3. **MIA +110 vs NYK** — 3.8% edge, 54% confidence. NYK on B2B, Brunson usage drops 22% on 0 rest.\n\nTotal: 3.7 units across 3 plays. Moderate day — standard allocation.",
  "edge": "Edge = Model Probability - Sportsbook Implied Probability.\n\nExample: If our model says OKC wins 72% but the sportsbook odds imply 68%, that's a +4% edge.\n\nWe use **fractional Kelly criterion** (25%) for bet sizing:\n• 3-4% edge → 0.5-1.0 units\n• 5-7% edge → 1.0-1.5 units\n• 8%+ edge → 1.5-2.0 units (max)\n\nMinimum threshold: 3% edge to flag a play.",
  "agent": "Each agent is a Python class with an async `run()` method:\n\n```python\nclass DataCollectionAgent:\n    async def run(self, target_date=None):\n        # Fetch from NBA API, BallDontLie\n        # Normalize and store in PostgreSQL\n        return {\"records_processed\": count}\n```\n\nThe **Orchestrator** coordinates everything using `asyncio.gather()` for parallelism and logs results to the `agent_logs` table.",
  "claude": "Claude AI powers 7 features:\n\n1. **Game Narratives** — 2-sentence pre-game analysis per matchup\n2. **Edge Explanations** — Why the model disagrees with the market\n3. **Daily Slate** — Ranked betting opportunities with reasoning\n4. **Injury Assessments** — Win probability impact from injuries\n5. **Line Movement** — Sharp action vs. public money interpretation\n6. **Post-Game Recaps** — Model accuracy review\n7. **This Chat** — Live Q&A with full platform context",
};

type ChatMsg = { role: "user" | "assistant"; content: string };

function getAIResponse(msg: string): string {
  const lower = msg.toLowerCase();
  for (const [key, response] of Object.entries(AI_RESPONSES)) {
    if (lower.includes(key)) return response;
  }
  return "I can explain the agent pipeline, ELO model, edge detection, or today's best plays. Try asking:\n\n• \"How does the pipeline work?\"\n• \"Explain the ELO model\"\n• \"What's the best play today?\"\n• \"How is edge calculated?\"";
}

export default function AgentsPage() {
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([
    { role: "assistant", content: "I'm **CourtEdge AI**, your NBA analytics assistant powered by Claude. I have access to today's game data, model predictions, and agent pipeline status.\n\nAsk me about the pipeline, ELO model, today's best plays, or how edge detection works." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [typing, setTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const sendChat = () => {
    const msg = chatInput.trim();
    if (!msg || typing) return;
    setChatInput("");
    setTyping(true);

    setChatHistory(h => [...h, { role: "user", content: msg }]);

    // Simulate typing delay
    setTimeout(() => {
      const reply = getAIResponse(msg);
      setChatHistory(h => [...h, { role: "assistant", content: reply }]);
      setTyping(false);
    }, 800);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold text-white uppercase tracking-wide">
            Agent <span className="text-electric-400">Monitor</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-mono">
            6 agents &middot; Multi-agent pipeline &middot; Claude AI integrated
          </p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm border border-electric-400/20 bg-electric-400/[0.08] text-electric-400 hover:bg-electric-400/15 transition-all">
          <Play size={14} />
          Run Full Pipeline
        </button>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {AGENTS.map((agent) => {
          const isRunning = agent.status === "running";
          const isSuccess = agent.status === "success";
          return (
            <div key={agent.name} className={`card p-4 relative overflow-hidden ring-1 ${
              isSuccess ? "ring-green-400/15" : isRunning ? "ring-electric-400/15" : "ring-white/[0.05]"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isSuccess ? "bg-green-400" : isRunning ? "bg-electric-400 animate-pulse" : "bg-slate-600"
                }`} />
                <div className="font-display text-sm font-bold uppercase tracking-wide text-white truncate">
                  {agent.name}
                </div>
              </div>
              <div className="text-[11px] text-slate-500 leading-relaxed mb-3">{agent.desc}</div>
              <div className="flex gap-4 mb-3">
                <div>
                  <div className={`font-mono text-base font-semibold ${isSuccess ? "text-green-400" : "text-electric-400"}`}>
                    {agent.records}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Records</div>
                </div>
                <div>
                  <div className="font-mono text-base font-semibold text-white">
                    {agent.duration_ms ? `${(agent.duration_ms / 1000).toFixed(1)}s` : "Running..."}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Duration</div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/[0.04]">
                <div className="h-full transition-all duration-700" style={{
                  width: isRunning ? "65%" : isSuccess ? "100%" : "0%",
                  background: isSuccess ? "#00e676" : isRunning ? "#00e5ff" : "#475569",
                }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Agent Logs */}
        <div>
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-white mb-3">
            Recent Logs
          </h2>
          <div className="card overflow-hidden">
            <div className="grid px-4 py-2.5 border-b border-white/[0.05] bg-white/[0.02]"
              style={{ gridTemplateColumns: "1fr 1.5fr 70px 60px" }}>
              {["Agent", "Message", "Status", "Time"].map(h => (
                <div key={h} className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">{h}</div>
              ))}
            </div>
            {LOGS.map((log) => (
              <div key={log.id} className="grid px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center"
                style={{ gridTemplateColumns: "1fr 1.5fr 70px 60px" }}>
                <div className="font-mono text-[10px] text-electric-400 truncate pr-2">{log.agent}</div>
                <div className="font-mono text-[10px] text-slate-400 truncate pr-2">{log.message}</div>
                <div className={`font-mono text-[10px] ${
                  log.status === "success" ? "text-green-400" : log.status === "running" ? "text-electric-400" : "text-red-400"
                }`}>{log.status}</div>
                <div className="font-mono text-[10px] text-slate-500 text-right">
                  {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Claude AI Chat */}
        <div>
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-white mb-3 flex items-center gap-2">
            Claude AI <span className="text-electric-400">Chat</span>
            <span className="badge-electric ml-1">claude-sonnet-4-6</span>
          </h2>
          <div className="card flex flex-col" style={{ height: "420px" }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-electric-400/[0.12] border border-electric-400/20 text-white rounded-br-sm"
                      : "bg-surface-3 border border-white/[0.06] text-slate-200 rounded-bl-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="bg-surface-3 border border-white/[0.06] rounded-xl rounded-bl-sm px-3 py-2 flex gap-1">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick prompts */}
            <div className="px-4 pb-2 flex gap-1.5 flex-wrap border-t border-white/[0.05] pt-2">
              {["How does the pipeline work?", "Explain the ELO model", "Best play today?", "How is edge calculated?"].map(q => (
                <button key={q} onClick={() => setChatInput(q)}
                  className="text-[10px] px-2 py-1 rounded-md border border-white/[0.06] text-slate-500 hover:text-white hover:border-electric-400/20 transition-all">
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/[0.05] flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChat()}
                placeholder="Ask about agents, games, or betting strategy..."
                className="flex-1 bg-surface-3 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-electric-400/25 transition-colors"
              />
              <button onClick={sendChat} disabled={typing || !chatInput.trim()}
                className="w-8 h-8 rounded-lg border border-electric-400/20 bg-electric-400/[0.08] text-electric-400 flex items-center justify-center hover:bg-electric-400/15 transition-all disabled:opacity-40">
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
