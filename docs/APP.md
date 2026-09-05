# The App — build plan and handoff

A native SwiftUI client for the studio, for iPhone and iPad.

Read `docs/STUDIO.md` first. This document does not restate what the studio is;
it says what changes when the studio is a native app, what must not change, and
in what order to build it. Where the two disagree, STUDIO.md wins on product and
this wins on platform.

---

## 0. What this is, in one paragraph

The studio is a drag-and-drop tactics board that stores one presentation as one
JSON document, and derives the film between poses rather than asking anybody to
author keyframes. All of that already works, on the web, against a Supabase
database with Row Level Security doing the real access control. The app is a
**second client onto the same database and the same document format**. It adds
nothing to the backend. Its whole job is to be the client a coach reaches for on
a touchline, on a bus, and on an iPad on the grass, where a laptop is not.

---

## 0a. The scope decision (taken 2026-09-05)

**The app is the studio. It is not the network.**

`docs/SOCIAL.md` Phases 2a and 3 — publish, feed, reactions, comments, reposts —
are built on disk and **not committed**. They are out of scope for v1 and are
not planned into any phase below. The app targets what is on `main`:

| in | out |
|---|---|
| The board, and every mark on it | The feed |
| Systems: make, open, edit, play | Posts, `/p/<id>` |
| Folders, sequences, templates | Reactions, comments, reposts |
| Identity, kit, squad, team members | Public profiles by handle |
| Share links (`/o/<slug>`) | Publishing |
| Export: still, sheet, film | Anything in `src/studio/social/` |

When the network ships on the web and is committed, it comes to the app as its
own phase, reading the same `studio_feed` RPC the web reads. Nothing in this
plan blocks that. Nothing in this plan waits for it either.

---

## 1. Decisions locked (do not relitigate without reason)

1. **Native rendering. No WKWebView, anywhere.** The board is drawn with
   SwiftUI `Canvas` against a pure-Swift port of the engine. A feed of web views
   is ten JavaScript heaps and ten `requestAnimationFrame` loops behind one
   scroll view, and it forecloses gestures, offline, and film export. Decided by
   the user, 2026-09-05.

2. **iPhone and iPad. No Mac target in v1.** `TARGETED_DEVICE_FAMILY = "1,2"`.
   Coaches on a MacBook keep the web studio, which is better on a laptop and
   says so (`editor/SmallScreen.tsx`). If the Mac is ever wanted, it is Catalyst
   and it is a phase, not a checkbox.

3. **The document format does not fork.** `System`, `Act`, `Token`, `Arrow`,
   `Band`, `TextMark`, `BallMark`, `GearMark` are the same shapes as
   `src/studio/schema.ts`, byte-compatible on the wire, and **unknown keys
   survive a round trip**. See §5, which is the single most important section
   in this document.

4. **The backend is finished.** No new tables, no new RPCs, no new buckets, no
   Edge Functions for v1. Every screen below is served by something that already
   exists and already has an RLS policy on it. If a screen seems to need a
   migration, the screen is wrong.

5. **The anon key ships in the binary.** It is a project identifier, not a
   secret, exactly as `src/studio/account/client.ts` argues for the browser and
   as `aiparastatika-ios/Core/Config.swift` does in Swift. The service-role key
   never comes near the app.

6. **The account is the source of truth. The device is a buffer.** STUDIO.md
   §3i, restated for iOS. The local store is scoped per user id and wiped on
   sign-out, for the reasons `src/studio/scope.ts` sets out at length — those
   were real bugs and they will happen again on a shared iPad if this is
   forgotten.

7. **No em dashes in anything rendered onto a board or exported.** The standing
   rule. It applies to plates, captions and share copy, not to this file.

---

## 2. Answering the upright-board question

> "For iPhones we can make it open vertically for better experience. Is that a
> good idea?"

**Yes, and it costs almost nothing, because the engine already does it.**

