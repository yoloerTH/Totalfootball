-- Phase 3 of docs/SOCIAL.md: reactions, comments, reposts, and the feed that
-- ranks them.
--
-- Four new tables, three counters on `studio_posts`, and three functions that
-- are the only way any of it is read.
--
-- ── WHAT A REACTION IS FOR, BECAUSE IT DECIDES THE WHOLE SHAPE ───────────────
--
-- §0a: "every mechanic is judged against does this raise the quality of what
-- gets posted". A like is a shrug. The five kinds below are five different
-- sentences a coach might say about a system, and the one that matters most —
-- 'training_ground', I am using this on Tuesday — is the one no other network
-- has, because no other network is read by people who run sessions.
--
-- ONE REACTION PER PERSON PER POST, changeable. Not a count of taps. The
-- primary key is `(post, owner)` and that is the mechanic: a reaction is an
-- opinion, and a person has one opinion at a time.
--
-- ── AND WHY THE SCORE IS NOT A COUNT ────────────────────────────────────────
--
-- Weighted by what the act cost the person doing it: a reaction is a tap, a
-- comment is a paragraph, a repost is putting your own name behind it. 1, 2, 3.
-- 'training_ground' is worth two on its own, because a coach saying they will
-- run it is the strongest statement in the building.
--
-- SELF-ENGAGEMENT SCORES NOTHING. A coach may react to and comment on their own
-- post — it would be strange to forbid it — but the counter triggers skip the
-- owner, so none of it reaches the ranking. Otherwise the featured row is
-- whoever discovered they could tap their own post.
--
-- ── HOW TO APPLY ─────────────────────────────────────────────────────────────
--
--   npm run db:apply -- supabase/025_social_graph.sql --dry   # the `--` matters
--   npm run db:apply supabase/025_social_graph.sql
--
-- Idempotent throughout.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. How a post presents itself, and what it has collected ─────────────────

alter table public.studio_posts
  -- 'image' or 'video', chosen by the coach in the publish dialog.
  --
  -- "VIDEO" IS THE BOARD PLAYING, NOT A FILE. The document already contains
  -- every phase and the pace; ../src/studio/tween.ts turns that into motion in
  -- the browser, which is what the studio and the viewer both draw. Encoding an
  -- mp4 at publish time would cost a minute of the coach's life, megabytes of
  -- storage per post, and a second copy of the truth that goes stale the moment
  -- the tween engine improves. The mp4 exporter still exists and is still the
  -- right tool for Instagram; it is not the right tool for a feed.
  add column if not exists media text not null default 'image',

  -- Which phase the still shows. A system's best frame is rarely its first —
  -- phase 1 is usually eleven men standing in a shape, and the idea is at
  -- phase 4.
  add column if not exists cover_act integer not null default 0,

  -- Maintained by the triggers below. On the row rather than counted per read:
  -- the feed sorts on them, and a count(*) per card is the query that kills a
  -- feed at exactly the moment it starts working.
  add column if not exists reaction_count integer not null default 0,
  add column if not exists comment_count integer not null default 0,
  add column if not exists repost_count integer not null default 0,
  -- Reactions weighted by kind. Display uses `reaction_count`; ranking uses
  -- this. Two numbers because they answer two questions.
  add column if not exists reaction_score integer not null default 0;

alter table public.studio_posts drop constraint if exists studio_posts_media_known;
alter table public.studio_posts drop constraint if exists studio_posts_cover_act_sane;

alter table public.studio_posts
  add constraint studio_posts_media_known check (media in ('image','video')),
  add constraint studio_posts_cover_act_sane check (cover_act between 0 and 199);

-- ── 2. Reactions ─────────────────────────────────────────────────────────────

create table if not exists public.studio_reactions (
  post       text        not null references public.studio_posts(id) on delete cascade,
  owner      uuid        not null references auth.users(id) on delete cascade,
  kind       text        not null,
  created_at timestamptz not null default now(),
  primary key (post, owner)
);

alter table public.studio_reactions drop constraint if exists studio_reactions_kind_known;

