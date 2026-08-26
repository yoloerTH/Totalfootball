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

> **The zone is on Netlify DNS** (`dns{1..4}.p04.nsone.net`, zone id
> `697cfaec404c6518f82020f9`). There is no `netlify dns` command; use
> `netlify api getDnsRecords` / `createDnsRecord` / `deleteDnsRecord`. The API has
> **no update** — changing a record means delete then create.

### 2.1 · SPF — DONE (2026-08-22, corrected 2026-08-27)

A domain may publish **exactly one** SPF record. Two `v=spf1` TXT records is a permanent
failure, not a merge — which is why the swap was done delete-then-create on a single
connection (1.0s gap) rather than as two CLI calls. A brief window with *no* SPF yields a
`none` result that nothing rejects on; a brief window with *two* yields `PermError`, which
hard-fails everywhere.

Was:

```
naurra.ai.  TXT  "v=spf1 include:zohomail.eu ~all"
```

Now live:

```
naurra.ai.  TXT  "v=spf1 include:zohomail.eu include:zeptomail.net include:eu.zcsend.net ~all"
```

Verified against `dns1.p04.nsone.net` and against 1.1.1.1 / 8.8.8.8: exactly one record.

- `zohomail.eu` — the mailbox, already there, keeps normal mail working
- `zeptomail.net` — ZeptoMail
- `eu.zcsend.net` — Campaigns

SPF allows 10 DNS lookups and this uses **4** (`zohomail.eu` costs 2, since it nests
`spf.zohomail.eu`; the other two are flat IP lists), so there is headroom.

#### These includes ARE data-centre specific

This section said the opposite until 2026-08-27, and it was wrong. `zcsend.net` and
`eu.zcsend.net` are disjoint networks, not aliases:

```sh
dig +short TXT zcsend.net      # ip4:135.84.81.0/24  136.143.160.0/24  165.173.128.0/24 …   US
dig +short TXT eu.zcsend.net   # ip4:31.186.226.160/27  185.20.211.0/25  91.103.152.0/24    EU
```

The record originally published `include:zcsend.net`, which authorises the **US** ranges
for an account that sends from the **EU** ones. Nothing reported this: Campaigns had never
sent, so there was no failing message to notice, and it would have surfaced as SPF failing
on the first real campaign to the whole list. Swapped to `include:eu.zcsend.net` on
2026-08-27, delete-then-create on one connection, matching only the `v=spf1` record so the
`zoho-verification=` TXT beside it survived.

**Take the value from the product's own console rather than from this file.** Campaigns →
Settings → Domain Authentication prints the include it expects for *this* account's data
centre, and that is the authority.

> Still unreconciled: `include:zeptomail.net` is the US range list too — EU is
> `eu.zeptomail.net`. It has not been changed because it is not what authenticates
> ZeptoMail today and changing it is not risk-free. ZeptoMail sets the Return-Path to
> `bounce-zem.naurra.ai`, which is a CNAME to `cluster89.zeptomail.eu`, so the SPF a
> receiver evaluates is that cluster's own `v=spf1 include:eu.zeptomail.net -all` and
> naurra.ai's apex record is never consulted for that mail. It is dead weight rather than
> a live fault. Fix it the next time this record is touched for another reason.

Check after editing:

```sh
dig +short naurra.ai TXT | grep spf1
```

### 2.2 · DKIM — one selector per product

Values are **generated in the respective console** and unique to the account, so the keys
are not reproduced here — only which host holds what.

| host | from | status |
|---|---|---|
| `zmail._domainkey.naurra.ai` | Zoho Mail | live since before this work — **leave alone** |
| `22225042._domainkey.naurra.ai` | ZeptoMail | **live 2026-08-23**, 1024-bit RSA |
| `bounce-zem.naurra.ai` (CNAME → `cluster89.zeptomail.eu`) | ZeptoMail bounce tracking | **live 2026-08-23** |
| `27035._domainkey.naurra.ai` | Campaigns | **live 2026-08-27**, 1024-bit RSA |

