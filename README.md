# 🏀 CourtEdge — NBA Analytics Platform

> AI-powered NBA win probability, betting edge detection, and multi-agent analytics

[![Railway](https://img.shields.io/badge/Deploy-Railway-blueviolet)](https://railway.app)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791)](https://postgresql.org)

---

## 🧠 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR AGENT                        │
│           Coordinates all agents, manages schedule           │
└──────┬─────────────────────────────────────┬────────────────┘
       │                                     │
 ┌─────▼──────┐  ┌──────────────┐  ┌────────▼────────┐
 │   Data     │  │    Odds      │  │   Game Context  │
 │ Collection │  │ Aggregation  │  │     Agent       │
 │   Agent    │  │    Agent     │  │ (Injuries/B2B)  │
 └─────┬──────┘  └──────┬───────┘  └────────┬────────┘
       │                │                   │
       └────────────────▼───────────────────┘
                        │
               ┌────────▼────────┐
               │   Analytics /   │
               │  Probability    │
               │     Agent       │
               │  (ELO + Edge)   │
               └────────┬────────┘
                        │
              ┌─────────▼─────────┐
              │    PostgreSQL     │
              │  games · teams   │
              │  odds · preds    │
              └─────────┬─────────┘
                        │
              ┌─────────▼─────────┐
              │   FastAPI REST    │
              │   /api/games      │
              │   /api/odds       │
              │   /api/agents     │
              └─────────┬─────────┘
                        │
              ┌─────────▼─────────┐
              │   Next.js 14 UI   │
              │  Dashboard · Edge │
              │  Teams · Agents   │
              └───────────────────┘
```

## 📦 Project Structure

```
nba-analytics/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── orchestrator.py      # Master coordinator
│   │   │   ├── data_collection.py  # NBA stats fetcher
│   │   │   ├── odds_aggregation.py # Sportsbook odds
│   │   │   ├── analytics.py        # ELO + probability model
│   │   │   └── game_context.py     # Injuries, fatigue, AI narrative
│   │   ├── api/routes/
│   │   │   ├── games.py            # GET /api/games
│   │   │   ├── teams.py            # GET /api/teams
│   │   │   ├── players.py          # GET /api/players
│   │   │   ├── odds.py             # GET /api/odds
│   │   │   ├── predictions.py      # GET /api/predictions
│   │   │   ├── agents.py           # POST /api/agents/run/*
│   │   │   └── health.py           # GET /api/health
│   │   ├── models/database.py      # SQLAlchemy models
│   │   └── core/
│   │       ├── config.py           # Settings (pydantic-settings)
│   │       └── scheduler.py        # APScheduler cron jobs
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Dashboard: Today's Games
│   │   │   ├── teams/page.tsx      # Team standings + ratings
│   │   │   ├── insights/page.tsx   # Betting edge insights
│   │   │   └── agents/page.tsx     # Agent monitor
│   │   ├── components/
│   │   │   ├── GameCard.tsx        # Core game card UI
│   │   │   ├── Navbar.tsx          # Navigation
│   │   │   └── ProbabilityBar.tsx  # Win probability display
│   │   └── lib/api.ts              # Typed API client
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── package.json
├── database/init.sql
├── docker-compose.yml              # Local dev
├── railway.toml                    # Railway deployment
└── README.md
```

## 🚀 Quick Start (Local)

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for frontend dev)
- Python 3.11+ (for backend dev)

### 1. Clone and configure
```bash
git clone https://github.com/you/nba-analytics.git
cd nba-analytics

# Configure backend
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys
```

### 2. Start with Docker Compose
```bash
docker compose up --build
```

Services:
- **Frontend** → http://localhost:3000
- **Backend API** → http://localhost:8000
- **API Docs** → http://localhost:8000/api/docs
- **PostgreSQL** → localhost:5432
- **Redis** → localhost:6379

### 3. Trigger initial data load
```bash
curl -X POST http://localhost:8000/api/agents/run/pipeline
```

### 4. Local frontend development (hot reload)
```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000/api npm run dev
```

### 5. Local backend development (hot reload)
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

---

## 🌐 API Reference

### Games
```
GET  /api/games                    — Get games (defaults to today)
     ?game_date=2025-01-15         — Filter by date
     ?status=live                  — Filter: scheduled|live|final
     ?team=LAL                     — Filter by team abbreviation
     ?min_edge=3                   — Only games with 3%+ edge

GET  /api/games/{id}               — Single game detail
GET  /api/games/{id}/odds-history  — Line movement history
```

### Teams
```
GET  /api/teams                    — All 30 teams (sorted by ELO)
     ?conference=East              — Filter by conference
GET  /api/teams/{id}               — Team by ID
GET  /api/teams/abbreviation/{abbr} — Team by abbr (e.g. LAL)
```

### Predictions
```
GET  /api/predictions/top-edges    — Top betting edges
     ?min_edge=3.0                 — Minimum edge threshold
     ?limit=10                     — Max results
```

### Agents
```
POST /api/agents/run/pipeline      — Trigger full pipeline
POST /api/agents/run/odds          — Odds refresh only
POST /api/agents/run/predictions   — Predictions refresh only
GET  /api/agents/status            — All agent statuses
GET  /api/agents/logs              — Execution log history
```

### Health
```
GET  /api/health                   — Service health check
GET  /api/docs                     — Interactive Swagger UI
```

---

## 🚂 Railway Deployment

### Step 1: Create Railway project
```bash
npm install -g @railway/cli
railway login
railway init
```

### Step 2: Add PostgreSQL and Redis
In Railway dashboard:
1. New Service → PostgreSQL
2. New Service → Redis

### Step 3: Deploy Backend
```bash
cd backend
railway up --service backend
```

Set environment variables in Railway dashboard:
```
DATABASE_URL        = ${{Postgres.DATABASE_URL}}
REDIS_URL           = ${{Redis.REDIS_URL}}
ODDS_API_KEY        = <your_key>
BALLDONTLIE_API_KEY = <your_key>
ANTHROPIC_API_KEY   = <your_key>
SECRET_KEY          = <64_char_random_string>
ALLOWED_ORIGINS     = ["https://your-frontend.up.railway.app"]
```

### Step 4: Deploy Frontend
```bash
cd frontend
railway up --service frontend
```

Set environment variables:
```
NEXT_PUBLIC_API_URL = https://your-backend.up.railway.app/api
```

### Step 5: Trigger initial load
```bash
curl -X POST https://your-backend.up.railway.app/api/agents/run/pipeline
```

---

## 🧮 Analytics Model

### ELO Win Probability
```
P(home wins) = 1 / (1 + 10^((away_elo - home_elo - hca_elo) / 400))
Home court advantage = 3.5 pts = ~100 ELO points
```

### Composite Factors
| Factor | Weight |
|--------|--------|
| ELO Rating | 40% |
| Net Rating (Off/Def) | 30% |
| Rest / Back-to-Back | 10% |
| Injury Impact | 10% |
| Head-to-Head | 5% |
| Pace Adjustment | 5% |

### Betting Edge
```
Edge% = Model Win Probability - Book Implied Probability (no-vig)
Positive edge = model sees value vs. market
```

### Kelly Criterion (Bet Sizing)
```
f* = (b·p - q) / b   where b = net odds, p = win prob, q = 1-p
Fractional Kelly (25%) used for safety
```

---

## 📡 External APIs Required

| API | Purpose | Free Tier |
|-----|---------|-----------|
| [The Odds API](https://the-odds-api.com) | Sportsbook odds | 500 req/month |
| [BallDontLie](https://www.balldontlie.io) | NBA stats | 60 req/min |
| [Anthropic Claude](https://anthropic.com) | AI narratives | Pay per token |

The app runs in **demo mode** without API keys — synthetic odds are injected for UI preview.

---

## 🎨 Design System

- **Font**: Barlow Condensed (display) + DM Sans (body) + JetBrains Mono (data)
- **Color**: Deep court navy (#040610) + Electric cyan (#00E5FF) + Gold (#FFD700)
- **Theme**: Luxury sportsbook — minimal, data-dense, high contrast

---

## 📊 Database Schema

```sql
teams        — 30 NBA teams with ELO + advanced ratings
players      — Roster data + injury status + season averages
games        — Schedule + live scores + context flags (B2B, rest)
odds         — Sportsbook lines with full history (line movement)
predictions  — Model output: win prob, implied prob, edge, Kelly units
agent_logs   — Agent execution history + performance metrics
```

---

## 🔒 Bonus Features (Roadmap)

- [ ] User accounts + saved picks (NextAuth.js + JWT)
- [ ] Push notifications for high-edge bets (web push API)
- [ ] Historical bet tracking + ROI analysis
- [ ] Public API with rate limiting (API key auth)
- [ ] Discord/Slack bot for edge alerts
- [ ] ML model v2 (XGBoost / neural net)

---

## 📄 License

MIT — build on it, profit from it, just don't hold us responsible for bad beats 🏀