`PitchView` carries a `vertical` flag. `PITCH_VIEWS['full-vertical']` exists
today and its own `useFor` string reads: *"The one for phone screens."* The
quarter turn is not a display hack bolted on top — it is threaded through the
geometry properly, in exactly one place each:

- `metresToUnits()` bakes the turn into every coordinate, so counters, labels,
  captions and text notes come out **upright on a turned pitch**. They are not
  rotated and then un-rotated; they are placed correctly the first time.
- `boardTransform()` turns the pitch markings, **and nothing else**.
- `cropRect()` swaps the crop's width and height about the same centre.
- `aspect()` returns `h/w` instead of `w/h`.

And `Board`'s `view?: PitchView` prop is the sanctioned override, with a
docstring that already blesses this exact move: *"It must be the coach's view
with `pad`/`vertical` changed and NOTHING else."* The mp4 exporter already uses
it to stand the pitch up for a 9:16 frame. **An iPhone in portrait is a 9:16
frame.** This is the same requirement, already solved.

So the rule for the app:

```
if device is iPhone in portrait and aspect(view) > 1:
    render through view with vertical = true      ← display only
```

Three things to get right, all of them called out by the engine's own comments:

1. **Never write the flag to the document.** `System.pitch` is the coach's
   choice and it is what everyone else sees. A coach who opens a board on a
   phone and saves it must not silently turn it upright for the assistant on a
   laptop. The override lives on the view passed into the renderer, not on the
   doc. This is the one way to get this feature wrong, and it is a data bug, not
   a display bug.

2. **Counters come out smaller upright, and that is not a bug.** `aspect()`'s
   docstring: the horizontal views all share the pitch's 68m width, so a board
   fitted by height draws a counter the same size in all of them; upright, the
   105m axis runs down the screen and you are simply seeing more pitch. The
   lever if it reads too small is `PitchView.counter`, which is a per-view
   multiplier that exists for precisely this and is documented as such. Set it
   on the override, measure it, do not guess it.

3. **Do not turn what is already turned.** `attacking-set-piece` and
   `defending-set-piece` are vertical already; `training` is a square-ish grid
   that gains nothing. Hence the `aspect(view) > 1` guard rather than a blanket
   flip.

On iPad, and on an iPhone held sideways, render the coach's own view unchanged.

---

## 3. What the app is made of

Five layers, bottom up. Each one is testable without the one above it, and the
dependency arrows only point down.

```
┌─────────────────────────────────────────────────────────────┐
│  Features/   Portal · Editor · Viewer · Squad · Settings    │
├─────────────────────────────────────────────────────────────┤
│  Components/ Card, Chip, EmptyState, board host, act strip  │
├─────────────────────────────────────────────────────────────┤
│  Core/       Supa · Session · API · Store · Theme · Format  │
├─────────────────────────────────────────────────────────────┤
│  TFDoc/      System, Act, Token … Codable, lossless         │
├─────────────────────────────────────────────────────────────┤
│  TFBoard/    pitch · surfaces · tween · camera · draw       │
└─────────────────────────────────────────────────────────────┘
```

`TFBoard` and `TFDoc` are **Swift packages with no UIKit and no SwiftUI import
outside the draw layer**. That is not architectural neatness for its own sake:
it is what lets the parity check in §6 run them headless from a command line and
compare numbers against the TypeScript, which is the only way this port stays
honest.

`Core/` is a direct lift of the shape that already works in
`aiparastatika-ios/Aiparastatika/Core/` — `Supa.swift`, `SessionStore.swift`,
`API.swift`, `Theme.swift`, `Format.swift`, `AppRouter.swift`. That app is
shipping, its session handling survives token refresh and cold start, and its
adaptive-colour trick (a `UIColor` dynamic provider behind every `Color`) is
exactly what the studio's four themes need. Copy the skeleton; do not redesign
it.

### 3a. What ports, and how big it is

