# The Studio — handoff

A portal where coaches build tactical presentations on the Total Football board.
They pick a pitch view, a formation and their colours, pose the board **act by
act**, and export a deck — or press Play and watch it animate itself.

This document is the state of that build as of **2026-08-12**, after two
sessions. It is written to be the first thing read in a new session.

**Live and linked.** `/studio/` is a public landing page, it is in the header
nav and in the sitemap, and it is the **only** indexed URL under `/studio/` —
the editor, portal, settings, sign-in and viewer are all still `noindex`. The
alpha posture described here for two sessions ("deployed but unlinked, hand the
link out yourself") ended when accounts landed; see §3f.

---

## 1. The idea, in one paragraph

People ask how our video graphics are made. Rather than hand them a Remotion
studio or generate diagrams with AI, we hand them **our assets, pre-built**:
pitch views, formations, counters, arrows, bands, our palette and our motion
curve. They combine those into a system. The output looks like our channel
because they never get to choose the things that would make it not look like our
channel.

**The one mechanic the product rests on:** an Act is a *pose*, not a keyframe.
Token ids are stable across acts, so "what moves" is a join on id and the motion
between two acts is derived, never authored. The coach builds slides; we hand
back the film. Nothing else here is hard to copy — that is.

---

## 2. Decisions already made (do not relitigate without reason)

| Decision | Choice | Why |
|---|---|---|
| Where it lives | Inside `totalfootball-web`, routes under `/studio/` | Inherits theme, brand, traffic |
| Board theme | **Board is always the light paper stage**; only the chrome follows `data-theme` | The paper stage is the brand, and an exported deck must look like the videos regardless of the coach's screen setting |
| Board tech | **SVG**, not DOM | Makes export `serialise → canvas → PNG` with no server. Constrains everything: no CSS filters, no `<image href>`, no un-inlinable webfont |
| Shared code | New SVG core in the web app; **not** a shared package with `editor/` | Extracting a package first would mean refactoring 123 working compositions before shipping a feature |
| Export v1 | **A shared LINK, not a file.** See §3c. PPTX still to do |
| Video | **MP4, encoded in the browser.** See §3e | MP4 was dropped because it meant Remotion Lambda, a queue and a bill. That was an argument about the *server*, and WebCodecs does not need one. The link is still the primary export; a file is for the places a link cannot go |
| Where a shared system lives | **Stored, behind a 7-character id**: `/s/k7f3q9`. The self-contained fragment link is kept as the fallback | The fragment link was right about everything except the only thing that mattered — it was 2,000 characters, and nobody can send that |
| Who can read the shares table | **Only the function.** RLS on, zero policies, service-role key server-side | Keeps the browser holding no Supabase key at all, matching the posture in `.env.example` |
| PDF | The viewer's **print stylesheet**, not a canvas rasteriser | Walks around the unsolved font-embedding problem instead of solving it, and prints better. See §6 |
| Dark mode | The studio chrome follows the site's `data-theme`; **the board never does** | The paper stage is the brand and is what an exported deck must look like. Night mode is a property of the room, not of the diagram |
| Small screens | A **door, not a wall**: told once that it wants a laptop, offered the link for later, and let through | A coach on a touchline looking at what they built is a good reason to be on a phone |
| Watermark | **Footer credit bar**: their crest + team name left, "Made with Total Football" + our mark right | Reads as a credit line, not a watermark, so nobody tries to crop it |
| Auth | **Email + password, and Google.** Details still to be discussed | User's call, 2026-08-12 |
| Pricing | Free for adoption first, paid + affiliates later | Not built |
| An Act is called a **phase** in the UI | The type stays `Act`; `PHASE` in `editor/guide.ts` is the boundary | Coaches say "phase of play". Renaming the type across a document format to win a label is a bad trade |
| Pitch views | **Only the ones the videos actually use**, plus the upright pitch | See §3a. A view nobody has ever shot is a view nobody wants |
| Match balls | The real photographed balls from the Remotion project | The one place `<image href>` is allowed on the board. See §6 |

---

## 3. What exists

27 files, ~7,000 lines, all under `src/studio/` and `src/pages/studio/`.
Everything below is **built, typechecking, and verified by driving the real UI**.

### `src/studio/board/` — the board core

Remotion-free SVG port of `editor/src/components/football/TacticsBoard.tsx`.

- **`pitch.ts`** — geometry. One pitch at IFAB dimensions **in real metres**
  (105×68, 16.5m box, 9.15m circle); a "view" is a **crop window** onto it. The
  videos' board has four hand-tuned sets of magic percentages, which is fine
  there and wrong here, because a coach switches view mid-system and the views
  must agree about where the penalty spot is. Adding a view is four numbers.
  Also owns the **upright view's quarter turn**, which lives in the coordinate
  transform (`metresToUnits`) and not in the markup — see §6.
- **`palette.ts`** — `BOARD`, `CUE_COLOR`, `ARROW_STYLE`, `BAND_STYLE`, plus
  `darken()` and `readableText()` (WCAG relative luminance, so a yellow kit gets
  ink labels automatically).
- **`PitchMarkings.tsx`** — every marking, drawn once in metre space.
- **`Token.tsx`** — the glossy domed counter and the ball.
- **`Overlays.tsx`** — arrows (5 intents) and bands (block / danger / zone).
- **`Board.tsx`** — assembles one `<svg>`; also `clientToPercent()` and
  `clampToBoard()` for dragging.

**Three coordinate spaces. Keep them straight:**

- **metres** — the pitch. `x` 0→105 left goal to right goal, `y` 0→68.
- **units** — SVG user units, metres × `U` (=10). Only so stroke widths aren't `0.12`.
- **percent** — what a token stores: 0–100 across the **visible crop**, both axes.
  Relative to the view, not the pitch. `toMetres` / `toPercent` / `remap` bridge them.

### `src/studio/` — the document model

- **`schema.ts`** — `System` → `Act[]` → `Token[]`/`Arrow[]`/`Band[]`. One JSONB
  document. **Token `id` is stable across acts** — the note at the top of that
  file explains why everything depends on it.
- **`share.ts`** — a System, deflated and base64url'd into a URL fragment, and
  back. `CompressionStream('deflate-raw')` with an uncompressed fallback, tagged
  so the decoder never guesses. A two-phase system is a **759-character link**.
- **`formations.ts`** — **24 formations in five families**, plus a blank XI.
  Stored in team-shape space (`depth` 0→1 own goal to front line, `width` 0→1
  left flank to right flank), **not** board percentages, so they survive a view
  change. `place()` maps them in. `blank-11` is the empty squad: eleven counters
  parked along the team's own touchline, in shirt order, for a coach who has a
  shape in their head and wants a tray of magnets rather than a 4-3-3 to undo.
- **`balls.ts`** — the five real match balls from the Remotion project (Trionda
  2026 as the house default, Al Rihla, Brazuca, Jabulani, Telstar), plus a drawn
  vector ball that needs no asset. Assets live in `public/studio/balls/`, trimmed
  to the ball's alpha bounds and padded square so every one draws at the same
  diameter. `inlineBall()` is there for the exporter — **read §6 before building
  export.**
- **`tween.ts`** — `tweenActs(from, to, p)`. The house curve
  `cubic-bezier(0.16, 1, 0.3, 1)` solved properly (Newton-Raphson), plus the
  shorts' choreography: movers travel the whole beat, leavers fade by 40%,
  arrivals pop in after 55% with overshoot, arrows never linger across a beat.
- **`video.ts` / `videoRender.ts`** — the video export, split on a **bundle
  boundary**. `video.ts` is the shapes, `videoSupported()` and `saveVideo()`,
  all of it small enough to load with the editor; `videoRender.ts` carries a
  muxer, an encoder and a second copy of React's renderer and is reached through
  a dynamic `import()` when a coach presses Save. Importing `videoRender` eagerly
  puts ~50KB gzipped back on every studio page load. See §3e.
- **`storage.ts`** — localStorage. Deliberately the primary store, not a cache:
  a coach must not lose a presentation to a dropped connection, and the studio
  must be usable before anyone signs up.

### `src/studio/editor/` and pages

- **`StudioEditor.tsx`** — the editor. Drag, phase strip with live thumbnails,
  pitch/ball/formation/colour pickers, opposition toggle, cues, arrow tools,
  shaded areas, add player, Play, undo, share, start over.

  **Three things in here are easy to get wrong**, and the header comment says so
  too: every document change goes through `edit()`/`patchAct()`, which take a
  LABEL that groups a drag into one undo; selection is a player *or* a mark and
  never both, so Delete never has to guess; and the layout exists twice (beside
  the board, and stacked under it) out of panels built **once** into variables.
  Do not fork the panels.
- **`history.ts`** — undo/redo. A snapshot stack, not a command log: a System is
  a few KB, it is already serialised on every change, and a snapshot cannot get
  out of step with the document the way an inverse-command log does the first
  time somebody adds an operation and forgets to write its undo. Consecutive
  edits with the same label inside 700ms collapse, so a four-second drag is one
  undo and a typed title is one undo. An entry carries the phase that was on
  screen, and restores it — undoing a change to a phase you cannot see is
  indistinguishable from nothing happening.
- **`ShareDialog.tsx`** — sign it, then take the link. The three credit fields
  are optional and none of them blocks the link.
- **`SmallScreen.tsx`** — the door. Shown once, latched (`smallOk`).
- **`ThemeToggle.tsx`** — the same mechanism as `Header.astro`, not a second
  one: same `data-theme`, same `tf_theme` key, same theme-colour meta. The
  studio renders `bare` and so never got the site's toggle, which meant the one
  page on the site that could not honour a coach's dark mode.
- **`StudioMount.tsx`** — decides *which* system to open (`?s=<id>`, else last
  opened, else new). Kept separate so the editor stays a pure function of
  `(systemId, initial)` and Supabase can slot in here later.
- **`ui.tsx`** — panel primitives. **Must use site theme tokens only** (`paper`,
  `surface`, `ink`, …) — never a hardcoded neutral, or dark mode breaks.

### The guidance layer

This is not decoration. The tool worked and was unusable by the people it is
for, who are coaches in their fifties rather than people who use editors.

- **`guide.ts`** — **every word of guidance in one file**, plus the `PHASE`
  constant that is the boundary between the code's vocabulary and the coach's.
  Keep it here. Hints written next to the control they describe get edited when
  the control moves and forgotten when it does not, and a tool that explains
  itself wrongly is worse than one that says nothing. The rules the copy follows
  are at the top of the file; follow them.
- **`Walkthrough.tsx`** — five screens, shown once, with inline SVG drawings on
  the paper stage. Deliberately **not** a spotlight tour of the controls: where
  things are is discoverable by looking, and the idea that you pose the same
  board twice and the movement between the poses is the film is not. Step 2 is
  the only one that matters.
- **`GuideRail.tsx`** — the step-by-step rail in the right panel. Five actions in
  order, only the current one expanded. Latched, never re-derived (see
  `GuideState`): deleting your only arrow does not un-teach you what arrows are.
- **`Tip.tsx`** — real tooltips, portalled to `document.body` because both side
  panels scroll and an absolutely positioned bubble inside a scroll container is
  clipped by it. Shows on hover **and on focus**, unlike `title=`.
- **The line under the board** — in `StudioEditor.tsx`, and the highest-value
  guidance in the studio because it is the only piece in the place a coach is
  already looking. Says what to do next, in context: how to use the tool they
  just picked, that one phase does not animate, or that players are off-crop.
- **`src/pages/studio/new.astro`** — the studio. `client:only="react"`.
- **`src/pages/studio/preview.astro`** — internal proof sheet, `noindex`. All
  five views, the full mark vocabulary, the tween sampled, all 12 formations.
  Static SVG, no JS. Fastest way to catch a board-core regression.

---

## 3c. Sharing — the export that is not a file

`src/studio/viewer/` + `src/pages/studio/watch.astro`.

The plan said MP4. MP4 needs Remotion Lambda, a queue and a bill, and what a
coach means by "can I send this to the lads" is **a link that plays**. A link
plays on a phone in a changing room with no app and no account, it is never the
wrong resolution, and it is live: change a phase and the link you already sent
shows the new one.

- **`share.ts`** — publishes to `/api/share` and gets back a short id, or falls
  back to packing the whole system into the fragment. See §3d.
- **`viewer/Viewer.tsx`** — the page they land on. Renders through the *same*
  `board/Board` and the *same* `tween.ts` as the editor, so there is no second
  renderer to drift. Prev/next, dots, Play all on the house hold-then-burst
  beat, arrow keys, spacebar, and swipe — most of these links open on a phone.
- **`viewer/CreditBar.tsx`** — the watermark, and the shape of it is the policy:
  their name and club on the left, our mark on the right. A corner logo on
  somebody else's work reads as a tax and gets cropped; a credit line reads as
  authorship and nobody crops their own name off. `System.credit` is typed in
  today and comes off the profile once accounts exist, which is why it lives on
  the document rather than in the dialog's state.
- **`viewer/Mark.tsx`** — a React port of `components/brand/Mark.astro`, because
  an Astro component cannot render inside a React island. If the mark ever
  changes, grep `arrowBases`.

## 3d. The short link, and the long one behind it

`https://totalfootball.naurra.ai/s/k7f3q9` — 41 characters.

It started as a self-contained link: the whole system deflated into the URL
fragment, no server, nothing stored, nothing to rot, and the fragment never
sent to us. Every one of those properties is real and it was still the wrong
design, because it produced a two-thousand-character link. That is not a link,
it is a paragraph, and no coach is pasting it into WhatsApp. **A sharing
feature that cannot be sent has failed at the only thing it does.**

So the document is stored and the link is short:

| Piece | What it does |
|---|---|
| `supabase/004_studio_shares.sql` | `id text pk`, `doc jsonb`. RLS on, **zero policies** |
| `netlify/functions/share.mts` | `POST /api/share` publishes, `GET /api/share/:id` reads |
| `netlify.toml` | rewrites `/s/*` → `/studio/watch/` (200, so the short URL stays in the bar) |
| `System.shareId` | the id the editor remembers |

Three things about it worth keeping:

- **A share is updated in place.** The editor sends back the id it was given, so
  pressing Share twice refreshes the link the coach has already sent instead of
  minting a second one. Change a phase, press Share, and everyone who has the
  link sees the new version. The fragment link could never do that.
- **The function is the entire surface.** RLS is on with no policies at all, so
  no anon-reachable role can see the table; the only reader and writer is the
  function, holding the service-role key. The browser still holds no Supabase
  key of any kind. The validation in `invalidReason` is therefore load-bearing,
  not decorative.
- **The long link still exists, as a fallback.** If publishing fails the coach
  gets the self-contained link rather than an error, and it opens in the same
  viewer. Sharing must not fail closed. The dialog says which one they have and
  what the difference is (the fallback is a snapshot; the short one updates).

**Deploy previews cannot publish.** `SUPABASE_*` is scoped to the production
context, so on a draft deploy every share falls back to the long link. That is
correct — a preview should not be able to write to the real table — but it means
the short link can only be tested against production or `netlify dev`.

**The PDF is the print stylesheet** (in `watch.astro`, `is:global` — the
island's DOM never gets Astro's scoping attribute). The viewer already holds
every phase as live SVG in a hidden `.tf-print` sheet; printing hands that to
the browser, one phase per page, plus a cover. No jsPDF, no canvas, and
**no font embedding to get wrong** (§6). Measured on a real print: 609 text
operations and 1,075 vector paths — the type is real, selectable text — with 44
raster draws where the counters' gradients and shadows are, which Chrome
rasterises. Mostly vector, not entirely; do not claim entirely.

## 3e. The video, made on the coach's own machine

`src/studio/video.ts`, `src/studio/videoRender.ts`, `src/studio/editor/VideoDialog.tsx`.

The link is still the export. This is for the places a link will not go — a
story, a status, a group chat that flattens what you send it. You cannot post a
URL to Instagram and have it play.

The pipeline is the viewer's, driven by a clock instead of a rAF:

`timelineAt(ms)` → a pose or a blend → **`Board`** → an SVG string → an `<img>`
→ a canvas → `VideoEncoder` → an `.mp4`.

Five things about it worth keeping:

- **`renderToStaticMarkup(Board)`, not a canvas re-draw.** There is still
  exactly ONE renderer, so a video cannot drift from what the coach posed. It is
  the same rule the viewer follows and the reason both are safe to have.
- **Not `MediaRecorder`.** The obvious build is `captureStream()` +
  `MediaRecorder`, and it is wrong: MediaRecorder stamps frames by wall clock,
  so a machine that cannot rasterise a board in 33ms does not drop frames, it
  produces a video in **slow motion**. Encoding frame by frame with an explicit
  timestamp is correct on any machine and merely slower on a bad one.
- **H.264/MP4 first, VP9/WebM as the fallback.** MP4 is the only thing every
  phone, messenger and upload form accepts. `getFirstEncodableVideoCodec` picks;
  Firefox lands on WebM, which plays on a desktop and beats no file at all.
- **The hold is cached.** A four-phase system holds still for 78 of every 111
  frames. Rasterising only when the pose changes is most of the render time, not
  a micro-optimisation.
- **The grain is off.** `texture` is an feTurbulence over the whole stage — fine
  for one still, ruinous over four hundred frames, and invisible at 30fps.

Both §6 gotchas are paid for here: `inlineBall()` for the ball, and
`boardFontCss()` for the font. **The font one is no longer unsolved** — see §6.

## 3f. Accounts, the portal, and the landing page

`src/studio/account/`, `src/pages/studio/{index,login,portal,settings}.astro`,
`supabase/005_studio_accounts.sql`.

Five routes now, and what is public matters:

| Route | Who | Indexed |
|---|---|---|
| `/studio/` | anyone | **yes — the only indexed /studio/ URL** |
| `/studio/login/` | anyone | no |
| `/studio/new/` | **signed in** | no |
| `/studio/portal/` | signed in | no |
| `/studio/settings/` | signed in | no |

**The studio is behind the door.** It was open for two sessions and that call
was reversed (user, 2026-08-13): `StudioMount` sends a signed-out visitor to
`/studio/login/?next=…` and brings them back afterwards. `/studio/` is the front
door now, and it is public precisely so there is something for a search engine
and a first-time visitor to see.

**localStorage-first is not vestigial because of that.** It is still what keeps
the editor alive through a dropped connection mid-session, still what makes the
autosave instant, and still the only copy that exists in the two seconds between
a change and the upload.

**`claimLocalSystems` still runs**, and still matters: anyone who built
something during the open alpha has work in their browser and nowhere else, and
the first sign-in is what rescues it. It keeps ids and uses `ignoreDuplicates`,
so signing in on a second machine cannot let that machine's stale copies
overwrite the cloud.

**A trap worth knowing:** with no Supabase env, `accountsEnabled` is false, every
session resolves to `out`, and the studio redirects to a sign-in page that cannot
sign anyone in. That page therefore must NOT link back to `/studio/new/` — it
would bounce a visitor between two pages forever. It links to the library.

**The write-through cache is real now** (`account/sync.ts`), and the order is
not negotiable: localStorage synchronously at 400ms, Supabase debounced behind
it at 2s. A failed upload is a "not yet", not an error — no dialog, no retry
queue, no banner. The toolbar says "Saved" when it lands and says nothing when
it does not, because a coach cannot act on "could not reach the server" and
their work is already safe either way.

**`StudioMount` now waits for the session before deciding.** Local, then the
account if signed in, then a fresh board. Deciding "not in localStorage, make a
new one" while the session is still restoring would hand a coach a blank board
and then autosave it OVER the system they asked for. That is the one thing that
file must never do, and it is why `useSession` has an `unknown` state rather
than a boolean.

**The posture change of §5 has happened.** The browser holds the anon key,
`PUBLIC_SUPABASE_*` exist, and RLS on `studio_profiles` / `studio_systems` is
the actual boundary rather than a second opinion. The service-role key is
unchanged and still server-side only; tables 001–004 still grant nothing to
anyone and are still reached only through their functions. `.env.example`
explains why the two postures coexist — read it before "fixing" the apparent
contradiction.

**Not built yet:** password reset, email change, account deletion, and the
crest upload (the settings page is name/club/colour only). `withProfile` seeds a
new system from the profile; it never edits an existing document.

## 3a. Where the pitch views came from

Counted across the 108 tactics shorts in `editor/src/`. There are exactly three
sets of pitch markings in the whole project, and this is all of them:

| Markings set in `TacticsBoard.tsx` | Shorts | Studio view |
|---|---|---|
| `PitchMarkings` — half pitch, goal on the right | **72** | `attacking-half` / `defending-half` |
| `FullPitchH` — full pitch, horizontal | 22 | `full` |
| `FullPitchMarkings` — full pitch, **vertical** | 17 | `full-vertical` |
| a third of a pitch as its own view | **0** | — |

**There has never been a "third".** Every close-up in the library is the
half-pitch board with the camera pushed in (`scale: 2.0–2.5` on `Camera`), which
lands on roughly the box and its approaches — that is `attacking-box`, and why
it is cropped to 31m rather than a tidy 35m third. `middle-third` corresponded
to nothing we have ever published and is gone; `resolveViewId()` maps both
retired ids for documents that still name them, and `storage.ts` migrates on
read.

If you are tempted to add a view, count it in the shorts first.

---

## 4. Still to build

1. ~~**Supabase auth + persistence**~~ — **built.** See §3f. What is left of this
   item: password reset, email change, account deletion, and the **crest upload**
   (needs a storage bucket; settings is name/club/colour only today).
2. **PPTX** (`pptxgenjs`) — the one export still missing, and the only one a
   club analyst will ask for by name. It needs a raster of each board, and both
   halves of that are now built: `frameSvg`/`raster` in `videoRender.ts` do
   exactly this per frame, and the **font** and **match ball** gotchas of §6 are
   paid for there. PNG-per-act is the same call without the encoder. The share
   link and the print PDF cover everything else.
3. ~~**`/studio` landing + library + settings**, and a nav entry~~ — **built.**
   See §3f. The studio is no longer unlinked: `/studio/` is in the header nav and
   in the sitemap.
4. **Move the ball assets to a Supabase bucket** when we go live. Only `src` in
   `balls.ts` changes, and every consumer already goes through it.
5. **Short share links.** Once there is a server, a stored share becomes a short
   URL resolving to the same viewer. The self-contained link stays — it is the
   one you can send to somebody who will never sign up, which is most coaches.

Editor gaps, in order:

- **No onion-skin.** When posing phase 3 you cannot see phase 2's positions. A
  ghost of the previous phase under the board would make posing much faster, and
  it is the natural companion to the "a phase is a moment" idea the walkthrough
  teaches.
- **A worked example a coach can open.** "Show me one" beats any amount of
  instruction, and we have 123 published systems to adapt one from.
- **Touch.** The tooltips deliberately do not fire on touch. The line under the
  board now carries each tool's full "what + when" while it is armed, which
  covers the tools; the rest of the panels are still hover-only on an iPad.
- **A phase-by-phase `?` on the rail's current step** that highlights the actual
  control it is talking about. Cheap now that every control has copy attached.

---

## 5. One posture change needed for auth

`.env.example` currently says the Supabase keys are *"never referenced from a
browser bundle."* Real auth needs the anon key client-side — that is what it is
for, with RLS as the actual security boundary. Add `PUBLIC_SUPABASE_URL` and
`PUBLIC_SUPABASE_ANON_KEY` and **update that comment to explain why**. The
service-role key stays server-side forever.

---

## 6. Gotchas — every one of these was a real bug, found by looking

**If the studio renders but nothing responds, it is the Vite cache.**
`rm -rf node_modules/.vite && npm run dev`. A dev server started before the
project had any React file caches a dependency bundle with no JSX in it, and
every render then throws `TypeError: jsxDEV is not a function`. The page looks
fine and is completely inert. Cost an hour; note the port may move on restart.

**SVG clips to the viewport, not the viewBox.** On any letterboxed container the
full-length pitch draws straight through the crop — "defending half" was showing
the far penalty area and a whole centre circle. `Board.tsx` enforces the crop
with an explicit `clipPath`. Do not remove it.

**Give the board container a HEIGHT (or `aspect(view)`).** Counters are sized in
metres, which only stays consistent between views because all five crops share
the 68m width. Fit by height and a counter is the same on-screen size in every
view; fit by width and the final third looks like tiddlywinks.

**We attack right, they attack left, on every view** — including
`defending-half`, which means the half containing *our* goal, not a change of
direction. A block band closes to the goal **its own players** defend
(`defendedGoalX(side)`), never to a goal derived from the view — that bug shaded
the entire pitch from our back four to the opposition's goal.

**Sizes are in metres and must be converted at draw time.** `strokeDasharray` is
in user units, so a dash stored as `"1.6 1.1"` means 16cm of ink and renders
solid. `ARROW_STYLE.dash` is a metre tuple, converted in `Overlays.tsx`.

**No blur filters.** `feGaussianBlur` and CSS `filter: blur()` both resolve
against device space, so they land differently once serialised for a PNG. Soft
shadows are gradient ellipses.

**Changing pitch view must stay non-destructive.** It remaps every mark through
metres (`remap()`). The first version re-placed both formations and deleted
every arrow in every act. Players outside the new crop stay in the document and
reappear when the view widens; `Re-place shapes` is the deliberate reset. Correct
— and baffling from the outside, because picking "Their box" from a full-pitch
4-3-3 makes ten players silently disappear. The line under the board counts them
and says so. **Keep that in step with any change here.**

**The upright view's quarter turn is in the COORDINATES, not the markup.**
`metresToUnits()` bakes it in, and every mark — counters, ball, arrows, bands —
is positioned through it and then drawn with no transform of its own. Wrapping
the board in an SVG `rotate()` is the obvious version and it turns every counter
label, cue chip and arrow caption on its side. The pitch markings are the one
exception (`boardTransform`), because they carry no text. Two consequences worth
knowing: a `<rect>` zone comes out with a negative width after the turn and has
to be normalised, and `defendedGoal()` returns an **axis** as well as a position,
because the goal line a block band closes to stops being vertical.

**The upright view's counters are smaller, and that is correct.** All the
horizontal views share the pitch's 68m width, so a board fitted by height draws
a counter at the same on-screen size in every one of them. Upright, the 105m
axis is the one running down the screen, so the same fit shows half again as
much pitch. Do not "fix" it by rescaling the counters — you would be making the
board lie about distance.

**The match ball is the one external reference on the board, and it will
silently vanish from every exported slide if you forget it.** A canvas will not
fetch `/studio/balls/trionda.png` out of a serialised SVG — it does not error,
the ball is just gone. The exporter must call `inlineBall()` and pass the result
as `Board`'s `ballHref`. Budget ~110KB per slide, or fall back to the `classic`
vector ball, which needs no asset and always exports.

**`pointer-events: none` on a `<g>` does not stop its children being clicked**
— it is an inherited property, and a child that sets `pointer-events="stroke"`
overrides it. That is load-bearing rather than a curiosity: `Overlays.tsx` draws
every arrow inside `<g pointerEvents="none">`, and the fat invisible hit-stroke
that makes an arrow selectable lives *inside* that group and works anyway. An
arrow is 4cm of ink and nobody can click 4cm of ink, so the hit area is 2.2m
wide and transparent.

**Marks are only pickable while the Move tool is armed.** `Board.tsx` takes the
`onArrowPointerDown` / `onBandPointerDown` handlers only then. Pass them
unconditionally and a coach can no longer start a new arrow on top of an old
one, which is most of the arrows they draw.

**`tweenActs` eases its own `p`.** Pass it linear time. Feeding it
`easeHouse(p)` eases twice and lands somewhere nobody chose — the viewer's
manual step did exactly this for one commit and just looked *slightly* wrong,
which is the worst kind of wrong.

**The block band's line is found in METRES, not percent.** Percent is
percent-of-crop, so a seven-metre gap between the back four and the midfield is
7% of a full pitch and 23% of the box view. A percentage threshold finds a
different back line depending on how far the camera is pushed in.

**A close-up cannot hold two full teams**, and `place()` no longer pretends it
can — see `castFor` in `formations.ts`. Two rules keep the result looking
deliberate: the cast is chosen by whose natural position is nearest the crop
(so a 4-3-3 and a 5-4-1 each give up the right players), and **lines are never
split**, so a cap that would strand one centre-back on the board stops short
instead. The caps are ceilings, not targets. Nothing is deleted by any of this;
widening the view and pressing `Re-place shapes` fills it back up.

**Font embedding was the open problem in every canvas export. It is solved —
use `boardFontCss()`.** Board text uses Inter, and when an SVG is serialised and
drawn into a canvas, webfonts do **not** resolve: the export silently falls back
to a system font, and looks fine on the machine that made it while being wrong
for everyone else. `videoRender.ts` fetches the latin variable subset once and
embeds it as a base64 `data:` URI in a `<style>` on every frame.

Two notes for **PPTX and PNG-per-act**, which must call the same function:

- **It is not subset, and cannot be.** A coach can type any player name they
  like, so there is no safe glyph set to reduce to. ~48KB per serialised
  document. That is a real cost on a deck of stills and a rounding error next to
  the encoder on a video.
- **It fails soft.** A failed fetch returns `''`, which costs the typeface and
  not the export. If you need the type to be right, check the return value.

The PDF still sidesteps all of this by printing the live DOM (§3c), where the
font is already loaded and the ball is a normal `<img>` the browser fetches.

---

## 7. Judgement calls you may want to overrule

- **Teams start split down the middle, not interleaved.** A clean arrangement to
  drag from beats an accurate pile. With no opposition, our shape widens to take
  most of the board (`SOLO_BANDS`).
- **On half and box views, all 11 of both teams are still placed**, compressed
  into the crop. Nothing is silently dropped, but a coach on `defending-half`
  gets an opposition keeper they will probably delete.
- **Counters say `CB`, not `LCB`.** The slot id stays `LCB` so tweens work;
  three letters do not read in a circle and coaches chalk two.
- **`HOLD_MS = 2600`, `MOVE_MS = 1100`** in `tween.ts` — hold-then-burst, from
  the pacing note in `MiniBoard.astro`. Untested against a real audience.
- **The blank XI parks on the touchline, not scattered on the grass.** A tray of
  magnets in shirt order, GK first, so it empties in the order anyone names a
  team. `Re-place shapes` relabels itself to "Back to the touchline" when the
  blank shape is picked, because "re-place" implies a shape it does not have.
- **The walkthrough shows on first run and cannot be turned off permanently**,
  only skipped — and `seen` latches either way, so it never reappears uninvited.
  The `?` in the header brings it back.
- **The rail's steps are actions, not settings.** "Move a player", not "choose a
  formation". A step you complete by doing nothing teaches nothing, and a coach
  who opens the studio already has a 4-3-3 on the board.
- **`Add player` adds to the current phase only**, matching `Remove from this
  phase`. Adding to every phase is arguably what a coach means, but it would be
  the only control in the studio that reaches across phases without saying so.
- **The phase strip has two pairs of arrows, and they are kept apart on
  purpose.** Navigation (`‹ ›`, plus the left/right arrow keys) flanks the
  strip where a carousel would put it; reordering says the word "Move" and sits
  behind a divider with Delete. They were one pair that reordered, and every
  coach who met them read them as "next phase" — reasonably, since they sat
  under a row of thumbnails.
- **"Start over" is a two-press button, not a modal.** A confirm dialog is a
  second window to read, it lands away from the thing it is about, and coaches
  dismiss it without reading exactly like everyone else. The button becomes the
  question. It is also undoable, which is what lets it be a button at all.
- **Zones are drawn by dragging; the block is computed.** Sitting them in one
  panel is what finally made "Add block" legible — one is worked out from your
  players, two are drawn where you say.
- **Caption and description are two fields, not one long one.** They are read at
  different distances: the caption while a room is looking at the board, the
  description off the printed page or by the assistant who was not there. One
  field would have to be short enough for the first job, which makes it useless
  for the second.

---

## 8. Running and checking it

```bash
npm run dev          # studio at /studio/new/, proof sheet at /studio/preview/
npm run build        # astro check + build; both pass
```

Verify by **driving the UI**, not by screenshotting it. A CDP driver
(`drive.mjs`, written to scratch each session — recreate if useful) clicks and
drags over the DevTools protocol using Node's built-in `WebSocket`, and reports
console errors. Clear `localStorage` at the start of a run or you will measure
the previous run's leftovers.

**Two ways the driver will lie to you, both of which cost a run this session:**

1. **`document.querySelector('main svg')` is not the board.** The site layout
   has its own `<main>`, so that selector returns the ball picker's 32px icon —
   and a "pass drag" computed from its bounding box lands in the left panel and
   clicks a ball button instead. Target
   `svg[aria-label$="tactical board"]`, widest first.
2. **Both side panels scroll.** A control scrolled out of its panel still
   returns a real viewport coordinate, so the click lands on whatever is
   actually at those pixels and the driver reports success. `scrollIntoView`
   first, then assert the rect is inside the viewport before clicking.

And two more, both from the second session, both of which produced a green run
that meant nothing:

3. **Autosave is debounced 400ms.** Read `localStorage` any sooner and you are
   asserting against the state before your own click. Every read in the driver
   sleeps ~550ms first. This one is nasty because the *previous* assertion's
   value is usually still plausible.
4. **Assert on the thing you actually touched.** A drag that grabs empty grass
   changes nothing, and a driver printing "the first four tokens" prints four
   identical rows before and after and calls the undo test passed. Target a
   counter by its printed label (`svg text` whose content is `DM`), and assert
   on *that* token's coordinates by id.

Last clean result — the editor:

```
PHONE (390×844)   door shown → Carry on here anyway → walkthrough → stacked
                  layout with the Set up / This phase tabs, board 366px
DESKTOP           no door
                  dragged DM → undo (moved back) → redo (restored)
                  Pass drag → 1 arrow, tool reverted to Move
                  clicked the arrow on the board → "Delete this arrow"
                  Delete key → 0 arrows
                  two passes → deleted one from the list → 1 left
                  Our block → us-LB,us-LCB,us-RCB,us-RB (found the back four)
                  Danger area dragged → block+danger
                  ‹ › and the arrow keys step phases; Move ↤ reorders them
                  their box → "6 of yours" → Re-place → 6 us + 5 them
                  night mode → data-theme=dark, board still on paper
                  Start over → 1 phase → undo → everything back
--- CONSOLE --- (clean)
```

And the share flow:

```
built 2 phases with a description → Share → signed
link: 759 chars   opened in a new tab → title, caption, description, credit bar
                  → key steps phases → Play all → print sheet: 3 pages
                  (cover + 2), 609 text ops, 1075 paths, 44 rasters
--- CONSOLE --- (clean)
```

The proof sheet is static SVG with no JavaScript. It is the fastest regression
check for the board core — and note that it looked perfectly fine while the
studio was completely dead, so it proves the *drawing*, never the *app*.

---

## 9. Committed and deployed

The studio is committed to `main` and deploys with the site (Netlify, build from
`npm run build`, publish `dist`). It ships **unlinked**: no nav entry, `noindex`
on `/studio/new/`, `/studio/watch/` and `/studio/preview/`, and no `/studio/`
URLs in the sitemap. Hand people the link.

The three routes:

| URL | What it is |
|---|---|
| `/studio/new/` | The studio. Opens on the last system, or a fresh one |
| `/s/k7f3q9` | A shared system. **The link a coach sends** |
| `/studio/watch/#s=…` | The same viewer, fallback form: the link carries the document |
| `/api/share`, `/api/share/:id` | Publish and read. The only door to `studio_shares` |
| `/studio/preview/` | Internal proof sheet. Static SVG, fastest board-core check |

The ball assets are derived, not authored: they are trimmed and squared copies of
`editor/public/{trionda,al-rihla,brazuca,telstar}.png` and
`editor/public/uruguay-ghana/jabulani-transparent.png`. If one needs regenerating,
trim to the alpha bounding box and pad back to a square before resizing — an
off-centre source makes the ball sit beside the spot the coach dropped it on,
which reads as a bug in the drag rather than a bug in the asset.
