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

/**
 * A TRAINING AREA: the coned-off rectangle a session is actually run in.
 *
 * WHY THIS IS A RECTANGLE INSIDE THE PITCH AND NOT A BOARD OF ITS OWN
 *
 * A training grid is not a pitch, but it is laid out ON one, and everything in
 * the studio — the stored percent coordinates, `remap` between views, the
 * bands, the gear, the snapping in ./align.ts, the tween, the film exporter —
 * is built on the single 105x68 metre space in this file. Giving a rondo its
 * own coordinate system would fork every one of those. So a training board is
 * an ordinary crop of the same pitch with different LINES painted on it, and
 * nothing downstream has to know the difference.
 *
 * WHY THE CROP IS BIGGER THAN THE AREA
 *
 * A coach cones a 30x20 and then puts the goals OUTSIDE it, in the corners, on
 * the ends, wherever the exercise wants them — that is what the picture this
 * came from shows. If the crop stopped at the cones there would be nowhere to
 * put them: percent is measured on the crop and a drag is clamped a few percent
 * past it. Every area below therefore sits inside about five metres of spare
 * grass on all four sides, which is both the room to place equipment and what a
 * coned grid on a real field looks like.
 *
 * Every measurement is in metres of pitch space, like everything else here.
 */
export interface TrainingArea {
  /** The playing rectangle. Inside the view's crop, never equal to it. */
  x0: number
  x1: number
  y0: number
  y1: number
  /** A halfway line across it. */
  halfway?: boolean
  /** Centre circle radius. Omitted on the bare grids, which have no kickoff. */
  circle?: number
  /** A goal area at each end: how far INTO the area, how wide ACROSS it. */
  box?: { depth: number; width: number }
  /** A square in the middle, side in metres. The rondo's inner box. */
  middle?: number
  /** Ruled into cells: divisions along the length, divisions across the width. */
  cells?: { along: number; across: number }
}

