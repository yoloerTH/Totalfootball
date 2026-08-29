/**
 * Every set piece is drawable, on the board it says it is drawn on.
 *
 * ── WHY THIS IS A SCRIPT AND NOT A CODE REVIEW ───────────────────────────────
 *
 * A counter is 4.2 metres across on a board drawn in real metres, and a penalty
 * area is 40.32 by 16.5. Twenty-two of them in there is 55% of the grass
 * covered, so two men authored 3 metres apart do not look "a little tight" —
 * one of them disappears under the other, name and face and all, and the
 * routine silently teaches something else. Nobody catches that by reading a
 * table of numbers, and by the time it is on screen it is a fiddle rather than
 * a fix.
 *
 * ── IT COLLECTS, AND IT PRINTS THE CORRECTED NUMBER ──────────────────────────
 *
 * One run gives the whole punch list. Every fault line carries the metres the
 * pair is short by AND the `s` that clears it, so the fix is a copy-paste into
 * setpieces.ts rather than another round of arithmetic. Nothing here should
 * ever be worked out by hand.
 *
 * Run: node scripts/check-setpieces.mjs
 */

import { readFileSync } from 'node:fs'
import { PITCH, PITCH_VIEWS, toMetres, metresToUnits, cropRect } from '../src/studio/board/pitch.ts'
import { arrowGeometry } from '../src/studio/arrows.ts'
import {
  SET_PIECES,
  CLEAR_SAME,
  CLEAR_CROSS,
  castFor,
  spotToMetres,
  spotToPercent,
} from '../src/studio/setpieces.ts'

const faults = []
const fail = (group, line) => faults.push({ group, line })
const m = (n) => `${n.toFixed(2)}m`

/* ── The constant this file's whole premise rests on ────────────────────────
 * CLEAR_SAME is only meaningful if it clears a counter. TOKEN_R lives in a
 * .tsx this script cannot import, so it is read out of the source instead —
 * which is the point: if somebody grows the counters, this fails here rather
 * than on a coach's screen.
 */
const tokenSrc = readFileSync('src/studio/board/Token.tsx', 'utf8')
const TOKEN_R = Number(/export const TOKEN_R = ([\d.]+)/.exec(tokenSrc)?.[1])
const BALL_R = Number(/export const BALL_R = ([\d.]+)/.exec(tokenSrc)?.[1])
if (!TOKEN_R || !BALL_R) fail('constants', 'Could not read TOKEN_R / BALL_R out of board/Token.tsx')
else {
  if (CLEAR_SAME < TOKEN_R * 2)
    fail('constants', `CLEAR_SAME is ${CLEAR_SAME} but a counter is ${TOKEN_R * 2} across. Set CLEAR_SAME to ${(TOKEN_R * 2 + 0.4).toFixed(1)}.`)
  if (CLEAR_CROSS < TOKEN_R * 1.6)
    fail('constants', `CLEAR_CROSS is ${CLEAR_CROSS}: the faces stop being readable. Set it to ${(TOKEN_R * 1.7).toFixed(1)}.`)
}
const BALL_CLEAR = TOKEN_R + BALL_R + 0.5

const gap = (a, b) => Math.hypot(a.d - b.d, a.s - b.s)

/** Pitch metres back to the board's own sideways axis. The inverse of `spotToMetres`. */
const spotToSideways = (view, mm) => (view.flip ? PITCH.width - mm.y : mm.y)

/** The `s` that would clear a pair, keeping `d`, moving `b` away from `a`. */
function clearedS(a, b, want) {
  const dd = Math.abs(a.d - b.d)
  if (dd >= want) return null
  const need = Math.sqrt(want * want - dd * dd)
  const dir = b.s >= a.s ? 1 : -1
  return a.s + dir * (need + 0.05)
}

function suggest(a, b, want, piece, castName, ia, ib) {
  const s = clearedS(a, b, want)
  const where = `${piece.id} ${castName}[${ia}] (d ${a.d}, s ${a.s}) and [${ib}] (d ${b.d}, s ${b.s})`
  if (s === null || s < 0 || s > PITCH_VIEWS.full.y1)
    return `${where}: ${m(gap(a, b))} apart, wants ${m(want)}. Too close in DEPTH to fix across the board — move [${ib}] to d ${(a.d + (b.d >= a.d ? want : -want)).toFixed(1)}.`
  return `${where}: ${m(gap(a, b))} apart, wants ${m(want)}. Move [${ib}] to s ${s.toFixed(1)}.`
}

