-- Phase 2 of docs/SOCIAL.md: a system a coach chooses to publish.
--
-- Three things land here, and one of them changes the meaning of a word that
-- already shipped, so read section 1 before anything else.
--
--   1. `visibility` gains a THIRD state, 'unlisted'. Plus `licence`, the UEFA
--      diploma a coach may choose to show.
--   2. `studio_posts` — the published document, snapshotted, addressed by a
--      random short id at /p/<id>.
--   3. The `published` bucket, which is the only place in this project where a
--      player's photograph may ever be world-readable, and only by an explicit
--      per-post act of the coach.
--
-- ── THE PROMISE 012 MADE IS NOT WEAKENED HERE ────────────────────────────────
--
-- 012 says: `visibility` defaults to 'private' and publishing is opt-in. That
-- still holds. 'private' STILL MEANS NOBODY, the default is untouched, and no
-- existing row changes state — the 10 private profiles on the database when
-- this was written stay exactly as private as they were. What is added is a
-- state BETWEEN private and public, for a coach who wants to send their profile
-- to somebody without standing in the feed.
--
-- ── AND WHY 'unlisted' IS SERVED BY A FUNCTION, NOT BY A POLICY ──────────────
--
-- The obvious implementation is to widen the anon policy to
-- `visibility in ('unlisted','public')` and to filter the feed query on
-- 'public'. That is exactly the shape of the bug 017 exists to record: policies
-- are OR'd, a query that leans on RLS to mean something narrower than it says
-- silently changes meaning the day a policy lands beside it, and the cost was a
-- day of a working product plus one coach's row written under another's id.
--
-- So the TABLE POLICY STAYS AT 'public' ONLY, for profiles and for posts alike,
-- and an unlisted row is reachable through one security-definer function that
-- takes the exact address — a handle, or a post id — and hands back at most one
-- row. A listing cannot call it with no argument, and there is no argument that
-- means "all". The feed is therefore structurally incapable of showing an
-- unlisted profile or an unlisted post, rather than merely written not to.
--
-- ── HOW TO APPLY ─────────────────────────────────────────────────────────────
--
--   npm run db:apply supabase/024_social_posts.sql --dry    # split only
--   npm run db:apply supabase/024_social_posts.sql
--
-- Idempotent throughout: `add column if not exists`, constraints dropped before
-- they are added, policies dropped before they are created, `create or replace`
-- for both functions.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. A third visibility, and a coaching licence ────────────────────────────

alter table public.studio_profiles
  -- The UEFA diploma, or null. The nine values are the ones UEFA itself sets
  -- minimum criteria for (uefa.com/development/coaches/uefa-coaching-licences,
  -- read 2026-09-04): C, B, A and Pro, plus the specialist Youth B, Elite Youth
  -- A, Goalkeeper B, Goalkeeper A and Futsal B.
  --
  -- 'other' IS PART OF THE LIST AND IS NOT A HEDGE. A licence is issued by a
  -- member association, and plenty of good coaches hold an FA Level 1, a
  -- national badge outside UEFA, or nothing at all. A field whose only options
  -- are UEFA badges tells someone with a national one to overclaim or stay
  -- silent, and this product cannot afford either — see the verification rule
  -- in docs/SOCIAL.md §5c, which is the same argument about credibility.
  --
  -- NOT VERIFIED, AND THE UI MUST NEVER IMPLY IT IS. This is a coach saying
  -- what they hold. Verification, when it lands, is a separate column with a
  -- separate story (§5c) and it is about identity, never about a badge a text
  -- field claims.
  add column if not exists licence text;

alter table public.studio_profiles drop constraint if exists studio_profiles_visibility_known;
alter table public.studio_profiles drop constraint if exists studio_profiles_licence_known;

