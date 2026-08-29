/**
 * Lining up does what it says, on every board.
 *
 * ── WHY THIS IS A SCRIPT AND NOT A CODE REVIEW ───────────────────────────────
 *
 * A snap is invisible when it works and invisible when it is 4cm out. Nobody
 * reviewing a diff can see that a back four came out level on the horizontal
 * pitch and 0.03m crooked on the upright one, because the numbers involved are
 * percent of a crop that is a different shape on each of the nine views, run
 * through a quarter turn on three of them and the OTHER quarter turn on one.
 * That is exactly the kind of claim a machine should be making.
 *
 * ── IT COLLECTS, AND IT PRINTS THE NUMBER ────────────────────────────────────
 *
 * One run gives the whole punch list, and every fault line carries what came
 * out and what should have. Nothing here is worked out by hand.
 *
 * Run: node --import ./scripts/lib/ts.mjs scripts/check-align.mjs
 */

import { readFileSync } from 'node:fs'
import {
  AREA_MAX,
  AREA_MIN,
  AREA_PRESET_LIST,
  COUNTER_D,
  PITCH,
  PITCH_VIEWS,
  PITCH_VIEW_LIST,
  U,
  areaBand,
  areaInset,
  benchLayout,
  cropRect,
  metresToUnits,
  remap,
  toMetres,
  toPercent,
  trainingView,
} from '../src/studio/board/pitch.ts'
import { alignSnap, snapTolerance, SNAP_PX, FALLBACK_TOL_M } from '../src/studio/board/align.ts'

const faults = []
const fail = (group, line) => faults.push({ group, line })
const m = (n) => `${n.toFixed(3)}m`

/* ── The constant the feel of this rests on ─────────────────────────────────
 * A tolerance wider than a counter is a tolerance that swallows a player whole.
 * TOKEN_R lives in a .tsx this script cannot import, so it is read out of the
 * source — if somebody grows the counters, this fails here rather than on a
 * coach's screen.
 */
const TOKEN_R = Number(
  /export const TOKEN_R = ([\d.]+)/.exec(readFileSync('src/studio/board/Token.tsx', 'utf8'))?.[1],
)
if (!Number.isFinite(TOKEN_R)) fail('setup', 'TOKEN_R could not be read out of board/Token.tsx')

/** A board of `cssWidth` pixels showing `view`, at zoom `z`. Enough of an <svg>. */
const boardOfWidth = (view, cssWidth, z = 1) => {
  const crop = cropRect(view)
  const scale = (cssWidth * z) / crop.w
  return {
    getBoundingClientRect: () => ({ width: crop.w * scale, height: crop.h * scale }),
    viewBox: { baseVal: { width: crop.w, height: crop.h } },
  }
}

/* ── 1 · The tolerance is pixels, and it shrinks when you zoom in ───────────*/
{
  const v = PITCH_VIEWS.full
  const at100 = snapTolerance(boardOfWidth(v, 900))
  const at600 = snapTolerance(boardOfWidth(v, 900, 6))
  if (!(at100 > 0 && at100 < TOKEN_R)) {
    fail('tolerance', `at 100% it is ${m(at100)}, which is not inside a counter (r ${m(TOKEN_R)})`)
  }
  const want = at100 / 6
  if (Math.abs(at600 - want) > 1e-9) {
    fail('tolerance', `at 600% it is ${m(at600)}, should be ${m(want)} — it is not tracking the zoom`)
  }
  if (snapTolerance(null) !== FALLBACK_TOL_M) {
    fail('tolerance', `with no board to measure it is ${snapTolerance(null)}, should be ${FALLBACK_TOL_M}`)
  }
  // Same pixels on a tighter crop must mean fewer metres, or the snap is
  // coarser exactly where the coach zoomed in to be finer.
  const box = snapTolerance(boardOfWidth(PITCH_VIEWS['attacking-box'], 900))
  if (!(box < at100)) {
    fail('tolerance', `the box view gives ${m(box)} against the full pitch's ${m(at100)}; a tighter crop must give less grass per pixel`)
  }
  if (SNAP_PX < 3 || SNAP_PX > 14) fail('tolerance', `SNAP_PX is ${SNAP_PX}, which is outside anything a hand would call "on the line"`)
}

