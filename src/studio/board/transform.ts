/**
 * ONE walk over everything on a board that has a position.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 *
 * Percent coordinates are measured on the CROP (./pitch.ts, `toMetres`), so any
 * time the crop changes — a pitch view switch, a set piece laying its own board
 * down, a saved sequence arriving from a view it was not captured on — every
 * mark has to be re-expressed. That is one idea. It was written out four times:
 *
 *  · `remapSystem`   in ../editor/StudioEditor.tsx
 *  · `remapAct`      in ../sequences.ts
 *  · `denormaliseAct` in ../sequences.ts
 *  · `normaliseAct`   in ../sequences.ts
 *
 * and they had already drifted apart. Three of them walked `texts` and `gear`;
 * the one the PITCH PICKER uses did not, and none of them walked `act.shot`. So
 * changing from the full pitch to their box moved a cone on the penalty spot
 * 7.8 metres — off the pitch — while moving the player standing next to it
 * correctly, because the two were carried by different code.
 *
 * A transform is now a value, and there is one function that applies it. A new
 * positional field is added to `Act` in ../schema.ts and to `mapAct` below, and
 * every caller gets it. scripts/check-transform.mjs fails the build if a field
 * is added to the schema and not to the walk, so this cannot rot back.
 *
 * ── WHAT A TRANSFORM IS ──────────────────────────────────────────────────────
 *
 * `point` moves a percent-of-crop coordinate. That is most of it. The rest is
 * the handful of fields that are not positions but which a REFLECTION still has
 * to correct — a bowed pass bows the other way in a mirror, a mini goal facing
 * the near post faces the far one, right-aligned writing becomes left-aligned.
 * A transform that only moved points would mirror a drill into a mirror of
 * itself with the equipment still pointing the old way.
 *
 * ── THE TWO AXES, IN A COACH'S WORDS ─────────────────────────────────────────
 *
 * Percent x runs along the pitch's LENGTH and percent y across its WIDTH, on
 * every view, upright or not (see `metresToUnits`: the quarter turn lives in
 * the drawing, never in the stored numbers). So:
 *
 *  · `flanks` mirrors percent y — left wing becomes right wing.
 *  · `ends`   mirrors percent x — the attacking half becomes the defending one.
 *
 * Named that way rather than "horizontal"/"vertical" because those words mean
 * opposite things on the upright boards, and a coach saying "put it on the
 * other side" means a flank on every board there is.
 */

import type { Act, Arrow, Band, GearMark, System, TextMark, Token } from '../schema'
import { ballFields, ballsOf } from '../schema'
import type { PitchView } from './pitch'
import { remap } from './pitch'

export interface Point {
  x: number
  y: number
}

/**
 * A change of coordinates, plus what it does to the marks that carry a bearing.
 *
 * `point` is required and is the whole of a crop change. The rest are only ever
 * set by a mirror, and default to "unchanged", so an ordinary remap costs
 * nothing and reads as what it is.
 */
export interface MarkTransform {
  /** Percent-of-crop in, percent-of-crop out. */
  point: (p: Point) => Point
  /**
   * True when the transform reverses handedness — one mirror, not two.
   *
   * A curved pass is stored as a signed bow (`Arrow.bend`), and the sign is
   * about which side of the line it swings. Reflect the line and it swings the
   * other way, so the sign has to turn over. Mirror BOTH axes and you have
   * turned the board round rather than reflected it: handedness is restored,
   * the bow is unchanged, and this is false.
   */
  mirrored?: boolean
  /**
   * What the transform does to an on-screen bearing, for `TextMark.angle` and
   * `GearMark.angle`.
   *
   * Both are applied in FINAL SVG units — after the quarter turn — so they are
   * screen angles, and a mirror expressed in percent lands on a different screen
   * axis depending on whether the board is upright. `mirrorTransform` works that
   * out once; nothing downstream has to know which way the board is standing.
   *
   *  · 'none'  — leave bearings alone.
   *  · 'h'     — reflected about a VERTICAL screen axis: θ → −θ.
   *  · 'v'     — reflected about a HORIZONTAL screen axis: θ → 180 − θ.
   *  · 'turn'  — rotated 180°, no reflection: θ → θ + 180.
   */
  bearing?: 'none' | 'h' | 'v' | 'turn'
}

/** The identity. Returned rather than null so callers never branch. */
export const KEEP: MarkTransform = { point: (p) => ({ x: p.x, y: p.y }) }

