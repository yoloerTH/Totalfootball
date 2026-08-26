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

import { toUnits, type PitchView } from './board/pitch'
import type { Arrow } from './schema'

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
