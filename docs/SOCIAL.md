# The Network — build plan and handoff

**Status: Phase 1 built, extended and shipped.** Migrations `012` and `013` are
live on the database (both 2026-08-27) and the code is on `main`. Every table
added here defaults to private and every feature is opt-in. A coach who never
opens the new settings sections sees the studio exactly as it was.

This document is the spine. It is written so that a new session can read §0–§3,
open the phase it is on, and carry on without re-deriving anything.

---

## 0. What this is, in one paragraph

A place where a coach, analyst or player can publish a system they built in the
studio, keep a profile that says who they are, and find work by other people who
do the job. It is **a portfolio with a discovery feed attached**, not a timeline.
The unit of content is a System document — the same jsonb the studio already
stores — so nothing new has to be authored for the network to have something to
show.

## 0a. The strategic read (decided 2026-08-27)

- **The systems most valuable to build are the ones least likely to be posted.**
  A first-team coach will not publish next week's pressing trigger. That is fine
  and it is not a problem to be solved: it decides the audience. Build for
  **analysts, academy and youth coaches, educators and aspiring coaches building
  a portfolio**, and let working pros post retrospective and teaching material at
  whatever rate they are comfortable with.
- **Therefore: portfolio, not timeline.** Fewer posts, higher craft, reputational
  payoff. Every mechanic is judged against "does this raise the quality of what
  gets posted?" and cadence mechanics fail that test (see §5c).
- **Private is the default and stays the default.** Publishing is a separate,
  deliberate act with its own dialog. The existing studio is untouched.

---

## 1. Decisions locked (do not relitigate without reason)

1. **`visibility` defaults to `'private'` on every table that has it.** Existing
   rows are backfilled private. This is the whole promise of the feature.
2. **A post is a NEW table, not a grown `studio_shares`.** `studio_shares` is
   anonymous by design, has no owner, and is reachable only through a
   service-role function. Retrofitting privacy semantics onto a table that has
   none would make both jobs worse. The two coexist: a share is a link you send,
   a post is a thing you publish. See §3c.
3. **Verified means identity confirmed, never activity.** A club email domain, a
   coaching licence, a club staff page, or manual review. It is the credibility
   moat and selling it for invites would destroy it. See §5c.
4. **Streak mechanics are rejected.** "Post seven days running" buys retention
   with feed quality and this product cannot afford that trade. Achievements
   reward craft and reach instead, and are computed from the document. See §5c.
5. **Fork is a first-class feature, not a nice-to-have.** It is the loop that
   makes this a network rather than a gallery, and the document is already
   portable. See §5b.
6. **Derived colours stay derived.** `deep` and label text are computed by
   `darken()` and `readableText()` at render time. Storing them would store the
   same fact three times, which is the rule `supabase/005` already set.
7. **The site is `output: 'static'`.** Phases 1 and 5 need no adapter. **Phase 2
   is where the Netlify adapter and on-demand rendering land**, because a public
   post must be server-rendered, indexable and carry a real OG image. Do not
   change the output mode before then.

---

## 2. The phases

| # | Name | Ships | Adapter needed | Status |
|---|------|-------|----------------|--------|
| 1 | **Identity** | Profile model, handle, bio, role, crest, kit editor, privacy | no | **shipped, 012 applied** |
| 1b | **Squad & kit** | Profile picture, kit patterns, squad roster, player photos on the board | no | **shipped, 013 applied** |
| 2 | **Publish** | `studio_posts`, publish dialog, public post page, OG image, carousel export | **yes** | not started |
| 3 | **Network** | Feed, follow, save, **fork** | yes | not started |
| 4 | **Distribution** | Web Share on mobile, post packs on desktop, intent links | no | not started |
| 5 | **Recognition** | Verification, achievements, referrals | no | not started |

Phases 1 and 2 alone give a working "professional portfolio for football
systems". Phase 3 is what makes it a network. Do not start a phase before the
one before it is checked in and working locally.

---

## 3. The data model, whole picture

Written out in full here so that no later phase has to retrofit a column onto a
table that shipped without it. **Only the Phase 1 tables exist today.**

### 3a. `studio_profiles` — extended in Phase 1 (`supabase/012`)

