/**
 * The camera follows the ball the coach chose, from the phase they chose it on.
 *
 * ── WHY THIS IS A SCRIPT AND NOT A CODE REVIEW ───────────────────────────────
 *
 * "It only changes the phases that come after" is a claim about a document with
 * forty phases in it, and the way it fails is silent: an edit on phase 1 wipes
 * a choice made on phase 5, the film still plays, and the only symptom is a
 * camera on the wrong ball two thirds of the way through a rondo. Nobody reads
 * that out of a diff and nobody catches it by scrubbing a timeline. It is a
 * claim about resolution order, so a machine should make it.
 *
 * ── IT COLLECTS, AND IT PRINTS WHAT IT WANTED ────────────────────────────────
 *
 * One run gives the whole punch list, and every fault line carries what came
 * out and what should have come out.
 *
 * Run: node --import ./scripts/lib/ts.mjs scripts/check-camera.mjs
 */

import {
  CAMERA_PUSHES,
  cameraRect,
  frameMetres,
  pushAt,
  pushChoice,
  referenceBallChoice,
  referenceBallId,
  resolvePush,
  shotFor,
  trackedBall,
} from '../src/studio/camera.ts'
import { resolveAct, tweenActs } from '../src/studio/tween.ts'
import { ballsOf, ballFields, forgetTrackedBall } from '../src/studio/schema.ts'
import { cropRect, viewFor, U } from '../src/studio/board/pitch.ts'

const faults = []
const fail = (group, line) => faults.push({ group, line })

/* ── the smallest document that has a camera and some balls on it ─────────── */

const BALLS = ['A', 'B', 'C']

/**
 * One phase, carrying the named balls, spread across the middle of the board.
 *
 * `extra` is spread LAST so a case can hand the phase arrows or a hand-drawn
 * frame. It is the fourth argument and not a fourth field on every call because
 * most of these cases are about balls and would carry an empty object each.
 */
const act = (id, balls, trackingBallId, extra) => ({
  id,
  title: id,
  caption: '',
  tokens: [],
  arrows: [],
  bands: [],
  ...ballFields(balls.map((b, i) => ({ id: b, x: 30 + i * 15, y: 40 + i * 8 }))),
  ...(trackingBallId === undefined ? {} : { trackingBallId }),
  ...extra,
})

/** A film of `n` phases, all carrying every ball, with `choices` written on. */
const film = (n, choices = {}) => ({
  id: 'sys',
  title: 'check',
  camera: 'follow',
  acts: Array.from({ length: n }, (_, i) => act(`p${i + 1}`, BALLS, choices[i])),
})

const view = viewFor(null)
const near = (a, b) => Math.abs(a - b) < 0.001

/**
 * Where the camera is centred on a phase, or null when it is wide.
 *
 * `Shot.x/y` is the CENTRE of the box, not its corner — see `Shot` in
 * ../src/studio/camera.ts. Reading it as a corner puts every expectation half a
 * margin out and makes a working camera look broken by a constant.
 */
const centre = (system, i) => {
  const s = shotFor(system, system.acts[i], view)
  return s ? { x: s.x, y: s.y } : null
}

/** Where a ball sits on a phase, in the same coordinates a shot is in. */
const ballAt = (system, i, id) => ballsOf(system.acts[i]).find((b) => b.id === id) ?? null

/**
 * The claim every one of these tests is really making: on phase `i` the camera
 * is centred on ball `want`, or is wide when `want` is null.
 */
const expectOn = (group, system, i, want) => {
  const c = centre(system, i)
  if (want === null) {
    if (c) fail(group, `p${i + 1} framed at (${c.x.toFixed(1)}, ${c.y.toFixed(1)}) — it must be wide, because no ball is chosen and there are ${ballsOf(system.acts[i]).length} on the phase.`)
    return
  }
  const b = ballAt(system, i, want)
  if (!c) {
    fail(group, `p${i + 1} is wide — it must be centred on ball ${want}, at (${b.x.toFixed(1)}, ${b.y.toFixed(1)}).`)
    return
  }
  if (!near(c.x, b.x) || !near(c.y, b.y)) {
    fail(group, `p${i + 1} framed at (${c.x.toFixed(1)}, ${c.y.toFixed(1)}) — it must be centred on ball ${want}, at (${b.x.toFixed(1)}, ${b.y.toFixed(1)}).`)
  }
}