| Source (TS) | lines | Swift home | est. |
|---|---|---|---|
| `board/pitch.ts` | 1281 | `TFBoard/Pitch.swift` | 900 |
| `board/surfaces.ts` + `palette.ts` | 861 | `TFBoard/Surfaces.swift` | 550 |
| `tween.ts` | 528 | `TFBoard/Tween.swift` | 400 |
| `camera.ts` | 662 | `TFBoard/Camera.swift` | 450 |
| `arrows.ts` `balls.ts` `gear.ts` `pace.ts` | 832 | `TFBoard/Marks.swift` | 550 |
| `board/PitchMarkings.tsx` | 449 | `Draw/Markings.swift` | 400 |
| `board/Token.tsx` | 743 | `Draw/Token.swift` | 600 |
| `board/Overlays.tsx` | 1066 | `Draw/Overlays.swift` | 850 |
| `board/Board.tsx` | 1065 | `Draw/BoardView.swift` | 500 |
| `schema.ts` (types + carryForward) | 1648 | `TFDoc/` | 900 |
| **engine total** | **~8,100** | | **~6,100** |
| `account/*` + `storage.ts` + `sequences.ts` | ~3,200 | `Core/` | ~1,800 |
| `editor/StudioEditor.tsx` + `ui.tsx` + dialogs | ~14,000 | `Features/Editor/` | ~5,000 |

The editor shrinks by more than half on the way across, and that is the honest
number rather than an optimistic one. `StudioEditor.tsx` carries a great deal
that SwiftUI simply has: pointer-event normalisation, focus management, portal
and z-index plumbing, a hand-rolled control library in `ui.tsx`, and the
walkthrough and help machinery. What does not shrink is the geometry, and the
geometry is the part that must be right.

### 3b. Why the port boundary is clean

`Board.tsx` says it in its own header: *"The component is pure. It takes a
resolved `RenderAct` — a pose, or a blend of two poses from `../tween.ts` — and
draws it. It owns no state."* And: *"one `<svg>`, everything inside it … no
external references"*, with exactly two exceptions, both photographs, both
already passed in as data.

A pure function from `(System, RenderAct, PitchView)` to a picture is the ideal
thing to port. Every SVG primitive it emits has a direct Core Graphics
equivalent:

| SVG | SwiftUI `Canvas` |
|---|---|
| `<path d=…>` | `Path` + `context.stroke/fill` |
| `radialGradient` (the counter dome) | `.radialGradient(_:center:startRadius:endRadius:)` |
| `clipPath` (kit stripes, hoops, sash) | `context.clip(to: Path)` |
| `stroke-dasharray` | `StrokeStyle(dash:)` |
| `<text>` | `context.draw(Text(...))`, Inter bundled |
| `<pattern>` (hatch, line band fills) | generated `Path` inside a clip |

There is no filter, no webfont we cannot inline, and no CSS. That was a
deliberate constraint of the export strategy, and the app inherits the benefit.

---

## 4. The phases

Every phase ends at something installable on a real device. Do not start one
before the one before it is checked in and working.

| # | Name | Ships | Depends on |
|---|------|-------|-----------|
| 0 | **Foundations** | Project, Supabase, auth, theme, nav shell | — |
| 1 | **The engine** | `TFBoard` + `TFDoc` + the parity check | — |
| 2 | **Read and play** | Portal, viewer, share links, first TestFlight | 0, 1 |
| 3 | **Identity** | Profile, kit, squad, team members, prefs | 2 |
| 4 | **The editor** | Posing, tools, acts, undo, save | 2 |
| 5 | **Out of the app** | Still, sheet, film, share sheet | 4 |
| 6 | **Ship** | Offline buffer, deep links, App Store | 5 |

Phases 1 and 4 are the work. Everything else is a fortnight or less.

### Phase 0 — Foundations

Lift `aiparastatika-ios/Aiparastatika/Core/` wholesale and change the names.