for (const piece of SET_PIECES) {
  const view = PITCH_VIEWS[piece.view]
  if (!view) {
    fail(piece.id, `names a view that does not exist: ${piece.view}`)
    continue
  }
  const depth = view.x1 - view.x0

  const casts = [
    ['us', castFor(piece, 'us')],
    ['them', castFor(piece, 'them')],
  ]

  for (const [name, cast] of casts) {
    if (cast.length !== 11) fail(piece.id, `${name} has ${cast.length} spots, wants 11`)
    const keepers = cast.filter((sp) => sp.gk).length
    if (keepers !== 1) fail(piece.id, `${name} has ${keepers} goalkeepers, wants exactly 1`)

    cast.forEach((sp, i) => {
      if (sp.d < 0 || sp.d > depth)
        fail(piece.id, `${name}[${i}] is ${m(sp.d)} out, and this board only reaches ${m(depth)}`)
      if (sp.s < 0 || sp.s > PITCH.width)
        fail(piece.id, `${name}[${i}] is at s ${sp.s}, off the ${PITCH.width}m width`)
      // Percent must survive the round trip, or a dragged counter jumps.
      const p = spotToPercent(view, sp)
      const back = toMetres(view, p.x, p.y)
      const there = spotToMetres(view, sp)
      const drift = Math.hypot(back.x - there.x, back.y - there.y)
      if (drift > 0.1) fail(piece.id, `${name}[${i}] drifts ${m(drift)} through percent. The crop and the spot disagree.`)
      // Nobody standing on the ball.
      const b = gap(sp, piece.ball)
      if (b < BALL_CLEAR)
        fail(piece.id, `${name}[${i}] is ${m(b)} from the ball, wants ${m(BALL_CLEAR)}. Move it to s ${(clearedS(piece.ball, sp, BALL_CLEAR) ?? sp.s).toFixed(1)}.`)
    })

    for (let i = 0; i < cast.length; i++)
      for (let j = i + 1; j < cast.length; j++)
        if (gap(cast[i], cast[j]) < CLEAR_SAME)
          fail(piece.id, suggest(cast[i], cast[j], CLEAR_SAME, piece, name, i, j))
  }

  const [, us] = casts[0]
  const [, them] = casts[1]
  for (let i = 0; i < us.length; i++)
    for (let j = 0; j < them.length; j++)
      if (gap(us[i], them[j]) < CLEAR_CROSS) {
        const a = us[i]
        const b = them[j]
        const s = clearedS(a, b, CLEAR_CROSS)
        const where = `${piece.id} us[${i}] (d ${a.d}, s ${a.s}) and them[${j}] (d ${b.d}, s ${b.s})`
        fail(
          piece.id,
          s === null || s < 0 || s > PITCH.width
            ? `${where}: ${m(gap(a, b))} apart, wants ${m(CLEAR_CROSS)}. Move them[${j}] to d ${(a.d + (b.d >= a.d ? CLEAR_CROSS : -CLEAR_CROSS)).toFixed(1)}.`
            : `${where}: ${m(gap(a, b))} apart, wants ${m(CLEAR_CROSS)}. Move them[${j}] to s ${s.toFixed(1)}.`,
        )
      }

  /* ── The delivery bows the right way ──────────────────────────────────────
   * An in-swinger arrives closer to the goal than the straight line it was
   * drawn along. That is a fact about the picture, so it is checkable: sample
   * the quadratic at its midpoint and compare its distance from the goal line
   * to the chord's. A sign flip on `bend` is invisible in a table of numbers
   * and obvious on a board.
   */
  if (piece.delivery && piece.delivery.bend !== 0) {
    const from = spotToPercent(view, piece.ball)
    const to = spotToPercent(view, piece.delivery)
    const { mid } = arrowGeometry(from, to, piece.delivery.bend)
    const midM = toMetres(view, mid.x, mid.y)
    const chordM = toMetres(view, (from.x + to.x) / 2, (from.y + to.y) / 2)
    const goalX = view.flip ? 0 : PITCH.length
    const wide = Math.abs(piece.ball.s - PITCH.width / 2) > 10
    if (wide) {
      // A CROSS. An in-swinger arrives nearer the goal than the line it was
      // drawn along; that is what makes it an in-swinger and not a lofted ball.
      const bowD = Math.abs(goalX - midM.x)
      const chordD = Math.abs(goalX - chordM.x)
      if (bowD >= chordD)
        fail(piece.id, `the delivery bows AWAY from the goal (${m(bowD)} at its midpoint against ${m(chordD)} straight). Flip the sign: bend ${-piece.delivery.bend}.`)
    } else {
      // A SHOT. Depth says nothing about it — the claim worth checking is that
      // it is bent away from where the keeper is standing, not into his hands.
      const keeper = castFor(piece, piece.ours === 'defend' ? 'us' : 'them').find((sp) => sp.gk)
      const bowS = spotToSideways(view, midM)
      const chordS = spotToSideways(view, chordM)
      if (keeper && Math.abs(bowS - keeper.s) <= Math.abs(chordS - keeper.s))
        fail(piece.id, `the shot bends TOWARDS the keeper at s ${keeper.s} (${m(Math.abs(bowS - keeper.s))} off against ${m(Math.abs(chordS - keeper.s))} straight). Flip the sign: bend ${-piece.delivery.bend}.`)
    }
  }
}

/* ── The boards themselves ──────────────────────────────────────────────────
 * The one claim the whole feature was built on: on a set-piece board, the goal
 * the ball is going into is at the TOP.
 */
for (const id of ['attacking-set-piece', 'defending-set-piece']) {
  const v = PITCH_VIEWS[id]
  const goalX = v.flip ? 0 : PITCH.length
  const goal = metresToUnits(v, goalX, PITCH.width / 2)
  const halfway = metresToUnits(v, v.flip ? v.x1 : v.x0, PITCH.width / 2)
  if (!(goal.y < halfway.y)) fail(id, `the goal is not at the top of the board (goal y ${goal.y}, halfway y ${halfway.y})`)
  const r = cropRect(v)
  const cx = r.x + r.w / 2
  if (Math.abs(goal.x - cx) > 0.01) fail(id, `the goal is not centred across the board (x ${goal.x}, centre ${cx})`)
}

if (faults.length === 0) {
  console.log(`${SET_PIECES.length} set pieces, ${SET_PIECES.length * 22} counters. All clear.`)
  process.exit(0)
}
const groups = [...new Set(faults.map((f) => f.group))]
for (const g of groups) {
  console.log(`\n${g}`)
  for (const f of faults.filter((x) => x.group === g)) console.log(`  · ${f.line}`)
}
console.log(`\n${faults.length} faults.`)
process.exit(1)
