-- 029 · A full squad must still be EDITABLE. The cap counts new players only.
--
-- ── THE FAULT ────────────────────────────────────────────────────────────────
--
-- Reported on 2026-09-09 by a coach with sixty players, who added two of them
-- that morning and then could not put faces on either. What the studio told him
-- was:
--
--     The picture uploaded but the player did not save. Try again.
--
-- Trying again did the same thing, because nothing about it was transient. The
-- upload had genuinely worked; the row write behind it could not succeed at all.
--
-- Two things in 013 combine into it:
--
--   1. `savePlayer` in src/studio/account/squad.ts writes with `.upsert(row)`,
--      which is `INSERT … ON CONFLICT (id) DO UPDATE`. One code path creates a
--      player and edits one, which is right — the caller genuinely does not care
--      which it is, and the row comes back either way.
--
--   2. `studio_squad_cap` is a BEFORE INSERT trigger that raises when the owner
--      already holds sixty rows.
--
-- Postgres fires a BEFORE INSERT trigger for the PROPOSED row of an
-- `INSERT … ON CONFLICT`, before it looks for the conflict that would turn the
-- statement into an update. So the trigger runs on every save, sees sixty rows,
-- and raises — on a statement that was never going to insert anything.
--
-- The visible fault was a photograph, because that is what he happened to be
-- doing. The actual one is that A SQUAD AT THE CAP IS FROZEN SOLID. Renaming a
-- player, correcting a shirt number, adding a face and reordering the list all
-- go through an upsert on this table, and at exactly sixty players every one of
-- them fails with a message about a limit the coach is not trying to exceed.
--
-- The cap did what it was written to do — it is the difference between a mistake
-- costing one row and a script costing a bucket, and it stays. What it must not
-- do is count a player who is already in the squad against the room left for new
-- ones. A row that exists is not an arrival.
--
-- ── THE SHAPE OF THE FIX ─────────────────────────────────────────────────────
--
-- The trigger cannot ask whether the statement it is inside will resolve to an
-- update — at BEFORE INSERT time, that has not been decided yet. It can ask the
-- question that actually matters, which is whether THIS ID IS ALREADY HERE. If
-- it is, the row is not a new player and the cap has nothing to say about it.
--
-- That test is exact rather than approximate. `id` is the primary key and it is
-- the only column `.upsert()` conflicts on, so "a row with this id exists" is
-- precisely "this statement is an update". A new player carries no id at all —
-- `savePlayer` omits the column so the default issues one — and cannot match.
--
-- It is also the right predicate for a hostile caller, which is the case worth
-- being careful about. Someone hand-writing an insert with an id they invented
-- gets no relief: `exists` is false for it, and the count still runs. Someone
-- naming an id that DOES exist is updating a row that RLS has already restricted
-- to their own, and updates were never capped in the first place.
--
-- ── WHAT THE CLIENT NEEDS ────────────────────────────────────────────────────
--
-- Nothing. SQUAD_MAX in src/studio/account/squad.ts stays 60 and still stops the
-- `add` path before it reaches the database, which is what keeps the honest
-- message — "A squad holds at most 60 players." — in front of a coach who is
-- really trying to add a sixty-first. This migration only stops that sentence
-- being thrown at the fifty-nine saves that are not doing anything of the kind.
--
-- ── HOW TO APPLY ─────────────────────────────────────────────────────────────
--
--   Dashboard → SQL Editor → paste this file → Run.
--
-- `create or replace function` on the existing name, so the trigger created in
-- 013 keeps pointing at it and does not need dropping. Running it twice is safe,
-- and running it on a database that never had 013 will fail loudly on a missing
-- table rather than half-apply.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.studio_squad_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The row is already in the squad, so this is an upsert on its way to being an
  -- UPDATE and the cap is not about it. See the head of this file: a BEFORE
  -- INSERT trigger fires on `INSERT … ON CONFLICT` before the conflict is found,
  -- which froze every edit on a squad that had reached sixty.
  if exists (select 1 from public.studio_squad where id = new.id) then
    return new;
  end if;

  if (select count(*) from public.studio_squad where owner = new.owner) >= 60 then
    raise exception 'A squad holds at most 60 players.';
  end if;

  return new;
end;
$$;
