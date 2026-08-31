-- 022_team_save_auto_owner.sql
-- Makes the save RPC automatically resolve the owner of the system being saved
-- based on what we have access to via RLS, instead of relying on the client
-- which assumes it owns everything.

drop function if exists public.studio_systems_save(text, jsonb, timestamptz);
drop function if exists public.studio_systems_save(text, jsonb, timestamptz, uuid);

create or replace function public.studio_systems_save(
  p_id     text,
  p_doc    jsonb,
  p_base   timestamptz default null,
  p_owner  uuid default null -- Kept for signature compatibility if passed
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  uid uuid := (select auth.uid());
  target_owner uuid;
  cur timestamptz;
  landed timestamptz;
begin
  if uid is null then
    raise exception 'studio_systems_save requires a signed-in user'
      using errcode = '28000';
  end if;

  -- Because this is SECURITY INVOKER, RLS restricts this to systems we can actually access.
  -- We look up the system by id. If we can see it, that's the one we're updating.
  select owner, updated_at into target_owner, cur
  from public.studio_systems
  where id = p_id
  limit 1;

  -- New to this account and not a shared system we can see: insert for ourselves.
  if cur is null then
    insert into public.studio_systems (owner, id, doc)
    values (uid, p_id, p_doc)
    returning updated_at into landed;
    return jsonb_build_object('ok', true, 'updated_at', landed);
  end if;

  -- The row has moved since this client last saw it
  if p_base is null or cur > p_base then
    return jsonb_build_object(
      'ok', false,
      'updated_at', cur,
      'doc', (select doc from public.studio_systems where owner = target_owner and id = p_id)
    );
  end if;

  update public.studio_systems
  set doc = p_doc
  where owner = target_owner and id = p_id
  returning updated_at into landed;

  return jsonb_build_object('ok', true, 'updated_at', landed);
end;
$$;

grant execute on function public.studio_systems_save(text, jsonb, timestamptz, uuid) to authenticated;
revoke execute on function public.studio_systems_save(text, jsonb, timestamptz, uuid) from anon, public;
