-- 2026-10-13: MCP access tokens and the MCP call ledger.
-- Run once in the Supabase SQL editor. Safe to run twice.
--
-- An MCP token lets an AI app (Claude, Cursor...) read ONE site's Hook data through /api/mcp.
--   * Only a SHA-256 hash of the token is stored, never the token itself. It is shown once, at creation.
--   * token_prefix (the first characters) is stored only so a person can tell tokens apart in a list.
--   * consent_at / consent_version record that the person ticked the consent box, and which wording they saw.
--   * allow_pii: whether this token may receive unmasked emails, names and phone numbers (default: masked).
--   * expires_at is required: tokens do not live forever. revoked_at ends a token at once.
-- mcp_calls is one row per tool call: who (token), what (tool), how it ended, what it cost. It is the seed of the
-- general events table (see mds/build/ai-hook-translate/roadmap.md): `kind` is the label.
-- Both tables are service-role only (RLS on, no policy, no grants).

create table if not exists public.mcp_tokens (
  id uuid not null default gen_random_uuid() primary key,
  created_at timestamp with time zone not null default now(),
  site_id uuid not null references public.sites (id) on delete cascade,
  created_by text not null,                     -- Clerk user id
  label text not null,
  token_hash text not null unique,              -- sha256 hex of the token
  token_prefix text not null,                   -- first characters, for recognising it in a list
  allow_pii boolean not null default false,
  consent_at timestamp with time zone not null,
  consent_version text not null,
  expires_at timestamp with time zone not null,
  revoked_at timestamp with time zone null,
  last_used_at timestamp with time zone null
);
create index if not exists mcp_tokens_site_idx on public.mcp_tokens using btree (site_id, created_at desc);

create table if not exists public.mcp_calls (
  id uuid not null default gen_random_uuid() primary key,
  created_at timestamp with time zone not null default now(),
  token_id uuid null references public.mcp_tokens (id) on delete set null,
  site_id uuid null references public.sites (id) on delete set null,
  kind text not null,                           -- mcp_run | mcp_validate | mcp_schema | mcp_pages | mcp_describe
  status text not null,                         -- ok | error | refused | rate_limited
  credits integer not null default 0,
  rows_returned integer null,
  latency_ms integer null,
  error text null                               -- short, never the query or the data
);
create index if not exists mcp_calls_token_idx on public.mcp_calls using btree (token_id, created_at desc);
create index if not exists mcp_calls_created_idx on public.mcp_calls using btree (created_at desc);

alter table public.mcp_tokens enable row level security;
alter table public.mcp_calls enable row level security;
revoke all on table public.mcp_tokens from anon, authenticated;
revoke all on table public.mcp_calls from anon, authenticated;
