-- The database becomes the only place studio work lives.
--
-- ── WHAT CHANGED, AND WHY THIS FILE EXISTS ───────────────────────────────────
--
-- Until now the studio was localStorage-first: every system, every sequence and
-- every preference was written to the browser synchronously and pushed to
-- Supabase behind it, with the browser copy authoritative on a bad connection.
-- ../src/studio/storage.ts still carries three paragraphs arguing for that.
--
-- The call has been reversed (user, 2026-09-06): NOTHING is saved to local
-- storage. The account is the only store. That makes two things the client
-- could previously fudge into hard requirements on this side:
--
--  1. A LIST MUST BE CHEAP. The old panel could read the whole library out of
--     one localStorage blob for free, so `select id, doc` over every row was
--     never felt. It is felt now — a coach with forty sequences was pulling
--     forty full documents to draw forty cards. Hence the generated columns
--     below: a library listing reads `name`, `phases`, `players` and
--     `source_pitch` off the row and never touches `doc` until a sequence is
--     actually opened or previewed.
--
--  2. A WRITE MUST BE ONE ROUND TRIP AND MUST NOT NEED THE WHOLE DOCUMENT.
--     Renaming a sequence used to be a local mutation. Doing it as a read of
--     the doc, a client-side edit and an upsert of the whole thing back is
--     three times the bytes and a lost-update race between two tabs. Hence
--     `studio_sequences_rename`, which edits the one key in place.
--
-- ── THE GENERATED COLUMNS ARE GENERATED, NOT DUPLICATED ──────────────────────
--
-- `doc` stays the canonical document, exactly as it is for `studio_systems`.
-- Every column added here is `generated always as ... stored`, so there is no
-- dual write, nothing for a client to forget to update, and no way for the
-- column and the document to disagree. `studio_systems.title` has worked this
-- way since it was added; this is the same trick applied properly.
--
-- Each expression is guarded on `jsonb_typeof` rather than casting hopefully.
-- A generated column is evaluated on every insert, so an expression that can
-- raise is an expression that can make a row unsaveable — a sequence written by
-- an older build with no `acts` array must degrade to zero phases, not to a
-- coach who cannot save.
--
-- ── HOW TO APPLY ─────────────────────────────────────────────────────────────
--
--   node scripts/apply-migration.mjs supabase/027_sequences_shape_and_rpcs.sql
--
-- Idempotent throughout. Safe to re-run.

-- ── 1. Columns worth querying, lifted out of the blob ────────────────────────

alter table public.studio_sequences
  add column if not exists created_at timestamptz not null default now();

alter table public.studio_sequences
  add column if not exists name text
  generated always as (nullif(btrim(doc ->> 'name'), '')) stored;

alter table public.studio_sequences
  add column if not exists source_pitch text
  generated always as (doc ->> 'sourcePitch') stored;

-- Phases in the sequence. `jsonb_array_length` raises on a non-array, and a
-- generated column that raises is a row that cannot be written at all, so the
-- type is checked first and anything else reads as zero.
alter table public.studio_sequences
  add column if not exists phases int
  generated always as (
    case when jsonb_typeof(doc -> 'acts') = 'array'
      then jsonb_array_length(doc -> 'acts')
      else 0
    end
  ) stored;

-- Same guard, same reason: `(doc ->> 'playerCount')::int` raises on 'abc'.
alter table public.studio_sequences
  add column if not exists players int
  generated always as (
    case when jsonb_typeof(doc -> 'playerCount') = 'number'
      then (doc ->> 'playerCount')::int
      else 0
    end
  ) stored;

-- The listing's only ordering, and now its only index. Mirrors
-- `studio_systems_owner_updated_idx` from the same shelf on the portal.
create index if not exists studio_sequences_owner_updated_idx
  on public.studio_sequences (owner, updated_at desc);

comment on table public.studio_sequences is
  'A coach''s library of reusable movement patterns. `doc` is the canonical '
  'document; every other column is generated from it and exists so a library '
  'listing never has to fetch the documents. Shared with accepted team members '
  'per studio_team_members.can_view_sequences (supabase/020).';

