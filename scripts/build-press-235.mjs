/**
 * Build "How To Press The 2-3-5" as a studio document.
 *
 *   node scripts/build-press-235.mjs
 *     -> content/systems/how-to-press-the-2-3-5.json
 *        films/how-to-press-the-2-3-5.claims.json
 *
 * WHY THIS IS A SCRIPT AND NOT A JSON FILE
 *
 * films/README.md §9 says not to hand-write film documents, and it is right:
 * a 50-phase system is ~90KB of JSON and nobody can eyeball it for damage.
 * But a film is not arbitrary JSON either. It is one starting shape and then
 * fifty small deltas on it, and that IS writable — as long as the deltas are
 * the source and the coordinates are derived.
 *
 * So this file holds the shape once (START) and every act says only what
 * moved. Nothing is repeated, so nothing can drift: if a man is not mentioned
 * in an act he is exactly where the previous act left him, which is also what
 * the tween assumes.
 *
 * Every number that ends up WRITTEN ON THE GRASS is computed here from the
 * positions in that act and recorded in the claims file, so it cannot be an
 * invented number. scripts/check-film.mjs recomputes all of them off the
 * finished document. See CLAUDE.md: "never compute an eased position by hand".
 *
 * The user opens the result in the studio and drags it into truth. This is a
 * strong first pose, not a finished film.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** The board is 105m by 68m, so a unit of x is not a unit of y. */
const MX = 105 / 100
const MY = 68 / 100
const THEIR_GOAL = { x: 100, y: 50 }

const metres = (a, b) => Math.hypot((a.x - b.x) * MX, (a.y - b.y) * MY)

/**
 * The kick-off shape.
 *
 * We defend 4-4-2 and press high; they build 2-3-5 — the exact document from
 * the last film, seen from the other side. x runs 0 (our goal) to 100 (theirs),
 * so their build-up sits at x 76-95 and our back four holds a line at 55, which
 * is why their five forwards are stood in their own half doing nothing.
 */
const START = {
  'us-GK': { label: '1', side: 'us', x: 38, y: 50 },
  'us-LB': { label: '3', side: 'us', x: 55, y: 18 },
  'us-LCB': { label: '4', side: 'us', x: 55, y: 40 },
  'us-RCB': { label: '5', side: 'us', x: 55, y: 60 },
  'us-RB': { label: '2', side: 'us', x: 55, y: 82 },
  'us-LM': { label: '11', side: 'us', x: 70, y: 14 },
  'us-LCM': { label: '8', side: 'us', x: 70, y: 40 },
  'us-RCM': { label: '6', side: 'us', x: 70, y: 60 },
  'us-RM': { label: '7', side: 'us', x: 70, y: 86 },
  'us-ST': { label: '9', side: 'us', x: 84, y: 38 },
  'us-CF': { label: '10', side: 'us', x: 84, y: 62 },

  'them-GK': { label: '1', side: 'them', x: 95, y: 50 },
  'them-LCB': { label: '4', side: 'them', x: 88, y: 32 },
  'them-RCB': { label: '5', side: 'them', x: 88, y: 68 },
  'them-LB': { label: '3', side: 'them', x: 76, y: 26 },
  'them-CDM': { label: '6', side: 'them', x: 76, y: 50 },
  'them-RB': { label: '2', side: 'them', x: 76, y: 74 },
  'them-LW': { label: '11', side: 'them', x: 58, y: 7 },
  'them-LCM': { label: '8', side: 'them', x: 58, y: 30 },
  'them-ST': { label: '9', side: 'them', x: 58, y: 50 },
  'them-RCM': { label: '10', side: 'them', x: 58, y: 70 },
  'them-RW': { label: '7', side: 'them', x: 58, y: 93 },
}

const THEM_BUILD = ['them-GK', 'them-LCB', 'them-RCB']
const THEM_MID = ['them-LB', 'them-CDM', 'them-RB']
const THEM_FRONT = ['them-LW', 'them-LCM', 'them-ST', 'them-RCM', 'them-RW']
const US_BACK = ['us-LB', 'us-LCB', 'us-RCB', 'us-RB']
const US_MID = ['us-LM', 'us-LCM', 'us-RCM', 'us-RM']
const US_FRONT = ['us-ST', 'us-CF']

