# totalfootball.naurra.ai — foundation spec

**Status:** draft for sign-off · **Written:** 2026-08-09
**Scope:** the foundation (landing · library · intelligence · newsletter). The course
is phase 2 and is only *reserved for* here, not designed.

---

## 0. The strategic read

The naurra.ai SEO audit (`voice-ai-client/SEO_AUDIT_2026-08.md`, 2026-08-07) already
paid for the two lessons that shape this build:

1. **46 blog pages produced 16 clicks in 90 days.** Prose volume is not the lever.
   Do not build this as a blog.
2. **"The domain has no authority. This is a links-and-entity problem."** Ranking is
   gated on entity strength, not on page count.

Total Football is the rare case where both problems are already solved elsewhere:

- The **entity** is a 25k-follower Facebook page with measured breakouts —
  Japan Chameleon 211k plays, BackFour ~870k. That audience is the authority signal
  naurra.ai never had. Every video description and bio link pointing here is worth
  more than any on-page tactic.
- The **content** is ~120 registered compositions in `editor/src/Root.tsx`, ~90 of
  them already documented, each one a distinct tactical concept that people
  literally type into search: *what is a cover shadow*, *how to defend a back four*,
  *what is zone 14*, *how to beat a back five*.

So: **the library is the SEO strategy. Everything else on the site is a landing page
pointed at a CTA.**

---

## 1. Decisions locked (2026-08-09)

| Decision | Choice |
|---|---|
| Location | new standalone project, this folder |
| Library format | static, crawlable diagram slides (option 1) |
| Launch scope | 8–12 proven winners |
| Email capture | Supabase, behind an abstraction |

### Open flag, not a blocker

`totalfootball.naurra.ai` reads as a sub-project of an AI company to a football
audience, and Google treats subdomains as quasi-separate for authority anyway — so
there is no SEO reason to stay attached to a domain that (per the audit) has no
authority to lend. **Mitigation baked in from commit one:** `site` comes from an env
var, never hardcoded. Moving to a real domain later is then a config change and a
301 map, not a rebuild.

---

## 2. Stack

Mirror naurra.ai exactly, so there is one mental model across both properties.

- **Astro 6**, `output: 'static'`, `trailingSlash: 'always'`, `build.format: 'directory'`
- **Tailwind 3** with the Total Football tokens (§6)
- **React islands** only where interaction demands it: the slide viewer, the
  newsletter modal, the library filter. Everything else ships as zero-JS HTML.
- **Netlify**, separate site from naurra.ai, CNAME `totalfootball` → Netlify.
  Own `netlify.toml` copied from voice-ai-client (security headers + cache rules
  are already correct there).
- **Supabase** for email capture, reusing the existing project or a new one (§9).

Deliberately **not** included: no CMS, no analytics SDK on the critical path, no
font CDN, no third-party JS before first paint.

---

## 3. URL map

```
/                        landing
/library/                hub — filterable grid of systems
/library/[theme]/        theme hubs: defending, build-up, pressing, attacking, set-pieces
/library/[slug]/         ONE SYSTEM — the slide deck + full description   ← the SEO engine
/intelligence/           the EV Lab / Telegram page
/course/                 waitlist placeholder (phase 2)
/faq/                    every question, grouped — the only FAQPage on the site
/about/                  what Total Football is, who makes it, the method
/privacy/  /terms/
/sitemap.xml  /robots.txt  /rss.xml  /llms.txt
```

Theme hubs exist to form a proper topical cluster: hub → theme → system, with every
system page linking to 3 siblings. **The sibling graph already exists** — the
`[[wikilinks]]` in `MEMORY.md` are a hand-built internal link map. We read it, we
don't invent it.

---

## 4. Landing page

Sections, in order. Each one ends in exactly one CTA — no section competes with
itself.

1. **Hero.** The mark, one line of what this is, the animated board still behind it.
   Not a video. LCP must be an image with explicit dimensions.
2. **The proof.** 25k+ followers · N shorts · N plays. Every number sourced from
   `fb-insights/data/` and stored in one editable data file so it never goes stale
   silently. → CTA: follow on Facebook.
3. **What Total Football is.** The method, honestly stated: no broadcast clips, no
   stolen footage — every frame is drawn. That is the actual differentiator and it
   is also why the channel dodges Content-ID. → CTA: the library.
