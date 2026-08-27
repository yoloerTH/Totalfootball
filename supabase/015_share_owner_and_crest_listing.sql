-- Two holes found by auditing what a coach uploads against who can reach it.
--
-- Asked plainly: does everything a coach puts in stay on their account? For
-- `studio_systems`, `studio_squad`, `studio_prefs` and the `players` bucket the
-- answer was already yes, and this file changes none of them. Two things were
-- not:
--
--   1. A PUBLISHED BOARD COULD BE OVERWRITTEN BY ANYONE HOLDING ITS LINK.
--      Reproduced against production on 2026-08-27: publish a board, then POST
--      to /api/share again with its id from a caller with no session and no
--      Origin header, and the board is replaced. The share ids are in public
--      URLs, so the "secret" is printed on the thing being protected.
--
--      `studio_shares` has no owner column — it predates accounts, and 004 says
--      so: "Until there is an owner to compare against, a policy would be
--      theatre." There is one now. Section 1 adds it, and netlify/functions/
--      share.mts stops accepting a write it cannot attribute.
--
--   2. THE `crests` BUCKET WAS WORLD-LISTABLE. `studio_crests_read` was
--      `bucket_id = 'crests'` with no path predicate, granted to anon, so
--      anybody could enumerate the bucket and get back one folder per coach —
--      every account's user id — and then every crest and avatar inside them,
--      including those of coaches whose profile is private.
--
--      013 names this and accepts it for club badges ("correct for club badges,
--      indefensible for a U16 side"). It is not correct even for badges: the
--      bucket stays public so a shared board still shows a crest, but the
--      DIRECTORY of who has an account is not part of that bargain. Section 2
--      narrows the policy to a coach's own folder.
--
-- ── HOW TO APPLY ─────────────────────────────────────────────────────────────
--
--   Dashboard -> SQL Editor -> paste this file -> Run.
--   Or: node scripts/apply-migration.mjs supabase/015_share_owner_and_crest_listing.sql
--
-- Idempotent throughout.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Published boards get an owner ─────────────────────────────────────────

alter table public.studio_shares
  -- NULLABLE, and it has to be. Every row published before this migration has
  -- no owner and cannot be given one from here — the table never recorded who
  -- wrote it. share.mts treats a null owner as "unclaimed but not up for
  -- grabs": it refuses to overwrite the row, and adopts it only for a coach who
  -- can prove the claim by owning a system in studio_systems that carries this
  -- share id. Everyone else gets a new link instead of somebody else's.
  --
  -- `on delete set null` rather than cascade: deleting an account must not
  -- silently break links that coach has already sent to other people. The row
  -- becomes unowned, which is where it started.
  add column if not exists owner uuid references auth.users(id) on delete set null;

-- For "which links has this coach published", which the portal does not do yet
-- and now can. Partial, because the pre-migration rows are all null and there
-- is no reason to carry them in the index.
create index if not exists studio_shares_owner_idx
  on public.studio_shares (owner)
  where owner is not null;

-- The table stays SERVICE-ROLE ONLY: RLS on, no policies, nothing granted. That
-- is unchanged from 004 and is deliberate. share.mts is the entire surface, and
-- the owner column above is what lets it tell one coach from another. Adding an
-- `authenticated` policy here would be a second door to a table that has done
-- fine with one; it is worth doing on the day the portal grows an Unpublish
-- button, and not before.
alter table public.studio_shares enable row level security;
revoke all on public.studio_shares from anon;
revoke all on public.studio_shares from authenticated;

-- ── 2. The crests bucket stops being a directory of coaches ──────────────────
--
-- WHAT STILL WORKS, because it is the whole point of a public bucket: a crest
-- and an avatar are served from /storage/v1/object/public/crests/<path>, which
-- does not evaluate RLS at all. A stranger opening a shared board still sees
-- the club badge on it, and a public profile page still shows its avatar.
--
-- WHAT STOPS WORKING: listing. The list endpoint runs this policy, and it is
-- the only thing that did. Nothing in the app calls `.list()` on this bucket —
-- `getPublicUrl` builds a string client-side and makes no request — so
-- narrowing it to the caller's own folder costs the product nothing and takes
-- the enumeration away.
--
-- The shape matches the write policies in 012 that already pin
-- `foldername[1] = auth.uid()`, so all four are now the same rule.

drop policy if exists studio_crests_read on storage.objects;
create policy studio_crests_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'crests'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