/** The proven band config from the 2-3-5 document: a thin closed string. */
const line = (id, through, extra = {}) => ({
  id,
  kind: 'block',
  fill: 'line',
  edge: 'none',
  close: 'shape',
  drawn: true,
  corner: 'tight',
  string: 'thin',
  strength: 'soft',
  throughTokens: through,
  ...extra,
})

const BANDS = {
  them: [
    line('bd-them-2', ['them-LCB', 'them-RCB']),
    line('bd-them-3', THEM_MID, { strength: undefined }),
    line('bd-them-5', THEM_FRONT),
  ],
  us: [
    line('bd-us-4', US_BACK),
    line('bd-us-mid', US_MID, { strength: undefined }),
    line('bd-us-2', US_FRONT),
  ],
  screen: [line('bd-screen', ['us-ST', 'us-CF', 'them-CDM'], { kind: 'zone' })],
  offside: [line('bd-line', US_BACK)],
}
const bandSet = (...names) => names.flatMap((n) => BANDS[n] ?? [])

// ---------------------------------------------------------------------------

let cur = structuredClone(START)
let ball = null
const acts = []
const claims = []
let arrowSeq = 0
let cues = {}

const at = (ref) => (typeof ref === 'string' ? (ref === 'ball' ? ball : cur[ref]) : ref)

/** A distance written on the grass. Computed, recorded, re-checked later. */
function metreText(a, b, phrase, place, tone = 'gold') {
  const d = metres(at(a), at(b))
  const n = Math.round(d)
  claims.push({
    act: acts.length + 1,
    kind: 'distance',
    a: typeof a === 'string' ? a : { ...a },
    b: typeof b === 'string' ? b : { ...b },
    metres: Number(d.toFixed(2)),
    text: phrase(n),
  })
  return { ...place, text: phrase(n), size: 'm', tone, look: 'halo' }
}

/** A count written on the grass, re-derived from the act's own tokens. */
function countText(text, where, place, tone = 'red', size = 'l', themFirst = false) {
  claims.push({ act: acts.length + 1, kind: 'count', text, where, themFirst })
  return { ...place, text, size, tone, look: 'halo' }
}

const arrow = (kind, from, to, extra = {}) => {
  const a = at(from)
  const b = at(to)
  const out = {
    id: `ar-${String(++arrowSeq).padStart(2, '0')}`,
    kind,
    from: { x: a.x, y: a.y },
    to: { x: b.x, y: b.y },
    ...extra,
  }
  if (typeof from === 'string' && from !== 'ball') out.fromId = from
  if (typeof to === 'string' && to !== 'ball') out.toId = to
  return out
}

/**
 * One phase.
 *
 * `move` is the whole delta. `only` dims everyone not named. Cues and dim are
 * cleared every act on purpose — a cue that outlives the moment it explains is
 * worse than no cue, and forgetting to clear one is the easiest mistake here.
 */
