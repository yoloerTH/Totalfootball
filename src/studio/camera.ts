/**
 * The camera: where the eye goes while the film plays.
 *
 * Ported from the videos, where every short keyframes a `Camera` — see
 * `PitchBoard` in editor/src/components/football/TacticsBoard.tsx and the
 * `cameraAt(frame)` tables in BreakShort, Zone14Short and JockeyShort. There it
 * is `{ tx, ty, scale }` applied as one transform to the whole field plane, with
 * the keyframes hand-written per beat and eased between. The model here is the
 * same one; only two things are different, and both come from the studio being
 * a tool rather than a composition:
 *
 *  · A KEYFRAME IS A PHASE. The videos put camera keys wherever the edit wants
 *    one. A coach does not author time, they author poses — so a shot belongs to
 *    a phase, and the movement between two phases is derived, exactly the way
 *    the players' movement already is (see ./tween.ts).
 *
 *  · IT IS THE VIEWBOX, NOT A TRANSFORM. The videos scale the plane. Narrowing
 *    the SVG viewBox does the same thing to the picture — counters grow as the
 *    camera pushes in, which is the house look and is what makes a push-in read
 *    as a push-in — and it does it without putting a transform between the
 *    coach's pointer and the board. `clientToPercent` in ./board/Board.tsx goes
 *    through `getScreenCTM()`, so dragging keeps landing where the coach let go
 *    at any zoom, with nothing to change.
 *
 * ── THE LINE THIS MUST NOT CROSS ────────────────────────────────────────────
 *
 * There are now two things that mean "look closer", and they are not the same
 * thing:
 *
 *   PITCH VIEW is what pitch this system is ABOUT. It is the space percent
 *   coords are measured in (./board/pitch.ts), so changing it moves where a
 *   stored 50,50 lands, which is why changing it has to remap every mark.
 *
 *   THE CAMERA is where the eye goes DURING the film. It must never touch a
 *   percent coord. It is a render-time crop and nothing else, in the same
 *   posture as the video exporter's `view` override.
 *
 * Keep them apart and a coach can widen the camera without disturbing a single
 * player. Let them merge and every zoom is a destructive edit.
 *
 * ── WHY THE SHOT IS DERIVED PER PHASE AND NOT PER FRAME ─────────────────────
 *
 * The obvious implementation is for the board to look at whatever pose it has
 * been handed and frame that. It is wrong, and visibly so. Mid-move the pose is
 * a BLEND (./tween.ts): arrows are dropped at 35% and the next set arrives at
 * 55%, and players who only exist in the next phase pop in at their new
 * positions. A frame derived from that jumps twice in the middle of every beat.
 *
 * So a shot is computed from a phase at REST, and two shots are interpolated.
 * Continuous by construction, and the same model the videos use.
 */

import { PITCH, U, cropRect, toMetres, toUnits } from './board/pitch'
import type { PitchView } from './board/pitch'
import type { Act, Shot, System } from './schema'

/*
 * `Shot` itself lives in ./schema.ts, because a coach can now draw one by hand
 * and anything a coach can author is part of the document format. Re-exported
 * here so every reader of the camera still finds it where it was.
 */
export type { Shot } from './schema'

export type CameraMode = 'off' | 'follow'

export const CAMERA_MODES: { id: CameraMode; label: string; hint: string }[] = [
  {
    id: 'off',
    label: 'Fixed',
    hint: 'The whole pitch view, every phase. What a coach draws on a whiteboard.',
  },
  {
    id: 'follow',
    label: 'Follow the ball',
    hint: 'Pushes in on the ball and travels with it between phases, the way the videos are shot. A phase with no ball is framed on what is marked on it.',
  },
]

export const DEFAULT_CAMERA: CameraMode = 'off'

/** Coerce anything stored on a document — including nothing — to a live mode. */
export function resolveCamera(id: string | undefined): CameraMode {
  return id === 'follow' ? 'follow' : 'off'
}

// ── how far it goes ──────────────────────────────────────────────────────────