Already had: `id` (= `auth.users.id`), `presenter`, `team`, `team_colour`.

Added by 012:

| column | why |
|---|---|
| `handle` | The public URL, `/c/<handle>`. Lowercase, unique, reserved words blocked. Null until claimed. |
| `bio` | 280 chars. Who they are and what they work on. |
| `role` | `coach` / `analyst` / `player` / `scout` / `educator` / `other`. |
| `crest_path` | Object path in the `crests` bucket, not a URL. URLs change with the project ref. |
| `kit_ring` | Optional trim colour. `Token.tsx` already renders `style.ring`. |
| `opponent_colour` | The away counter fill, so a coach's boards are consistent. |
| `visibility` | `private` (default) or `public`. |
| `links` | jsonb array of `{label, url}`. Capped at 5 by CHECK. |

**A public read policy is added for `anon`, filtered on `visibility = 'public'`
AND `handle is not null`.** Nothing on this table is a secret: email lives in
`auth.users`, not here. Keep it that way. Never add a private field to this
table without re-reading that policy.

### 3b. `crests` storage bucket — Phase 1

Public read, owner-only write, path `{uid}/crest.<ext>`. Size and mime capped at
the bucket. This is the first bucket in the project and it closes
`docs/STUDIO.md` §4.1.

### 3c. `studio_posts` — Phase 2

`id` (short public id, same Crockford alphabet as `studio_shares`), `owner`,
`doc` jsonb (a **snapshot**, not a reference — editing a system must not silently
rewrite a published post), `title`/`summary` generated from the doc,
`visibility`, `forked_from` (nullable, self-reference), `published_at`,
counters. Public SELECT for `anon` on `visibility = 'public'`.

### 3d. Phase 3 tables

`studio_follows` (follower, followee), `studio_saves` (owner, post). Both trivial
join tables with own-row RLS and a public aggregate count.

### 3e. Phase 5 tables

`studio_referrals` (code, inviter, invitee, qualified_at) and
`studio_achievements` (owner, badge, awarded_at, evidence jsonb). See §5c.

---

## 4. Phase 1 — Identity

**Files.**

- `supabase/012_studio_identity.sql` — the migration. Idempotent, re-runnable.
- `src/studio/account/identity.ts` — the RULES: handle shape, reserved list,
  roles, visibility. Shared by the settings UI and, later, the public page. No
  I/O in this file.
- `src/studio/account/images.ts` — upload, downscale and remove, against both
  buckets. (Was `crest.ts` until 1b generalised it.)
- `src/studio/account/cloud.ts` — `Profile` extended, `withProfile` now carries
  the kit.
- `src/studio/account/Settings.tsx` — rebuilt in sections, plus the share panel.
- `src/studio/account/KitEditor.tsx` — the kit, with a live token preview.
- `src/studio/account/PublicProfile.tsx` — the page a visitor sees.
- `src/pages/c/index.astro` — the static shell every handle is rewritten onto.
- `netlify.toml` — the `/c/*` rewrite, beside the `/s/*` one it copies.

**What a coach can do when it is done:** claim a handle, write a bio, say what
they do, upload a club crest, set a home and away kit that every new system
starts in, choose whether any of it is visible to anyone, and — once it is
public — copy or share the link to it. Default: none of it is visible.

**The public profile page, and the share link** (added 2026-08-27, after the
first cut of this plan said it would wait for Phase 2).

`/c/<handle>` is served by a Netlify **200-rewrite onto one static page**,
`src/pages/c/index.astro`, exactly the way `/s/<id>` already serves the shared
viewer. `PublicProfile.tsx` reads the handle off `location.pathname` and fetches
the row on the anon key, through the public policy in `012`. No adapter, so
decision 7 stands.

`handleFromPath` also accepts `?h=<handle>`, because the rewrite is applied by
`netlify dev` on :8888 and NOT by plain `astro dev` on :4321. Same affordance
`templateIdFromUrl` keeps for `?t=`. Nothing links to it.

The share panel in settings reads the **saved** profile, never the draft: a
handle that has not been written yet resolves to nothing, and handing a coach a
404 is the exact failure this feature exists to prevent. It offers copy,
`navigator.share` where it exists, and an open-in-new-tab.

