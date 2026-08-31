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
  /*
   * ONE training board, not four.
   *
   * The four that shipped on 2026-08-29 were four points — 40x30, 40x30 ruled,
   * 30x20, 20x20 — in a range coaches move through every session: rondos run
   * from 8x8 to 40x40 and possession games out to 40x35 (docs/TRAINING.md 1b).
   * Four fixed sizes is the wrong SHAPE of feature; the size is the control.
   * So the grid is one board and its dimensions live on the System, where the
   * coach can drag them. `RETIRED_VIEWS` maps the four old ids onto this one
   * and ../storage.ts `migrate` brings their sizes with them.
   */
  | 'training'

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
  /**
   * How big a counter is drawn on THIS board, as a multiple of its normal size.
   *
   * WHY THE SIZE BELONGS TO THE VIEW AND NOT TO THE SYSTEM
   *
   * `TOKEN_R` is 2.1 metres, so a counter is 4.2m across on every board — 5.7%
   * of the short side of the full pitch, and 13.1% of a 20m rondo square. Same
   * counter, 2.3x the share of the screen, which is exactly what the coach was
   * looking at when he said they were huge (docs/TRAINING.md 2).
   *
   * The five set pieces already work around this by putting `tokenSize: 0.75`
   * on the SYSTEM, and that is the wrong place: it follows the coach back onto
   * the full pitch when they leave the set piece, and shrinks counters on a
   * board that never needed it. How much grass is on screen is a property of
   * the VIEW and of nothing else, so the correction lives here.
   *
   * It MULTIPLIES with `System.tokenSize`, it does not replace it — a coach who
   * wants big counters on a rondo still gets them. Absent on every match view,
   * which is what `?? 1` in ../board/Board.tsx means: byte-identical output.
   */
  counter?: number
  /**
   * The strip of margin, in metres, that benched counters lay out in.
   *
   * Present on the training board and nowhere else. See `benchLayout`, and
   * `TrainingArea` for why the crop is bigger than the coned area in the first
   * place: the bench is the outer part of the same spare grass the goals go on,
   * which is where every board a coach already uses puts it (TRAINING.md 1d).
   */
  bench?: { x0: number; x1: number; y0: number; y1: number }
}

/* ── THE SESSION AREA, AS THE COACH SIZES IT ─────────────────────────────────
 *
 * `TrainingArea` above is the rectangle in PITCH METRES that gets drawn. This
 * is the two numbers and four switches a coach actually sets, and it lives on
 * the System (../schema.ts `area`) rather than on the view, because it is the
 * thing they change most: a rondo is 10x10 for an U9 group and 25x25 for a
 * first team, and both are the same board.
 *
 * Everything else — where the crop sits, how much margin, where the bench
 * strip is, how big a counter is drawn — is DERIVED from these by
 * `trainingView`. Nothing downstream stores a second copy of any of it.
 */
export interface SessionArea {
  /** Along the pitch's length, in metres. */
  length: number
  /** Across the pitch's width, in metres. */
  width: number
  /** A halfway line and a centre circle, for anything played to two goals. */
  halfway?: boolean
  /** An end area at each end, the small-sided pitch's goal areas. */
  ends?: boolean
  /** The inner square the middle men work in. The rondo's box. */
  middle?: boolean
  /** Ruled into cells: divisions along the length, divisions across the width. */
  cells?: { along: number; across: number }
}

/**
 * What a coach may drag the grid to.
 *
 * The low end is the twin rondo's 8x8; the top end is the FA's biggest youth
 * pitch, 91 x 55 for U15 and up. Both ends are real sizes out of TRAINING.md
 * 1b and 1e rather than round numbers, and the board is drawn on grass at every
 * point between them — see ../board/PitchMarkings.tsx, which paints the turf
 * past the pitch's own touchlines when there is an area on the board.
 */
export const AREA_MIN = { length: 8, width: 8 } as const
export const AREA_MAX = { length: 95, width: 60 } as const

/** The grid a new training board starts on: the standard possession grid. */
export const DEFAULT_AREA: SessionArea = { length: 30, width: 20, middle: true }

