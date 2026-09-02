/**
 * Changing the crop moves everything, or it is a bug.
 *
 * ── WHY THIS IS A SCRIPT AND NOT A CODE REVIEW ───────────────────────────────
 *
 * Percent coordinates are measured on the pitch VIEW (src/studio/board/pitch.ts),
 * so switching view has to re-express every mark on the board. That walk was
 * written out four times — once in the editor, three times in sequences.ts —
 * and the copies had quietly drifted: the one the pitch picker used never
 * carried `texts`, `gear` or `act.shot`. The symptom is a cone that ends up 7.8
 * metres from the player who was standing next to it, which nobody reviewing a
 * diff can see, because the numbers involved are percent of a crop that is a
 * different shape on each of the nine views.
 *
 * So the walk is one function now (src/studio/board/transform.ts) and this is
 * the thing that stops it being four again. It fails the build when:
 *
 *  · a positional field is added to `Act` or `System` and not to `mapAct`,
 *  · a view round-trip does not land on the metre it started on,
 *  · a mirror is not its own inverse,
 *  · applying a sequence changes ANY mark that was already on the phase.
 *
 * ── IT COLLECTS, AND IT PRINTS THE NUMBER ────────────────────────────────────
 *
 * One run gives the whole punch list, and every fault line carries what came
 * out AND what it should have been. Nothing here is worked out by hand.
 *
 * Run: node --import ./scripts/lib/ts.mjs scripts/check-transform.mjs
 */

import { readFileSync } from 'node:fs'
import { PITCH_VIEWS, PITCH_VIEW_LIST, toMetres, toPercent, viewFor } from '../src/studio/board/pitch.ts'
import {
  KEEP,
  compose,
  intoRegion,
  mapAct,
  mapMarks,
  mapSystem,
  mirrorTransform,
  outOfRegion,
  shift,
  viewTransform,
} from '../src/studio/board/transform.ts'
import { ballsOf } from '../src/studio/schema.ts'
import { addSequence } from '../src/studio/inject.ts'
import { captureSequence, placementTransform, remapSequenceActs } from '../src/studio/sequences.ts'

const faults = []
const fail = (group, line) => faults.push({ group, line })

/** Percent, to a hundredth. Board geometry, not a survey. */
const p2 = (n) => Math.round(n * 100) / 100
/** Metres, to a centimetre. */
const m2 = (n) => Math.round(n * 100) / 100

