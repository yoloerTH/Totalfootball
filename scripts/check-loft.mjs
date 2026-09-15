/**
 * The ball comes off the grass, and the grass point never moves.
 *
 * ── WHY THIS IS A SCRIPT AND NOT A CODE REVIEW ───────────────────────────────
 *
 * A loft is the first mark in the studio whose DRAWING and whose TRUTH are
 * deliberately different numbers. The ball is painted two metres above the spot
 * it is actually on, and everything that measures the board — the camera in
 * ./check-camera.mjs, the strike volume in src/studio/audio.ts, the distance a
 * set piece is laid out from — has to go on reading the spot rather than the
 * painting.
 *
 * That is a claim nobody can catch by looking. A camera that had started
 * following the painted ball would tilt a little way at the sky on one phase in
 * twenty, the film would still play, and the only symptom would be a board that
 * felt subtly wrong to a coach who could not say why. So a machine makes the
 * claim instead, on every build.
 *
 * ── IT COLLECTS, AND EVERY LINE CARRIES THE FIX ──────────────────────────────
 *
 * One run gives the whole punch list. A fault says what came out AND what
 * should have come out, because half a fault report is a second run.
 *
 * Run: node --import ./scripts/lib/ts.mjs scripts/check-loft.mjs
 */

import { BALL_KINDS, DEFAULT_LOFT, heightOf, liftAt } from '../src/studio/arrows.ts'
import { resolveAct, tweenActs } from '../src/studio/tween.ts'
import { ballFields, emptyAct } from '../src/studio/schema.ts'
import { arrowStyle } from '../src/studio/board/surfaces.ts'
import { ACTION, ARROW_TOOL_IDS, ARROW_MARK, TOOL_DOC } from '../src/studio/editor/guide.ts'
import { SET_PIECES } from '../src/studio/setpieces.ts'

const faults = []
const fail = (group, line) => faults.push({ group, line })

/** Every kind the union carries. Kept here so a new one shows up as a fault. */
const KINDS = ['pass', 'run', 'carry', 'press', 'loft', 'line']
const near = (a, b, tol) => Math.abs(a - b) <= tol