function A({ title = '', caption = '', notes = '', move = {}, cue = {}, only = null, dim = [], ball: b, bands = [], arrows = [], texts = [], camera } = {}) {
  for (const [id, xy] of Object.entries(move)) {
    if (!cur[id]) throw new Error(`act ${acts.length + 1}: no such token ${id}`)
    cur[id] = { ...cur[id], x: xy[0], y: xy[1] }
  }
  if (b !== undefined) ball = b === null ? null : { x: b[0], y: b[1] }
  // A cue sticks until it is cleared with null. A man who is still stood on an
  // opponent is still pressing him, and the cue is also what DECLARES that pair
  // as a duel to check-film.mjs — dropping it silently turns the pose into a
  // separation fault a phase later.
  for (const [id, v] of Object.entries(cue)) {
    if (v === null || v === undefined) delete cues[id]
    else cues[id] = v
  }
  if (typeof texts === 'function') texts = texts()
  if (typeof arrows === 'function') arrows = arrows()

  const hidden = only ? Object.keys(cur).filter((id) => !only.includes(id)) : dim
  const tokens = Object.entries(cur).map(([id, t]) => {
    const tok = { id, x: t.x, y: t.y, label: t.label, side: t.side }
    if (cues[id]) tok.cue = cues[id]
    if (hidden.includes(id)) tok.dim = true
    return tok
  })

  const act = {
    id: `a${String(acts.length + 1).padStart(2, '0')}`,
    title,
    caption,
    notes,
    tokens: b === null && acts.length === 0 ? [] : tokens,
    ball: ball ? { x: ball.x, y: ball.y } : null,
    balls: ball ? [{ id: 'ball', x: ball.x, y: ball.y }] : [],
    arrows,
    bands,
  }
  if (texts.length) act.texts = texts.map((t, i) => ({ id: `tx-${act.id}-${i}`, ...t }))
  if (camera) act.camera = camera
  acts.push(act)
}

const reset = (over = {}) => {
  cur = structuredClone(START)
  cues = {}
  for (const [id, xy] of Object.entries(over)) cur[id] = { ...cur[id], x: xy[0], y: xy[1] }
}

// ===========================================================================
// 1 · The card
// ===========================================================================

A({
  title: 'How To Press The 2-3-5',
  ball: null,
  camera: 'off',
  notes: 'Empty board, title only. The sequel to The 2-3-5 Build-Up, from the other side of the ball.',
})

// ===========================================================================
// 2 · The shape you have to press
// ===========================================================================

A({
  title: 'The Shape You Have To Press',
  ball: [95, 50],
  bands: bandSet('them'),
  notes: 'They build in the 2-3-5 from the last film. We defend 4-4-2 and we are going to press it. Goal kick.',
})

A({
  caption: 'THREE ON THE BALL',
  only: THEM_BUILD,
  bands: bandSet('them'),
  notes: 'Two centre-backs and a keeper. The keeper is a builder, not a spectator, which is why a front two is already outnumbered before anybody moves.',
})

A({
  caption: 'THREE IN THE MIDDLE',
  only: THEM_MID,
  bands: bandSet('them'),
  notes: 'Both full backs inside plus the six. This is the band that turns their build into an attack.',
})

A({
  caption: 'FIVE ACROSS THE TOP',
  only: THEM_FRONT,
  bands: bandSet('them'),
  notes: 'One man in every lane, and all five are stood on our last line doing nothing until the ball arrives. Note where they are: their own half.',
})

A({
  caption: 'THREE. THREE. FIVE.',
  bands: bandSet('them', 'us'),
  notes: 'All eleven, in three layers, against our four-four-two.',
})

A({
  caption: 'OUR TWO AGAINST THEIR THREE',
  only: [...US_FRONT, ...THEM_BUILD],
  bands: bandSet('us'),
  texts: () => [countText('2 v 3', { x: ['>', 78] }, { x: 91, y: 16 })],
  notes: 'Send the front two at the build and they are a man short on the first pass, every time.',
})

A({
  caption: 'OUR FOUR AGAINST THEIR FIVE',
  only: [...US_BACK, ...THEM_FRONT],
  bands: bandSet('us'),
  texts: () => [countText('4 v 5', { x: ['<', 62], outfield: true }, { x: 46, y: 50 })],
  notes: 'And add a man at the top and you are a man short at the bottom instead. There is no arrangement of ten outfielders that is even at both ends of this.',
})

A({
  caption: 'YOU CANNOT BE EVEN EVERYWHERE',
  bands: bandSet('them', 'us'),
  texts: () => [
    countText('2 v 3', { x: ['>', 78] }, { x: 91, y: 16 }),
    countText('4 v 5', { x: ['<', 62], outfield: true }, { x: 46, y: 50 }),
  ],
  notes: 'The premise of the whole film. You do not solve a 2-3-5 by finding a shape that matches it. You choose where to be short, and you make that place useless to them.',
})