/* ── 2 · What it does with a mark, on every view there is ───────────────────*/
for (const v of PITCH_VIEW_LIST) {
  const g = v.id
  const tol = snapTolerance(boardOfWidth(v, 900))
  const at = (mx, my) => toPercent(v, mx, my)
  // Three men on one line across the pitch, and one in the same channel as the
  // first — a back three and a full-back, in the middle of whatever this crop is.
  const cx = (v.x0 + v.x1) / 2
  const cy = (v.y0 + v.y1) / 2
  const mates = [
    { id: 'a', ...at(cx, cy - 8) },
    { id: 'b', ...at(cx, cy) },
    { id: 'c', ...at(cx, cy + 8) },
    { id: 'd', ...at(cx + 14, cy - 8) },
  ]

  // (a) inside the tolerance on one axis: it takes the partner's OWN number.
  {
    const off = tol * 0.6
    const want = alignSnap(v, at(cx + off, cy + 3), mates, tol)
    if (want.x !== mates[0].x) {
      fail(g, `a mark ${m(off)} off the line landed at x ${want.x}, should be exactly the line's ${mates[0].x}`)
    }
    if (want.y !== at(cx + off, cy + 3).y) {
      fail(g, `the free axis moved: y ${want.y}, should be untouched at ${at(cx + off, cy + 3).y}`)
    }
    if (want.guides.length !== 1 || want.guides[0].axis !== 'x') {
      fail(g, `one guide on x was expected, got ${JSON.stringify(want.guides.map((q) => q.axis))}`)
    }
    // The guide has to reach every man on the line, not only the pair.
    const [q] = want.guides
    const span = [cy - 8, cy, cy + 8, cy + 3]
    if (q.from > Math.min(...span) || q.to < Math.max(...span)) {
      fail(g, `the guide runs ${m(q.from)}..${m(q.to)}, which does not cover the men on it (${m(Math.min(...span))}..${m(Math.max(...span))})`)
    }
  }

  // (b) outside the tolerance: nothing happens at all.
  {
    const off = tol * 1.4
    const raw = at(cx + off, cy + 3)
    const want = alignSnap(v, raw, mates, tol)
    if (want.x !== raw.x || want.y !== raw.y || want.guides.length) {
      fail(g, `a mark ${m(off)} off the line was pulled onto it anyway (tolerance ${m(tol)})`)
    }
  }

  // (c) both axes onto the SAME man is a stack, and must not happen.
  {
    const raw = at(cx + tol * 0.3, cy + tol * 0.5)
    const want = alignSnap(v, raw, mates, tol)
    const onTop = mates.find((k) => k.x === want.x && k.y === want.y)
    if (onTop) fail(g, `the drag was stacked exactly on '${onTop.id}' instead of being held on one line`)
    if (want.x !== mates[1].x) fail(g, `the nearer axis was dropped: x ${want.x}, should be ${mates[1].x}`)
    if (want.y !== raw.y) fail(g, `the further axis was kept: y ${want.y}, should be free at ${raw.y}`)
  }

  // (d) two DIFFERENT men is a corner, and is exactly what should happen.
  {
    const raw = at(cx + 14 + tol * 0.4, cy + tol * 0.4)
    const want = alignSnap(v, raw, mates, tol)
    if (want.x !== mates[3].x || want.y !== mates[1].y) {
      fail(g, `a corner was expected at (${mates[3].x}, ${mates[1].y}), got (${want.x}, ${want.y})`)
    }
    if (want.guides.length !== 2) fail(g, `a corner should draw two guides, drew ${want.guides.length}`)
  }

  // (e) snapping something already on the line changes nothing.
  {
    const once = alignSnap(v, at(cx + tol * 0.5, cy + 3), mates, tol)
    const twice = alignSnap(v, { x: once.x, y: once.y }, mates, tol)
    if (twice.x !== once.x || twice.y !== once.y) {
      fail(g, `snapping twice moved it: (${once.x}, ${once.y}) then (${twice.x}, ${twice.y})`)
    }
  }

  // (f) a guide is a STRAIGHT line on screen, whichever way the board is turned.
  {
    const want = alignSnap(v, at(cx + tol * 0.5, cy + 3), mates, tol)
    for (const q of want.guides) {
      const a = q.axis === 'x' ? metresToUnits(v, q.at, q.from) : metresToUnits(v, q.from, q.at)
      const b = q.axis === 'x' ? metresToUnits(v, q.at, q.to) : metresToUnits(v, q.to, q.at)
      const flat = Math.abs(a.y - b.y) < 1e-9
      const upright = Math.abs(a.x - b.x) < 1e-9
      if (flat === upright) {
        fail(g, `the ${q.axis} guide is drawn from (${a.x}, ${a.y}) to (${b.x}, ${b.y}), which is not square to the board`)
      }
    }
  }
}

