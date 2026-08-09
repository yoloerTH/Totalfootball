-- Names for the course early-access list.
--
-- Added to `subscribers` rather than a separate table on purpose: it is the
-- same list, and splitting it would mean two places to honour a deletion
-- request from. `source` already distinguishes who came from where, and
-- `course-early-access` is the tag that carries the locked price.
--
-- Nullable, because every other form on the site asks for an email only and
-- must keep working unchanged.

alter table public.subscribers
  add column if not exists name text;

alter table public.subscribers
  drop constraint if exists subscribers_name_len;
alter table public.subscribers
  add constraint subscribers_name_len check (name is null or char_length(name) <= 120);

-- The offer is "lock the price, limited positions", so the order people joined
-- in is part of the promise. `id` is an identity column and already gives a
-- stable, gapless-enough ordering; this index just makes counting the taken
-- spots cheap for the /api/spots endpoint.
create index if not exists subscribers_source_created_idx
  on public.subscribers (source, created_at);

-- anon still gets INSERT and nothing else. Re-stated because a new column does
-- not change privileges, and it is the thing that is easy to forget.
grant insert on public.subscribers to anon;
revoke select, update, delete on public.subscribers from anon;

/*
 * How many early-access places are taken.
 *
 * NOT surfaced on the site: a public counter reading "3 taken" undercuts a
 * limited-places offer rather than supporting it (user, 2026-08-09). It is used
 * by the daily Telegram report so the number is known privately, and it is here
 * ready if a public counter is ever wanted once the figure flatters the offer.
 *
 * SECURITY DEFINER returning a single integer, so it cannot leak an address, a
 * name or a date, and anon still has no SELECT on the table.
 */
create or replace function public.course_spots_taken()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.subscribers where source = 'course-early-access';
$$;

revoke all on function public.course_spots_taken() from public, anon;
grant execute on function public.course_spots_taken() to anon;