/* ── BUILDING TRANSFORMS ─────────────────────────────────────────────────── */

/**
 * Re-express percent from one crop in another. The pitch picker's whole job.
 *
 * Returns `KEEP` when the two views are the same object, which is the common
 * case and which callers rely on to short-circuit a document rebuild — see
 * `viewFor`'s memo in ./pitch.ts for why identity is the right test.
 */
export function viewTransform(from: PitchView, to: PitchView): MarkTransform {
  if (from === to) return KEEP
  return { point: (p) => remap(from, to, p.x, p.y) }
}

/**
 * Mirror about the CROP's own centre, on either axis or both.
 *
 * ── WHY THE CROP CENTRE AND NOT THE PITCH CENTRE ─────────────────────────────
 *
 * On the full pitch they are the same point. On `attacking-half` they are not:
 * the pitch's centre is off the left edge of the board, so mirroring about it
 * would throw the drill into the half the coach cannot see. Mirroring about the
 * crop centre is "the other side of the board I am looking at", which is what
 * the words mean, and it keeps everything in frame on every view. In percent
 * that is simply `100 − p`, which is why this needs no view to do the points.
 *
 * It needs the view for the BEARINGS, though, and only for those: percent y is
 * a screen-horizontal mirror on an upright board and a screen-vertical one on a
 * flat board. See `MarkTransform.bearing`.
 */
export function mirrorTransform(
  view: PitchView,
  axes: { ends?: boolean; flanks?: boolean },
): MarkTransform {
  const { ends = false, flanks = false } = axes
  if (!ends && !flanks) return KEEP

  // Which SCREEN axis each percent mirror shows up as. Upright boards swap
  // them; `flip` does not enter into it, because a flip is a rotation and a
  // rotation cannot turn a horizontal reflection into a vertical one.
  const endsScreen: 'h' | 'v' = view.vertical ? 'v' : 'h'
  const flanksScreen: 'h' | 'v' = view.vertical ? 'h' : 'v'

  const bearing: MarkTransform['bearing'] =
    ends && flanks ? 'turn' : ends ? endsScreen : flanksScreen

  return {
    point: (p) => ({ x: ends ? 100 - p.x : p.x, y: flanks ? 100 - p.y : p.y }),
    // Two reflections are a rotation. One is a reflection.
    mirrored: ends !== flanks,
    bearing,
  }
}

/**
 * Percent-of-crop → 0–100 inside a rectangle of it, and back.
 *
 * What a region-captured sequence is stored in (../sequences.ts). `into` is the
 * capture direction, `outOf` the placement direction, and they are inverses, so
 * capturing a rondo out of one corner and dropping it into another is one
 * `compose` rather than two hand-written loops that have to agree.
 */
export function intoRegion(r: { x: number; y: number; w: number; h: number }): MarkTransform {
  return { point: (p) => ({ x: ((p.x - r.x) / r.w) * 100, y: ((p.y - r.y) / r.h) * 100 }) }
}

export function outOfRegion(r: { x: number; y: number; w: number; h: number }): MarkTransform {
  return { point: (p) => ({ x: r.x + (p.x / 100) * r.w, y: r.y + (p.y / 100) * r.h }) }
}

/** Translate by a percent offset. What dragging a placed sequence does. */
export function shift(dx: number, dy: number): MarkTransform {
  if (dx === 0 && dy === 0) return KEEP
  return { point: (p) => ({ x: p.x + dx, y: p.y + dy }) }
}

/**
 * Run transforms in order, left to right, as one.
 *
 * The bearings combine the way the reflections do rather than the way the last
 * one says: a flank mirror followed by an end mirror is a 180° turn, and a
 * caller that composed them and took the second's bearing would leave every
 * mini goal in the drill facing backwards. So handedness is counted and the
 * screen axis is only kept while exactly one reflection is in play.
 */
export function compose(...ts: MarkTransform[]): MarkTransform {
  const live = ts.filter((t) => t !== KEEP)
  if (live.length === 0) return KEEP
  if (live.length === 1) return live[0]

  let reflections = 0
  let axis: 'h' | 'v' | null = null
  let turns = 0
  for (const t of live) {
    if (t.mirrored) reflections++
    if (t.bearing === 'h' || t.bearing === 'v') {
      // Two reflections about perpendicular axes make a half turn; two about
      // the same axis make nothing.
      if (axis === null) axis = t.bearing
      else {
        if (axis !== t.bearing) turns++
        axis = null
      }
    } else if (t.bearing === 'turn') turns++
  }

  const bearing: MarkTransform['bearing'] =
    axis ?? (turns % 2 === 1 ? 'turn' : 'none')

  return {
    point: (p) => live.reduce((acc, t) => t.point(acc), p),
    mirrored: reflections % 2 === 1,
    bearing,
  }
}