-- ── 2. Saving one ────────────────────────────────────────────────────────────
--
-- SECURITY INVOKER, so `studio_sequences_all_access` (020) is still the whole
-- boundary — this adds no reach, it removes a round trip and settles two facts
-- the client should not be deciding on its own:
--
--   · WHOSE ROW. A sequence a coach can see may belong to the team owner rather
--     than to them. The owner is resolved from what RLS lets this session read,
--     preferring their own row when an id somehow exists under both — the same
--     resolution `studio_systems_save` does in supabase/022, and for the same
--     reason: a client that assumes it owns everything writes a second copy.
--
--   · WHEN. `doc.updated` is stamped from the database clock rather than from
--     whatever the browser thinks the time is, so the field inside the document
--     and the `updated_at` column can never disagree and a phone with a wrong
--     clock cannot sort itself to the top of somebody's library forever.
--
-- Last write wins, deliberately, and unlike `studio_systems_save` there is no
-- version guard. A sequence is written whole at the moment it is captured and
-- is not held open in two tabs the way a board is, so a guard would buy nothing
-- and would cost a conflict state the library has no way to resolve.
create or replace function public.studio_sequences_save(
  p_id  text,
  p_doc jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  uid          uuid := (select auth.uid());
  target_owner uuid;
  landed       timestamptz;
  v_doc        jsonb;
begin
  if uid is null then
    raise exception 'studio_sequences_save requires a signed-in user'
      using errcode = '28000';
  end if;
  if p_id is null or btrim(p_id) = '' then
    raise exception 'studio_sequences_save requires an id' using errcode = '22023';
  end if;
  if p_doc is null or jsonb_typeof(p_doc) <> 'object' then
    raise exception 'studio_sequences_save requires a document' using errcode = '22023';
  end if;

  select owner into target_owner
  from public.studio_sequences
  where id = p_id
  order by (owner = uid) desc
  limit 1;

  -- The document carries its own id and timestamp so a row read back is a
  -- complete sequence on its own, with no reassembly on the client.
  v_doc := p_doc
    || jsonb_build_object('id', p_id, 'updated', to_char(now() at time zone 'utc',
                                                         'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));

  if target_owner is null then
    insert into public.studio_sequences (id, owner, doc)
    values (p_id, uid, v_doc)
    returning updated_at into landed;
  else
    update public.studio_sequences
    set doc = v_doc, updated_at = now()
    where owner = target_owner and id = p_id
    returning updated_at into landed;
  end if;

  return jsonb_build_object('ok', true, 'id', p_id, 'updated_at', landed, 'doc', v_doc);
end;
$$;

-- ── 3. Renaming one ──────────────────────────────────────────────────────────
--
-- One key, in place. The alternative the client used to do — fetch the
-- document, edit it, send it all back — is three times the bytes and loses the
-- edit if the sequence was re-captured in another tab in between.
create or replace function public.studio_sequences_rename(
  p_id   text,
  p_name text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  uid    uuid := (select auth.uid());
  landed timestamptz;
begin
  if uid is null then
    raise exception 'studio_sequences_rename requires a signed-in user'
      using errcode = '28000';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'a sequence needs a name' using errcode = '22023';
  end if;

  update public.studio_sequences
  set doc = doc || jsonb_build_object(
        'name', btrim(p_name),
        'updated', to_char(now() at time zone 'utc',
                           'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at = now()
  where id = p_id
  returning updated_at into landed;

  -- Nothing updated means RLS did not hand us the row: it is somebody else's,
  -- or it is gone. Both are "no" and neither is an error worth raising.
  return jsonb_build_object('ok', landed is not null, 'updated_at', landed);
end;
$$;

-- ── 4. Deleting one ──────────────────────────────────────────────────────────
--
-- A plain DELETE under RLS would do, and this exists only so the client has one
-- shape for all three writes and one place where "did it actually go" is
-- answered honestly rather than inferred from the absence of an error.
create or replace function public.studio_sequences_delete(p_id text)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  uid  uuid := (select auth.uid());
  gone int;
begin
  if uid is null then
    raise exception 'studio_sequences_delete requires a signed-in user'
      using errcode = '28000';
  end if;

  delete from public.studio_sequences where id = p_id;
  get diagnostics gone = row_count;
  return jsonb_build_object('ok', gone > 0);
end;
$$;

-- ── 5. Grants ────────────────────────────────────────────────────────────────
--
-- Explicit on both sides, because supabase/026 is the story of what a missing
-- grant costs: 019 wrote a perfect policy on a table `authenticated` was never
-- allowed to open, and every sequence any coach ever saved went nowhere for
-- three weeks without one error message that said so.

grant execute on function public.studio_sequences_save(text, jsonb)   to authenticated;
grant execute on function public.studio_sequences_rename(text, text)  to authenticated;
grant execute on function public.studio_sequences_delete(text)        to authenticated;

revoke execute on function public.studio_sequences_save(text, jsonb)  from anon, public;
revoke execute on function public.studio_sequences_rename(text, text) from anon, public;
revoke execute on function public.studio_sequences_delete(text)       from anon, public;

-- ── THE CHECK ────────────────────────────────────────────────────────────────
--
--   select column_name, is_generated, generation_expression
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'studio_sequences'
--    order by ordinal_position;
--
--   select p.proname, pg_get_function_identity_arguments(p.oid) as args
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname like 'studio_sequences_%'
--    order by 1;