/* ── 1 · nothing chosen ────────────────────────────────────────────────────
 * Several balls and no choice is the behaviour that shipped before any of this
 * existed, and it must be exactly what it was: wide, on every phase.
 */
{
  const s = film(4)
  for (let i = 0; i < 4; i++) expectOn('nothing chosen', s, i, null)
}

/* ── 2 · one choice, on the first phase ────────────────────────────────────── */
{
  const s = film(5, { 0: 'B' })
  for (let i = 0; i < 5; i++) expectOn('chosen on p1', s, i, 'B')
}

/* ── 3 · one choice, part way through ──────────────────────────────────────
 * THE HEADLINE CLAIM. Chosen on phase 3: phases 1 and 2 are untouched and stay
 * wide, phase 3 and everything after it follow the ball.
 */
{
  const s = film(6, { 2: 'C' })
  expectOn('chosen on p3', s, 0, null)
  expectOn('chosen on p3', s, 1, null)
  for (let i = 2; i < 6; i++) expectOn('chosen on p3', s, i, 'C')
}

/* ── 4 · two choices, and the later one owns the tail ──────────────────────
 * The case that the stamp-it-forwards version got wrong. Ball A from phase 1,
 * ball B from phase 4: phases 1-3 are on A, phases 4-6 are on B, and editing
 * the phase 1 choice to C must move phases 1-3 and NOTHING ELSE.
 */
{
  const s = film(6, { 0: 'A', 3: 'B' })
  for (let i = 0; i < 3; i++) expectOn('two choices', s, i, 'A')
  for (let i = 3; i < 6; i++) expectOn('two choices', s, i, 'B')

  const edited = { ...s, acts: s.acts.map((a, i) => (i === 0 ? { ...a, trackingBallId: 'C' } : a)) }
  for (let i = 0; i < 3; i++) expectOn('earlier edit', edited, i, 'C')
  for (let i = 3; i < 6; i++) expectOn('earlier edit', edited, i, 'B')
}

/* ── 5 · the three states of the field ─────────────────────────────────────
 * `null` is the one worth proving: it has to STOP an earlier choice reaching
 * the phases after it, which is the thing `undefined` cannot be made to do.
 */
{
  const s = film(5, { 0: 'A', 2: null })
  for (let i = 0; i < 2; i++) expectOn('stopped at p3', s, i, 'A')
  for (let i = 2; i < 5; i++) expectOn('stopped at p3', s, i, null)

  const cleared = { ...s, acts: s.acts.map((a, i) => (i === 2 ? { ...a, trackingBallId: undefined } : a)) }
  for (let i = 0; i < 5; i++) expectOn('cleared back to inheriting', cleared, i, 'A')
}

/* ── 6 · a chosen ball that is not on the phase ────────────────────────────
 * Two balls and the chosen one gone: wide, because guessing between the two
 * left is the tool deciding what the phase is about. One ball and the chosen
 * one gone: that ball, because there is nothing to guess between.
 */
{
  const s = film(3, { 0: 'A' })
  s.acts[1] = { ...s.acts[1], ...ballFields(ballsOf(s.acts[1]).filter((b) => b.id !== 'A')) }
  s.acts[2] = { ...s.acts[2], ...ballFields(ballsOf(s.acts[2]).filter((b) => b.id !== 'A' && b.id !== 'C')) }
  expectOn('chosen ball gone', s, 0, 'A')
  expectOn('chosen ball gone', s, 1, null)
  expectOn('chosen ball gone', s, 2, 'B')
}

/* ── 7 · one ball needs no choice ──────────────────────────────────────────
 * Every document written before this feature existed is this case, and it must
 * not have moved by a pixel.
 */
{
  const s = { ...film(2), acts: [act('p1', ['A']), act('p2', ['A'])] }
  s.camera = 'follow'
  for (let i = 0; i < 2; i++) expectOn('lone ball', s, i, 'A')
}

