-- The squad: a coach's own players, and the kit their shirts are printed in.
--
-- Three unrelated-looking things in one migration because they arrived from one
-- conversation: a coach asked whether the board could show player names and
-- faces, and answering it properly needed somewhere to keep a squad, a picture
-- of the coach themselves, and a kit that looks like their kit.
--
--   1. `avatar_path`  — the coach's face, beside the club crest.
--   2. `kit_pattern` / `kit_alt` — stripes, hoops, halves, a sash.
--   3. `studio_squad` + the `players` bucket — the squad, and it is PRIVATE.
--
-- ── THE ONE THING TO READ BEFORE CHANGING ANYTHING BELOW ─────────────────────
--
-- supabase/012 added a PUBLIC ANON READ POLICY to studio_profiles and said, in
-- as many words: *nothing on that table is private, and if you ever need a
-- private per-user field it does NOT go here.* A squad is names and photographs
-- of players, who are very often children. So it is a new table with own-row RLS
-- and NO anon grant, and the photos are in a bucket that is NOT public.
--
-- That is not caution for its own sake. `crests` is world-readable and its
-- policy has no path predicate, which means anyone may LIST it — correct for
-- club badges, indefensible for a U16 side. `players` is closed, and a photo
-- reaches a browser through a signed URL the owner's own session asked for.
--
-- A published post that shows a player's face is therefore a DELIBERATE act for
-- Phase 2 of docs/SOCIAL.md to design, with its own consent question. It is not
-- something a coach can do by accident by sharing a link, and this migration is
-- what makes that true.
--
-- ── HOW TO APPLY ─────────────────────────────────────────────────────────────
--
--   Dashboard → SQL Editor → paste this file → Run.
--
-- Idempotent throughout, the same way 012 is: `add column if not exists`,
-- constraints dropped before they are added, policies dropped before they are
-- created. Running it twice is safe.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. The coach's own face, and their kit ───────────────────────────────────

alter table public.studio_profiles
  -- "<uuid>/avatar.<ext>" in the `crests` bucket. A SEPARATE FIELD FROM THE
  -- CREST, not a replacement: a badge says which club, a face says which
  -- person, and a profile showing one in place of the other answers the wrong
  -- question. Both optional, neither implying the other.
  --
  -- It shares the `crests` bucket rather than getting its own, because the
  -- bucket's write policy is `foldername[1] = auth.uid()` and "<uuid>/avatar.png"
  -- already satisfies it. A second public bucket would be four more policies
  -- enforcing the identical rule.
  add column if not exists avatar_path text,
  -- 'solid' | 'stripes' | 'hoops' | 'halves' | 'sash'. NULL reads as plain,
  -- which is what every profile written before this migration is.
  add column if not exists kit_pattern text,
  -- The pattern's second colour. Meaningless while the pattern is plain, and
  -- the client simply does not draw one in that case rather than clearing it —
  -- so a coach who switches to plain and back still has their stripe colour.
  add column if not exists kit_alt     text;

alter table public.studio_profiles drop constraint if exists studio_profiles_avatar_path_shape;
alter table public.studio_profiles drop constraint if exists studio_profiles_kit_pattern_known;
alter table public.studio_profiles drop constraint if exists studio_profiles_kit_alt_shape;

alter table public.studio_profiles

  -- Same reasoning as the crest_path CHECK in 012: the client composes a public
  -- URL from this string, so a value with a "../" or a protocol in it is a value
  -- that ends up in an <img src>. Pinning the shape here means the browser never
  -- has to be the thing that checks.
  add constraint studio_profiles_avatar_path_shape check (
    avatar_path is null or
    avatar_path ~ '^[0-9a-f-]{36}/avatar\.(png|jpg|jpeg|webp)$'
  ),

  -- KEEP IN SYNC WITH `KitPattern` in src/studio/schema.ts AND `KIT_PATTERNS`
  -- in src/studio/account/identity.ts. Three places, one list. A value only the
  -- client knows about is a picker that offers a kit this table refuses.
  add constraint studio_profiles_kit_pattern_known check (
    kit_pattern is null or kit_pattern in ('solid','stripes','hoops','halves','sash')
  ),

  -- Hex and nothing else, for the reason 005 gives about team_colour: this value
  -- is written straight into an SVG fill and the board is serialised into
  -- exported files.
  add constraint studio_profiles_kit_alt_shape check (
    kit_alt is null or kit_alt ~ '^#[0-9A-Fa-f]{6}$'
  );

