/**
 * Pitch geometry, in real metres.
 *
 * The videos' board (editor/src/components/football/TacticsBoard.tsx) draws its
 * markings as four hand-tuned sets of percentages — `fy(25)` for the penalty
 * area, `fx(9)` for the centre circle radius, and so on. That was the right
 * call there: each short needed its own framing and the numbers were eyeballed
 * once against a reference.
 *
 * It is the wrong call here, because a coach will switch pitch view mid-system
 * and the two views must agree about where the penalty spot is. So this file
 * describes ONE pitch, at IFAB dimensions, in metres — and a "view" is just a
 * crop window onto it. The markings are drawn once, in metre space; the
 * viewBox decides what you see. Adding a view is four numbers, and it cannot
 * disagree with the others because there is nothing to disagree with.
 *
 * COORDINATE SPACES, of which there are three. Keep them straight:
 *
 *  · metres  — the pitch itself. x: 0 = left goal line → 105 = right goal line.
 *              y: 0 = top touchline → 68 = bottom touchline.
 *  · units   — SVG user units, metres × U. Exists only so stroke widths are
 *              readable numbers rather than 0.12.
 *  · percent — what a token stores: 0–100 across the VISIBLE crop, both axes.
 *              Percent is relative to the view, not the pitch, because that is
 *              what the coach is dragging in. `toMetres` is the bridge.
 */

/** IFAB's preferred dimensions for a professional pitch. */
export const PITCH = { length: 105, width: 68 } as const

/** SVG user units per metre. Cosmetic: keeps stroke widths off the decimals. */
export const U = 10

/** Every marking on a pitch, in metres. Do not re-pick these by eye. */
export const MARK = {
  /** Line width. Real pitch lines are 12cm. */
  line: 0.12,
  goalWidth: 7.32,
  /** How far the goal frame is drawn behind the line. Cosmetic. */
  goalDepth: 2,
  sixDepth: 5.5,
  sixWidth: 18.32,
  penDepth: 16.5,
  penWidth: 40.32,
  penSpot: 11,
  /** Centre circle and the penalty arc share this radius. */
  circle: 9.15,
  corner: 1,
} as const

export type PitchViewId =
  | 'full'
  | 'full-vertical'
  | 'attacking-half'
  | 'defending-half'
  | 'attacking-box'

export interface PitchView {
  id: PitchViewId
  label: string
  /** One line for the picker, in the coach's language rather than ours. */
  hint: string
  /** What a coach would actually use it for. Shown under the picker. */
  useFor: string
  /** The crop window, in metres. */
  x0: number
  x1: number
  y0: number
  y1: number
  /**
   * Turn the board a quarter turn so the pitch runs UP the screen and we attack
   * towards the top. Everything is still authored in the same metre space — see
   * `metresToUnits`, which is the only place the quarter turn exists.
   */
  vertical?: boolean
  /**
   * Grass beyond the crop, in metres, per PITCH axis (x is along the length, y
   * across the width — the turn does not enter into it). Defaults to `PAD` on
   * both, which is what every view in the picker uses.
   *
   * It exists for the video exporter, which has to hand the board a frame of a
   * fixed shape and wants the grass to reach all four edges of it. Widening the
   * crop is the honest way to do that: the pitch keeps its proportions and the
   * coach's players stay on the patch of grass they were put on, because
   * `x0..x1` — the space percent coords are measured in — never moves. Scaling
   * the board to cover the frame instead would crop players off the sides.
   *
   * Must stay SYMMETRIC about the crop centre. `cropCentre` is the point an
   * upright view turns about, and lopsided padding would swing the framing
   * round with the quarter turn.
   */
  pad?: { x: number; y: number }
}

/**
 * The views, and where each one comes from.
 *
 * These are not invented. Across the 108 tactics shorts in the Remotion project
 * there are exactly three sets of pitch markings, and this is all of them:
 *
 *  · `PitchMarkings`      — half pitch, goal on the right    → 72 shorts
 *  · `FullPitchH`         — full pitch, horizontal           → 22 shorts
 *  · `FullPitchMarkings`  — full pitch, VERTICAL             → 17 shorts
 *
 * There has never been a "third" as its own pitch. Every close-up in the
 * library is the half-pitch board with the camera pushed in (`scale: 2.0–2.5`
 * in TacticsBoard's `Camera`), which lands on roughly the box and its
 * approaches — that is what `attacking-box` is, and why it is cropped to 31m
 * rather than a tidy 35m third. A middle third was offered here for a while and
 * corresponds to nothing we have ever published; it is gone.
 *
 * Every horizontal view puts the ATTACKED goal on the right — a coach reads
 * left-to-right as forward progress. `defending-half` is not an exception: it
 * means the crop sits on the half containing OUR goal, so we are still playing
 * left-to-right, our goal is simply the one now on screen.
 */
