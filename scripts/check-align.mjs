/**
 * Lining up does what it says, on every board.
 *
 * ── WHY THIS IS A SCRIPT AND NOT A CODE REVIEW ───────────────────────────────
 *
 * A snap is invisible when it works and invisible when it is 4cm out. Nobody
 * reviewing a diff can see that a back four came out level on the horizontal
 * pitch and 0.03m crooked on the upright one, because the numbers involved are
 * percent of a crop that is a different shape on each of the seven views, run
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
  PITCH_VIEWS,
  PITCH_VIEW_LIST,
  cropRect,
  metresToUnits,
  remap,
  toMetres,
  toPercent,
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

if (faults.length === 0) {
  console.log(`${PITCH_VIEW_LIST.length} views, 6 claims each, plus the tolerance and the remap. All clear.`)
  process.exit(0)
}
const groups = [...new Set(faults.map((f) => f.group))]
for (const g of groups) {
  console.log(`\n${g}`)
  for (const f of faults.filter((x) => x.group === g)) console.log(`  · ${f.line}`)
}
console.log(`\n${faults.length} faults.`)
process.exit(1)
