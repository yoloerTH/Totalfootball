/**
 * Validate content/systems/sacchis-25-metres.json against the studio's OWN
 * modules — not a second copy of the rules. Imports the resolvers and lists straight out
 * of src/studio, drives tween.ts and camera.ts over every beat, and collects.
 */
import { readFileSync } from 'node:fs'
import { PITCH_VIEW_LIST, resolveViewId, PITCH_GRIDS, toMetres } from '../src/studio/board/pitch.ts'
import { PITCH_SURFACES, BAND_TONES, BAND_STRENGTHS, BAND_EDGES, TEXT_SIZES, TEXT_WEIGHTS } from '../src/studio/board/surfaces.ts'
import { BALLS, resolveBall } from '../src/studio/balls.ts'
import { CAMERA_MODES, CAMERA_PUSHES, shotFor } from '../src/studio/camera.ts'
import { tweenActs } from '../src/studio/tween.ts'
import { ballsOf } from '../src/studio/schema.ts'
import { MIN_HOLD_MS, MAX_HOLD_MS, MIN_MOVE_MS, MAX_MOVE_MS } from '../src/studio/pace.ts'

const doc = JSON.parse(readFileSync(new URL('../content/systems/sacchis-25-metres.json', import.meta.url), 'utf8'))
const faults = []
const bad = (m) => faults.push(m)
const idsOf = (list) => list.map((x) => x.id)

const CUES = ['PRESS', 'COVER', 'BALANCE', 'SPARE', 'JOCKEY', 'DROP']
const ARROW_KINDS = ['pass', 'run', 'carry', 'press', 'switch', 'line']
const BAND_KINDS = ['block', 'danger', 'zone']
const ALIGNS = ['left', 'center', 'right']
const LOOKS = ['halo', 'plate', 'bare']

const oneOf = (val, list, what) => {
  if (val === undefined) return
  if (!list.includes(val)) bad(`${what}: "${val}" is not one of ${list.join(', ')}`)
}

/* ── document level ─────────────────────────────────────────────────────── */