/* ── 8 · a phase pinned off is off, chosen ball or not ─────────────────────── */
{
  const s = film(3, { 0: 'B' })
  s.acts[0] = { ...s.acts[0], camera: 'off' }
  expectOn('phase pinned off', s, 0, null)
  expectOn('phase pinned off', s, 1, 'B')
}

/* ── 9 · a document from the version that stamped the id forwards ──────────
 * It wrote the same id onto every act from the choice to the end of the film.
 * Read backwards, a run of identical ids gives the same answer at every phase
 * in the run, so nothing a coach already saved may move.
 */
{
  const stamped = film(6, { 2: 'C', 3: 'C', 4: 'C', 5: 'C' })
  const modern = film(6, { 2: 'C' })
  for (let i = 0; i < 6; i++) {
    const a = centre(stamped, i)
    const b = centre(modern, i)
    const same = (a === null && b === null) || (a && b && near(a.x, b.x) && near(a.y, b.y))
    if (!same) {
      fail('stamped documents', `p${i + 1} reads ${a ? `(${a.x.toFixed(1)}, ${a.y.toFixed(1)})` : 'wide'} out of a stamped document and ${b ? `(${b.x.toFixed(1)}, ${b.y.toFixed(1)})` : 'wide'} out of a modern one. A run of identical ids must resolve to that id at every phase in the run.`)
    }
  }
}

/* ── 10 · where the live choice was made ───────────────────────────────────
 * The panel says "chosen on phase N", and it reads the same walk the camera
 * does. If these two ever disagree the coach is sent to the wrong phase to fix
 * a camera that is on the wrong ball.
 */
{
  const s = film(6, { 0: 'A', 3: 'B' })
  const want = [0, 0, 0, 3, 3, 3]
  for (let i = 0; i < 6; i++) {
    const c = referenceBallChoice(s.acts, i)
    if (c.at !== want[i]) fail('where it was chosen', `p${i + 1} says the choice was made on p${c.at + 1} — it was made on p${want[i] + 1}.`)
    if (c.id !== referenceBallId(s.acts, i)) fail('where it was chosen', `p${i + 1}: referenceBallId and referenceBallChoice disagree (${referenceBallId(s.acts, i)} vs ${c.id}). They must be one walk.`)
  }
  const none = referenceBallChoice(film(3).acts, 2)
  if (none.at !== -1 || none.id !== null) fail('where it was chosen', `a film with no choice reads { id: ${none.id}, at: ${none.at} } — it must read { id: null, at: -1 }.`)
}

/* ── 11 · deleting the ball takes its choice with it ───────────────────────
 * Cleared to `undefined`, not `null`: the phase stops saying anything, so a
 * choice made earlier still reaches the rest of the film. Cleared ONLY where
 * the ball is actually gone.
 */
{
  const s = film(4, { 1: 'B' })
  const gone = forgetTrackedBall(
    s.acts.map((a, i) => (i === 1 ? { ...a, ...ballFields(ballsOf(a).filter((b) => b.id !== 'B')) } : a)),
    'B',
  )
  if (gone[1].trackingBallId !== undefined) fail('deleting the chosen ball', `p2 still names ball B after it was deleted from p2 (it reads ${JSON.stringify(gone[1].trackingBallId)}) — it must read undefined.`)

  const kept = forgetTrackedBall(s.acts, 'B')
  if (kept[1].trackingBallId !== 'B') fail('deleting the chosen ball', `p2 lost its choice while ball B is still on the phase (it reads ${JSON.stringify(kept[1].trackingBallId)}) — it must still read "B".`)
}