Note ZeptoMail's value begins `k=rsa; p=…` with **no `v=DKIM1;` prefix**, and so does
Campaigns'. That is what its
console issues and it is valid — the `v=` tag is optional when it is the first tag. Publish
exactly what the console shows; do not "helpfully" prepend `v=DKIM1;`.

**Validate a DKIM key before publishing it.** A mangled paste does not error anywhere: the
record publishes, resolves, and verifies at the DNS level, and then every signature fails
at the receiver — indistinguishable from propagation lag, and diagnosed hours later. Parse
the `p=` value as a real key first:

```js
createPublicKey({ key: `-----BEGIN PUBLIC KEY-----\n${p}\n-----END PUBLIC KEY-----\n`, format: 'pem' })
```

Check it reports `rsa` and a modulus of at least 1024 bits.

> ZeptoMail issued a **1024-bit** key here. Accepted everywhere and above Google's floor,
> but 2048 is the modern default. "Add DKIM key" on the Domains screen can add a stronger
> one later without disturbing this one — DKIM supports multiple selectors precisely so a
> key can be rotated with no gap.

### 2.3 · DMARC — DONE (2026-08-22)

`_dmarc.naurra.ai` returned nothing before this: no policy, no reporting, no visibility
into who else was sending as the domain. Now live:

```
_dmarc.naurra.ai.  TXT  "v=DMARC1; p=none; rua=mailto:athanasios@naurra.ai; adkim=r; aspf=r;"
```

Reconciled by `scripts/set-dmarc.mjs`. Run it with no flags to print the live record with
every tag decoded; `--apply` to write. It refuses to write an `rua` it has not verified as
authorised (see below), so it cannot leave you silently receiving nothing.

- `p=none` — **monitor only.** Changes nothing about delivery; it turns reporting on.
- `adkim=r` / `aspf=r` — relaxed alignment, which is what lets a subdomain
  (`totalfootball.naurra.ai`) and the alias sender align against the organisational domain.
- `pct` is gone. It only means anything once something is being enforced, and `pct=100`
  under `p=none` reads like a decision when it is the default.

**`ruf=` and `fo=1` were removed on 2026-08-26.** `rua` is the aggregate stream: one
gzipped XML summary per receiving provider per day, counts and IPs, no message content.
`ruf` is the forensic stream: one mail per *failing message*, carrying that message's
headers and usually its body. With `fo=1` — "report if ANY mechanism fails", not "if DMARC
fails" — a newsletter a subscriber auto-forwards still passes DMARC on DKIM, fails SPF at
the forwarder, and generates a forensic report anyway. Volume therefore tracked how often
mail was *forwarded*, which is unbounded and says nothing about whether anything is wrong,
and what arrived was copies of subscribers' own mail in a personal inbox. Google and
Microsoft decline to send `ruf` at all on privacy grounds, which is the only reason it
never buried the mailbox. It diagnoses nothing the aggregate reports do not.

#### Pointing `rua` off-domain — the doubled-label trap

An `rua` on the same domain as the policy needs no authorisation. An `rua` on **any other
domain** does, or a conforming receiver sends nothing (RFC 7489 §7.1). The receiver builds
the query from the **full domain of the report address**, not its registrable domain. For
`rua=mailto:x@dmarc.postmarkapp.com`:

```sh
dig +short TXT naurra.ai._report._dmarc.dmarc.postmarkapp.com   # → "v=DMARC1;"  ✓
dig +short TXT naurra.ai._report._dmarc.postmarkapp.com         # → "3kc6stb9…"  ✗ not a DMARC record
```

Both names resolve at Postmark. Only the first is the authorisation; the second is an
unrelated verification string. Checking the wrong one "passes", and you then wait weeks for
reports that were never authorised. There is no error in this failure mode — reports simply
never arrive. `scripts/set-dmarc.mjs` performs the correct check and refuses to write an
unauthorised `rua`; there is deliberately no `--force`.