/**
 * How hard the camera pushes in.
 *
 * Two numbers per setting and nothing else, because there are only two things
 * that decide whether a follow reads as a drift or as a lunge:
 *
 *   `tightest`  the hard floor on the frame, as a fraction of the crop. This is
 *               the one a coach actually feels. At 0.45 the frame is under half
 *               the pitch and a full-back is off the side of it with no warning
 *               they were ever there; at 0.68 the same phase is framed closer
 *               than the whole board and still has a team in it.
 *
 *   `margin`    grass left around the action, in METRES. It is what stops the
 *               frame sitting tight to the outermost counter, which always
 *               reads as a crop rather than as a shot. It is also, quietly, the
 *               thing that decides how OFTEN the camera moves at all: a wider
 *               margin pushes more phases past `WORTH_IT` and leaves them wide,
 *               so a system of team-shape phases stops drifting about.
 *
 * `close` is the old behaviour, kept and named rather than deleted — a coach
 * shooting one tight phase of a pressing trap should still be able to ask for
 * it. It is no longer what anybody gets without asking.
 */
export type CameraPush = 'gentle' | 'standard' | 'close'

export const CAMERA_PUSHES: {
  id: CameraPush
  label: string
  hint: string
  tightest: number
  margin: number
}[] = [
  {
    id: 'gentle',
    label: 'Gentle',
    hint: 'Barely moves. Keeps most of the pitch in shot and drifts towards the action.',
    tightest: 0.68,
    margin: 15,
  },
  {
    id: 'standard',
    label: 'Standard',
    hint: 'Frames the phase with room around it. The middle setting, and a safe one.',
    tightest: 0.56,
    margin: 11,
  },
  {
    id: 'close',
    label: 'Close',
    hint: 'Pushes right in on what each phase is about. The way the videos are cut.',
    tightest: 0.45,
    margin: 9,
  },
]

export const DEFAULT_PUSH: CameraPush = 'gentle'

/** Coerce anything stored on a document — including nothing — to a live push. */
export function resolvePush(id: string | undefined): (typeof CAMERA_PUSHES)[number] {
  return CAMERA_PUSHES.find((p) => p.id === id) ?? CAMERA_PUSHES[0]
}

// ── deriving a shot ──────────────────────────────────────────────────────────

/*
 * TIGHTEST and MARGIN used to live here as two constants. They are now the two
 * columns of CAMERA_PUSHES above, because they are the whole of what a coach is
 * choosing when they pick how hard the camera pushes, and having them in one
 * table is what makes that choice one line to read rather than two numbers to
 * find. Nothing else about the derivation changed.
 */

/**
 * Under this much push-in, don't bother.
 *
 * A camera that creeps in by 4% and back out again is a camera that looks
 * broken. Unless the box is meaningfully smaller than the crop the phase is
 * simply framed wide, which also means a system of team-shape phases gets no
 * camera movement at all rather than a constant nervous drift.
 */
const WORTH_IT = 0.93

/** How many players to pull in around the ball, to give the frame a scale. */
const NEAREST = 5

interface Pt {
  x: number
  y: number
}

/**
 * What this phase is ABOUT, in percent-of-crop.
 *
 * THE BALL IS THE SUBJECT, AND WHEN THERE IS ONE IT IS THE ONLY SUBJECT.
 *
 * This used to read every mark on the board — arrows, cues, writing, gear,
 * zones — and frame the box that held them all. On a phase whose marks sit
 * round the ball that gives the same answer. On a real board it does not: an
 * arrow drawn back to the halfway line, a ladder parked on the touchline for
 * the next drill, a coaching point written in the corner all pull the frame off
 * the ball and out towards the whole pitch, which is no camera at all. The mode
 * is called Follow the ball, so it follows the ball.
 *
 * The nearest players still come in with it. They are not a second subject —
 * they are what stops a single point pushing to the hard cap, and they are the
 * ball carrier and their immediate options, which is what a camera on the ball
 * is pointed at anyway. Dimmed players are excluded by definition: `dim` means
 * "not part of this act's lesson" (./schema.ts), and framing on someone the
 * coach has greyed out would contradict them on their own board.
 *
 * With NO ball the phase is about something else, and the marks are all there
 * is to read — so the old behaviour stands there, unchanged:
 *
 *  · every arrow's ends, which are their own statement of what happens next
 *  · anyone carrying a role cue, which is who has a job in this phase
 *  · writing, which is the coach saying "read this" as plainly as the board allows
 *  · gear, which on a session plan IS the subject
 *  · any zone or danger area, which is the space being talked about
 *
 * Text and gear count by their anchor only, never their extent: a block of
 * words is as wide as the font makes it, which this file cannot measure and
 * must not guess at, and the margin (see MARGIN in CAMERA_PUSHES) is wider than
 * any single piece of gear or line of type.
 */
