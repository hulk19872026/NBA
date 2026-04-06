"use client";

import { useState, useEffect, useRef } from "react";
import { Play, RefreshCw, Send } from "lucide-react";
import { clsx } from "clsx";
import { agentsApi, api, type AgentLog } from "@/lib/api";
import toast from "react-hot-toast";

const AGENTS_DEMO = [
  { name: "Orchestrator", desc: "Coordinates all agents & pipeline execution", status: "success", records: 847, duration_ms: 12400 },
  { name: "DataCollectionAgent", desc: "NBA stats, scores & schedules (BallDontLie, ESPN)", status: "success", records: 312, duration_ms: 4200 },
  { name: "OddsAggregationAgent", desc: "Sportsbook odds from 8 books (The Odds API)", status: "success", records: 144, duration_ms: 2800 },
  { name: "AnalyticsAgent", desc: "ELO model, win probability & edge calculation", status: "running", records: 8, duration_ms: null },
  { name: "GameContextAgent", desc: "Injuries, back-to-backs & Claude AI narratives", status: "success", records: 8, duration_ms: 6100 },
  { name: "ClaudeAnalystAgent", desc: "Narratives, edge explanations, slate & chat Q&A", status: "success", records: 14, duration_ms: 8300 },
];

const LOGS_DEMO: AgentLog[] = [
  { id: 6, agent: "ClaudeAnalystAgent", status: "success", message: "Generated 6 game narratives + 3 edge explanations", records_processed: 14, duration_ms: 8300, error: null, created_at: "2025-04-05T12:00:00Z" },
  { id: 5, agent: "GameContextAgent", status: "success", message: "Analyzed context for 8 games", records_processed: 8, duration_ms: 6100, error: null, created_at: "2025-04-05T12:00:00Z" },
  { id: 4, agent: "OddsAggregationAgent", status: "success", message: "Stored odds for 24 game-book combos", records_processed: 144, duration_ms: 2800, error: null, created_at: "2025-04-05T12:00:00Z" },
  { id: 3, agent: "DataCollectionAgent", status: "success", message: "Collected 312 records for today", records_processed: 312, duration_ms: 4200, error: null, created_at: "2025-04-05T12:00:00Z" },
  { id: 2, agent: "AnalyticsAgent", status: "running", message: "Calculating predictions for 8 games...", records_processed: 8, duration_ms: null, error: null, created_at: "2025-04-05T12:00:00Z" },
  { id: 1, agent: "Orchestrator", status: "success", message: "Full pipeline started — 6 agents coordinating", records_processed: 847, duration_ms: 12400, error: null, created_at: "2025-04-05T12:00:00Z" },
];

type ChatMsg = { role: "user" | "assistant"; content: string };

const STATUS_COLORS = {
  success: { dot: "bg-green-400", ring: "ring-green-400/15", bar: "#00e676" },
  running: { dot: "bg-electric-400 animate-pulse-slow", ring: "ring-electric-400/15", bar: "#00e5ff" },
  failed:  { dot: "bg-red-500", ring: "ring-red-400/15", bar: "#ff4444" },
  idle:    { dot: "bg-slate-600", ring: "", bar: "#475569" },
};

