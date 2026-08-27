-- Preferences: the studio settings that belong to a COACH, not to a browser.
--
-- ── WHY THIS TABLE EXISTS ────────────────────────────────────────────────────
--
-- Every studio preference lived in one browser-global localStorage key. On
-- 2026-08-27 a brand new account signed in on a browser that had already been
-- used and got the previous coach's state: no welcome walkthrough, no what's-new
-- panel, their last board reopened, their name and kit on it. Worse, the claim
-- path read that same global key and copied the previous coach's boards into the
-- new account permanently.
--
-- The leak itself is fixed client-side — every key is now namespaced by user id
-- (src/studio/scope.ts). This table is the second half of the answer: once
-- preferences belong to a person rather than to a machine, they should follow
-- that person to the next machine, and a NEW account should be provably clean
-- because the server holds no row for it.
--
-- ── WHY IT IS NOT COLUMNS ON studio_profiles ─────────────────────────────────
--
-- 012 says it in capitals and it is worth obeying:
--
--   NOTHING ON studio_profiles IS PRIVATE. [...] If you ever need a private
--   per-user field, it does NOT go here; put it on a table with no anon policy.
--
-- Everything below is private. How many times a coach has been nudged about
-- their profile, whether they have finished the walkthrough, when they last
-- ignored the feedback ask — none of that belongs on a table with a public
-- SELECT policy on it. So: a separate table, `authenticated` only, anon revoked.
--
-- ── WHY jsonb AND NOT A COLUMN PER FLAG ──────────────────────────────────────
--
-- GuideState has grown a field roughly every time the studio grew a feature.
-- A column per flag means a migration per feature, and a client that must ship
-- in lockstep with it. The shape is owned by src/studio/storage.ts, every field
-- is optional on read, and an unknown key from a future build survives a merge
-- rather than being dropped by an older one.
--
-- ── HOW TO APPLY ─────────────────────────────────────────────────────────────
--
--   Dashboard -> SQL Editor -> paste this file -> Run.
--
-- Idempotent throughout, so running it twice is safe.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. The table ─────────────────────────────────────────────────────────────

create table if not exists public.studio_prefs (
  -- One row per coach, keyed BY the auth user rather than merely referencing it.
  -- The cascade means deleting an account takes its preferences with it without
  -- anybody having to remember to.
  id uuid primary key references auth.users(id) on delete cascade,

  -- GuideState. What this coach has been taught, what they have been shown, and
  -- the counters that time the two things we ever ask them.
  guide jsonb not null default '{}'::jsonb,

  -- Furniture: phase strip size, which rail drawers are open. Named
  -- `view_prefs` and not `view` because VIEW is a keyword and a column called
  -- `view` is a quoting bug waiting for the one query that forgets.
  view_prefs jsonb not null default '{}'::jsonb,

  updated_at timestamptz not null default now(),

  -- Objects, not arrays or scalars. The merge below assumes it can `||` these,
  -- and a row hand-edited to a scalar would make every future merge a silent
  -- overwrite of the whole document.
  constraint studio_prefs_guide_object check (jsonb_typeof(guide) = 'object'),
  constraint studio_prefs_view_object  check (jsonb_typeof(view_prefs) = 'object')
);

