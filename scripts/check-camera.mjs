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

import { referenceBallChoice, referenceBallId, trackedBall, shotFor } from '../src/studio/camera.ts'
import { ballsOf, ballFields, forgetTrackedBall } from '../src/studio/schema.ts'
import { viewFor } from '../src/studio/board/pitch.ts'

const faults = []
const fail = (group, line) => faults.push({ group, line })

/* ── the smallest document that has a camera and some balls on it ─────────── */

const BALLS = ['A', 'B', 'C']

/** One phase, carrying the named balls, spread across the middle of the board. */
const act = (id, balls, trackingBallId) => ({
  id,
  title: id,
  caption: '',
  tokens: [],
  arrows: [],
  bands: [],
  ...ballFields(balls.map((b, i) => ({ id: b, x: 30 + i * 15, y: 40 + i * 8 }))),
  ...(trackingBallId === undefined ? {} : { trackingBallId }),
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

if (faults.length === 0) {
  console.log('camera check: 12 claims about the reference ball, across choices, edits, deletions, legacy documents and orphan phases. All clear.')
  process.exit(0)
}
const groups = [...new Set(faults.map((f) => f.group))]
for (const g of groups) {
  console.log(`\n${g}`)
  for (const f of faults.filter((x) => x.group === g)) console.log(`  · ${f.line}`)
}
console.log(`\n${faults.length} faults.`)
process.exit(1)