export const PITCH_VIEWS: Record<PitchViewId, PitchView> = {
  full: {
    id: 'full',
    label: 'Full pitch',
    hint: 'Both goals, end to end.',
    useFor: 'Team shape, transitions, how the whole side slides across.',
    x0: 0,
    x1: 105,
    y0: 0,
    y1: 68,
  },
  'full-vertical': {
    id: 'full-vertical',
    label: 'Full pitch (upright)',
    hint: 'Both goals, played up the screen.',
    useFor: 'Building from the back to the far goal. The one for phone screens.',
    x0: 0,
    x1: 105,
    y0: 0,
    y1: 68,
    vertical: true,
  },
  'attacking-half': {
    id: 'attacking-half',
    label: 'Their half',
    hint: 'Halfway line to their goal.',
    useFor: 'Build-up into the final third, overloads, pressing them in.',
    x0: 52.5,
    x1: 105,
    y0: 0,
    y1: 68,
  },
  'defending-half': {
    id: 'defending-half',
    label: 'Our half',
    hint: 'Our goal on the left, danger arriving from the right.',
    useFor: 'Low and mid blocks, cover and balance, defending set pieces.',
    x0: 0,
    x1: 52.5,
    y0: 0,
    y1: 68,
  },
  'attacking-box': {
    id: 'attacking-box',
    label: 'Their box',
    hint: 'Close in on the penalty area.',
    useFor: 'Cutbacks, crosses, near-post runs — anything inside the width.',
    x0: 74,
    x1: 105,
    y0: 0,
    y1: 68,
  },
}

export const PITCH_VIEW_LIST: PitchView[] = [
  PITCH_VIEWS.full,
  PITCH_VIEWS['full-vertical'],
  PITCH_VIEWS['attacking-half'],
  PITCH_VIEWS['defending-half'],
  PITCH_VIEWS['attacking-box'],
]

/**
 * Views that no longer exist, mapped to their nearest survivor.
 *
 * A coach's saved system holds a pitch id, so removing one has to be handled
 * rather than crashed on. `final-third` became `attacking-box`; `middle-third`
 * had no equivalent and falls back to the full pitch, which shows everything
 * they placed rather than cropping half of it away.
 */
const RETIRED_VIEWS: Record<string, PitchViewId> = {
  'final-third': 'attacking-box',
  'middle-third': 'full',
}

/** Coerce any stored pitch id — including retired ones — to a live view. */
export function resolveViewId(id: string | undefined): PitchViewId {
  if (!id) return 'full'
  if (id in PITCH_VIEWS) return id as PitchViewId
  return RETIRED_VIEWS[id] ?? 'full'
}

/**
 * Breathing room around the crop, in metres, so the goal frame and the corner
 * arcs are not clipped flush against the edge of the image. Part of the look:
 * the videos always let the board sit inside its frame.
 */
export const PAD = 3

/** This view's padding, per pitch axis, with the default filled in. */
function pads(v: PitchView): { x: number; y: number } {
  return v.pad ?? { x: PAD, y: PAD }
}

/**
 * The point an upright view turns about: the centre of its own crop.
 *
 * Turning about the crop centre rather than the pitch centre means the quarter
 * turn never moves the framing — the same grass stays on screen, it is simply
 * stood on its end.
 */
function cropCentre(v: PitchView): { cx: number; cy: number } {
  return { cx: ((v.x0 + v.x1) / 2) * U, cy: ((v.y0 + v.y1) / 2) * U }
}

/**
 * Metres → final SVG units, quarter turn included.
 *
 * THIS IS THE ONLY PLACE THE UPRIGHT VIEW EXISTS. Every mark on the board —
 * counters, ball, arrows, bands — is positioned through here, so it lands
 * already turned and is then drawn with no transform of its own. That is
 * deliberate: an SVG `rotate()` wrapped round the whole board would also turn
 * every counter label, cue chip and arrow caption on its side. Text has to
 * stand up, so the turn lives in the coordinates and not in the markup.
 *
 * The one exception is the pitch markings, which carry no text and are turned
 * with a real transform (`boardTransform`) because they are drawn in metre
 * space in one pass.
 *
 * The turn is -90°, so the pitch's +x (towards the goal we attack) becomes -y:
 * upright boards attack UP the screen, which is how the videos' vertical pitch
 * reads and how anyone holding a phone expects it.
 */
export function metresToUnits(v: PitchView, mx: number, my: number): { x: number; y: number } {
  const x = mx * U
  const y = my * U
  if (!v.vertical) return { x, y }
  const { cx, cy } = cropCentre(v)
  return { x: cx + (y - cy), y: cy - (x - cx) }
}

/** Final SVG units → metres. The inverse of `metresToUnits`. */
export function unitsToMetres(v: PitchView, ux: number, uy: number): { x: number; y: number } {
  if (!v.vertical) return { x: ux / U, y: uy / U }
  const { cx, cy } = cropCentre(v)
  return { x: (cx - (uy - cy)) / U, y: (cy + (ux - cx)) / U }
}

/** The crop window in FINAL units — what the viewBox frames and the clip cuts to. */
export function cropRect(v: PitchView): { x: number; y: number; w: number; h: number } {
  const p = pads(v)
  const w = (v.x1 - v.x0 + p.x * 2) * U
  const h = (v.y1 - v.y0 + p.y * 2) * U
  if (!v.vertical) return { x: (v.x0 - p.x) * U, y: (v.y0 - p.y) * U, w, h }
  // A quarter turn swaps the crop's width and height about the same centre.
  const { cx, cy } = cropCentre(v)
  return { x: cx - h / 2, y: cy - w / 2, w: h, h: w }
}