// ═══════════════════════════════════════════════════════════════════════════
// 1 · THE VOCABULARY IS WHOLE
//
// A half-finished rename is the failure this catches: the kind renamed in the
// union and left behind in the style table draws an arrow with no treatment at
// all, which is an invisible arrow rather than an error.
// ═══════════════════════════════════════════════════════════════════════════
{
  const style = arrowStyle(new Proxy({}, { get: () => '#000000' }))
  for (const kind of KINDS) {
    if (!style[kind]) {
      fail('vocabulary', `arrowStyle() has no row for '${kind}'. Add one to arrowStyle in src/studio/board/surfaces.ts — a kind with no treatment draws nothing.`)
    }
  }
  for (const kind of Object.keys(style)) {
    if (!KINDS.includes(kind)) {
      fail('vocabulary', `arrowStyle() still has a row for '${kind}', which is not an ArrowKind. Remove it, or add '${kind}' to ArrowKind in src/studio/schema.ts.`)
    }
  }
  for (const id of ARROW_TOOL_IDS) {
    if (!TOOL_DOC[id]) fail('vocabulary', `TOOL_DOC has no entry for the tool '${id}'. The toolbar renders its label from there, so the button comes out blank.`)
    if (!ACTION.arm[id]) fail('vocabulary', `ACTION.arm has no line for '${id}'. The two-tap prompt is empty on the first tap.`)
    if (!ACTION.aim[id]) fail('vocabulary', `ACTION.aim has no line for '${id}'. The two-tap prompt is empty on the second tap.`)
  }
  if (!ARROW_MARK.height) {
    fail('vocabulary', `ARROW_MARK.height is missing. The Height slider in the arrow panel renders its caption from it.`)
  }
  if (!ARROW_TOOL_IDS.includes('loft')) {
    fail('vocabulary', `ARROW_TOOL_IDS does not contain 'loft'. Without it the tool is not in the toolbar and 'perform' is never handed one.`)
  }
  if (!BALL_KINDS.includes('loft')) {
    fail('vocabulary', `BALL_KINDS does not contain 'loft'. A loft would draw as a line and move no ball. Wanted ['pass', 'loft'], got [${BALL_KINDS.map((k) => `'${k}'`).join(', ')}].`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · HEIGHT RESOLVES THE WAY THE PANEL PROMISES
//
// The distinction this protects is `?? DEFAULT` against `|| DEFAULT`. Under the
// second one a coach who drags the slider to the bottom gets 55% back, and the
// driven ball they asked for is not reachable from the interface at all.
// ═══════════════════════════════════════════════════════════════════════════
{
  const cases = [
    ['a ground pass', { kind: 'pass' }, 0],
    ['a pass with a stray height on it', { kind: 'pass', height: 0.8 }, 0],
    ['a run', { kind: 'run' }, 0],
    ['a line', { kind: 'line', height: 0.5 }, 0],
    ['a loft drawn before the slider existed', { kind: 'loft' }, DEFAULT_LOFT],
    ['a loft driven flat', { kind: 'loft', height: 0 }, 0],
    ['a loft at half', { kind: 'loft', height: 0.5 }, 0.5],
    ['a loft over the top of the range', { kind: 'loft', height: 4 }, 1],
    ['a loft under the bottom of it', { kind: 'loft', height: -2 }, 0],
  ]
  for (const [what, arrow, want] of cases) {
    const got = heightOf(arrow)
    if (!near(got, want, 1e-9)) {
      fail('height', `heightOf(${what}) is ${got.toFixed(3)}, wanted ${want.toFixed(3)}. Fix heightOf in src/studio/arrows.ts.`)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · THE ARC STARTS AND FINISHES ON THE GRASS
//
// Both zeroes have to be EXACT, not close. A ball that is four centimetres off
// the floor on the frame it is struck has a shadow that does not touch it, and
// the first frame of every phase is the one the still export takes.
// ═══════════════════════════════════════════════════════════════════════════
{
  const heights = [0, 0.1, 0.25, DEFAULT_LOFT, 0.75, 1]
  for (const h of heights) {
    const at0 = liftAt(h, 0)
    const at1 = liftAt(h, 1)
    if (at0 !== 0) fail('arc', `liftAt(${h}, 0) is ${at0}, wanted exactly 0 — the ball must be on the grass on the frame it is struck.`)
    if (!near(at1, 0, 1e-12)) fail('arc', `liftAt(${h}, 1) is ${at1}, wanted exactly 0 — the ball must be on the grass on the frame it lands.`)

    const peak = liftAt(h, 0.5)
    if (!near(peak, h, 1e-9)) fail('arc', `liftAt(${h}, 0.5) is ${peak.toFixed(4)}, wanted ${h.toFixed(4)} — the apex is the height that was authored.`)

    let high = 0
    for (let i = 0; i <= 200; i++) high = Math.max(high, liftAt(h, i / 200))
    if (high > h + 1e-9) {
      fail('arc', `liftAt(${h}, ·) reaches ${high.toFixed(4)} somewhere in the flight, which is above the authored ${h.toFixed(4)}. Clamp the arc in liftAt.`)
    }
  }
  // Monotone up then down, so the ball never dips mid-flight.
  let prev = -1
  for (let i = 0; i <= 50; i++) {
    const v = liftAt(1, i / 100)
    if (v < prev - 1e-12) fail('arc', `liftAt(1, ·) falls from ${prev.toFixed(4)} to ${v.toFixed(4)} while still climbing (t=${(i / 100).toFixed(2)}). The first half of the arc must rise.`)
    prev = v
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · A FLIGHT LIFTS, AND MOVES THE GRASS POINT BY NOTHING
//
// The load-bearing one. Two tweens of the same journey, identical but for the
// height, must agree on x and y at every sample — that is the whole promise
// made to the camera, the audio and the set pieces.
// ═══════════════════════════════════════════════════════════════════════════
const journey = (arrows) => {
  const a = { ...emptyAct([], 1), arrows, ...ballFields([{ id: 'b1', x: 18, y: 50 }]) }
  const b = { ...emptyAct([], 2), arrows: [], ...ballFields([{ id: 'b1', x: 82, y: 50 }]) }
  return [a, b]
}
const ARROW = (over) => ({
  id: 'a1',
  kind: 'loft',
  from: { x: 18, y: 50 },
  to: { x: 82, y: 50 },
  ...over,
})
const sample = (from, to, p) => tweenActs(from, to, p).balls.find((b) => b.id === 'b1')

{
  const [hi0, hi1] = journey([ARROW({ height: 0.6, bend: 0.4 })])
  const [lo0, lo1] = journey([{ ...ARROW({ bend: 0.4 }), kind: 'pass' }])

  /*
   * The whole sweep runs even after a fault. Breaking out on the first one
   * leaves `peak` half-accumulated, and the flight check below then reports a
   * height that is nobody's bug — a second fault pointing at the wrong file is
   * worse than no second fault.
   */
  let peak = 0
  let drift = null
  for (let i = 0; i <= 40; i++) {
    const p = i / 40
    const air = sample(hi0, hi1, p)
    const ground = sample(lo0, lo1, p)
    peak = Math.max(peak, air.lift)
    if (!drift && (!near(air.x, ground.x, 1e-9) || !near(air.y, ground.y, 1e-9))) {
      drift = { p, air, ground }
    }
  }
  if (drift) {
    fail('grass', `At p=${drift.p.toFixed(3)} the lofted ball sits at (${drift.air.x.toFixed(4)}, ${drift.air.y.toFixed(4)}) and the identical ground pass at (${drift.ground.x.toFixed(4)}, ${drift.ground.y.toFixed(4)}). Wanted them equal: height must be spent at draw time only. Put the lift back in RenderBall.lift and off x/y in src/studio/tween.ts.`)
  }
  if (!near(peak, 0.6, 0.02)) {
    fail('flight', `A loft at height 0.6 peaks at lift ${peak.toFixed(3)}, wanted 0.600 (±0.02). Check flightOver matched the arrow and liftAt is fed the eased t in src/studio/tween.ts.`)
  }
  const ends = [sample(hi0, hi1, 0).lift, sample(hi0, hi1, 1).lift]
  for (const [i, v] of ends.entries()) {
    if (!near(v, 0, 1e-9)) {
      fail('flight', `A loft is at lift ${v.toFixed(4)} on the ${i === 0 ? 'first' : 'last'} frame of the move, wanted 0.0000 — a phase's own pose must have the ball on the grass.`)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · A STRAIGHT LOFT STILL FLIES
//
// The regression guard with a name on it. `flightOver` inherited a loop that
// opened `if (!arrow.bend) continue`, which was correct while a bow was all it
// could return and silently grounds every goal kick hit straight down the
// middle the moment it can return a height as well.
// ═══════════════════════════════════════════════════════════════════════════
{
  const [a, b] = journey([ARROW({ height: 0.7 })]) // no bend at all
  let peak = 0
  for (let i = 0; i <= 40; i++) peak = Math.max(peak, sample(a, b, i / 40).lift)
  if (!near(peak, 0.7, 0.02)) {
    fail('flight', `An UNBOWED loft at height 0.7 peaks at lift ${peak.toFixed(3)}, wanted 0.700 (±0.02). flightOver in src/studio/arrows.ts is skipping arrows with no bend — the test must be 'says nothing at all', i.e. \`if (!arrow.bend && !height) continue\`.`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · WHAT MUST STAY ON THE FLOOR
// ═══════════════════════════════════════════════════════════════════════════
{
  // A ground pass, on a phase that also carries a loft going the other way.
  const [a, b] = journey([
    { ...ARROW({ bend: 0.3 }), kind: 'pass' },
    { id: 'a2', kind: 'loft', from: { x: 82, y: 20 }, to: { x: 18, y: 20 }, height: 0.9 },
  ])
  for (let i = 0; i <= 20; i++) {
    const v = sample(a, b, i / 20).lift
    if (v !== 0) {
      fail('floor', `A ground pass reaches lift ${v.toFixed(4)} at p=${(i / 20).toFixed(2)}, wanted 0. It is taking the height off the loft drawn elsewhere on the phase — flightOver must not match an arrow pointing the other way.`)
      break
    }
  }
}
{
  // A carried ball: the player and the ball make the same journey, and the
  // phase also has a loft drawn along that same line.
  const tok = (x) => ({ id: 't1', side: 'us', x, y: 50 })
  const arrows = [
    { id: 'c1', kind: 'carry', from: { x: 18, y: 50 }, to: { x: 82, y: 50 }, bend: 0.4 },
    { id: 'a1', kind: 'loft', from: { x: 18, y: 50 }, to: { x: 82, y: 50 }, height: 0.9 },
  ]
  const a = { ...emptyAct([tok(18)], 1), arrows, ...ballFields([{ id: 'b1', x: 18, y: 50 }]) }
  const b = { ...emptyAct([tok(82)], 2), arrows: [], ...ballFields([{ id: 'b1', x: 82, y: 50 }]) }
  for (let i = 0; i <= 20; i++) {
    const v = tweenActs(a, b, i / 20).balls.find((x) => x.id === 'b1').lift
    if (v !== 0) {
      fail('floor', `A CARRIED ball reaches lift ${v.toFixed(4)} at p=${(i / 20).toFixed(2)}, wanted 0. A ball at a running player's feet cannot be in the air — the rider branch in src/studio/tween.ts must force height to 0.`)
      break
    }
  }
}
{
  // A pose is a board at rest.
  const act = { ...emptyAct([], 1), arrows: [ARROW({ height: 0.9 })], ...ballFields([{ id: 'b1', x: 40, y: 40 }]) }
  for (const ball of resolveAct(act).balls) {
    if (ball.lift !== 0) {
      fail('floor', `resolveAct gives ball '${ball.id}' a lift of ${ball.lift}, wanted 0. A pose is not a moment in a flight, and a still export takes its frame from here.`)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · THE SET-PIECE DELIVERIES ARE STRUCK, NOT ROLLED
//
// Dormant data — the picker is commented out of the drawer — and checked anyway,
// because the day it comes back is the day nobody re-reads this table.
// ═══════════════════════════════════════════════════════════════════════════
for (const piece of SET_PIECES) {
  const d = piece.delivery
  if (!d) continue
  if (d.kind === 'loft') {
    const h = heightOf(d)
    if (h <= 0) {
      fail('set pieces', `'${piece.id}' delivery is a loft with height ${d.height}, which flies along the floor. Give it a height between 0.3 and 0.5, or make it a pass.`)
    }
    if (h > 0.6) {
      fail('set pieces', `'${piece.id}' delivery is at height ${h.toFixed(2)}, above the 0.6 a delivery into a box should reach. Wanted 0.3 to 0.5 — higher than that reads as a goal kick.`)
    }
  } else if (/corner|fk-wide/.test(piece.id)) {
    fail('set pieces', `'${piece.id}' delivery is kind '${d.kind}'. A corner or a wide free kick is struck off the grass: wanted kind 'loft' with a height near 0.5.`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// THE PUNCH LIST
// ═══════════════════════════════════════════════════════════════════════════
if (faults.length === 0) {
  console.log('check-loft: the ball leaves the grass and the grass point holds.')
  process.exit(0)
}

const groups = new Map()
for (const f of faults) {
  if (!groups.has(f.group)) groups.set(f.group, [])
  groups.get(f.group).push(f.line)
}
console.error(`check-loft: ${faults.length} fault${faults.length === 1 ? '' : 's'}.\n`)
for (const [group, lines] of groups) {
  console.error(`── ${group} ${'─'.repeat(Math.max(0, 74 - group.length))}`)
  for (const line of lines) console.error(`  · ${line}`)
  console.error('')
}
process.exit(1)