/* ── 3 · An alignment survives a change of pitch view ───────────────────────
 * The reason the partner's own percent is copied across rather than a
 * round-trip through metres: `remap` is linear per axis, so it takes equal to
 * equal — but only if the two numbers were equal to the bit.
 */
{
  const from = PITCH_VIEWS.full
  const tol = snapTolerance(boardOfWidth(from, 900))
  const mate = { id: 'a', ...toPercent(from, 60, 20) }
  const snapped = alignSnap(from, toPercent(from, 60 + tol * 0.5, 34), [mate], tol)
  for (const to of PITCH_VIEW_LIST) {
    const A = remap(from, to, mate.x, mate.y)
    const B = remap(from, to, snapped.x, snapped.y)
    if (A.x !== B.x) {
      fail('remap', `moved to ${to.id} the line broke: ${A.x} against ${B.x} (${m(Math.abs(toMetres(to, A.x, 0).x - toMetres(to, B.x, 0).x))} of drift)`)
    }
  }
}

/* ── 4 · The training board leaves room for what goes on it ────────────────
 * A coned area is only a training board if there is grass OUTSIDE it to put the
 * goals and the cones on, and room INSIDE it to stand a counter without half of
 * him hanging over the line. Both are arithmetic.
 *
 * IT IS SWEPT, NOT SPOT-CHECKED. The four fixed grids became one board whose
 * size the coach drags, so there is no longer a short list of boards to look
 * at: every preset is checked, both extremes of the sliders are checked, and a
 * sweep of the whole range in between is checked. A derivation that is right at
 * 30 x 20 and wrong at 10 x 10 is a derivation that is wrong.
 */
const sweep = []
for (const p of AREA_PRESET_LIST) sweep.push([p.id, p.area])
sweep.push(['min', { length: AREA_MIN.length, width: AREA_MIN.width, middle: true }])
sweep.push(['max', { length: AREA_MAX.length, width: AREA_MAX.width, halfway: true, ends: true }])
sweep.push(['long-thin', { length: AREA_MAX.length, width: AREA_MIN.width }])
sweep.push(['short-fat', { length: AREA_MIN.length, width: AREA_MAX.width }])
for (let L = AREA_MIN.length; L <= AREA_MAX.length; L += 5) {
  for (let W = AREA_MIN.width; W <= AREA_MAX.width; W += 5) {
    sweep.push([
      `${L}x${W}`,
      { length: L, width: W, halfway: true, ends: true, middle: true, cells: { along: 3, across: 2 } },
    ])
  }
}

const boards = [
  ...PITCH_VIEW_LIST.filter((v) => v.area).map((v) => ['picker default', v]),
  ...sweep.map(([id, a]) => [id, trainingView(a)]),
]
if (boards.length === 0) fail('training', 'no view has a training area; the session board is gone')

