# Training boards: what is wrong, and what to build

Written 2026-08-29, after the four training views shipped in `20bbcc6` and the
coach looked at them. Two faults, both real, both his words: the counters look
huge, and switching to a session board carries a match layout across and makes
a mess of it. This is the analysis. The build happens in a fresh session and
follows §5.

**The hard constraint, before anything else: none of this may change a match
view.** Not the crop, not the counter size, not what happens when you switch
between two of them. Every change below is either a new field that the eight
match views leave unset, or a branch that only fires when the target board is a
training board. If a change cannot be written that way, it does not go in.

---

## 1 · How coaches actually work

Six hours of reading round the tools coaches already use and the way sessions
are actually written. Sources at the foot.

### 1a · A training canvas is a BOARD, not a zoom

i-Drills ships **27 separate training canvasses** — full-size and youth pitches,
grids, and specialised layouts — as distinct canvases you choose between, not as
crops of one pitch. Soccer Blade's drill creator asks "Pitch Type (Full/Half)"
and then switches mode: formation-and-tactics on one, cones-and-equipment on the
other. Bcoach has a grid you show or hide *over* the field, separate from the
field itself.

Nobody models a rondo as a zoom into the centre circle. The coach's own words
were the same complaint: *"it should be completely different than just zooming
in."* He is describing the industry's actual model, and we shipped the other one.

### 1b · The size of the grid is the thing the coach changes most

This is the finding that matters most, and it invalidates the four fixed views.

Rondos run **8×8 to 40×40** depending on age, level and what is being coached.
The canonical sizes that appear over and over:

| Setup | Grid | Source |
|---|---|---|
| 4v2 / 5v2 / 6v2 rondo (Guardiola, Man City) | **10 × 10 m** | one player on each corner |
| 6v2 rondo | **15 × 15 m** | players 5 and 6 on the midpoints of opposite sides |
| 4v2 twin rondo | **8 × 8 m** ×2, split by a **2 × 8** channel | |
| 6v3 | **25 × 25 m** | |
| Possession game | **20 × 25 m** | "the space between the sideline and the 18yd area" |
| Bigger possession game | **40 × 35 m** | "between the halfway line and the 18yd box" |

Our `rondo-square` is 20×20. That is a real size, and it is one point in a range
the coach moves through every session. **Four fixed sizes is the wrong shape of
feature.** The size has to be a control.

### 1c · The professional way to size a grid is m² per player