**Do not tighten this yet.** Leave `p=none` for at least two weeks and read the aggregate
reports first. Only once ZeptoMail *and* Campaigns both show as passing should it move
`p=none` → `p=quarantine` → `p=reject`, in that order. Going straight to `p=reject` before
the new senders are DKIM-aligned silently bins your own newsletter.

The reports are the evidence that no *forgotten* sender exists — a form tool, an invoice
service, anything nobody remembers wiring up years ago. That is the only thing enforcement
can break, and the only way to find it is to read a few weeks of reports first.

```sh
node scripts/set-dmarc.mjs                                  # what is live now
node scripts/set-dmarc.mjs --apply --policy quarantine --pct 25
node scripts/set-dmarc.mjs --apply --policy quarantine      # then 100%
node scripts/set-dmarc.mjs --apply --policy reject          # finally
```

### 2.4 · Verify before trusting

```sh
dig +short naurra.ai TXT                         # exactly one v=spf1 line
dig +short _dmarc.naurra.ai TXT
dig +short zmail._domainkey.naurra.ai TXT        # Zoho Mail  (athanasios@, Campaigns)
dig +short 22225042._domainkey.naurra.ai TXT     # ZeptoMail  (transactional)
dig +short 27035._domainkey.naurra.ai TXT        # Campaigns  (broadcast)
dig +short bounce-zem.naurra.ai TXT              # ZeptoMail Return-Path, via CNAME
```

The ZeptoMail key is published as `k=rsa; p=…` with **no `v=DKIM1;` prefix** — that is how
ZeptoMail issues it. RFC 6376 §3.6.1 makes `v=` recommended-with-default rather than
required, so verifiers accept it and DKIM passes today. Leave it alone: adding the prefix
is cosmetic, and every safe way to change a live DKIM record is worse than the wart. A
replace opens a window with no key at all, keeping both records breaks verifiers that treat
a multi-record selector as undefined, and ZeptoMail may re-check the string it wrote and
mark the domain unverified.

`bounce-zem` is a CNAME to `cluster89.zeptomail.eu`, whose SPF is
`v=spf1 include:eu.zeptomail.net -all`. That is the Return-Path domain, so it is what SPF
actually authenticates; `aspf=r` is what aligns it back to `naurra.ai`.

Then send yourself one message through each path and read the raw headers. All three of
`spf=pass`, `dkim=pass`, `dmarc=pass` must be present, and the `dkim` line must name the
domain `naurra.ai` — a `dkim=pass` naming `zcsend.net` means Campaigns signed as itself
and DMARC alignment will fail.

---

## 3 · ZeptoMail setup — scripted

Neither ZeptoMail nor Campaigns ships a CLI, but both have full REST APIs, and
ZeptoMail's covers more than sending: domains, mail agents, and **minting the Send
Mail Token itself**. So this is one script, not a click-through.

`scripts/setup-zeptomail.mjs` adds the domain, reads back the DKIM and CNAME, **writes
them into Netlify DNS** (the zone is on Netlify — see §2), waits for the authoritative
nameserver, creates the `totalfootball` agent, and mints the token.

### The one manual step

Every call needs `Authorization: Zoho-oauthtoken …`, and minting the first refresh token
requires a human at a browser consent screen. **No API can issue the credential that
authorises API access** — that is what it is for. One browser visit bootstraps everything;
nothing after it is manual.

1. `api-console.zoho.eu` → **Self Client** → Create. Copy the Client ID and Secret into
   `.env` as `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET`.
2. **Generate Code** tab:

   ```
   scope:    ZeptoMail.Domains.ALL,ZeptoMail.MailAgents.ALL
   duration: 10 minutes
   ```

3. ```sh
   node scripts/setup-zeptomail.mjs --code <the code>
   ```

