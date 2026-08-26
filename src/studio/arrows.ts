/**
 * What an arrow is attached to.
 *
 * WHY AN ARROW NEEDS THIS AND A BAND ALREADY HAD IT
 *
 * A `Band` of kind 'block' has never stored a shape. It stores the ids of the
 * players it threads through and works the outline out at render time, which is
 * why dragging the pivot moves the midfield screen instead of leaving it behind
 * on the grass. The comment in ../schema.ts is blunt about why: "there is no
 * such thing here as a frozen block".
 *
 * Arrows were the exception. They stored two points in percent, fixed at
 * wherever the drag happened to end, and a coach who then moved the right-back
 * two metres was left with an overlap arrow starting from where he used to be.
 * Every phase of a system is the same players in different places, so an
 * annotation that does not follow them is wrong on the second phase of anything.
 *
 * So an end can now name a player, and this module is where that naming is
 * read. Points remain for the ends that genuinely mean a piece of grass — a
 * through ball into space, a run to the back post, a press towards an area
 * rather than a man — and an arrow can have one of each, which is the common
 * case for a run.
 *
 * WHY THE POINT IS KEPT EVEN WHEN AN END IS BOUND
 *
 * It is the fallback, and it has to be a good one. A bound player can leave the
 * board: deleted, or simply absent from this phase, because acts do not all
 * carry the same squad. When that happens the arrow falls back to the last
 * place it was actually drawn, which is very close to where the coach wanted it
 * and is always a real position on the pitch. The alternative — dropping the
 * arrow, or collapsing it to a point — deletes a coach's work over a change
 * they did not connect to it.
 *
 * That is also why every writer of a bound end keeps the point up to date. See
 * `bindEnd`.
 */

import { toUnits, unitsToPercent, type PitchView } from './board/pitch'
import type { Arrow, ArrowKind } from './schema'

export interface Pt {
  x: number
  y: number
}

/** The shape this module needs off a token. Works on `Token` and `RenderToken`. */
export interface Placed {
  id: string
  x: number
  y: number
}

/**
 * The quadratic curve behind every arrow. `bend` is -1..1; the control point is
 * pushed off the midpoint along the perpendicular, so 0 is a straight line and
 * the sign picks which way it bows.
 */
export function arrowGeometry(a: Pt, b: Pt, bend = 0) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len
  const py = dx / len
  const off = bend * len * 0.28
  const c = { x: (a.x + b.x) / 2 + px * off, y: (a.y + b.y) / 2 + py * off }
  // Point at t=0.5 on the quadratic, where a label sits without fouling the line.
  const mid = { x: 0.25 * a.x + 0.5 * c.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * c.y + 0.25 * b.y }
  return { c, mid, len }
}

/**
 * How close a dragged end has to land, in metres, to take hold of a player.
 *
 * Measured in METRES rather than percent because percent is anisotropic: the
 * pitch is 105 long and 68 across, so the same percentage is half again as far
 * along the board as it is across it, and a snap radius in percent would be an
 * ellipse that grabs a man beside you and misses the one in front. `toUnits`
 * puts both axes in metre space, where a radius is a circle.
 *
 * 3.4m is a little over one and a half counters. Close enough that it cannot
 * fire on a player the coach was drawing past, generous enough that it does not
 * need a steady hand on a phone.
 */
export const SNAP_M = 3.4

/**
 * Where an arrow's two ends actually are, in percent, once bindings are read.
 *
 * `tokens` is whatever the caller is drawing: the act's own tokens when posing,
 * and the BLENDED tokens mid-move when playing back. That is the whole reason
 * this takes a list rather than an act — an arrow bound to a player follows him
 * through the tween for free, because the renderer hands us where he is right
 * now rather than where he starts.
 */
