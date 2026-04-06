#!/bin/sh
set -e

# Railway provides $PORT — frontend gets it, backend runs on 8000 internally
FRONTEND_PORT="${PORT:-3000}"
BACKEND_PORT=8000

echo "=== NBA Analytics Platform ==="
echo "Frontend: port $FRONTEND_PORT (public)"
echo "Backend:  port $BACKEND_PORT (internal)"

# Start backend API on port 8000
PYTHONPATH=/app uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT --workers 1 &
BACKEND_PID=$!

# Start Next.js frontend on $PORT (Railway-exposed port)
cd /app/frontend
PORT=$FRONTEND_PORT HOSTNAME=0.0.0.0 exec node server.js