/* ── APPLYING THEM ───────────────────────────────────────────────────────── */

/** A bearing in degrees, put through the transform. Absent stays absent. */
function turnAngle(t: MarkTransform, angle: number | undefined): number | undefined {
  if (angle === undefined) return undefined
  const b = t.bearing ?? 'none'
  if (b === 'none') return angle
  const next = b === 'h' ? -angle : b === 'v' ? 180 - angle : angle + 180
  // Kept in 0–360 so the stored number stays the one a coach would read off a
  // protractor, and so a mirror applied twice comes back to the same string.
  const wrapped = ((next % 360) + 360) % 360
  return wrapped === 0 ? 0 : wrapped
}

/** Left-aligned writing reflects to right-aligned, and only about a screen-x axis. */
function turnAlign(t: MarkTransform, align: string | undefined): string | undefined {
  if (!align || t.bearing !== 'h') return align
  if (align === 'left') return 'right'
  if (align === 'right') return 'left'
  return align
}

export function mapToken<T extends Token>(t: MarkTransform, tok: T): T {
  return { ...tok, ...t.point(tok) }
}

export function mapArrow(t: MarkTransform, a: Arrow): Arrow {
  const out: Arrow = { ...a, from: t.point(a.from), to: t.point(a.to) }
  if (t.mirrored && a.bend) out.bend = -a.bend
  return out
}

/**
 * A band's rectangle, through the transform.
 *
 * The two CORNERS are mapped and the box rebuilt from them, rather than the
 * origin being moved and the size kept: percent is not the same number of
 * metres per axis on two different crops, so a 20m square on the full pitch is
 * not a 20m square's worth of percent on their box. Normalised afterwards
 * because a mirror hands back a rectangle with negative width, and every reader
 * of `rect` — the drawing, the marquee, the print sheet — assumes it grows
 * right and down.
 *
 * A `block` band has no rect at all: it names its players and is worked out at
 * render time, so it follows them through any transform for free.
 */
export function mapBand(t: MarkTransform, b: Band): Band {
  if (!b.rect) return b
  const a1 = t.point({ x: b.rect.x, y: b.rect.y })
  const a2 = t.point({ x: b.rect.x + b.rect.w, y: b.rect.y + b.rect.h })
  return {
    ...b,
    rect: {
      x: Math.min(a1.x, a2.x),
      y: Math.min(a1.y, a2.y),
      w: Math.abs(a2.x - a1.x),
      h: Math.abs(a2.y - a1.y),
    },
  }
}

export function mapText(t: MarkTransform, m: TextMark): TextMark {
  const out: TextMark = { ...m, ...t.point(m) }
  const angle = turnAngle(t, m.angle)
  if (angle === undefined) delete out.angle
  else out.angle = angle
  const align = turnAlign(t, m.align)
  if (align === undefined) delete out.align
  else out.align = align
  return out
}

/**
 * Gear, through the transform.
 *
 * `flip` is a screen-horizontal mirror of the picture and `angle` turns it, so
 * between them they cover every orientation a mini goal can be in (see
 * `GearMark.flip`). A reflection therefore toggles the flip AND turns the
 * bearing — one without the other leaves a goal facing into the touchline.
 * `turnAngle` handles the 'v' case by folding the extra half turn into the
 * angle, which is why 'v' does not need a second flip.
 */
export function mapGear(t: MarkTransform, g: GearMark): GearMark {
  const out: GearMark = { ...g, ...t.point(g) }
  const angle = turnAngle(t, g.angle)
  if (angle === undefined) delete out.angle
  else out.angle = angle
  if (t.mirrored) {
    if (g.flip) delete out.flip
    else out.flip = true
  }
  return out
}

/**
 * A camera frame, through the transform.
 *
 * The one the four hand-written copies all forgot. `Shot` is four percent
 * numbers — a centre and the box that must be in shot (../schema.ts) — so it
 * moves exactly like a band's rect, except that the centre is the anchor rather
 * than a corner. A shot left alone across a view change frames grass at the
 * other end of the pitch, and the fault only shows up in the exported film.
 */
