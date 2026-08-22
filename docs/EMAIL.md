# Email

Two Zoho products, one audience, one opt-out list.

| | product | what it carries | code |
|---|---|---|---|
| **Product mail** | ZeptoMail | the welcome, and anything sent to one person because of something they just did | `scripts/lib/email.mjs` |
| **Broadcast** | Zoho Campaigns | newsletters and announcements | `scripts/lib/campaigns.mjs` |

They are deliberately separate. ZeptoMail is a **transactional-only relay** and sending
newsletters through it is grounds for the account being closed. It is also what keeps a
newsletter complaint from damaging the reputation of the pipe that carries a password
reset — the two have separate sending reputations, which is the entire point.

**Zoho Mail SMTP is no longer a bulk sender.** It is a mailbox. It has no per-campaign
reputation, no bounce processing, no complaint feedback loop, and a ceiling on the order
of a few hundred a day. It is kept configured only as a fallback so an unconfigured
laptop or a ZeptoMail outage still delivers a welcome.

---

## 1 · Who gets mailed

`public.email_audience` (`supabase/010_email_audience.sql`) is the only definition, and
every sender reads it through `scripts/lib/audience.mjs`. **Never rebuild that union by
hand in a script** — that is what the old `send-welcome-all.mjs` did, and it drifted.

It folds two origins into one row per inbox:

- `public.subscribers` — anybody who used a form on the site. Carries `source`, which is
  the provenance trail.
- `auth.users` — Studio account holders, **confirmed addresses only**. An unconfirmed
  signup has not proven it owns the inbox and mailing it is how you land in a spam trap.

The column that matters is `suppressed`. If it is true, nothing sends. Ever.

### The opt-out list

`public.email_suppressions` is keyed by **address**, not by membership of any list. That
is what makes it work for somebody who has no `subscribers` row at all.

This fixed a live bug. Before it existed, `/api/unsubscribe` ran
`PATCH /subscribers?email=eq.…`. A Studio account holder has no row there, so the patch
matched zero rows, PostgREST answered `204`, the page said "you are unsubscribed", and
the next send read them straight back out of `auth.users` and mailed them again.

Opt-outs arrive from three places and all three land in that one table:

| origin | written by |
|---|---|
| our footer link (`/api/unsubscribe`, HMAC-signed) | `netlify/functions/unsubscribe.mts` |
| Campaigns' own footer link | `scripts/sync-campaigns.mjs` (pull) |
| hard bounces reported by Campaigns | `scripts/sync-campaigns.mjs` (pull) |

---

## 2 · DNS

All records on **`naurra.ai`**. What is already live, and what has to be added.

### 2.1 · SPF — one record, edited, never a second one

A domain may publish **exactly one** SPF record. Two `v=spf1` TXT records is a permanent
failure, not a merge.

Currently live:

```
naurra.ai.  TXT  "v=spf1 include:zohomail.eu ~all"
```

Replace with:

```
naurra.ai.  TXT  "v=spf1 include:zohomail.eu include:zeptomail.net include:zcsend.net ~all"
```

- `zohomail.eu` — the mailbox, already there, keeps normal mail working
- `zeptomail.net` — ZeptoMail
- `zcsend.net` — Campaigns

These are the `.net`/`.eu` sending infrastructures and are **not** data-centre specific;
they are the same values for an EU account. SPF allows 10 DNS lookups and this uses **4**
(`zohomail.eu` costs 2, since it nests `spf.zohomail.eu`; the other two are flat IP
lists), so there is headroom.

Check after editing:

```sh
dig +short naurra.ai TXT | grep spf1
```

### 2.2 · DKIM — one selector per product

Both values are **generated in the respective console** and are unique to the account, so
they are not reproduced here. Copy each from its UI.

| host | from | note |
|---|---|---|
| `zmail._domainkey.naurra.ai` | Zoho Mail | **already live**, leave alone |
| `<selector>._domainkey.naurra.ai` | ZeptoMail → Domains → the domain | ZeptoMail offers to auto-generate the selector; take the 2048-bit option |
| `<selector>._domainkey.naurra.ai` | Campaigns → Settings → Domain Authentication | |

Each is a `TXT` record whose value begins `v=DKIM1; k=rsa; p=…`.

ZeptoMail also issues a **CNAME** alongside its DKIM record for domain verification —
add whatever it shows on the Domains screen; it is account-specific.

### 2.3 · DMARC — this does not exist yet and should

