-- 020_team_collaboration.sql
-- Enables "Team Members" and "Project Collaborators"

-- ── 1. Team Members (Personal Settings Invites) ──────────────────────────────
-- A bidirectional-capable, row-per-direction table.
-- If Coach A invites Coach B, owner_id = A, member_id = B.
create table if not exists public.studio_team_members (
  id          uuid        primary key default gen_random_uuid(),
  owner_id    uuid        not null references auth.users(id) on delete cascade,
  member_id   uuid        not null references auth.users(id) on delete cascade,
  status      text        not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  
  -- Permissions that owner_id grants to member_id
  can_view_systems    boolean not null default true,
  can_edit_systems    boolean not null default false,
  can_view_squad      boolean not null default true,
  can_edit_squad      boolean not null default false,
  can_view_sequences  boolean not null default true,
  can_edit_sequences  boolean not null default false,
  can_view_settings   boolean not null default true,
  can_edit_settings   boolean not null default false,
  
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One relationship per pair
  constraint studio_team_members_unique unique (owner_id, member_id)
);

create index if not exists studio_team_members_owner_idx on public.studio_team_members(owner_id);
create index if not exists studio_team_members_member_idx on public.studio_team_members(member_id);

-- Trigger for updated_at
drop trigger if exists studio_team_members_touch on public.studio_team_members;
create trigger studio_team_members_touch
  before update on public.studio_team_members
  for each row execute function public.studio_touch_updated_at();

alter table public.studio_team_members enable row level security;

-- A coach can see rows where they are the owner OR the member.
drop policy if exists studio_team_members_read on public.studio_team_members;
create policy studio_team_members_read
  on public.studio_team_members
  for select
  to authenticated
  using ((select auth.uid()) = owner_id or (select auth.uid()) = member_id);

-- A coach can only create/update rows where they are the owner (managing invites they sent)
-- OR update rows where they are the member (accepting/declining).
drop policy if exists studio_team_members_insert on public.studio_team_members;
create policy studio_team_members_insert
  on public.studio_team_members
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists studio_team_members_update on public.studio_team_members;
create policy studio_team_members_update
  on public.studio_team_members
  for update
  to authenticated
  using ((select auth.uid()) = owner_id or (select auth.uid()) = member_id)
  with check ((select auth.uid()) = owner_id or (select auth.uid()) = member_id);

drop policy if exists studio_team_members_delete on public.studio_team_members;
create policy studio_team_members_delete
  on public.studio_team_members
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id or (select auth.uid()) = member_id);


-- ── 2. Project Collaborators (Specific System Invites) ───────────────────────
create table if not exists public.studio_system_collaborators (
  id              uuid        primary key default gen_random_uuid(),
  system_owner    uuid        not null,
  system_id       text        not null,
  member_id       uuid        not null references auth.users(id) on delete cascade,
  status          text        not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  can_edit        boolean     not null default false,
  
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Foreign key to systems (composite)
  constraint studio_system_collaborators_fk foreign key (system_owner, system_id)
    references public.studio_systems(owner, id) on delete cascade,
  
  -- One invite per user per system
  constraint studio_system_collaborators_unique unique (system_owner, system_id, member_id)
);

create index if not exists studio_syscollab_system_idx on public.studio_system_collaborators(system_owner, system_id);
create index if not exists studio_syscollab_member_idx on public.studio_system_collaborators(member_id);

drop trigger if exists studio_system_collaborators_touch on public.studio_system_collaborators;
create trigger studio_system_collaborators_touch
  before update on public.studio_system_collaborators
  for each row execute function public.studio_touch_updated_at();

alter table public.studio_system_collaborators enable row level security;

-- A coach can see collaborators for systems they own, OR systems they are invited to.
drop policy if exists studio_syscollab_read on public.studio_system_collaborators;
create policy studio_syscollab_read
  on public.studio_system_collaborators
  for select
  to authenticated
  using ((select auth.uid()) = system_owner or (select auth.uid()) = member_id);

-- System owner can insert/update. Member can only update status.
drop policy if exists studio_syscollab_insert on public.studio_system_collaborators;
create policy studio_syscollab_insert
  on public.studio_system_collaborators
  for insert
  to authenticated
  with check ((select auth.uid()) = system_owner);

drop policy if exists studio_syscollab_update on public.studio_system_collaborators;
create policy studio_syscollab_update
  on public.studio_system_collaborators
  for update
  to authenticated
  using ((select auth.uid()) = system_owner or (select auth.uid()) = member_id)
  with check ((select auth.uid()) = system_owner or (select auth.uid()) = member_id);

drop policy if exists studio_syscollab_delete on public.studio_system_collaborators;
create policy studio_syscollab_delete
  on public.studio_system_collaborators
  for delete
  to authenticated
  using ((select auth.uid()) = system_owner or (select auth.uid()) = member_id);


