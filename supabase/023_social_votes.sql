-- social_votes table

create table public.social_votes (
    id uuid primary key default gen_random_uuid(),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    subscriber_email text, -- Can be null or populated if we capture email from query params
    vote_option text not null
);

-- Enable RLS
alter table public.social_votes enable row level security;

-- Allow insert from anon/authenticated (if API inserts it using service key, we don't strictly need this, but good practice)
create policy "Allow insert for all" on public.social_votes for insert with check (true);
create policy "Allow select for admins" on public.social_votes for select using (auth.role() = 'authenticated'); -- adjust based on their auth setup
