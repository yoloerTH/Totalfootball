# totalfootball-web

The Total Football site: **https://totalfootball.naurra.ai** (live since 2026-08-09).

Netlify project `totalfootball-694` in `amathelw2's team`, the same account that
hosts naurra.ai. DNS is Netlify-managed, so the subdomain record already exists
and TLS is covered by the `*.naurra.ai` wildcard.

Astro 6 (static) · Tailwind 3 · Netlify · Supabase for email capture. The stack
deliberately mirrors `AI ASSITANT FULL/voice-ai-client` so there is one mental
model across both properties.

**Read [`docs/SPEC.md`](docs/SPEC.md) first** — it carries the strategy, the
locked decisions, and the reasons behind the non-obvious choices.

---

## Commands

```bash
npm install
npm run dev                  # http://localhost:4321 (no functions)
netlify dev                  # http://localhost:8888 (with functions)
netlify deploy --prod --build

node scripts/analytics-report.mjs      # traffic + signups, last 30 days
node scripts/brand-assets.mjs          # regenerate og-default / logo / touch icon
npm run build                # astro check && astro build → dist/
npm run preview

./media/export.sh            # regenerate every phase diagram (see below)
```

## The one rule that shapes the code

**Every phase's text is in the initial HTML.** The slide viewer only changes
which phase is *visible*. With JavaScript off, a library page renders as a plain
illustrated article, top to bottom — and that version is what Google indexes.
Nothing may move phase content behind a fetch, a template, or a framework
island.

Verify it after any change to `SlideViewer.astro`:

```bash
npm run build
grep -c 'data-phase=' dist/library/defending-in-a-back-four/index.html   # = phase count
```

## Media pipeline

Phase diagrams are real frames from the Remotion compositions in `../../editor`.

```
media/manifest.json     which frame of which composition = which phase
        ↓ media/export.sh
media/raw/<slug>/       untouched remotion stills (gitignored)
        ↓ media/postprocess.mjs
public/library/<slug>/  cropped, then AVIF + WebP + PNG
```

- Frame numbers come from each composition's own timing constants — never
  eyeballed. For `BackFourShort` they are read off the `BALLSEQ` table.
- The bottom **176px is cropped** off every frame. The compositions burn in a
  caption bar and logo down there; on the web the caption duplicates the prose
  beside it, and phase 1's chip renders the composition id itself
  (`BACKFOURSHORT`). Final size is **720×1104**.
- The crop is identical across every phase of a system so the diagram does not
  jump while the reader steps through.
- **No GIF.** A 3s 720p GIF is 5–15MB at 256 colours. AVIF lands at ~10KB.

Re-crop without re-rendering:

```bash
./media/export.sh defending-in-a-back-four --skip-render
```

If the crop changes, update `H` in `src/components/library/PhaseImage.astro`
**and** the `height` in the ImageObject schema in `src/pages/library/[slug].astro`,
or pages will shift as images load.

## Adding a system

1. Add an entry to `src/data/systems.ts`.
2. Add its frames to `media/manifest.json`.
3. `./media/export.sh <slug>`.
4. **Look at the frames**, then write the phase text to match what is actually
   on screen. Do not write the prose from memory of the tactic — the first pass
   of the BackFour copy described role assignments the diagrams contradicted.

Sitemap, RSS and the theme hubs all generate from `systems.ts`; nothing needs
registering twice.

## Environment

Copy `.env.example`. Server-side values are set in the Netlify UI and are never
prefixed `PUBLIC_`.

`PUBLIC_SITE_URL` drives the canonical, sitemap, robots and structured data. It
is env-driven so moving off the subdomain is a config change plus a 301 map.

## Email capture

**Status: live in production and verified there (2026-08-09).** The table
exists, the grants and policy are correct, all nine paths were tested through
the actual function, and a real signup posted to
`https://totalfootball.naurra.ai/api/subscribe` was confirmed in the table.

**Supabase project: `Bet` (`bewvowkkikxsjcfnkeot`).** Not a dedicated project,
because the org is on the free plan and already has its two. It is safe: no
Supabase key ever reaches the browser (the Netlify function is the only client),
and `subscribers` is isolated by its own grants. If the site later moves to its
own project, only the two env vars change.

### Verified behaviour

| Case | Result |
|---|---|
| Valid signup, JSON | 200, one row, email lower-cased |
| Same address again | 200, **no** second row |
| Invalid address | 400, nothing stored |
| Honeypot filled (bot) | 200, nothing stored |
| Cross-origin POST | 403, nothing stored |
| No-JS form post | 200, HTML confirmation page |
| GET | 405 |
| anon tries to SELECT the list | 401 |
| anon tries to DELETE | 401 |

Re-run any time: `node <scratch>/e2e.mjs` (harness pattern in the git history)
or exercise it through `netlify dev`.

### Local development

`.env` exists (gitignored, chmod 600) and points at the Bet project with
`ALLOWED_ORIGIN=http://localhost:8888`. Functions do not run under `astro dev`,
so use:

```bash
netlify dev        # site on :8888, functions included
```

A POST to `/api/subscribe` on `localhost:4321` will always 404. That is expected.

### Environment variables (already set on the Netlify project)

| Variable | Value | In the browser? |
|---|---|---|
| `SUPABASE_URL` | `https://bewvowkkikxsjcfnkeot.supabase.co` | no |
| `SUPABASE_ANON_KEY` | the Bet project's anon key (copy from the local `.env`) | no |
| `SUPABASE_SERVICE_ROLE_KEY` | reads the analytics back for the daily report | **never** |
| `ALLOWED_ORIGIN` | `https://totalfootball.naurra.ai` | no |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | where the daily report goes | no |
| `PUBLIC_SITE_URL` | `https://totalfootball.naurra.ai` | yes |
| `PUBLIC_SUPABASE_URL` | same as `SUPABASE_URL` | **yes, by design** |
| `PUBLIC_SUPABASE_ANON_KEY` | same as `SUPABASE_ANON_KEY` | **yes, by design** |

