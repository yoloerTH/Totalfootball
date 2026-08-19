-- What coaches think of the studio.
--
-- Design notes:
--
--  · TWO NUMBERS AND A SENTENCE. `rating` is how it is going, in half stars;
--    `recommend` is how likely they are to tell another coach, 0–10. They are
--    deliberately different instruments — a tool can be pleasant to use and
--    still not be something you would mention to anybody, and the gap between
--    the two is the interesting number. `note` is the only one that ever tells
--    you what to DO, so it is never required and never truncated in the UI.
--
--  · ANONYMOUS, ON PURPOSE. No owner column, no email, nothing joinable back to
--    an account, even though the coach filling this in is signed in and we
--    could. Feedback you can be identified by is feedback people soften, and a
--    softened 3 is worth less than an honest 1. The cost is real and is
--    accepted: a coach who reports something broken cannot be replied to. If
--    that becomes the thing we need, it is a nullable `contact text` column and
--    an optional field in the dialog, not a change to this design.
--
--  · `context` says what they had just done when they were asked — 'share' or
--    'video' today. A 2 from somebody who has just watched their first film
--    render is a different fact from a 2 from somebody who has just published a
--    link, and without it every rating is unattributable.
--
--  · INSERT ONLY FOR ANON, like 001. Nothing in the browser and nothing
--    reachable through the public function can read a single row back. This is
--    stricter than it looks: it means the feedback cannot be shown in the
--    product ("coaches rate this 4.6"), and that is fine — it is for us.

create table if not exists public.studio_feedback (
  id         bigint generated always as identity primary key,
  rating     numeric(2,1),
  recommend  smallint,
  note       text,
  context    text        not null default 'unknown',
  created_at timestamptz not null default now(),

  -- Half stars, and only half stars: 0, 0.5, 1 … 5.
  constraint studio_feedback_rating_range
    check (rating is null or (rating >= 0 and rating <= 5 and (rating * 2) = floor(rating * 2))),
  constraint studio_feedback_recommend_range
    check (recommend is null or (recommend >= 0 and recommend <= 10)),
  -- Long enough for a coach with something to say, short enough that the column
  -- cannot be used as free storage by anything that finds the endpoint.
  constraint studio_feedback_note_length check (note is null or char_length(note) <= 2000),
  constraint studio_feedback_context_length check (char_length(context) <= 64),

  -- A row that says nothing is not feedback. The endpoint checks this too; the
  -- constraint is what makes it true regardless of what the endpoint does next.
  constraint studio_feedback_not_empty
    check (rating is not null or recommend is not null or note is not null)
);

create index if not exists studio_feedback_created_at_idx
  on public.studio_feedback (created_at desc);
create index if not exists studio_feedback_context_idx
  on public.studio_feedback (context);

alter table public.studio_feedback enable row level security;

-- Insert only. No select, no update, no delete for anon.
drop policy if exists studio_feedback_anon_insert on public.studio_feedback;
create policy studio_feedback_anon_insert
  on public.studio_feedback
  for insert
  to anon
  with check (true);

-- Both layers, for the reason spelled out at length in 001: RLS filters rows
-- only after the role already holds the privilege, and this project does not
-- hand out Supabase's default privileges on public.
grant usage on schema public to anon;
grant insert on public.studio_feedback to anon;

revoke select, update, delete on public.studio_feedback from anon;
revoke all on public.studio_feedback from authenticated;