/**
 * Spare grass between the cones and the edge of the board, in metres.
 *
 * Where the goals, the cones and the mannequins go. See `TrainingArea`: if the
 * crop stopped at the cones there would be nowhere to put them.
 */
export const AREA_MARGIN = 5

/**
 * A counter's diameter in metres, which is `TOKEN_R * 2` in ./Token.tsx.
 *
 * Restated rather than imported because this file stays free of React and
 * Token.tsx is a component. scripts/check-align.mjs reads both and fails if
 * they ever disagree, so the duplicate cannot rot.
 */
export const COUNTER_D = 4.2

/**
 * Breathing room around the crop, in metres, so the goal frame and the corner
 * arcs are not clipped flush against the edge of the image. Part of the look:
 * the videos always let the board sit inside its frame.
 *
 * DECLARED HERE, above `PITCH_VIEWS`, and not down beside `pads()` where it
 * used to live: the training entry in that table is derived by `trainingView`
 * at module init, and the derivation reads this. A const read before its own
 * declaration is a dead-zone throw at import time, not a zero.
 */
export const PAD = 3

/**
 * The short side of the full pitch, in metres, INCLUDING its padding.
 *
 * The yardstick every other board's counter size is set against: a counter is
 * 5.7% of this, and it should be 5.7% of whatever board the coach is on. See
 * `PitchView.counter`.
 */
const MATCH_SHORT = PITCH.width + PAD * 2

/** Rows of counters the bench strip is sized to hold, and the air round them. */
const BENCH_ROWS = 2
const BENCH_STEP = 1.15
const BENCH_AIR = 1

/** Round to a tenth of a metre. Board geometry, not a survey. */
const t1 = (n: number) => Math.round(n * 10) / 10

/**
 * Derived boards, kept by size.
 *
 * MEMOISED because callers compare views by IDENTITY — `setPitch` short
 * circuits when `from === to`, and React re-renders the board when the object
 * changes. Deriving a fresh object per render would make the board look
 * permanently dirty. The key is the size, so two systems on the same grid share
 * one view, which is right: a view is a crop and nothing else.
 *
 * Declared up here with the constants rather than beside `trainingView`,
 * because the `training` entry in `PITCH_VIEWS` is derived while that table is
 * being built and would otherwise read this before it exists.
 */
const TRAINING_CACHE = new Map<string, PitchView>()

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
   * -- THE TRAINING BOARD ---------------------------------------------------
   *
   * Same amendment to 3a of docs/STUDIO.md as the set pieces, from the same
   * coach and with a picture again (2026-08-29): a coned grid with mini goals
   * round it, which is what most of a coaching week is actually spent on. A
   * session drawn on `full` is a cluster of counters in a fifth of a pitch with
   * a centre circle and two penalty areas arguing with it.
   *
   * ONE ENTRY, AND IT IS DERIVED. Four fixed sizes shipped first and were the
   * wrong shape of feature: the size of the grid is the thing a coach changes
   * most, every session, and it runs from an 8x8 twin rondo to a 40x35
   * possession game to a 91x55 youth pitch (docs/TRAINING.md 1b, 1e). So the
   * numbers live on the System and this is what they look like on a board.
   * The entry below is the DEFAULT grid; `viewFor` is how you get the coach's.
   *
   * NO GOALS ARE DRAWN ON IT. A mini goal is equipment, it goes where the
   * exercise puts it -- in the corners, on the ends, facing inwards -- and
   * every one of those is a drag from Equipment onto the spare grass the crop
   * leaves round the outside. Painting four goals into the board would make
   * exactly one exercise easy and every other one wrong.
   */
  training: trainingView(DEFAULT_AREA),
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
    views: [PITCH_VIEWS.training],
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
  // The four fixed training boards became one board with a size. Their sizes
  // are not lost: `RETIRED_AREAS` carries each one onto the new board, and
  // ../storage.ts `migrate` writes it onto the document.
  'training-pitch': 'training',
  'channel-grid': 'training',
  'possession-grid': 'training',
  'rondo-square': 'training',
}