export function arrowEnds(
  arrow: Pick<Arrow, 'from' | 'to' | 'fromId' | 'toId'>,
  tokens: readonly Placed[],
): { from: Pt; to: Pt; fromBound: boolean; toBound: boolean } {
  const at = (id: string | undefined, fallback: Pt) => {
    if (!id) return { pt: fallback, bound: false }
    const t = tokens.find((tok) => tok.id === id)
    // A bound player who is not in this phase falls back to the drawn point.
    return t ? { pt: { x: t.x, y: t.y }, bound: true } : { pt: fallback, bound: false }
  }

  const a = at(arrow.fromId, arrow.from)
  const b = at(arrow.toId, arrow.to)
  return { from: a.pt, to: b.pt, fromBound: a.bound, toBound: b.bound }
}

/**
 * The player a point should take hold of, or null for a point on the grass.
 *
 * `exclude` keeps an arrow's two ends off the same man, which is not a mark
 * anybody means to make: a pass from a player to himself has no direction for
 * the head to point down, and the geometry divides by a length of zero.
 */
export function snapTarget(
  view: PitchView,
  pt: Pt,
  tokens: readonly Placed[],
  exclude?: string,
): string | null {
  const here = toUnits(view, pt.x, pt.y)
  let best: string | null = null
  // Units are metres × 10 (see `U` in ./board/pitch.ts), so the radius converts
  // by the same constant and the comparison stays in one space.
  let bestD = SNAP_M * 10

  for (const t of tokens) {
    if (t.id === exclude) continue
    const p = toUnits(view, t.x, t.y)
    const d = Math.hypot(p.x - here.x, p.y - here.y)
    if (d <= bestD) {
      bestD = d
      best = t.id
    }
  }
  return best
}

/**
 * Write one end of an arrow, binding it to a player or freeing it onto grass.
 *
 * The point is written EVERY time, bound or not. It is what the arrow falls
 * back to when the player is not in a phase (see the header), so an end that
 * updated the id and left a stale point behind would be storing a fallback
 * pointing at last week's position. One function, so that cannot be forgotten
 * at one of the call sites.
 */
export function bindEnd(arrow: Arrow, end: 'from' | 'to', pt: Pt, tokenId: string | null): Arrow {
  const next: Arrow = { ...arrow, [end]: pt }
  const key = end === 'from' ? 'fromId' : 'toId'
  if (tokenId) next[key] = tokenId
  else delete next[key]
  return next
}

// ── Which arrow a movement follows ──────────────────────────────────────────

/**
 * WHY A BENT ARROW HAS TO BEND THE MOVEMENT
 *
 * A coach who bows a pass round a defender has said something specific about
 * where the ball goes, and until now the studio drew the bow and then sent the
 * ball straight through it. The arrow was a promise the animation did not keep,
 * and on a phase where the bow is the entire idea — round the press, in behind
 * the full-back — the film contradicted the board it was made from.
 *
 * WHY MATCHING IS BY PROXIMITY AND NOT BY BINDING ALONE
 *
 * A bound arrow already names its player, so binding would be the obvious key.
 * But the thing that moves is very often NOT the thing the arrow names: a pass
 * arrow runs from passer to receiver while the BALL is what travels, starting a
 * couple of metres off the passer at their feet and finishing short of the
 * receiver. There is no id to join on there. And an arrow drawn by hand before
 * any of this existed has no bindings at all, yet a coach who bows one expects
 * the same thing to happen.
 *
 * So an arrow governs a movement when its two ends are nearer that movement's
 * two ends than any other candidate's are, it points the same way, and the
 * total miss is small. Bound arrows win that comparison on their own merits,
 * because their ends resolve exactly onto the players.
 *
 * WHY THE ENDS ARE RESOLVED AGAINST DIFFERENT ACTS
 *
 * An arrow's start means where the actor is NOW and its end means where the
 * target will BE, so the start resolves against the phase the arrow is drawn on
 * and the end against the phase it points at. Resolving both against the first
 * would score a pass to an overlapping full-back against where that full-back
 * was standing before the overlap, which is the one case the rule most needs to
 * get right.
 */

/** Kinds that move a player: the actor at the arrow's tail travels. */
export const TOKEN_KINDS: readonly ArrowKind[] = ['run', 'carry', 'press']

/** Kinds that move the ball on their own. A carry moves it by carrying it. */
export const BALL_KINDS: readonly ArrowKind[] = ['pass', 'switch']