for (const [g, v] of boards) {
  const a = v.area
  if (!a) {
    fail('training', `${g}: derived a board with no coned area on it at all.`)
    continue
  }

  // (a) the area is INSIDE the crop, with room for a goal on all four sides.
  const margins = {
    left: a.x0 - v.x0,
    right: v.x1 - a.x1,
    top: a.y0 - v.y0,
    bottom: v.y1 - a.y1,
  }
  for (const [side, gap] of Object.entries(margins)) {
    if (gap < 4) {
      fail(
        'training',
        `${g}: only ${m(gap)} of grass on the ${side} of the area — a goal will not fit. AREA_MARGIN is what sets this; take it to ${(4 - gap + 5).toFixed(1)}.`,
      )
    }
  }

  /*
   * (b) the area is CENTRED along the length, and hangs the bench off the
   *     bottom across the width.
   *
   * The old claim wanted all four margins equal. It was right while the board
   * was four hand-written rectangles and it is wrong now: the bench strip is
   * part of the bottom margin on purpose, because a bench belongs outside the
   * playing area and under it, which is where every board a coach already uses
   * puts it. So the claim is now the two halves of the real intent — nothing
   * drifts sideways, and the bottom margin is the top margin plus exactly the
   * strip and nothing else.
   */
  if (Math.abs(margins.left - margins.right) > 0.11) {
    fail(
      'training',
      `${g}: margins of ${m(margins.left)} and ${m(margins.right)} along the length. The area is off centre by ${m(Math.abs(margins.left - margins.right) / 2)}; centre x on ${(PITCH.length / 2).toFixed(1)}.`,
    )
  }
  const strip = v.bench ? v.bench.y1 - v.bench.y0 : 0
  if (Math.abs(margins.bottom - margins.top - strip) > 0.11) {
    fail(
      'training',
      `${g}: bottom margin ${m(margins.bottom)} against a top of ${m(margins.top)} and a ${m(strip)} bench. Set y1 to ${(a.y1 + margins.top + strip).toFixed(2)}.`,
    )
  }

  // (c) a counter placed on the band's edge is wholly inside the cones.
  const inset = areaInset(v)
  const r = (COUNTER_D / 2) * (v.counter ?? 1)
  if (inset < r) {
    fail('training', `${g}: an inset of ${m(inset)} against a counter's ${m(r)} on this board. Take it to ${(r + 0.4).toFixed(2)}.`)
  }
  for (const axis of ['x', 'y']) {
    const [b0, b1] = areaBand(v, axis)
    const span = axis === 'x' ? a.x1 - a.x0 : a.y1 - a.y0
    if (!(b1 > b0)) {
      fail(
        'training',
        `${g}: the ${axis} band is ${b0}..${b1}, which is inside out — a ${span}m area cannot hold a counter inset ${m(inset)}. AREA_MIN on this axis must be at least ${(inset * 2 + r * 2).toFixed(1)}.`,
      )
    }
    if (b0 < 0 || b1 > 100) {
      fail('training', `${g}: the ${axis} band is ${b0}..${b1}, outside the crop. The area is not inside the view.`)
    }
  }

  // (d) whatever is ruled inside the area actually fits in it.
  const shortest = Math.min(a.x1 - a.x0, a.y1 - a.y0)
  if (a.middle && a.middle >= shortest) {
    fail('training', `${g}: a ${a.middle}m middle square in a ${a.x1 - a.x0} x ${a.y1 - a.y0} area. Take the factor in trainingView to ${(shortest / 2 / shortest).toFixed(2)} of the short side or less.`)
  }
  if (a.circle && a.circle * 2 >= a.y1 - a.y0) {
    fail('training', `${g}: a ${a.circle}m circle is ${a.circle * 2}m across in a ${a.y1 - a.y0}m width. Take the radius to ${((a.y1 - a.y0) / 4).toFixed(1)}.`)
  }
  if (a.box && a.box.depth * 2 >= a.x1 - a.x0) {
    fail('training', `${g}: two ${a.box.depth}m end areas meet in the middle of a ${a.x1 - a.x0}m length. Take the depth to ${((a.x1 - a.x0) / 5).toFixed(1)}.`)
  }
  if (a.box && a.box.width >= a.y1 - a.y0) {
    fail('training', `${g}: a ${a.box.width}m end area across a ${a.y1 - a.y0}m width. Take it to ${((a.y1 - a.y0) * 0.55).toFixed(1)}.`)
  }
}

