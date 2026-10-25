-- 25-ads (2026-10-24): the Ads library. Every ad a click came from (the ad network's ad id in utm_content, its name in
-- ad_name, the campaign id in campaign_id: the tracking templates on the Acquisition page) is listed once per site, so
-- people can add the ad's video link, a thumbnail and an internal tag ("2026 Core Demo Video"). Hooked-lead messages in
-- Slack then show the tag, the thumbnail and a "Watch the ad" button. Run once in the Supabase SQL editor BEFORE
-- deploying the code that uses it. Safe to run twice. Needs 24-acquisition.sql. Plan: mds/build/acquisition/plan.md.

-- what the landing link said, besides 24's columns
alter table public.sessions add column if not exists ad_name text null;
alter table public.sessions add column if not exists campaign_id text null;

-- one row per ad per site (platform + the ad network's ad id)
create table if not exists public.ads (
  site_id uuid not null references public.sites (id) on delete cascade,
  platform text not null,                     -- Meta, Google, TikTok... (lib/acquisition/channel.ts)
  ad_id text not null check (char_length(ad_id) between 1 and 200),   -- utm_content: {{ad.id}}, {creative}, __CID__
  ad_name text null,                          -- the latest ad_name seen in a click
  campaign text null,                         -- the latest utm_campaign seen
  campaign_id text null,
  tag text null check (tag is null or char_length(tag) between 1 and 80),            -- the team's own name for it
  video_url text null check (video_url is null or char_length(video_url) <= 1000),   -- where to watch it
  thumbnail_path text null,                   -- in the ad-thumbnails bucket (copied there: ad networks' links expire)
  thumbnail_url text null,                    -- its public address (what Slack shows)
  clicks integer not null default 0,          -- visits that came from it
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  updated_by text null,
  primary key (site_id, platform, ad_id)
);
create index if not exists ads_site_seen_idx on public.ads (site_id, last_seen desc);

alter table public.ads enable row level security;
revoke all on table public.ads from anon, authenticated;
grant select on table public.ads to authenticated;
drop policy if exists ads_select on public.ads;
create policy ads_select on public.ads for select to authenticated using (
  exists (select 1 from public.site_members m where m.site_id = ads.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active')
);
-- writes: the server (service role): the tracking route records ads, members edit tag / video / thumbnail through
-- lib/actions/ads.action.ts and app/api/ads/thumbnail.

-- counts a click and keeps the latest name, in one statement (called by app/api/track/route.js on a visit's start)
create or replace function public.jh_seen_ad(p_site uuid, p_platform text, p_ad text, p_name text, p_campaign text, p_campaign_id text)
returns void language sql security definer set search_path = public as $$
  insert into ads (site_id, platform, ad_id, ad_name, campaign, campaign_id, clicks)
  values (p_site, p_platform, left(p_ad, 200), left(p_name, 200), left(p_campaign, 200), left(p_campaign_id, 200), 1)
  on conflict (site_id, platform, ad_id) do update set
    clicks = ads.clicks + 1,
    last_seen = now(),
    ad_name = coalesce(excluded.ad_name, ads.ad_name),
    campaign = coalesce(excluded.campaign, ads.campaign),
    campaign_id = coalesce(excluded.campaign_id, ads.campaign_id);
$$;
revoke all on function public.jh_seen_ad(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.jh_seen_ad(uuid, text, text, text, text, text) to service_role;

-- the thumbnails: a public bucket (Slack must be able to load them), images only, 2 MB each
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-thumbnails', 'ad-thumbnails', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
