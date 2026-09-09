-- 030 · A system collaborator may ANSWER an invitation. They may not re-aim it.
--
-- The other half of 028, which named this table in its closing note and left it
-- deliberately for its own file. Same fault, same guard — but read the second
-- section before assuming it is merely 028 with one boolean instead of eight,
-- because this row carries something that row did not.
--
-- ── THE FAULT, THE PART THAT IS THE SAME ─────────────────────────────────────
--
-- 020 gave `studio_system_collaborators` this update policy:
--
--     using       ((select auth.uid()) = system_owner or (select auth.uid()) = member_id)
--     with check  ((select auth.uid()) = system_owner or (select auth.uid()) = member_id)
--
-- and put the permission in an ordinary column, `can_edit`. So an invited
-- collaborator may update their own row — which is how they accept, and is
-- correct — and while they are there they may set `can_edit` to true on
-- themselves. The systems policy in the same migration reads that column:
--
--     exists (select 1 from public.studio_system_collaborators sc
--              where sc.system_owner = public.studio_systems.owner
--                and sc.system_id    = public.studio_systems.id
--                and sc.member_id    = (select auth.uid())
--                and sc.status       = 'accepted'
--                and sc.can_edit     = true)
--
-- Turning your own view-only invitation into an editing one is one PATCH, and
-- the owner is never told.
--
-- ── THE PART THAT IS WORSE ───────────────────────────────────────────────────
--
-- `studio_team_members` grants access to a WHOLE ACCOUNT, so its row had nobody
-- to name: owner_id, member_id, and the booleans. This row names A PARTICULAR
-- SYSTEM, in `system_id`, and the policy above matches on it.
--
-- So the escalation here is not only "more permission on the system I was
-- invited to". It is "a different system". A collaborator who edits `system_id`
-- on their own accepted row moves their access onto another of that owner's
-- systems — one they were never invited to and the owner never mentioned.
--
-- And `system_owner` is no anchor either. It is not checked against anything at
-- update time; the composite foreign key only requires that the (system_owner,
-- system_id) pair names a row that EXISTS in `studio_systems`. Any such pair in
-- the table qualifies, belonging to anybody. The RLS `with check` still passes,
-- because `member_id` is untouched and it is still them. One row, once accepted,
-- is a movable pass to any system in the database whose owner and id are known.
--
-- Guessing a `system_id` is friction. It is not a control, and it is not what is
-- keeping anyone out. The reason nothing has happened is that the table is
-- EMPTY — checked against production while writing this, 0 rows — so the feature
-- has no users yet and this is being closed before it has any, which is the only
-- comfortable time to close something like this.
--
-- ── THE GUARD ────────────────────────────────────────────────────────────────
--
-- Exactly 028's shape, extended to pin the three columns that decide WHO and
-- WHICH SYSTEM rather than the two that decided who:
--
--   · the owner writes what they like — it is their invitation
--   · nobody moves a row between people OR between systems
--   · everybody else on the row may change their answer, and nothing else
--
-- A trigger and not a policy, for the reason 028 gives at length: RLS chooses
-- which ROWS a statement may touch and cannot say which COLUMNS, and a column
-- grant cannot depend on the row — the owner writes these same columns on rows
-- of this same table. BEFORE UPDATE is the one place that can compare old to new.
--
-- `security invoker`, matching 028, so `auth.uid()` is the caller's. A definer
-- function here would be reading its own identity and the first branch would
-- never be true.
--
-- ── HOW TO APPLY ─────────────────────────────────────────────────────────────
--
--   Dashboard → SQL Editor → paste this file → Run.
--
-- Idempotent: `create or replace` on the function, the trigger dropped before it
-- is created. The `touch` trigger from 020 is left alone and both will run.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.studio_system_collaborators_answer_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- The owner writes what they like. This is their invitation.
  if (select auth.uid()) is not distinct from old.system_owner then
    return new;
  end if;

  -- Nobody may move a row between people, or onto a different system. The
  -- second half is what makes this table's version worse than 028's; see the
  -- head of this file.
  if new.system_owner is distinct from old.system_owner
     or new.system_id is distinct from old.system_id
     or new.member_id is distinct from old.member_id then
    raise exception 'A collaboration cannot be moved to another person or another system.'
      using errcode = '42501';
  end if;

  -- Everybody else on the row may answer, and that is all.
  if new.can_edit is distinct from old.can_edit then
    raise exception 'Only the coach who sent an invitation can change what it allows.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists studio_system_collaborators_answer_only on public.studio_system_collaborators;
create trigger studio_system_collaborators_answer_only
  before update on public.studio_system_collaborators
  for each row execute function public.studio_system_collaborators_answer_only();