- `Config.swift` — `https://bewvowkkikxsjcfnkeot.supabase.co` and the anon key
  from `.env` `PUBLIC_SUPABASE_ANON_KEY`.
- `Supa.swift` — one `SupabaseClient`, one `JSONDecoder` with
  `.convertFromSnakeCase`. Every call in the app goes through it so the JWT is
  shared without header plumbing. SPM: `supabase-swift`, up to next major from
  2.46.0.
- `SessionStore.swift` — the `authStateChanges` loop, unchanged in shape. Drop
  the `lookup_login_email` RPC; this project signs in with a real email.
- `Theme.swift` — but **four themes, not two**. `light`, `dark`, `pitch`,
  `pitch-night`, with the hexes read off `src/styles/global.css` `--tf-*`. The
  adaptive `Color(light:dark:)` initialiser is the wrong shape for four, so this
  becomes a `ThemeTokens` struct resolved from an `@AppStorage` choice and put
  into the environment. Note the distinction `src/lib/theme.ts` makes and keep
  it: **a theme is chrome only. It is not the board.** What the board is drawn
  on is `System.surface`, stored on the document.
- Navigation: `TabView` on iPhone, `NavigationSplitView` on iPad, both driven by
  one `AppSection` enum — the pattern in `App/MainView.swift`, including the
  `.tag(section)` fix its comment warns about, which is a real iPad-only bug.
- Fonts: bundle Inter (variable), which the site already depends on.

**Auth.** Today the studio offers email + password (`signInWithPassword`,
`signUpWithPassword`) and Google (`signInWithOAuth`). Both port directly.

> **App Store guideline 4.8.** Offering Google sign-in on iOS obliges you to
> offer **Sign in with Apple** alongside it. This is a review rejection, not a
> nicety. `supabase-swift` supports it through `signInWithIdToken`, and
> NaurraAI already carries the equivalent dependency, so the precedent exists.
> Add Apple as a third button; it creates an ordinary `auth.users` row and every
> RLS policy keeps working untouched.

Google OAuth needs a redirect back into the app: register a URL scheme, add it
to the Supabase project's allowed redirect URLs, and hand
`SupabaseClientOptions` the deep-link handler.

### Phase 1 — The engine

The spine. Nothing else can be trusted until this is.

Port in dependency order, and **port whole files, not the parts a screen needs
today** — a half-ported `pitch.ts` is worse than none, because the missing half
is discovered by a board that is subtly wrong rather than by a compiler.

1. `TFDoc` — the Codable types (see §5, first).
2. `Pitch.swift` — `PITCH_VIEWS`, `metresToUnits`, `unitsToMetres`, `cropRect`,
   `boardTransform`, `aspect`, `toMetres`, `toPercent`, `trainingView`,
   `benchLayout`, `defendedGoal`.
3. `Surfaces.swift` — the four surfaces, `BoardPalette`, `cueColor`,
   `arrowStyle`, `bandStyle`, band tones/strengths/edges/fills/strings/corners.
4. `Tween.swift` — `easeHouse`, `resolveAct`, `tweenActs`, `timelineAt`,
   `totalDuration`. This is where the film comes from.
5. `Camera.swift` — `shotFor`, `lerpShot`, `cameraRect`, `cameraViewBox`,
   `trackedBall`, `pushAt`.
6. `Draw/` — markings, token, overlays, board.

Deliverable: a `BoardView(system:act:view:)` that draws a document, and a
`BoardPlayer` that drives it from a `CADisplayLink` through `timelineAt`.

### Phase 2 — Read and play

The first thing worth putting on a phone, and the first TestFlight.

- **Portal** — `studio_systems` for the signed-in user, ordered by `updated_at`,
  grouped by `studio_profiles.folders`. Title comes from the generated `title`
  column, so the list does not parse jsonb. Open, duplicate, rename, delete.
- **Viewer** — a system played end to end, with the phase strip, captions, act
  titles and notes. On iPhone this is where §2's upright override earns itself.
