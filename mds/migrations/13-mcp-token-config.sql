-- 2026-10-14: per-token settings for MCP access tokens.
-- Run once in the Supabase SQL editor, BEFORE deploying the code that reads it (the token check selects this column).
-- Safe to run twice.
--
-- `config` holds optional per-token choices made when the token is created:
--   {"tools": ["get_schema","run_hook"], "maxRows": 20, "maxCredits": 5, "callsPerMinute": 10, "callsPerDay": 100}
-- Every key is optional. An empty object means "all tools, the server-wide limits". The server-wide limits (environment
-- variables) are CEILINGS: a token's value can only be lower. Existing tokens keep working unchanged (default '{}').

alter table public.mcp_tokens add column if not exists config jsonb not null default '{}'::jsonb;