// ===========================================================================
// 3 · Why chasing fails
// ===========================================================================

A({
  title: 'Why Chasing Fails',
  ball: [88, 32],
  move: { 'us-ST': [85, 36] },
  cue: { 'us-ST': 'PRESS' },
  bands: bandSet('them'),
  arrows: () => [arrow('press', [84, 38], 'them-LCB', { toId: 'them-LCB' })],
  notes: 'The obvious answer first. Keeper to centre-back, and our nine goes.',
})

A({
  move: { 'us-ST': [86, 34], 'us-CF': [84, 54] },
  cue: { 'us-ST': 'PRESS' },
  ball: [95, 50],
  bands: bandSet('them'),
  notes: 'He arrives, and the centre-back simply gives it back to the keeper. Our nine has run twelve metres to make one pass go backwards.',
})

A({
  ball: [88, 68],
  move: { 'us-CF': [85, 64], 'us-ST': [91, 44] },
  cue: { 'us-CF': 'PRESS' },
  bands: bandSet('them'),
  notes: 'Keeper to the other centre-back. Now the ten goes, and the nine is on the wrong side of the pitch with nothing to press.',
})

A({
  caption: 'PRESS TWO, LOSE THE THIRD',
  cue: { 'us-CF': 'PRESS' },
  bands: bandSet('them'),
  texts: () => [metreText('us-ST', 'ball', (n) => `${n} M FROM THE BALL`, { x: 91, y: 22 }, 'red')],
  notes: 'Two men cannot cover three passers. The third one always has a free touch, and the free touch is always the one that matters.',
})

A({
  ball: [76, 50],
  caption: 'AND THE PIVOT IS FREE',
  bands: bandSet('them'),
  notes: 'Worse than free: he receives facing our goal with our whole midfield in front of him.',
})

A({
  caption: 'SO SOMEBODY JUMPS',
  move: { 'us-LCM': [73, 48] },
  cue: { 'us-LCM': 'PRESS' },
  bands: bandSet('them'),
  arrows: () => [arrow('run', 'them-LCM', [64, 34])],
  notes: 'Our eight goes to the six, because somebody has to. Watch their eight start moving before the ball does.',
})

A({
  caption: 'AND THAT IS THE HOLE',
  move: { 'them-LCM': [64, 34] },
  ball: [64, 34],
  bands: bandSet('them'),
  notes: 'The pass goes into exactly the ground our eight has just left. This is not bad pressing. This is what pressing man-for-man against a spare man looks like every time.',
})

A({
  move: { 'them-LCM': [52, 32], 'us-LCB': [53, 36], 'us-LB': [50, 20], 'us-RCB': [52, 56], 'us-RB': [52, 78] },
  cue: { 'us-LCB': 'JOCKEY' },
  ball: [52, 32],
  bands: bandSet('them'),
  arrows: () => [arrow('run', 'them-LW', [44, 12])],
  notes: 'He carries. Our four is now a back four defending a five with no midfield in front of it, and their eleven is already running.',
})

A({
  ball: [44, 12],
  move: { 'them-LW': [44, 12] },
  bands: bandSet('them'),
  notes: 'Round the outside of our three.',
})

A({
  caption: 'GOAL',
  ball: [0.5, 47],
  move: { 'them-ST': [14, 46], 'us-GK': [10, 50], 'them-LCM': [26, 40], 'us-LCB': [16, 42], 'us-RCB': [18, 56] },
  bands: [],
  notes: 'Six passes from their own goal kick. Every one of our men did the honest thing and the shape still lost.',
})

A({
  caption: 'THIS IS WHAT CHASING COSTS',
  ball: null,
  only: [...US_FRONT, 'us-LCM'],
  bands: [],
  notes: 'The three men who jumped. None of them was wrong on his own. Together they were a hole.',
})

// ===========================================================================
// 4 · Stand still and screen
// ===========================================================================

reset()
A({
  title: 'Stand Still And Screen',
  ball: [95, 50],
  bands: bandSet('us'),
  notes: 'Same goal kick. This time nobody runs at anybody.',
})