/**
 * The grid each retired training board was, so a saved session opens the size
 * it was drawn at rather than the default one.
 *
 * A document that named `rondo-square` was a 20x20 with an inner box, and it
 * still is. `migrate` reads this once, on load, and the document then carries
 * its own numbers like any other.
 */
export const RETIRED_AREAS: Record<string, SessionArea> = {
  'training-pitch': { length: 40, width: 30, halfway: true, ends: true },
  'channel-grid': { length: 40, width: 30, cells: { along: 3, across: 2 } },
  'possession-grid': { length: 30, width: 20, middle: true },
  'rondo-square': { length: 20, width: 20, middle: true },
}

/** Coerce any stored pitch id — including retired ones — to a live view. */
export function resolveViewId(id: string | undefined): PitchViewId {
  if (!id) return 'full'
  if (id in PITCH_VIEWS) return id as PitchViewId
  return RETIRED_VIEWS[id] ?? 'full'
}

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
  if (!v.vertical) {
    if (v.flip) {
      const { cx, cy } = cropCentre(v)
      return { x: cx - (x - cx), y: cy - (y - cy) }
    }
    return { x, y }
  }

  const { cx, cy } = cropCentre(v)
  const dx = x - cx
  const dy = y - cy
  // -90 for an upright board, +90 for the flipped one. See `flip`.
  return v.flip ? { x: cx - dy, y: cy + dx } : { x: cx + dy, y: cy - dx }
}

