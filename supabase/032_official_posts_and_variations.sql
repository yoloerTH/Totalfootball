-- ─────────────────────────────────────────────────────────────────────────────
-- 032 · Official systems carry a thread, and a comment can carry a variation
--
-- WHAT THIS IS FOR
--
-- The ten systems in src/studio/templates.ts marked `official` are the ones that
-- went out as videos. Until now they were read-only documents at /o/<slug>/ with
-- nothing under them: a coach could open one, and had nowhere to say what they
-- would change about it.
--
-- ── WHY THEY BECOME POSTS RATHER THAN GETTING A TABLE OF THEIR OWN ───────────
--
-- Because every comment policy in 025 already reads:
--
--     exists (select 1 from studio_posts p where p.id = post and p.visibility = 'public')
--
-- A separate `official_comments` table would need its own policies, its own
-- delete rule, its own report path and its own moderation story, and all four
-- would be a second, worse copy of something already written and already
-- verified against real JWTs. An official system published as a public post gets
-- the thread, the reactions, the reports and the two-party delete for nothing,
-- and it lands in the feed — which for a network with two posts in it is the
-- difference between an empty room and a room worth posting into.
--
-- The rows are written by scripts/publish-official.mjs under the service role,
-- from content/systems/*.json. That script is the only writer.
--
-- ── WHY `official` IS A COLUMN AND NOT AN INFERENCE FROM THE OWNER ───────────
--
-- The obvious shortcut is "a post owned by the studio account is official". It
-- is wrong today, not in theory: that account is also somebody's working account
-- with a persona on it (@moriyashu), and it has ordinary posts on it already.
-- Owner is not the fact being asserted. The fact is "this is one of ours", the
-- card draws the Total Football mark instead of a coach's avatar because of it,
-- and a claim that visible belongs in a column that a trigger defends.
--
-- ── WHY A VARIATION IS A POST, NOT A BLOB ON THE COMMENT ─────────────────────
--
-- A coach who reworks one of ours has done real work. Stored as jsonb on the
-- comment it would have no page, no reactions and no credit on their profile —
-- it would exist only underneath us, which is exactly the relationship this
-- network is not supposed to have with the people in it. So the variation is
-- their own post, `forked_from` the official one (§5b was already specified this
-- way), and the comment points at it. Attribution runs both directions and the
-- fork count on our post is the honest measure of what the system provoked.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. OFFICIAL POSTS ────────────────────────────────────────────────────────

alter table public.studio_posts
  add column if not exists official boolean not null default false;

-- Partial: the whole point of the index is finding the ten among everything
-- else, and there is no query that wants the false rows.
create index if not exists studio_posts_official_idx
  on public.studio_posts (official, published_at desc)
  where official;

/*
 * Nobody holding a user JWT may set it, including on their own row.
 *
 * `studio_posts_own` in 025 lets an owner update their post, and without this
 * that is enough to award yourself the Total Football mark on the feed. The
 * service role reaches PostgREST with no `sub` claim, so `auth.uid()` is null
 * there and only the publish script can flip the flag.
 *
 * Phrased as "changed by a signed-in user" rather than "set to true", so that
 * clearing it is refused as well. A coach who could turn the flag OFF could
 * quietly detach one of our systems from the thread hanging under it.
 */
create or replace function public.studio_posts_guard_official()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.official and (select auth.uid()) is not null then
      raise exception 'official is set by the publish script, not by a client';
    end if;
  elsif new.official is distinct from old.official and (select auth.uid()) is not null then
    raise exception 'official cannot be changed from a client';
  end if;
  return new;
end;
$$;

drop trigger if exists studio_posts_official_guard on public.studio_posts;
create trigger studio_posts_official_guard
  before insert or update on public.studio_posts
  for each row execute function public.studio_posts_guard_official();

-- ── 2. THE IDENTITY GATE ─────────────────────────────────────────────────────

/*
 * A handle AND a name, before you may write under anybody's system.
 *
 * IN THE POLICY, NOT ONLY IN THE COMPOSER. A disabled button is a suggestion;
 * PostgREST is reachable with the anon key and a valid JWT from a terminal, and
 * the entire value of the rule is that the byline on a comment is a real coach
 * who can be recognised and answered. `presenter` is checked as well as
 * `handle`, because "@x7f2" standing alone is a handle and not a person.
 *
 * Deliberately NOT applied to reactions. A reaction is a tap with no text in
 * it, it cannot be abusive, and gating it would cost the ranking its cheapest
 * honest signal to buy nothing.
 */