`_dmarc.naurra.ai` currently returns nothing, which means no policy, no reporting, and
no visibility into who else is sending as the domain.

Start in monitor mode. It changes nothing about delivery and turns on reports:

```
_dmarc.naurra.ai.  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@naurra.ai; fo=1; adkim=r; aspf=r"
```

Leave it at `p=none` for **at least two weeks** and read the aggregate reports first. Only
once ZeptoMail and Campaigns both show as passing should it move to `p=quarantine`, then
`p=none` → `p=quarantine` → `p=reject` in that order. Jumping straight to `p=reject`
before the new senders are aligned silently bins your own newsletter.

### 2.4 · Verify before trusting

```sh
dig +short naurra.ai TXT                      # exactly one v=spf1 line
dig +short _dmarc.naurra.ai TXT
dig +short zmail._domainkey.naurra.ai TXT     # existing Zoho Mail
```

Then send yourself one message through each path and read the raw headers. All three of
`spf=pass`, `dkim=pass`, `dmarc=pass` must be present, and the `dkim` line must name the
domain `naurra.ai` — a `dkim=pass` naming `zcsend.net` means Campaigns signed as itself
and DMARC alignment will fail.

---

## 3 · ZeptoMail setup

1. `zeptomail.zoho.eu` → add `naurra.ai` under **Domains**, add the DKIM and CNAME
   records it shows, wait for verified.
2. **Mail Agents** → create one, call it `totalfootball`. One agent per product line
   keeps the bounce stats and the revocable token separate.
3. Agent → **Setup Info** → copy the **Send Mail Token**.
4. Verify `totalfootball@naurra.ai` as a sender on that agent.
5. Put the token in `.env` and in the Netlify UI:

```
ZEPTOMAIL_TOKEN=<the send mail token>
ZEPTOMAIL_REGION=eu
```

Store the **raw** token. The code adds the `Zoho-enczapikey ` prefix the API requires.

> **Region matters.** naurra.ai is an EU Zoho account throughout — mailbox on
> `smtp.zoho.eu`, SPF `include:zohomail.eu`, verification via `zmverify.zoho.eu`. A token
> minted in the EU data centre is rejected by `api.zeptomail.com` with a `401` that reads
> exactly like a bad token and sends you looking in the wrong place.

Test:

```sh
node scripts/send-welcome.mjs --test you@example.com
```

---

## 4 · Campaigns setup

1. `campaigns.zoho.eu` → **Settings → Domain Authentication** → authenticate `naurra.ai`,
   add the DKIM record it gives you.
2. **Contacts → Lists** → create the audience list. Its key is in the URL; that is
   `ZOHO_CAMPAIGNS_LISTKEY`.
3. `api-console.zoho.eu` → **Self Client** → create. Note the client id and secret.
4. On the Self Client's **Generate Code** tab, request scope:

   ```
   ZohoCampaigns.contact.ALL,ZohoCampaigns.campaign.CREATE
   ```

   with a duration of 10 minutes, then exchange the resulting code for a refresh token:

   ```sh
   curl -X POST 'https://accounts.zoho.eu/oauth/v2/token' \
     -d 'grant_type=authorization_code' \
     -d 'client_id=…' -d 'client_secret=…' \
     -d 'code=<the code>'
   ```

   The `refresh_token` in the reply does not expire. Access tokens are derived from it in
   memory and never stored.

5. `.env` and the Netlify UI:

```
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_CAMPAIGNS_LISTKEY=
ZOHO_DC=eu
```

---

## 5 · Sending a newsletter

```sh
# 1. build, lint, and write the web copy. Nothing remote is touched.
node scripts/send-newsletter.mjs content/newsletters/2026-08-16.html

# 2. real inbox check, through ZeptoMail, list untouched
node scripts/send-newsletter.mjs content/newsletters/2026-08-16.html --test you@example.com

# 3. commit and deploy, so the web copy is live
git add public/newsletters && git commit && git push

# 4. reconcile both sides BEFORE sending
node scripts/sync-campaigns.mjs          # dry run — read this output
node scripts/sync-campaigns.mjs --run

# 5. create the draft
node scripts/send-newsletter.mjs content/newsletters/2026-08-16.html --campaign
```

Then **open Campaigns and press send there.** No script in this repo sends a broadcast.
A blast to the whole audience is not something a script should be able to do by itself
because of a typo.

### Why step 3 is not optional

