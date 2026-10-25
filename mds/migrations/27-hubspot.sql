-- 27-hubspot.sql
-- HubSpot connections (mds/build/integrations/hubspot.md): one per site. The access and refresh tokens are sealed by
-- the server (lib/notifications/secret.ts, AES-256-GCM with CHANNEL_SECRET_KEY). Only the service role reads this
-- table: RLS is on and there are no policies, so no signed-in user can read a token.
create table if not exists public.hubspot_connections (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  portal_id bigint not null,
  ui_domain text not null default 'app.hubspot.com',
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scopes text[] not null default '{}',
  status text not null default 'ok' check (status in ('ok', 'failing')),
  last_error text,
  connected_by text not null,
  connected_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hubspot_connections_site_key unique (site_id)
);

-- the card asks by HubSpot account
create index if not exists hubspot_connections_portal_idx on public.hubspot_connections (portal_id);

alter table public.hubspot_connections enable row level security;

-- the card finds a contact's Jellyhook leads by email on the connected sites
create index if not exists form_submissions_site_email_idx on public.form_submissions (site_id, lower(email));