export function mapShot(
  t: MarkTransform,
  s: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  const c = t.point({ x: s.x, y: s.y })
  const a1 = t.point({ x: s.x - s.w / 2, y: s.y - s.h / 2 })
  const a2 = t.point({ x: s.x + s.w / 2, y: s.y + s.h / 2 })
  return { x: c.x, y: c.y, w: Math.abs(a2.x - a1.x), h: Math.abs(a2.y - a1.y) }
}

/**
 * EVERY positional field of an act, in one pass.
 *
 * THE LIST BELOW IS THE CONTRACT. Anything in `Act` that holds a percent
 * coordinate is here, and scripts/check-transform.mjs re-derives that list from
 * ../schema.ts and fails if the two disagree. Add a field to the schema, add it
 * here, or the build tells you which one you forgot.
 *
 * `texts` and `gear` stay `undefined` when they were undefined: every act
 * written before those existed has no such key, and writing an empty array onto
 * one would put a change into the diff of every document a coach owns.
 */
export function mapAct(t: MarkTransform, act: Act): Act {
  if (t === KEEP) return act
  const out: Act = {
    ...act,
    tokens: act.tokens.map((tk) => mapToken(t, tk)),
    ...ballFields(ballsOf(act).map((b) => ({ ...b, ...t.point(b) }))),
    arrows: act.arrows.map((a) => mapArrow(t, a)),
    bands: act.bands.map((b) => mapBand(t, b)),
  }
  if (act.texts) out.texts = act.texts.map((m) => mapText(t, m))
  if (act.gear) out.gear = act.gear.map((g) => mapGear(t, g))
  if (act.shot) out.shot = mapShot(t, act.shot)
  return out
}

/**
 * Every mark in a system, through the transform.
 *
 * `pitchLines` are on the SYSTEM rather than on a phase — they are the coach's
 * own permanent markings — so they are walked here and not in `mapAct`.
 */
export function mapSystem(t: MarkTransform, s: System): System {
  if (t === KEEP) return s
  const out: System = { ...s, acts: s.acts.map((a) => mapAct(t, a)) }
  if (s.pitchLines) out.pitchLines = s.pitchLines.map((ar) => mapArrow(t, ar))
  return out
}

/**
 * The marks a selection names, and nothing else.
 *
 * `mapAct` moves the whole board; this moves a chosen handful of it. What it is
 * for is a sequence that has just been dropped: the coach drags it into place,
 * and the drag has to reach the phases they are NOT looking at, because a drill
 * is several phases and sliding only the one on screen would leave the pattern
 * torn in half. Everything not named comes back by reference, so a phase with
 * nothing selected on it is not even rebuilt.
 *
 * The id lists are the shape `multiSelect` in ../editor/StudioEditor.tsx uses —
 * arrows and bands share `marks`, because a marquee cannot tell you which of
 * the two you dragged a box round and does not need to.
 */
export interface MarkIds {
  tokens: string[]
  gear: string[]
  balls: string[]
  texts: string[]
  marks: string[]
}

export function mapMarks(t: MarkTransform, act: Act, ids: MarkIds): Act {
  if (t === KEEP) return act
  const tokens = new Set(ids.tokens)
  const gear = new Set(ids.gear)
  const balls = new Set(ids.balls)
  const texts = new Set(ids.texts)
  const marks = new Set(ids.marks)

  const hits =
    act.tokens.some((x) => tokens.has(x.id)) ||
    (act.gear ?? []).some((x) => gear.has(x.id)) ||
    ballsOf(act).some((x) => balls.has(x.id)) ||
    (act.texts ?? []).some((x) => texts.has(x.id)) ||
    act.arrows.some((x) => marks.has(x.id)) ||
    act.bands.some((x) => marks.has(x.id))
  if (!hits) return act

  const out: Act = {
    ...act,
    tokens: act.tokens.map((x) => (tokens.has(x.id) ? mapToken(t, x) : x)),
    ...ballFields(ballsOf(act).map((x) => (balls.has(x.id) ? { ...x, ...t.point(x) } : x))),
    arrows: act.arrows.map((x) => (marks.has(x.id) ? mapArrow(t, x) : x)),
    bands: act.bands.map((x) => (marks.has(x.id) ? mapBand(t, x) : x)),
  }
  if (act.texts) out.texts = act.texts.map((x) => (texts.has(x.id) ? mapText(t, x) : x))
  if (act.gear) out.gear = act.gear.map((x) => (gear.has(x.id) ? mapGear(t, x) : x))
  return out
}
