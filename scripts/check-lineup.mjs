/**
 * Every field on a counter is either a person or a pose, and is written as one.
 *
 * ── WHY THIS IS A SCRIPT AND NOT A CODE REVIEW ───────────────────────────────
 *
 * The bug this exists to prevent looks correct on screen. A coach swaps their
 * right back on phase 1, the counter says the new name, the board is right, the
 * film plays. Phase 4 still says the old one, and nobody finds out until it is
 * on a projector in front of a squad. There is no error, no console warning and
 * no failing render: the only symptom is a slide nobody happened to look at.
 *
 * It shipped exactly once, and the shape of it was one function call. `name`,
 * `photo` and `label` were written through `patchToken`, which writes the act
 * the coach is looking at, when they should have gone through the wide write
 * that `bib` had been given by hand a month earlier (user, 2026-08-29). Nothing
 * in the type system tells those two functions apart — they take the same
 * `Partial<Token>` — so this is the tie.
 *
 * ── WHAT IT CHECKS ───────────────────────────────────────────────────────────
 *
 *   1. Every field on `Token` is in exactly one of ROLE / PERSON / PHASE_FIELDS.
 *   2. Nothing is classified that is not a field.
 *   3. `withEdits` carries every person field across a re-place.
 *   4. No `patchToken({...})` call writes a person field.
 *   5. No `patchIdentity({...})` call writes a pose or a role field.
 *   6. `withoutIdentity` clears all three of the account-private fields.
 *   7. What the writes in ../src/studio/lineup.ts actually do to a document.
 *
 * The seventh is the one a coach would recognise. The other six are about the
 * source agreeing with itself; this one builds a five-phase board, swaps a
 * player on it, and asserts that the name reached all five phases and that the
 * positions, the arrows, the bands, the balls, the writing and the gear came
 * out byte-identical. That last half is the promise the whole feature rests on
 * and the half no screenshot can show: a promise about what a function does NOT
 * touch is exactly the sort that rots quietly.
 *
 * ── IT COLLECTS, AND EVERY LINE CARRIES THE FIX ──────────────────────────────
 *
 * One run gives the whole punch list, and no fault says only what is wrong: an
 * unclassified field is told which list to join, a misrouted write is told
 * which function to call instead. Nothing here has to be worked out by hand.
 *
 * Run: node --import ./scripts/lib/ts.mjs scripts/check-lineup.mjs
 */

import { readFileSync } from 'node:fs'
import {
  assignRole,
  clashesOf,
  healRoles,
  isStale,
  patchRoles,
  playerFor,
  refreshRoles,
  rolesOf,
  staleRoles,
} from '../src/studio/lineup.ts'

const SCHEMA = 'src/studio/schema.ts'
const EDITOR = 'src/studio/editor/StudioEditor.tsx'

const schema = readFileSync(SCHEMA, 'utf8')
const editor = readFileSync(EDITOR, 'utf8')

const faults = []
const fail = (group, line) => faults.push({ group, line })

/* ── Reading the source ─────────────────────────────────────────────────────
 *
 * By text, not by importing the module. Two of the six checks are about the
 * SHAPE of a call site rather than about a value, so there is nothing to
 * import for them, and running a TS loader for the other four would make a
 * check whose whole point is to be cheap enough to run on every build into one
 * that needs a build of its own. `check-align.mjs` reads TOKEN_R out of a .tsx
 * the same way and for the same reason.
 */

/** The body of a braced block, given the text that opens it. Balanced, so a */
/** nested object inside a function does not end it early. */
function blockAfter(src, opener, open = '{', close = '}') {
  const at = src.indexOf(opener)
  if (at < 0) return null
  let i = src.indexOf(open, at)
  if (i < 0) return null
  let depth = 0
  for (let j = i; j < src.length; j++) {
    if (src[j] === open) depth++
    else if (src[j] === close) {
      depth--
      if (depth === 0) return src.slice(i + 1, j)
    }
  }
  return null
}

/**
 * The field names declared directly in an interface body.
 *
 * Two-space indent only, so a field of a nested object type is not mistaken for
 * a field of the interface. Doc comments are stripped first, or a `*  label:` in
 * prose would be read as a declaration.
 */
function fieldsOf(body) {
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  return [...clean.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1])
}

