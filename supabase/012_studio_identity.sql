-- Identity: the profile a coach may choose to show, and the kit they work in.
--
-- Phase 1 of docs/SOCIAL.md. This migration adds columns to studio_profiles and
-- one storage bucket. It adds NO new tables, and it changes nothing about how
-- the studio behaves for a coach who never opens the new settings sections.
--
-- ── THE PROMISE THIS FILE HAS TO KEEP ────────────────────────────────────────
--
-- `visibility` DEFAULTS TO 'private' AND EVERY EXISTING ROW IS BACKFILLED
-- PRIVATE. Publishing is opt-in, one deliberate act, and reversible. If a future
-- migration ever flips a default here, it has broken the only promise the
-- feature was sold on. The public policy at the foot of this file is written to
-- fail closed: it needs `visibility = 'public'` AND a handle, so a half-filled
-- profile is invisible rather than partly visible.
--
-- ── WHY THESE COLUMNS AND NOT A NEW TABLE ────────────────────────────────────
--
-- A profile is one row per user and studio_profiles is already one row per user.
-- A second table would be a join with no second cardinality behind it. The one
-- real objection — that a public SELECT policy exposes every column, including
-- ones added later without thinking — is answered by keeping this table free of
-- secrets and saying so loudly:
--
--   NOTHING ON studio_profiles IS PRIVATE. Email lives in auth.users. If you
--   ever need a private per-user field, it does NOT go here; put it on a table
--   with no anon policy. Re-read the policy at the foot of this file first.
--
-- ── HOW TO APPLY ─────────────────────────────────────────────────────────────
--
--   Dashboard → SQL Editor → paste this file → Run.
--
-- Idempotent throughout (`add column if not exists`, constraints dropped before
-- they are added, policies dropped before they are created), so running it
-- twice is safe. See supabase/011 for the CLI and Management API alternatives.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. The columns ───────────────────────────────────────────────────────────

alter table public.studio_profiles
  -- The public URL: /c/<handle>. NULL until claimed, and claiming is optional —
  -- a coach who only ever wanted their name on a credit bar never needs one.
  add column if not exists handle          text,
  -- 280 characters, the same budget a post gets, for the same reason: it is read
  -- in a glance next to somebody's work, not instead of it.
  add column if not exists bio             text,
  -- What they do. Constrained rather than free text because it is a FILTER on
  -- the feed later, and a free-text job title is not one.
  add column if not exists role            text,
  -- The object path inside the `crests` bucket, e.g. "<uuid>/crest.png".
  --
  -- A PATH, NOT A URL, and this matters. A stored URL bakes in the project ref
  -- and the /storage/v1/object/public/ prefix, both of which change if the
  -- project is ever migrated or the bucket is put behind a CDN. The path is the
  -- only durable half of that string; the client composes the rest.
  add column if not exists crest_path      text,
  -- The kit's trim ring, for the kits that need a second colour to read —
  -- stripes, hoops, a dark shirt on a dark board. Optional, and the board
  -- already knows what to do with it: Token.tsx draws `style.ring` if it is set
  -- and nothing at all if it is not.
  add column if not exists kit_ring        text,
  -- The counter fill for the opposition, so a coach's boards look like THEIR
  -- boards rather than green-versus-whatever-the-default-was.
  add column if not exists opponent_colour text,
  -- 'private' | 'public'. See the promise above.
  add column if not exists visibility      text not null default 'private',
  -- [{label, url}], up to five. jsonb rather than a child table because it is
  -- always read and written whole with the profile, which is the same argument
  -- 004 and 005 made for storing the System document in one column.
  add column if not exists links           jsonb not null default '[]'::jsonb;

-- Existing rows predate the column and got the default, which is already
-- 'private'. This is belt and braces against a row that somehow carries NULL,
-- and it is the statement of intent: nobody is opted in by a migration.
update public.studio_profiles set visibility = 'private' where visibility is null;

-- ── 2. What a valid identity looks like ──────────────────────────────────────
--
-- Constraints are dropped before they are added so this file can be re-run, the
-- same pattern 005 uses for its policies.

alter table public.studio_profiles drop constraint if exists studio_profiles_handle_shape;
alter table public.studio_profiles drop constraint if exists studio_profiles_handle_reserved;
alter table public.studio_profiles drop constraint if exists studio_profiles_bio_len;
alter table public.studio_profiles drop constraint if exists studio_profiles_role_known;
alter table public.studio_profiles drop constraint if exists studio_profiles_visibility_known;
alter table public.studio_profiles drop constraint if exists studio_profiles_ring_shape;
alter table public.studio_profiles drop constraint if exists studio_profiles_opponent_shape;
alter table public.studio_profiles drop constraint if exists studio_profiles_crest_path_shape;
alter table public.studio_profiles drop constraint if exists studio_profiles_links_shape;