**What this still is NOT, until Phase 2:** server-rendered. So there is no OG
preview card and the page is `noindex`. The route, the query, the empty state
and the layout all survive that upgrade — only where the fetch happens changes.

---

## 4b. Phase 1b — the squad, the kit and the coach's face

Not in the original plan. It came from a coach asking whether the board could
show player names and pictures, and the answer turned out to be "the names, for
two years already; the pictures, no". Migration `supabase/013_studio_squad.sql`.

**Renamed.** The page is **Personal settings** now, in its heading, its browser
title and the portal nav.

**Removed.** The away-kit swatch. A coach owns one kit; the opposition is whoever
they are playing this week, and a setting that must be changed before every
session is wrong most of the time. `opponent_colour` is still on the table and is
**dormant** — nothing reads it, nothing writes it, and no row ever held a value
because 012's code never shipped. `withProfile` no longer repaints `teams.them`.

**Added.**

| thing | where | note |
|---|---|---|
| `avatar_path` | `studio_profiles` | The coach's face. Shares the public `crests` bucket as `{uid}/avatar.<ext>` — the owner-folder write policy already covered it, so only a CHECK was new. |
| `kit_pattern`, `kit_alt` | `studio_profiles` | `solid`/`stripes`/`hoops`/`halves`/`sash`, drawn by `Token.tsx` as clipped bands over the dome. Pure SVG, so the video exporter needed no change. |
| `studio_squad` | new table | Own-row RLS, **no anon grant**, capped at 40 by a trigger. |
| `players` | new bucket | **Private.** Owner-only read, signed URLs, 1 hour. |
| `Token.photo` | the document | A storage PATH, resolved to a URL at draw time. |

### The three decisions worth not relitigating

1. **The squad is NOT on `studio_profiles`.** That table has a public anon SELECT
   policy and 012 says in its own header that a private per-user field must never
   go there. A squad is names and faces of players who are very often children.
   New table, own-row policy, no `anon` grant — verified after applying.

2. **Player photos are in a PRIVATE bucket, and that has a visible consequence.**
   `crests` is world-readable and its read policy has no path predicate, so it is
   *listable* — fine for club badges, indefensible for a U16 side. So `players`
   is closed. **Share a board and the recipient sees the names and no faces**,
   because the policy will not sign a path they do not own. That is the intended
   behaviour, not a gap. Publishing a player's face is a Phase 2 question with
   its own consent step; it must never happen as a side effect of sharing a link.

3. **Picking a player COPIES; it does not link.** Name, number and photo path are
   written onto the token. Nothing follows the link back. Same rule as
   `withProfile` and as §3c's snapshot: a board is a record of a session that
   happened, and it keeps the names it was drawn with. If it held player ids,
   deleting a player who left in January would blank a counter in every session
   run last autumn.

### Two traps paid for, both in `videoRender.ts`

- **Photos must be inlined before the first frame.** A canvas will not fetch an
  external href out of a serialised SVG *and does not error when it fails* — the
  picture is simply absent from all four hundred frames. `inlinePhotos()` pays
  the same tax `inlineBall()` already paid, and pays it worse: the signed URL a
  live board draws from would expire part-way through a long render.
- **`Token`'s clip path is keyed by POSITION, not by `idp`.** `Board` hands the
  same `idp` to all twenty-two counters, so an id built from it alone would clip
  every token to whichever circle was defined last.

Also fixed on the way past: `scripts/apply-migration.mjs` used to refuse any file
containing a `$$` body, which meant every migration defining a trigger function
had to be pasted into the dashboard by hand. It now scans properly — strings,
both comment forms, and dollar-quoted bodies with their own tags. Re-checked
against `005`, which has one.

---

## 5. Later phases, specified

### 5a. Phase 2 — Publish

The three real pieces of work:

1. **The adapter.** `@astrojs/netlify`, `output: 'server'` with `prerender = true`
   as the default on existing pages so nothing that is static today stops being
   static. Only the post and profile routes opt out.
2. **Carousel export.** `docs/STUDIO.md` §4.2 is most of this already:
   `frameSvg`/`raster` in `videoRender.ts` rasterise a board per frame, and a
   PNG per act is the same call without the encoder. Ship PNG-per-act **and a
   single PDF**, because LinkedIn renders an uploaded PDF as a native carousel
   and that is the highest-reach format available to this product.