/** Final SVG units → metres. The inverse of `metresToUnits`. */
export function unitsToMetres(v: PitchView, ux: number, uy: number): { x: number; y: number } {
  if (!v.vertical) {
    if (v.flip) {
      const { cx, cy } = cropCentre(v)
      return { x: (cx - (ux - cx)) / U, y: (cy - (uy - cy)) / U }
    }
    return { x: ux / U, y: uy / U }
  }
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
  if (!v.vertical) {
    if (v.flip) {
      const { cx, cy } = cropCentre(v)
      return `rotate(180 ${cx} ${cy})`
    }
    return undefined
  }
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
 * Converts a pitch percent coordinate (x: 0-100% of length, y: 0-100% of width)
 * into a screen percent coordinate (x: 0-100% from left of the visual crop,
 * y: 0-100% from top of the visual crop), correctly handling upright and flipped
 * views, and padding.
 *
 * This is required for drawing HTML overlays (like marquee boxes) that match
 * the visual rotation of the pitch on screen.
 */
export function toScreenPercent(v: PitchView, p: { x: number; y: number }): { x: number; y: number } {
  const m = toMetres(v, p.x, p.y)
  const u = metresToUnits(v, m.x, m.y)
  const r = cropRect(v)
  return {
    x: ((u.x - r.x) / r.w) * 100,
    y: ((u.y - r.y) / r.h) * 100,
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
 * The same figure for a PARTICULAR board, which is the one to use.
 *
 * `AREA_INSET` above is a counter's radius plus air at full size, and it was
 * the whole answer while every counter was 4.2m across on every board. It is
 * not any more: a counter on a 10m rondo is drawn at about a third of that
 * (`PitchView.counter`), and holding a fixed 2.5m inset there would reserve
 * half the grid to keep a man off a line he is nowhere near. So the inset is
 * the counter's own radius on THIS board, plus the same 0.4m of air.
 *
 * A match view has no `counter`, so this is 2.5 there and nothing changes.
 */
export function areaInset(v: PitchView): number {
  return (COUNTER_D / 2) * (v.counter ?? 1) + 0.4
}

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
  const inset = areaInset(v)
  const pc = (m: number) => Math.round(((m - c0) / (c1 - c0)) * 1000) / 10
  return [pc(a0 + inset), pc(a1 - inset)]
}


/* -- DERIVING A TRAINING BOARD FROM A SIZE ----------------------------------
 *
 * Four numbers a coach sets (`SessionArea`) become a whole board: a crop, a
 * coned rectangle inside it, whatever is ruled on it, the counter size and the
 * bench strip. Nothing in it is eyeballed, and scripts/check-align.mjs checks
 * the arithmetic against every preset.
 *
 * THE ONE PIECE OF ALGEBRA WORTH READING is the bench strip, because it is
 * circular and looks it. The strip has to be tall enough for two rows of
 * counters; a counter's size is set from the SHORT SIDE of the board; and the
 * short side includes the strip. So:
 *
 *     short = width + 2*margin + 2*pad + bench
 *     bench = k * short + air,   k = counterDiameter * rows * step / 74
 *
 * which solves in one line rather than by iterating:
 *
 *     short = (width + 2*margin + 2*pad + air) / (1 - k)
 *
 * Solved on the WIDTH because that is the short side of every grid a coach
 * actually draws. If a long thin one makes the LENGTH shorter, the counter
 * comes out smaller than the strip was sized for and the bench simply has room
 * to spare, which is the safe direction to be wrong in.
 */

export function trainingView(a: SessionArea): PitchView {
  const length = Math.min(AREA_MAX.length, Math.max(AREA_MIN.length, a.length))
  const width = Math.min(AREA_MAX.width, Math.max(AREA_MIN.width, a.width))
  const key = JSON.stringify([length, width, a.halfway, a.ends, a.middle, a.cells])
  const hit = TRAINING_CACHE.get(key)
  if (hit) return hit

  const M = AREA_MARGIN
  const P = 1.5
  const k = (COUNTER_D * BENCH_ROWS * BENCH_STEP) / MATCH_SHORT
  const shortSide = (width + M * 2 + P * 2 + BENCH_AIR) / (1 - k)
  const bench = t1(k * shortSide + BENCH_AIR)

  // The crop. Centred on the pitch centre along the length; along the width it
  // hangs the bench strip off the bottom, so the cones sit a little above the
  // middle of the board and the coach's waiting players sit below them --
  // which is where every board they already use puts the bench (TRAINING.md 1d).
  const cropW = length + M * 2
  const cropH = width + M * 2 + bench
  const x0 = t1(PITCH.length / 2 - cropW / 2)
  const y0 = t1(PITCH.width / 2 - cropH / 2)
  const x1 = t1(x0 + cropW)
  const y1 = t1(y0 + cropH)

  const ax0 = t1(x0 + M)
  const ay0 = t1(y0 + M)
  const ax1 = t1(ax0 + length)
  const ay1 = t1(ay0 + width)

  // The counter, as a share of what is actually on screen. `full` is the
  // yardstick: 4.2m of counter in 74m of board. See `PitchView.counter`.
  const visible = Math.min(cropW + P * 2, cropH + P * 2)
  const counter = Math.round((visible / MATCH_SHORT) * 1000) / 1000

  const short = Math.min(length, width)
  const view: PitchView = {
    id: 'training',
    label: 'Training grid',
    hint: `A coned ${length} by ${width} area, with grass round it for the goals.`,
    useFor: 'Rondos, possession games, small-sided games: anything played inside cones.',
    x0,
    x1,
    y0,
    y1,
    /*
     * Less spare grass than a pitch gets. `PAD` exists so a goal frame and the
     * corner arcs are not clipped flush against the edge; a coned area has
     * neither, and the margin already inside the crop is where the equipment
     * goes. Three more on top of it just makes the grid look small.
     */
    pad: { x: P, y: P },
    counter,
    area: {
      x0: ax0,
      x1: ax1,
      y0: ay0,
      y1: ay1,
      ...(a.halfway ? { halfway: true, circle: t1(short / 6) } : {}),
      ...(a.ends ? { box: { depth: t1(length * 0.15), width: t1(width * 0.53) } } : {}),
      ...(a.middle ? { middle: t1(short * 0.4) } : {}),
      ...(a.cells ? { cells: a.cells } : {}),
    },
    // A metre in off each side, so a counter at the end of a full row is not
    // drawn half off the board.
    bench: { x0: t1(x0 + 1), x1: t1(x1 - 1), y0: t1(y1 - bench), y1 },
  }
  TRAINING_CACHE.set(key, view)
  return view
}

/**
 * The board a SYSTEM is on -- the one call site everything should use.
 *
 * `PITCH_VIEWS[resolveViewId(s.pitch)]` was that call until the grid got a
 * size, and it is now wrong for exactly one id: the training board's crop is
 * derived from `system.area`, so looking it up by id alone hands back the
 * default 30x20 whatever the coach set. Every reader of a system's view goes
 * through here instead.
 */
export function viewFor(s: { pitch?: string; area?: SessionArea } | null | undefined): PitchView {
  const id = resolveViewId(s?.pitch)
  if (id !== 'training') return PITCH_VIEWS[id]
  return trainingView(s?.area ?? DEFAULT_AREA)
}

/**
 * Where the benched counters stand, in percent of the crop.
 *
 * Laid out rather than stored, so a full squad coming off a match view lands as
 * a tidy row instead of twenty-two counters piled on one spot. The caller
 * WRITES the result onto the tokens (`benchAct` in ../editor/StudioEditor.tsx)
 * rather than drawing from it, and that is deliberate: a benched player whose
 * stored position was somewhere else would tween out of the wrong place in the
 * film and hold an arrow to a spot nobody can see. On the board, in the film,
 * in the PDF, a man on the bench is simply a man standing on that patch of
 * grass -- which is what he is on a real training pitch.
 *
 * Ids in, positions out, so this file stays clear of the document's types.
 */
export function benchLayout(v: PitchView, ids: string[]): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {}
  const b = v.bench
  if (!b || ids.length === 0) return out

  const step = COUNTER_D * (v.counter ?? 1) * BENCH_STEP
  const perRow = Math.max(1, Math.min(ids.length, Math.floor((b.x1 - b.x0) / step)))
  const rows = Math.ceil(ids.length / perRow)
  const rowH = (b.y1 - b.y0) / rows
  const midX = (b.x0 + b.x1) / 2

  ids.forEach((id, i) => {
    const r = Math.floor(i / perRow)
    const col = i - r * perRow
    // The last row is short, so it is centred on its own count rather than
    // hanging off the left with a gap where the rest of the squad is not.
    const inRow = Math.min(perRow, ids.length - r * perRow)
    const mx = midX - ((inRow - 1) * step) / 2 + col * step
    const my = b.y0 + rowH * (r + 0.5)
    const p = toPercent(v, mx, my)
    out[id] = { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }
  })
  return out
}

/** True when a point, in percent of the crop, is down in the bench strip. */
export function inBench(v: PitchView, y: number): boolean {
  const b = v.bench
  if (!b) return false
  return toMetres(v, 50, y).y >= b.y0
}

/* -- THE SIZES A SESSION IS ACTUALLY WRITTEN IN -----------------------------
 *
 * Not invented, and not rounded: every one is a size that appears by name in
 * the coaching literature or in the FA's own pitch guide (docs/TRAINING.md 1b
 * and 1e, with the sources at the foot of it). A coach who wants something
 * else drags the two sliders; these are the ones worth one press.
 */
export interface AreaPreset {
  id: string
  label: string
  /** What it is for, in the coach's language. */
  hint: string
  area: SessionArea
}

export const AREA_PRESET_GROUPS: { label: string; presets: AreaPreset[] }[] = [
  {
    label: 'Rondo',
    presets: [
      { id: 'rondo-10', label: '10 x 10', hint: '4v2, 5v2, 6v2. One player on each corner.', area: { length: 10, width: 10, middle: true } },
      { id: 'rondo-15', label: '15 x 15', hint: '6v2, with two on the midpoints of opposite sides.', area: { length: 15, width: 15, middle: true } },
      { id: 'rondo-20', label: '20 x 20', hint: 'The everyday rondo box.', area: { length: 20, width: 20, middle: true } },
      { id: 'rondo-25', label: '25 x 25', hint: '6v3, and rondos with a bit more air in them.', area: { length: 25, width: 25, middle: true } },
    ],
  },
  {
    label: 'Possession grid',
    presets: [
      { id: 'grid-25-20', label: '25 x 20', hint: 'The space between the sideline and the 18 yard area.', area: { length: 25, width: 20, middle: true } },
      { id: 'grid-30-20', label: '30 x 20', hint: 'The standard possession grid.', area: { length: 30, width: 20, middle: true } },
      { id: 'grid-40-30', label: '40 x 30', hint: 'Bigger possession, four goal games, phase of play.', area: { length: 40, width: 30, middle: true } },
      { id: 'grid-40-35', label: '40 x 35', hint: 'Between the halfway line and the 18 yard box.', area: { length: 40, width: 35, middle: true } },
      { id: 'cells-40-30', label: '40 x 30, six boxes', hint: 'Positional games: who holds which box.', area: { length: 40, width: 30, cells: { along: 3, across: 2 } } },
    ],
  },
  {
    label: 'Small-sided pitch',
    presets: [
      { id: 'fa-5v5', label: '37 x 27 (5v5)', hint: 'The FA size for U7 and U8. Goals 3.66 by 1.83.', area: { length: 37, width: 27, halfway: true, ends: true } },
      { id: 'fa-7v7', label: '55 x 37 (7v7)', hint: 'The FA size for U9 and U10. Goals 3.66 by 1.83.', area: { length: 55, width: 37, halfway: true, ends: true } },
      { id: 'fa-9v9', label: '73 x 46 (9v9)', hint: 'The FA size for U11 and U12. Goals 4.88 by 2.13.', area: { length: 73, width: 46, halfway: true, ends: true } },
      { id: 'fa-11v11', label: '82 x 50 (11v11)', hint: 'The FA size for U13 and U14. Goals 6.40 by 2.13.', area: { length: 82, width: 50, halfway: true, ends: true } },
    ],
  },
]

export const AREA_PRESET_LIST: AreaPreset[] = AREA_PRESET_GROUPS.flatMap((g) => g.presets)

/** The preset a size IS, if it is one. Drives the picker's selected row. */
export function presetFor(a: SessionArea): AreaPreset | undefined {
  return AREA_PRESET_LIST.find(
    (p) =>
      p.area.length === a.length &&
      p.area.width === a.width &&
      Boolean(p.area.halfway) === Boolean(a.halfway) &&
      Boolean(p.area.ends) === Boolean(a.ends) &&
      Boolean(p.area.middle) === Boolean(a.middle) &&
      p.area.cells?.along === a.cells?.along &&
      p.area.cells?.across === a.cells?.across,
  )
}

/* -- AREA PER PLAYER --------------------------------------------------------
 *
 * The professional way to size a grid, and the thing two whole products are
 * built on: total area divided by the players in it. A coach who can see
 * `600 m2 - 8 on the grid - 75 m2 each` while dragging the handle is being told
 * something they currently work out on paper.
 *
 * The bands are the research's, not ours (docs/TRAINING.md 1c). Small-sided
 * games have been studied across 43-341 m2 per player; under about 150 they do
 * not stimulate match-level high-speed running in youth players; Barcelona's
 * 8v2 in a 10x10 is about 10 m2 each and is deliberately nowhere near match
 * demands. So the readout says which of those a coach has just built, because
 * "75 m2 each" only means something next to them.
 */
export type LoadBand = 'technical' | 'below' | 'match' | 'open'

export const LOAD_BANDS: Record<LoadBand, { label: string; note: string }> = {
  technical: {
    label: 'Technical',
    note: 'Touches, first touch and angles. Well below match running, on purpose.',
  },
  below: {
    label: 'Below match running',
    note: 'Accelerations and decisions. Under about 150 m2 each there is no match-level sprinting.',
  },
  match: {
    label: 'Match-like',
    note: 'The band where high-speed running and sprint distance start to look like a game.',
  },
  open: {
    label: 'Open',
    note: 'More distance and more sprinting, fewer touches each. A running session as much as a ball one.',
  },
}

export interface AreaStats {
  length: number
  width: number
  /** Total playing area in square metres. */
  m2: number
  /** Players standing ON the grid -- the bench is not in it. */
  players: number
  /** Square metres each, or null when nobody is on it yet. */
  per: number | null
  band: LoadBand | null
}

export function areaStats(a: SessionArea, players: number): AreaStats {
  const m2 = Math.round(a.length * a.width)
  const per = players > 0 ? Math.round(m2 / players) : null
  const band: LoadBand | null =
    per === null ? null : per < 40 ? 'technical' : per < 150 ? 'below' : per <= 341 ? 'match' : 'open'
  return { length: a.length, width: a.width, m2, players, per, band }
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
