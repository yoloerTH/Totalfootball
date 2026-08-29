/**
 * The clock. How long a phase sits on screen, and how long it takes to become
 * the next one.
 *
 * WHY THIS IS ON THE DOCUMENT AND NOT AN EXPORT SETTING
 *
 * The complaint that produced this file was about the video — a coach who knew
 * their own system waiting through it. The fix could have been a number in the
 * video dialog, and that would have been wrong for the same reason the surface
 * and the camera are not video settings: pace is a property of the presentation.
 * A system paced to move quickly should move quickly when the coach presses
 * Play, when somebody opens the share link, and in the file. Anything else and
 * the preview lies about the export, which is the one thing this studio has
 * refused from the start — there is exactly one renderer, and exactly one clock
 * driving it. This module IS that clock: both numbers are defined here, and
 * ./tween.ts imports them rather than the other way round.
 *
 * WHY THE HOLD AND THE MOVE ARE TWO CONTROLS AND NOT ONE
 *
 * A beat is a hold then a move (see `timelineAt` in ./tween.ts). They are asked
 * about for opposite reasons and a single "speed" dial would tie them together
 * exactly where a coach needs them apart.
 *
 * The hold is reading time. It exists so a room can take in the pose and the
 * caption, and it is the part that drags when you already know what you are
 * looking at. That was the first request: a coach who wrote the system waiting
 * through their own words.
 *
 * The move is the information. It is the answer to "who went where", and the
 * second request was the opposite of the first — a coach who could not follow
 * the football because the players got there too quickly. Somebody rehearsing a
 * familiar shape wants short holds and a slow move: the poses they already know
 * gone quickly, the transitions they are teaching stretched out. One dial
 * cannot give them that.
 *
 * WHY SLOWING THE MOVE ALSO RELAXES THE CURVE
 *
 * The house curve is a fast departure that settles a long way out, and against
 * the 1100ms move it is far more front-loaded than the number reads: half the
 * distance is covered in the first 112ms, ninety per cent by 362ms, at an
 * opening velocity of six and a quarter times the average. The remaining
 * two-thirds of the beat is a drift.
 *
 * So a control that only stretched the clock would sell the coach something it
 * does not deliver. Doubling the move to 2200ms still puts half the travel
 * inside 224ms; they would buy a longer settle, watch the players cross the
 * pitch just as fast, and report it again. The time is only worth having if it
 * is spent on travel, which means the curve has to give as the clock does.
 *
 * It gives PROPORTIONALLY, and only above the default. At `DEFAULT_MOVE_MS` the
 * curve is the house curve to the last decimal, so every system built before
 * this existed animates exactly as it always has. See `easeHouse` in ./tween.ts.
 *
 * WHY THE MOVE'S FLOOR IS THE DEFAULT AND NOT SOMETHING SMALLER
 *
 * Because the earlier argument against a move control was right about the half
 * of the problem it was looking at: squeezing the move to shorten the film
 * destroys the one thing the studio is for. Nobody has ever asked for that.
 * The slider therefore only goes one way — 1.1s is as quick as the football
 * has ever moved here, and it stays that way.
 *
 * WHY THE HOLD'S FLOOR IS A FLAT NUMBER AND NOT DERIVED FROM THE CAPTIONS
 *
 * The obvious clever version computes a minimum from how long the phase's own
 * words take to read. It was tried, on the shipped systems, and it does not
 * survive contact with them: the library's captions run 13 to 19 words, which
 * at any defensible reading speed needs longer than the 2.6s these videos have
 * always held for. A derived floor would have pushed every existing system
 * SLOWER than its default — the exact opposite of what was asked for — and a
 * warning built on the same model would fire on the product's own defaults.
 * When a model disagrees with four years of shorts that demonstrably work, the
 * model is wrong.
 *
 * So the floor protects the only thing that is genuinely not negotiable: that a
 * pose is on screen long enough to be seen at all before it starts moving
 * again. That is a property of eyes, not of copy, and it is a constant.
 */

import type { System } from './schema'

// ── The hold ────────────────────────────────────────────────────────────────

/** What every system made before pace existed ran at, and still does. */
export const DEFAULT_HOLD_MS = 2600

/**
 * The shortest hold the studio will render.
 *
 * At 0.2s a pose can be used as a very brief beat before the move takes over.
 * This is intentionally permissive: the coach may want a near-instant cue,
 * and the fixed move still gives the transition a readable shape.
 */
export const MIN_HOLD_MS = 200

/**
 * The longest. Past six seconds a coach is not pacing a film, they are pausing
 * one, and the control for that is the Play button.
 */
export const MAX_HOLD_MS = 6000

/** Slider granularity. Fine enough to feel, coarse enough to land on. */
export const HOLD_STEP_MS = 200

// ── The move ────────────────────────────────────────────────────────────────

/**
 * What every system made before the move was adjustable ran at, and still does.
 * Also the floor: see the header.
 */
export const DEFAULT_MOVE_MS = 1100

/** The floor was the default, but reduced to allow faster transitions. */
export const MIN_MOVE_MS = 200

/**
 * The longest move.
 *
 * Three seconds of travel across a full pitch is a walk, and it is about where
 * a transition stops reading as one movement and starts reading as a scene of
 * its own. Past it the coach wants two phases, not a slower one.
 */
export const MAX_MOVE_MS = 3000

/**
 * Finer than the hold's, because the useful range is a third as wide and the
 * difference between 1.4s and 1.6s is one a coach can genuinely see.
 */
export const MOVE_STEP_MS = 100

// ── Reading the document ────────────────────────────────────────────────────

/**
 * The hold this system plays at, in milliseconds.
 *
 * Clamped here rather than only in the control, because a document does not
 * only come from the slider: it comes out of localStorage, off an account, and
 * out of a share link, any of which can carry a number this build would not
 * have produced. Every clock in the studio goes through this function, so a
 * bad value cannot reach a renderer.
 */
export function holdMs(system: Pick<System, 'hold'>): number {
  const ms = system.hold
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return DEFAULT_HOLD_MS
  return Math.min(MAX_HOLD_MS, Math.max(MIN_HOLD_MS, Math.round(ms)))
}

/**
 * The move this system plays at, in milliseconds. Clamped for the same reasons
 * as the hold, and undefined means the default, which is what every document
 * written before the control existed carries.
 */
export function moveMs(system: Pick<System, 'move'>): number {
  const ms = system.move
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return DEFAULT_MOVE_MS
  return Math.min(MAX_MOVE_MS, Math.max(MIN_MOVE_MS, Math.round(ms)))
}

/**
 * How far this system's move has been slowed, from 0 (the house curve, exactly)
 * to 1 (the fullest relaxation the studio will apply).
 *
 * Linear in the clock, so the curve loosens at the rate the slider moves and
 * the control has no dead zone. It lives here rather than in ./tween.ts because
 * it is a reading of the document, and ./tween.ts is deliberately kept to the
 * mathematics of moving something from A to B.
 */
export function moveRelax(system: Pick<System, 'move'>): number {
  const span = MAX_MOVE_MS - DEFAULT_MOVE_MS
  if (span <= 0) return 0
  return Math.min(1, Math.max(0, (moveMs(system) - DEFAULT_MOVE_MS) / span))
}