export default function AgentsPage() {
  const [agents, setAgents] = useState(AGENTS_DEMO);
  const [logs, setLogs] = useState<AgentLog[]>(LOGS_DEMO);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([
    { role: "assistant", content: "I'm your Claude AI analyst. I have live access to today's game data, model predictions, and agent logs. Ask me anything about the pipeline, today's games, or betting strategy." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    agentsApi.status().then(setAgents).catch(() => {});
    agentsApi.logs(undefined, 20).then(d => setLogs(d.logs)).catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const runPipeline = async () => {
    setPipelineRunning(true);
    try {
      await agentsApi.runPipeline();
      toast.success("Pipeline triggered successfully!");
      setTimeout(() => {
        agentsApi.logs(undefined, 20).then(d => setLogs(d.logs)).catch(() => {});
      }, 3000);
    } catch {
      toast.error("Failed to trigger pipeline");
    } finally {
      setTimeout(() => setPipelineRunning(false), 5000);
    }
  };

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatStreaming) return;
    setChatInput("");
    setChatStreaming(true);

    const newHistory: ChatMsg[] = [...chatHistory, { role: "user", content: msg }];
    setChatHistory(newHistory);
    setChatHistory(h => [...h, { role: "assistant", content: "" }]);

    try {
      const res = await api.post("/ai/chat/sync", {
        message: msg,
        history: newHistory.slice(-8).map(m => ({ role: m.role, content: m.content })),
      });
      const reply = res.data.response || "Unable to get response from Claude.";
      setChatHistory(h => {
        const updated = [...h];
        updated[updated.length - 1] = { role: "assistant", content: reply };
        return updated;
      });
    } catch {
      // Fallback demo responses
      const fallbacks: Record<string, string> = {
        "pipeline": "The pipeline runs 6 agents in sequence: Data Collection → Odds Aggregation + Game Context (parallel) → Analytics → Claude AI Analyst. Total runtime is ~12-15 seconds.",
        "agent": "Each agent is a specialized Python class with a `run()` method. The Orchestrator coordinates them all using asyncio.gather() for parallelism.",
        "claude": "Claude AI is integrated at 7 touch points: game narratives, edge explanations, daily slate, injury assessments, line movement reads, post-game recaps, and this chat.",
      };
      const reply = Object.entries(fallbacks).find(([k]) => msg.toLowerCase().includes(k))?.[1]
        || "I can explain the agent pipeline, today's predictions, or any analytical concept. Try asking about the model, a specific game, or how edge detection works.";
      setChatHistory(h => {
        const updated = [...h];
        updated[updated.length - 1] = { role: "assistant", content: reply };
        return updated;
      });
    } finally {
      setChatStreaming(false);
    }
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
            6 agents · Multi-agent pipeline · Claude AI integrated
          </p>
        </div>
        <button
          onClick={runPipeline}
          disabled={pipelineRunning}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all",
            "border border-electric-400/20 bg-electric-400/08 text-electric-400",
            "hover:bg-electric-400/15",
            pipelineRunning && "opacity-60 cursor-wait"
          )}
        >
          {pipelineRunning ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
          {pipelineRunning ? "Running..." : "Run Full Pipeline"}
        </button>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {agents.map((agent) => {
          const s = STATUS_COLORS[(agent as any).status as keyof typeof STATUS_COLORS] || STATUS_COLORS.idle;
          const progress = (agent as any).status === "running" ? 65 : (agent as any).status === "success" ? 100 : 0;

          return (
            <div key={agent.name} className={clsx("card p-4 relative overflow-hidden ring-1", s.ring)}>
              <div className="flex items-center gap-2 mb-2">
                <div className={clsx("w-2 h-2 rounded-full flex-shrink-0", s.dot)} />
                <div className="font-display text-sm font-bold uppercase tracking-wide text-white truncate">
                  {agent.name.replace("Agent", "").replace(/([A-Z])/g, " $1").trim()}
                </div>
              </div>
              <div className="text-[11px] text-slate-500 leading-relaxed mb-3">{agent.desc}</div>
              <div className="flex gap-4 mb-3">
                <div>
                  <div className={clsx(
                    "font-mono text-base font-semibold",
                    (agent as any).status === "success" ? "text-green-400" : "text-electric-400"
                  )}>
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
                <div className="h-full transition-all duration-700" style={{ width: `${progress}%`, background: s.bar }} />
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
              style={{ gridTemplateColumns: "1fr 1fr 80px 60px" }}>
              {["Agent", "Message", "Status", "Time"].map(h => (
                <div key={h} className="text-[9px] font-mono text-slate-500 uppercase tracking-widest last:text-right">{h}</div>
              ))}
            </div>
            {logs.map((log) => (
              <div key={log.id} className="grid px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center"
                style={{ gridTemplateColumns: "1fr 1fr 80px 60px" }}>
                <div className="font-mono text-[10px] text-electric-400 truncate pr-2">
                  {log.agent.replace("Agent", "")}
                </div>
                <div className="font-mono text-[10px] text-slate-400 truncate pr-2">{log.message}</div>
                <div className={clsx(
                  "font-mono text-[10px]",
                  log.status === "success" ? "text-green-400" :
                  log.status === "running" ? "text-electric-400" : "text-red-400"
                )}>
                  {log.status}
                </div>
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
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {chatHistory.map((msg, i) => (
                <div key={i} className={clsx("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={clsx(
                    "max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed",
                    msg.role === "user"
                      ? "bg-electric-400/12 border border-electric-400/20 text-white rounded-br-sm"
                      : "bg-surface-3 border border-white/[0.06] text-slate-200 rounded-bl-sm"
                  )}>
                    {msg.content === "" && chatStreaming ? (
                      <span className="flex gap-1 items-center py-0.5">
                        {[0,1,2].map(i => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </span>
                    ) : msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick prompts */}
            <div className="px-4 pb-2 flex gap-1.5 flex-wrap border-t border-white/[0.05] pt-2">
              {["How does the pipeline work?", "Explain the ELO model", "Best play today?"].map(q => (
                <button
                  key={q}
                  onClick={() => { setChatInput(q); }}
                  className="text-[10px] px-2 py-1 rounded-md border border-white/[0.06] text-slate-500 hover:text-white hover:border-electric-400/20 transition-all"
                >
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
                placeholder="Ask Claude about agents, games, or bets..."
                className="flex-1 bg-surface-3 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-electric-400/25 transition-colors"
              />
              <button
                onClick={sendChat}
                disabled={chatStreaming || !chatInput.trim()}
                className="w-8 h-8 rounded-lg border border-electric-400/20 bg-electric-400/08 text-electric-400 flex items-center justify-center hover:bg-electric-400/15 transition-all disabled:opacity-40"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