4. **Library preview.** 6 system cards. → CTA: browse all.
5. **Intelligence.** The Telegram/model strip. → CTA: /intelligence/.
6. **Course.** Waitlist strip. → CTA: /course/.
7. **Footer** with the newsletter inline form (the popup is a *second* surface, not
   the only one).

---

## 5. The library page — anatomy

This is the template that gets built once and repeated ~90 times, so it is worth
getting exactly right.

```
┌─────────────────────────────────────────────┐
│ breadcrumb: Library › Defending › Back Four │
│ H1  Defending In A Back Four                │
│ one-paragraph answer to the search query    │  ← this paragraph is what ranks
│ meta strip: theme · 6 phases · 21s original │
├──────────────────────┬──────────────────────┤
│                      │  PHASE 3 of 6        │
│   [diagram]          │  H2 The switch       │
│   vertical still     │  120–180 words       │
│   9:16               │  the key detail      │
│                      │  ← prev   next →     │
├──────────────────────┴──────────────────────┤
│ The principles — 3 bullet takeaways         │
│ Watch the full breakdown → FB/YouTube       │
│ Related systems (3, from the wikilink graph)│
│ Newsletter inline                           │
└─────────────────────────────────────────────┘
```

**Non-negotiable for SEO:** every phase's heading, caption and body text is in the
initial HTML. The slide viewer changes which one is *visible*, never which one
*exists*. No fetch, no client-side rendering of content. With JS off, the page is a
readable illustrated article — that is the version Google indexes.

Desktop is two-column (diagram left, text right); mobile stacks with the diagram
capped at ~60vh. The board comps are 1440×2560, so vertical stills are native and
need no cropping.

---

## 6. Media pipeline — and why not GIF

You suggested exporting parts of the videos as media rather than re-coding the
boards in React. **Agreed on the principle** — re-authoring 90 boards in web SVG is
weeks of work for a worse result. Use the real frames.

**But not GIF.** A 3-second 720p GIF is 5–15 MB and capped at 256 colours; the same
clip as MP4 is ~200–400 KB and looks better. GIF would wreck Core Web Vitals on
exactly the pages that need to rank. The format plan:

| Layer | Format | Purpose |
|---|---|---|
| **Phase diagram** (the slide) | AVIF + WebP via `<picture>`, explicit w/h | the indexable, LCP-safe layer. First slide eager + preloaded, rest lazy |
| **Motion loop** (optional, top systems) | MP4 h264 + WebM, `muted loop playsinline preload="none"`, poster = the still | enhancement only, never required to understand the page |
| ~~GIF~~ | — | never |

**How the files get made — and who runs it.** Standing rule on this project is that
I never render; you evaluate all visual output. So:

1. I author `media/manifest.ts` — for each system: comp id, slug, and the frame
   number for each phase (derived from the composition's own timing constants, not
   eyeballed).
2. I write `media/export.sh`, which turns that manifest into `remotion still` /
   `remotion render --frames=a-b` commands plus the AVIF/WebP/MP4 conversions.
3. **You run it** in the `editor/` project and drop the output into
   `public/library/<slug>/`. You see every frame before it ships.

Alt text is authored per phase, not generated — it is both an accessibility
requirement and one of the few honest image-SEO signals left.

---

## 7. SEO plan

Copy wholesale from `voice-ai-client/src/layouts/BaseLayout.astro` — canonical
normalisation, hreflang scaffold, OG/Twitter, robots directives. It is already
correct there; retyping it would only introduce bugs.

**Structured data**
- Site-wide: `Organization` (with `sameAs` → Facebook, Telegram, YouTube) + `WebSite`
  with `SearchAction`.
- Library page: `Article` + `BreadcrumbList` + `ImageObject` for the diagrams.
- `VideoObject` **only** where a real video file is genuinely embedded on that page.
- Explicitly **not** using `HowTo` (Google removed the rich result entirely). Marking
  up for rich results that no longer exist is wasted effort — a trap worth naming.