alter table public.studio_reactions
  -- The five, and the ids are the contract with REACTIONS in
  -- src/studio/social/reactions.ts. Change one, change both.
  --
  --   golazo          ⚽  the thing itself is brilliant
  --   masterclass     🧠  the thinking behind it is
  --   clean_sheet     🧤  it holds up defensively
  --   killer_ball     🎯  one incisive idea in it
  --   training_ground 📋  I am running this
  add constraint studio_reactions_kind_known check (
    kind in ('golazo','masterclass','clean_sheet','killer_ball','training_ground')
  );

create index if not exists studio_reactions_post_idx on public.studio_reactions (post);
create index if not exists studio_reactions_owner_idx on public.studio_reactions (owner);

-- ── 3. Comments ──────────────────────────────────────────────────────────────

create table if not exists public.studio_comments (
  id         uuid        primary key default gen_random_uuid(),
  post       text        not null references public.studio_posts(id) on delete cascade,
  owner      uuid        not null references auth.users(id) on delete cascade,
  body       text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.studio_comments drop constraint if exists studio_comments_body_len;

alter table public.studio_comments
  -- A thousand characters. Long enough for a real tactical point, short enough
  -- that a comment is not an article — if somebody has an article, they have a
  -- system, and this product would rather have the system.
  add constraint studio_comments_body_len check (length(btrim(body)) between 1 and 1000);

create index if not exists studio_comments_post_idx
  on public.studio_comments (post, created_at);

drop trigger if exists studio_comments_touch on public.studio_comments;
create trigger studio_comments_touch
  before update on public.studio_comments
  for each row execute function public.studio_touch_updated_at();

-- ── 4. Reposts ───────────────────────────────────────────────────────────────

create table if not exists public.studio_reposts (
  post       text        not null references public.studio_posts(id) on delete cascade,
  owner      uuid        not null references auth.users(id) on delete cascade,
  -- The quote. Optional, and the reason a repost is not just a bigger reaction:
  -- "we used this against a back three and it needed one change" is worth more
  -- than the original post's own summary to the next reader.
  note       text,
  created_at timestamptz not null default now(),
  primary key (post, owner)
);

alter table public.studio_reposts drop constraint if exists studio_reposts_note_len;

alter table public.studio_reposts
  add constraint studio_reposts_note_len check (note is null or length(note) <= 280);

create index if not exists studio_reposts_owner_idx
  on public.studio_reposts (owner, created_at desc);

-- ── 5. Reports ───────────────────────────────────────────────────────────────
--
-- §7 lists a report button, a takedown path and an admin view as the things
-- that must exist before public user content does. Comments are public user
-- content, so the table lands in the same migration that creates them.
--
-- NOBODY CAN READ IT BUT THE SERVICE ROLE. A report names a person and accuses
-- them; a readable reports table is a harassment surface of its own. Insert
-- only, own row, no select policy at all — the same shape `studio_shares` uses
-- and for a stricter reason.

create table if not exists public.studio_reports (
  id         uuid        primary key default gen_random_uuid(),
  kind       text        not null,
  target     text        not null,
  reporter   uuid        not null references auth.users(id) on delete cascade,
  reason     text        not null,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.studio_reports drop constraint if exists studio_reports_kind_known;
alter table public.studio_reports drop constraint if exists studio_reports_reason_known;
alter table public.studio_reports drop constraint if exists studio_reports_note_len;

alter table public.studio_reports
  add constraint studio_reports_kind_known check (kind in ('post','comment')),
  add constraint studio_reports_reason_known check (
    reason in ('not_football','abusive','stolen','private_person','spam','other')
  ),
  add constraint studio_reports_note_len check (note is null or length(note) <= 1000);

create index if not exists studio_reports_open_idx
  on public.studio_reports (created_at desc);

-- ── 6. The counters, kept by the database ────────────────────────────────────
--
-- Triggers rather than client writes, for the reason 005 gives about
-- `updated_at`: a number the browser maintains is a number the browser can lie
-- about, and this one decides what is on the front page.

create or replace function public.studio_reaction_weight(kind text)
returns integer
language sql
immutable
as $$
  select case when kind = 'training_ground' then 2 else 1 end;
$$;

create or replace function public.studio_reactions_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_owner uuid;
begin
  -- Self-engagement is allowed and counts for nothing. See the header.
  if tg_op in ('INSERT','UPDATE') then
    select p.owner into post_owner from public.studio_posts p where p.id = new.post;
    if post_owner is distinct from new.owner then
      if tg_op = 'INSERT' then
        update public.studio_posts
           set reaction_count = reaction_count + 1,
               reaction_score = reaction_score + public.studio_reaction_weight(new.kind)
         where id = new.post;
      else
        update public.studio_posts
           set reaction_score = reaction_score
                              - public.studio_reaction_weight(old.kind)
                              + public.studio_reaction_weight(new.kind)
         where id = new.post;
      end if;
    end if;
    return new;
  end if;

  select p.owner into post_owner from public.studio_posts p where p.id = old.post;
  if post_owner is distinct from old.owner then
    update public.studio_posts
       set reaction_count = greatest(reaction_count - 1, 0),
           reaction_score = greatest(reaction_score - public.studio_reaction_weight(old.kind), 0)
     where id = old.post;
  end if;
  return old;
end;
$$;

drop trigger if exists studio_reactions_counted on public.studio_reactions;
create trigger studio_reactions_counted
  after insert or update or delete on public.studio_reactions
  for each row execute function public.studio_reactions_count();

create or replace function public.studio_comments_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_owner uuid;
  target     text;
  actor      uuid;
begin
  target := coalesce(new.post, old.post);
  actor  := coalesce(new.owner, old.owner);
  select p.owner into post_owner from public.studio_posts p where p.id = target;

  if tg_op = 'INSERT' then
    update public.studio_posts
       set comment_count = comment_count + 1
     where id = target;
    return new;
  end if;

  update public.studio_posts
     set comment_count = greatest(comment_count - 1, 0)
   where id = target;
  return old;
end;
$$;

drop trigger if exists studio_comments_counted on public.studio_comments;
create trigger studio_comments_counted
  after insert or delete on public.studio_comments
  for each row execute function public.studio_comments_count();

create or replace function public.studio_reposts_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.studio_posts set repost_count = repost_count + 1 where id = new.post;
    return new;
  end if;
  update public.studio_posts
     set repost_count = greatest(repost_count - 1, 0)
   where id = old.post;
  return old;
end;
$$;

drop trigger if exists studio_reposts_counted on public.studio_reposts;
create trigger studio_reposts_counted
  after insert or delete on public.studio_reposts
  for each row execute function public.studio_reposts_count();

-- A coach cannot repost their own post. Nothing is gained by it and the feed
-- would carry the same board twice under the same name.
create or replace function public.studio_reposts_not_own()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_owner uuid;
begin
  select p.owner into post_owner from public.studio_posts p where p.id = new.post;
  if post_owner = new.owner then
    raise exception 'a coach cannot repost their own system';
  end if;
  return new;
end;
$$;

drop trigger if exists studio_reposts_guard on public.studio_reposts;
create trigger studio_reposts_guard
  before insert on public.studio_reposts
  for each row execute function public.studio_reposts_not_own();

-- ── 7. Who may do what ───────────────────────────────────────────────────────

alter table public.studio_reactions enable row level security;
alter table public.studio_comments  enable row level security;
alter table public.studio_reposts   enable row level security;
alter table public.studio_reports   enable row level security;

-- REACTIONS. A coach writes only their own row, and may only put it on a post
-- that is actually readable — the subquery is not decoration: without it, a
-- script could react to an unlisted post whose id it guessed, and the counter
-- would be the tell.
drop policy if exists studio_reactions_own on public.studio_reactions;
create policy studio_reactions_own
  on public.studio_reactions
  for all
  to authenticated
  using ((select auth.uid()) = owner)
  with check (
    (select auth.uid()) = owner
    and exists (select 1 from public.studio_posts p where p.id = post and p.visibility = 'public')
  );

-- Reading them is public, because the counts on a card are public. The rows
-- themselves are how a signed-in coach sees their own reaction highlighted.
drop policy if exists studio_reactions_read on public.studio_reactions;
create policy studio_reactions_read
  on public.studio_reactions
  for select
  to anon, authenticated
  using (exists (select 1 from public.studio_posts p where p.id = post and p.visibility = 'public'));

-- COMMENTS. Same rule for writing. Deleting is the author's OR the post
-- owner's: a coach who published a system is responsible for what is written
-- under it and must be able to remove something without waiting for us.
drop policy if exists studio_comments_write on public.studio_comments;
create policy studio_comments_write
  on public.studio_comments
  for insert
  to authenticated
  with check (
    (select auth.uid()) = owner
    and exists (select 1 from public.studio_posts p where p.id = post and p.visibility = 'public')
  );

drop policy if exists studio_comments_edit on public.studio_comments;
create policy studio_comments_edit
  on public.studio_comments
  for update
  to authenticated
  using ((select auth.uid()) = owner)
  with check ((select auth.uid()) = owner);

drop policy if exists studio_comments_remove on public.studio_comments;
create policy studio_comments_remove
  on public.studio_comments
  for delete
  to authenticated
  using (
    (select auth.uid()) = owner
    or exists (
      select 1 from public.studio_posts p
       where p.id = post and p.owner = (select auth.uid())
    )
  );

drop policy if exists studio_comments_read on public.studio_comments;
create policy studio_comments_read
  on public.studio_comments
  for select
  to anon, authenticated
  using (exists (select 1 from public.studio_posts p where p.id = post and p.visibility = 'public'));

-- REPOSTS.
drop policy if exists studio_reposts_own on public.studio_reposts;
create policy studio_reposts_own
  on public.studio_reposts
  for all
  to authenticated
  using ((select auth.uid()) = owner)
  with check (
    (select auth.uid()) = owner
    and exists (select 1 from public.studio_posts p where p.id = post and p.visibility = 'public')
  );

drop policy if exists studio_reposts_read on public.studio_reposts;
create policy studio_reposts_read
  on public.studio_reposts
  for select
  to anon, authenticated
  using (exists (select 1 from public.studio_posts p where p.id = post and p.visibility = 'public'));

-- REPORTS. Insert your own, and that is the entire surface. No select policy
-- for anybody: see §5.
drop policy if exists studio_reports_file on public.studio_reports;
create policy studio_reports_file
  on public.studio_reports
  for insert
  to authenticated
  with check ((select auth.uid()) = reporter);

grant usage on schema public to anon, authenticated;
grant select on public.studio_reactions, public.studio_comments, public.studio_reposts to anon;
grant select, insert, update, delete on public.studio_reactions to authenticated;
grant select, insert, update, delete on public.studio_comments to authenticated;
grant select, insert, update, delete on public.studio_reposts to authenticated;
grant insert on public.studio_reports to authenticated;
revoke all on public.studio_reports from anon;

-- ── 8. The feed ──────────────────────────────────────────────────────────────
--
-- ── WHY FEATURED IS ARITHMETIC AND NOT AN EDITOR'S SHELF ─────────────────────
--
-- Because the alternative is us deciding whose work is good, every day, forever
-- — and the day we miss is the day a coach concludes the shelf is for friends
-- of the house. The formula is the same one that has held up on link
-- aggregators for twenty years: what it has earned, over how long it has had.
--
--   score = (reaction_score + 2·comments + 3·reposts + 1) / (hours + 2)^1.5
--
-- The +1 is what stops a brand-new post being invisible: everything starts with
-- a point, so the newest posts sit near the top of Featured for a few hours on
-- their own merit and then fall unless somebody reacts. The +2 hours stops a
-- post that is nine minutes old dividing by nearly nothing and pinning itself
-- there.
--
-- FEATURED IS NEVER EMPTY, and that is a requirement rather than a nicety (§7:
-- a feed with nothing in it is dead). Every public post has a score above zero,
-- so with three posts on the whole network Featured shows three posts. It
-- becomes a real ranking when there is something to rank, and it never shows a
-- coach an empty room in the meantime.
--
-- IT RETURNS THE CALLER'S OWN REACTION with each row. `auth.uid()` is the JWT's
-- claim and works inside a security-definer function, so one round trip fills
-- the whole card — the alternative is a second query per post, which is the
-- N+1 that makes a feed feel broken on a phone.

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
  owner          uuid,
  handle         text,
  presenter      text,
  team           text,
  role           text,
  licence        text,
  avatar_path    text,
  crest_path     text,
  mine           text
)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, p.title, p.summary, p.media, p.cover_act, p.doc, p.published_at,
         p.reaction_count, p.comment_count, p.repost_count, p.fork_count,
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
         r.kind
    from public.studio_posts p
    left join public.studio_profiles pr on pr.id = p.owner
    left join public.studio_reactions r on r.post = p.id and r.owner = (select auth.uid())
   where p.visibility = 'public'
   order by
     case when want_mode = 'featured'
       then (p.reaction_score + 2 * p.comment_count + 3 * p.repost_count + 1)
            / power(extract(epoch from (now() - p.published_at)) / 3600.0 + 2, 1.5)
     end desc nulls last,
     p.published_at desc
   limit least(greatest(want_limit, 1), 60)
  offset greatest(want_offset, 0);
$$;

grant execute on function public.studio_feed(text, integer, integer) to anon, authenticated;

-- Everything one coach has published, for their profile page. Public posts
-- only, whoever is asking — a coach's own shelf is the portal, not this.
create or replace function public.studio_posts_by_handle(
  want       text,
  want_limit integer default 24
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
  owner          uuid,
  mine           text
)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, p.title, p.summary, p.media, p.cover_act, p.doc, p.published_at,
         p.reaction_count, p.comment_count, p.repost_count, p.fork_count,
         p.owner, r.kind
    from public.studio_posts p
    join public.studio_profiles pr on pr.id = p.owner
    left join public.studio_reactions r on r.post = p.id and r.owner = (select auth.uid())
   where pr.handle = lower(btrim(want))
     -- The PROFILE may be unlisted — that is what a link-only coach is — but
     -- the POSTS on it are only ever the public ones. Two different questions,
     -- and answering the first with the second is how an unlisted post ends up
     -- on a page somebody sent to a group chat.
     and pr.visibility in ('unlisted','public')
     and p.visibility = 'public'
   order by p.published_at desc
   limit least(greatest(want_limit, 1), 60);
$$;

grant execute on function public.studio_posts_by_handle(text, integer) to anon, authenticated;

-- Comments on one post, with enough of each author to draw a name and a face.
--
-- IT RETURNS THE COMMENTER'S NAME WHATEVER THEIR PROFILE VISIBILITY IS, unlike
-- the feed above, and the difference is deliberate: the feed is showing you
-- somebody who published a system, while this is showing you somebody who
-- walked up and said something in public. Writing a comment IS appearing in
-- public, the composer says so, and an anonymous comment column is the single
-- fastest way to turn a coaching network into a sewer. `handle` still only
-- comes through when the profile is reachable, so the name is not a link to a
-- page that does not exist.
create or replace function public.studio_post_comments(want_post text)
returns table (
  id          uuid,
  body        text,
  created_at  timestamptz,
  owner       uuid,
  handle      text,
  presenter   text,
  avatar_path text
)
language sql
security definer
set search_path = ''
stable
as $$
  select c.id, c.body, c.created_at, c.owner,
         case when pr.visibility in ('unlisted','public') then pr.handle end,
         pr.presenter,
         case when pr.visibility in ('unlisted','public') then pr.avatar_path end
    from public.studio_comments c
    left join public.studio_profiles pr on pr.id = c.owner
   where c.post = lower(btrim(want_post))
     and exists (
       select 1 from public.studio_posts p
        where p.id = c.post and p.visibility = 'public'
     )
   order by c.created_at asc
   limit 200;
$$;

grant execute on function public.studio_post_comments(text) to anon, authenticated;
