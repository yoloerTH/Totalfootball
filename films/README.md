# Making the films in the studio

**Decision, 2026-08-29.** Board-led tactics films are authored in the **studio**
from now on, not hand-built as Remotion compositions. Remotion keeps the films
that are not a board — story, data, b-roll — and is the fallback if this fails.

Nothing is deleted to do this. `editor/` still renders all 123 shorts, so
rolling back costs one sentence and no work. The criteria for rolling back are
in §10, written down now so the decision is not made on a bad afternoon.

---

## 1. This is not a new pipeline. It has already posted three films

Three of the eight documents in `content/systems/` are marked `official` in
`src/studio/templates.ts`, and each carries the reel links to prove it:

| Document | Phases | Hold | Move | Camera | Surface | Went out |
|---|---|---|---|---|---|---|
| `the-y-passing-drill-in-3-levels.json` | 36 | 200ms | 1100ms | follow | night | [IG](https://www.instagram.com/reel/DckJuXBoNtp/) · [FB](https://www.facebook.com/reel/1376067451381072) |
| `the-4-1-4-1-press.json` | 18 | 400ms | default | off | chalk | [IG](https://www.instagram.com/reel/Dca_9RZNOr0/) · [FB](https://www.facebook.com/reel/933841605791735) |
| `escaping-pressing-trap.json` | 13 | 800ms | 1200ms | derived | broadcast | [IG](https://www.instagram.com/reel/DcdWo4mN4yE/) · [FB](https://www.facebook.com/reel/2025942812141766) |

So the question was never "can the studio make a film". It was "should it make
all of them", and the answer below is yes for the board ones.

## 2. The argument, in one number

A hand-built short is `XxxShort.tsx` (~700 lines) plus `src/<name>/geometry.ts`
(25–31KB; FarSide's is 27KB) plus a check script plus a `Root.tsx` registration.
That is the 60–80k budget in `CLAUDE.md`, and it is what overran to **188k** on
DoublePivot.

Read *why* that contract exists and every rule points at one cause. "Never
compute an eased position by hand." "Collisions: route, do not nudge." A check
that must print the corrected value, not just the violated one. All of it is
scaffolding for an author who **cannot see the board while writing it**, so
every position has to be computed in reasoning and then verified numerically.

In the studio you drag the man. The check script's whole job — are these two
counters 4.3m apart at t471 — is answered by your eyes at the moment you place
him. That is not a saving. It is the deletion of the category of work that was
eating the budget.

What is left is the part that was always worth paying for: what the film says.

## 3. The vocabulary you are authoring in

Everything here already exists and is already rendered by the same code that
draws the viewer, the PNGs, the print sheet and the MP4. There is exactly one
renderer, which is why a film cannot drift from what you posed.

- **Views** — 8 match crops (`full`, `full-vertical`, `two-thirds`, their half,
  our half, their box, attacking set piece, defending set piece) plus the
  **training grid**, which is a board with a size rather than a zoom: rondo
  10/15/20/25, possession grids to 40×35, six-box positional, and the four FA
  youth pitches.
- **Formations** — 26 across five families (four / three / five at the back,
  from the archive, start from scratch). Stored in team-shape space, so a
  formation survives a change of view.
- **Surfaces** — paper, broadcast, night, chalk. A whole palette each, not just
  the grass.
- **Balls** — 8, including the real photographed ones.
- **Marks** — arrows in 6 intents, bands in 3 kinds × 5 shapes, text on the
  grass, training gear, more than one ball on a phase, cues on a counter
  (PRESS, COVER, BALANCE, SPARE, JOCKEY, DROP).
- **Camera** — fixed or follow, a push, and a per-phase frame you can drag.
- **Pace** — one hold and one move per system. See §7.
- **Identity** — squad names, faces, bibs, kit, crest.

## 4. The pipeline, end to end

```
studio (on the films account)
  → node scripts/pull-system.mjs <system-id>     # down to content/systems/*.json
  → node scripts/render-video.mjs content/systems/<slug>.json
  → out/<slug>.mp4                                # 1080p 9:16, kick track muxed
```

**Finding the id:** `npm run systems:list` (that is `pull-system.mjs --list`,
which defaults to the films account; `--owner <uuid>` for any other).

**What the pull strips:** `shareId` and `credit`, deliberately. A committed
document carrying our share id is a live link to a published system sitting in
the repo.

**Render flags:** `--shape vertical|landscape` (default vertical), `--quality
1080|720`, `--fps 30|60`, `--out <dir>` (default `out/`), `--date` to stamp the
date into the credit line, `--skip-build` to reuse `dist/` while authoring,
`--head` to watch the browser when something is wrong.

**Three things that will bite if forgotten**, all documented at the head of
`render-video.mjs`:

1. It drives **your installed Google Chrome**, not Playwright's Chromium.
   Chromium has no H.264, so every render would silently fall back to a `.webm`
   Instagram will not take.
2. It renders the **production build**, not `astro dev`. Dev throws on the
   first `.tsx` the renderer pulls in.
3. Both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be in `.env` for the
   pull. The render needs neither — the document is handed to the page at
   runtime.

**Publishing is optional and separate.** A film only becomes a template card, a
public `/o/<slug>/` page and a sitemap entry if it gets a line in
`src/studio/templates.ts` with `official: true`. Everything else in this list
happens without registering anything.

## 5. How to author one — the loop

1. `/studio/new/` on the films account. Pick the **view**, the **formation**,
   the **surface**, the **ball**. These are properties of the document, so they
   travel into every export.
2. Pose **phase 1**. This is the situation before anything happens.
3. **Duplicate the phase** and move what moves. Repeat. You are building poses,
   not keyframes — the movement between two of them is derived.
4. Give each phase a **title** and a **caption**. The caption is one line read
   at a glance while a board is on screen. `notes` is the long version and does
   not appear in the film.
5. Set the **camera** (off, or follow with a push) and drag a per-phase frame
   on the phases where the automatic one is wrong.
6. Set the **pace**. See §7.
7. Press **Play** and watch it. What you see is what the file will be.
8. Send me the system id.

**Five rules that decide whether the film works**, all consequences of how the
engine derives things:

- **Never delete and re-add a player to move him.** Every tween joins on the
  token id. A deleted-and-re-added man fades out and pops in instead of running,
  and no amount of pacing fixes it.
- **The ball moving between two phases IS the kick sound.** The soundtrack is
  derived from the document, struck harder the further it goes. Move the ball
  where a ball was struck, and nowhere else.
- **An arrow is what you are pointing at, not what the ball did.** The pass they
  should have played, the run nobody made. Arrows make no sound.
- **A phase that changes nothing is a dead second.** If two phases have the same
  pose, the film holds twice and moves zero.
- **Watch it on the phone shape.** `frameView()` reshapes your crop to 9:16 and
  may turn the board to fit. A pose that reads on a wide desktop board can lose
  a man off the top of a vertical crop.

## 6. What stays in Remotion

- Story films (Enrique, Istanbul, United 99), data films (FootballModel), and
  anything driven by b-roll, photographs or stat cards. No board, nothing to
  gain.
- **The 123 published shorts are not being ported.** `templates.ts` already
  makes the argument: their phases are PNGs out of Remotion, and the token
  positions are not recoverable from a picture. Adapting them by hand is 123
  separate readings, not one loop.

## 7. The rhythm, and the number to start from

`src/studio/pace.ts` is the one clock. Both numbers live on the document, so
Play, the share link, the print sheet and the MP4 cannot disagree.

- **Hold** is reading time. Default **2600ms**, floor **0**, ceiling 6000ms.
  Zero is a real setting: a film with no pauses at all, one movement running
  into the next.
- **Move** is the information. Default **1100ms**, floor 200ms, ceiling 3000ms.
  Slowing it past the default also **relaxes the curve** proportionally, so the
  extra time is spent on travel rather than on a longer settle.

The 2600 default is the **coach's** default and should stay. Our films already
run far below it. Starting points, from the three that shipped:

| Kind of film | Hold | Move |
|---|---|---|
| Drill, many phases (Y drill, 36) | 200 | 1100 |
| Press / trap, phase-dense (18) | 400 | default |
| Tactics idea with reading (13) | 800 | 1200 |

**The control that does not exist yet: a per-phase hold.** Today the hold is one
number for the whole system, so you cannot sit longer on the one phase that
carries the idea while the rest run fast. The workaround is to duplicate the key
phase so it holds twice. If that feels wrong once you have made a few, say so
and it becomes `Act.hold` — an optional override, undefined meaning "use the
system's", which leaves every existing document untouched.

**Small fix owed here:** the header of `pace.ts` still says the move's floor is
the default 1.1s and "stays that way", but `MIN_MOVE_MS` is 200. The code was
changed and the comment was not told.

## 8. What the studio does not do, and what each gap costs

| Gap | What it costs | The plan |
|---|---|---|
| **Pose-and-hold, not continuous choreography** | No per-frame idle jitter, duel webs, ball traces. FarSide has 60fps tracks; the studio has poses. | More phases at a shorter hold. The Y drill at 36 phases / 200ms already is frame-by-frame authoring. Accept it and see whether anyone can tell. |
| **No hook plate, no end lockup, no CTA** | A channel short opens on a hook and closes on `LearnPrompt`. Studio chrome is title, caption, credit bar, progress hairline. | **The wrapper (see below).** Highest-value gap and the cheapest to close. |
| **One sound** | `audio.ts` derives kicks and refuses the SFX palette on purpose. No music bed. | The wrapper. |
| **No derived readouts** | "4.2m", speed, angle stamps — the videos live on these. `TextMark` is typed text, not a measurement between two tokens. | Not built. A `measure` mark that reads two token ids is the natural shape if we want it. |

**The wrapper, which is the recommendation for the first three gaps.**
`VideoOptions.parts` already lets the chrome be turned off per part. So: render
the board film out of the studio with the chrome suppressed, and drop that MP4
into a thin Remotion composition that adds the hook, the music bed, the SFX
accents and the final lockup. Remotion does what it is good at; the studio stays
the only thing that draws a board. Authored lines per film goes from ~1,500 to
about 40, and the one-renderer rule survives intact.

The alternative — importing `schema`/`tween`/`Board` into Remotion and drawing
the board there — gives finer control and breaks that rule. Not recommended
without a reason we do not have yet.

## 9. Who does what

**You:** pose, pick, pace, and watch it. Everything that needs eyes on a board.

**Me:** the wrapper composition, captions and descriptions, the pull and the
render, the registry line when one is official, engine changes (per-phase hold,
chrome parts, a measure mark), and these docs.

**The trap, stated plainly so we do not walk into it:** I should not hand-write
film documents. A 36-phase system is 133KB of JSON, and authoring that in a
chat is strictly worse than writing `geometry.ts` was — same blindness, worse
format, no check script. What I can usefully write is a **skeleton**: 4 to 8
phases with the shape, the view, the pace and the captions in place, for you to
open and drag into truth.

**Missing tool for that:** there is a way down from the account
(`pull-system.mjs`) and no way up. A `push-system.mjs` that writes a document
onto the films account so you can open it in the studio is about 40 lines and
uses the same service-role key. Say the word.

## 10. When to call this off

Concrete, so it is not an argument later. Go back to Remotion for board films if:

- Three consecutive films need the wrapper to carry so much that the studio part
  is under half the running time, or
- A film cannot be posed at all because it needs continuous motion the poses
  cannot express, and shortening the hold does not rescue it, or
- The engagement on studio-made films is visibly below the hand-built ones over
  a run of five, or
- Authoring one takes you longer than a hand-built one took me. That is the real
  test: this trade moves work from my budget to your hands, and it is only a
  good trade while your hands are faster.

## 11. Open, waiting on you

1. **Per-phase hold** — build `Act.hold`, or duplicate the key phase and live
   with it? Answer after you have made one, not before.
2. **The wrapper** — build it now, or ship two or three bare studio films first
   and see whether the hook and lockup are actually missed?
3. **`push-system.mjs`** — worth the 40 lines so I can hand you skeletons?

---

## Where things live

| | |
|---|---|
| The engine | `src/studio/` (board core, schema, tween, camera, pace, audio, video) |
| The documents | `content/systems/*.json` |
| Down from the account | `scripts/pull-system.mjs` · `npm run systems:list` |
| To a file | `scripts/render-video.mjs` → `out/` |
| Registration (official only) | `src/studio/templates.ts` |
| The full handoff | `docs/STUDIO.md` |
| The training boards | `docs/TRAINING.md` |
| Per-film briefs | this folder, one `.md` each |