/** The SVG viewBox for a view, in units, including the padding. */
export function viewBox(v: PitchView): string {
  const r = cropRect(v)
  return `${r.x} ${r.y} ${r.w} ${r.h}`
}

/**
 * The transform that turns the PITCH MARKINGS (and nothing else) upright.
 * Returns undefined for the horizontal views, which is the common case.
 */
export function boardTransform(v: PitchView): string | undefined {
  if (!v.vertical) return undefined
  const { cx, cy } = cropCentre(v)
  return `rotate(-90 ${cx} ${cy})`
}

/**
 * Aspect ratio (w/h) of a view including padding. Drives the slide layout.
 *
 * Note the consequence for the upright view: the horizontal views all share the
 * pitch's 68m WIDTH, so a board fitted by height renders a counter at the same
 * on-screen size in every one of them. Upright, the long 105m axis is the one
 * running down the screen, so the same fit shows half again as much pitch and
 * the counters come out proportionally smaller. That is not a bug — it is what
 * seeing more pitch looks like — but it is why switching to upright changes the
 * apparent size of everything.
 */
export function aspect(v: PitchView): number {
  const p = pads(v)
  const w = v.x1 - v.x0 + p.x * 2
  const h = v.y1 - v.y0 + p.y * 2
  return v.vertical ? h / w : w / h
}

/** Percent-of-crop → metres. The bridge between stored coords and geometry. */
export function toMetres(v: PitchView, x: number, y: number): { x: number; y: number } {
  return {
    x: v.x0 + (x / 100) * (v.x1 - v.x0),
    y: v.y0 + (y / 100) * (v.y1 - v.y0),
  }
}

/** Metres → percent-of-crop. Used when a drag lands. */
export function toPercent(v: PitchView, mx: number, my: number): { x: number; y: number } {
  return {
    x: ((mx - v.x0) / (v.x1 - v.x0)) * 100,
    y: ((my - v.y0) / (v.y1 - v.y0)) * 100,
  }
}

/**
 * Re-express a percent coordinate from one view in another.
 *
 * The bridge that makes changing pitch view non-destructive. Percent is
 * relative to the crop, so the same numbers mean different places in different
 * views; going out to metres and back keeps the mark on the patch of grass the
 * coach put it on. Results outside 0–100 are left alone rather than clamped —
 * a player who falls outside the new crop is still in the document, invisible
 * until the view widens again, which is recoverable. Clamping would pile them
 * against the touchline and silently destroy the arrangement.
 */
export function remap(
  from: PitchView,
  to: PitchView,
  x: number,
  y: number,
): { x: number; y: number } {
  const m = toMetres(from, x, y)
  return toPercent(to, m.x, m.y)
}

/** Percent-of-crop → SVG units, which is what the components actually draw in. */
export function toUnits(v: PitchView, x: number, y: number): { x: number; y: number } {
  const m = toMetres(v, x, y)
  return metresToUnits(v, m.x, m.y)
}

/** SVG units → percent-of-crop. The inverse of `toUnits`; used when a drag lands. */
export function unitsToPercent(v: PitchView, ux: number, uy: number): { x: number; y: number } {
  const m = unitsToMetres(v, ux, uy)
  return toPercent(v, m.x, m.y)
}

/**
 * The goal line a side DEFENDS: which axis it runs along, and where.
 *
 * A block band fills from the defensive line back to the goal it is protecting,
 * so it has to know which end that is — and the answer comes from the side, not
 * from the view. We attack towards `PITCH.length` on every view (see
 * formations.ts), so we always defend the goal at x=0; they always defend the
 * far one.
 *
 * Deriving this from the view instead is the obvious-looking mistake: on a full
 * pitch it would shade the whole board from our back four to the opposition's
 * goal, which reads as "we own everything" rather than "this is the space we
 * protect".
 *
 * The axis comes back with it because upright views stand the pitch on its end:
 * the goal line that was a vertical edge at some `x` becomes a horizontal edge
 * at some `y`, and a band that closed to a fixed x would fill the wrong half of
 * the board.
 */
export function defendedGoal(
  side: 'us' | 'them',
  v: PitchView,
): { axis: 'x' | 'y'; at: number } {
  const goalMetreX = side === 'us' ? 0 : PITCH.length
  const p = metresToUnits(v, goalMetreX, PITCH.width / 2)
  return v.vertical ? { axis: 'y', at: p.y } : { axis: 'x', at: p.x }
}

/**
 * The penalty arc's endpoints, where the 9.15m circle around the spot crosses
 * the front of the penalty area. Computed rather than eyeballed so the arc
 * meets the box line exactly at every zoom level.
 */
export function penaltyArcHalfHeight(): number {
  const dx = MARK.penDepth - MARK.penSpot
  return Math.sqrt(MARK.circle * MARK.circle - dx * dx)
}
