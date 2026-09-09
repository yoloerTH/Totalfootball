-- 031 · Increase squad max from 60 to 100.
--
-- ── THE CHANGE ───────────────────────────────────────────────────────────────
--
-- The squad cap was previously 60. This updates the BEFORE INSERT trigger to
-- raise when the count is 100.
--
-- ── HOW TO APPLY ─────────────────────────────────────────────────────────────
--
--   Dashboard → SQL Editor → paste this file → Run.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.studio_squad_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.studio_squad where id = new.id) then
    return new;
  end if;

  if (select count(*) from public.studio_squad where owner = new.owner) >= 100 then
    raise exception 'A squad holds at most 100 players.';
  end if;

  return new;
end;
$$;
