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
import { ballsOf, type Act, type BallMark, type Shot, type System } from './schema'

/*
 * `Shot` itself lives in ./schema.ts, because a coach can now draw one by hand
 * and anything a coach can author is part of the document format. Re-exported
 * here so every reader of the camera still finds it where it was.
 */
export type { Shot } from './schema'

export type CameraMode = 'off' | 'follow' | 'manual'

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
  {
    id: 'manual',
    label: 'Manual',
    hint: 'Frame the shot yourself on each phase by dragging the dashed camera box. It never automatically moves to follow the play.',
  },
]

export const DEFAULT_CAMERA: CameraMode = 'off'

/** Coerce anything stored on a document — including nothing — to a live mode. */
export function resolveCamera(id: string | undefined): CameraMode {
  return id === 'follow' ? 'follow' : id === 'manual' ? 'manual' : 'off'
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
  /*
   * EVERY SETTING WAS ONE STEP TOO TIGHT, and all three moved together.
   *
   * `tightest` was 0.68 / 0.56 / 0.45 and is now 0.80 / 0.68 / 0.56. On an
   * upright full pitch that is a floor of 54 / 46 / 38 metres across instead of
   * 46 / 38 / 31, which is the difference between seeing a back four and seeing
   * two of them. The complaint was that a followed phase lost the shape the
   * phase was about, and a camera that has to be corrected by hand on every
   * phase is not a camera setting, it is a chore.
   *
   * The margins moved much less. `margin` is what decides whether a frame ends
   * up wider than WORTH_IT and therefore does not move at all, so opening it
   * out as hard as the floor would have quietly turned Gentle into Fixed on
   * half the phases in a film. The floor is the honest control for "show me
   * more"; the margin is only there to keep the subject off the edge.
   */
  {
    id: 'gentle',
    label: 'Gentle',
    hint: 'Barely moves. Keeps most of the pitch in shot and drifts towards the action.',
    tightest: 0.8,
    margin: 15,
  },
  {
    id: 'standard',
    label: 'Standard',
    hint: 'Frames the phase with room around it. The middle setting, and a safe one.',
    tightest: 0.68,
    margin: 12,
  },
  {
    id: 'close',
    label: 'Close',
    hint: 'Pushes right in on what each phase is about. The way the videos are cut.',
    tightest: 0.56,
    margin: 10,
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

interface Pt {
  x: number
  y: number
}

/**
 * WHICH BALL THE CAMERA IS FOLLOWING, on a phase that has several.
 *
 * ── WHY IT LOOKS BACKWARDS INSTEAD OF BEING WRITTEN FORWARDS ────────────────
 *
 * `Act.trackingBallId` is not "the ball this phase tracks". It is "FROM this
 * phase on, track this ball" — a choice made once, on the phase the coach made
 * it on, and written nowhere else. Every later phase inherits it by finding it
 * here.
 *
 * The obvious alternative — stamp the id onto this act and every act after it —
 * is what this replaced, and it loses the coach's work. Pick ball A on phase 1,
 * ball B on phase 5, then go back and change phase 1 to ball C: the stamp runs
 * to the end of the film and phase 5's choice is gone, silently, on an edit
 * that was only supposed to touch the opening. Reading backwards cannot do
 * that. The nearest choice at or before the phase wins, so an earlier edit
 * governs exactly the phases that have not made a choice of their own.
 *
 * THREE STATES, and the middle one is why this is `string | null | undefined`:
 *
 *  · undefined — this phase said nothing. Inherit whatever came before it.
 *  · a string  — from here on, follow that ball.
 *  · null      — from here on, follow NO particular ball. This is how a coach
 *                takes the reference off again without the phase before it
 *                putting it straight back, and it is the reason `undefined`
 *                could not be made to mean both "nothing said" and "none
 *                wanted".
 *
 * A document written by the version that stamped forwards reads back the same
 * through here: a run of identical ids resolves to that id at every phase in
 * the run, which is what the run meant.
 *
 * `at` is the index of the phase the live choice was made on, or -1 for none.
 */
export function referenceBallChoice(
  acts: Act[],
  index: number,
): { id: string | null; at: number } {
  for (let i = Math.min(index, acts.length - 1); i >= 0; i--) {
    const chosen = acts[i].trackingBallId
    if (chosen !== undefined) return { id: chosen, at: i }
  }
  return { id: null, at: -1 }
}

/**
 * The chosen ball's id at this phase, without asking where it was chosen.
 *
 * `at` is not decoration on the answer, it is the other half of it: the panel
 * that says "following this ball" has to be able to say WHERE that was decided,
 * or a coach standing on phase 9 wondering why the camera is on the wrong ball
 * has nowhere to go to change it. Both come out of one walk so the sentence on
 * screen and the shot in the film cannot disagree about which choice is live.
 */
export function referenceBallId(acts: Act[], index: number): string | null {
  return referenceBallChoice(acts, index).id
}

/**
 * The ball this phase's camera follows, or null to leave the phase wide.
 *
 * The phase is located in the DOCUMENT by id rather than by object identity,
 * because the pose the exporters and the viewer hold is rebuilt rather than
 * passed through — see ../tween.ts. A phase that is not in the document at all
 * (a preview, one mid-insert) falls back to reading its own field, which is the
 * only honest answer available without the film around it.
 *
 * ONE BALL ON THE PHASE STILL WINS ON ITS OWN. That is what every document did
 * before any of this existed and it must not need a choice to keep doing it. It
 * is also the graceful answer when the chosen ball is not on this phase — the
 * coach picked one that has since been taken off, or one that only appears
 * later — because following the only ball there is beats a camera that silently
 * gives up on a phase with an obvious subject.
 */
export function trackedBall(system: System, act: Act): BallMark | null {
  const balls = ballsOf(act)
  if (balls.length === 0) return null

  const i = system.acts.findIndex((a) => a.id === act.id)
  const wanted = i < 0 ? (act.trackingBallId ?? null) : referenceBallId(system.acts, i)
  if (wanted) {
    const hit = balls.find((b) => b.id === wanted)
    if (hit) return hit
  }

  return balls.length === 1 ? balls[0] : null
}

/**
 * What this phase is ABOUT, in percent-of-crop.
 *
 * THE BALL IS THE SUBJECT, AND WHEN THERE IS ONE IT IS THE ONLY SUBJECT.
 *
 * ONE ball, resolved by `trackedBall` and handed in. A phase with several and
 * no choice made is handled by `shotFor` before it reaches here — there is no
 * single subject to be had, so the camera goes manual.
 *
 * This used to read every mark on the board — arrows, cues, writing, gear,
 * zones — and frame the box that held them all. On a phase whose marks sit
 * round the ball that gives the same answer. On a real board it does not: an
 * arrow drawn back to the halfway line, a ladder parked on the touchline for
 * the next drill, a coaching point written in the corner all pull the frame off
 * the ball and out towards the whole pitch, which is no camera at all. The mode
 * is called Follow the ball, so it follows the ball.
 *
 * ONE POINT, not the ball and its neighbours. Pulling the nearest players in
 * sized the frame to how spread out they were, which sounds adaptive and is
 * actually a camera that moves when nobody kicked anything: drag a full-back
 * five metres and the whole frame breathes, on a phase the coach did not touch.
 * A camera the coach cannot predict is worse than one that is occasionally too
 * wide. The size comes from the push setting instead — see `shotFor`.
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
 * Dimmed players are excluded by definition — `dim` means "not part of this
 * act's lesson" (./schema.ts), and framing on someone the coach has greyed out
 * would contradict them on their own board.
 *
 * Text and gear count by their anchor only, never their extent: a block of
 * words is as wide as the font makes it, which this file cannot measure and
 * must not guess at, and the margin (see MARGIN in CAMERA_PUSHES) is wider than
 * any single piece of gear or line of type.
 */
function interest(act: Act, tracked: BallMark | null): Pt[] {
  const pts: Pt[] = []
  const at = (x: number, y: number) => pts.push({ x, y })

  if (tracked) {
    at(tracked.x, tracked.y)
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
  /*
   * THE PHASE OVERRULES THE DOCUMENT.
   *
   * `Act.camera` undefined means "whatever the system says", which is every
   * phase of every document written before this line existed, so nothing
   * already made moves by a pixel. Set on a phase, it wins.
   *
   * It is here rather than above `act.shot` on purpose: a phase turned off is
   * off, hand-drawn frame or not, because the whole point is to hold the
   * opening of a film still while the phases that carry the idea track.
   */
  const mode = resolveCamera(act.camera ?? system.camera)
  if (mode === 'off') return null
  if (act.shot) return act.shot
  if (mode === 'manual') return cropRect(view)
  /*
   * SEVERAL BALLS MEANS THE COACH DRIVES, UNTIL THE COACH NAMES ONE.
   *
   * A camera that follows the ball needs there to be a ball to follow. Put six
   * out for a rondo and there is no answer to "which one" that the tool can
   * work out for itself: framing the box that holds them all is the whole pitch
   * again, and picking one for them is the tool deciding what the phase is
   * about on a phase where the coach has said it is about all of them.
   *
   * So it hands the frame back — unless the coach has said which one, which is
   * what `trackedBall` reads. Then there IS an answer to "which one", it is
   * theirs, and the camera follows it exactly as it follows a lone ball.
   *
   * With several balls and nothing named, `act.shot` above is the frame a coach
   * drew and it is the only thing that will move the camera — which is what
   * manual means. With none drawn the phase plays wide, and wide is the honest
   * picture of a drill with balls all over it.
   */
  const tracked = trackedBall(system, act)
  if (ballsOf(act).length > 1 && !tracked) return null

  const pts = interest(act, tracked)
  /*
   * A phase about shape rather than about the ball, with nothing marked on it.
   * Staying wide is the honest answer; there is nothing here to point at.
   *
   * One point is enough when that point is the ball — the box below is the
   * margin, and `cameraRect` opens it out to the push's `tightest`. That is the
   * whole reason a ball phase no longer needs its neighbours for scale: the
   * frame is a fixed size the coach chose, panning to wherever the ball is.
   */
  if (pts.length < (tracked ? 1 : 2)) return null

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
