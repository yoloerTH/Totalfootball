-- Support for sending mail to the list.
--
-- `unsubscribed_at` has existed since 001 but nothing ever wrote to it: there
-- was no unsubscribe endpoint. netlify/functions/unsubscribe.mts is that
-- endpoint now, and scripts/send-newsletter.mjs is the first thing that reads
-- this column at scale, filtering `unsubscribed_at is null` on every send.
-- That query runs from a local script holding the SERVICE ROLE key, never
-- from anon, so no RLS or grant change is needed here — this is an index only.

create index if not exists subscribers_active_idx
  on public.subscribers (unsubscribed_at)
  where unsubscribed_at is null;