if (doc.v !== 1) bad(`v is ${doc.v}, must be 1`)
if (!doc.title) bad('no title')
oneOf(doc.pitch, idsOf(PITCH_VIEW_LIST), 'system.pitch')
if (resolveViewId(doc.pitch) !== doc.pitch) bad(`system.pitch "${doc.pitch}" does not resolve to itself`)
oneOf(doc.surface, idsOf(PITCH_SURFACES), 'system.surface')
oneOf(doc.grid, Object.keys(PITCH_GRIDS), 'system.grid')
oneOf(doc.matchBall, idsOf(BALLS), 'system.matchBall')
if (resolveBall(doc.matchBall).id !== doc.matchBall) bad(`matchBall "${doc.matchBall}" did not resolve`)
oneOf(doc.camera, idsOf(CAMERA_MODES), 'system.camera')
oneOf(doc.push, idsOf(CAMERA_PUSHES), 'system.push')
if (!(doc.hold >= MIN_HOLD_MS && doc.hold <= MAX_HOLD_MS)) bad(`hold ${doc.hold}ms is outside the ${MIN_HOLD_MS}..${MAX_HOLD_MS} the studio allows`)
if (!(doc.move >= MIN_MOVE_MS && doc.move <= MAX_MOVE_MS)) bad(`move ${doc.move}ms is outside the ${MIN_MOVE_MS}..${MAX_MOVE_MS} the studio allows`)
for (const a of doc.acts) if (a.push != null) oneOf(a.push, idsOf(CAMERA_PUSHES), `${a.id}.push`)
for (const s of ['us', 'them']) {
  const t = doc.teams?.[s]
  if (!t) { bad(`teams.${s} missing`); continue }
  for (const k of ['base', 'deep', 'text'])
    if (!/^#[0-9A-Fa-f]{6}$/.test(t[k] ?? '')) bad(`teams.${s}.${k} = "${t[k]}" is not a #rrggbb hex`)
}

/* ── the one rule that matters: ids stable across acts ──────────────────── */

const view = PITCH_VIEW_LIST.find((v) => v.id === doc.pitch)
const first = doc.acts[0].tokens.map((t) => t.id).sort().join(',')
const seenActIds = new Set()

doc.acts.forEach((act, i) => {
  const at = `phase ${i + 1} "${act.title}"`
  if (seenActIds.has(act.id)) bad(`${at}: duplicate act id "${act.id}"`)
  seenActIds.add(act.id)
  if (!act.title) bad(`${at}: no title`)
  if (!act.caption) bad(`${at}: no caption`)

  const roster = act.tokens.map((t) => t.id).sort().join(',')
  if (roster !== first) bad(`${at}: roster differs from phase 1 — the stable-id rule is broken`)

  for (const t of act.tokens) {
    if (!(t.x >= 0 && t.x <= 100 && t.y >= 0 && t.y <= 100))
      bad(`${at}: ${t.id} at (${t.x}, ${t.y}) is outside the 0..100 crop`)
    if (!t.label) bad(`${at}: ${t.id} has no label`)
    oneOf(t.side, ['us', 'them'], `${at}: ${t.id}.side`)
    oneOf(t.cue, CUES, `${at}: ${t.id}.cue`)
  }

  for (const a of act.arrows) {
    oneOf(a.kind, ARROW_KINDS, `${at}: arrow ${a.id}.kind`)
    for (const e of ['from', 'to'])
      if (!(a[e]?.x >= 0 && a[e]?.x <= 100 && a[e]?.y >= 0 && a[e]?.y <= 100))
        bad(`${at}: arrow ${a.id}.${e} is outside the crop`)
    if (a.bend !== undefined && Math.abs(a.bend) > 1) bad(`${at}: arrow ${a.id}.bend ${a.bend} is outside -1..1`)
    if (a.opacity !== undefined && (a.opacity < 0 || a.opacity > 1)) bad(`${at}: arrow ${a.id}.opacity out of 0..1`)
    for (const e of ['fromId', 'toId'])
      if (a[e] && !act.tokens.some((t) => t.id === a[e]))
        bad(`${at}: arrow ${a.id}.${e} names "${a[e]}", who is not on this phase`)
  }

  for (const b of act.bands) {
    oneOf(b.kind, BAND_KINDS, `${at}: band ${b.id}.kind`)
    oneOf(b.tone, idsOf(BAND_TONES), `${at}: band ${b.id}.tone`)
    oneOf(b.strength, idsOf(BAND_STRENGTHS), `${at}: band ${b.id}.strength`)
    oneOf(b.edge, idsOf(BAND_EDGES), `${at}: band ${b.id}.edge`)
    const r = b.rect
    if (!r) { bad(`${at}: band ${b.id} has no rect`); continue }
    if (r.w <= 0 || r.h <= 0) bad(`${at}: band ${b.id} rect has no area`)
    if (r.x < 0 || r.y < 0 || r.x + r.w > 100.01 || r.y + r.h > 100.01)
      bad(`${at}: band ${b.id} rect runs outside the crop`)
  }

  for (const t of act.texts ?? []) {
    if (!t.text) bad(`${at}: text ${t.id} is empty`)
    oneOf(t.size, idsOf(TEXT_SIZES), `${at}: text ${t.id}.size`)
    oneOf(t.weight, idsOf(TEXT_WEIGHTS), `${at}: text ${t.id}.weight`)
    oneOf(t.align, ALIGNS, `${at}: text ${t.id}.align`)
    oneOf(t.look, LOOKS, `${at}: text ${t.id}.look`)
    oneOf(t.tone, idsOf(BAND_TONES), `${at}: text ${t.id}.tone`)
  }

  const balls = ballsOf(act)
  if (balls.length !== 1) bad(`${at}: ballsOf() returns ${balls.length} balls, expected 1`)
  if (act.ball?.x !== balls[0]?.x || act.ball?.y !== balls[0]?.y)
    bad(`${at}: legacy .ball does not mirror balls[0]`)

  const marks = [...act.arrows, ...act.bands, ...(act.texts ?? [])].map((m) => m.id)
  const dup = marks.find((v, n) => marks.indexOf(v) !== n)
  if (dup) bad(`${at}: two marks share the id "${dup}"`)
})

/* ── drive the real tween and the real camera over every beat ───────────── */

for (let i = 0; i < doc.acts.length - 1; i++) {
  for (const p of [0, 0.13, 0.37, 0.5, 0.66, 0.9, 1]) {
    const out = tweenActs(doc.acts[i], doc.acts[i + 1], p)
    for (const t of out.tokens ?? [])
      if (!Number.isFinite(t.x) || !Number.isFinite(t.y))
        bad(`tween ${i + 1}->${i + 2} at p=${p}: ${t.id} is not a finite position`)
  }
}

doc.acts.forEach((act, i) => {
  const shot = shotFor(doc, act, view)
  if (shot) for (const k of ['x', 'y', 'w', 'h'])
    if (!Number.isFinite(shot[k])) bad(`phase ${i + 1}: camera shot.${k} is ${shot[k]}`)
})

/* ── the claims the copy makes, measured off the emitted percent coords ─── */

const m = (t) => toMetres(view, t.x, t.y)
const a1 = doc.acts[0]
const back = m(a1.tokens.find((t) => t.id === 'u-lcb')).x
const front = m(a1.tokens.find((t) => t.id === 'u-9')).x
const block = Math.round(front - back)
if (!a1.bands[0].label.includes(`${block} metres`))
  bad(`phase 1 band says "${a1.bands[0].label}" but the block measures ${block}m`)
if (!a1.arrows[0].label.includes(`${block} metres`))
  bad(`phase 1 measure line says "${a1.arrows[0].label}" but the block measures ${block}m`)

const act = (id) => {
  const a = doc.acts.find((x) => x.id === id)
  if (!a) bad(`no act "${id}" in the document`)
  return a
}
const lineOf = (a) => Math.min(...['u-lb', 'u-lcb', 'u-rcb', 'u-rb'].map((k) => m(a.tokens.find((t) => t.id === k)).x))
const arrowOf = (a, id) => a.arrows.find((x) => x.id === id)
const lenOf = (ar) => Math.round(Math.hypot(m(ar.from).x - m(ar.to).x, m(ar.from).y - m(ar.to).y))
const says = (s, n) => String(s).includes(`${n} metres`)

const oldBlock = Math.round(m(act('act-45m').tokens.find((t) => t.id === 'u-9')).x - m(act('act-45m').tokens.find((t) => t.id === 'u-lcb')).x)
if (!says(act('act-45m').caption, oldBlock)) bad(`act-45m caption does not match the ${oldBlock}m block it draws`)
if (!says(arrowOf(act('act-45m'), 'ar-old-measure').label, oldBlock)) bad(`act-45m measure line does not say ${oldBlock} metres`)

const across = lenOf(arrowOf(act('act-move-as-one'), 'ar-across'))
if (!says(act('act-move-as-one').caption, across)) bad(`act-move-as-one caption does not match the ${across}m square ball`)

const swM = lenOf(arrowOf(act('act-concede'), 'ar-switch'))
if (!says(act('act-concede').caption, swM)) bad(`act-concede caption claims a distance the switch arrow does not measure (${swM}m)`)
const lands = lenOf(arrowOf(act('act-switch-arrives'), 'ar-switch'))
const slide = lenOf(arrowOf(act('act-switch-arrives'), 'ar-travel-rm'))
if (!says(act('act-switch-arrives').caption, lands)) bad(`act-switch-arrives caption does not match the ${lands}m the ball travels`)
if (!act('act-switch-arrives').caption.includes(String(slide))) bad(`act-switch-arrives caption does not match the ${slide}m the block travels`)

const step = Math.round(lineOf(act('act-line-steps')) - lineOf(act('act-goes-long')))
if (!says(act('act-line-steps').caption, step)) bad(`act-line-steps caption does not match the ${step}m the line actually steps`)
const behind = Math.round(lineOf(act('act-risk')))
if (!says(act('act-risk').caption, behind)) bad(`act-risk caption does not match the ${behind}m of grass behind the line`)
if (!says(arrowOf(act('act-risk'), 'ar-behind').label, behind)) bad(`act-risk measure line does not say ${behind} metres`)

const won = m(act('act-win').balls[0])
const toGoal = Math.round(Math.hypot(105 - won.x, 34 - won.y))
if (!says(act('act-win').caption, toGoal)) bad(`act-win caption does not match the measured ${toGoal}m to goal`)
const struck = m(act('act-why').balls[0])
const shotM = Math.round(Math.hypot(105 - struck.x, 34 - struck.y))
if (!says(arrowOf(act('act-why'), 'ar-shot').label, shotM)) bad(`act-why shot arrow does not say ${shotM} metres`)
if (!act('act-why').caption.includes(String(shotM))) bad(`act-why caption does not match the ${shotM}m shot`)

/* ── OFFSIDE, derived from the emitted document alone ─────────────────────
   The last build drew two men beyond the line, called one, and floated the
   plate 11m away from him. So: an opponent beyond our back line must carry a
   call-plate (a halo text starting OFFSIDE), the plate must sit 2.5..5m from
   the man it names, and the margin must read as a stride, 1.5..3.5m. */
const CALL = /^(OFFSIDE|ONSIDE)/
doc.acts.forEach((a, i) => {
  const lx = lineOf(a)
  const beyond = a.tokens.filter((t) => t.side === 'them' && t.id !== 'o-gk' && m(t).x < lx - 0.01)
  const calls = (a.texts ?? []).filter((t) => CALL.test(String(t.text)))
  const offside = calls.filter((t) => String(t.text).startsWith('OFFSIDE'))
  for (const t of beyond) {
    const by = lx - m(t).x
    const named = offside.find((c) => {
      const p = m(c), q = m(t)
      return Math.hypot(p.x - q.x, p.y - q.y) <= 5
    })
    if (!named) bad(`phase ${i + 1} (${a.id}): ${t.id} is ${by.toFixed(1)}m beyond our back line at ${lx.toFixed(0)}m with no OFFSIDE plate within 5m of him`)
    if (by < 1.5 || by > 3.5) bad(`phase ${i + 1} (${a.id}): ${t.id} is ${by.toFixed(1)}m offside; a trap has to read as a stride, 1.5..3.5m`)
  }
  for (const c of calls) {
    const p = m(c)
    const near = a.tokens
      .filter((t) => t.side === 'them')
      .map((t) => ({ t, d: Math.hypot(p.x - m(t).x, p.y - m(t).y) }))
      .sort((x, y) => x.d - y.d)[0]
    if (!near || near.d < 2.5 || near.d > 5)
      bad(`phase ${i + 1} (${a.id}): the "${String(c.text).split('\n')[0]}" plate sits ${near ? near.d.toFixed(1) : '?'}m from the nearest opponent; a call plate belongs on the man, 2.5..5m`)
    if (String(c.text).startsWith('OFFSIDE') && near && m(near.t).x >= lx - 0.01)
      bad(`phase ${i + 1} (${a.id}): ${near.t.id} is called offside but is level with or behind our line at ${lx.toFixed(0)}m`)
    if (String(c.text).startsWith('ONSIDE') && near && m(near.t).x < lx - 0.01)
      bad(`phase ${i + 1} (${a.id}): ${near.t.id} is called onside but is beyond our line at ${lx.toFixed(0)}m`)
  }
  if (offside.length || beyond.length) {
    const drawn = arrowOf(a, 'ar-offside-line')
    if (!drawn) bad(`phase ${i + 1} (${a.id}): an offside is called but no line is drawn`)
    else if (Math.abs(m(drawn.from).x - lx) > 0.2 || Math.abs(m(drawn.to).x - lx) > 0.2)
      bad(`phase ${i + 1} (${a.id}): the offside line is drawn at ${m(drawn.from).x.toFixed(1)}m but the back four stands at ${lx.toFixed(1)}m`)
  }
})

/* THE FAULT THAT SHIPPED: a crop with a whole half doing nothing.
   Measured against the REAL view out of pitch.ts, not a remembered number. */
const VW = view.x1 - view.x0, VH = view.y1 - view.y0
doc.acts.forEach((act, i) => {
  const pts = [...act.tokens.map(m), m(act.balls[0])]
  const lo = { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)) }
  const hi = { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)) }
  const margins = {
    left: (lo.x - view.x0) / VW, right: (view.x1 - hi.x) / VW,
    top: (lo.y - view.y0) / VH, bottom: (view.y1 - hi.y) / VH,
  }
  // 0.35, agreeing with the builder. On a FULL pitch the grass behind our keeper
  // is our own goal, our own box and the approach to it — pitch that means
  // something, not dead frame. It was 0.33 while this was posed on a crop that
  // cut our goal off, where the same emptiness meant nothing at all.
  for (const [side, frac] of Object.entries(margins))
    if (frac > 0.35)
      bad(`phase ${i + 1}: ${(frac * 100).toFixed(0)}% of the ${view.id} crop is empty on the ${side} ` +
          `(content ${lo.x.toFixed(0)}..${hi.x.toFixed(0)}m x ${lo.y.toFixed(0)}..${hi.y.toFixed(0)}m)`)
  if ((hi.x - lo.x) / VW < 0.6) bad(`phase ${i + 1}: players use only ${(((hi.x - lo.x) / VW) * 100).toFixed(0)}% of the crop's length`)
  if ((hi.y - lo.y) / VH < 0.72) bad(`phase ${i + 1}: players use only ${(((hi.y - lo.y) / VH) * 100).toFixed(0)}% of the crop's width`)
})

