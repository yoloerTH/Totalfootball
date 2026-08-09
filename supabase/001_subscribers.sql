-- Email capture for totalfootball.naurra.ai
--
-- Design notes:
--  · `source` is the whole point of the table. It records WHERE someone
--    subscribed (footer, popup, course-waitlist, library:<slug>) so we can
--    later tell which library pages actually convert.
--  · RLS is insert-only for the anon role. Nothing in the browser, and nothing
--    reachable from the public function, can read the list back.

create table if not exists public.subscribers (
  id           bigint generated always as identity primary key,
  email        text        not null,
  source       text        not null default 'unknown',
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  constraint subscribers_email_key unique (email),
  constraint subscribers_email_shape check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$')
);

create index if not exists subscribers_source_idx on public.subscribers (source);
create index if not exists subscribers_created_at_idx on public.subscribers (created_at desc);

alter table public.subscribers enable row level security;

-- Insert only. No select, no update, no delete for anon.
drop policy if exists subscribers_anon_insert on public.subscribers;
create policy subscribers_anon_insert
  on public.subscribers
  for insert
  to anon
  with check (true);

-- TWO LAYERS, BOTH REQUIRED.
--
-- A policy alone is not enough: PostgREST hit "permission denied for table
-- subscribers" (42501) until the table-level GRANT existed, because RLS filters
-- rows only after the role already has the privilege. This project does not
-- hand out Supabase's usual default privileges on public, so the grant has to
-- be explicit.
--
-- Grant INSERT and nothing else. The policy says anon may only insert; this
-- says anon *cannot even attempt* a select, update or delete. Belt and braces,
-- deliberately, because this table holds subscriber email addresses.
grant usage on schema public to anon;
grant insert on public.subscribers to anon;

revoke select, update, delete on public.subscribers from anon;

-- Consequence, and it is intentional: without SELECT, PostgREST cannot serve an
-- upsert (`?on_conflict=email` with `Prefer: resolution=ignore-duplicates`) --
-- it returns 42501. So the function does a plain insert and treats the unique
-- violation (HTTP 409) as success. Do not "fix" that by granting SELECT.