The two `PUBLIC_SUPABASE_*` are the accounts client, and the duplication is
deliberate — see the long note in `.env.example`. The anon key is a project
identifier, not a secret; what keeps one coach out of another's systems is RLS
in `supabase/005`, which only Postgres can enforce and only against a signed-in
user. Set on the **production context only**, so deploy previews keep running
with accounts switched off.

They are read at BUILD time (Vite inlines `import.meta.env`), so changing one
needs a rebuild, not just a redeploy.

Change them with `netlify env:set <NAME> "<value>" --context production`.

### Accounts still need two things done in the Supabase dashboard

Neither is reachable from a key, so neither can be scripted from here:

1. **Authentication → Providers → Google** is currently **off**, while the
   studio's copy says "Sign in with Google and you are on the board". Until it
   is enabled with a Google Cloud OAuth client, that button fails and only
   email/password works. Check with:
   `curl -s "$SUPABASE_URL/auth/v1/settings" -H "apikey: $SUPABASE_ANON_KEY"`
2. **Authentication → URL Configuration** — Site URL
   `https://totalfootball.naurra.ai`, and the redirect list must allow
   `https://totalfootball.naurra.ai/**`, because sign-in comes back to
   `?next=` (`/studio/portal/` by default).

### What gets stored

One row per address: `email`, `source`, `created_at`. `source` is the useful
part, because it records which surface converted:

| Source tag | Where |
|---|---|
| `footer` | the footer form, every page |
| `course-waitlist` | both forms on `/course/` |
| `intelligence` | the weekly-summary form on `/intelligence/` |
| `library:<slug>` | the form at the foot of each library page |

That last one is what eventually tells you which tactical topics are worth
writing more of.

### The two things not to "tidy up"

**anon has INSERT and nothing else.** A policy alone was not enough: PostgREST
returned `42501 permission denied` until an explicit table `GRANT` existed,
because RLS filters rows only after the role already holds the privilege. This
project does not hand out Supabase's usual default privileges.

**The insert is deliberately not an upsert.** PostgREST's
`?on_conflict=email` + `resolution=ignore-duplicates` path needs SELECT on the
table, which would mean granting anon the ability to read subscriber addresses.
Instead the unique constraint raises 409 and the function treats it as success.
Same result for the visitor, least privilege for the role.

## What gets measured

Two readers of the same table, `public.site_events`:

```bash
node scripts/analytics-report.mjs      # the dashboard, on demand, last 30 days
```

…and `netlify/functions/daily-report.mts`, which posts to Telegram at 18:00 UTC
(21:00 Athens) over a rolling 24 hours. Both go through `public.execute_sql`,
which is granted to `service_role` only — see `supabase/006_reporting.sql`,
which is where that function is finally written down.

**Three kinds of row.** `pageview` and `duration` are automatic.
`click` is opt-in and carries a label:

| Label | Written by |
|---|---|
| `nav:*`, `hero:*`, `home:*`, `course:*`, `studio:cta-*`, `intel:*`, `telegram:*` | `data-track` on the element |
| `outbound:<host>` | any link leaving the site, automatically |
| `signup:<source>` | a form that actually saved an address, not one that was submitted |
| `studio:*` | the editor and the viewer, via `src/studio/track.ts` |
| `share:<id>` | the pageview of a shared system (see below) |

**The studio reports too.** Everything the product does happens inside a React
island, so no click listener can see it. `src/studio/track.ts` is the only place
that decides what is sent, and it sends a label and nothing else — never a
system, a title or an id.

**Share links collapse to one path.** `/s/k7f3q9` is a route, not a page.
`netlify/functions/track.mts` stores it as `/s/:id` with the id moved to
`label`, so "most read" stays a list of pages rather than a list of strangers'
share ids. Rows written before that are brought into line by the backfill at the
foot of `supabase/006_reporting.sql`.

**A broken section does not cost the report.** Every query in the daily report
is asked for by name; one that fails is left out and named at the foot of the
message. Silence used to be the failure mode, and silence reads exactly like a
quiet day.

## House style

**No em dashes.** The published copy uses commas, colons, semicolons or a
rewrite instead. Check before shipping:

```bash
npm run build && grep -ro '—' dist --include='*.html' --include='*.txt' --include='*.xml' | wc -l   # must be 0
```

## Outstanding

- **Not yet git-backed.** Deploys currently run from this machine with
  `netlify deploy --prod --build`. There is a local git repo with full history;
  create an empty GitHub repo, push it, and connect it in Netlify to get
  automatic deploys, previews and rollbacks.
- `SOCIAL.facebook` and `SOCIAL.youtube` are empty in `src/lib/site.ts`, so the
  Organization `sameAs` is nearly bare. That is the main on-page entity signal
  and the naurra.ai audit named entity strength as the actual bottleneck.
- Analytics runs without a consent banner, which holds up only while it stays
  cookie-free. See the header comment in `src/components/Analytics.astro`
  before changing anything there.
- Placeholders marked `TODO(thanos)`: contact address and controller in
  `src/pages/privacy.astro`, governing entity in `src/pages/terms.astro`,
  follower count in `src/data/channel.ts`.

## Not yet done

- Newsletter popup. The footer and inline forms are live; see SPEC §9 for the
  rules, the important one being that it must never be a mobile interstitial.
- 7 remaining launch systems (SPEC §12), plus a set-piece system to populate the
  fifth theme.
