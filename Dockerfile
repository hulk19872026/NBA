# ── Stage 1: Build Next.js static export ────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
# Output is in /frontend/out/

# ── Stage 2: Python backend serving everything ──────────────────────────────
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Backend code
COPY backend/app ./app
COPY backend/alembic.ini .

# Frontend static files — served by FastAPI
COPY --from=frontend-builder /frontend/out ./static

# Non-root user
RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app
USER appuser

# Single process — FastAPI serves both API and frontend
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
