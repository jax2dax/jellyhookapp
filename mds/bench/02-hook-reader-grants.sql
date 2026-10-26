-- mds/bench/02-hook-reader-grants.sql
-- *** RUN THIS ONLY IN THE TEST PROJECT, AFTER bench-schema.sql. NEVER IN PRODUCTION (it already has these). ***
-- The structure copy is made without permissions (pg_dump --no-privileges), so what hook_reader may read has to be
-- granted again. Same as jh-hook/setup.sql section 2: it may read these five tables and nothing else.
grant usage on schema public to hook_reader;
grant select on public.page_views, public.sessions, public.form_submissions, public.visitors, public.form_engagement to hook_reader;