-- ── 2. Deep merge ────────────────────────────────────────────────────────────
--
-- `||` on jsonb is SHALLOW. That is right for `guide`, which is flat, and wrong
-- for `view_prefs`, whose `sections` map is nested one level down: a coach who
-- opens the Camera drawer on their laptop would have the whole map replaced,
-- taking the Equipment drawer they opened on the desktop with it.
--
-- plpgsql rather than sql because this calls itself, and a `create function`
-- with a sql body resolves its own name at creation time and cannot find it.
create or replace function public.jsonb_merge_deep(a jsonb, b jsonb)
returns jsonb
language plpgsql
immutable
parallel safe
set search_path = public, pg_temp
as $$
begin
  if a is null then return b; end if;
  if b is null then return a; end if;
  -- Two objects merge. Anything else, the incoming value simply wins: there is
  -- no sensible merge of a number with a number, and picking one is the caller's
  -- job (see `latch` in src/studio/account/prefs.ts, which does exactly that
  -- before it sends).
  if jsonb_typeof(a) <> 'object' or jsonb_typeof(b) <> 'object' then
    return b;
  end if;
  return (
    select coalesce(
      jsonb_object_agg(
        k,
        case
          when a ? k and b ? k then public.jsonb_merge_deep(a -> k, b -> k)
          when b ? k           then b -> k
          else                      a -> k
        end
      ),
      '{}'::jsonb
    )
    from (
      select jsonb_object_keys(a) as k
      union
      select jsonb_object_keys(b)
    ) keys
  );
end;
$$;

-- ── 3. The RPC ───────────────────────────────────────────────────────────────
--
-- ONE ROUND TRIP, AND NO LOST UPDATE. The obvious client would SELECT the row,
-- merge in memory and UPSERT it back, which is a read-modify-write across the
-- network: two studio tabs open on the same account, and the slower one's write
-- erases whatever the faster one had just learned. Doing the merge inside the
-- statement means the database serialises it and no tab can clobber another.
--
-- It is also the only write path. A client PATCHing `guide` wholesale would
-- delete every key a NEWER build had written, which is how a coach on two
-- devices during a deploy loses a latch they earned.
--
-- SECURITY INVOKER on purpose: the policy below is the boundary, exactly as in
-- 005. A definer function here would be a way to write somebody else's row.
create or replace function public.studio_prefs_merge(
  p_guide jsonb default '{}'::jsonb,
  p_view  jsonb default '{}'::jsonb
)
returns public.studio_prefs
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  uid uuid := (select auth.uid());
  merged public.studio_prefs;
begin
  -- Anon has no row to merge into and no business making one. RLS would refuse
  -- this anyway; failing here says why, in a message a developer can read.
  if uid is null then
    raise exception 'studio_prefs_merge requires a signed-in user'
      using errcode = '28000';
  end if;

  -- A patch of `{}` is the READ path: merging nothing returns the row as it
  -- stands, and creates an empty one for an account that has never written. One
  -- function instead of two, and hydration cannot race a first write.
  insert into public.studio_prefs as p (id, guide, view_prefs, updated_at)
  values (uid, coalesce(p_guide, '{}'::jsonb), coalesce(p_view, '{}'::jsonb), now())
  on conflict (id) do update
    set guide      = public.jsonb_merge_deep(p.guide,      coalesce(excluded.guide, '{}'::jsonb)),
        view_prefs = public.jsonb_merge_deep(p.view_prefs, coalesce(excluded.view_prefs, '{}'::jsonb)),
        updated_at = now()
  returning * into merged;

  return merged;
end;
$$;

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
--
-- `(select auth.uid())` rather than a bare call, for the reason 005 spells out:
-- the bare one is re-evaluated per row, the wrapped one once.

alter table public.studio_prefs enable row level security;

drop policy if exists studio_prefs_own on public.studio_prefs;
create policy studio_prefs_own
  on public.studio_prefs
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- TWO LAYERS, BOTH REQUIRED — see the same note in 005. RLS filters rows only
-- after the role already holds the privilege.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.studio_prefs to authenticated;
grant execute on function public.studio_prefs_merge(jsonb, jsonb) to authenticated;
grant execute on function public.jsonb_merge_deep(jsonb, jsonb) to authenticated;

-- Anon gets nothing, and this table is the reason the rule matters: a signed-out
-- visitor's preferences live in their own browser and never come here.
revoke all on public.studio_prefs from anon;
revoke all on public.studio_prefs from public;
revoke execute on function public.studio_prefs_merge(jsonb, jsonb) from anon, public;
revoke execute on function public.jsonb_merge_deep(jsonb, jsonb) from anon, public;
