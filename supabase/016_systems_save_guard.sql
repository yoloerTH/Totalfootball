-- The database becomes the source of truth, and stops accepting stale writes.
--
-- ── THE BUG THIS CLOSES ──────────────────────────────────────────────────────
--
-- `StudioMount` read localStorage FIRST and the account second, and
-- `saveCloudSystem` was a blind upsert with nothing to compare against. So:
--
--   a laptop holds a week-old copy of a system
--   -> the coach edits that system on the desktop, which uploads fine
--   -> the coach opens it on the laptop
--   -> the STALE copy loads, and two seconds later useCloudSync uploads it
--      over the desktop's newer work, silently
--
-- 139 systems across 81 owners were on that path. The client is being changed
-- to read from the account first (src/studio/editor/StudioMount.tsx), which
-- fixes the ordinary case. This file fixes the case that is left: the browser
-- still keeps an offline buffer, so a stale document can still reach this table
-- after a failed fetch, and no amount of client ordering can rule that out.
--
-- ── OPTIMISTIC CONCURRENCY, AND WHY NOT A LOCK ───────────────────────────────
--
-- The client sends the `updated_at` it loaded. If the row has moved on since,
-- the write is REFUSED and the current server document comes back with it. No
-- lock, no session state, nothing to leak if a tab is closed mid-edit — the
-- version token is just a timestamp the client already had.
--
-- `updated_at` is trustworthy for this because 005 maintains it in a trigger
-- rather than taking it from the client, for exactly the reason that matters
-- here: a browser with a wrong clock cannot forge a version.
--
-- ── WHAT A REFUSAL MEANS, AND WHAT IT MUST NOT DO ────────────────────────────
--
-- It must NOT resolve itself by overwriting the editor. A coach is mid-drag;
-- replacing the document under their hands to "fix" a conflict destroys the
-- work in front of them to save the work that is not. So the refusal is
-- reported (`ok: false`), the client stops uploading, and the coach is told the
-- board is open somewhere newer. Merging two divergent boards is not something
-- this function should invent.
--
-- ── HOW TO APPLY ─────────────────────────────────────────────────────────────
--
--   node scripts/apply-migration.mjs supabase/016_systems_save_guard.sql
--
-- Idempotent throughout.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. The guarded save ──────────────────────────────────────────────────────
--
-- SECURITY INVOKER, so the policy in 005 is still the boundary. This function
-- adds a rule about VERSIONS; it does not add a way to reach another owner's
-- row, and `owner = auth.uid()` appears in every statement below so that stays
-- true even if the policy were ever loosened.
create or replace function public.studio_systems_save(
  p_id   text,
  p_doc  jsonb,
  -- NULL means "I did not load a version". For a row that does not exist yet
  -- that is honest and fine. For one that does, it is exactly the stale case,
  -- and it is refused — see below.
  p_base timestamptz default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  uid uuid := (select auth.uid());
  cur timestamptz;
  landed timestamptz;
begin
  if uid is null then
    raise exception 'studio_systems_save requires a signed-in user'
      using errcode = '28000';
  end if;

  select updated_at into cur
  from public.studio_systems
  where owner = uid and id = p_id;

  -- New to this account: nothing to be stale against.
  if cur is null then
    insert into public.studio_systems (owner, id, doc)
    values (uid, p_id, p_doc)
    returning updated_at into landed;
    return jsonb_build_object('ok', true, 'updated_at', landed);
  end if;

  -- The row has moved since this client last saw it — another device, another
  -- tab, or an offline buffer that has just come back. Refuse, and hand back
  -- what is actually there so the client can say something true about it.
  if p_base is null or cur > p_base then
    return jsonb_build_object(
      'ok', false,
      'updated_at', cur,
      'doc', (select doc from public.studio_systems where owner = uid and id = p_id)
    );
  end if;

  update public.studio_systems
  set doc = p_doc
  where owner = uid and id = p_id
  returning updated_at into landed;

  return jsonb_build_object('ok', true, 'updated_at', landed);
end;
$$;

grant execute on function public.studio_systems_save(text, jsonb, timestamptz) to authenticated;
revoke execute on function public.studio_systems_save(text, jsonb, timestamptz) from anon, public;

-- ── 2. "Where the coach left off" moves off the browser ──────────────────────
--
-- `lastOpened()` was a field in localStorage, which made "reopen where you left
-- off" a fact about a MACHINE. It is a fact about a coach: someone who stops on
-- the desktop and picks the laptop up should land on the same board.

alter table public.studio_prefs
  add column if not exists last_system text;

-- ── 3. studio_prefs_merge learns about it ────────────────────────────────────
--
-- DROPPED AND RECREATED, not just replaced. `create or replace` with a new
-- signature makes an OVERLOAD rather than a replacement, and two candidates
-- would leave PostgREST to pick one. The new argument has a default, so a
-- browser still running the previous build — which sends only p_guide and
-- p_view — keeps working through the deploy.
drop function if exists public.studio_prefs_merge(jsonb, jsonb);

create or replace function public.studio_prefs_merge(
  p_guide jsonb default '{}'::jsonb,
  p_view  jsonb default '{}'::jsonb,
  p_last  text  default null
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
  if uid is null then
    raise exception 'studio_prefs_merge requires a signed-in user'
      using errcode = '28000';
  end if;

  insert into public.studio_prefs as p (id, guide, view_prefs, last_system, updated_at)
  values (uid, coalesce(p_guide, '{}'::jsonb), coalesce(p_view, '{}'::jsonb), p_last, now())
  on conflict (id) do update
    set guide       = public.jsonb_merge_deep(p.guide,      coalesce(excluded.guide, '{}'::jsonb)),
        view_prefs  = public.jsonb_merge_deep(p.view_prefs, coalesce(excluded.view_prefs, '{}'::jsonb)),
        -- NULL means "not telling", not "clear it". Hydration sends no last
        -- system and must not wipe the one that is there.
        last_system = coalesce(excluded.last_system, p.last_system),
        updated_at  = now()
  returning * into merged;

  return merged;
end;
$$;

grant execute on function public.studio_prefs_merge(jsonb, jsonb, text) to authenticated;
revoke execute on function public.studio_prefs_merge(jsonb, jsonb, text) from anon, public;