A({
  move: { 'us-ST': [84, 44], 'us-CF': [84, 56] },
  bands: bandSet('us'),
  notes: 'The only instruction the front two get: come together.',
})

A({
  caption: 'EIGHT METRES APART',
  bands: bandSet('us'),
  texts: () => [metreText('us-ST', 'us-CF', (n) => `${n} M APART`, { x: 84, y: 14 })],
  notes: 'Narrower than the two centre-backs are, which is the whole trick: from there each of them covers an inside pass without leaving his own.',
})

A({
  caption: 'NOT TO WIN THE BALL',
  bands: [...bandSet('us'), ...bandSet('screen')],
  notes: 'They are not pressing. They are standing in the two passes that make the 2-3-5 work.',
})

A({
  caption: 'TO DELETE TWO PASSES',
  bands: [...bandSet('us'), ...bandSet('screen')],
  arrows: () => [
    arrow('pass', 'them-LCB', 'them-RCB', { label: 'SHUT', bend: -0.8, opacity: 0.5 }),
    arrow('pass', 'them-LCB', 'them-CDM', { label: 'SHUT', opacity: 0.5 }),
  ],
  notes: 'Centre-back to centre-back, and centre-back to the pivot. Kill those two and the 2-3-5 cannot turn: everything they have left goes sideways or backwards.',
})

A({
  caption: 'ONE DOOR LEFT OPEN',
  bands: [...bandSet('us'), ...bandSet('screen')],
  arrows: () => [arrow('pass', 'them-LCB', 'them-LB', { label: 'OPEN' })],
  notes: 'The full back inside. It is open because we left it open, and we left it open because it is the one we have rehearsed.',
})

// ===========================================================================
// 5 · The door you left open
// ===========================================================================

A({
  title: 'The Door You Left Open',
  ball: [88, 32],
  move: { 'us-ST': [84, 40], 'us-CF': [84, 52] },
  cue: { 'us-ST': 'JOCKEY' },
  bands: [...bandSet('us'), ...bandSet('screen')],
  notes: 'Keeper to centre-back. The pair shifts four metres and keeps the screen. They do not go.',
})

A({
  ball: [76, 26],
  bands: bandSet('us'),
  notes: 'And there it is. The pass we allowed.',
})

A({
  caption: 'EVERY MAN MOVES ON THE PASS',
  move: {
    'us-LM': [74, 20],
    'us-LCM': [72, 34],
    'us-RCM': [68, 48],
    'us-RM': [66, 70],
    'us-ST': [81, 32],
    'us-CF': [82, 46],
    'us-LB': [53, 22],
    'us-LCB': [51, 36],
    'us-RCB': [50, 54],
    'us-RB': [49, 72],
  },
  cue: { 'us-LM': 'PRESS', 'us-LCM': 'PRESS', 'us-RCM': 'COVER', 'us-RM': 'BALANCE', 'us-ST': 'COVER', 'us-CF': 'COVER', 'us-RB': 'SPARE' },
  bands: bandSet('us'),
  arrows: () => [arrow('press', [70, 14], 'them-LB')],
  notes: 'Eleven men move on one pass. The eleven presses from outside so the touchline is behind the receiver, the eight comes from inside, the nine and ten turn round to kill the way back, the far winger tucks into the last lane and the far full back is spare. Nobody is improvising: this is the rehearsed one.',
})

A({
  caption: 'HE HAS ONE TOUCH AND NO PASS',
  cue: { 'us-LM': 'PRESS', 'us-LCM': 'PRESS', 'us-ST': 'COVER', 'us-CF': 'COVER', 'us-RB': 'SPARE' },
  bands: bandSet('us'),
  arrows: () => [arrow('line', 'us-ST', 'them-LCB', { opacity: 0.45 }), arrow('line', 'us-CF', 'them-CDM', { opacity: 0.45 })],
  notes: 'Back to the centre-back is covered by the nine. The pivot is covered by the ten. Forward is a winger on the touchline with our full back already leaving.',
})