alter table public.studio_profiles

  -- LOWERCASE IS ENFORCED, NOT NORMALISED ON READ. Two handles that differ only
  -- in case are the same handle to every human being who will ever type one, so
  -- storing them as distinct rows is an impersonation vector. Pinning the column
  -- to lowercase means the plain UNIQUE index below is a case-insensitive one,
  -- with no citext extension and no functional index to remember.
  --
  -- No leading, trailing or doubled separators: "a__b" and "a_b" reading as two
  -- different coaches is the same problem in a different coat.
  add constraint studio_profiles_handle_shape check (
    handle is null or (
      handle = lower(handle)
      and handle ~ '^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$'
      and handle !~ '__'
    )
  ),

  -- The routes this site already owns, plus the ones it is about to. A coach
  -- called "settings" would shadow a page the moment /c/ has a sibling, and
  -- "admin" or "support" is somebody preparing to be mistaken for us.
  add constraint studio_profiles_handle_reserved check (
    handle is null or handle not in (
      'about','account','admin','api','auth','blog','c','course','dashboard',
      'faq','feed','help','home','intelligence','library','login','logout',
      'me','new','news','newsletter','o','portal','post','preview','privacy',
      'profile','register','render','root','rss','s','search','settings',
      'shoot','signin','signup','sitemap','staff','studio','support','system',
      'systems','team','terms','totalfootball','user','users','watch','www'
    )
  ),

  add constraint studio_profiles_bio_len check (bio is null or length(bio) <= 280),

  add constraint studio_profiles_role_known check (
    role is null or role in ('coach','analyst','player','scout','educator','other')
  ),

  add constraint studio_profiles_visibility_known check (visibility in ('private','public')),

  -- Hex and nothing else, for the reason 005 gives about team_colour: these
  -- values are written straight into an SVG fill and the board is serialised
  -- into exported files.
  add constraint studio_profiles_ring_shape check (
    kit_ring is null or kit_ring ~ '^#[0-9A-Fa-f]{6}$'
  ),
  add constraint studio_profiles_opponent_shape check (
    opponent_colour is null or opponent_colour ~ '^#[0-9A-Fa-f]{6}$'
  ),

  -- "<uuid>/crest.<ext>" and nothing else. The client composes a public URL from
  -- this string, so a value with a "../" or a protocol in it is a value that
  -- ends up in an <img src>. Pinning the shape here means the browser never has
  -- to be the thing that checks.
  add constraint studio_profiles_crest_path_shape check (
    crest_path is null or
    crest_path ~ '^[0-9a-f-]{36}/crest\.(png|jpg|jpeg|webp)$'
  ),

  -- An array, at most five, each entry an object. The label and URL themselves
  -- are validated client-side and re-checked when the public page is built;
  -- what this stops is the shape being something the reader has to defend
  -- against, e.g. a string where an array was expected.
  add constraint studio_profiles_links_shape check (
    jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 5
  );

-- One handle, one coach. Partial, because NULL is the ordinary state here and
-- a plain unique index would be fine but this states the intent: unclaimed
-- handles are not in the index at all.
create unique index if not exists studio_profiles_handle_key
  on public.studio_profiles (handle)
  where handle is not null;

-- ── 3. Reading somebody else's profile ───────────────────────────────────────
--
-- The first row in this project any signed-out visitor may read. It is
-- deliberately the narrowest policy that could work.
--
--  · `for select` only. anon may read; it may never write anything, anywhere.
--  · BOTH conditions are required. 'public' with no handle is a profile with no
--    address, so there is nothing to serve and nothing is served.
--  · `to anon, authenticated` — a signed-in coach reads OTHER people's profiles
--    through this same policy. The own-row policy from 005 is `for all` and
--    still covers everything they do to their own row; policies are OR'd, so
--    this adds public reads without widening what anyone can write.

drop policy if exists studio_profiles_public_read on public.studio_profiles;
create policy studio_profiles_public_read
  on public.studio_profiles
  for select
  to anon, authenticated
  using (visibility = 'public' and handle is not null);

-- TWO LAYERS, BOTH REQUIRED — 001, 002 and 005 all say this and it is the single
-- easiest thing to forget. RLS filters rows only after the role already holds
-- the privilege, and this project does not hand out Supabase's default
-- privileges on public, so without this GRANT PostgREST answers 42501 with a
-- perfectly good policy sitting right there.
--
-- SELECT ONLY for anon, and never more than that on this table.
grant usage on schema public to anon;
grant select on public.studio_profiles to anon;

-- ── 4. The crests bucket ─────────────────────────────────────────────────────
--
-- The first storage bucket in the project. It closes the open item in
-- docs/STUDIO.md §4.1, and `balls.ts` §4.4 is the next tenant.
--
-- PUBLIC READ, because a crest is drawn on a board that is exported to a file
-- and printed. A signed URL would expire inside a PDF a coach keeps, which is
-- exactly the kind of quiet breakage this codebase is written to avoid.
--
-- The write side is where the security is: 5 MB, three image types, and a path
-- that must start with the caller's own uuid.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crests',
  'crests',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- `storage.foldername(name)` splits the object path; [1] is the first segment,
-- which the crest_path CHECK above already pins to a uuid. Comparing it to the
-- caller's own uuid is what stops one coach writing into another's folder — the
-- bucket being public means anyone can READ any crest, which is intended, and
-- says nothing about who may put one there.

drop policy if exists studio_crests_read on storage.objects;
create policy studio_crests_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'crests');

drop policy if exists studio_crests_write on storage.objects;
create policy studio_crests_write
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'crests'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists studio_crests_update on storage.objects;
create policy studio_crests_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'crests'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'crests'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists studio_crests_delete on storage.objects;
create policy studio_crests_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'crests'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