/**
 * How far out an arrow's ends may be, in metres, summed over both, and still be
 * taken as describing a movement.
 *
 * Ten metres of total miss sounds loose and is not, because this is only ever a
 * FLOOR under a comparison that has already been won. The nearest candidate is
 * picked first; this decides whether the nearest is near enough to be about
 * this movement at all. The honest failure it guards against is a phase where
 * somebody bowed one arrow and moved a completely different player.
 */
export const GOVERN_M = 10

/** Where an arrow starts and finishes, each read off the act that gives it meaning. */
export function arrowSpan(
  arrow: Pick<Arrow, 'from' | 'to' | 'fromId' | 'toId'>,
  fromTokens: readonly Placed[],
  toTokens: readonly Placed[],
): { from: Pt; to: Pt } {
  const head = arrow.fromId ? fromTokens.find((t) => t.id === arrow.fromId) : undefined
  const tail = arrow.toId ? toTokens.find((t) => t.id === arrow.toId) : undefined
  return {
    from: head ? { x: head.x, y: head.y } : arrow.from,
    to: tail ? { x: tail.x, y: tail.y } : arrow.to,
  }
}

/**
 * The bow a coach drew over this movement, or 0 for a straight one.
 *
 * Zero is not a special case anywhere downstream: a quadratic whose control
 * point sits on the midpoint IS the straight chord, exactly, so an unbowed
 * movement animates down the same numbers it always has.
 */
export function bendOver(
  arrows: readonly Arrow[],
  fromTokens: readonly Placed[],
  toTokens: readonly Placed[],
  move: { from: Pt; to: Pt },
  kinds: readonly ArrowKind[],
  view: PitchView,
): number {
  const a0 = toUnits(view, move.from.x, move.from.y)
  const b0 = toUnits(view, move.to.x, move.to.y)
  const travelled = Math.hypot(b0.x - a0.x, b0.y - a0.y)
  // Nobody went anywhere, so there is no path to bow.
  if (travelled < 1) return 0

  let best = 0
  let bestScore = GOVERN_M * 10

  for (const arrow of arrows) {
    if (!arrow.bend) continue
    if (!kinds.includes(arrow.kind)) continue

    const span = arrowSpan(arrow, fromTokens, toTokens)
    const ua = toUnits(view, span.from.x, span.from.y)
    const ub = toUnits(view, span.to.x, span.to.y)

    // Pointing the same way. Without this an arrow drawn back down the line of
    // a movement would bow it to the wrong side, which is worse than straight.
    if ((ub.x - ua.x) * (b0.x - a0.x) + (ub.y - ua.y) * (b0.y - a0.y) <= 0) continue

    const score = Math.hypot(ua.x - a0.x, ua.y - a0.y) + Math.hypot(ub.x - b0.x, ub.y - b0.y)
    if (score < bestScore) {
      bestScore = score
      best = arrow.bend
    }
  }
  return best
}

/**
 * Travel from `a` to `b` at `t`, bowing by `bend`. Percent in, percent out.
 *
 * IN UNITS IN THE MIDDLE, which is the whole reason this is not four lines at
 * the call site. Percent is percent-of-crop along each axis and the crop is not
 * square, so a perpendicular measured there points somewhere the arrow does not
 * bow: the ball would leave the line it was drawn to follow, by more the more
 * the crop departs from square. Units are metre space, where the curve on the
 * screen and the curve in the arithmetic are the same curve.
 *
 * `arrowGeometry` supplies the control point, so this is not a second opinion
 * about what `bend` means — it is the same one the arrow was drawn with.
 */
export function travel(a: Pt, b: Pt, bend: number, t: number, view: PitchView): Pt {
  if (!bend) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }

  const ua = toUnits(view, a.x, a.y)
  const ub = toUnits(view, b.x, b.y)
  const { c } = arrowGeometry(ua, ub, bend)

  const it = 1 - t
  const x = it * it * ua.x + 2 * it * t * c.x + t * t * ub.x
  const y = it * it * ua.y + 2 * it * t * c.y + t * t * ub.y
  return unitsToPercent(view, x, y)
}