/* ── 1 · THE WALK COVERS THE SCHEMA ───────────────────────────────────────────
 *
 * Read the document format itself and find every interface that stores a
 * coordinate, then insist `mapAct` names it. This is the check that cannot rot:
 * a new mark type added to schema.ts fails here on the commit that adds it,
 * rather than three months later on somebody's board.
 */
{
  const schema = readFileSync(new URL('../src/studio/schema.ts', import.meta.url), 'utf8')
  const transform = readFileSync(new URL('../src/studio/board/transform.ts', import.meta.url), 'utf8')

  // The field on `Act` (or `System`) that each positional interface is stored
  // under. Stated here because the type name and the field name differ, and
  // because a walk has to be told which list to read.
  // Several names each, because a field can be reached by more than one route:
  // the balls are read through `ballsOf` and written through `ballFields`, which
  // is the only way a document from before the list existed still opens (see
  // `Act.ball` in schema.ts). Any one of the names counts as walked.
  const CARRIER = {
    Token: ['tokens'],
    Arrow: ['arrows'],
    Band: ['bands'],
    TextMark: ['texts'],
    BallMark: ['balls', 'ballsOf', 'ballFields'],
    GearMark: ['gear'],
    Shot: ['shot'],
  }

  /**
   * `mapAct`'s own body, and nothing after it.
   *
   * Scoped deliberately: a scan of the whole file finds `texts` and `gear` in
   * `mapMarks` further down and passes while `mapAct` has forgotten them, which
   * is the exact bug this section exists to catch.
   */
  const mapActBody = (src) => {
    const start = src.indexOf('export function mapAct')
    if (start < 0) return ''
    const end = src.indexOf('\n}', start)
    return src.slice(start, end < 0 ? undefined : end)
  }

  const blocks = schema.matchAll(/export interface (\w+)[^{]*\{([\s\S]*?)\n\}/g)
  for (const [, name, body] of blocks) {
    const positional = /^\s{2}x\??: number$/m.test(body) || /^\s{2}rect\??: \{/m.test(body)
    if (!positional) continue
    if (!(name in CARRIER)) {
      fail(
        'schema coverage',
        `${name} in schema.ts stores a coordinate and is not in CARRIER here. ` +
          `Add it to CARRIER, and add its field to mapAct in board/transform.ts.`,
      )
      continue
    }
    const names = CARRIER[name]
    const walk = mapActBody(transform)
    if (!names.some((f) => new RegExp(`\\b${f}\\b`).test(walk))) {
      fail(
        'schema coverage',
        `mapAct does not walk \`${names[0]}\` (${name}). ` +
          `Add \`${names[0]}\` to the object mapAct builds, using map${name.replace(/Mark$/, '')}.`,
      )
    }
  }
}

/* ── 2 · A ROUND TRIP LANDS ON THE SAME GRASS ────────────────────────────────
 *
 * Out to metres in one view and back into percent in another is only
 * non-destructive if it is REVERSIBLE. Every ordered pair of views, on a mark
 * at the centre spot, the penalty spot and a corner.
 */
{
  const probes = [
    ['centre spot', 52.5, 34],
    ['their penalty spot', 94, 34],
    ['our penalty spot', 11, 34],
    ['their corner', 105, 0],
  ]
  for (const from of PITCH_VIEW_LIST) {
    for (const to of PITCH_VIEW_LIST) {
      if (from === to) continue
      const there = viewTransform(from, to)
      const back = viewTransform(to, from)
      for (const [label, mx, my] of probes) {
        const start = toPercent(from, mx, my)
        const round = back.point(there.point(start))
        const dx = Math.abs(round.x - start.x)
        const dy = Math.abs(round.y - start.y)
        if (dx > 1e-6 || dy > 1e-6) {
          fail(
            'view round trip',
            `${from.id} -> ${to.id} -> ${from.id} moved the ${label}: ` +
              `${p2(start.x)},${p2(start.y)} came back ${p2(round.x)},${p2(round.y)}. ` +
              `It must come back ${p2(start.x)},${p2(start.y)}.`,
          )
        }
      }
    }
  }
}

/* ── 3 · A REMAP KEEPS THE METRE ─────────────────────────────────────────────
 *
 * The point of the whole exercise: a mark stays on the patch of grass the coach
 * put it on. Checked in metres, which is the space the answer is true in.
 */
{
  for (const from of PITCH_VIEW_LIST) {
    for (const to of PITCH_VIEW_LIST) {
      if (from === to) continue
      const t = viewTransform(from, to)
      for (const [mx, my] of [[52.5, 34], [94, 34], [11, 20], [80, 55]]) {
        const got = toMetres(to, ...Object.values(t.point(toPercent(from, mx, my))))
        if (Math.abs(got.x - mx) > 1e-6 || Math.abs(got.y - my) > 1e-6) {
          fail(
            'metre invariance',
            `${from.id} -> ${to.id}: a mark at ${mx}m,${my}m landed at ` +
              `${m2(got.x)}m,${m2(got.y)}m — ${m2(got.x - mx)}m along, ${m2(got.y - my)}m across. ` +
              `It must land at ${mx}m,${my}m.`,
          )
        }
      }
    }
  }
}

/* ── 3b · A TRANSFORM MOVES EVERYTHING, NOT MOST THINGS ──────────────────────
 *
 * The section above proves the walk is WIRED to every field. This proves it
 * RUNS on every field: translate an act carrying one of each mark and insist
 * every coordinate on it moved by exactly the offset. A field the walk skips
 * comes back at its old number and is named here with the number it should
 * have had — which is the whole fault report, in one line, per field.
 */
{
  const dx = 7
  const dy = -5
  const before = fixtureAct('walk')
  const after = mapAct(shift(dx, dy), before)
  const want = { ...before }

  const moved = (what, was, got) => {
    const should = was + (what.endsWith('.y') || what.endsWith(' y') ? dy : dx)
    if (got === undefined || Math.abs(got - should) > 1e-9) {
      fail(
        'walk coverage',
        `${what} was ${p2(was)} and came out ${got === undefined ? 'undefined' : p2(got)} ` +
          `after a ${dx},${dy} move. It must be ${p2(should)} — mapAct is not walking it.`,
      )
    }
  }

  before.tokens.forEach((t, i) => {
    moved(`token ${t.id} x`, t.x, after.tokens[i]?.x)
    moved(`token ${t.id} y`, t.y, after.tokens[i]?.y)
  })
  ballsOf(before).forEach((b, i) => {
    moved(`ball ${b.id} x`, b.x, ballsOf(after)[i]?.x)
    moved(`ball ${b.id} y`, b.y, ballsOf(after)[i]?.y)
  })
  before.arrows.forEach((a, i) => {
    moved(`arrow ${a.id} from.x`, a.from.x, after.arrows[i]?.from.x)
    moved(`arrow ${a.id} from.y`, a.from.y, after.arrows[i]?.from.y)
    moved(`arrow ${a.id} to.x`, a.to.x, after.arrows[i]?.to.x)
    moved(`arrow ${a.id} to.y`, a.to.y, after.arrows[i]?.to.y)
  })
  before.bands.forEach((b, i) => {
    if (!b.rect) return
    moved(`band ${b.id} rect.x`, b.rect.x, after.bands[i]?.rect?.x)
    moved(`band ${b.id} rect.y`, b.rect.y, after.bands[i]?.rect?.y)
  })
  ;(before.texts ?? []).forEach((t, i) => {
    moved(`text ${t.id} x`, t.x, (after.texts ?? [])[i]?.x)
    moved(`text ${t.id} y`, t.y, (after.texts ?? [])[i]?.y)
  })
  ;(before.gear ?? []).forEach((g, i) => {
    moved(`gear ${g.id} x`, g.x, (after.gear ?? [])[i]?.x)
    moved(`gear ${g.id} y`, g.y, (after.gear ?? [])[i]?.y)
  })
  moved('shot x', before.shot.x, after.shot?.x)
  moved('shot y', before.shot.y, after.shot?.y)

  // A translate must not resize anything: a band and a camera frame keep the
  // ground they cover when they slide across the board.
  before.bands.forEach((b, i) => {
    if (!b.rect) return
    const g = after.bands[i]?.rect
    if (!g || Math.abs(g.w - b.rect.w) > 1e-9 || Math.abs(g.h - b.rect.h) > 1e-9) {
      fail(
        'walk coverage',
        `band ${b.id} was ${p2(b.rect.w)}x${p2(b.rect.h)} and came out ` +
          `${g ? `${p2(g.w)}x${p2(g.h)}` : 'missing'} after a pure move. It must stay ` +
          `${p2(b.rect.w)}x${p2(b.rect.h)}.`,
      )
    }
  })
  if (Math.abs((after.shot?.w ?? 0) - want.shot.w) > 1e-9) {
    fail(
      'walk coverage',
      `the camera frame was ${p2(want.shot.w)} wide and came out ${p2(after.shot?.w)} ` +
        `after a pure move. It must stay ${p2(want.shot.w)}.`,
    )
  }
}

/* ── 4 · A MIRROR IS ITS OWN INVERSE ─────────────────────────────────────────
 *
 * Points, bows, bearings, flips and alignment, on every board. If mirroring
 * twice is not the identity then mirroring once is doing something nobody can
 * predict, and "put it on the other side" would be a one-way door.
 */
{
  const axesList = [{ flanks: true }, { ends: true }, { flanks: true, ends: true }]
  for (const v of PITCH_VIEW_LIST) {
    for (const axes of axesList) {
      const name = Object.keys(axes).join('+')
      const t = mirrorTransform(v, axes)

      for (const [x, y] of [[10, 20], [50, 50], [92, 77]]) {
        const twice = t.point(t.point({ x, y }))
        if (Math.abs(twice.x - x) > 1e-9 || Math.abs(twice.y - y) > 1e-9) {
          fail(
            'mirror involution',
            `${v.id} ${name}: ${x},${y} mirrored twice is ${p2(twice.x)},${p2(twice.y)}. ` +
              `It must be ${x},${y}.`,
          )
        }
        const once = t.point({ x, y })
        if (once.x < 0 || once.x > 100 || once.y < 0 || once.y > 100) {
          fail(
            'mirror in frame',
            `${v.id} ${name}: ${x},${y} mirrored to ${p2(once.x)},${p2(once.y)}, ` +
              `outside the crop. A crop-centre mirror must stay inside 0-100.`,
          )
        }
      }

      // Bearings and handedness, through the real mark walkers.
      const act = fixtureAct()
      const twice = mapAct(t, mapAct(t, act))
      compareActs(`mirror involution / ${v.id} ${name}`, act, twice)
    }
  }

  // Two perpendicular reflections are a half turn, not a reflection: a bowed
  // pass mirrored both ways bows the way it started.
  for (const v of PITCH_VIEW_LIST) {
    const both = mirrorTransform(v, { ends: true, flanks: true })
    if (both.mirrored) {
      fail(
        'mirror handedness',
        `${v.id}: mirroring both axes reports mirrored=true. Two reflections are a ` +
          `rotation — it must be false, or every bowed pass in the drill flips sign.`,
      )
    }
    if (both.bearing !== 'turn') {
      fail(
        'mirror handedness',
        `${v.id}: mirroring both axes reports bearing='${both.bearing}'. It must be 'turn'.`,
      )
    }
    const one = mirrorTransform(v, { flanks: true })
    if (!one.mirrored) {
      fail(
        'mirror handedness',
        `${v.id}: mirroring one axis reports mirrored=false. It must be true.`,
      )
    }
  }
}

/* ── 4b · ONE MIRROR ACTUALLY REFLECTS ──────────────────────────────────────
 *
 * The involution above is necessary and not sufficient: a mirror that forgets
 * to invert a bowed pass is still its own inverse, because doing nothing twice
 * is doing nothing. So this states the answers OUTRIGHT, worked out by hand
 * once from the geometry and written down, rather than derived from the code
 * they are checking.
 *
 * The fixture bows +0.4, writes at 25° left-aligned, and stands a cone at 40°
 * flipped. Percent y is a screen-VERTICAL reflection on a flat board and a
 * screen-HORIZONTAL one upright, which is the whole reason `bearing` exists —
 * so the same mirror gives different answers on the two boards, and both are
 * here.
 */
{
  const cases = [
    // view,             axes,               bend,  textAngle, textAlign, gearAngle, gearFlip
    ['full',             { flanks: true },   -0.4,  155,       'left',    140,       false],
    ['full',             { ends: true },     -0.4,  335,       'right',   320,       false],
    ['full',             { flanks: true, ends: true }, 0.4, 205, 'left',  220,       true],
    ['full-vertical',    { flanks: true },   -0.4,  335,       'right',   320,       false],
    ['full-vertical',    { ends: true },     -0.4,  155,       'left',    140,       false],
    ['attacking-set-piece', { flanks: true }, -0.4, 335,       'right',   320,       false],
  ]

  for (const [id, axes, bend, textAngle, textAlign, gearAngle, gearFlip] of cases) {
    const label = `${id} ${Object.keys(axes).join('+')}`
    const out = mapAct(mirrorTransform(PITCH_VIEWS[id], axes), fixtureAct('m'))
    const arrow = out.arrows[0]
    const text = out.texts[0]
    const gear = out.gear[0]

    if (Math.abs((arrow.bend ?? 0) - bend) > 1e-9) {
      fail(
        'mirror reflects',
        `${label}: a pass bowed +0.4 came out ${arrow.bend}. It must be ${bend} — ` +
          `a reflected curve swings the other way.`,
      )
    }
    if (Math.abs((text.angle ?? 0) - textAngle) > 1e-9) {
      fail(
        'mirror reflects',
        `${label}: writing at 25 deg came out ${text.angle} deg. It must be ${textAngle} deg.`,
      )
    }
    if (text.align !== textAlign) {
      fail(
        'mirror reflects',
        `${label}: left-aligned writing came out '${text.align}'. It must be '${textAlign}'.`,
      )
    }
    if (Math.abs((gear.angle ?? 0) - gearAngle) > 1e-9) {
      fail(
        'mirror reflects',
        `${label}: a cone at 40 deg came out ${gear.angle} deg. It must be ${gearAngle} deg.`,
      )
    }
    if (Boolean(gear.flip) !== gearFlip) {
      fail(
        'mirror reflects',
        `${label}: a flipped cone came out flip=${Boolean(gear.flip)}. It must be ${gearFlip}.`,
      )
    }
  }
}

/* ── 5 · COMPOSE AGREES WITH APPLYING IN ORDER ───────────────────────────────*/
{
  const v = PITCH_VIEWS.full
  const a = mirrorTransform(v, { flanks: true })
  const b = mirrorTransform(v, { ends: true })
  const ab = compose(a, b)
  const both = mirrorTransform(v, { flanks: true, ends: true })
  for (const [x, y] of [[10, 20], [64, 31]]) {
    const viaCompose = ab.point({ x, y })
    const viaBoth = both.point({ x, y })
    if (Math.abs(viaCompose.x - viaBoth.x) > 1e-9 || Math.abs(viaCompose.y - viaBoth.y) > 1e-9) {
      fail(
        'compose',
        `flanks then ends gave ${p2(viaCompose.x)},${p2(viaCompose.y)} but both-at-once gave ` +
          `${p2(viaBoth.x)},${p2(viaBoth.y)}. They must agree.`,
      )
    }
  }
  if (ab.mirrored !== both.mirrored || ab.bearing !== both.bearing) {
    fail(
      'compose',
      `flanks then ends composed to mirrored=${ab.mirrored} bearing='${ab.bearing}'; ` +
        `both-at-once is mirrored=${both.mirrored} bearing='${both.bearing}'. They must agree.`,
    )
  }
  if (compose(KEEP, KEEP) !== KEEP) {
    fail('compose', `composing two identities did not give back KEEP. It must, so callers can short-circuit.`)
  }
}

/* ── 6 · A REGION GOES OUT WHERE IT WAS PUT ──────────────────────────────────
 *
 * The placement contract: a drill captured out of one box and dropped into
 * another sits inside that other box, in the same proportions.
 */
{
  const capture = { x: 10, y: 10, w: 20, h: 20 }
  const target = { x: 60, y: 55, w: 30, h: 25 }
  const there = intoRegion(capture)
  const back = outOfRegion(target)
  for (const [x, y] of [[10, 10], [20, 20], [30, 30], [15, 26]]) {
    const local = there.point({ x, y })
    const placed = back.point(local)
    const want = {
      x: target.x + ((x - capture.x) / capture.w) * target.w,
      y: target.y + ((y - capture.y) / capture.h) * target.h,
    }
    if (Math.abs(placed.x - want.x) > 1e-9 || Math.abs(placed.y - want.y) > 1e-9) {
      fail(
        'region placement',
        `${x},${y} out of ${JSON.stringify(capture)} into ${JSON.stringify(target)} landed at ` +
          `${p2(placed.x)},${p2(placed.y)}. It must land at ${p2(want.x)},${p2(want.y)}.`,
      )
    }
    if (placed.x < target.x - 1e-9 || placed.x > target.x + target.w + 1e-9) {
      fail(
        'region placement',
        `${x},${y} landed at x=${p2(placed.x)}, outside the target box ` +
          `${p2(target.x)}..${p2(target.x + target.w)}.`,
      )
    }
  }
}

/* ── 7 · APPLYING A SEQUENCE CHANGES NOTHING THAT WAS THERE ──────────────────
 *
 * The headline promise of `addSequence`. Every mark on the board comes back
 * byte-identical, and no id the sequence brings collides with one already on it.
 */
{
  const board = fixtureAct('board')
  // Two phases of ONE drill: same ids, different poses. That is what a captured
  // sequence looks like, and it is what makes a token the same person on both.
  const drill = [fixtureAct('drill'), mapAct(shift(9, 4), fixtureAct('drill'))]
  const { acts, added } = addSequence([board, board, board], drill, 'sequence')

  if (acts.length !== 3) {
    fail('sequence add', `3 base phases produced ${acts.length} phases. It must produce 3.`)
  }

  for (const [i, out] of acts.entries()) {
    // Every original mark, still present and still exactly where it was.
    for (const t of board.tokens) {
      const now = out.tokens.find((x) => x.id === t.id)
      if (!now) fail('sequence add', `phase ${i + 1}: token ${t.id} was on the board and is gone.`)
      else if (now.x !== t.x || now.y !== t.y) {
        fail(
          'sequence add',
          `phase ${i + 1}: token ${t.id} moved from ${t.x},${t.y} to ${now.x},${now.y}. ` +
            `It must stay at ${t.x},${t.y}.`,
        )
      }
    }
    for (const g of board.gear ?? []) {
      const now = (out.gear ?? []).find((x) => x.id === g.id)
      if (!now || now.x !== g.x || now.y !== g.y) {
        fail(
          'sequence add',
          `phase ${i + 1}: gear ${g.id} was at ${g.x},${g.y} and is now ` +
            `${now ? `${now.x},${now.y}` : 'missing'}. It must stay at ${g.x},${g.y}.`,
        )
      }
    }
    for (const a of board.arrows) {
      if (!out.arrows.some((x) => x.id === a.id)) {
        fail('sequence add', `phase ${i + 1}: arrow ${a.id} was on the board and is gone.`)
      }
    }
    if (out.shot?.x !== board.shot.x || out.shot?.y !== board.shot.y) {
      fail(
        'sequence add',
        `phase ${i + 1}: the board's camera frame moved from ${board.shot.x},${board.shot.y} ` +
          `to ${out.shot?.x},${out.shot?.y}. A dropped sequence must not reframe the phase.`,
      )
    }
  }

  // No id the drill brought is an id the board already used.
  const boardIds = new Set([
    ...board.tokens.map((t) => t.id),
    ...(board.gear ?? []).map((g) => g.id),
    ...board.arrows.map((a) => a.id),
    ...board.bands.map((b) => b.id),
    ...(board.texts ?? []).map((t) => t.id),
    ...ballsOf(board).map((b) => b.id),
  ])
  for (const list of Object.values(added)) {
    for (const id of list) {
      if (boardIds.has(id)) {
        fail('sequence add', `the apply reused id ${id}, which the board already holds. Ids must be fresh.`)
      }
    }
  }

  // Every id `added` names is really on the board somewhere. That list is what
  // the editor hands to multi-select, so an id in it that is on no phase is a
  // mark the coach is told they have and cannot touch.
  const onPhase = new Set(
    acts.flatMap((a) => [
      ...a.tokens.map((t) => t.id),
      ...(a.gear ?? []).map((g) => g.id),
      ...a.arrows.map((x) => x.id),
      ...a.bands.map((b) => b.id),
      ...(a.texts ?? []).map((t) => t.id),
      ...ballsOf(a).map((b) => b.id),
    ]),
  )
  for (const [kind, list] of Object.entries(added)) {
    for (const id of list) {
      if (!onPhase.has(id)) {
        fail('sequence add', `\`added.${kind}\` names ${id}, which is not on the phase it was added to.`)
      }
    }
  }

  // And a group drag of the placement moves the drill and only the drill.
  const moved = mapMarks(shift(5, -3), acts[0], added)
  for (const t of board.tokens) {
    const was = acts[0].tokens.find((x) => x.id === t.id)
    const now = moved.tokens.find((x) => x.id === t.id)
    if (now.x !== was.x || now.y !== was.y) {
      fail(
        'placement drag',
        `dragging the placement moved board token ${t.id} from ${was.x},${was.y} to ${now.x},${now.y}. ` +
          `Only the sequence's own marks may move.`,
      )
    }
  }
  for (const id of added.tokens) {
    const was = acts[0].tokens.find((x) => x.id === id)
    const now = moved.tokens.find((x) => x.id === id)
    if (!was || !now) continue
    if (Math.abs(now.x - (was.x + 5)) > 1e-9 || Math.abs(now.y - (was.y - 3)) > 1e-9) {
      fail(
        'placement drag',
        `dragging +5,-3 left sequence token ${id} at ${p2(now.x)},${p2(now.y)}. ` +
          `It must be at ${p2(was.x + 5)},${p2(was.y - 3)}.`,
      )
    }
  }
}

/* ── 8 · A SEQUENCE ARRIVES ON THE GRASS IT WAS SAVED FROM ───────────────────*/
{
  const act = fixtureAct('cap')
  const seq = captureSequence('probe', [act], 0, 0, 'full', undefined, undefined, null, undefined)
  const full = viewFor({ pitch: 'full' })

  for (const v of PITCH_VIEW_LIST) {
    if (v.area) continue // a training board is a change of kind, not of crop
    const out = remapSequenceActs(seq, v.id, undefined, {})
    for (const [i, t] of out[0].tokens.entries()) {
      const src = seq.acts[0].tokens[i]
      const wasM = toMetres(full, src.x, src.y)
      const nowM = toMetres(v, t.x, t.y)
      if (Math.abs(nowM.x - wasM.x) > 1e-6 || Math.abs(nowM.y - wasM.y) > 1e-6) {
        fail(
          'sequence remap',
          `full -> ${v.id}: a token saved at ${m2(wasM.x)}m,${m2(wasM.y)}m arrived at ` +
            `${m2(nowM.x)}m,${m2(nowM.y)}m. It must arrive at ${m2(wasM.x)}m,${m2(wasM.y)}m.`,
        )
      }
    }

    // Mirrored, it is on the other flank of the SAME board — reflected about
    // the crop centre, not thrown off the edge of it.
    const flip = remapSequenceActs(seq, v.id, undefined, { flanks: true })
    for (const [i, t] of flip[0].tokens.entries()) {
      const plain = out[0].tokens[i]
      if (Math.abs(t.y - (100 - plain.y)) > 1e-9 || Math.abs(t.x - plain.x) > 1e-9) {
        fail(
          'sequence mirror',
          `${v.id} flanks: a token at ${p2(plain.x)},${p2(plain.y)} mirrored to ` +
            `${p2(t.x)},${p2(t.y)}. It must be ${p2(plain.x)},${p2(100 - plain.y)}.`,
        )
      }
    }
  }

  // placementTransform is what the dialog and the check both ask, so it must
  // agree with the acts remapSequenceActs actually produces.
  const t = placementTransform(seq, 'attacking-half', undefined, { ends: true })
  const viaActs = remapSequenceActs(seq, 'attacking-half', undefined, { ends: true })
  const src = seq.acts[0].tokens[0]
  const want = t.point({ x: src.x, y: src.y })
  const got = viaActs[0].tokens[0]
  if (Math.abs(want.x - got.x) > 1e-9 || Math.abs(want.y - got.y) > 1e-9) {
    fail(
      'sequence remap',
      `placementTransform gave ${p2(want.x)},${p2(want.y)} but remapSequenceActs produced ` +
        `${p2(got.x)},${p2(got.y)}. They must agree.`,
    )
  }
}

/* ── 9 · A SYSTEM WALK REACHES THE SYSTEM'S OWN MARKS ────────────────────────*/
{
  const sys = {
    v: 1,
    id: 'probe',
    title: 'probe',
    pitch: 'full',
    teams: { us: { fill: '#000' } },
    pitchLines: [{ id: 'pl1', kind: 'line', from: { x: 10, y: 10 }, to: { x: 30, y: 40 } }],
    acts: [fixtureAct('sys')],
  }
  const out = mapSystem(shift(4, 6), sys)
  const line = out.pitchLines[0]
  if (line.from.x !== 14 || line.from.y !== 16 || line.to.x !== 34 || line.to.y !== 46) {
    fail(
      'system walk',
      `pitchLines were not walked: from came out ${p2(line.from.x)},${p2(line.from.y)} and ` +
        `to ${p2(line.to.x)},${p2(line.to.y)}. They must be 14,16 and 34,46.`,
    )
  }
  if (mapSystem(KEEP, sys) !== sys) {
    fail('system walk', `mapSystem(KEEP, s) rebuilt the system. It must return it unchanged, by reference.`)
  }
}

/* ── the fixture, and how two acts are compared ──────────────────────────────*/

/**
 * One act carrying EVERY positional field the document format has, with a
 * distinct number in each so a field left behind by the walk is visible rather
 * than coincidentally correct.
 */
function fixtureAct(tag = 'f') {
  return {
    id: `${tag}-act`,
    title: `${tag} title`,
    caption: `${tag} caption`,
    shot: { x: 41, y: 37, w: 44, h: 52 },
    tokens: [
      { id: `${tag}-t1`, side: 'us', x: 23, y: 31, label: '6' },
      { id: `${tag}-t2`, side: 'them', x: 67, y: 72, label: '9' },
    ],
    ball: { x: 51, y: 49 },
    balls: [{ id: `${tag}-b1`, x: 51, y: 49 }],
    arrows: [
      { id: `${tag}-a1`, kind: 'pass', from: { x: 21, y: 29 }, to: { x: 63, y: 70 }, bend: 0.4 },
      { id: `${tag}-a2`, kind: 'run', from: { x: 40, y: 12 }, to: { x: 55, y: 18 } },
    ],
    bands: [
      { id: `${tag}-d1`, kind: 'zone', rect: { x: 12, y: 14, w: 26, h: 33 } },
      { id: `${tag}-d2`, kind: 'block', throughTokens: [`${tag}-t1`] },
    ],
    texts: [
      { id: `${tag}-x1`, x: 18, y: 82, text: 'press here', angle: 25, align: 'left' },
      { id: `${tag}-x2`, x: 74, y: 22, text: 'cover' },
    ],
    gear: [
      { id: `${tag}-g1`, kind: 'cone', x: 30, y: 60, angle: 40, flip: true },
      { id: `${tag}-g2`, kind: 'minigoal', x: 88, y: 44 },
    ],
  }
}

/** Every coordinate and bearing of two acts, reported with the value it should hold. */
function compareActs(group, want, got) {
  const num = (what, a, b) => {
    if (a === undefined && b === undefined) return
    if (a === undefined || b === undefined || Math.abs(a - b) > 1e-6) {
      fail(group, `${what} came out ${b === undefined ? 'undefined' : p2(b)}. It must be ${a === undefined ? 'undefined' : p2(a)}.`)
    }
  }
  const same = (what, a, b) => {
    if (a !== b) fail(group, `${what} came out ${String(b)}. It must be ${String(a)}.`)
  }

  want.tokens.forEach((t, i) => {
    num(`token ${t.id} x`, t.x, got.tokens[i]?.x)
    num(`token ${t.id} y`, t.y, got.tokens[i]?.y)
  })
  ballsOf(want).forEach((b, i) => {
    num(`ball ${b.id} x`, b.x, ballsOf(got)[i]?.x)
    num(`ball ${b.id} y`, b.y, ballsOf(got)[i]?.y)
  })
  want.arrows.forEach((a, i) => {
    const g = got.arrows[i]
    num(`arrow ${a.id} from.x`, a.from.x, g?.from.x)
    num(`arrow ${a.id} to.y`, a.to.y, g?.to.y)
    num(`arrow ${a.id} bend`, a.bend, g?.bend)
  })
  want.bands.forEach((b, i) => {
    if (!b.rect) return
    const g = got.bands[i]
    num(`band ${b.id} rect.x`, b.rect.x, g?.rect?.x)
    num(`band ${b.id} rect.w`, b.rect.w, g?.rect?.w)
  })
  ;(want.texts ?? []).forEach((t, i) => {
    const g = (got.texts ?? [])[i]
    num(`text ${t.id} x`, t.x, g?.x)
    num(`text ${t.id} angle`, t.angle, g?.angle)
    same(`text ${t.id} align`, t.align, g?.align)
  })
  ;(want.gear ?? []).forEach((m, i) => {
    const g = (got.gear ?? [])[i]
    num(`gear ${m.id} x`, m.x, g?.x)
    num(`gear ${m.id} angle`, m.angle, g?.angle)
    same(`gear ${m.id} flip`, Boolean(m.flip), Boolean(g?.flip))
  })
  num('shot x', want.shot.x, got.shot?.x)
  num('shot w', want.shot.w, got.shot?.w)
}

/* ── the punch list ──────────────────────────────────────────────────────────*/

if (faults.length === 0) {
  console.log(`check-transform: ok — ${PITCH_VIEW_LIST.length} views, every walk, every mirror.`)
  process.exit(0)
}

const groups = new Map()
for (const f of faults) {
  if (!groups.has(f.group)) groups.set(f.group, [])
  groups.get(f.group).push(f.line)
}

console.error(`check-transform: ${faults.length} fault${faults.length === 1 ? '' : 's'}\n`)
for (const [group, lines] of groups) {
  console.error(`  ${group}  (${lines.length})`)
  for (const line of lines.slice(0, 12)) console.error(`    · ${line}`)
  if (lines.length > 12) console.error(`    · … and ${lines.length - 12} more of the same shape`)
  console.error('')
}
process.exit(1)