create or replace function public.studio_has_identity(who uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
      from public.studio_profiles p
     where p.id = who
       and btrim(coalesce(p.handle, '')) <> ''
       and btrim(coalesce(p.presenter, '')) <> ''
  );
$$;

grant execute on function public.studio_has_identity(uuid) to anon, authenticated;

-- ── 3. VARIATIONS ────────────────────────────────────────────────────────────

alter table public.studio_comments
  add column if not exists variation text
    references public.studio_posts(id) on delete set null;

create index if not exists studio_comments_variation_idx
  on public.studio_comments (variation)
  where variation is not null;

/*
 * A variation must be the commenter's OWN public post.
 *
 * Three separate things are being refused here, and each one was representable
 * before this trigger existed:
 *
 *   · pointing at somebody else's post, which would put their work under our
 *     system with your name on the comment;
 *   · pointing at an unlisted or private post, which would render a thread
 *     entry that most readers then cannot open;
 *   · pointing at an official post, i.e. offering one of ours back to itself.
 *
 * A trigger rather than a check constraint because all three need to look at
 * another table, and a `with check` on the insert policy cannot be reused by the
 * update path without being written twice.
 */
create or replace function public.studio_comments_guard_variation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_visibility text;
  v_official boolean;
begin
  if new.variation is null then
    return new;
  end if;

  select p.owner, p.visibility, p.official
    into v_owner, v_visibility, v_official
    from public.studio_posts p
   where p.id = new.variation;

  if v_owner is null then
    raise exception 'that variation does not exist';
  end if;
  if v_owner <> new.owner then
    raise exception 'a variation must be your own post';
  end if;
  if v_visibility <> 'public' then
    raise exception 'a variation must be published publicly before it can be offered';
  end if;
  if v_official then
    raise exception 'an official system cannot be offered as a variation of one';
  end if;

  return new;
end;
$$;

drop trigger if exists studio_comments_variation_guard on public.studio_comments;
create trigger studio_comments_variation_guard
  before insert or update on public.studio_comments
  for each row execute function public.studio_comments_guard_variation();

-- ── 4. THE WRITE POLICY, REPLACED WITH THE GATE IN IT ────────────────────────

/*
 * 025's version, plus `studio_has_identity`. Everything else about it is
 * unchanged, and it is restated in full rather than patched because a policy
 * that exists in two halves in two files is a policy nobody can read.
 */
drop policy if exists studio_comments_write on public.studio_comments;
create policy studio_comments_write
  on public.studio_comments
  for insert
  to authenticated
  with check (
    (select auth.uid()) = owner
    and public.studio_has_identity(owner)
    and exists (select 1 from public.studio_posts p where p.id = post and p.visibility = 'public')
  );

-- ── 5. THE THREAD, READ ──────────────────────────────────────────────────────

/*
 * 025's `studio_post_comments`, returning the variation alongside each row.
 *
 * THE HANDLE IS NO LONGER HIDDEN FOR A PRIVATE PROFILE, and that is a deliberate
 * reversal of one line in 025 rather than an oversight. 025 §5 already held that
 * a comment names its author whatever their profile visibility is, and printed
 * `presenter` unconditionally for exactly that reason; the handle was still
 * being blanked, which under the new gate means demanding an @ from somebody and
 * then refusing to show it. Visibility governs the profile PAGE and the feed
 * byline. It does not govern a sentence you chose to write under somebody's
 * work.
 *
 * `avatar_path` stays gated. A name you typed is not a photograph of you.
 *
 * The variation's DOC IS NOT RETURNED. A thread with five variations in it would
 * be a megabyte of jsonb to draw five cards, and the card only needs a title and
 * a length until somebody scrolls it into view — at which point ./api.ts fetches
 * that one post the same way the feed does.
 */
/*
 * DROPPED FIRST, because `create or replace function` cannot change a return
 * type and both of these gain a column. Postgres answers "cannot change return
 * type of existing function" and the whole point of a numbered migration is
 * that it applies to a database that already has the old one in it.
 */
drop function if exists public.studio_post_comments(text);

create or replace function public.studio_post_comments(want_post text)
returns table (
  id                    uuid,
  body                  text,
  created_at            timestamptz,
  owner                 uuid,
  handle                text,
  presenter             text,
  avatar_path           text,
  variation             text,
  variation_title       text,
  variation_phases      integer,
  variation_reactions   integer
)
language sql
security definer
set search_path = ''
stable
as $$
  select c.id, c.body, c.created_at, c.owner,
         pr.handle,
         pr.presenter,
         case when pr.visibility in ('unlisted','public') then pr.avatar_path end,
         c.variation,
         v.title,
         coalesce(jsonb_array_length(v.doc -> 'acts'), 0),
         coalesce(v.reaction_count, 0)
    from public.studio_comments c
    left join public.studio_profiles pr on pr.id = c.owner
    left join public.studio_posts v
           on v.id = c.variation and v.visibility = 'public'
   where c.post = lower(btrim(want_post))
     and exists (
       select 1 from public.studio_posts p
        where p.id = c.post and p.visibility = 'public'
     )
   order by c.created_at asc
   limit 200;