- **Share links** — `studio_shares` by slug, the read path behind `/o/<slug>`.
- **Sequences** — `studio_sequences`, read-only for now: a coach's own
  vocabulary, listed and played.

No editing. No writes except delete and rename. Ship it and watch somebody use
it on grass.

### Phase 3 — Identity

All of it is `studio_profiles`, `studio_squad`, `studio_team_members` and
`studio_prefs`, and all of it has policies already.

- Profile: presenter, team, role, bio, licence, links, visibility.
- Kit: `team_colour`, `kit_pattern`, `kit_ring`, `kit_alt`, `opponent_colour` —
  and the counter preview drawn by the real `Draw/Token.swift`, not a mock.
- Crest: `crests` bucket, **public**. Avatar and player photos: `players`
  bucket, **private** — signed URLs, and they expire; do not cache the URL, cache
  the image against the storage path.
- Squad: `studio_squad` with the cap trigger, drag to reorder via `sort`,
  camera and photo library for headshots (`NSCameraUsageDescription` and
  `NSPhotoLibraryUsageDescription` in the plist).
- Team members: `studio_team_members` with the eight permission booleans, and
  `studio_resolve_invitee` to find somebody by handle or email.
- Prefs: `studio_prefs_merge(p_guide, p_view, p_last)`. **Merge, never
  overwrite.** The function is a deep merge for a reason: an app that PUTs its
  whole view-prefs object will erase the web's furniture settings on every
  launch.

### Phase 4 — The editor

The biggest phase, and the one to design rather than port.

The web editor is a board with a panel down each side and it needs 900px to be
itself — `SmallScreen.SMALL_WIDTH`. That layout does not survive an iPhone, and
copying it is the way to build something nobody uses on the device they actually
have with them.

- **iPad** is close to the web: board centre, tool rail leading, inspector
  trailing, act strip along the bottom. Apple Pencil for drawing arrows and
  bands is the thing this app can do that the web cannot, and it should be
  planned for from the first sketch rather than added later.
- **iPhone** is a board and one context bar. Select a token, the bar becomes
  that token. Select nothing, it is the act. Tools live behind one button.
  Everything else is a sheet. The act strip is a horizontal scroller.

Order within the phase, each step usable before the next:

1. Pose: drag a token, snap guides from `board/align.ts`, `unitsToMetres` on
   drop. Persist through `studio_systems_save`.
2. Acts: add, duplicate, reorder, delete — and `carryForward*` from
   `schema.ts`, which is what makes an edit in act 2 propagate forward and is
   the least obvious correct behaviour in the whole product.
3. Marks: arrows, bands, texts, gear, balls.
4. Lineup, formations, templates, squad pick, bibs.
5. Pace, camera, push, tracked ball.
6. Undo/redo — `editor/history.ts` is a plain stack over whole documents.

**Saving.** `studio_systems_save(p_id, p_doc, p_base)` takes a base timestamp
and rejects a stale write. That is optimistic concurrency and it must surface as
a real conflict, not a silent overwrite: a coach editing on an iPad while a
laptop has the same board open is the normal case, not the edge case. Show what
happened and let them choose.

### Phase 5 — Out of the app

- **Still**: render `BoardView` to a `CGImage` via `ImageRenderer`. This is one
  call, because the board is already a pure function of the document.
- **Sheet**: the phases printed on one page, `viewer/PrintSheet.tsx`'s job,
  straight to PDF via `UIGraphicsPDFRenderer`.
- **Film**: `AVAssetWriter` + `AVAssetWriterInputPixelBufferAdaptor`, fed frames
  from the same renderer at the document's own pace from `Tween.swift`. This is
  **easier on iOS than on the web** — `videoRender.ts` is 1,288 lines largely
  because WebCodecs and canvas rasterisation are hard; AVFoundation is a
  well-lit path. Read `videoRender.ts`'s header for the two traps it already
  paid for (`docs/SOCIAL.md` §4b) before writing a frame loop.
