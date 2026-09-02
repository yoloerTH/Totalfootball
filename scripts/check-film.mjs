/**
 * Check a studio film document before it goes near a render.
 *
 *   node scripts/check-film.mjs content/systems/how-to-press-the-2-3-5.json
 *   node scripts/check-film.mjs <file> --why        # dump the numbers too
 *
 * IT COLLECTS, AND IT PRINTS THE FIX.
 *
 * CLAUDE.md, rule 2: one run yields the whole punch list, and a fault line
 * carries the CORRECTED value and not just the violated one. So nothing here
 * throws on the first failure except the two structural causes that make every
 * later number meaningless — a missing token id, a NaN coordinate — and those
 * are marked FATAL and still let the rest of that class report first.
 *
 * WHAT IT KNOWS THAT YOUR EYES DO NOT
 *
 * In the studio you can see two counters are too close. What you cannot see is
 * that a number written on the grass in phase 30 stopped being true when you
 * dragged somebody in phase 29. So every measurement and every "3 v 2" the
 * film puts on screen is recorded as a CLAIM when the document is generated
 * (films/<slug>.claims.json), and this recomputes all of them from the finished
 * document's own token positions.
 *
 * A number on screen with no claim behind it is itself a fault. That is the
 * rule that keeps an invented metre out of a video.
 */
import { readFileSync, existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const MX = 105 / 100
const MY = 68 / 100
const MIN_APART = 4.5
const MIN_DUEL = 1.6

const file = process.argv[2]
const why = process.argv.includes('--why')
if (!file) {
  console.error('usage: node scripts/check-film.mjs <system.json> [--why]')
  process.exit(2)
}

const doc = JSON.parse(readFileSync(file, 'utf8'))
const slug = basename(file).replace(/\.json$/, '')
const claimsFile = join(ROOT, 'films', `${slug}.claims.json`)
const claims = existsSync(claimsFile) ? JSON.parse(readFileSync(claimsFile, 'utf8')) : []

const faults = []
const fatal = []
const fail = (group, act, line) => faults.push({ group, act, line })
const die = (group, act, line) => fatal.push({ group, act, line })

const m = (a, b) => Math.hypot((a.x - b.x) * MX, (a.y - b.y) * MY)
const NUM_WORD = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10,
  ELEVEN: 11, TWELVE: 12, FIFTEEN: 15, TWENTY: 20, THIRTY: 30, FORTY: 40, FIFTY: 50,
}
const NUM_RE = new RegExp(`\\b(\\d+|${Object.keys(NUM_WORD).join('|')})\\s*(M|METRES?|METERS?)\\b`, 'gi')
const VS_RE = /\b(\d+)\s*v\s*(\d+)\b/gi
const numOf = (s) => (/^\d+$/.test(s) ? Number(s) : NUM_WORD[s.toUpperCase()])

const acts = doc.acts ?? []

// --- 1 · structure -------------------------------------------------------
const seenIds = new Set()
for (const [i, a] of acts.entries()) {
  const n = i + 1
  if (seenIds.has(a.id)) die('structure', n, `duplicate act id "${a.id}" — renumber it a${String(n).padStart(2, '0')}`)
  seenIds.add(a.id)
  const ids = new Set()
  for (const t of a.tokens ?? []) {
    if (ids.has(t.id)) die('structure', n, `token "${t.id}" appears twice — one of them must go`)
    ids.add(t.id)
    if (!Number.isFinite(t.x) || !Number.isFinite(t.y)) die('structure', n, `${t.id} has a non-finite coordinate (${t.x}, ${t.y})`)
    if (t.x < -2 || t.x > 102 || t.y < -2 || t.y > 102) {
      fail('off the board', n, `${t.id} at (${t.x}, ${t.y}) is off the pitch — clamp to (${Math.min(100, Math.max(0, t.x))}, ${Math.min(100, Math.max(0, t.y))})`)
    }
  }
}

// --- 2 · the roster must not blink --------------------------------------
// films/README.md: a deleted-and-re-added man fades out and pops in instead of
// running, and no pacing fixes it. So a token may be absent only as a prefix.
const rosters = acts.map((a) => new Set((a.tokens ?? []).map((t) => t.id)))
const everyone = [...new Set(acts.flatMap((a) => (a.tokens ?? []).map((t) => t.id)))]
for (const id of everyone) {
  const present = rosters.map((r) => r.has(id))
  const first = present.indexOf(true)
  const gap = present.indexOf(false, first)
  if (gap !== -1 && present.indexOf(true, gap) !== -1) {
    const back = present.indexOf(true, gap) + 1
    fail('roster', gap + 1, `${id} leaves at phase ${gap + 1} and returns at ${back} — he will fade out and pop in. Keep him on every phase from ${first + 1} and move him instead, or bench him with "benched": true`)
  }
}