/* A label anchor is fixed by Overlays.tsx and cannot be dragged off a counter:
   a zone box takes its name 2.4m inside its top edge, an arrow at its midpoint. */
doc.acts.forEach((act, i) => {
  const anchors = []
  for (const b of act.bands) if (b.label) {
    const tl = m({ x: b.rect.x + b.rect.w / 2, y: b.rect.y })
    anchors.push([`band ${b.id}`, { x: tl.x, y: tl.y + 2.4 }, b.label])
  }
  for (const a of act.arrows) if (a.label) {
    const f = m(a.from), t = m(a.to)
    anchors.push([`arrow ${a.id}`, { x: (f.x + t.x) / 2, y: (f.y + t.y) / 2 }, a.label])
  }
  for (const t of act.texts ?? []) {
    if (CALL.test(String(t.text))) continue   // attached on purpose; checked above
    anchors.push([`text ${t.id}`, m(t), t.text])
  }
  for (const [what, at, txt] of anchors)
    for (const tok of act.tokens) {
      const p = m(tok)
      const d = Math.hypot(at.x - p.x, at.y - p.y)
      if (d < 6) bad(`phase ${i + 1}: ${what} ("${String(txt).split('\n')[0]}") anchors ${d.toFixed(1)}m from ${tok.id}`)
    }
})