- **Share sheet**: `UIActivityViewController` for all three, plus the share
  link. This is the payoff of being an app.

### Phase 6 — Ship

- **Offline buffer.** The device store, per §1.6 and `scope.ts`: keyed by user
  id, wiped on sign-out, claimed from the guest scope on first sign-in and from
  the guest scope only. Read `scope.ts`'s header in full — it documents three
  real leaks and the exact shape of the fix for each.
- **Universal Links** for `/o/<slug>` and `/library/<slug>`: an
  `apple-app-site-association` file served from the Netlify site, associated
  domains entitlement, and a router that opens the right screen.
- **App Store**: privacy manifest (`PrivacyInfo.xcprivacy`), account deletion in
  settings (guideline 5.1.1(v), and the soft-delete pattern in
  `API.softDeleteOwnProfile()` is the model), screenshots on both device
  families, `ITSAppUsesNonExemptEncryption = NO`.

---

## 5. The document must survive the round trip

**This is the section to read twice.** Everything else in this plan is work;
this one is the thing that quietly destroys a coach's board six months from now.

The web writes the whole `System` into one `jsonb` column. It is read and
written **whole**. So the moment two clients write the same column, this is
true: *any field the app does not know about is a field the app will delete.*

Ship v1.0 of the app. Ship a new studio feature on the web in October that adds
`System.grain` and `Act.whistle`. A coach opens that board on a phone still
running v1.0, moves one player, saves. `grain` and `whistle` are gone from a
document that was never edited on the web again. Nothing errors. Nobody finds
out until somebody opens the film and it is wrong.

**So `TFDoc` types are not plain `Codable` structs.** Every type that maps to a
JSON object keeps the raw object beside its typed fields and re-emits the
unrecognised keys on encode:

```swift
struct Act: Codable {
    var id: String
    var title: String
    var tokens: [Token]
    // … every field schema.ts declares …

    /// Keys this build does not know about, kept verbatim so a newer web
    /// feature survives an edit made in an older app. See docs/APP.md §5.
    private var unknown: [String: JSONValue] = [:]
}
```

Three rules that follow:

1. **Round-trip fidelity is a test, and it is the first test written.** Take
   every `.json` in `content/systems/`, every document the parity check uses,
   decode to `System`, encode back, and compare against the original **as parsed
   JSON, key by key**. Zero differences. Not "no differences that matter".
2. **Key order and number formatting do not matter; presence and value do.**
   Compare parsed, never compare strings.
3. **`schema.ts` is the specification.** When it changes, the Swift changes.
   Put a line in STUDIO.md §7 saying so, because the person who adds a field to
   `schema.ts` is the person who has to know.

The same rule applies, smaller, to `studio_prefs` — which is why §4's Phase 3
says merge and never overwrite. The database function already does the right
thing; the app just has to call it and not route around it.

---

## 6. The check, and what it must print

`CLAUDE.md` states the contract for checks in this project and it applies here
without amendment:

- It **collects**. It does not throw on the first fault; it pushes every fault
  into a list, groups them, prints them, exits non-zero. One run yields the
  whole punch list.
- A fault line **carries the corrected value**, not just the violated one.
- Fatal tier only for causes that invalidate everything downstream — a NaN
  coordinate, the wrong plane — and those abort.

For a port, the check is a **parity harness**, and it is the only defensible way
to know the Swift matches the TypeScript. Both sides are pure functions over the
same JSON, so both can be run headless and diffed numerically.

```
scripts/check-parity.mjs      renders N documents × M acts × K progress
                              values through the TS engine, writes a
                              geometry dump: every token, arrow end, band
                              vertex, text anchor, camera rect, in units

TFBoardCheck (swift run)      does the same through the Swift engine

diff                          numeric, with a tolerance, per primitive
```

A fault line that is right:

```
FAIL  geometry/token   beating-the-two-man-press  act 3  p=0.50
      U10 at (412.31, 288.07) in Swift
         →  (412.94, 288.07) in TS         Δx 0.63 units (6.3 cm)
      cause: easeHouse(0.50, relax=0.2) returned 0.4991, TS gives 0.5000
```

A fault line that is wrong: `token positions differ`.

The documents to run it over: `content/systems/*.json`, plus one document per
pitch view (all nine), plus one with every mark kind on it, plus one training
board. Add the coach-reported one every time something is found.

**Rule 3 of the build contract applies with full force here:** never compute an
eased position by hand to decide whether the port is right. Add it to the dump
and re-run.

---

## 7. Gotchas, collected in advance

Each of these is documented somewhere in `src/studio/` as a bug that was already
paid for once. They will all be paid for again in Swift if they are not read.

1. **Token `id` is stable across acts.** The one rule at the top of `schema.ts`.
   An act is a pose, not a keyframe, and the animation is derived from the
   assumption that `LB` in act 1 and `LB` in act 2 are the same player. Never
   regenerate ids on edit — not on duplicate, not on reorder, not on undo.

2. **Fit the board by height, never by width.** `Board.tsx`'s header. All the
   horizontal crops share the pitch's 68m width, so a height fit draws a counter
   the same size in every view; a width fit turns the final third into
   tiddlywinks. Give the container a height or an aspect ratio and letterbox.

3. **The iPad sidebar bug.** `MainView.swift`'s comment: tag each `List` row
   with the enum case itself, not its `id`, or selection silently never updates.
   It costs an afternoon to find and one line to prevent.

4. **`players` is a private bucket.** Signed URLs expire. Cache the image keyed
   by storage path, never the URL. `photoHrefs` in `Board.tsx` is keyed by
   storage path for exactly this reason — one player on the board in every phase
   is one fetch.

5. **Percent coords are measured against `x0..x1`.** Changing a view's crop
   moves the players. When overriding a view for display (§2), change `pad`,
   `vertical` and `counter`, and nothing else. The `Board.view` docstring says
   this in capitals.

6. **Set pieces are already vertical, and one is flipped.** `defending-set-piece`
   sets `flip` so the defended goal stands at the top. `metresToUnits` handles
   `vertical` and `flip` together; port both branches or the defensive corner
   comes out upside down. Two recent commits on `main` were this exact bug.

7. **Signing out must clear the namespace.** `scope.ts`, leak 3. A buffer that
   outlives its session is somebody else's data on a shared iPad, and a shared
   iPad is the normal case for a coaching staff.

8. **`studio_prefs` merges.** Calling the RPC with a partial object is correct.
   PUTting the whole object is a silent erase of the web's state.

---

## 8. Running it

```
open TotalFootball.xcodeproj          # SPM resolves supabase-swift
xcodebuild -scheme TotalFootball -destination 'platform=iOS Simulator,name=iPhone 17'

swift run TFBoardCheck                # the parity harness, §6
node scripts/check-parity.mjs         # its TypeScript half
```

The parity check runs on every commit that touches `TFBoard`, and on every
commit that touches `src/studio/board/`, `tween.ts` or `camera.ts` — because a
change to the web engine that the Swift does not follow is the same fault as a
bad port, discovered later.

---

## 9. What is deliberately not here

- **The network.** §0a. It comes when the web's Phase 2a and 3 are committed.
- **A Mac target.** §1.2.
- **Push notifications.** There is nothing to notify anybody about until the
  network exists. `aiparastatika-ios/Core/PushManager.swift` is the model when
  there is.
- **Offline editing with sync resolution.** v1 buffers and saves; it does not
  merge divergent edits. `studio_systems_save`'s base timestamp gives an honest
  conflict, and an honest conflict shown to a coach beats a clever merge that
  loses a phase.
- **Android.** Not asked for. Note only that `TFBoard` being pure Swift with no
  UIKit is what would make a Kotlin port a port rather than a rewrite, if it is
  ever wanted.