- `FAQPage` on **`/faq/` and nowhere else** (amended 2026-08-15; it was previously
  ruled out entirely). The original reasoning still holds for the rich result:
  Google restricted it to authoritative government and health sites in August 2023,
  so no accordion is appearing in anyone's SERP from this. What changed is the
  second reader. `/faq/` is a document whose main content genuinely *is* a list of
  questions, the markup is therefore a true description of it, and the answer
  engines this section already names as a real channel can lift a question and its
  answer without inferring anything. That is a different bet from marking up a
  landing page and hoping for a widget.
  **The line to hold:** the schema goes on the page that is an FAQ. It does **not**
  go on the homepage, `/studio/`, `/course/`, `/intelligence/` or a system page,
  all of which now carry an FAQ *section*. On those, the main content is something
  else, and saying otherwise in structured data is a false claim about the document.
  Enforced by a single helper in `src/data/faq.ts`; read the note at the foot of it
  before adding a second caller.

**Technical**
- Static HTML, no blocking JS. Self-hosted Inter subset, `font-display: swap`,
  preloaded.
- Every image has intrinsic width/height. Zero layout shift.
- `sitemap.xml` generated from the content collection (same pattern as
  `src/pages/sitemap.xml.ts`), `rss.xml` for new systems, `llms.txt`.
- `llms.txt` matters more here than it did for naurra.ai: the audit proved the site
  gets ingested as an AI answer source. For "what is a cover shadow", being the
  cited source is a real win even without the click.

**Off-page — the part that actually decides this**
The audit's conclusion applies unchanged: authority is the bottleneck. The levers
are the FB page (link in bio, link in every description), the Telegram channel, and
YouTube. No amount of on-page work substitutes.

---

## 8. Brand on web

Ported straight from `editor/src/branding/totalFootball.ts` — one source of truth,
no re-picking colours:

```
paper   #F4F4F2      ink      #161618      ink-soft rgba(22,22,24,0.62)
gold    #E6B23A      gold-deep #C9902B
green   #08C16A      green-deep #06A659
gradient  linear-gradient(135deg, #E6B23A 0%, #C9902B 42%, #08C16A 100%)
font    Inter (900 display / 400–700 text)
```

The light "paper" stage, faint grid and ink type carry over directly from the video
identity, which means the site looks like the shorts without imitating them.

`TotalFootballMark.tsx` and `TotalFootballWordmark.tsx` are React/SVG already — I
port them to static SVG components. **No PNG export needed**, which keeps the
no-rendering rule intact for the logo too.

Dark mode: the brand is light-first ("paper"). Ship light-only rather than inventing
a dark palette that has never appeared in a video.

---

## 9. Newsletter + Supabase

- One table, `subscribers`: `email`, `source` (`popup` | `footer` | `course-waitlist`
  | `library:<slug>`), `created_at`, `confirmed_at`. Source tagging is what later
  tells you which library pages convert.
- Insert via a Netlify function using the anon key with RLS insert-only — never the
  service role in a browser.
- All capture goes through one `subscribe()` module, so swapping to Beehiiv/ConvertKit
  later is a config change.
- **Popup rules, non-negotiable:** never on first paint; trigger on 50% scroll or
  exit intent; frequency-capped in localStorage; on mobile it must not cover the
  content (Google penalises intrusive mobile interstitials — this is a ranking issue,
  not just a UX one). The footer form is the primary surface; the popup is the
  supplement.

---

## 10. /intelligence/ — the EV Lab page

Brand: **TOTAL STATS · DAILY INTELLIGENCE** · `t.me/TotalStatsAIAnalysis`.

A permanent, indexable page making profit claims is a different risk surface from a
chip inside a Reel. What ships:

- The honest figures from `football-ev-lab/backend/reports/`: 30W-15L-3P,
  **+9.63u on 28.2u staked**, and **+7% over the last 10 cards** as the headline
  rate — not +34% all-time, which your own report says is carried by a hot start.
- **Always carry the unit size.** A bare number nobody can place is unverifiable.
- **No CLV claim.** Capture coverage is 8%; the report itself says it is not yet
  evidence.
- The graded ledger published as a table. Verifiable beats impressive, and it is the
  one thing no competing tipster page will do.
- 18+, "not financial advice", no guarantees, responsible-gambling link.

The `+9.6X` on-screen chip stays as-is **in videos** for consistency with what has
already shipped; the web page states the arithmetic properly alongside it.

---

## 11. Course — reserved, not designed

Ships now: a `/course/` page with the promise, the outline, and a waitlist form
tagged `course-waitlist`. That list is what tells you the price.

