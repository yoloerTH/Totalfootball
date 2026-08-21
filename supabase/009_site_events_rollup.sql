-- Folding the traffic log down, without losing the log.
--
-- THE PROBLEM. `public.site_events` gets one row per page view, one per click
-- and one per reading time. It is the right shape for a table that answers
-- "what happened in the last 24 hours" and the wrong shape for one that keeps
-- answering it in two years: a few hundred rows a day is a hundred thousand a
-- year, every one of them still being scanned by a report that only ever looks
-- at yesterday. Nothing here is urgent at today's size. It is the kind of thing
-- that is cheap to fix now and a migration under load later.
--
-- THE POSITION TAKEN. A complete log is worth keeping and the individual rows
-- are not. Nobody will ever ask which session read /faq at 14:02 on a Tuesday
-- in March. What is asked, and what has to survive, is the SHAPE of a day: how
-- many came, how long they stayed, what they read, where they came from, what
-- they pressed. So every day older than the raw window collapses into ONE row
-- carrying exactly that, and the rows it was made of are deleted.
--
--   raw, last 4-5 days   ·  every event, exactly as collected
--   folded, before that  ·  one row per day, forever
--
-- The daily report reads a rolling 48-hour window and a 48-hour window before
-- that (netlify/functions/daily-report.mts), so it never touches a folded day.
-- That is why the floor below is 3 days and not 1: a compaction that ate into
-- the report's own window would break the one thing this table exists for, and
-- it would do it silently.
--
-- WHAT IS DELIBERATELY LOST. `session_id` — the whole point of 002 is that it
-- dies with the tab, and a per-day visitor count is the last thing that can be
-- honestly derived from it before it goes. Individual timestamps within a day.
-- The pairing of one visit's pages. Long-tail paths beyond the top handful.
-- None of it can be reconstructed, and none of it was ever going to be read.
--
-- WHERE IT RUNS. From the daily report, right after it has read its own
-- numbers, and from scripts/compact-events.mjs by hand. There is no pg_cron on
-- this project and adding one would put the schedule in a place nobody looks;
-- the report is already a daily job that holds the service-role key, and a
-- housekeeping step that reports its own result in the message is one that
-- cannot rot unnoticed.

-- ── the folded day ──────────────────────────────────────────────────────────
--
-- One row per calendar day, in ATHENS time. Not UTC: the day boundary here has
-- to be the one a person means when they say "Tuesday", and everybody reading
-- this report is in Athens. The daily report already prints its times that way.
--
-- The breakdowns are jsonb maps of name → count rather than child tables. They
-- are read by a human a handful of times a year, never joined, and never
-- filtered on; a table would buy indexes nobody queries and cost the one
-- property that matters here, which is that a day is a single row you can look
-- at whole.

create table if not exists public.site_events_daily (
  day             date primary key,

  pageviews       integer not null default 0,
  -- Distinct sessions with at least one page view. Not additive — see the note
  -- on the merge in `compact_site_events`.
  visits          integer not null default 0,
  clicks          integer not null default 0,
  -- How many duration events went into the average, so a later merge can
  -- re-weight it instead of averaging two averages.
  durations       integer not null default 0,
  avg_duration_ms integer,

  -- name → count. Top slice only for paths, referrers and labels; countries and
  -- devices are small enough to keep whole.
  paths           jsonb not null default '{}'::jsonb,
  referrers       jsonb not null default '{}'::jsonb,
  countries       jsonb not null default '{}'::jsonb,
  devices         jsonb not null default '{}'::jsonb,
  labels          jsonb not null default '{}'::jsonb,

  /** How many raw rows this one replaced. The honest size of what was dropped. */
  events_folded   integer not null default 0,
  folded_at       timestamptz not null default now()
);

comment on table public.site_events_daily is
  'One row per day of site_events, folded once the raw rows are older than the '
  'report window. See supabase/009_site_events_rollup.sql.';

-- Nothing in the browser reads this either. Same position as the raw table.
alter table public.site_events_daily enable row level security;
revoke all on public.site_events_daily from anon, authenticated;

-- ── adding two count maps together ──────────────────────────────────────────
--
-- Needed only by the merge path — a day that is folded twice because late rows
-- arrived for it. Written out rather than inlined because the alternative is
-- the same forty characters of jsonb_each_text five times in one INSERT.

create or replace function public.jsonb_add_counts(a jsonb, b jsonb)
returns jsonb
language sql
immutable
parallel safe
set search_path to 'public'
as $$
  select coalesce(jsonb_object_agg(k, n), '{}'::jsonb)
  from (
    select k, sum(v) as n
    from (
      select key as k, (value)::numeric as v from jsonb_each_text(coalesce(a, '{}'::jsonb))
      union all
      select key,      (value)::numeric     from jsonb_each_text(coalesce(b, '{}'::jsonb))
    ) pairs
    group by k
  ) summed
