-- ── FOLDERS FOR SYSTEMS ────────────────────────────────────────────────────────
--
-- Adds a dedicated array of folder names to the coach's profile.
--
-- Why here instead of a separate table? A coach might have 5-10 folders. A whole
-- table for 10 strings per coach is overkill, and this data is fetched exactly 
-- when the coach opens their portal — the same time we fetch their profile.
--
-- Why not just deduce it from the systems? We used to. But if a coach emptied
-- a folder, it disappeared from the UI, which meant they lost their organisation
-- structure (user, 2026-08-29). 
--
-- jsonb rather than text[] because the client already expects jsonb arrays 
-- for `links`, and it keeps the row mapping consistent.

alter table public.studio_profiles
  add column if not exists folders jsonb not null default '[]'::jsonb;