function interest(act: Act): Pt[] {
  const pts: Pt[] = []
  const at = (x: number, y: number) => pts.push({ x, y })

  if (act.ball) {
    at(act.ball.x, act.ball.y)
    const ball = act.ball
    const near = act.tokens
      .filter((t) => !t.dim)
      .map((t) => ({ t, d: (t.x - ball.x) ** 2 + (t.y - ball.y) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, NEAREST)
    for (const n of near) at(n.t.x, n.t.y)
    return pts
  }

  for (const a of act.arrows) {
    at(a.from.x, a.from.y)
    at(a.to.x, a.to.y)
  }
  for (const t of act.tokens) if (t.cue && !t.dim) at(t.x, t.y)
  for (const t of act.texts ?? []) if (t.text.trim()) at(t.x, t.y)
  for (const g of act.gear ?? []) at(g.x, g.y)
  for (const b of act.bands) {
    if (!b.rect) continue
    at(b.rect.x, b.rect.y)
    at(b.rect.x + b.rect.w, b.rect.y + b.rect.h)
  }

  return pts
}

/**
 * The shot for one phase, or null to leave it wide.
 *
 * Null rather than a box of the whole view, so that "this phase has no camera"
 * and "this phase is deliberately framed wide" stay tellable apart — see
 * `lerpShot`, where the difference decides what a move to a wide phase does.
 */
export function shotFor(system: System, act: Act, view: PitchView): Shot | null {
  if (resolveCamera(system.camera) !== 'follow') return null

  /*
   * A frame the coach drew wins outright, and skips every test below it.
   *
   * Including `WORTH_IT`: that rule exists to stop the DERIVATION creeping in
   * by 4% and back out again on a phase it had nothing much to point at, which
   * looks broken. A coach who has dragged a box to almost the size of the crop
   * has said what they want, and quietly discarding it because the maths judged
   * it not worth doing would be the tool arguing with them about their own
   * board. `cameraRect` still bounds it, so "what they want" cannot mean a
   * frame full of grass that is not there.
   */
  if (act.shot) return act.shot

  const pts = interest(act)
  // A phase about shape rather than about the ball, with nothing marked on it.
  // Staying wide is the honest answer; there is nothing here to point at.
  if (pts.length < 2) return null

  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of pts) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }

  // The margin is real grass, so it is converted per axis: the same fifteen
  // metres is a bigger slice of a crop that is only half a pitch long than of a
  // full one, and a fixed percentage would breathe differently on every view.
  const margin = resolvePush(system.push).margin
  const mx = (margin / (view.x1 - view.x0)) * 100
  const my = (margin / (view.y1 - view.y0)) * 100

  const shot: Shot = {
    x: (x0 + x1) / 2,
    y: (y0 + y1) / 2,
    w: x1 - x0 + mx * 2,
    h: y1 - y0 + my * 2,
  }

  // Judged on the frame this actually produces, not on the box asked for: a
  // wide flat box on a tall crop fits to the full width and moves nothing.
  const crop = cropRect(view)
  return cameraRect(view, shot).w >= crop.w * WORTH_IT ? null : shot
}

/**
 * A wide shot, for interpolating against.
 *
 * The whole crop — which is what a board with no camera is already showing, so
 * a phase with a shot moving to a phase without one pulls out rather than cuts.
 */
const WIDE: Shot = { x: 50, y: 50, w: 100, h: 100 }

/** Blend two shots. `t` is already eased by the caller. */
export function lerpShot(a: Shot | null, b: Shot | null, t: number): Shot | null {
  if (!a && !b) return null
  const from = a ?? WIDE
  const to = b ?? WIDE
  const mix = (u: number, v: number) => u + (v - u) * t
  return {
    x: mix(from.x, to.x),
    y: mix(from.y, to.y),
    w: mix(from.w, to.w),
    h: mix(from.h, to.h),
  }
}