const MIN = 4.5, DUEL = 2.4
doc.acts.forEach((act, i) => {
  const pts = act.tokens.map((t) => ({ id: t.id, press: t.cue === 'PRESS', ...m(t) }))
  for (let a = 0; a < pts.length; a++)
    for (let b = a + 1; b < pts.length; b++) {
      const d = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y)
      const duel = (pts[a].press || pts[b].press) && pts[a].id[0] !== pts[b].id[0]
      const floor = duel ? DUEL : MIN
      if (d < floor)
        bad(`phase ${i + 1}: ${pts[a].id} and ${pts[b].id} are ${d.toFixed(2)}m apart after the round trip, min ${floor}` +
            (duel ? ' (one of them is pressing the other)' : ''))
    }
})

if (faults.length) {
  console.error(`\n${faults.length} fault(s):\n`)
  for (const f of faults) console.error('  · ' + f)
  console.error('')
  process.exit(1)
}
console.log(`OK — ${doc.acts.length} phases, ${doc.acts[0].tokens.length} tokens, verified against the studio's own modules.`)
console.log('  keeper off his line, phase by phase:',
  doc.acts.map((a) => Math.round(m(a.tokens.find((t) => t.id === 'u-gk')).x)).join(', '), 'm')
console.log('  our back line, phase by phase:      ',
  doc.acts.map((a) => Math.round(Math.min(...['u-lb','u-lcb','u-rcb','u-rb'].map((k) => m(a.tokens.find((t) => t.id === k)).x)))).join(', '), 'm  (halfway 52.5)')
console.log(`  block ${block} m · switch ${swM} m · turnover ${toGoal} m from goal`)
