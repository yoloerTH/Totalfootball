-- 028 · An invited member may ANSWER an invitation. They may not rewrite it.
--
-- ── THE FAULT ────────────────────────────────────────────────────────────────
--
-- 020 gave `studio_team_members` this update policy:
--
--     using       ((select auth.uid()) = owner_id or (select auth.uid()) = member_id)
--     with check  ((select auth.uid()) = owner_id or (select auth.uid()) = member_id)
--
-- Both halves name both sides, and the row holds the EIGHT PERMISSION BOOLEANS
-- as ordinary columns. So an invited member may update their own row — which is
-- how they accept, and is correct — and while they are there they may also set
-- `can_edit_systems` to true on themselves. Every policy on `studio_systems`,
-- `studio_squad`, `studio_sequences`, `studio_prefs` and `studio_profiles` reads
-- those columns. Granting yourself edit on somebody's systems is one PATCH.
--
-- It is not remotely exploitable by a stranger: `studio_team_members_insert`
-- requires `auth.uid() = owner_id`, so a row only exists because the owner made
-- it. The exposure is exactly this — anyone you have ever invited, at any
-- permission level, including one you set to view-only and one they DECLINED,
-- can raise themselves to edit and you are never told.
--
-- Found on 2026-09-09 while building the iOS team screen, by reading the
-- policies rather than the migration. The query that found it, which is worth
-- running against every table that keeps permissions in its own columns:
--
--     select tablename, policyname, cmd, qual, with_check
--       from pg_policies
--      where schemaname = 'public' and cmd in ('UPDATE', 'ALL')
--      order by tablename;
--
-- Anything whose `with_check` names a role that the row's own columns GRANT is
-- the next one of these.
--
-- ── WHY A TRIGGER AND NOT A POLICY ───────────────────────────────────────────
--
-- RLS decides which ROWS a statement may touch. It cannot say "this role may
-- write this column and not that one" — that is a column-level GRANT, and a
-- column grant cannot depend on the row (the owner may write these columns on
-- the same table, on their own rows). A BEFORE UPDATE trigger is the one place
-- that sees both the old row and the new one and knows who is writing.
--
-- IT RAISES RATHER THAN PINNING THE VALUES BACK. Silently keeping the old value
-- would leave a client that thinks it granted something and a database that did
-- not, which is the shape of fault this file exists to end. A refusal is a
-- sentence somebody reads.
--
-- ── WHAT THIS DELIBERATELY DOES NOT DO ───────────────────────────────────────
--
-- It does not stop an OWNER changing `status`. Accepting on somebody's behalf is
-- also wrong, and it is not a privilege escalation: an owner who wanted the
-- access could grant it to themselves in one honest step. Tightening that would
-- change behaviour the web may depend on, and this file is about the hole.
--
-- Idempotent: the function is `create or replace` and the trigger is dropped
-- before it is created, the same pattern 005 uses for its policies.

create or replace function public.studio_team_members_answer_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- The owner writes what they like. This is their invitation.
  if (select auth.uid()) is not distinct from old.owner_id then
    return new;
  end if;

  -- Nobody may move a row between people.
  if new.owner_id is distinct from old.owner_id
     or new.member_id is distinct from old.member_id then
    raise exception 'A team membership cannot be moved to somebody else.'
      using errcode = '42501';
  end if;

  -- Everybody else on the row may answer, and that is all.
  if new.can_view_systems   is distinct from old.can_view_systems
     or new.can_edit_systems   is distinct from old.can_edit_systems
     or new.can_view_squad     is distinct from old.can_view_squad
     or new.can_edit_squad     is distinct from old.can_edit_squad
     or new.can_view_sequences is distinct from old.can_view_sequences
     or new.can_edit_sequences is distinct from old.can_edit_sequences
     or new.can_view_settings  is distinct from old.can_view_settings
     or new.can_edit_settings  is distinct from old.can_edit_settings then
    raise exception 'Only the coach who sent an invitation can change what it allows.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists studio_team_members_answer_only on public.studio_team_members;
create trigger studio_team_members_answer_only
  before update on public.studio_team_members
  for each row execute function public.studio_team_members_answer_only();

-- The same shape exists on `studio_system_collaborators` (020): one `can_edit`
-- column, and an update policy that names the member. It is the same fault with
-- one boolean instead of eight, and it wants the same guard. Left out of this
-- file deliberately so the fix for the eight-column table can be reviewed and
-- applied on its own; it is the next thing to do, not a thing to forget.