A({
  move: { 'us-LB': [59, 13] },
  cue: { 'us-LB': 'PRESS', 'us-LCM': 'PRESS' },
  ball: [70, 20],
  bands: bandSet('us'),
  arrows: () => [arrow('press', [53, 22], 'them-LW')],
  notes: 'He tries the winger anyway. Our three has already gone, because he does not wait for the pass either.',
})

A({
  caption: 'BALL WON',
  move: { 'us-LCM': [74, 30] },
  ball: [74, 30],
  bands: bandSet('us'),
  texts: () => [metreText('us-LCM', THEIR_GOAL, (n) => `${n} M FROM GOAL`, { x: 74, y: 14 })],
  notes: 'Won by the man who came from inside, in the half of the pitch they were building in. This is the number the whole system exists to produce.',
})

A({
  move: { 'us-LCM': [78, 34], 'us-ST': [88, 40], 'us-CF': [87, 58], 'them-LCB': [83, 36], 'them-RCB': [84, 58], 'them-GK': [92, 50] },
  ball: [78, 34],
  bands: [],
  arrows: () => [arrow('run', [81, 32], [89, 42]), arrow('run', [82, 46], [88, 60])],
  notes: 'Their centre-backs are turned and running. Their five forwards are forty metres away and none of them can help.',
})

A({
  ball: [89, 42],
  move: { 'us-ST': [89, 42] },
  bands: [],
  arrows: () => [arrow('pass', [78, 34], [89, 42])],
  notes: 'Into the space their own build-up shape left behind it.',
})

A({
  caption: 'GOAL',
  ball: [100.7, 54],
  move: { 'them-GK': [91, 46] },
  bands: [],
  arrows: () => [arrow('pass', [89, 42], [100.7, 54])],
  notes: 'Three passes from a ball we chose to concede.',
})

A({
  caption: 'WE NEVER PRESSED THE BALL. WE PRESSED THE OPTIONS.',
  ball: null,
  only: [...US_FRONT, 'us-LM', 'us-LCM'],
  bands: [],
  notes: 'The sentence to keep. The front two never once ran at a centre-back.',
})

// ===========================================================================
// 6 · If they do not take it
// ===========================================================================

reset({ 'us-ST': [84, 44], 'us-CF': [84, 56] })
A({
  title: 'If They Do Not Take It',
  ball: [88, 32],
  bands: [...bandSet('us'), ...bandSet('screen')],
  notes: 'Back to the screen. Three things a good team does instead of walking through the door, and the answer to each.',
})

A({
  caption: 'IF THEY GO BACK, WE GO WITH THEM',
  ball: [95, 50],
  move: {
    'us-ST': [91, 44], 'us-CF': [91, 56],
    'us-LM': [77, 14], 'us-LCM': [77, 40], 'us-RCM': [77, 60], 'us-RM': [77, 86],
    'us-LB': [62, 18], 'us-LCB': [62, 40], 'us-RCB': [62, 60], 'us-RB': [62, 82],
    'us-GK': [45, 50],
  },
  bands: [...bandSet('us'), ...bandSet('screen')],
  notes: 'The pass backwards is the only free metre they get, and we take it back the moment it is played. Whole team up seven metres, screen intact, keeper up to forty-five.',
})

A({
  caption: 'SO THEY GO LONG',
  ball: [54, 62],
  move: { 'us-RCB': [56, 62] },
  cue: { 'us-RCB': 'BALANCE' },
  bands: bandSet('us'),
  arrows: () => [arrow('pass', [95, 50], [54, 62])],
  texts: () => [metreText('them-CDM', 'ball', (n) => `THEIR PIVOT IS ${n} M AWAY`, { x: 68, y: 88 })],
  notes: 'Which is what we wanted. A long ball is a fifty-fifty, and a fifty-fifty with their pivot that far from the second ball is not fifty-fifty.',
})

A({
  caption: 'LONG IS OUR BALL',
  ball: null,
  only: [...US_BACK, 'us-RCM', ...THEM_FRONT],
  bands: bandSet('us'),
  notes: 'Their five are pinned in their own half by our line. They cannot both stand there and win a header at our end.',
})