Two products are built entirely on this — BoxIQ ("set training spaces in seconds
using Relative Playing Area, calculate grid sizes for any format from 3v3 to
11v11 based on age, player count and intensity") and Drill Design App
("calculate exact pitch dimensions based on Area Per Player, or the Area Per
Player from dimensions and available players").

Area per player (ApP) = total area ÷ players on the grid. The research numbers:

- Small-sided games studied across **43–341 m²/player** (67–341 with keepers).
- **Under ~150 m²/player** does not stimulate match-level high-speed running,
  very-high-speed running or sprint distance in youth players.
- Barcelona's 8v2 in 10×10 is about **10 m²/player** — that is a technical
  rondo, and it is deliberately nowhere near match demands.
- Smaller area, same players → more touches, more accelerations, faster
  decisions. Bigger area or fewer players → more distance, more sprinting.

A coach who sees `30 × 20 m · 600 m² · 8 players · 75 m² each` while dragging the
grid handle is being told something they currently work out on paper. Nothing
else in the studio gives them that, and it is one line of arithmetic.

### 1d · Players come off a bench, and a drill starts empty

Tactico: *"Starting players paint onto the formation while the rest fill the
substitute bench **below the pitch**."* TacticBoard: *"drag tokens **from the
bench** onto the pitch and choose a formation preset **or build from scratch**."*
Coach Tactic Board makes substitutions by dragging between board and bench.

Two things fall out of that:

1. The bench is **outside the playing area**, in its own strip, not tucked into
   the corner of the grass.
2. **Building from scratch is a first-class start**, not a failure state. A
   rondo diagram is written by putting one player on each corner and two in the
   middle. It is never written by squashing a 4-3-3 into a square.

Which is exactly what the coach asked for: *"restart the players positions and
put them on the side for the coach to choose how they get aligned."*

### 1e · The FA numbers, because our labels are currently wrong

| Format | FA pitch | Goal |
|---|---|---|
| 5v5 (U7–U8) | 37 × 27 m | 3.66 × 1.83 m |
| 7v7 (U9–U10) | 55 × 37 m | 3.66 × 1.83 m |
| 9v9 (U11–U12) | 73 × 46 m | 4.88 × 2.13 m |
| 11v11 (U13–U14) | 82 × 50 m | 6.40 × 2.13 m |
| 11v11 (U15+) | 91 × 55 m | 7.32 × 2.44 m |

`training-pitch` is 40 × 30 and its hint says *"A 7v7 pitch"*. **That is wrong.**
The FA's 7v7 is 55 × 37; 40 × 30 sits between a 5v5 and a 7v7 and is nobody's
official anything. Either the size changes or the words do.

---

## 2 · Fault one: the counters are 2.3× too big

Not a matter of taste. `TOKEN_R = 2.1` metres, fixed
(`src/studio/board/Token.tsx:24`), so a counter is 4.2 m across on every board.
Measured against the short side of each board's visible crop:

| View | Visible (m) | Short side | Counter as % of it | Scale to match `full` |
|---|---|---|---|---|
| `full` | 111 × 74 | 74.0 | 5.7% | 1.00 |
| `full-vertical` | 74 × 111 | 74.0 | 5.7% | 1.00 |
| `two-thirds` | 76 × 74 | 74.0 | 5.7% | 1.00 |
| `attacking-half` | 58.5 × 74 | 58.5 | 7.2% | 0.79 |
| `defending-half` | 58.5 × 74 | 58.5 | 7.2% | 0.79 |
| `attacking-set-piece` | 74 × 58.5 | 58.5 | 7.2% | 0.79 |
| `defending-set-piece` | 74 × 58.5 | 58.5 | 7.2% | 0.79 |
| `attacking-box` | 37 × 74 | 37.0 | 11.4% | 0.50 |
| **`training-pitch`** | 53 × 43 | 43.0 | **9.8%** | 0.58 |
| **`channel-grid`** | 53 × 43 | 43.0 | **9.8%** | 0.58 |
| **`possession-grid`** | 42 × 32 | 32.0 | **13.1%** | 0.43 |
| **`rondo-square`** | 32 × 32 | 32.0 | **13.1%** | 0.43 |

A counter on the rondo square takes **2.3× the share of the board** it takes on
the full pitch. That is the screenshot.

**The codebase already knows about this problem and works around it in the wrong
place.** All five set pieces set `tokenSize: 0.75` on the SYSTEM
(`src/studio/setpieces.ts:255` and four more), which `Board.tsx:620` multiplies
in as `scale={(t.scale ?? 1) * (system.tokenSize ?? 1)}`. Because it lands on the
system, it follows the coach back to the full pitch when they leave the set
piece — the counters stay shrunk on a board that never needed it. Copying that
pattern onto training boards would be copying the bug.

The size belongs to the **view**, because it is a property of how much grass is
on screen, and nothing else.

---

## 3 · Fault two: `remap` is the wrong operation for this switch

`setPitch` (`src/studio/editor/StudioEditor.tsx:2882`) calls `remapSystem`
(`:367`), which is a linear map per axis applied to every token, ball, arrow
endpoint and band rectangle in **every phase**. That is exactly right between two
match views — it is what makes changing the crop non-destructive, and
`check-align.mjs` claim 3 exists to protect it.

It is exactly wrong here. Going from `full` to `rondo-square` it takes 105 × 68
metres of football and compresses it into 29 × 29, arrows and shaded areas
included. A back four four metres apart lands one metre apart. A 40-metre
switch-of-play arrow becomes a hook across a rondo square. That is the coach's
screenshot, and it is `remap` working as designed on a switch it was never
designed for.

A training board is a **change of kind**, not a change of crop. The precedent for
handling one is already in the file: `applySetPiece` (`:2907`) changes the view
AND re-poses the players, on this phase only, in one edit so the poses are
computed against the crop they are landing on.

Two knock-on effects to fix at the same time:

- **`offCrop`** (`:3746`) counts tokens outside ±2% and prints *"6 players are
  outside this view … press Re-place shapes"*. On a training board with a bench
  that message is wrong: they are not lost, they are waiting.
- **The cast tables** (`CAST`, `BANDS`, `SOLO_BANDS`, `WIDTH_BANDS` in
  `src/studio/formations.ts`) answer "which players does this crop show and where
  does their shape sit". On a grid the answer is "none of them until the coach
  puts one there". The bench replaces the cast on training boards; the tables
  keep their match entries untouched.

---

## 4 · Open decisions — settle these before building

**D1 · Four views, or one board with a size control?**
§1b says the size is the control. Recommendation: **one training board kind, one
size, and named presets** (Rondo 10/15/20/25, Grid 20×25, 30×20, 40×30, 40×35,
SSG 37×27, 55×37, 73×46). Collapses four view ids into one and covers the whole
8–40 range instead of four points in it. Cost: the four ids shipped in
`whatsnew.ts` and may sit in saved documents — `RETIRED_VIEWS` already exists for
exactly this and maps them onto the new one with the right size.

**D2 · What happens to arrows and shaded areas on the switch?**
Benching the players fixes the players. A 40-metre switch-of-play arrow is still
on the board. Options: (a) leave them, coach deletes what they don't want;
(b) bench them too — take them off this phase, undo brings them back; (c) ask,
the way changing shape now asks. Recommendation: **(b)**, single undo entry,
because a mark drawn for a pitch is about the pitch.

**D3 · Where does the bench sit?**
§1d says outside the playing area. Options: a strip of grass inside the crop but
outside the cones (works today, no new geometry, but `clampToBoard`'s ±3% is
about one metre on a small grid); or a real bench rail below the board, outside
the SVG. Recommendation: **inside the crop, outside the cones**, with the crop's
margin widened to hold a full row — it survives export, print and share links
with no new concept, and the counters are already draggable there.

**D4 · Both teams, or one squad?**
A rondo is not two teams, it is a group with bibs — and bibs already exist
(shipped 2026-08-28). Recommendation: the bench holds whoever is in the phase,
both sides, and the coach uses bibs to colour them.

**D5 · Going back to a match view.**
Recommendation: `remapSystem` as now for training → match, plus the existing
`Re-place shapes` if they want the formation back. No new behaviour.

---

## 5 · Build order

Each step states what makes it safe for the match views.

**Step 1 — per-view counter scale.**
Add `counter?: number` to `PitchView`. `Board.tsx:620` becomes
`scale={(t.scale ?? 1) * (system.tokenSize ?? 1) * (view.counter ?? 1)}`.
*Match views omit the field, `?? 1`, byte-identical output.* Training boards take
the "scale to match `full`" column from §2. Add a `check-align` claim: on every
view a counter is between 4% and 9% of the short side, printing the corrected
scale when it is not. Leave `system.tokenSize` and the coach's size slider alone
— they multiply on top, so a coach who wants big counters on a rondo still gets
them.

**Step 2 — the training board becomes one board with a size.**
Per D1. `area` moves off the view and onto the system (`length`, `width`, plus
the ruling toggles: halfway + circle, end areas, inner square, cells). The view
keeps the crop maths and derives it from the area plus margin.
*Nothing here is read by a match view.*

**Step 3 — the size control, with m² per player.**
Presets from §1b/§1e, a free size, and a live readout:
`30 × 20 m · 600 m² · 8 on the grid · 75 m² each`. Player count comes from the
tokens actually on the grid, not the bench. Flag against §1c's bands so the
readout can say "technical" / "match-like" rather than just a number.
*New panel, only rendered for a training board.*

**Step 4 — the bench, and the switch.**
A `benched` flag on a token; benched tokens lay out in a computed row on the
margin rather than at their stored percent, so they always fit and never
collide. Dragging one onto the grass clears the flag. `setPitch` branches: target
has an area → bench this phase's players (and per D2 its marks), one edit, one
undo; otherwise `remapSystem` exactly as today.
*The branch is `if (to.area)`. A match view never enters it.*

**Step 5 — the words.**
`offCrop` says nothing about benched players. `hint`/`useFor` carry real numbers
(§1e). `whatsnew.ts` gets an entry for the resize and the bench;
`RETIRED_VIEWS` maps the four old ids.

---

## 6 · What stays exactly as it is

Stated so the fresh session does not go looking for work that is already right:

- The decision that a training area is a **crop of the same 105 × 68 metre
  space**. It is why arrows, bands, gear, snapping, phases, tween, film and PDF
  all work on a grid with no code of their own. §1a is about the *user-facing*
  model, not the coordinate space.
- **No goals painted on the board.** Confirmed by the coach and by every source:
  a goal in an exercise goes where the exercise wants it.
- The **`areaBand` derivation** in `formations.ts` and the four training claims
  in `check-align.mjs` — they carry over to whatever the area becomes.
- The **grouped picker** (Match / Set pieces / Training).
- The Markings drawer staying hidden on a training board.

---

## Sources

- [Rondos: what they are, and the sizes they are played in — Soccer Coach Weekly](https://www.soccercoachweekly.net/coaching-advice/what-are-rondos)
- [4 Grid Rondo — Professional Soccer Coaching](https://www.professionalsoccercoaching.com/possession-ssgs/4-grid-rondo)
- [Twin Grid Rondo — Professional Soccer Coaching](https://www.professionalsoccercoaching.com/possession-drills/twin-grid-rondo)
- [Rondo (game) — Wikipedia](https://en.wikipedia.org/wiki/Rondo_(game))
- [The FA Guide to Pitch and Goalpost Dimensions](https://www.thefa.com/-/media/cfa/londonfa/files/fa-guide-to-pitch-and-goalpost-dimensions.ashx)
- [i-Drills Football — 27 training canvasses](https://apps.apple.com/gb/app/i-drills-football/id686938089)
- [Tactico — bench below the pitch](https://tactico.pro/app)
- [TacticBoard — drag tokens from the bench, or build from scratch](https://www.tacticboard.app/)
- [Coach Tactic Board — substitutions by drag and drop](https://apps.apple.com/us/app/coach-tactic-board-soccer/id834813598)
- [Drill Design App — pitch dimensions from area per player](https://www.drilldesignapp.com/)
- [BoxIQ — Relative Playing Area, 3v3 to 11v11](https://apps.apple.com/mx/app/boxiq-pitch-dimensions/id6754266136)
- [Bcoach — customisable grid over the field](https://bcoach.app/en/tasks-design/)
- [Soccer Blade Drill Creator — pitch type, then drills or tactics](https://soccerblade.com/drill-creator/)
- [Area per player in small-sided games to replicate match demands — PLOS One](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0229194)
- [Area per player in SSGs, elite youth — PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9331353/)
- [Area per Player in SSGs to Estimate External Load in Elite Youth — PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11812169/)