3. **The OG image.** A rendered board as the link preview is what makes a post
   travel. Same rasteriser, 1200×630, generated on demand and cached.

### 5b. Phase 3 — Fork

On any public post: "Open this in the studio" copies the doc into the viewer's
account with `forked_from` set. `templates.ts` already does exactly this move for
the worked examples, so the mechanism exists. Attribution is permanent and shown
on both ends. Public means forkable, with credit.

### 5c. Phase 5 — Recognition, done correctly

**Verification.** Identity only. Ranked by cost to implement: club email domain
match, then a link to a club staff page reviewed manually, then licence number.
Never granted for activity or invites.

**Achievements**, computed from `doc` jsonb and post counters, all cheap:

| badge | earned by |
|---|---|
| Technician | a published system with notes on every phase |
| Architect | published systems spanning build-up, mid-block and transition |
| Draughtsman | boards using arrows, bands and cues together, well |
| Mentor | systems forked by others |
| Scout | referrals who published (see below) |
| Founding Coach | the first N members, permanent |

**Referrals**, kept and made to feel good without touching trust:

- Every profile with a handle gets a referral link. The handle **is** the code,
  so there is nothing extra to mint or remember.
- An invite **qualifies** when the invitee publishes their first post. Counting
  signups instead would reward spraying links, which is the thing to avoid.
- Rewards are **Scout** tiers (3 / 10 / 25 qualified) plus profile flair and
  early access to new studio features. **Never the verified badge**, and never
  anything that implies endorsement.
- Both sides are told plainly what qualifies and when, on the profile page. No
  dark patterns, no countdown timers, no "your streak is about to end".

---

## 6. Sharing outward — what is actually possible

Verify these at build time, they move. As of 2026-08:

| platform | prefilled caption via a link? |
|---|---|
| X / Twitter | **yes**, full: text, url, hashtags |
| Facebook | url only; `quote` prefill was removed years ago |
| LinkedIn | url only; text and summary params deprecated |
| Instagram | **no web posting intent exists at all** |
| TikTok | no web upload intent with prefill |
| YouTube | no upload intent |

**So the primary path on mobile is the Web Share API Level 2**:
`navigator.canShare({files})` then `navigator.share({files:[mp4], text})` puts the
rendered file straight into the native share sheet, Instagram and TikTok
included, caption attached. This is better than what a URL could have done.

**On desktop the honest build is a "post pack"**: download the file, copy the
composed caption to the clipboard, open the upload page. Two clicks, and it does
not lie about what it is.

Handles live in `src/lib/site.ts` (`SOCIAL`). Hashtag: `#totalfootballstudio`.
**Fix the YouTube handle before Phase 4** — it is still `@Fballvault` from the
old channel name, and Phase 4 would print it into thousands of captions.

### Phase 1c — the identity switch (`supabase/017`)

A coach can now send work without their name on it. `show_identity` on
`studio_profiles` is the ACCOUNT DEFAULT, on by default; each of the three
export dialogs opens set to it and can be flipped for one file without changing
it. What "identity" covers is defined in exactly one place, `withoutIdentity`
in `src/studio/schema.ts`, and it is wider than the credit line: the coach's
name and club, the crest and its URL (which contains the account uuid), and
every player's name and photo path. The tactics stay: counter labels, kit
colours, the session note and the date.

Two decisions worth not relitigating:

1. **The share link STRIPS rather than hides.** `withoutIdentity` is applied to
   the payload `publishSystem` sends, so an anonymous board's names are not in
   the public row behind a flag the viewer is trusted to honour. They were never
   sent. The long-URL fallback gets the same copy, which is the half that is
   easy to forget.