The code is single-use and expires in minutes; the refresh token it returns does not.

> **Both scopes must be on the same code.** ZeptoMail issues scope-limited tokens, and one
> granted only `MailAgents` is refused by the domains endpoints with a `401` that looks
> exactly like a bad token.

The script prints the two lines to add to `.env` and the Netlify UI:

```
ZEPTOMAIL_TOKEN=<minted>
ZEPTOMAIL_REGION=eu
```

Store the **raw** token — the sending code adds the `Zoho-enczapikey ` prefix itself. Note
that this is a *different* credential from the OAuth one: sending uses the send token,
management uses OAuth.

Re-running the script is free; it reports state and changes only what is wrong.
`--dns-only` re-reconciles the DNS records without touching agents or tokens.

### No mailbox needed for the alias

ZeptoMail authenticates the **domain**, not the mailbox, so once `naurra.ai` is verified,
`totalfootball@naurra.ai` works as a From address with no mailbox of its own.

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
   add the SPF include and DKIM record it gives you. **DONE 2026-08-27** — selector
   `27035`, and the SPF include corrected to the EU list (see §2.1). Campaigns refuses to
   let a campaign be sent from a DMARC-enabled domain until this passes, which is what the
   "Fix your sender domain errors!" banner on the Sender step means.
2. **Contacts → Lists** → create the audience list, and **set its opt-in type to
   SINGLE** (see 4.1 below — this is the step that bites).

   `ZOHO_CAMPAIGNS_LISTKEY` is **not** the number in the list's URL. That number is
   the internal record id and Campaigns rejects it. The list key is a 66-character
   string that the UI does not show; read it off the API instead:

   ```sh
   curl -s -H "Authorization: Zoho-oauthtoken $TOKEN" \
     'https://campaigns.zoho.eu/api/v1.1/getmailinglists?resfmt=JSON&sort=asc&fromindex=1&range=20' \
     | python3 -c 'import json,sys; [print(l["listname"], l["listkey"]) for l in json.load(sys.stdin)["list_of_details"]]'
   ```
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

### 4.1 · Opt-in type, and the 102 emails nobody asked for

**A list created in the UI is double opt-in by default. Change it to single before
you sync anything into it.**

On a double opt-in list, adding a contact does not add a contact. Campaigns emails
that address a "Confirm your subscription" message from `mail4.zcsignup.eu` and
parks them, unconfirmed and invisible, until they click. They are not in `active`,
not in `unsub`, not in `bounce`, and `noofcontacts` excludes them.

On 2026-08-27 the first real sync ran against a default list. It sent confirmation
emails to most of the 102-address audience, left the list holding one usable
contact, and would have produced a campaign that reached that one person while
reporting nothing wrong.

Three consequences worth holding on to:

- **The setting is not readable.** `getmailinglists` returns thirty fields and the
  opt-in type is not one of them. It cannot be checked, only tested.
- **Pending contacts are invisible to the sync's own bookkeeping.** `remoteKnown`
  is built from active + unsub + bounce, so a re-run re-adds every pending address
  and sends a *second* confirmation round.
- **Single opt-in is the correct setting here**, not a corner cut. Everyone in
  `email_audience` opted in on the site and carries a `source` provenance trail.
  Re-confirming an already-consented list loses most of it.

Two guards now enforce this and neither should be removed:

| guard | where | what it does |
|---|---|---|
| opt-in preflight | `sync-campaigns.mjs` | adds ONE address at our own sending domain, waits, and checks it went active. If not, aborts having sent exactly one confirmation email, to us. `--canary <email>` to choose it, `--preflight-only` to test the check alone. |
| reach check | `send-newsletter.mjs --campaign` | refuses to create a draft when fewer than 90% of the audience are active contacts. `--force-reach` overrides, deliberately. |

To fix a list that is already wrong: change the opt-in type in the UI, then re-run
`sync-campaigns.mjs --run`. Pending addresses convert to active on re-add.

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