$$;

grant execute on function public.studio_post_comments(text) to anon, authenticated;

-- ── 6. THE FEED, CARRYING THE FLAG ───────────────────────────────────────────

/*
 * 025's `studio_feed`, byte-for-byte, with two lines added: `official` on the
 * end of `returns table`, and `p.official` on the end of the select list.
 *
 * COPIED RATHER THAN REWRITTEN, and the first draft of this file is the reason
 * the note is here. Restating it from memory quietly changed four things — the
 * profile-visibility test widened from `= 'public'` to `in ('unlisted','public')`,
 * the limit ceiling moved from 60 to 100, `mine` became a correlated subquery
 * instead of the left join, and the `kinds` aggregate was rephrased. None of
 * them were intended and all four would have shipped. `create or replace` on a
 * function is a total rewrite; the only safe way to add a column to one is to
 * take the original and add the column.
 *
 * Appended rather than inserted mid-list: ../src/studio/social/api.ts reads rows
 * by key and does not care, but a `returns table` whose column ORDER changes is
 * a breaking change for anything that ever selects positionally.
 */
/*
 * DROPPED FIRST, because `create or replace function` cannot change a return
 * type and both of these gain a column. Postgres answers "cannot change return
 * type of existing function" and the whole point of a numbered migration is
 * that it applies to a database that already has the old one in it.
 */
drop function if exists public.studio_feed(text, integer, integer);

create or replace function public.studio_feed(
  want_mode   text default 'recent',
  want_limit  integer default 24,
  want_offset integer default 0
)
returns table (
  id             text,
  title          text,
  summary        text,
  media          text,
  cover_act      integer,
  doc            jsonb,
  published_at   timestamptz,
  reaction_count integer,
  comment_count  integer,
  repost_count   integer,
  fork_count     integer,
  -- `{"golazo": 12, "training_ground": 3}`, so the bar can show which of the
  -- five a post actually earned rather than one undifferentiated total. A
  -- correlated aggregate per row, which is the right trade at feed size: the
  -- index on `studio_reactions (post)` makes each one a handful of rows, and
  -- the alternative is five more counter columns and five more ways for a
  -- trigger to drift from the truth.
  kinds          jsonb,
  owner          uuid,
  handle         text,
  presenter      text,
  team           text,
  role           text,
  licence        text,
  avatar_path    text,
  crest_path     text,
  mine           text,
  official       boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, p.title, p.summary, p.media, p.cover_act, p.doc, p.published_at,
         p.reaction_count, p.comment_count, p.repost_count, p.fork_count,
         (select coalesce(jsonb_object_agg(k.kind, k.n), '{}'::jsonb)
            from (
              select x.kind, count(*) as n
                from public.studio_reactions x
               where x.post = p.id
               group by x.kind
            ) k),
         p.owner,
         -- The author's identity comes from the PROFILE and only when that
         -- profile is public. A coach who publishes a system while keeping
         -- their profile private is credited by whatever the document itself
         -- carries, which is their decision, made in the publish dialog.
         case when pr.visibility = 'public' then pr.handle end,
         case when pr.visibility = 'public' then pr.presenter end,
         case when pr.visibility = 'public' then pr.team end,
         case when pr.visibility = 'public' then pr.role end,
         case when pr.visibility = 'public' then pr.licence end,
         case when pr.visibility = 'public' then pr.avatar_path end,
         case when pr.visibility = 'public' then pr.crest_path end,
         r.kind,
         p.official
    from public.studio_posts p
    left join public.studio_profiles pr on pr.id = p.owner
    left join public.studio_reactions r on r.post = p.id and r.owner = (select auth.uid())
   where p.visibility = 'public'
   order by
     case when want_mode = 'featured'
       then (p.reaction_score + 2 * p.comment_count + 3 * p.repost_count + 1)
            / power(extract(epoch from (now() - p.published_at)) / 3600.0 + 4, 1.2)
     end desc nulls last,
     p.published_at desc
   limit least(greatest(want_limit, 1), 60)
  offset greatest(want_offset, 0);
$$;

grant execute on function public.studio_feed(text, integer, integer) to anon, authenticated;