/** The string members of `export const NAME = [...] as const`. */
function listOf(name) {
  const m = new RegExp(`export const ${name} = \\[([^\\]]*)\\]`).exec(schema)
  if (!m) {
    fail('setup', `${name} is not exported from ${SCHEMA}. The three lists are what this check checks.`)
    return []
  }
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

const tokenBody = blockAfter(schema, 'export interface Token {')
if (!tokenBody) fail('setup', `The Token interface could not be found in ${SCHEMA}.`)

const fields = tokenBody ? fieldsOf(tokenBody) : []
const ROLE = listOf('ROLE_FIELDS')
const PERSON = listOf('PERSON_FIELDS')
const PHASE = listOf('PHASE_FIELDS')

/* ── 1 & 2. The classification covers the interface, exactly once ───────────*/

const home = new Map()
for (const [list, names] of [
  ['ROLE_FIELDS', ROLE],
  ['PERSON_FIELDS', PERSON],
  ['PHASE_FIELDS', PHASE],
]) {
  for (const f of names) {
    if (home.has(f)) {
      fail(
        'classification',
        `'${f}' is in both ${home.get(f)} and ${list}. A field is one kind of fact or the other; delete it from whichever list it does not belong in.`,
      )
    } else {
      home.set(f, list)
    }
    if (fields.length && !fields.includes(f)) {
      fail(
        'classification',
        `'${f}' is in ${list} but is not a field on Token. Remove it, or add '${f}' to the interface in ${SCHEMA}.`,
      )
    }
  }
}

for (const f of fields) {
  if (home.has(f)) continue
  fail(
    'classification',
    `'${f}' is a field on Token and is in none of the three lists. Add it to PERSON_FIELDS if it says WHO the counter is (it then travels across every act), or to PHASE_FIELDS if it says what they are doing on this beat (it stays on one act). See the block above them in ${SCHEMA}.`,
  )
}

/* ── 3. A re-place carries every person field ───────────────────────────────*/

const withEdits = blockAfter(
  editor,
  'function withEdits(placed: Token[], previous: Token[], keepLabel = true)',
)
if (!withEdits) {
  fail('re-place', `withEdits could not be found in ${EDITOR}.`)
} else {
  for (const f of PERSON) {
    // `label` is carried conditionally, which is still carrying it.
    if (new RegExp(`\\b${f}:`).test(withEdits)) continue
    fail(
      're-place',
      `withEdits does not carry '${f}'. Add "${f}: p.${f}," to it, or changing formation will silently drop it — which is what happened to 'photo'.`,
    )
  }
}

/* ── 4 & 5. Every write goes through the function that matches its field ────*/

/** The top-level keys of the object literal passed as a call's first argument. */
function firstArgKeys(src, fn) {
  const calls = []
  const re = new RegExp(`\\b${fn}\\(`, 'g')
  for (const m of [...src.matchAll(re)]) {
    const open = m.index + m[0].length
    // Only literals. `patchIdentity(fillFrom(player, …))` and
    // `patchIdentity(EMPTY_ROLE, …)` name their fields in ../src/studio/lineup.ts,
    // where the builders are the only writers and all are typed Partial<Token>.
    if (src[open] !== '{') continue
    const body = blockAfter(src.slice(open), '{')
    if (body == null) continue
    const keys = []
    let depth = 0
    for (const part of body.split(',')) {
      // Split on commas at depth zero only: `(v || undefined) as Cue | undefined`
      // holds no comma, but a nested object would.
      if (depth === 0) {
        const k = /^\s*(\w+)\s*:/.exec(part)
        if (k) keys.push(k[1])
      }
      for (const ch of part) {
        if (ch === '{' || ch === '(' || ch === '[') depth++
        if (ch === '}' || ch === ')' || ch === ']') depth--
      }
    }
    calls.push({ line: src.slice(0, m.index).split('\n').length, keys })
  }
  return calls
}

for (const call of firstArgKeys(editor, 'patchToken')) {
  for (const k of call.keys) {
    if (!PERSON.includes(k)) continue
    fail(
      'writes',
      `${EDITOR}:${call.line} writes '${k}' through patchToken, which writes ONE act. '${k}' is in PERSON_FIELDS. Call patchIdentity instead, or a coach retypes it on every phase and forgets one.`,
    )
  }
}

for (const call of firstArgKeys(editor, 'patchIdentity')) {
  for (const k of call.keys) {
    if (PERSON.includes(k)) continue
    const kind = PHASE.includes(k) ? 'PHASE_FIELDS' : ROLE.includes(k) ? 'ROLE_FIELDS' : 'no list'
    fail(
      'writes',
      `${EDITOR}:${call.line} writes '${k}' through patchIdentity, which writes EVERY act. '${k}' is in ${kind}. Call patchToken instead${
        kind === 'ROLE_FIELDS' ? ", or nothing at all — a role field is not edited" : ''
      }.`,
    )
  }
}

/* ── 6. An anonymous board carries none of the private three ───────────────*/

const anon = blockAfter(schema, 'export function withoutIdentity(system: System)')
if (!anon) {
  fail('sharing', `withoutIdentity could not be found in ${SCHEMA}.`)
} else {
  for (const f of ['name', 'photo', 'playerId']) {
    if (new RegExp(`${f}: undefined`).test(anon)) continue
    fail(
      'sharing',
      `withoutIdentity does not clear '${f}'. Add "${f}: undefined" to the token map, or a board shared with identity off still carries it. All three or none.`,
    )
  }
}

/* ── 7. What the writes do to a real document ───────────────────────────────
 *
 * Fixtures built here rather than imported: a check that shares a fixture with
 * the code under test is a check that agrees with a bug. These are hand-written
 * boards with a value in every field the writes must not touch.
 */

/** A counter. Everything a token can carry, so nothing goes unwatched. */
const tok = (id, side, label, x, y, extra = {}) => ({ id, side, label, x, y, ...extra })

/** One act, with something in every optional list. */
const mkAct = (i, tokens) => ({
  id: `a${i}`,
  title: `Phase ${i}`,
  caption: `caption ${i}`,
  notes: `notes ${i}`,
  shot: { x: 10 + i, y: 20 + i, w: 30, h: 40 },
  tokens,
  ball: { x: 50, y: 50 },
  balls: [{ id: 'b1', x: 50 + i, y: 50 - i }],
  arrows: [{ id: `ar${i}`, kind: 'run', from: { x: 1, y: 2 }, to: { x: 3, y: 4 }, fromId: 'us-RB' }],
  bands: [{ id: `bd${i}`, kind: 'zone', rect: { x: 5, y: 6, w: 7, h: 8 } }],
  texts: [{ id: `tx${i}`, x: 9, y: 10, text: `note ${i}` }],
  gear: [{ id: `g${i}`, kind: 'cone', x: 11, y: 12 }],
})

/** Five phases, eleven roles, the right back moving down the pitch. */
const board = () => ({
  v: 1,
  title: 'Pressing trap',
  pitch: 'full',
  teams: { us: { name: 'Us', base: '#08C16A', deep: '#06A659', text: '#FFF' } },
  acts: [1, 2, 3, 4, 5].map((i) =>
    mkAct(i, [
      tok('us-GK', 'us', '1', 5, 50, { name: 'Kovac', playerId: 'p-gk' }),
      tok('us-RB', 'us', '2', 10 + i * 8, 20 + i * 3, { name: 'Owusu', playerId: 'p-rb' }),
      tok('us-CB', 'us', '5', 20, 50),
      tok('them-ST', 'them', '9', 80, 50, { name: 'Vidal' }),
    ]),
  ),
})

/*
 * TWO PLAYERS CALLED OWUSU, AND THE NAMESAKE IS LISTED FIRST.
 *
 * Deliberate, and the ordering is the whole point of it: a name match returns
 * the FIRST row it finds, so if `playerFor` ever stopped preferring the squad
 * link, the right back below would resolve to the wrong Owusu and the assertion
 * would say so. With the rows the other way round both rules give the same
 * answer, and the check passes while the link is being ignored — which is what
 * the first version of this fixture did.
 */
const SQUAD = [
  { id: 'p-gk', name: 'Kovac', number: '1', photoPath: '', sort: 0 },
  { id: 'p-x', name: 'Owusu', number: '14', photoPath: '', sort: 1 },
  { id: 'p-rb', name: 'Owusu', number: '2', photoPath: '', sort: 2 },
  { id: 'p-lb', name: 'Silva', number: '3', photoPath: 'u/players/s.webp', sort: 3 },
]

/** By id, so an assertion names the player it means rather than a list index. */
const P = Object.fromEntries(SQUAD.map((p) => [p.id, p]))

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** Everything in an act that a lineup write must leave exactly as it found it. */
const untouched = (act) => ({
  frame: [act.id, act.title, act.caption, act.notes, act.shot, act.ball, act.balls],
  marks: [act.arrows, act.bands, act.texts, act.gear],
  where: act.tokens.map((t) => [t.id, t.x, t.y, t.side, t.cue, t.dim, t.benched]),
})

/** Assert, into the punch list, with the two values in the line. */
const want = (name, got, expected) => {
  if (eq(got, expected)) return
  fail('behaviour', `${name}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`)
}

{
  const before = board()
  const after = assignRole(before, 'us-RB', P['p-lb']) // Owusu out, Silva in

  // The name reached every phase, which is the whole complaint.
  want(
    'assignRole writes the name on every phase',
    after.acts.map((a) => a.tokens.find((t) => t.id === 'us-RB').name),
    ['Silva', 'Silva', 'Silva', 'Silva', 'Silva'],
  )
  want(
    'assignRole writes the number on every phase',
    after.acts.map((a) => a.tokens.find((t) => t.id === 'us-RB').label),
    ['3', '3', '3', '3', '3'],
  )
  want(
    'assignRole writes the photo and the squad link on every phase',
    after.acts.map((a) => {
      const t = a.tokens.find((x) => x.id === 'us-RB')
      return [t.photo, t.playerId]
    }),
    [1, 2, 3, 4, 5].map(() => ['u/players/s.webp', 'p-lb']),
  )

  // And moved nothing. Every phase, field by field.
  before.acts.forEach((act, i) => {
    want(`assignRole leaves phase ${i + 1} alone`, untouched(after.acts[i]), untouched(act))
  })
  want(
    'assignRole touches nobody else',
    after.acts.flatMap((a) => a.tokens.filter((t) => t.id !== 'us-RB')),
    before.acts.flatMap((a) => a.tokens.filter((t) => t.id !== 'us-RB')),
  )

  // Emptying a role keeps the counter and drops the person.
  const empty = assignRole(before, 'us-RB', null)
  want(
    'clearing a role keeps the counter and drops the person',
    empty.acts.map((a) => {
      const t = a.tokens.find((x) => x.id === 'us-RB')
      return [t.label, t.name, t.photo, t.playerId]
    }),
    [1, 2, 3, 4, 5].map(() => ['2', undefined, undefined, undefined]),
  )
}

{
  // A document written under the old narrow write: phase 3 was missed.
  const bad = board()
  bad.acts[2].tokens.find((t) => t.id === 'us-RB').name = 'Owusu OLD'
  const roles = rolesOf(bad)
  const rb = roles.find((r) => r.id === 'us-RB')

  want('a phase that disagrees is reported', rb.split, true)
  want('a phase that agrees is not reported', rolesOf(board()).some((r) => r.split), false)

  const healed = healRoles(bad, [rb])
  want('healing makes every phase agree', rolesOf(healed).some((r) => r.split), false)
  want(
    'healing takes the first phase as the authority',
    healed.acts.map((a) => a.tokens.find((t) => t.id === 'us-RB').name),
    ['Owusu', 'Owusu', 'Owusu', 'Owusu', 'Owusu'],
  )
  bad.acts.forEach((act, i) => {
    want(`healing leaves phase ${i + 1} alone`, untouched(healed.acts[i]), untouched(act))
  })
}

{
  const roles = rolesOf(board())
  want('roles are found once each, not once per phase', roles.length, 4)
  want('a role on every phase says so', roles.find((r) => r.id === 'us-GK').phases, [1, 2, 3, 4, 5])
  want('us comes before them', roles.map((r) => r.side), ['us', 'us', 'us', 'them'])

  // A twelfth man on one phase only.
  const one = board()
  one.acts[2].tokens.push(tok('us-X1', 'us', '12', 60, 60))
  want('a role on one phase only says which', rolesOf(one).find((r) => r.id === 'us-X1').phases, [3])
}

{
  const roles = rolesOf(board())
  // The squad holds two players called Owusu and the namesake is listed first,
  // so this is only 'p-rb' if the link beat the name. See the fixture above.
  want('a role resolves by its squad link, not by its name', playerFor(roles[1], SQUAD).id, 'p-rb')
  want('an unnamed role resolves to nobody', playerFor(roles[2], SQUAD), null)
  // Two players share the name Owusu. The opposition striker has no link and no
  // matching name, so it must resolve to nothing rather than to the wrong row.
  want('a name that matches nothing resolves to nobody', playerFor(roles[3], SQUAD), null)
  want(
    'a legacy role with no link falls back to the name',
    playerFor({ name: 'Silva' }, SQUAD).id,
    'p-lb',
  )
  want(
    'a dead link with a name nobody has resolves to nobody',
    playerFor({ playerId: 'gone', name: 'Nobody Here' }, SQUAD),
    null,
  )
  // A deleted-and-re-added player. The fallback is the best guess left, and it
  // is documented behaviour rather than an accident. See playerFor.
  want('a dead link falls back to the name', playerFor({ playerId: 'gone', name: 'Silva' }, SQUAD).id, 'p-lb')
}

{
  // The same player on two roles.
  const dup = assignRole(board(), 'us-CB', P['p-rb']) // Owusu at CB as well as RB
  const clashes = clashesOf(rolesOf(dup), SQUAD)
  want('the same player on two roles is flagged on both', [...clashes.keys()].sort(), ['us-CB', 'us-RB'])
  want('nothing is flagged on a clean board', clashesOf(rolesOf(board()), SQUAD).size, 0)
}

{
  const roles = rolesOf(board())
  const rb = roles.find((r) => r.id === 'us-RB')
  want('a role matching its squad row is not stale', isStale(rb, P['p-rb']), false)
  want('a renamed squad row is stale', isStale(rb, { ...P['p-rb'], name: 'Owusu Jr' }), true)
  want('a new photo is stale', isStale(rb, { ...P['p-rb'], photoPath: 'u/players/o.webp' }), true)
  // The counter is deliberately not compared. See isStale in lineup.ts.
  want('a relabelled counter is NOT stale', isStale(rb, { ...P['p-rb'], number: '77' }), false)

  // A typed name that happens to match a squad row is not offered a refresh.
  const typedOnly = board()
  for (const a of typedOnly.acts) {
    const t = a.tokens.find((x) => x.id === 'us-RB')
    t.playerId = undefined
  }
  want('a typed name is never reported as drifted', staleRoles(rolesOf(typedOnly), SQUAD).length, 0)

  const renamed = [{ ...P['p-rb'], name: 'Owusu Jr' }, ...SQUAD.filter((p) => p.id !== 'p-rb')]
  const drifted = staleRoles(rolesOf(board()), renamed)
  want('a drifted role is found', drifted.map((r) => r.id), ['us-RB'])

  const fixed = refreshRoles(board(), drifted, renamed)
  want(
    'refreshing takes the new name on every phase',
    fixed.acts.map((a) => a.tokens.find((t) => t.id === 'us-RB').name),
    ['Owusu Jr', 'Owusu Jr', 'Owusu Jr', 'Owusu Jr', 'Owusu Jr'],
  )
  want(
    'refreshing leaves the counter the coach set',
    fixed.acts.map((a) => a.tokens.find((t) => t.id === 'us-RB').label),
    ['2', '2', '2', '2', '2'],
  )
}

{
  const b = board()
  want('an empty patch returns the same document', patchRoles(b, new Map()) === b, true)
  want(
    'a patch for a role nobody holds changes nothing',
    eq(patchRoles(b, new Map([['nobody', { name: 'X' }]])), b),
    true,
  )
}

/* ── The punch list ────────────────────────────────────────────────────────*/

if (faults.length === 0) {
  console.log(
    `\nEvery one of ${fields.length} Token fields is classified: ${ROLE.length} role, ${PERSON.length} person, ${PHASE.length} pose.`,
  )
  console.log(
    'Writes route correctly, and on a five-phase board a swap reaches all five phases and moves nothing.',
  )
  process.exit(0)
}

for (const g of [...new Set(faults.map((f) => f.group))]) {
  console.log(`\n${g}`)
  for (const f of faults.filter((x) => x.group === g)) console.log(`  · ${f.line}`)
}
console.log(`\n${faults.length} faults.`)
process.exit(1)