alter table public.studio_profiles
  -- 'private'  — nobody. The default, and what every existing row holds.
  -- 'unlisted' — anyone holding the /c/<handle> link. Never in the feed.
  -- 'public'   — listed, indexable, findable.
  --
  -- BE HONEST ABOUT WHAT 'unlisted' BUYS, in the settings copy as well as here:
  -- a post id is seven random Crockford characters and is not guessable, but a
  -- handle is chosen and short. Unlisted on a PROFILE therefore means "not
  -- listed, not in the feed, not in search" and not "secret". A coach who needs
  -- secret has 'private', which is where they already are.
  add constraint studio_profiles_visibility_known check (
    visibility in ('private','unlisted','public')
  ),

  add constraint studio_profiles_licence_known check (
    licence is null or licence in (
      'uefa_c','uefa_b','uefa_a','uefa_pro',
      'uefa_youth_b','uefa_elite_youth_a',
      'uefa_gk_b','uefa_gk_a',
      'uefa_futsal_b',
      'other'
    )
  );

-- ── 2. Reading a profile that is unlisted ────────────────────────────────────
--
-- `studio_profiles_public_read` from 012 is deliberately NOT touched: it still
-- reads `visibility = 'public' and handle is not null`, so a listing, a feed or
-- a `select *` gone wrong can only ever return published profiles.
--
-- This is the other door, and it is a keyhole: one exact handle in, at most one
-- row out, nothing that resembles a list. `security definer` because it must
-- see past the policy above; `stable`, so it can be planned as a read.
--
-- ── IT NAMES ITS COLUMNS, AND `returns setof studio_profiles` WOULD NOT ──────
--
-- The obvious spelling returns the whole row, and a security-definer function
-- returning the whole row hands a visitor every column this table will ever
-- grow — `folders` today, which is a coach's own filing and named after their
-- work, and whatever lands here next. `PublicProfile` in cloud.ts states the
-- rule for the client: if a value is to be shown to strangers it has to be
-- named on purpose. This is that rule in the database, where it holds even for
-- a caller that never reads cloud.ts.
--
-- `drop` first: Postgres will not let `create or replace` change a return type,
-- so a file that only replaced it would apply cleanly on a fresh database and
-- fail on the one that already ran the earlier version.

drop function if exists public.studio_profile_by_handle(text);