2. **Our mark is always drawn, and has no switch.** `resolveParts` forces
   `lockup: true` and ignores a caller that asks otherwise (user, 2026-08-28).
   This reverses the old rule, which tied our lockup off whenever the credit was
   off on the argument that a corner logo alone on somebody else's work reads as
   a tax. That rule was defending against an empty left-hand side, and there is
   no longer one: the credit line falls back to the system's own title, or to
   "A tactical system", which is what the viewer has always shown for an
   unsigned board. So there is always something of theirs for ours to sit beside.
   The `lockup` field stays in `ChromeParts` and every drawing site still reads
   it, so restoring the switch is a dialog change and nothing more.
   One loophole, named rather than hidden: `chrome: false` is still "the board
   and nothing else", mark included. That is the "under my own title in my own
   deck" errand and it costs the head, the caption and the credit too.

Also in `017`: `VideoOptions.parts`. A film used to be hardcoded to the whole
chrome on the argument that it travels furthest and most needs to say whose it
is. Right about the default, wrong as an absolute.

---

## 7. Constraints and gotchas

- **Cold start is real.** A feed with nothing in it is dead. Seed with official
  systems (12 launch systems, 5 templates, `content/systems/`) and hand-recruit
  before anyone else sees it. Nobody should ever load an empty feed.
- **Public UGC changes the legal position.** Before anything goes public:
  a report button, a takedown path, an admin view, and a revision of
  `terms.astro` and `privacy.astro` covering user content, licensing and forks.
  Not optional, and not glamorous.
- **`/studio/watch` is `noindex` and fragment-based on purpose.** Public posts are
  the opposite and need their own route with their own rules. Do not try to make
  one page do both.
- **RLS needs the GRANT too.** `supabase/005` spells this out: this project does
  not hand out Supabase's default privileges on `public`, so a policy without a
  matching `grant` answers 42501 with the policy sitting right there.
- **`(select auth.uid())`, never a bare `auth.uid()`,** in every policy. The bare
  call is re-evaluated per row.
- **POLICIES ARE OR'd, SO RLS NEVER MEANS "MINE".** This one cost a working
  product for a day and is the most expensive mistake in the file. `loadProfile`
  read `studio_profiles` with no `.eq('id', uid)`, relying on RLS to narrow it.
  The day `012` added a public read for published profiles, a signed-in coach's
  query started returning their own row PLUS every public one, `.maybeSingle()`
  answered `406 PGRST116`, and the client read that as "you have no profile":
  empty settings page, unpainted kit, a share dialog asking for a name it had
  been given twice. Worse, before a second coach had a row of their own the ONE
  visible row was somebody else's, so the settings form loaded a stranger's
  identity and Save wrote it back under their own id.
  **Every "my X" query names its owner, even where no policy today makes that
  necessary.** The filter is not what makes it safe; it is what stops the query
  silently changing meaning when the next policy lands. Fixed and repaired in
  `supabase/017`, which also pins `crest_path`, `avatar_path` and `photo_path`
  to the owning row so no client bug can put one account's file on another's.
- **A failed read is not an empty record.** `loadProfile` returned `null` for
  both, and `Settings` turned that into a blank form over a full-payload upsert:
  one press of Save on a bad connection would have wiped a real profile. It now
  returns `{kind: 'row' | 'none' | 'error'}` and the page refuses to render a
  form it could not populate. Any future editor of a single row owes the same.

---

## 8. Running and applying

```
npm run dev          # localhost:4321
npm run check        # astro check, must be clean before a phase is called done
```

Migrations now have a fourth route, and it is the easy one:

```
npm run db:apply supabase/012_studio_identity.sql --dry   # split only, sends nothing
npm run db:apply supabase/012_studio_identity.sql         # apply
```

`scripts/apply-migration.mjs` goes through `public.execute_sql` with the
service-role key already in `.env` — the same path the reporting scripts use — 
and runs **one statement at a time**, so a failure names the statement rather
than the file. It COLLECTS: one run gives the whole punch list. Every file in
`supabase/` is idempotent, so re-running after a fix is the intended use.

It REFUSES files containing a dollar-quoted body (a function, a DO block),
because those cannot be split on semicolons safely — `011` and `006` are in that
category and still go through the dashboard. See `supabase/011` for the CLI and
Management API alternatives.

**012 was applied on 2026-08-27** and verified: 26/26 statements, all columns and
constraints present, both policies in place, the `crests` bucket configured, anon
holding SELECT only, and both existing profile rows private with no handle.

**Nothing in this plan is committed or pushed until it is asked for.**
