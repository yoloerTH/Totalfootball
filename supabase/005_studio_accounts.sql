-- Accounts: a coach's profile, and the systems they own.
--
-- This is the first table in the project a BROWSER talks to directly. Every
-- other one (subscribers, site_events, studio_shares) is reached only through a
-- Netlify function holding the service-role key, which is why 001-004 revoke
-- everything from `authenticated` and grant nothing. That posture was right
-- while there was no user to attribute a row to; it cannot survive accounts,
-- because "only this coach may read this system" is a statement about the
-- caller's identity, and the function does not have one.
--
-- So from here the browser holds the ANON key, and RLS is the actual security
-- boundary rather than a second opinion. See docs/STUDIO.md §5 and the note in
-- .env.example. The service-role key stays server-side forever.
--
-- ── DESIGN NOTES ────────────────────────────────────────────────────────────
--
--  · `systems.doc` is the whole System document, the same JSON the editor keeps
--    in localStorage and the same shape studio_shares stores. One jsonb column,
--    for the reason given in 004: it is always read and written whole, it is
--    versioned as a unit, and its shape is owned by src/studio/schema.ts.
--
--  · THE PRIMARY KEY IS (owner, id), NOT id. `id` is minted client-side by
--    `newSystemId()` in src/studio/storage.ts, and has only ever promised to be
--    unique within one browser's localStorage. Making it globally unique would
--    turn one coach's id collision into another coach's failed insert; scoping
--    the key to the owner asks of the id exactly what the id already guarantees.
--    It also means a system keeps the SAME id locally and in the cloud, so the
--    write-through cache and the claim-on-sign-in path need no id remapping.
--
--  · `title` is GENERATED from the document rather than passed alongside it.
--    The portal lists and sorts by title, and a column the client sets
--    separately is a column that goes stale the first time someone renames a
--    system through a path that forgets to update it.

-- ── profiles ────────────────────────────────────────────────────────────────
--
-- What goes in the credit bar, so a coach signs their work once instead of on
-- every share. `System.credit` stays ON THE DOCUMENT (see schema.ts) — this is
-- where the share dialog's fields get their defaults from, not where they live.

create table if not exists public.studio_profiles (
  id          uuid        primary key references auth.users (id) on delete cascade,
  -- "Andreas Pangios". Shown on the left of every credit bar.
  presenter   text,
  -- "AEL Limassol U16".
  team        text,
  -- The team's kit colour, as the counter fill. `deep` and the label colour are
  -- derived at render time by darken() and readableText() in board/palette.ts,
  -- so storing them too would be storing the same fact three times.
  team_colour text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint studio_profiles_presenter_len check (presenter is null or length(presenter) <= 48),
  constraint studio_profiles_team_len      check (team is null or length(team) <= 48),
  -- A hex colour and nothing else: this value is written straight into an SVG
  -- fill, and the board is serialised into exported files.
  constraint studio_profiles_colour_shape  check (team_colour is null or team_colour ~ '^#[0-9A-Fa-f]{6}$')
);

-- ── systems ─────────────────────────────────────────────────────────────────

create table if not exists public.studio_systems (
  owner      uuid        not null references auth.users (id) on delete cascade,
  id         text        not null,
  doc        jsonb       not null,
  title      text        generated always as (nullif(btrim(doc ->> 'title'), '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner, id),
  constraint studio_systems_id_shape check (id ~ '^[A-Za-z0-9_-]{1,64}$')
  -- No size CHECK here on purpose. A guard against a runaway client would be
  -- nice, but the obvious spelling of it (`pg_column_size(doc) <= …`) is not an
  -- IMMUTABLE expression and Postgres rejects it in a constraint. A migration
  -- that will not apply is a worse problem than a missing guard; if this is
  -- ever needed, it belongs in a BEFORE trigger.
);

-- The portal's only query: this coach's systems, newest first. Covers the RLS
-- predicate and the sort in one index, which is why owner leads.
create index if not exists studio_systems_owner_updated_idx
  on public.studio_systems (owner, updated_at desc);

-- ── updated_at, kept honest ─────────────────────────────────────────────────
--
-- A trigger rather than a client-supplied value. The portal sorts on this, and
-- a clock the client controls is a sort order the client controls — a browser
-- with a wrong system time would pin its systems to the top of the list forever.

create or replace function public.studio_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists studio_systems_touch on public.studio_systems;
create trigger studio_systems_touch
  before update on public.studio_systems
  for each row execute function public.studio_touch_updated_at();

drop trigger if exists studio_profiles_touch on public.studio_profiles;
create trigger studio_profiles_touch
  before update on public.studio_profiles
  for each row execute function public.studio_touch_updated_at();

-- ── RLS: a coach sees their own rows and nothing else ───────────────────────
--
-- `(select auth.uid())` rather than a bare `auth.uid()` is deliberate and is
-- the documented Supabase pattern: the bare call is re-evaluated PER ROW, the
-- wrapped one is evaluated once and cached. It does not matter at ten systems
-- and matters a great deal at ten thousand.

alter table public.studio_profiles enable row level security;
alter table public.studio_systems  enable row level security;

-- Dropped first so this file can be re-run, like the `if not exists` on every
-- table above it. `create policy` has no IF NOT EXISTS to lean on.
drop policy if exists studio_profiles_own on public.studio_profiles;
create policy studio_profiles_own
  on public.studio_profiles
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists studio_systems_own on public.studio_systems;
create policy studio_systems_own
  on public.studio_systems
  for all
  to authenticated
  using ((select auth.uid()) = owner)
  with check ((select auth.uid()) = owner);

-- TWO LAYERS, BOTH REQUIRED — the same rule 001 and 002 spell out. RLS filters
-- rows only after the role already holds the privilege, and this project does
-- not hand out Supabase's default privileges on public, so the GRANT has to be
-- explicit or PostgREST answers 42501 with a policy sitting right there.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.studio_profiles to authenticated;
grant select, insert, update, delete on public.studio_systems  to authenticated;

-- Anon gets nothing. A signed-out visitor can use the studio — their work is in
-- their own localStorage and never comes here until they sign in.
revoke all on public.studio_profiles from anon;
revoke all on public.studio_systems  from anon;