/* ── 12 · a phase that is not in the document reads its own field ──────────
 * Poses are rebuilt rather than passed through, so the lookup is by id. A
 * phase the film has never heard of must not silently inherit phase 1's ball.
 */
{
  const s = film(3, { 0: 'A' })
  const orphan = act('not-in-the-film', BALLS, 'C')
  const got = trackedBall(s, orphan)
  if (got?.id !== 'C') fail('phase outside the document', `an orphan phase naming ball C resolved to ${got ? got.id : 'wide'} — it must read its own field and give C.`)
  const silent = trackedBall(s, act('also-not-in-it', BALLS))
  if (silent !== null) fail('phase outside the document', `an orphan phase naming nothing resolved to ball ${silent.id} — with ${BALLS.length} balls and no choice of its own it must be wide.`)
}

/* ══ THE PUSH ══════════════════════════════════════════════════════════════
 *
 * How hard the camera goes in, and from which phase. Two things are claimed
 * here: that the three settings actually differ on every shape of phase, which
 * they did not before there was a ceiling, and that a setting made part way
 * through a film governs from there on and no earlier.
 */

const crop = cropRect(view)
const metres = (w) => w / U

/** A phase whose marks span `spread` percent of the crop, with no ball. */
const spread = (id, s) =>
  act(id, [], undefined, {
    arrows: [{ id: 'a', from: { x: 50 - s / 2, y: 50 - s / 2 }, to: { x: 50 + s / 2, y: 50 + s / 2 } }],
  })

const filmOf = (acts, push) => ({ id: 'sys', title: 'check', camera: 'follow', push, acts })

/*
 * The braced arrow is not a style slip and neither is the order of these two.
 * Every test below is scoped in a bare `{ … }` block, and this file has no
 * semicolons — so an arrow whose body is a parenthesised object, sitting
 * directly above one of those blocks, reads to the TypeScript parser as an
 * arrow head looking for its `=>`. Ending on a `}` cannot be misread.
 */

/** The frame one phase is shot through, in metres, or null when it stays wide. */
const frameOf = (system, i) => {
  const a = system.acts[i]
  const shot = shotFor(system, a, view)
  if (!shot) return null
  return frameMetres(view, shot, pushAt(system, a))
}

/* ── 13 · every setting says something about every phase ───────────────────
 * The defect that started this: `tightest` is a floor, so on a phase whose
 * subject is already wider than the floor it stopped binding and Standard and
 * Close returned the same frame — or both gave up and went wide.
 */
{
  const shapes = { 'a tracked ball': act('p', BALLS, 'A'), 'marks across half the pitch': spread('p', 50), 'marks corner to corner': spread('p', 84) }
  for (const [name, a] of Object.entries(shapes)) {
    const got = {}
    for (const p of CAMERA_PUSHES) got[p.id] = frameOf(filmOf([a], p.id), 0)
    for (const [x, y] of [['standard', 'close'], ['gentle', 'standard']]) {
      if (got[x] === null && got[y] === null) {
        fail('every setting counts', `on ${name}, ${x} and ${y} both go wide, so neither setting does anything. One of them must produce a frame.`)
      } else if (got[x] !== null && got[y] !== null && Math.abs(got[x] - got[y]) < 3) {
        fail('every setting counts', `on ${name}, ${x} is ${got[x].toFixed(0)}m and ${y} is ${got[y].toFixed(0)}m — ${Math.abs(got[x] - got[y]).toFixed(1)}m apart, which nobody can see. They must differ by at least 3m.`)
      }
    }
  }
}

/* ── 14 · the numbers the settings were chosen for ─────────────────────────
 * Quoted to the coach when the ceiling was agreed, so they are pinned here.
 * A tracked ball is bounded by the FLOOR and must not have moved at all; a
 * spread phase is bounded by the CEILING and is the whole point of the change.
 */
{
  const want = [
    ['a tracked ball', act('p', BALLS, 'A'), { gentle: 89, standard: 75, close: 62 }],
    ['marks corner to corner', spread('p', 84), { gentle: null, standard: 90, close: 70 }],
  ]
  for (const [name, a, table] of want) {
    for (const p of CAMERA_PUSHES) {
      const got = frameOf(filmOf([a], p.id), 0)
      const w = table[p.id]
      if (w === null) {
        if (got !== null) fail('the agreed numbers', `${p.id} on ${name} is ${got.toFixed(0)}m — it must stay wide.`)
      } else if (got === null) {
        fail('the agreed numbers', `${p.id} on ${name} goes wide — it must be about ${w}m across.`)
      } else if (Math.abs(got - w) > 1.5) {
        fail('the agreed numbers', `${p.id} on ${name} is ${got.toFixed(1)}m — it must be ${w}m, within 1.5m.`)
      }
    }
  }
}

