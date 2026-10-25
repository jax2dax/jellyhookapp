-- 24-acquisition (2026-10-24): what each visit's landing link said about the ad that brought it, for the Acquisition
-- page and "came from this ad" in marks. Run once in the Supabase SQL editor BEFORE deploying the code that uses it.
-- Safe to run twice. Visits recorded before it simply have these empty.
--
-- utm_content   usually the ad or creative (set in the ad tool's URL parameters)
-- utm_term      usually the keyword (search ads)
-- click_id      which ad network's click id was on the landing URL: google, meta, microsoft, tiktok, linkedin, x.
--               Only the network, never the id itself. Says "a paid click" even when the ad had no UTMs.
-- landing_path  the first page of the visit
alter table public.sessions add column if not exists utm_content text null;
alter table public.sessions add column if not exists utm_term text null;
alter table public.sessions add column if not exists click_id text null;
alter table public.sessions add column if not exists landing_path text null;

-- the Acquisition page reads a site's visits by start time
create index if not exists sessions_site_started_idx on public.sessions (site_id, started_at);