Reserved for later, already proven in `voice-ai-client`: Supabase auth + Stripe
checkout. The foundation must not make that harder — so no routing or layout
decision here assumes every page is public.

---

## 12. Launch set — the 12 systems

Chosen from measured performance (`fb-insights/ANALYSIS-2026-07-24.md`, and the
BackFour correction in memory), weighted to whole-team systems because the data is
unambiguous: **7 of 23 system clinics broke 20k vs 1 of 36 technique shorts.**

| # | System | Comp id | Evidence |
|---|---|---|---|
| 1 | Defending In A Back Four | `BackFourShort` | ~870k plays — the channel's real #1 |
| 2 | The Chameleon (Japan) | `JapanShort` | 211k plays |
| 3 | Salida Lavolpiana (3v2 build-up) | `SalidaShort` | 66k |
| 4 | The 4-4-2 Mid-Block | `MidBlockShort` | 60k |
| 5 | The Reset | `BackFourResetShort` | 58k |
| 6 | The Locked Door (beating a low block) | `LockedDoorShort` | 57k |
| 7 | How Spain Caged France | `CageShort` | 53k |
| 8 | The Underlap | `UnderlapShort` | 39k — **65.2% WTR, best on the channel** |
| 9 | Playing Out From The Back | `PlayingOutShort` | system clinic |
| 10 | The Pressing Trap | `PressTrapShort` | system clinic |
| 11 | The Fifth Man | `FifthManShort` | system clinic |
| 12 | Zone 14 | `Zone14Short` | strongest standalone search term |

All twelve comp ids verified against `editor/src/Root.tsx`. Each becomes 5–7 phases.

---

## 13. Build order

**Phase A — skeleton. ✅ 2026-08-09.** Astro project, Tailwind + brand tokens,
`BaseLayout` ported, mark/wordmark as SVG, robots/sitemap/rss/llms, Netlify config.

**Phase B — the library template. ✅ 2026-08-09.** BackFour built end-to-end: data
schema, slide viewer, structured data, media pipeline, six exported diagrams.
**Review gate: approve this page before the other 11 get built.**

**Phase D — landing page. ✅ 2026-08-09** (brought forward; it needed no new
machinery). Real numbers, sourced from `src/data/channel.ts`.

**Phase E — intelligence, course waitlist, privacy/terms, Supabase capture.
✅ 2026-08-09.** Newsletter popup still outstanding.

**Phase C — the other 11 systems.** Blocked on the review gate.

### Learned during Phase B — carry into Phase C

1. **Write the phase prose from the exported frames, not from knowledge of the
   tactic.** The first BackFour draft was written from the system and contradicted
   the diagrams in three places: it put the recovering full-back on *balance* when
   the board labels him *cover*, invented a compactness beat the frame does not
   show, and claimed a diagonal stagger where the line renders as a shallow arc.
   Export first, look, then write.
2. **The compositions burn a caption bar and logo into the bottom of the frame**,
   and phase 1's chip prints the composition id (`BACKFOURSHORT`). Cropped: 176px
   off the bottom, giving 720×1104. Same crop for every phase of a system so the
   diagram does not jump between steps.
3. **Raw and processed must be separate directories.** Cropping in place is not
   idempotent — a second run crops an already-cropped frame.
4. There is a genuinely nice structural story in these boards that only appears
   once you look at all the frames together: exactly one PRESS at all times, one
   COVER at the ends of the line and *two* when the presser is in the middle, and
   the jobs walking one seat up the line per phase. Look for that shape in each
   new system rather than restating the textbook.

---

## 14. What I need from you

1. **Netlify + DNS** — new site, and the `totalfootball` CNAME. Or tell me the host
   is different.
2. **Supabase** — reuse the naurra project or a new one, and which.
3. **Confirm the numbers** for the landing page proof strip: current follower count
   (insights said 17,042 on 2026-07-24; you said 25k+), total plays, total shorts.
4. **Facebook page URL** and the YouTube channel URL/handle, if it is live.
5. **The storytelling videos** you mentioned for the course — where do they live?
   I only found the tactics library and the two longform docs.
6. **Course direction** — later, as you said, but a one-line "who is it for" would
   let me write the waitlist page honestly rather than with placeholder copy.
