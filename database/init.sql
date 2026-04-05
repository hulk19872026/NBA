-- NBA Analytics Platform - Database Init
-- Run automatically by Docker on first start

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- Fuzzy text search

-- Performance settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';

-- Tables are auto-created by SQLAlchemy on startup.
-- This file adds any supplemental indexes and seed data.

-- Full-text search index on team names (added after tables exist)
-- CREATE INDEX IF NOT EXISTS ix_teams_name_trgm ON teams USING gin(name gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS ix_players_name_trgm ON players USING gin((first_name || ' ' || last_name) gin_trgm_ops);
