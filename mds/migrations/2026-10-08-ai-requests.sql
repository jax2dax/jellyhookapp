-- 2026-10-08: the AI request ledger (Ask Hook).
-- Run once in the Supabase SQL editor. Safe to run twice.
--
-- One row per question a person asks Ask Hook: who, which site, which model, what it cost in tokens, dollars
-- and Hook credits, and how it ended. It is the meter for three things: the daily allowance per person, the
-- daily dollar cap for the whole product (the guard against a runaway bill), and the AI section of /dev/usage.
-- It stores NO question text and NO query by default: only sizes and costs. The two optional columns
-- (question, spec) are filled only when AI_LOG_PAIRS=1 is set, to collect real question-to-query pairs for
-- improving the prompt or, later, for training. Leave that off unless you have told your users.
--
-- Later (planned, not built): a general events table that also meters Hook runs and the AI assistant, with a
-- "kind" label per row. This table's `feature` column is the seed of that: today only 'hook_translate'.

create table if not exists public.ai_requests (
  id uuid not null default gen_random_uuid() primary key,
  created_at timestamp with time zone not null default now(),
  user_id text not null,                       -- Clerk user id
  site_id uuid null references public.sites (id) on delete set null,
  feature text not null default 'hook_translate',
  model text not null,                         -- the provider's model id, e.g. gpt-5.6-terra
  status text not null,                        -- ok | clarify | unsupported | failed | error
  attempts integer not null default 0,         -- 2 = the model needed a repair retry
  input_tokens integer not null default 0,
  cached_tokens integer not null default 0,    -- the part of the input served from the provider's cache
  output_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  credits integer not null default 0,          -- Hook credits charged (1 credit = AI_USD_PER_CREDIT dollars, at least 1)
  latency_ms integer null,
  question_chars integer null,
  first_error text null,                       -- what the validator complained about on the first try, if anything
  question text null,                          -- only when AI_LOG_PAIRS=1
  spec jsonb null                              -- only when AI_LOG_PAIRS=1
);

create index if not exists ai_requests_user_day_idx on public.ai_requests using btree (user_id, created_at desc);
create index if not exists ai_requests_created_idx on public.ai_requests using btree (created_at desc);
create index if not exists ai_requests_site_idx on public.ai_requests using btree (site_id, created_at desc);

-- Service role only (the server writes and reads it). No policy on purpose: RLS on with no policy means the
-- browser can never read it, which matters because the optional columns can hold what someone typed.
alter table public.ai_requests enable row level security;
revoke all on table public.ai_requests from anon, authenticated;
