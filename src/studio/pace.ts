/**
 * How long a phase sits on screen.
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
 * refused from the start — there is exactly one renderer, and now exactly one
 * clock driving it.
 *
 * WHY ONLY THE HOLD MOVES, AND NOT THE MOVE
 *
 * A beat is a hold then a move (see `timelineAt` in ./tween.ts). The hold is
 * reading time: it exists so a room can take in the pose and the caption, and
 * it is the part that drags when you already know what you are looking at. The
 * move is the information — it is the thing the whole studio is for, the answer
 * to "who went where" — and squeezing it does not save a coach any waiting,
 * it just makes the football harder to follow. So the slider moves the hold and
 * `MOVE_MS` stays where it is.
 *
 * WHY THE FLOOR IS A FLAT NUMBER AND NOT DERIVED FROM THE CAPTIONS
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
import { HOLD_MS } from './tween'

/**
 * The shortest hold the studio will render.
 *
 * At 1.2s a pose gets about a second of stillness before the move takes over,
 * which is the least that reads as a held position rather than a stutter
 * between two moves. Below this the film stops being a sequence of poses.
 */
export const MIN_HOLD_MS = 1200

/**
 * The longest. Past six seconds a coach is not pacing a film, they are pausing
 * one, and the control for that is the Play button.
 */
export const MAX_HOLD_MS = 6000

/** Slider granularity. Fine enough to feel, coarse enough to land on. */
export const HOLD_STEP_MS = 200

/** What every system made before this existed ran at, and still does. */
export const DEFAULT_HOLD_MS = HOLD_MS

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
