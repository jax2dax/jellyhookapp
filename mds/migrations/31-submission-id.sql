-- 31-submission-id.sql
-- Each form submission carries its own id from the browser (public/tracker.js, `submission_id`). The tracker now keeps
-- unsent requests in an outbox and sends them again when the server was busy (a 503) or the page closed before the answer
-- came, so the same submission can arrive twice. This id makes the second arrival a no-op instead of a second lead
-- (app/api/track-form/route.js). Found by the crowd test (mds/crowd-test/v1/summary.md).
--
-- Run in Supabase: the test project first, then production at the next deploy. Safe to run twice. Until it has run, the
-- tracker route stores leads without the id (and a repeat is only caught by the one-minute same-email rule).

alter table public.form_submissions add column if not exists submission_id text;

-- one lead per submission id per site; older leads (no id) are not affected
create unique index if not exists form_submissions_site_submission_idx
  on public.form_submissions (site_id, submission_id)
  where submission_id is not null;