/* ── 15 · the frame stays between its two bounds ───────────────────────────
 * On every shape of phase and every setting, including a frame the coach drew
 * by hand, which the bounds govern as well.
 */
{
  const boxes = [null, { x: 50, y: 50, w: 4, h: 4 }, { x: 50, y: 50, w: 96, h: 96 }, { x: 12, y: 88, w: 30, h: 30 }]
  for (const p of CAMERA_PUSHES) {
    for (const box of boxes) {
      if (!box) continue
      const w = cameraRect(view, box, p).w
      if (w < crop.w * p.tightest - 0.01) fail('the frame stays in its bounds', `${p.id} drew a frame ${metres(w).toFixed(1)}m across on a hand box of ${box.w}% — its floor is ${metres(crop.w * p.tightest).toFixed(1)}m.`)
      if (w > crop.w * p.widest + 0.01) fail('the frame stays in its bounds', `${p.id} drew a frame ${metres(w).toFixed(1)}m across on a hand box of ${box.w}% — its ceiling is ${metres(crop.w * p.widest).toFixed(1)}m.`)
    }
    if (!(p.tightest < p.widest)) fail('the frame stays in its bounds', `${p.id} has tightest ${p.tightest} and widest ${p.widest} — the floor must be below the ceiling.`)
  }
  for (let i = 1; i < CAMERA_PUSHES.length; i++) {
    const a = CAMERA_PUSHES[i - 1]
    const b = CAMERA_PUSHES[i]
    if (!(b.tightest < a.tightest && b.widest < a.widest && b.margin <= a.margin)) {
      fail('the frame stays in its bounds', `${b.id} is not tighter than ${a.id} on every column (floors ${a.tightest}/${b.tightest}, ceilings ${a.widest}/${b.widest}, margins ${a.margin}/${b.margin}). The table must run wide to close.`)
    }
  }
}

/* ── 16 · a push set part way through governs from there ───────────────────
 * The headline claim, and the same one the reference ball makes.
 */
{
  const s = filmOf([spread('p1', 60), spread('p2', 60), spread('p3', 60), spread('p4', 60)], 'gentle')
  s.acts[2] = { ...s.acts[2], push: 'close' }
  for (let i = 0; i < 4; i++) {
    const want = i < 2 ? 'gentle' : 'close'
    const got = pushAt(s, s.acts[i]).id
    if (got !== want) fail('set part way through', `p${i + 1} is on ${got} — with close set on p3 it must be ${want}.`)
  }
}

/* ── 17 · a later choice owns the tail, and an earlier edit cannot take it ── */
{
  const acts = [spread('p1', 60), spread('p2', 60), spread('p3', 60), spread('p4', 60), spread('p5', 60)]
  const s = filmOf(acts, 'gentle')
  s.acts[0] = { ...s.acts[0], push: 'standard' }
  s.acts[3] = { ...s.acts[3], push: 'close' }
  const check = (system, want, group) => {
    for (let i = 0; i < want.length; i++) {
      const got = pushAt(system, system.acts[i]).id
      if (got !== want[i]) fail(group, `p${i + 1} is on ${got} — it must be ${want[i]}.`)
    }
  }
  check(s, ['standard', 'standard', 'standard', 'close', 'close'], 'two pushes')
  const edited = { ...s, acts: s.acts.map((a, i) => (i === 0 ? { ...a, push: 'gentle' } : a)) }
  check(edited, ['gentle', 'gentle', 'gentle', 'close', 'close'], 'earlier push edit')
}