reset({ 'us-ST': [84, 44], 'us-CF': [84, 56] })
A({
  caption: 'SO HE DROPS BETWEEN THEM',
  title: '',
  ball: [95, 50],
  move: { 'them-CDM': [88, 50], 'them-LCB': [85, 20], 'them-RCB': [85, 80] },
  bands: [...bandSet('us'), ...bandSet('screen')],
  notes: 'The second answer, and the best one: the six drops in and makes three at the back, so our two are now outnumbered three to two on the first line.',
})

A({
  caption: 'NOW WE HAVE THE SPARE MAN',
  move: { 'us-ST': [83, 28], 'us-CF': [83, 72], 'us-LCM': [78, 46] },
  cue: { 'us-ST': 'PRESS', 'us-CF': 'PRESS', 'us-LCM': 'PRESS', 'us-RCM': 'SPARE' },
  bands: bandSet('us'),
  texts: () => [countText('4 v 2', { x: ['between', 60, 82] }, { x: 66, y: 50 }, 'gold')],
  notes: 'He solved our problem for us. He was the third man in the middle band; now he is the third man at the back, and their middle band is two against our four. Our eight goes to him, our two press the outside pair, and we have the spare man for the first time in the film.',
})

reset({ 'us-ST': [84, 44], 'us-CF': [84, 56] })
A({
  caption: 'AND WHEN THE PASS DOES GO THROUGH',
  ball: [88, 32],
  bands: bandSet('us'),
  arrows: () => [arrow('pass', 'them-LCB', [64, 34])],
  notes: 'The third answer: they find the man between our lines anyway. Every press concedes this one sometimes. The screen kills the pass to the pivot, not the pass past him.',
})

A({
  move: { 'them-LCM': [64, 34] },
  ball: [64, 34],
  bands: bandSet('us'),
  notes: 'Received between our lines, facing our goal, with fifteen metres of grass in front of him. This is the phase that decides whether the system holds.',
})

A({
  caption: 'DO NOT STEP OUT',
  move: { 'us-LCB': [62, 36] },
  cue: { 'us-LCB': 'PRESS' },
  bands: bandSet('us'),
  arrows: () => [arrow('run', 'them-ST', [50, 44])],
  texts: () => [{ x: 52, y: 40, text: 'THE HOLE', size: 'm', tone: 'red', look: 'halo' }],
  notes: 'The instinct is to follow him. The instinct is wrong: their nine is running into the ground our four just vacated, and now the back four is a back three with a striker inside it.',
})

A({
  caption: 'DROP. LET THE MIDFIELD COME BACK ON HIM.',
  move: { 'us-LCB': [55, 40], 'us-LCM': [67, 32], 'us-RCM': [67, 44], 'them-ST': [58, 50] },
  cue: { 'us-LCB': 'DROP', 'us-LCM': 'PRESS', 'us-RCM': 'COVER' },
  bands: bandSet('us'),
  arrows: () => [arrow('press', [70, 40], [66, 36])],
  notes: 'The line holds and the two midfielders come back onto him from behind. He has the ball facing his own goal with two men arriving and nothing in front of him. That is not a broken press, that is a delayed one.',
})

// ===========================================================================
// 7 · Rest defence
// ===========================================================================

reset({
  'us-LM': [74, 20], 'us-LCM': [72, 34], 'us-RCM': [68, 48], 'us-RM': [66, 70],
  'us-ST': [81, 32], 'us-CF': [82, 46],
  'us-LB': [53, 22], 'us-LCB': [51, 36], 'us-RCB': [50, 54], 'us-RB': [49, 72],
})
A({
  title: 'Rest Defence',
  ball: [76, 26],
  only: [...US_BACK, ...THEM_FRONT],
  bands: bandSet('us'),
  texts: () => [countText('4 v 5', { x: ['<', 62], outfield: true }, { x: 46, y: 50 })],
  notes: 'The half of the idea nobody films. While six of us press, four of us are alone with five of them, and that is true of every high press ever coached.',
})