// ── turning a shot into a frame ──────────────────────────────────────────────

/**
 * The camera's rectangle, in SVG units.
 *
 * Three things happen here, in this order, and all three are what make a
 * derived camera safe to hand to a coach:
 *
 *  1. THE BOX IS TURNED. Percent-of-crop is metre space, so on an upright view
 *     the shot's corners land rotated a quarter turn. Taking the bounds of all
 *     four is what keeps the frame axis-aligned on both orientations.
 *  2. IT IS FITTED, never stretched. The frame keeps the crop's aspect and
 *     grows on whichever axis is short, so the box asked for is always fully in
 *     shot. This is also what makes the video match the preview across the
 *     exporter's widened, sometimes turned view.
 *  3. IT IS CLAMPED inside the crop. A shot centred near a touchline would
 *     otherwise frame grass that does not exist and render a strip of void down
 *     one side. Clamping after the interpolation bounds the whole camera path,
 *     not only its endpoints.
 */
export function cameraRect(
  view: PitchView,
  shot: Shot | null,
  /**
   * The floor on the frame, as a fraction of the crop.
   *
   * Passed rather than read off a system, because half this function's callers
   * do not have one: `Board.tsx` outlines a frame, the editor drags one, and
   * both of those are working on a view and a box. Defaulted to the gentle
   * setting so a caller that does not care gets the calm answer.
   *
   * It bounds a coach's HAND-DRAWN frame too, and that is on purpose. The cap
   * is not a rule about the derivation, it is a rule about the picture: below
   * it there is not enough pitch on screen to tell where you are.
   */
  tightest: number = CAMERA_PUSHES[0].tightest,
): { x: number; y: number; w: number; h: number } {
  const crop = cropRect(view)
  if (!shot) return crop

  const hw = shot.w / 2
  const hh = shot.h / 2
  const corners = [
    toUnits(view, shot.x - hw, shot.y - hh),
    toUnits(view, shot.x + hw, shot.y - hh),
    toUnits(view, shot.x - hw, shot.y + hh),
    toUnits(view, shot.x + hw, shot.y + hh),
  ]
  const bx0 = Math.min(...corners.map((c) => c.x))
  const bx1 = Math.max(...corners.map((c) => c.x))
  const by0 = Math.min(...corners.map((c) => c.y))
  const by1 = Math.max(...corners.map((c) => c.y))

  const aspect = crop.w / crop.h
  let w = Math.max(bx1 - bx0, (by1 - by0) * aspect)
  // Never tighter than the cap, never wider than there is grass for.
  w = Math.min(Math.max(w, crop.w * tightest), crop.w)
  const h = w / aspect

  const cx = (bx0 + bx1) / 2
  const cy = (by0 + by1) / 2
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  return {
    x: clamp(cx - w / 2, crop.x, crop.x + crop.w - w),
    y: clamp(cy - h / 2, crop.y, crop.y + crop.h - h),
    w,
    h,
  }
}

/** The viewBox a board draws through. Falls back to the whole crop. */
export function cameraViewBox(view: PitchView, shot: Shot | null, tightest?: number): string {
  const r = cameraRect(view, shot, tightest)
  return `${r.x} ${r.y} ${r.w} ${r.h}`
}

/**
 * How wide the frame is, in metres of real grass.
 *
 * For the editor's read-out. "1.6x" means nothing to anybody; "48 metres
 * across" is a distance a coach can picture, because they have stood on it.
 */
export function frameMetres(view: PitchView, shot: Shot | null, tightest?: number): number {
  const r = cameraRect(view, shot, tightest)
  // Upright views stand the pitch on its end, so the frame's width is measured
  // along the pitch's short axis either way — units are units, and U is the
  // only conversion. Capped at the pitch so padding is not reported as grass.
  return Math.min(r.w / U, view.vertical ? PITCH.width : PITCH.length)
}

/** The metre span of a whole view, so the read-out has something to compare to. */
export function viewMetres(view: PitchView): number {
  const m0 = toMetres(view, 0, 50)
  const m1 = toMetres(view, 100, 50)
  return view.vertical ? view.y1 - view.y0 : m1.x - m0.x
}
