-- Profile isolation, and the switch that keeps a name off an export.
--
-- Two unrelated-looking things in one file because they touch the same table
-- and a coach applying migrations should run one script, not two.
--
-- ── 1. WHAT WENT WRONG, BECAUSE THE FIX BELOW ONLY MAKES SENSE WITH IT ───────
--
-- `loadProfile()` in src/studio/account/cloud.ts asked this table for "a
-- profile" and leaned on RLS to make that mean "my profile". It does not.
-- Policies are OR'd, and 012 added `studio_profiles_public_read`, so a
-- signed-in coach can see their own row PLUS every published one. Two visible
-- rows and `.maybeSingle()` answers 406 PGRST116, which the client read as
-- "you have no profile" — so the settings page emptied, the studio stopped
-- painting the coach's kit, and the share dialog asked for a name it already
-- had (user, 2026-08-28).
--
-- The client fix is a `.eq('id', uid)`. This file is the layer under it, and it
-- exists because the SAME hole let one account's data be written into another:
-- before publishing, a second coach's session could see exactly one row — the
-- first coach's public one — so the settings form loaded it, and Save wrote it
-- back under the second coach's id. Row ab8fa212 ended up holding
-- 04189c96's crest path. Reproduced against production 2026-08-28.
--
-- The two-layer rule this project states in 001, 002, 005 and 012 applies to
-- values as well as to rows: the CHECK below is the one that would have made
-- that write impossible no matter what the browser sent.
--
-- ── HOW TO APPLY ─────────────────────────────────────────────────────────────
--
--   Dashboard -> SQL Editor -> paste this file -> Run.
--
-- Idempotent throughout. See supabase/011 for the CLI and Management API
-- alternatives.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Repair before constraining ────────────────────────────────────────────
--
-- MUST COME FIRST. The constraints below are added VALIDATED, so any row still
-- holding somebody else's path would fail the whole migration.
--
-- NULL rather than a guess, and only where the path does not belong to the row
-- holding it. A crest nobody uploaded is not theirs to keep, the file itself is
-- untouched and still belongs to its owner, and the account this clears can
-- upload its own in one press. The `where` clause is written so re-running this
-- after the fact matches nothing.

update public.studio_profiles
   set crest_path = null
 where crest_path is not null
   and crest_path not like id::text || '/%';

update public.studio_profiles
   set avatar_path = null
 where avatar_path is not null
   and avatar_path not like id::text || '/%';

-- ── 2. A path may only point inside your own folder ──────────────────────────
--
-- The storage policies in 012 and 013 already say this about the OBJECT: a
-- write to the bucket must land under `foldername[1] = auth.uid()`. What was
-- missing is the same statement about the COLUMN that points at it. The old
-- constraints pinned the shape to "a uuid, then a filename", which a uuid
-- belonging to somebody else satisfies perfectly.
--
-- Compared against `id` rather than against `auth.uid()`, deliberately: a CHECK
-- may not call a function whose result depends on the session, and `id` IS the
-- account (005 makes it `references auth.users`). It is also the stronger
-- statement, because it holds for a service-role write too.

alter table public.studio_profiles drop constraint if exists studio_profiles_crest_path_shape;
alter table public.studio_profiles drop constraint if exists studio_profiles_avatar_path_shape;

alter table public.studio_profiles
  add constraint studio_profiles_crest_path_shape check (
    crest_path is null or (
      crest_path ~ '^[0-9a-f-]{36}/crest\.(png|jpg|jpeg|webp)$'
      and crest_path like id::text || '/%'
    )
  ),
  add constraint studio_profiles_avatar_path_shape check (
    avatar_path is null or (
      avatar_path ~ '^[0-9a-f-]{36}/avatar\.(png|jpg|jpeg|webp)$'
      and avatar_path like id::text || '/%'
    )
  );

-- The same reasoning for a player's photograph. 013 pins it to
-- "<uuid>/<player-uuid>.<ext>" without saying whose uuid the first one is.

update public.studio_squad
   set photo_path = null
 where photo_path is not null
   and photo_path not like owner::text || '/%';

alter table public.studio_squad drop constraint if exists studio_squad_photo_path_shape;

alter table public.studio_squad
  add constraint studio_squad_photo_path_shape check (
    photo_path is null or (
      photo_path ~ '^[0-9a-f-]{36}/players/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'
      and photo_path like owner::text || '/%'
    )
  );

-- ── 3. Whether a coach's name travels with their work ────────────────────────
--
-- ON BY DEFAULT, and that is the opposite of how `visibility` was introduced in
-- 012, for a reason worth stating rather than leaving as an inconsistency.
--
-- `visibility` publishes a page ABOUT a coach to strangers who did not ask, so
-- it defaults to private and opting in is a deliberate act. This field is the
-- credit line on work the coach is themselves choosing to send somebody. That
-- credit is the watermarking policy (see src/studio/viewer/CreditBar.tsx): a
-- name reads as authorship, and taking it off by default would quietly strip
-- every coach's authorship from their own exports.
--
-- So the default is the behaviour that already shipped, and this column only
-- ever exists to let a coach say no — for a board going into a club deck under
-- somebody else's letterhead, or one they simply do not want their name on.
--
-- It is the DEFAULT, not the rule. Each export, film and share link can flip it
-- for that one file without touching this. See ExportDialog, VideoDialog and
-- ShareDialog.

alter table public.studio_profiles
  add column if not exists show_identity boolean not null default true;

-- No new grant and no new policy. The column rides on the row, which
-- `studio_profiles_own` (005) already covers for the coach themselves.
--
-- IT IS READABLE THROUGH THE PUBLIC POLICY, like every other column on this
-- table, and that is harmless: it says whether a coach signs their exports, not
-- anything about them. 012's warning still stands and is worth re-reading
-- before the next column lands here — NOTHING ON studio_profiles IS PRIVATE.
