# totalfootball-web

The Total Football site — `totalfootball.naurra.ai`.

Astro 6 (static) · Tailwind 3 · Netlify · Supabase for email capture. The stack
deliberately mirrors `AI ASSITANT FULL/voice-ai-client` so there is one mental
model across both properties.

**Read [`docs/SPEC.md`](docs/SPEC.md) first** — it carries the strategy, the
locked decisions, and the reasons behind the non-obvious choices.

---

## Commands

```bash
npm install
npm run dev                  # http://localhost:4321
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

**Status: live and verified against the real database (2026-08-09).** The table
exists, the grants and policy are correct, and all nine paths were tested end to
end through the actual function. The only step left is deploying and setting the
same variables in Netlify.

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

### Still to do: Netlify

**Set the environment variables** in Netlify (Site configuration → Environment
variables). None are prefixed `PUBLIC_`, so none reach the browser:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://bewvowkkikxsjcfnkeot.supabase.co` |
| `SUPABASE_ANON_KEY` | the Bet project's anon key (copy from the local `.env`) |
| `ALLOWED_ORIGIN` | `https://totalfootball.naurra.ai` |
| `PUBLIC_SITE_URL` | `https://totalfootball.naurra.ai` |

Then deploy and submit one real address to confirm the row lands.

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

## House style

**No em dashes.** The published copy uses commas, colons, semicolons or a
rewrite instead. Check before shipping:

```bash
npm run build && grep -ro '—' dist --include='*.html' --include='*.txt' --include='*.xml' | wc -l   # must be 0
```

## Blocking before launch

- **Netlify env vars + deploy.** The database side is done and verified; the
  four variables above still need setting on the Netlify site, which does not
  exist yet. Until then a deployed form would report a server error.
- `SOCIAL.facebook` and `SOCIAL.youtube` are empty in `src/lib/site.ts`, so the
  Organization `sameAs` is nearly bare. That is the main on-page entity signal
  and the naurra.ai audit named entity strength as the actual bottleneck.
- `og-default.png` (1200×630) and `logo.png` are referenced by every page's
  meta and by the Organization schema, but neither file exists yet.
- Placeholders marked `TODO(thanos)`: contact address and controller in
  `src/pages/privacy.astro`, governing entity in `src/pages/terms.astro`,
  follower count in `src/data/channel.ts`.

## Not yet done

- Newsletter popup. The footer and inline forms are live; see SPEC §9 for the
  rules, the important one being that it must never be a mobile interstitial.
- 7 remaining launch systems (SPEC §12), plus a set-piece system to populate the
  fifth theme.