export type PitchViewId =
  | 'full'
  | 'full-vertical'
  | 'two-thirds'
  | 'attacking-half'
  | 'defending-half'
  | 'attacking-box'
  | 'attacking-set-piece'
  | 'defending-set-piece'
  | 'training-pitch'
  | 'channel-grid'
  | 'possession-grid'
  | 'rondo-square'

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
   * Turn the OTHER way, so the pitch's OWN goal end stands at the top.
   *
   * Only meaningful alongside `vertical`, and true on exactly one view. Every
   * other upright board attacks UP the screen, which is right everywhere except
   * a defensive set piece: that board is about the goal the ball is arriving
   * at, and a coach draws a defensive corner the same way round as an attacking
   * one. So `defending-set-piece` is the one view where we play DOWN the
   * screen, and this flag is the whole of how.
   *
   * It is a ROTATION and not a mirror — +90 where the others take -90 — so
   * nothing comes out handed backwards. A ball on the top touchline is still on
   * the top touchline; it has come round the other side of the board, which is
   * what turning a board round actually does.
   */
  flip?: boolean
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
  /**
   * Paint a training area on this board instead of a football pitch.
   *
   * Present on the four training boards and absent everywhere else, and that
   * absence is what every other view means by "draw the pitch". See
   * `TrainingArea` for why a grid is a crop of the pitch rather than its own
   * board.
   */
  area?: TrainingArea
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
  'two-thirds': {
    id: 'two-thirds',
    label: 'Two thirds',
    hint: 'Defensive third to their goal.',
    useFor: 'Playing out from the back, building through the middle third.',
    x0: 35,
    x1: 105,
    y0: 0,
    y1: 68,
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
    useFor: 'Cutbacks, crosses, near-post runs: anything inside the width.',
    x0: 74,
    x1: 105,
    y0: 0,
    y1: 68,
  },

  /*
   * ── THE TWO SET-PIECE BOARDS ─────────────────────────────────────────────
   *
   * These are the one pair of views here that were not counted out of the
   * shorts, and §3a of docs/STUDIO.md is AMENDED rather than broken. That rule
   * exists to stop US inventing views nobody wants; a coach asking for one by
   * name, twice, and sending a picture of it is a better source than a count of
   * our own output (Bojan Krulj, UEFA Pro, 2026-08-29). The count is not zero
   * either — SetPieceShort.tsx is four routines on the half-pitch board.
   *
   * The framing is his: half a pitch stood on its end, the goal the ball is
   * going INTO at the top, and the full 68m of width, because the man taking it
   * is standing on the touchline. A corner drawn on `full` lands in a fifth of
   * the board with the coach's own half empty beside it, which is exactly the
   * screen he was looking at when he asked.
   *
   * Both are half-pitch crops, so they share their bands and their geometry
   * with `attacking-half` / `defending-half` and only the turn is new.
   */
  'attacking-set-piece': {
    id: 'attacking-set-piece',
    label: 'Attacking set piece',
    hint: 'Their goal at the top, the whole width in front of it.',
    useFor: 'Corners, wide free kicks, anything you rehearse into their box.',
    x0: 52.5,
    x1: 105,
    y0: 0,
    y1: 68,
    vertical: true,
  },
  'defending-set-piece': {
    id: 'defending-set-piece',
    label: 'Defending set piece',
    hint: 'Our goal at the top, the ball arriving at it.',
    useFor: 'Marking jobs, zonal setups, winning the first ball and clearing it.',
    x0: 0,
    x1: 52.5,
    y0: 0,
    y1: 68,
    vertical: true,
    flip: true,
  },

  /*
   * -- THE FOUR TRAINING BOARDS ---------------------------------------------
   *
   * Same amendment to §3a of docs/STUDIO.md as the set pieces, from the same
   * coach and with a picture again (2026-08-29): a coned grid with mini goals
   * round it, which is what most of a coaching week is actually spent on. A
   * session drawn on `full` is a cluster of counters in a fifth of a pitch with
   * a centre circle and two penalty areas arguing with it.
   *
   * The sizes are the ones a session plan is written in, not tidy numbers:
   * 40x30 is the 7v7 / 9v9 pitch, 30x20 is the standard possession grid, 20x20
   * is the rondo box. All four are centred on the middle of the pitch, so the
   * grass, the mow and the surface come free and the crop never leaves the
   * turf.
   *
   * NO GOALS ARE DRAWN ON ANY OF THEM. A mini goal is equipment, it goes where
   * the exercise puts it — in the corners, on the ends, facing inwards — and
   * every one of those is a drag from Equipment onto the spare grass these
   * crops leave round the outside. Painting four goals into the board would
   * make exactly one exercise easy and every other one wrong.
   */
  'training-pitch': {
    id: 'training-pitch',
    label: 'Small-sided pitch (40 x 30)',
    hint: 'A 7v7 pitch: halfway line, centre circle, an area at each end.',
    useFor: 'Small-sided games, phase of play, anything played to two goals.',
    x0: 27.5,
    x1: 77.5,
    y0: 14,
    y1: 54,
    /*
     * Less spare grass than a pitch gets. `PAD` exists so a goal frame and the
     * corner arcs are not clipped flush against the edge; a coned area has
     * neither, and the five metres of margin already inside the crop is where
     * the equipment goes. Three more on top of it just makes the grid look
     * small on the screen.
     */
    pad: { x: 1.5, y: 1.5 },
    area: {
      x0: 32.5,
      x1: 72.5,
      y0: 19,
      y1: 49,
      halfway: true,
      circle: 5,
      box: { depth: 6, width: 16 },
    },
  },
  'channel-grid': {
    id: 'channel-grid',
    label: 'Channelled grid (40 x 30)',
    hint: 'The same 40 x 30, ruled into six boxes.',
    useFor: 'Positional games: who holds which box, when you are allowed out of it.',
    x0: 27.5,
    x1: 77.5,
    y0: 14,
    y1: 54,
    /*
     * Less spare grass than a pitch gets. `PAD` exists so a goal frame and the
     * corner arcs are not clipped flush against the edge; a coned area has
     * neither, and the five metres of margin already inside the crop is where
     * the equipment goes. Three more on top of it just makes the grid look
     * small on the screen.
     */
    pad: { x: 1.5, y: 1.5 },
    area: {
      x0: 32.5,
      x1: 72.5,
      y0: 19,
      y1: 49,
      cells: { along: 3, across: 2 },
    },
  },
  'possession-grid': {
    id: 'possession-grid',
    label: 'Possession grid (30 x 20)',
    hint: 'A bare rectangle with a square in the middle of it.',
    useFor: 'Possession games, four-goal games, keeping the ball under pressure.',
    x0: 33,
    x1: 72,
    y0: 19.5,
    y1: 48.5,
    /*
     * Less spare grass than a pitch gets. `PAD` exists so a goal frame and the
     * corner arcs are not clipped flush against the edge; a coned area has
     * neither, and the five metres of margin already inside the crop is where
     * the equipment goes. Three more on top of it just makes the grid look
     * small on the screen.
     */
    pad: { x: 1.5, y: 1.5 },
    area: {
      x0: 37.5,
      x1: 67.5,
      y0: 24,
      y1: 44,
      middle: 8,
    },
  },
  'rondo-square': {
    id: 'rondo-square',
    label: 'Rondo square (20 x 20)',
    hint: 'A square, with the inner box the middle men work in.',
    useFor: '4v2, 5v2, 6v3: first touch, angles of support, pressing in a pair.',
    x0: 38,
    x1: 67,
    y0: 19.5,
    y1: 48.5,
    /*
     * Less spare grass than a pitch gets. `PAD` exists so a goal frame and the
     * corner arcs are not clipped flush against the edge; a coned area has
     * neither, and the five metres of margin already inside the crop is where
     * the equipment goes. Three more on top of it just makes the grid look
     * small on the screen.
     */
    pad: { x: 1.5, y: 1.5 },
    area: {
      x0: 42.5,
      x1: 62.5,
      y0: 24,
      y1: 44,
      middle: 8,
    },
  },
}

