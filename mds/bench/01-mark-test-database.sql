-- mds/bench/01-mark-test-database.sql
-- *** RUN THIS ONLY IN THE TEST PROJECT (the one in .env.bench). NEVER IN PRODUCTION. ***
-- It marks a database as "the test database". `npm run dev:bench` (scripts/sim/dev-bench.mjs) checks for this mark and
-- refuses to start against a database that does not have it, so load tests can never run on production by mistake
-- (a wrong address in .env.bench would be caught here).
-- Before you run it: look at the project name at the top left of the Supabase dashboard and at the address bar
-- (https://supabase.com/dashboard/project/<ref>): the <ref> must be the one in .env.bench's SUPABASE_URL
-- (https://<ref>.supabase.co). Renaming the test project to include BENCH makes it obvious.
create table if not exists public.jh_environment (name text primary key);
alter table public.jh_environment enable row level security; -- no policies: only the service role reads it
insert into public.jh_environment (name) values ('bench') on conflict do nothing;