create function public.studio_profile_by_handle(want text)
returns table (
  id           uuid,
  handle       text,
  presenter    text,
  team         text,
  role         text,
  bio          text,
  crest_path   text,
  avatar_path  text,
  team_colour  text,
  kit_ring     text,
  kit_pattern  text,
  kit_alt      text,
  licence      text,
  visibility   text,
  links        jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, p.handle, p.presenter, p.team, p.role, p.bio,
         p.crest_path, p.avatar_path, p.team_colour,
         p.kit_ring, p.kit_pattern, p.kit_alt,
         p.licence, p.visibility, p.links
    from public.studio_profiles p
   where p.handle = lower(trim(want))
     and p.handle is not null
     and p.visibility in ('unlisted','public')
   limit 1;
$$;

grant execute on function public.studio_profile_by_handle(text) to anon, authenticated;

-- ── 3. The posts ─────────────────────────────────────────────────────────────
--
-- `doc` IS A SNAPSHOT, NOT A REFERENCE. docs/SOCIAL.md §3c fixes this and it is
-- worth the duplicated jsonb: a coach editing Tuesday's session must not
-- silently rewrite something a stranger read last week. The same rule as
-- `studio_shares`, and the same rule 1b applied to squad players — a published
-- thing keeps what it was published with.
--
-- WHAT IS NOT IN THIS DOCUMENT IS THE POINT. The personalisation toggles in the
-- publish dialog STRIP before the payload is sent (the rule 017 §1 set for
-- share links: stripped, never hidden behind a flag the reader is trusted to
-- honour). So a post published without names has no names in this row, and a
-- post published without faces has no photo path in it — there is nothing here
-- for a future bug to leak.

create table if not exists public.studio_posts (
  -- The public URL: /p/k7f3q9. Same random Crockford alphabet as
  -- `studio_shares` (004) for the same two reasons: nothing sequential to walk,
  -- and no character that is ambiguous read down the phone.
  id           text        primary key,

  -- CASCADE, unlike `studio_shares.owner` which is `set null`. A share is a
  -- link a coach sent to somebody and orphaning it keeps a promise to the
  -- recipient. A post is a coach standing in a public place under their own
  -- name; when the account goes, so does the standing.
  owner        uuid        not null references auth.users(id) on delete cascade,

  doc          jsonb       not null,

  -- Written from the document at publish time rather than read out of `doc` on
  -- every feed row: the feed sorts and pages on these, and a jsonb path
  -- expression in an ORDER BY is an index nobody has.
  title        text        not null,
  summary      text,

  -- 'unlisted' or 'public'. NO 'private' HERE and that is deliberate: an unread
  -- post is a draft, and a draft is a system in the studio, which is where
  -- every coach's private work already lives. A row in this table exists
  -- because somebody pressed Publish.
  --
  -- The DEFAULT is the quieter of the two. A dialog that mis-fires, a retry
  -- that loses a field, a future caller that forgets to pass one: all of them
  -- should land on "only people I send it to", never on the feed.
  visibility   text        not null default 'unlisted',

  -- Permanent attribution, both ends (§5b). `set null` rather than cascade: if
  -- the original is taken down, the fork is still the forker's own work and
  -- must not vanish with it. The UI then says "forked from a system that is no
  -- longer here", which is true, rather than pretending it was original.
  forked_from  text        references public.studio_posts(id) on delete set null,

  -- Counters live on the row from the first day, per §3, so no later phase has
  -- to add a column to a table with rows in it. NOTHING WRITES THEM YET —
  -- incrementing a view is a function with rate limiting behind it and that is
  -- Phase 3's problem, not a column's.
  view_count   integer     not null default 0,
  fork_count   integer     not null default 0,
  save_count   integer     not null default 0,

  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.studio_posts drop constraint if exists studio_posts_id_shape;
alter table public.studio_posts drop constraint if exists studio_posts_visibility_known;
alter table public.studio_posts drop constraint if exists studio_posts_title_len;
alter table public.studio_posts drop constraint if exists studio_posts_summary_len;
alter table public.studio_posts drop constraint if exists studio_posts_doc_shape;
alter table public.studio_posts drop constraint if exists studio_posts_not_own_fork;

alter table public.studio_posts
  add constraint studio_posts_id_shape check (id ~ '^[0-9a-hjkmnp-tv-z]{6,16}$'),

  add constraint studio_posts_visibility_known check (visibility in ('unlisted','public')),

  add constraint studio_posts_title_len check (length(title) between 1 and 120),

  -- The same 280 the bio gets. A summary longer than that is the system talking
  -- rather than the coach, and the system is right there.
  add constraint studio_posts_summary_len check (summary is null or length(summary) <= 280),

  -- An object, and not enormous. The cap matches the one share.mts enforces in
  -- code (~40KB is a big two-team system over ten phases); stated here as well
  -- because this table is written from the browser and not through a function,
  -- so this CHECK is the layer that cannot be talked out of it.
  add constraint studio_posts_doc_shape check (
    jsonb_typeof(doc) = 'object' and pg_column_size(doc) < 400000
  ),

  add constraint studio_posts_not_own_fork check (forked_from is null or forked_from <> id);

-- The feed: newest public first. Partial, because the feed never reads an
-- unlisted row and there is no reason to carry one in the index.
create index if not exists studio_posts_feed_idx
  on public.studio_posts (published_at desc)
  where visibility = 'public';

-- "Everything I have published", for the portal.
create index if not exists studio_posts_owner_idx
  on public.studio_posts (owner, published_at desc);

-- "What came out of this system", for the attribution line at both ends.
create index if not exists studio_posts_forked_from_idx
  on public.studio_posts (forked_from)
  where forked_from is not null;

drop trigger if exists studio_posts_touch on public.studio_posts;
create trigger studio_posts_touch
  before update on public.studio_posts
  for each row execute function public.studio_touch_updated_at();

-- ── 4. Who may read and write a post ─────────────────────────────────────────

alter table public.studio_posts enable row level security;

-- The coach's own posts, whatever their visibility: list, edit the summary,
-- change the visibility, take it down. Same shape as `studio_squad_own` (013)
-- and `studio_systems_own` (005).
drop policy if exists studio_posts_own on public.studio_posts;
create policy studio_posts_own
  on public.studio_posts
  for all
  to authenticated
  using ((select auth.uid()) = owner)
  with check ((select auth.uid()) = owner);

-- Everyone else, reading published work. 'public' ONLY — see the header for why
-- 'unlisted' is not in here and never should be.
drop policy if exists studio_posts_public_read on public.studio_posts;
create policy studio_posts_public_read
  on public.studio_posts
  for select
  to anon, authenticated
  using (visibility = 'public');

-- Two layers, both required (001, 005, 012). anon reads and never writes.
grant usage on schema public to anon, authenticated;
grant select on public.studio_posts to anon;
grant select, insert, update, delete on public.studio_posts to authenticated;

-- The keyhole for an unlisted post: an exact id in, at most one row out.
create or replace function public.studio_post_by_id(want text)
returns setof public.studio_posts
language sql
security definer
set search_path = ''
stable
as $$
  select *
    from public.studio_posts
   where id = lower(trim(want))
     and visibility in ('unlisted','public')
   limit 1;
$$;

grant execute on function public.studio_post_by_id(text) to anon, authenticated;

-- ── 5. The `published` bucket ────────────────────────────────────────────────
--
-- ── WHY A THIRD BUCKET RATHER THAN A FOLDER IN `crests` ──────────────────────
--
-- 013 put avatars in `crests` and argued the case: the write policy is already
-- `foldername[1] = auth.uid()`, so a second bucket would be four more policies
-- for no new rule. That argument does not carry here, because this bucket has a
-- rule of its own that the other two must never acquire:
--
--   EVERYTHING IN HERE WAS PUBLISHED TO STRANGERS ON PURPOSE, AND ALL OF IT IS
--   SUBJECT TO TAKEDOWN.
--
-- A crest is a club badge. A file in here may be a photograph of a fifteen year
-- old, copied out of the PRIVATE `players` bucket because their coach ticked a
-- box saying it could travel with a published system. When a post comes down —
-- by the coach, by a parent's request, or by us — the files come down with it,
-- and "delete the objects under <post id>/" has to be one unambiguous
-- operation over one bucket. Mixed in beside the crests it would be a prefix
-- match against a bucket where a mistake deletes a coach's badge.
--
-- 013's rule is NOT relaxed by this: `players` stays private, and nothing is
-- copied out of it except by the per-post consent step in the publish dialog.
-- A shared board still shows names and no faces. This bucket is the only
-- exception in the project and it is one press wide.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'published',
  'published',
  true,
  2097152,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- READ IS NARROW EVEN THOUGH THE BUCKET IS PUBLIC, and the two are not in
-- conflict: /storage/v1/object/public/published/<path> does not evaluate RLS,
-- which is how a stranger's browser draws the picture. This policy governs
-- LISTING, and 015 is the reason it is written this way — a world-listable
-- bucket is a directory of every account, and here it would be a directory of
-- every published face. Own folder only, exactly as 015 left `crests`.
drop policy if exists studio_published_read on storage.objects;
create policy studio_published_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'published'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- "<uid>/<post id>/<file>". The first segment is what the policy pins; the
-- second is what makes a takedown one prefix.
drop policy if exists studio_published_write on storage.objects;
create policy studio_published_write
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'published'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists studio_published_update on storage.objects;
create policy studio_published_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'published'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'published'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists studio_published_delete on storage.objects;
create policy studio_published_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'published'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
