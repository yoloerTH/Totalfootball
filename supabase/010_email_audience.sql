-- The email audience, and the one place an opt-out is recorded.
--
-- ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
--
-- Until now "who do we mail" was a query written out longhand inside
-- scripts/send-welcome-all.mjs, and "who has opted out" was a single column on
-- `subscribers`. Both of those broke the moment Studio accounts became part of
-- the audience:
--
--  1. A Studio account holder has no row in `subscribers`. So when they clicked
--     unsubscribe, netlify/functions/unsubscribe.mts ran
--     `PATCH /subscribers?email=eq.…`, matched ZERO rows, and PostgREST
--     answered 204. The endpoint said "you are unsubscribed", the person
--     believed it, and the next send mailed them again. That is the single
--     worst bug an email system can have and it was live.
--
--  2. Two senders now exist — ZeptoMail for product mail, Zoho Campaigns for
--     newsletters — and Campaigns keeps its own opt-out state. Without a
--     suppression table of our own there is nowhere to write a Campaigns
--     unsubscribe back to, so an opt-out made in one system would not be
--     honoured by the other.
--
-- `email_suppressions` fixes both: it is keyed by ADDRESS, not by membership of
-- any list, so it can suppress somebody we have no subscriber row for and it
-- outlives whichever table they came from.
--
-- ── THE RULE ────────────────────────────────────────────────────────────────
--
-- Every sender, without exception, reads `email_audience` and skips rows where
-- `suppressed` is true. Nothing sends off a hand-written union ever again.

-- ── suppressions ────────────────────────────────────────────────────────────
--
-- One row per opted-out address. Deliberately NOT a foreign key to anything:
-- the whole point is that it works for an address that exists in `auth.users`
-- only, in `subscribers` only, in both, or in neither (a hard bounce reported
-- by Campaigns for an address we have since deleted still has to stay dead).
--
-- `reason` is a check-constrained vocabulary rather than free text because it
-- is read by code: a `bounce` may be retried after a domain is fixed, a
-- `unsubscribe` never may. Getting those two confused re-mails somebody who
-- asked you not to.
create table if not exists public.email_suppressions (
  email      text        primary key,
  reason     text        not null default 'unsubscribe',
  -- Where the opt-out came from: 'site' (our /api/unsubscribe endpoint),
  -- 'campaigns' (pulled back from Zoho Campaigns), 'zeptomail' (bounce or
  -- complaint webhook), 'manual' (somebody emailed and asked).
  source     text        not null default 'site',
  created_at timestamptz not null default now(),
  constraint email_suppressions_reason_check
    check (reason in ('unsubscribe', 'bounce', 'complaint', 'manual')),
  constraint email_suppressions_email_shape
    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$'),
  -- Lower-cased on the way in, always. `A@b.com` and `a@b.com` are the same
  -- inbox, and a suppression that only matches one casing does not suppress.
  constraint email_suppressions_email_lower check (email = lower(email))
);

comment on table public.email_suppressions is
  'Addresses that must never receive bulk mail, keyed by address rather than by list membership. Written by /api/unsubscribe and by scripts/sync-campaigns.mjs; read by every sender via email_audience.';

-- ── the audience ────────────────────────────────────────────────────────────
--
-- Both origins of an address, folded to one row per inbox.
--
--  · `subscribers` — anybody who used a form on the site. Carries `source`,
--    which is the provenance trail: if Zoho Campaigns ever audits the list
--    (they do audit imports), this column is the answer to "where did this
--    address come from and when".
--  · `auth.users`  — Studio account holders. Confirmed addresses only; an
--    unconfirmed signup has not proven it owns the inbox, and mailing it is
--    how you end up in a spam trap.
--
-- A SECURITY DEFINER view, because `auth.users` is not readable by the
-- `authenticated` or `anon` roles and must never become so. Only service_role
-- is granted select below, so the definer rights are not a hole — they are
-- what lets one view span the two schemas at all.
create or replace view public.email_audience
with (security_invoker = false) as
with candidate as (
  select
    lower(btrim(s.email))                     as email,
    max(s.name)                               as name,
    min(s.created_at)                         as joined_at,
    -- Every source this address arrived through, so provenance survives the
    -- dedupe. An address that came in via the footer AND the course form
    -- reads 'course-early-access,footer' rather than arbitrarily one of them.
    string_agg(distinct s.source, ',' order by s.source) as sources,
    true                                      as is_subscriber,
    false                                     as is_studio,
    bool_or(s.source in ('course-early-access', 'course-waitlist')) as is_course,
    -- The legacy per-row opt-out. Still honoured, and still written by
    -- /api/unsubscribe, so links in already-delivered mail keep working.
    bool_or(s.unsubscribed_at is not null)    as legacy_unsubscribed
  from public.subscribers s
  where s.email is not null
  group by lower(btrim(s.email))

  union all

  select
    lower(btrim(u.email))                     as email,
    nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name',
                          u.raw_user_meta_data ->> 'name', '')), '') as name,
    u.created_at                              as joined_at,
    'studio-account'                          as sources,
    false                                     as is_subscriber,
    true                                      as is_studio,
    false                                     as is_course,
    false                                     as legacy_unsubscribed
  from auth.users u
  where u.email is not null
    and u.email_confirmed_at is not null
    and u.deleted_at is null
)
select
  c.email,
  max(c.name)                                          as name,
  min(c.joined_at)                                     as joined_at,
  string_agg(distinct c.sources, ',' order by c.sources) as sources,
  bool_or(c.is_subscriber)                             as is_subscriber,
  bool_or(c.is_studio)                                 as is_studio,
  bool_or(c.is_course)                                 as is_course,
  -- THE FIELD EVERY SENDER CHECKS. True if the address opted out through
  -- either mechanism — the legacy column or the suppression table.
  (bool_or(c.legacy_unsubscribed) or sup.email is not null) as suppressed,
  sup.reason                                           as suppressed_reason,
  sup.created_at                                       as suppressed_at
from candidate c
left join public.email_suppressions sup on sup.email = c.email
group by c.email, sup.email, sup.reason, sup.created_at;

comment on view public.email_audience is
  'One row per inbox across subscribers and confirmed Studio accounts. `suppressed` is the only opt-out check any sender needs; never mail a row where it is true.';

-- ── privileges ──────────────────────────────────────────────────────────────
--
-- Same posture as 001: anon and authenticated get NOTHING. This view joins
-- auth.users to a subscriber list — it is the most sensitive read in the
-- project and its only legitimate callers are local scripts and the Netlify
-- functions, both of which hold the service-role key.
revoke all on public.email_suppressions from anon, authenticated;
revoke all on public.email_audience    from anon, authenticated;

grant select, insert, update, delete on public.email_suppressions to service_role;
grant select on public.email_audience to service_role;

-- RLS on the table as a backstop. service_role bypasses it; the point is that
-- if a future migration ever grants anon something by accident, it still reads
-- nothing, exactly as `subscribers` behaves today.
alter table public.email_suppressions enable row level security;

-- ── backfill ────────────────────────────────────────────────────────────────
--
-- Carry every existing opt-out on `subscribers` into the new table, so the
-- suppression list is complete from the moment it exists rather than from the
-- next unsubscribe. Idempotent: re-running this migration changes nothing.
insert into public.email_suppressions (email, reason, source, created_at)
select lower(btrim(email)), 'unsubscribe', 'site', unsubscribed_at
from public.subscribers
where unsubscribed_at is not null
  and email is not null
on conflict (email) do nothing;