/* ── 18 · the three states, and the document underneath them ───────────────
 * `null` is "back to the document's setting, from here" — the way out of a
 * choice without the phase before it putting it straight back.
 */
{
  const s = filmOf([spread('p1', 60), spread('p2', 60), spread('p3', 60), spread('p4', 60)], 'gentle')
  s.acts[0] = { ...s.acts[0], push: 'close' }
  s.acts[2] = { ...s.acts[2], push: null }
  const want = ['close', 'close', 'gentle', 'gentle']
  for (let i = 0; i < 4; i++) {
    const got = pushAt(s, s.acts[i]).id
    if (got !== want[i]) fail('the three states', `p${i + 1} is on ${got} — with close on p1 and null on p3 it must be ${want[i]}.`)
  }
  const c = pushChoice(s.acts, 3)
  if (c.id !== null || c.at !== 2) fail('the three states', `p4 reports its push was decided at { id: ${c.id}, at: ${c.at} } — the live choice is the null on p3, so it must read { id: null, at: 2 }.`)
}

/* ── 19 · a film with no per-phase push is the film it always was ──────────
 * Every document saved before `Act.push` existed, on every setting.
 */
{
  for (const p of CAMERA_PUSHES) {
    const s = filmOf([act('p1', BALLS, 'A'), spread('p2', 60)], p.id)
    for (let i = 0; i < 2; i++) {
      const got = pushAt(s, s.acts[i])
      if (got.id !== p.id) fail('legacy films', `a film set to ${p.id} with nothing on its phases reads ${got.id} at p${i + 1} — it must read the document's setting.`)
      const direct = resolvePush(p.id)
      const a = frameMetres(view, shotFor(s, s.acts[i], view), got)
      const b = frameMetres(view, shotFor(s, s.acts[i], view), direct)
      if (Math.abs(a - b) > 0.001) fail('legacy films', `p${i + 1} on ${p.id} is shot ${a.toFixed(2)}m through the phase's push and ${b.toFixed(2)}m through the document's. They must be the same frame.`)
    }
  }
}

/* ── 20 · the bounds ride on the pose and travel with it ───────────────────
 * `Board` draws through `RenderAct.frame`, so a per-phase push that does not
 * reach the pose is a setting the picture never hears about. Mid-move it must
 * be BETWEEN the two phases' bounds, or the camera jumps on the cut.
 */
{
  const s = filmOf([spread('p1', 60), spread('p2', 60)], 'gentle')
  s.acts[1] = { ...s.acts[1], push: 'close' }
  for (let i = 0; i < 2; i++) {
    const got = resolveAct(s.acts[i], s).frame
    const want = pushAt(s, s.acts[i])
    if (got.tightest !== want.tightest || got.widest !== want.widest) {
      fail('the pose carries the bounds', `p${i + 1} poses with bounds ${got.tightest}/${got.widest} — its push is ${want.id}, which is ${want.tightest}/${want.widest}.`)
    }
  }
  const lo = resolvePush('gentle')
  const hi = resolvePush('close')
  let last = lo.tightest + 1
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const f = tweenActs(s.acts[0], s.acts[1], t, s).frame
    if (f.tightest > lo.tightest + 1e-9 || f.tightest < hi.tightest - 1e-9) {
      fail('the pose carries the bounds', `at t=${t} the blended floor is ${f.tightest} — it must lie between ${hi.tightest} and ${lo.tightest}.`)
    }
    if (f.tightest > last + 1e-9) fail('the pose carries the bounds', `at t=${t} the blended floor rose to ${f.tightest} from ${last} — a move from gentle to close must tighten all the way through.`)
    last = f.tightest
  }
}

if (faults.length === 0) {
  console.log('camera check: 20 claims about the camera — which ball it follows and how hard it pushes in — across choices, edits, deletions, legacy documents, hand-drawn frames and blended poses. All clear.')
  process.exit(0)
}
const groups = [...new Set(faults.map((f) => f.group))]
for (const g of groups) {
  console.log(`\n${g}`)
  for (const f of faults.filter((x) => x.group === g)) console.log(`  · ${f.line}`)
}
console.log(`\n${faults.length} faults.`)
process.exit(1)