$$;

-- A pure helper over two jsonb values with no data access of its own, so this
-- is tidiness rather than a hole being closed. It is here because the default
-- grant on a new function is EXECUTE to PUBLIC, and a project whose whole
-- posture is "anon holds the key that is in the browser bundle" should not have
-- functions it did not decide to expose.
revoke all on function public.jsonb_add_counts(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.jsonb_add_counts(jsonb, jsonb) to service_role;

-- ── the compaction ──────────────────────────────────────────────────────────
--
-- ONE STATEMENT, and that is the only interesting thing about it. The DELETE is
-- a data-modifying CTE whose RETURNING feeds every aggregate below it, so the
-- rows are read and removed in the same snapshot. There is no window in which
-- a row has been counted but not deleted, or deleted but not counted, and
-- nothing to reconcile if the connection drops halfway: the transaction either
-- happened or it did not.
--
-- Returns what it did, as jsonb, because a housekeeping job that returns
-- nothing is one you cannot tell apart from a housekeeping job that did not
-- run.

create or replace function public.compact_site_events(keep_days integer default 4)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  cutoff_ts timestamptz;
  result    jsonb;
begin
  -- The report reads back 48 hours and compares against the 48 before that.
  -- Anything under 3 whole days would start eating the numbers it prints.
  if keep_days is null or keep_days < 3 then
    raise exception 'compact_site_events: keep_days must be at least 3, got %', keep_days
      using hint = 'The daily report reads a 96-hour window. See supabase/009_site_events_rollup.sql.';
  end if;

  -- Midnight in Athens, `keep_days` days back. Folding on a day boundary rather
  -- than on "now minus N hours" is what makes a folded row mean a whole day —
  -- fold at 18:00 and the oldest kept day would be a partial one, and it would
  -- be folded again tomorrow with a different total.
  cutoff_ts := (date_trunc('day', (now() at time zone 'Europe/Athens'))
                - make_interval(days => keep_days)) at time zone 'Europe/Athens';

  with doomed as (
    delete from public.site_events
     where created_at < cutoff_ts
    returning session_id, type, path, referrer, label, duration_ms, country, device, created_at
  ),
  -- Stamped with its Athens day once, so every aggregate below groups on the
  -- same value rather than recomputing the conversion five times.
  d as (
    select (created_at at time zone 'Europe/Athens')::date as day, *
    from doomed
  ),
  totals as (
    select
      day,
      count(*)                                                        as events_folded,
      count(*) filter (where type = 'pageview')                       as pageviews,
      count(distinct session_id) filter (where type = 'pageview')     as visits,
      count(*) filter (where type = 'click')                          as clicks,
      count(*) filter (where type = 'duration' and duration_ms is not null) as durations,
      round(avg(duration_ms) filter (where type = 'duration'))::integer    as avg_duration_ms
    from d
    group by day
  ),
  -- The top slice of each breakdown. A day has a long tail of paths visited
  -- once and referrers nobody has heard of; keeping all of them would put an
  -- unbounded map in a row that is supposed to be readable at a glance.
  ranked_paths as (
    select day, path as k, count(*) as n,
           row_number() over (partition by day order by count(*) desc, path) as rn
    from d where type = 'pageview' group by day, path
  ),
  ranked_refs as (
    select day, coalesce(referrer, 'direct') as k, count(distinct session_id) as n,
           row_number() over (partition by day
                              order by count(distinct session_id) desc, coalesce(referrer, 'direct')) as rn
    from d where type = 'pageview' group by day, coalesce(referrer, 'direct')
  ),
  ranked_labels as (
    select day, label as k, count(*) as n,
           row_number() over (partition by day order by count(*) desc, label) as rn
    from d where type = 'click' and label is not null group by day, label
  ),
  paths as (
    select day, jsonb_object_agg(k, n) as m from ranked_paths where rn <= 15 group by day
  ),
  refs as (
    select day, jsonb_object_agg(k, n) as m from ranked_refs where rn <= 10 group by day
  ),
  -- Labels are the studio's own events as well as the marketing clicks. Kept
  -- wider than the others: this is the only record of what coaches pressed.
  labels as (
    select day, jsonb_object_agg(k, n) as m from ranked_labels where rn <= 25 group by day
  ),
  -- Two closed vocabularies. Kept whole, because "whole" is at most a handful
  -- of keys and a truncated country list is a misleading one.
  countries as (
    select day, jsonb_object_agg(k, n) as m from (
      select day, coalesce(country, '?') as k, count(distinct session_id) as n
      from d where type = 'pageview' group by day, coalesce(country, '?')
    ) c group by day
  ),
  devices as (
    select day, jsonb_object_agg(k, n) as m from (
      select day, coalesce(device, '?') as k, count(distinct session_id) as n
      from d where type = 'pageview' group by day, coalesce(device, '?')
    ) v group by day
  ),
  written as (
    insert into public.site_events_daily as t (
      day, pageviews, visits, clicks, durations, avg_duration_ms,
      paths, referrers, countries, devices, labels, events_folded, folded_at
    )
    select
      x.day, x.pageviews, x.visits, x.clicks, x.durations, x.avg_duration_ms,
      coalesce(p.m, '{}'::jsonb), coalesce(r.m, '{}'::jsonb), coalesce(c.m, '{}'::jsonb),
      coalesce(v.m, '{}'::jsonb), coalesce(l.m, '{}'::jsonb), x.events_folded, now()
    from totals x
    left join paths     p using (day)
    left join refs      r using (day)
    left join countries c using (day)
    left join devices   v using (day)
    left join labels    l using (day)
    on conflict (day) do update set
      -- A day is normally folded exactly once. This path exists for the one
      -- case that can still happen: a row written late — a beacon that sat in a
      -- browser's queue over a weekend — landing in a day that is already
      -- folded. Counts ADD, which is right for everything except `visits`,
      -- where a session that appears in both halves is counted twice. It is
      -- documented rather than fixed: the alternative is keeping every session
      -- id forever, which is the opposite of what this table is for, and the
      -- error is a handful of visits on a day that is already history.
      pageviews       = t.pageviews + excluded.pageviews,
      visits          = t.visits + excluded.visits,
      clicks          = t.clicks + excluded.clicks,
      -- The average re-weighted by how many readings each side had, rather
      -- than averaged with the new one as if the two were the same size.
      avg_duration_ms = case
        when t.durations + excluded.durations = 0 then null
        else ((coalesce(t.avg_duration_ms, 0)::numeric * t.durations
             + coalesce(excluded.avg_duration_ms, 0)::numeric * excluded.durations)
             / (t.durations + excluded.durations))::integer
      end,
      durations       = t.durations + excluded.durations,
      paths           = public.jsonb_add_counts(t.paths, excluded.paths),
      referrers       = public.jsonb_add_counts(t.referrers, excluded.referrers),
      countries       = public.jsonb_add_counts(t.countries, excluded.countries),
      devices         = public.jsonb_add_counts(t.devices, excluded.devices),
      labels          = public.jsonb_add_counts(t.labels, excluded.labels),
      events_folded   = t.events_folded + excluded.events_folded,
      folded_at       = now()
    returning day, events_folded
  )
  select jsonb_build_object(
    'days',   count(*),
    'events', coalesce(sum(events_folded), 0),
    'from',   min(day),
    'to',     max(day),
    'cutoff', cutoff_ts
  ) into result
  from written;

  return coalesce(result, jsonb_build_object('days', 0, 'events', 0, 'cutoff', cutoff_ts));
end;
$$;

-- Same position as execute_sql in 006: it deletes rows and bypasses RLS, so it
-- is reachable by the service-role key and by nothing else. anon holds the key
-- that is in the browser bundle and must never be able to call this.
revoke all on function public.compact_site_events(integer) from public, anon, authenticated;
grant execute on function public.compact_site_events(integer) to service_role;

-- ── reading the two halves as one ───────────────────────────────────────────
--
-- After the first fold, `select … from site_events where created_at >= now() -
-- interval '30 days'` quietly starts meaning "the last four days", which is the
-- worst kind of wrong: the query still runs, still returns rows, and is now a
-- lie. This view is the answer to it — the folded days, plus the raw tail
-- aggregated the same way on the fly, in one place with one shape.
--
-- scripts/analytics-report.mjs reads it for anything spanning more than the raw
-- window. The daily report does NOT: it works in rolling hours rather than
-- calendar days, and every hour it wants is still raw.

create or replace view public.site_events_history as
  select
    day, pageviews, visits, clicks, durations, avg_duration_ms,
    paths, referrers, countries, devices, labels,
    false as raw
  from public.site_events_daily
  union all
  select
    (created_at at time zone 'Europe/Athens')::date as day,
    count(*) filter (where type = 'pageview')::integer,
    count(distinct session_id) filter (where type = 'pageview')::integer,
    count(*) filter (where type = 'click')::integer,
    count(*) filter (where type = 'duration' and duration_ms is not null)::integer,
    round(avg(duration_ms) filter (where type = 'duration'))::integer,
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    true as raw
  from public.site_events
  group by 1;

revoke all on public.site_events_history from anon, authenticated;

-- ── first run ───────────────────────────────────────────────────────────────
--
-- Deliberately NOT run by this file. Applying a migration should not silently
-- delete a year of rows the first time somebody presses go on a restored
-- database; the first fold is a decision, taken by running
--
--   node scripts/compact-events.mjs --dry     -- see what it would do
--   node scripts/compact-events.mjs
--
-- after which the daily report keeps it folded from then on.
