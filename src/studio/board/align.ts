/**
 * Lining a dragged mark up with the ones already on the board.
 *
 * ── WHERE IT CAME FROM ───────────────────────────────────────────────────────
 *
 * A coach, in as many words: "when you place mannequins or players, let it snap
 * them into the same plane by itself." A back four that is level, three
 * mannequins in one line across the pitch, a row of cones in one channel — all
 * of it is currently done by eye, and by eye at 100% zoom a metre of grass is
 * eight pixels. The line is never quite a line, and on the exported film it
 * reads as sloppiness rather than as a defensive line.
 *
 * ── THE THREE THINGS THIS GETS RIGHT, AND WHY EACH IS NOT OBVIOUS ────────────
 *
 * 1 · IT WORKS IN METRES, NOT PERCENT. Marks are stored as percent of the crop
 *     (see ../schema.ts) and the percent axes are not square: on the full pitch
 *     1% of x is 1.05m and 1% of y is 0.68m, and on `attacking-box` they are
 *     different numbers again. A tolerance stated in percent would mean a
 *     different amount of grass on every board and a different amount along
 *     each axis of the same board. ../arrows.ts learned this already — see
 *     SNAP_M there — and this module follows it.
 *
 * 2 · THE TOLERANCE IS DERIVED FROM SCREEN PIXELS. This is the one that decides
 *     whether the feature feels like help or like a fight. The studio zooms to
 *     600%, and a tolerance fixed in metres would swallow a whole penalty area
 *     at that zoom: the coach who zoomed in precisely IN ORDER to place
 *     something 30cm off a line would find they no longer could. A tolerance
 *     that is always about seven pixels of screen is the same size to the hand
 *     at every zoom, which is what every drawing tool that has ever felt right
 *     does. See `snapTolerance`.
 *
 * 3 · IT ASSIGNS THE PARTNER'S OWN STORED NUMBER, having compared in metres.
 *     Round-tripping percent → metres → percent lands a ulp or two away, so a
 *     line of five men snapped one at a time would be five almost-equal
 *     numbers, and the check script could only ever assert "close". Copying the
 *     partner's percent coordinate across makes the alignment EXACT in the
 *     document: it survives `remap` to another pitch view (a linear map per
 *     axis takes equal to equal), it survives the tween, and it is assertable.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ─────────────────────────────────────────
 *
 * It snaps to OTHER MARKS only — not to the pitch's own lines, not to the ruled
 * grid, not to a fixed metre lattice. That was the coach's ask taken literally
 * ("put them in the same plane as each other") and it is the version with no
 * false positives: every line it offers is one the coach built themselves.
 *
 * There is no even-spacing pass and no angle matching here. Both are real and
 * both are wanted for a mannequin wall; neither is this module's job, and they
 * are additions to it rather than rewrites of it.
 */

import { toMetres, U, type PitchView } from './pitch'

/** A mark a dragged thing can line up with: a counter, the ball, a cone. */
export interface Alignable {
  id: string
  /** Percent of the crop — the space every mark is stored in. */
  x: number
  y: number
}

/**
 * A line the board should draw while it is holding a mark on it.
 *
 * Stated in METRES and not in board units, because the quarter turn an upright
 * view applies lives in `metresToUnits` and nowhere else (../board/pitch.ts).
 * Handing the board metres means a guide comes out horizontal on a horizontal
 * pitch and vertical on an upright one with nothing here knowing which.
 */
export interface SnapGuide {
  /**
   * Which coordinate the marks share.
   *
   * 'x' is a line ACROSS the pitch — a back four level with each other. 'y' is
   * a line ALONG it — a full-back and a winger in the same channel.
   */
  axis: 'x' | 'y'
  /** The shared coordinate, in metres. */
  at: number
  /** How far the line runs along the OTHER axis, in metres. */
  from: number
  to: number
}

export interface Snapped {
  /** Percent, ready to be written to the mark. */
  x: number
  y: number
  /** Empty when nothing was near enough. */
  guides: SnapGuide[]
}

/**
 * How close the pointer has to be, in screen pixels, before a line takes it.
 *
 * Seven is about a third of a fingertip and about a fifth of a counter at 100%.
 * Bigger and a coach placing somebody deliberately a yard off a line gets
 * pulled onto it; smaller and the line is as hard to hit as it was by eye,
 * which is the whole complaint.
 */
export const SNAP_PX = 7

/** What to use when the board cannot be measured. About a metre on a full pitch. */
export const FALLBACK_TOL_M = 0.9

/** Two marks nearer than this on one axis are ON the same line, for the guide's span. */
const SAME_LINE_M = 0.02

/** How far the drawn guide runs past the outermost mark on it. */
const OVERHANG_M = 2.4