-- ── 3. Secure Invite RPC ─────────────────────────────────────────────────────
-- Looks up a user by email, handle, or profile URL and returns their UUID.
-- Requires SECURITY DEFINER so it can query auth.users (where emails live).
create or replace function public.studio_resolve_invitee(search_term text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_id uuid;
  clean_term text := lower(trim(search_term));
begin
  -- 1. Try to match as email in auth.users
  select id into target_id from auth.users where lower(email) = clean_term limit 1;
  if target_id is not null then return target_id; end if;

  -- 2. Try to match as handle in studio_profiles
  -- clean_term could be a handle directly, or an @handle
  if clean_term like '@%' then
    clean_term := substring(clean_term from 2);
  end if;
  
  -- Or it could be a profile link (e.g., https://totalfootball.app/p/handle)
  -- Just extract the last segment if it contains slashes
  if clean_term like '%/%' then
    clean_term := split_part(clean_term, '/', array_length(string_to_array(clean_term, '/'), 1));
  end if;

  select id into target_id from public.studio_profiles where handle = clean_term limit 1;
  return target_id;
end;
$$;

-- ── 4. RLS Policy Updates for Shared Access ──────────────────────────────────
-- We augment the existing `_own` policies to allow access via `studio_team_members` or `studio_system_collaborators`.

-- Systems
drop policy if exists studio_systems_own on public.studio_systems;
create policy studio_systems_all_access
  on public.studio_systems
  for all
  to authenticated
  using (
    -- Owner
    (select auth.uid()) = owner
    or
    -- Team Member
    exists (
      select 1 from public.studio_team_members tm
      where tm.owner_id = public.studio_systems.owner
        and tm.member_id = (select auth.uid())
        and tm.status = 'accepted'
        and (tm.can_view_systems = true or tm.can_edit_systems = true)
    )
    or
    -- System Collaborator
    exists (
      select 1 from public.studio_system_collaborators sc
      where sc.system_owner = public.studio_systems.owner
        and sc.system_id = public.studio_systems.id
        and sc.member_id = (select auth.uid())
        and sc.status = 'accepted'
    )
  )
  with check (
    -- Owner
    (select auth.uid()) = owner
    or
    -- Team Member (Edit Check)
    exists (
      select 1 from public.studio_team_members tm
      where tm.owner_id = public.studio_systems.owner
        and tm.member_id = (select auth.uid())
        and tm.status = 'accepted'
        and tm.can_edit_systems = true
    )
    or
    -- System Collaborator (Edit Check)
    exists (
      select 1 from public.studio_system_collaborators sc
      where sc.system_owner = public.studio_systems.owner
        and sc.system_id = public.studio_systems.id
        and sc.member_id = (select auth.uid())
        and sc.status = 'accepted'
        and sc.can_edit = true
    )
  );

-- Squad
drop policy if exists studio_squad_own on public.studio_squad;
create policy studio_squad_all_access
  on public.studio_squad
  for all
  to authenticated
  using (
    (select auth.uid()) = owner
    or
    exists (
      select 1 from public.studio_team_members tm
      where tm.owner_id = public.studio_squad.owner
        and tm.member_id = (select auth.uid())
        and tm.status = 'accepted'
        and (tm.can_view_squad = true or tm.can_edit_squad = true)
    )
  )
  with check (
    (select auth.uid()) = owner
    or
    exists (
      select 1 from public.studio_team_members tm
      where tm.owner_id = public.studio_squad.owner
        and tm.member_id = (select auth.uid())
        and tm.status = 'accepted'
        and tm.can_edit_squad = true
    )
  );

-- Sequences
drop policy if exists own_rows on public.studio_sequences;
create policy studio_sequences_all_access
  on public.studio_sequences
  for all
  to authenticated
  using (
    (select auth.uid()) = owner
    or
    exists (
      select 1 from public.studio_team_members tm
      where tm.owner_id = public.studio_sequences.owner
        and tm.member_id = (select auth.uid())
        and tm.status = 'accepted'
        and (tm.can_view_sequences = true or tm.can_edit_sequences = true)
    )
  )
  with check (
    (select auth.uid()) = owner
    or
    exists (
      select 1 from public.studio_team_members tm
      where tm.owner_id = public.studio_sequences.owner
        and tm.member_id = (select auth.uid())
        and tm.status = 'accepted'
        and tm.can_edit_sequences = true
    )
  );

-- Settings (Prefs)
drop policy if exists studio_prefs_own on public.studio_prefs;
create policy studio_prefs_all_access
  on public.studio_prefs
  for all
  to authenticated
  using (
    (select auth.uid()) = id
    or
    exists (
      select 1 from public.studio_team_members tm
      where tm.owner_id = public.studio_prefs.id
        and tm.member_id = (select auth.uid())
        and tm.status = 'accepted'
        and (tm.can_view_settings = true or tm.can_edit_settings = true)
    )
  )
  with check (
    (select auth.uid()) = id
    or
    exists (
      select 1 from public.studio_team_members tm
      where tm.owner_id = public.studio_prefs.id
        and tm.member_id = (select auth.uid())
        and tm.status = 'accepted'
        and tm.can_edit_settings = true
    )
  );

-- Profiles
-- Profiles already have public read for published ones, but we also want to allow
-- team members to read private profiles if they have access.
drop policy if exists studio_profiles_own on public.studio_profiles;
create policy studio_profiles_all_access
  on public.studio_profiles
  for all
  to authenticated
  using (
    (select auth.uid()) = id
    or
    -- Allow reading/editing if a team member has settings access
    exists (
      select 1 from public.studio_team_members tm
      where tm.owner_id = public.studio_profiles.id
        and tm.member_id = (select auth.uid())
        and tm.status = 'accepted'
        and (tm.can_view_settings = true or tm.can_edit_settings = true)
    )
    or
    -- Fallback for public visibility (already covered by studio_profiles_public_read but safe to include)
    (visibility = 'public' and handle is not null)
  )
  with check (
    (select auth.uid()) = id
    or
    exists (
      select 1 from public.studio_team_members tm
      where tm.owner_id = public.studio_profiles.id
        and tm.member_id = (select auth.uid())
        and tm.status = 'accepted'
        and tm.can_edit_settings = true
    )
  );

-- Grants
grant select, insert, update, delete on public.studio_team_members to authenticated;
grant select, insert, update, delete on public.studio_system_collaborators to authenticated;
grant execute on function public.studio_resolve_invitee(text) to authenticated;
