-- First-party analytics for totalfootball.naurra.ai
--
-- WHAT IS DELIBERATELY NOT STORED
--   · no IP address
--   · no user-agent string (only a coarse mobile/tablet/desktop bucket)
--   · no cookies of any kind
--   · no cross-site or cross-visit identifier
--
-- `session_id` is a random UUID held in sessionStorage, so it dies when the tab
-- closes. It links the pages of one visit together and nothing else. That keeps
-- "how many people, which pages, how long" answerable without building a
-- profile of anybody, and it is why this can be honestly described as
-- privacy-first in the cookie notice.
--
-- Rows are only ever written after the visitor has accepted analytics.

create table if not exists public.site_events (
  id          bigint generated always as identity primary key,
  session_id  uuid        not null,
  type        text        not null,
  path        text        not null,
  referrer    text,
  label       text,
  duration_ms integer,
  country     text,
  device      text,
  created_at  timestamptz not null default now(),

  constraint site_events_type_ck   check (type in ('pageview', 'duration', 'click')),
  constraint site_events_device_ck check (device is null or device in ('mobile', 'tablet', 'desktop')),
  -- A visit longer than 6 hours is a forgotten tab, not a reader. Cap it so a
  -- single stale row cannot wreck the average-time figure.
  constraint site_events_duration_ck check (duration_ms is null or (duration_ms >= 0 and duration_ms <= 21600000)),
  constraint site_events_path_len    check (char_length(path) <= 512)
);

create index if not exists site_events_created_at_idx on public.site_events (created_at desc);
create index if not exists site_events_path_idx       on public.site_events (path);
create index if not exists site_events_session_idx    on public.site_events (session_id);
create index if not exists site_events_type_idx       on public.site_events (type);

alter table public.site_events enable row level security;

drop policy if exists site_events_anon_insert on public.site_events;
create policy site_events_anon_insert
  on public.site_events
  for insert
  to anon
  with check (true);

-- Same two-layer rule as subscribers: the policy permits the insert, the GRANT
-- makes it possible at all. Without the grant PostgREST returns 42501.
-- INSERT only, so the anon role can never read the traffic log back.
grant usage on schema public to anon;
grant insert on public.site_events to anon;
revoke select, update, delete on public.site_events from anon;