// --- 3 · separation ------------------------------------------------------
// A cue on either man is the declaration that this is a duel. Anything else
// gets 4.5m, and the fault line says where to put them.
for (const [i, a] of acts.entries()) {
  const n = i + 1
  const ts = a.tokens ?? []
  for (let p = 0; p < ts.length; p++) {
    for (let q = p + 1; q < ts.length; q++) {
      const A = ts[p]
      const B = ts[q]
      const d = m(A, B)
      const duel = Boolean(A.cue || B.cue)
      const floor = duel ? MIN_DUEL : MIN_APART
      if (d >= floor) continue
      const need = floor - d
      const dy = Math.abs(A.y - B.y) * MY
      const dx = Math.abs(A.x - B.x) * MX
      const axis = dy >= dx ? 'y' : 'x'
      const unit = axis === 'y' ? MY : MX
      const half = (need / unit / 2) + 0.05
      const lo = A[axis] <= B[axis] ? A : B
      const hi = lo === A ? B : A
      fail(
        duel ? 'duel too tight' : 'separation',
        n,
        `${A.id} and ${B.id} are ${d.toFixed(2)}m apart, floor ${floor}m — move ${lo.id} to ${axis}=${(lo[axis] - half).toFixed(1)} and ${hi.id} to ${axis}=${(hi[axis] + half).toFixed(1)}`,
      )
    }
  }
}

// --- 4 · marks that point at nobody -------------------------------------
for (const [i, a] of acts.entries()) {
  const n = i + 1
  const ids = new Set((a.tokens ?? []).map((t) => t.id))
  for (const b of a.bands ?? []) {
    for (const t of b.throughTokens ?? []) {
      if (!ids.has(t)) die('marks', n, `band "${b.id}" is drawn through "${t}", who is not on this phase`)
    }
  }
  for (const r of a.arrows ?? []) {
    for (const k of ['fromId', 'toId']) {
      if (r[k] && !ids.has(r[k])) die('marks', n, `arrow "${r.id}" ${k} is "${r[k]}", who is not on this phase`)
    }
  }
}

// --- 5 · dead phases -----------------------------------------------------
// films/README.md: a phase that changes nothing holds twice and moves zero.
const poseOf = (a) =>
  JSON.stringify([
    (a.tokens ?? []).map((t) => [t.id, t.x, t.y, t.cue ?? '', t.dim ? 1 : 0]),
    a.ball,
    (a.arrows ?? []).map((r) => [r.kind, r.from, r.to, r.label ?? '']),
    (a.bands ?? []).map((b) => b.id),
    (a.texts ?? []).map((t) => [t.text, t.x, t.y]),
  ])
for (let i = 1; i < acts.length; i++) {
  if (poseOf(acts[i]) === poseOf(acts[i - 1])) {
    fail('dead phase', i + 1, `phase ${i + 1} is identical to ${i} — the film holds twice and moves zero. Change the pose, or delete it and put its caption on ${i}`)
  }
}

// --- 6 · every number on screen ------------------------------------------
const claimsFor = (n) => claims.filter((c) => c.act === n)
const tokensOf = (n) => acts[n - 1].tokens ?? []
const tokenAt = (n, ref) => (typeof ref === 'string' ? (ref === 'ball' ? acts[n - 1].ball : tokensOf(n).find((t) => t.id === ref)) : ref)

const passes = (t, where) => {
  if (where.outfield && /-GK$/.test(t.id)) return false
  if (where.side && t.side !== where.side) return false
  for (const axis of ['x', 'y']) {
    const c = where[axis]
    if (!c) continue
    const [op, v, v2] = c
    if (op === '>' && !(t[axis] > v)) return false
    if (op === '<' && !(t[axis] < v)) return false
    if (op === 'between' && !(t[axis] > v && t[axis] < v2)) return false
  }
  return true
}