/**
 * The picker, in the three kinds of board there now are.
 *
 * Twelve views in one flat dropdown is a list you read rather than scan, and it
 * would put "Rondo square" one line under "Our half" as though they were
 * alternatives to each other. They are not: a coach opening this knows before
 * they open it whether they are drawing a match, a dead ball or a session, so
 * that question is asked first and the list under it is short.
 *
 * The order inside each group is widest board first, which is the order a coach
 * zooms in.
 */
export const PITCH_VIEW_GROUPS: { label: string; views: PitchView[] }[] = [
  {
    label: 'Match',
    views: [
      PITCH_VIEWS.full,
      PITCH_VIEWS['full-vertical'],
      PITCH_VIEWS['two-thirds'],
      PITCH_VIEWS['attacking-half'],
      PITCH_VIEWS['defending-half'],
      PITCH_VIEWS['attacking-box'],
    ],
  },
  {
    label: 'Set pieces',
    views: [PITCH_VIEWS['attacking-set-piece'], PITCH_VIEWS['defending-set-piece']],
  },
  {
    label: 'Training',
    views: [
      PITCH_VIEWS['training-pitch'],
      PITCH_VIEWS['channel-grid'],
      PITCH_VIEWS['possession-grid'],
      PITCH_VIEWS['rondo-square'],
    ],
  },
]

/** Every view, flat, in the picker's own order. */
export const PITCH_VIEW_LIST: PitchView[] = PITCH_VIEW_GROUPS.flatMap((g) => g.views)

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
  const dx = x - cx
  const dy = y - cy
  // -90 for an upright board, +90 for the flipped one. See `flip`.
  return v.flip ? { x: cx - dy, y: cy + dx } : { x: cx + dy, y: cy - dx }
}

/** Final SVG units → metres. The inverse of `metresToUnits`. */
export function unitsToMetres(v: PitchView, ux: number, uy: number): { x: number; y: number } {
  if (!v.vertical) return { x: ux / U, y: uy / U }
  const { cx, cy } = cropCentre(v)
  const dx = ux - cx
  const dy = uy - cy
  return v.flip ? { x: (cx + dy) / U, y: (cy - dx) / U } : { x: (cx - dy) / U, y: (cy + dx) / U }
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
  return `rotate(${v.flip ? 90 : -90} ${cx} ${cy})`
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
  // On a training board the end a side is protecting is the end LINE OF THE
  // GRID, not a goal line five and twenty metres off the edge of the crop. A
  // block drawn in a 30x20 has to close onto the cones the coach can see, or it
  // fills the margin and half the pitch beyond it.
  const ends = v.area ? [v.area.x0, v.area.x1] : [0, PITCH.length]
  const goalMetreX = side === 'us' ? ends[0] : ends[1]
  const p = metresToUnits(v, goalMetreX, PITCH.width / 2)
  return v.vertical ? { axis: 'y', at: p.y } : { axis: 'x', at: p.x }
}