-- ── 2. The squad ─────────────────────────────────────────────────────────────
--
-- A TABLE, NOT A jsonb COLUMN, and this is the one place this project departs
-- from the argument 012 made for `links`. That argument was: a value always read
-- and written whole with its parent belongs in the parent. It holds for five
-- links. It fails here for a reason that has nothing to do with cardinality —
-- the parent is world-readable. There is no shape of jsonb that makes a child's
-- name private on a table with an anon SELECT policy.

create table if not exists public.studio_squad (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users (id) on delete cascade,
  -- The player's name, as it is printed above the counter.
  name       text not null,
  -- What goes ON the counter: a squad number ("6") or a position ("LB"). Text
  -- rather than an integer because "GK" is a perfectly ordinary answer, and
  -- because `Token.label` in the document it is copied into is already text.
  number     text,
  -- "<uuid>/players/<uuid>.<ext>" in the PRIVATE `players` bucket.
  photo_path text,
  -- The coach's own order, so a squad list reads like a team sheet rather than
  -- like whatever order they happened to type it in.
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.studio_squad drop constraint if exists studio_squad_name_len;
alter table public.studio_squad drop constraint if exists studio_squad_number_len;
alter table public.studio_squad drop constraint if exists studio_squad_photo_path_shape;

alter table public.studio_squad
  -- 18, matching the maxLength the editor's Name field already enforces. A name
  -- longer than the counter is wide is a name that collides with the next
  -- player along.
  add constraint studio_squad_name_len check (length(name) between 1 and 18),
  -- 4, matching the counter label. "GK", "10", "LCB" all fit; a sentence does not.
  add constraint studio_squad_number_len check (number is null or length(number) between 1 and 4),
  add constraint studio_squad_photo_path_shape check (
    photo_path is null or
    photo_path ~ '^[0-9a-f-]{36}/players/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'
  );

create index if not exists studio_squad_owner_sort
  on public.studio_squad (owner, sort, created_at);

-- A cap, as a trigger rather than a CHECK, because a CHECK cannot count its own
-- table. Forty is a full senior squad plus an academy intake and then some; it
-- is not a limit anybody will meet by accident, and it is the difference between
-- a mistake costing one row and a script costing a bucket.
create or replace function public.studio_squad_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.studio_squad where owner = new.owner) >= 40 then
    raise exception 'A squad holds at most 40 players.';
  end if;
  return new;
end;
$$;

drop trigger if exists studio_squad_cap_check on public.studio_squad;
create trigger studio_squad_cap_check
  before insert on public.studio_squad
  for each row execute function public.studio_squad_cap();

-- `updated_at`, kept honest by the same function 005 defined for the other two.
drop trigger if exists studio_squad_touch on public.studio_squad;
create trigger studio_squad_touch
  before update on public.studio_squad
  for each row execute function public.studio_touch_updated_at();

-- ── 3. Who may read a squad ──────────────────────────────────────────────────
--
-- The owner. That is the whole list.
--
-- `for all` with the same expression on both sides, matching the own-row policy
-- 005 wrote for studio_systems. NO POLICY FOR anon AND NO GRANT TO anon — and
-- unlike studio_profiles, that is not an omission to be filled in later by a
-- feature that wants a public squad page. If such a feature is ever built it
-- publishes a chosen subset through a new table, with consent asked for by name.

alter table public.studio_squad enable row level security;

drop policy if exists studio_squad_own on public.studio_squad;
create policy studio_squad_own
  on public.studio_squad
  for all
  to authenticated
  using ((select auth.uid()) = owner)
  with check ((select auth.uid()) = owner);

-- TWO LAYERS, BOTH REQUIRED — RLS filters rows only after the role already holds
-- the privilege. `authenticated` only; `anon` is granted nothing here and must
-- not be.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.studio_squad to authenticated;

-- ── 4. The `players` bucket ──────────────────────────────────────────────────
--
-- PRIVATE. `public = false` is the entire security model of this section and
-- every policy below is written on the assumption it stays false. Flipping it
-- would make every photo in every squad readable by URL, and by LISTING, the
-- moment the change was applied — silently, with no error and no migration.
--
-- Reads go through `createSignedUrl`, which still runs the SELECT policy below,
-- so a signed URL can only ever be minted for an object the caller already owns.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'players',
  'players',
  false,
  5242880,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- `storage.foldername(name)` splits the object path; [1] is the first segment,
-- which the photo_path CHECK above already pins to a uuid. Comparing it to the
-- caller's own uuid is what makes each coach's folder theirs alone — here, on
-- reads as well as writes, which is what a public bucket cannot do.

drop policy if exists studio_players_read on storage.objects;
create policy studio_players_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'players'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists studio_players_write on storage.objects;
create policy studio_players_write
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'players'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists studio_players_update on storage.objects;
create policy studio_players_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'players'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'players'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists studio_players_delete on storage.objects;
create policy studio_players_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'players'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