Campaigns does not accept campaign HTML in the request body — it takes a **URL and
fetches it**. If that URL 404s, Campaigns creates the campaign with *empty content*
rather than reporting an error, which is a silent way to send a blank newsletter to
everybody. `send-newsletter.mjs --campaign` fetches the URL itself first and refuses to
proceed if it is not live or does not contain the unsubscribe tag.

### Why the campaign's unsubscribe link is not ours

Our link is an HMAC of the recipient's address. Campaigns does the per-recipient merging
when it broadcasts, and it cannot compute that HMAC. So the campaign copy carries
Campaigns' own `$[LI:UNSUBSCRIBE]$` merge tag instead, and `sync-campaigns.mjs` pulls the
resulting opt-outs back into `email_suppressions` so both halves honour them.

The `--test` path is different: that goes through ZeptoMail, where we do the merging, so
it carries the real signed link.

### Step 4 is a precondition, not a nicety

`sync-campaigns.mjs` runs in three phases, in this order and for this reason:

1. **Pull** Campaigns' unsubscribes and bounces down into `email_suppressions`. First,
   so that step 2 cannot push up an address it is about to learn has opted out.
2. **Push** new contacts up, carrying their `source`.
3. **Push** our suppressions up, unsubscribing them in Campaigns.

Skip phase 3 and somebody who used our footer link gets the next newsletter anyway.

---

## 6 · The list audit

Campaigns reviews imports, and an import of addresses with no recorded origin is the one
that gets held. Every contact is pushed with its `sources` value from `email_audience` —
`footer`, `course-early-access`, `studio-account` — and `subscribers.created_at` records
when. That is the answer if the question is ever asked.

Worth knowing: Studio account holders are on the newsletter list because that is the
policy chosen for this project, not because they ticked a newsletter box. Their welcome
mail says so in the footer, and every message carries an unsubscribe. If Campaigns ever
queries the list, that distinction is the thing they will ask about.

---

## 7 · Failure modes worth recognising

| symptom | cause |
|---|---|
| ZeptoMail `401`, token looks right | wrong data centre — `ZEPTOMAIL_REGION` |
| Zoho OAuth `invalid_client`, secret looks right | refresh token minted in a different DC than `ZOHO_DC` |
| Campaigns call returns HTTP `200` but nothing happened | Campaigns reports business errors as `200` with `status: "error"`; the client checks for this |
| Campaigns locks out for 30 minutes | contact-API rate limit; the sync paces at ~4/sec to stay under it |
| newsletter arrives blank | `content_url` 404'd at fetch time — deploy first |
| `dkim=pass` but `dmarc=fail` | signed by `zcsend.net`, not `naurra.ai`; domain authentication in Campaigns is incomplete |
| someone unsubscribes and still gets mail | `sync-campaigns.mjs --run` has not been run since |
| "Refusing to send N messages over the Zoho Mail SMTP fallback" | working as intended — set `ZEPTOMAIL_TOKEN` (§3) |

### The SMTP fallback has a hard cap, and why

On **2026-08-22 Zoho blocked outgoing mail on `athanasios@naurra.ai`** for
exceeding the allowed rate. The notice said, in Zoho's own words: *"If you're
sending transactional/notification emails like welcome emails, OTP emails,
account notification emails etc, please use ZeptoMail."*

A mailbox is not a sender. Exceeding its rate does not bounce one message — it
suspends outgoing mail on the whole account, taking normal correspondence down
with it. So `sendBatch()` refuses more than **20 messages per process run** over
the SMTP path, counted cumulatively because callers chunk their sends.

ZeptoMail is not capped by this; it is a bulk relay and that is its job. The cap
is a symptom-blocker, and the fix is always to configure the token.

### The sender is an alias

`totalfootball@naurra.ai` is an alias; the real mailbox is
`athanasios@naurra.ai`. That is the correct arrangement and nothing needs to
change:

- `EMAIL_FROM` is the **alias** — what recipients see.
- `ZOHO_SMTP_USER` is the **real mailbox** — it owns the app password, and it is
  the envelope sender.
- **ZeptoMail** authenticates the *domain*, not the mailbox, so once `naurra.ai`
  is verified any address on it can be a From — the alias needs no mailbox of
  its own.
- **Campaigns** verifies the From address by emailing it. That mail is delivered
  to the alias, which lands in the `athanasios@` inbox, so the confirmation link
  arrives normally.