/**
 * How far inside a training area's edge a counter has to START, in metres.
 *
 * A counter is 4.2m across on a board drawn in real metres (`TOKEN_R` in
 * ./Token.tsx), so a man placed exactly on the boundary of a 20m square hangs
 * half of himself out of the exercise. On a full pitch that is right — a
 * full-back stands on the touchline — and on a coned grid it is not, because
 * the grid is the whole of what the exercise is. Two and a half metres is the
 * counter's own radius plus enough air to read as inside rather than on.
 *
 * scripts/check-align.mjs asserts this against TOKEN_R, which lives in a .tsx
 * this file will not import: pitch geometry stays free of React.
 */
export const AREA_INSET = 2.5

/**
 * The slice of a view's crop, in percent, that a shape may be laid into.
 *
 * The whole crop on a pitch, and on a training board the coned area pulled in
 * by `AREA_INSET`. See `TrainingArea` for why the crop is bigger than the area:
 * the margin is where the goals and cones go, and it is not somewhere to place
 * a back four.
 *
 * Percent, because that is the space ../formations.ts lays shapes out in.
 */
export function areaBand(v: PitchView, axis: 'x' | 'y'): [number, number] {
  if (!v.area) return [0, 100]
  const c0 = axis === 'x' ? v.x0 : v.y0
  const c1 = axis === 'x' ? v.x1 : v.y1
  const a0 = axis === 'x' ? v.area.x0 : v.area.y0
  const a1 = axis === 'x' ? v.area.x1 : v.area.y1
  const pc = (m: number) => Math.round(((m - c0) / (c1 - c0)) * 1000) / 10
  return [pc(a0 + AREA_INSET), pc(a1 - AREA_INSET)]
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

/* ── MARKED-UP PITCHES ──────────────────────────────────────────────────────
 *
 * A coach who works in corridors should not have to draw the corridors. He
 * asked for the board to be "a regular field AND a drawn field with lines,
 * zones and sectors", and the honest reading of that is a pitch that already
 * carries the grid he coaches in — not a pitch he re-rules by hand at the top
 * of every session, at slightly the wrong spacing each time.
 *
 * So markings are FURNITURE, not marks. They live on the system beside the
 * surface (../schema.ts `grid`), they are drawn into the pitch under every
 * counter and arrow, and they cannot be selected, dragged or deleted, because
 * there is nothing about them to edit: the numbers are the ones the game uses.
 *
 * They are NOT a sixth pitch view. The view is the crop — what the system is
 * about, and the space every mark is stored in. The grid is what is ruled onto
 * whatever the crop shows, so the two multiply instead of competing: their half
 * in five channels, the full pitch in eighteen zones.
 *
 * WHY THESE NUMBERS AND NOT EYEBALLED ONES. The five channels are the ones the
 * positional game is actually played in: the wide channels end where the
 * penalty area ends (40.32 m), and the centre is the width of the six-yard box
 * (18.32 m). That is why a full-back overlapping "outside the box line" and a
 * striker "in the middle corridor" mean something you can see from the touch
 * line. The eighteen zones are the classic grid the phrase "zone 14" comes
 * from: six bands along the length, three across the width, numbered from the
 * defending end, which puts 14 dead centre outside their box.
 */

export type PitchGridId = 'none' | 'thirds' | 'channels' | 'sectors' | 'zones'

/** A ruled line across the pitch, in metres. */
export interface GridLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** A numbered cell of a grid: where the number goes, and what it says. */
export interface GridCell {
  x: number
  y: number
  label: string
}

export interface PitchGrid {
  id: PitchGridId
  /** How a coach would ask for it. */
  label: string
  /** One line under the picker, in their language rather than ours. */
  hint: string
  /** What it is for, in the same voice as a pitch view's. */
  useFor: string
  lines: GridLine[]
  /** Numbers printed in the cells. Empty on the grids nobody numbers. */
  cells: GridCell[]
}

const L = PITCH.length
const W = PITCH.width

/** A line along the length of the pitch, at some distance across it. */
const along = (y: number): GridLine => ({ x1: 0, y1: y, x2: L, y2: y })
/** A line across the pitch, at some distance along it. */
const across = (x: number): GridLine => ({ x1: x, y1: 0, x2: x, y2: W })

/** The four channel edges: the penalty area's width, then the six-yard box's. */
const CHANNEL_Y = [
  W / 2 - MARK.penWidth / 2,
  W / 2 - MARK.sixWidth / 2,
  W / 2 + MARK.sixWidth / 2,
  W / 2 + MARK.penWidth / 2,
]

/** The two lines that cut the pitch into thirds. */
const THIRD_X = [L / 3, (L * 2) / 3]

/** Six bands along the length and three across the width, numbered 1–18. */
function zoneGrid(): { lines: GridLine[]; cells: GridCell[] } {
  const bands = 6
  const rows = 3
  const bw = L / bands
  const rh = W / rows
  const lines: GridLine[] = []
  for (let b = 1; b < bands; b++) lines.push(across(b * bw))
  for (let r = 1; r < rows; r++) lines.push(along(r * rh))
  const cells: GridCell[] = []
  for (let b = 0; b < bands; b++) {
    for (let r = 0; r < rows; r++) {
      cells.push({
        x: (b + 0.5) * bw,
        y: (r + 0.5) * rh,
        label: String(b * rows + r + 1),
      })
    }
  }
  return { lines, cells }
}

const ZONES = zoneGrid()

export const PITCH_GRIDS: Record<PitchGridId, PitchGrid> = {
  none: {
    id: 'none',
    label: 'Plain pitch',
    hint: 'The markings a referee needs and nothing else.',
    useFor: 'Anything where the shape itself is the point.',
    lines: [],
    cells: [],
  },
  thirds: {
    id: 'thirds',
    label: 'Thirds',
    hint: 'Defensive, middle, final.',
    useFor: 'Where the press starts, where the ball has to be won, when to go long.',
    lines: THIRD_X.map(across),
    cells: [],
  },
  channels: {
    id: 'channels',
    label: 'Five channels',
    hint: 'Wide, half-space, centre, half-space, wide.',
    useFor: 'Positional play: who holds the touch line, who lives in the half-space.',
    lines: CHANNEL_Y.map(along),
    cells: [],
  },
  sectors: {
    id: 'sectors',
    label: 'Channels and thirds',
    hint: 'The five channels, cut into fifteen sectors.',
    useFor: 'Naming a sector out loud: this man, this corridor, this third.',
    lines: [...CHANNEL_Y.map(along), ...THIRD_X.map(across)],
    cells: [],
  },
  zones: {
    id: 'zones',
    label: '18 zones (numbered)',
    hint: 'Six bands by three, numbered from our goal. 14 is outside their box.',
    useFor: 'Coaching by zone number, and the shooting statistics that go with it.',
    lines: ZONES.lines,
    cells: ZONES.cells,
  },
}

export const PITCH_GRID_LIST: PitchGrid[] = [
  PITCH_GRIDS.none,
  PITCH_GRIDS.thirds,
  PITCH_GRIDS.channels,
  PITCH_GRIDS.sectors,
  PITCH_GRIDS.zones,
]

/**
 * Coerce any stored grid id to a live one.
 *
 * Stored loose on the document for the same reason a band's appearance is: a
 * grid we add next year must not make this year's build unable to open the
 * file. An unknown id draws the plain pitch, which is what every system written
 * before grids existed already had.
 */
export function resolveGrid(id: string | undefined): PitchGrid {
  if (id && id in PITCH_GRIDS) return PITCH_GRIDS[id as PitchGridId]
  return PITCH_GRIDS.none
}