for (const c of claims) {
  const n = c.act
  if (!acts[n - 1]) { die('claims', n, `claim "${c.text}" points at phase ${n}, which does not exist`); continue }
  if (c.kind === 'distance') {
    const A = tokenAt(n, c.a)
    const B = tokenAt(n, c.b)
    if (!A || !B) { die('claims', n, `claim "${c.text}" measures something not on the phase`); continue }
    const d = m(A, B)
    const said = Number((c.text.match(/\d+/) ?? [])[0])
    if (Math.abs(d - said) > 0.5) {
      fail('wrong number on screen', n, `"${c.text}" — that gap is ${d.toFixed(2)}m. Write "${c.text.replace(/\d+/, String(Math.round(d)))}"`)
    }
    if (why) console.log(`  why ${n}: ${JSON.stringify(c.a)}→${JSON.stringify(c.b)} = ${d.toFixed(2)}m`)
  }
  if (c.kind === 'count') {
    const [, su, st] = c.text.match(VS_RE) ? c.text.match(/(\d+)\s*v\s*(\d+)/i) : []
    const us = tokensOf(n).filter((t) => t.side === 'us' && passes(t, c.where))
    const them = tokensOf(n).filter((t) => t.side === 'them' && passes(t, c.where))
    const [wantUs, wantThem] = c.themFirst ? [st, su] : [su, st]
    if (Number(wantUs) !== us.length || Number(wantThem) !== them.length) {
      fail('wrong number on screen', n, `"${c.text}" — in that window there are ${us.length} of ours (${us.map((t) => t.id).join(', ') || 'none'}) and ${them.length} of theirs (${them.map((t) => t.id).join(', ') || 'none'}). Write "${c.text.replace(/\d+\s*v\s*\d+/i, c.themFirst ? `${them.length} v ${us.length}` : `${us.length} v ${them.length}`)}"`)
    }
    if (why) console.log(`  why ${n}: ${c.text} → us ${us.map((t) => t.id).join('/')} | them ${them.map((t) => t.id).join('/')}`)
  }
}

for (const [i, a] of acts.entries()) {
  const n = i + 1
  const onScreen = [a.title, a.caption, ...(a.texts ?? []).map((t) => t.text)].filter(Boolean).join(' ')
  const mine = claimsFor(n)
  for (const hit of onScreen.matchAll(NUM_RE)) {
    const v = numOf(hit[1])
    const backed = mine.some((c) => c.kind === 'distance' && Math.abs(Math.round(m(tokenAt(n, c.a) ?? { x: 0, y: 0 }, tokenAt(n, c.b) ?? { x: 99, y: 99 })) - v) < 1)
    if (!backed) fail('unverified number', n, `"${hit[0]}" is on screen with nothing measuring it. Either add a claim for it in the generator or take the number off the board`)
  }
  for (const hit of onScreen.matchAll(VS_RE)) {
    if (!mine.some((c) => c.kind === 'count' && c.text.includes(hit[0]))) {
      fail('unverified number', n, `"${hit[0]}" is on screen with nothing counting it. Add a countText claim or take it off the board`)
    }
  }
}

// --- 7 · the ball is the soundtrack --------------------------------------
// films/README.md: the ball moving between two phases IS the kick sound.
const kicks = []
for (let i = 1; i < acts.length; i++) {
  const p = acts[i - 1].ball
  const q = acts[i].ball
  if (!p || !q) continue
  const d = m(p, q)
  if (d > 0.5) kicks.push({ n: i + 1, d })
  if (d > 60) fail('ball', i + 1, `the ball travels ${d.toFixed(0)}m into phase ${i + 1} — that is one kick the length of the pitch. Split it across two phases if it is a carry`)
}

// --- report ---------------------------------------------------------------
const runtime = ((doc.hold ?? 2600) + (doc.move ?? 1100)) * acts.length
console.log(`\n${doc.title} — ${acts.length} phases · hold ${doc.hold}ms · move ${doc.move}ms · ~${(runtime / 1000).toFixed(0)}s · ${kicks.length} kicks`)
console.log(`${claims.length} numbers on screen, all recomputed from the document.`)

const all = [...fatal.map((f) => ({ ...f, tier: 'FATAL' })), ...faults.map((f) => ({ ...f, tier: '' }))]
if (!all.length) {
  console.log('\nNo faults.\n')
  process.exit(0)
}
const groups = [...new Set(all.map((f) => f.group))]
console.log(`\n${all.length} fault${all.length === 1 ? '' : 's'}:\n`)
for (const g of groups) {
  const rows = all.filter((f) => f.group === g)
  console.log(`  ${g.toUpperCase()} (${rows.length})`)
  for (const r of rows) console.log(`    ${r.tier ? 'FATAL ' : ''}phase ${String(r.act).padStart(2)}: ${r.line}`)
  console.log('')
}
process.exit(1)