/**
 * The snap tolerance in metres, for the board as it is on screen right now.
 *
 * The zoom is a CSS transform on a wrapper around the <svg> (see the workspace
 * notes in ../editor/StudioEditor.tsx), so `getBoundingClientRect` already
 * carries it — there is nothing here that has to know the zoom exists. Same
 * route `clientToPercent` takes, for the same reason.
 */
export function snapTolerance(svg: SVGSVGElement | null): number {
  if (!svg) return FALLBACK_TOL_M
  const rect = svg.getBoundingClientRect()
  const vb = svg.viewBox.baseVal
  if (!vb || vb.width === 0 || vb.height === 0 || rect.width === 0 || rect.height === 0) {
    return FALLBACK_TOL_M
  }
  // `meet` letterboxes, so the smaller of the two ratios is the live scale.
  const scale = Math.min(rect.width / vb.width, rect.height / vb.height)
  if (!(scale > 0)) return FALLBACK_TOL_M
  // px → board units → metres. U units to the metre, always.
  return SNAP_PX / (scale * U)
}

/**
 * Pull a proposed position onto the lines of the marks around it.
 *
 * `at` is where the drag would have put the mark — already offset by the grab
 * and already clamped by the caller. The two axes are decided independently, so
 * a man can come level with the centre-half and stay where the coach put him
 * down the pitch, which is the common case and the reason not to snap to a
 * point.
 *
 * `others` must not contain the mark being dragged. Nothing here checks: a mark
 * is always within nothing of itself, so it would win both axes and pin the
 * drag to its own starting position.
 */
export function alignSnap(
  view: PitchView,
  at: { x: number; y: number },
  others: Alignable[],
  tolM: number,
): Snapped {
  const none: Snapped = { x: at.x, y: at.y, guides: [] }
  if (!(tolM > 0) || others.length === 0) return none

  const me = toMetres(view, at.x, at.y)
  const marks = others.map((o) => ({ o, m: toMetres(view, o.x, o.y) }))

  /** The nearest mark on one axis, if any is inside the tolerance. */
  const nearest = (axis: 'x' | 'y') => {
    let best: { o: Alignable; m: { x: number; y: number }; d: number } | null = null
    for (const c of marks) {
      const d = Math.abs(c.m[axis] - me[axis])
      // Strictly less than, so the first of two equidistant marks wins and the
      // same drag always resolves the same way.
      if (d <= tolM && (!best || d < best.d)) best = { ...c, d }
    }
    return best
  }

  let bx = nearest('x')
  let by = nearest('y')

  /*
   * BOTH AXES AT ONCE CAN LAND ON TOP OF SOMEBODY, AND MUST NOT.
   *
   * Snapping x puts the dragged mark on a line; snapping y as well puts it on a
   * second one, and where those two cross there may be a man. He would be
   * underneath the counter in the coach's hand — name, face and all — and
   * nothing about a drag towards a corner means "hide him".
   *
   * THE TEST IS POSITIONAL AND NOT BY IDENTITY, which is the version of this
   * that survives a real board. Asking "did both axes pick the same mark" looks
   * equivalent and is not: a back three all share one x, so a drag near the
   * middle of it snaps x to the FIRST of them and y to the SECOND, two
   * different marks, and lands precisely on top of the second. Only the
   * arithmetic catches that (check-align.mjs, claim 2c).
   *
   * The tolerance is the right radius to test against, because the snap can
   * only have moved the mark by that much: anything closer than that was the
   * coach's own aim, not this function's doing. It scales with the zoom for
   * free, so a coach who zoomed to 600% to lay two cones a hand apart is not
   * told they may not.
   *
   * The weaker axis is the one let go. Two different marks, crossing on empty
   * grass, is a corner — level with one, in the channel of another — and is
   * exactly what should be offered.
   */
  if (bx && by) {
    const at2 = toMetres(view, bx.o.x, by.o.y)
    const onTop = marks.some((c) => Math.hypot(c.m.x - at2.x, c.m.y - at2.y) <= tolM)
    if (onTop) {
      if (bx.d <= by.d) by = null
      else bx = null
    }
  }

  if (!bx && !by) return none

  const x = bx ? bx.o.x : at.x
  const y = by ? by.o.y : at.y
  // Where the mark has actually ended up, for the guides to reach to.
  const landed = toMetres(view, x, y)

  const guides: SnapGuide[] = []
  const line = (axis: 'x' | 'y', atM: number) => {
    const other = axis === 'x' ? 'y' : 'x'
    // Everyone already ON this line, so a guide through a back four is drawn
    // through all four rather than only through the pair being dragged.
    const on = marks.filter((c) => Math.abs(c.m[axis] - atM) <= SAME_LINE_M).map((c) => c.m[other])
    on.push(landed[other])
    guides.push({
      axis,
      at: atM,
      from: Math.min(...on) - OVERHANG_M,
      to: Math.max(...on) + OVERHANG_M,
    })
  }
  if (bx) line('x', bx.m.x)
  if (by) line('y', by.m.y)

  return { x, y, guides }
}
