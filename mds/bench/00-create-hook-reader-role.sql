-- mds/bench/00-create-hook-reader-role.sql
-- *** RUN THIS ONLY IN THE TEST PROJECT, and BEFORE pasting bench-schema.sql. NEVER IN PRODUCTION. ***
-- Production has a read-only database login, hook_reader (jh-hook/setup.sql), that the Hook queries use. The structure
-- copy (bench-schema.sql) refers to it in its access rules, so it must exist first, or the copy stops with
-- 'role "hook_reader" does not exist'.
-- Before you run it: replace CHANGE_ME_TEST_PASSWORD below with a NEW password of letters and digits only, one you have
-- not used anywhere else (NOT production's). Write it down: it goes into HOOK_DATABASE_URL in .env.bench (mds/build/control-room.md).
create role hook_reader login password 'CHANGE_ME_TEST_PASSWORD';
alter role hook_reader set default_transaction_read_only = on;
alter role hook_reader set statement_timeout = '8s';
alter role hook_reader set idle_in_transaction_session_timeout = '10s';