/* ── 5 · A counter is the same size on every board ──────────────────────────
 * TOKEN_R is fixed in metres, so a counter that is 5.7% of the full pitch is
 * 13.1% of a 20m rondo square — the same counter taking 2.3x the share of the
 * screen, which is what the coach was looking at when he said they were huge.
 * `PitchView.counter` is the correction, and it comes in two halves.
 *
 * ── THE MATCH VIEWS ARE NOT IN THE BAND, AND THEY ARE NOT MEANT TO BE ──────
 *
 * `attacking-box` runs at 11.4% of its 37m short side, and it always has. That
 * is the closest crop in the studio and every diagram anybody has drawn on it
 * was drawn with counters that size. Bringing it into the band would change a
 * match view, which docs/TRAINING.md rules out before anything else and rules
 * out for good reason: this piece of work is about the session boards and a
 * coach's saved systems must come back looking like themselves.
 *
 * So the claim about a match view is the OPPOSITE one — that it declares no
 * counter size at all, which is the whole of the promise that nothing on it
 * moved. The 4-9% band is asserted where it was introduced: on the grids.
 */
{
  if (Math.abs(COUNTER_D - TOKEN_R * 2) > 1e-9) {
    fail(
      'counter',
      `COUNTER_D in board/pitch.ts is ${m(COUNTER_D)} against a TOKEN_R of ${m(TOKEN_R)} in board/Token.tsx. Set COUNTER_D to ${(TOKEN_R * 2).toFixed(1)}.`,
    )
  }
  for (const v of PITCH_VIEW_LIST) {
    if (!v.area && v.counter !== undefined) {
      fail(
        'counter',
        `${v.id} is a match view carrying counter ${v.counter}. It must carry none: a match board is byte-identical to what the coach saved. Delete the field.`,
      )
    }
  }
  for (const [g, v] of boards) {
    const crop = cropRect(v)
    const short = Math.min(crop.w, crop.h) / U
    const share = (TOKEN_R * 2 * (v.counter ?? 1)) / short
    if (share < 0.04 || share > 0.09) {
      const want = Math.round(((0.057 * short) / (TOKEN_R * 2)) * 1000) / 1000
      fail(
        'counter',
        `${g}: a counter is ${(share * 100).toFixed(1)}% of a ${short.toFixed(1)}m short side, outside 4-9%. Set this board's counter to ${want}.`,
      )
    }
  }
}

/* ── 6 · The bench holds a whole squad, tidily ──────────────────────────────
 * Switching onto a training board stands every player down, and that is up to
 * twenty-two counters. They have to fit in the strip, they have to stay on the
 * board, and no two of them may be laid on top of each other — which is the
 * whole reason the row is laid out rather than left where everybody was.
 */
for (const [g, v] of boards) {
  if (!v.bench) {
    fail('bench', `${g}: a training board with no bench strip. Nothing can be stood down on it.`)
    continue
  }
  const ids = Array.from({ length: 22 }, (_, i) => `p${i}`)
  const spots = benchLayout(v, ids)
  const d = COUNTER_D * (v.counter ?? 1)
  const pts = ids.map((id) => toMetres(v, spots[id].x, spots[id].y))

  for (let i = 0; i < pts.length; i++) {
    const q = pts[i]
    const out = Math.max(v.bench.x0 - q.x, q.x - v.bench.x1, v.bench.y0 - q.y, q.y - v.bench.y1)
    if (out > 0.06) {
      fail(
        'bench',
        `${g}: counter ${i} sits ${m(out)} outside a strip of ${v.bench.x0.toFixed(1)}..${v.bench.x1.toFixed(1)} by ${v.bench.y0.toFixed(1)}..${v.bench.y1.toFixed(1)}. Widen the strip by that much.`,
      )
      break
    }
  }

  let worst = Infinity
  let pair = ''
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const gap = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
      if (gap < worst) {
        worst = gap
        pair = `${i} and ${j}`
      }
    }
  }
  if (worst < d * 0.95) {
    fail(
      'bench',
      `${g}: counters ${pair} are ${m(worst)} apart on a bench of ${m(d)} counters. BENCH_STEP must be at least ${(1.05).toFixed(2)} and the strip at least ${m(d * 1.15 * 2 + 1)}.`,
    )
  }
}

if (faults.length === 0) {
  console.log(
    `${PITCH_VIEW_LIST.length} views, 6 claims each, plus the tolerance, the remap, the counter size on every board and ${boards.length} training grids with their benches. All clear.`,
  )
  process.exit(0)
}
const groups = [...new Set(faults.map((f) => f.group))]
for (const g of groups) {
  console.log(`\n${g}`)
  for (const f of faults.filter((x) => x.group === g)) console.log(`  · ${f.line}`)
}
console.log(`\n${faults.length} faults.`)
process.exit(1)