A({
  caption: 'THE FAR WINGER IS THE FIFTH DEFENDER',
  only: [...US_BACK, 'us-RM', ...THEM_FRONT],
  move: { 'us-RM': [60, 72] },
  cue: { 'us-RM': 'BALANCE' },
  bands: bandSet('us'),
  texts: () => [countText('5 v 5', { x: ['<', 62], outfield: true }, { x: 46, y: 50 }, 'gold')],
  notes: 'This is what the far-side tuck is for, and it is why the seven is allowed to look lazy on the press. He is not pressing. He is the fifth defender.',
})

A({
  caption: 'AND THE KEEPER TAKES EVERYTHING OVER THE TOP',
  only: [...US_BACK, 'us-RM', 'us-GK', ...THEM_FRONT],
  move: { 'us-GK': [44, 50] },
  cue: { 'us-GK': 'SPARE', 'us-RM': 'BALANCE' },
  bands: [...bandSet('us'), ...bandSet('offside')],
  notes: 'Forty-four metres up the pitch. The line can only be that high because he is that far off it, and the line being that high is what leaves their five stranded.',
})

// ===========================================================================
// 8 · What it costs
// ===========================================================================

A({
  title: 'What It Costs',
  bands: bandSet('us'),
  cue: { 'us-RB': 'SPARE' },
  arrows: () => [arrow('switch', 'them-LB', 'them-RW', { bend: 1 })],
  texts: () => [countText('3 v 2 THE OTHER WAY', { y: ['>', 60], x: ['<', 82], outfield: true }, { x: 40, y: 84 }, 'red', 'm', true)],
  notes: 'Be honest about the bill. Everything moved to one side, so the far side is theirs. If the switch reaches the far winger before we shift, they have three against two there.',
})

A({
  caption: 'YOU CANNOT PRESS AND COVER THE SWITCH',
  bands: bandSet('us'),
  arrows: () => [
    arrow('pass', 'them-LB', 'them-CDM'),
    arrow('pass', 'them-CDM', 'them-RB'),
  ],
  notes: 'What you can do is make it slow. The screen is still stood in the middle, so the switch cannot go through the pivot in one. Two passes instead of one, and two passes is all the far-side tuck needs.',
})

A({
  caption: 'AND THE SCREEN NEVER RESTS',
  ball: null,
  only: US_FRONT,
  bands: bandSet('us'),
  notes: 'Cost two, and it is the one that kills teams who try this. Every phase of this film asked the front two to hold one position and refuse to chase. Lose that for a single pass and the whole thing is just a 4-4-2 running uphill.',
})

reset()
A({
  caption: 'PRESS THE PASSES, NOT THE MAN',
  move: { 'us-ST': [84, 44], 'us-CF': [84, 56] },
  ball: [95, 50],
  bands: [...bandSet('us'), ...bandSet('them'), ...bandSet('screen')],
  camera: 'off',
  notes: 'Back to the start, both shapes, screen on. The whole system in one line.',
})

// ===========================================================================

const system = {
  v: 1,
  title: 'How To Press The 2-3-5',
  pitch: 'full-vertical',
  surface: 'night',
  grid: 'channels',
  matchBall: 'trionda',
  camera: 'follow',
  keepShape: true,
  hold: 0,
  move: 1500,
  teams: {
    us: { base: '#ebebeb', deep: '#b7b7b7', name: 'Our team', text: '#161618' },
    them: { base: '#E2473B', deep: '#B5392F', name: 'Opposition', text: '#FFFFFF' },
  },
  acts,
}

const out = join(ROOT, 'content/systems/how-to-press-the-2-3-5.json')
const claimsOut = join(ROOT, 'films/how-to-press-the-2-3-5.claims.json')
mkdirSync(dirname(claimsOut), { recursive: true })
writeFileSync(out, JSON.stringify(system, null, 1))
writeFileSync(claimsOut, JSON.stringify(claims, null, 1))
console.log(`${acts.length} phases -> ${out}`)
console.log(`${claims.length} claims -> ${claimsOut}`)
