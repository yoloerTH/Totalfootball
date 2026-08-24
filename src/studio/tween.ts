/**
 * Turning acts into motion.
 *
 * This is the file the product rests on. A coach poses act 1 and act 2; nobody
 * keyframes anything. Because token ids are stable across acts (see
 * ./schema.ts), "what moves" is a join on id, and the movement itself is a
 * lerp under the house easing curve. Everything the coach gets for free —
 * playback, the animated hand-off between slides — comes out of here.
 *
 * The board renders a RenderAct, not an Act. The difference is opacity: a
 * player who only exists in the next act has to arrive from somewhere, and an
 * Act has no room to say "40% arrived". Keeping that distinction in the render
 * model rather than the document means the stored JSON never carries
 * animation state.
 */

import { PITCH_VIEWS, resolveViewId } from './board/pitch'
import { lerpShot, shotFor, type Shot } from './camera'
import type { Act, Arrow, Band, System, Token } from './schema'

export interface RenderToken extends Token {
  opacity: number
  /** Pops above 1 briefly when a token arrives, matching the videos' entrances. */
  scale: number
}

export interface RenderArrow extends Arrow {
  opacity: number
}

/**
 * A band that carries an opacity for the transition system.
 *
 * Bands that appear or disappear between acts animate in and out instead of
 * popping — the same choreography tokens and arrows use. A band present in
 * both acts stays at opacity 1 and simply follows its players as they move,
 * which is already the whole animation. Only PRESENCE is handled here; shape
 * is derived at render time from the live token positions.
 */
export interface RenderBand extends Band {
  opacity: number
}

export interface RenderAct {
  tokens: RenderToken[]
  ball: { x: number; y: number; opacity: number } | null
  arrows: RenderArrow[]
  bands: RenderBand[]
  /**
   * Where the camera is pointed for this pose, or null for the whole view.
   *
   * It rides on the render model rather than being threaded through every
   * caller because that is what makes the camera arrive everywhere at once: the
   * editor's playback, the shared viewer, the video exporter and the print
   * sheet all build a RenderAct and hand it to the same Board, so none of them
   * needed a line changing beyond saying which system it came from.
   *
   * Which is also why it is computed HERE and not inside Board. Board is handed
   * blended poses mid-move, and a shot derived from a blend jumps twice a beat
   * — see the note at the top of ../camera.ts.
   */
  shot: Shot | null
}

/**
 * The camera's shot for one act, or null when there is no camera.
 *
 * `system` is optional on both builders below, and its absence means "no
 * camera" rather than "the default camera". That is deliberate and it is doing
 * real work: the editor poses through `resolveAct(act)` with no system, so the
 * board a coach is dragging players around on is always the full view. You
 * cannot pose what you cannot see.
 */
function shotOf(system: System | undefined, act: Act): Shot | null {
  if (!system) return null
  return shotFor(system, act, PITCH_VIEWS[resolveViewId(system.pitch)])
}

/**
 * The house easing curve: cubic-bezier(0.16, 1, 0.3, 1).
 *
 * The same curve MiniBoard.astro animates on and the same feel as the shorts —
 * a fast departure that settles a long way out. It is what makes the board
 * look like ours rather than like a generic slide transition, so it is solved
 * properly here rather than approximated with an easeOut.
 *
 * Newton-Raphson on x(t) to recover t, then evaluate y(t). Four iterations is
 * well inside a pixel for curves this tame.
 */
const CX1 = 0.16
const CY1 = 1
const CX2 = 0.3
const CY2 = 1

function bezier(a: number, b: number, t: number): number {
  const it = 1 - t
  return 3 * it * it * t * a + 3 * it * t * t * b + t * t * t
}

function bezierSlope(a: number, b: number, t: number): number {
  const it = 1 - t
  return 3 * it * it * a + 6 * it * t * (b - a) + 3 * t * t * (1 - b)
}

export function easeHouse(x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  let t = x
  for (let i = 0; i < 4; i++) {
    const slope = bezierSlope(CX1, CX2, t)
    if (Math.abs(slope) < 1e-6) break
    t -= (bezier(CX1, CX2, t) - x) / slope
  }
  return bezier(CY1, CY2, t)
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Clamp and remap `x` from [a,b] to [0,1]. */
const span = (x: number, a: number, b: number) =>
  b === a ? (x < a ? 0 : 1) : Math.min(1, Math.max(0, (x - a) / (b - a)))

/** An act at rest — everything present, nothing arriving. */
export function resolveAct(act: Act, system?: System): RenderAct {
  return {
    tokens: act.tokens.map((t) => ({ ...t, opacity: 1, scale: 1 })),
    ball: act.ball ? { ...act.ball, opacity: 1 } : null,
    arrows: act.arrows.map((a) => ({ ...a, opacity: 1 })),
    bands: act.bands.map((b) => ({ ...b, opacity: 1 })),
    shot: shotOf(system, act),
  }
}

/**
 * Blend two acts at `p` (0 = fully `from`, 1 = fully `to`).
 *
 * The timing here is the choreography of every short we have made, so it is
 * deliberate rather than uniform:
 *
 *  · Players MOVE across the whole beat, on the house curve.
 *  · Players who LEAVE fade out early (first 40%), so the board is clear
 *    before the new idea lands.
 *  · Players who ARRIVE fade in late (last 45%) with a small overshoot, which
 *    is the `EASE_OUT_BACK` pop the videos' Token uses on entry.
 *  · Arrows are never held across a beat: the old set is gone by 35% and the
 *    new set does not start until 55%. An arrow that lingered into a shape it
 *    no longer describes is the fastest way to make a board look wrong.
 *  · Bands follow the same fade windows as tokens: a new block draws in late,
 *    a removed block fades out early. A block present in both acts stays at
 *    full opacity and simply follows its players as they move — that is already
 *    the whole animation, and no extra work is needed here for it.
 *  · Cues switch at the midpoint, once the players are roughly in place.
 *  · The CAMERA moves across the whole beat on the same curve as the players,
 *    so a push-in lands with the shape rather than chasing it.
 */
export function tweenActs(from: Act, to: Act, p: number, system?: System): RenderAct {
  const t = easeHouse(Math.min(1, Math.max(0, p)))
  const byId = new Map(to.tokens.map((tok) => [tok.id, tok]))
  const fromIds = new Set(from.tokens.map((tok) => tok.id))

  const tokens: RenderToken[] = []

  for (const a of from.tokens) {
    const b = byId.get(a.id)
    if (b) {
      tokens.push({
        ...b,
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        cue: p < 0.5 ? a.cue : b.cue,
        dim: p < 0.5 ? a.dim : b.dim,
        opacity: 1,
        scale: 1,
      })
    } else {
      tokens.push({ ...a, opacity: 1 - span(p, 0, 0.4), scale: 1 })
    }
  }

  for (const b of to.tokens) {
    if (fromIds.has(b.id)) continue
    const k = easeHouse(span(p, 0.55, 1))
    tokens.push({
      ...b,
      opacity: span(p, 0.55, 0.85),
      // a touch of overshoot on arrival, settling back to 1
      scale: 0.72 + 0.28 * k + Math.sin(k * Math.PI) * 0.09,
    })
  }

  const ball =
    from.ball && to.ball
      ? { x: lerp(from.ball.x, to.ball.x, t), y: lerp(from.ball.y, to.ball.y, t), opacity: 1 }
      : from.ball
        ? { ...from.ball, opacity: 1 - span(p, 0, 0.4) }
        : to.ball
          ? { ...to.ball, opacity: span(p, 0.55, 0.85) }
          : null

  const arrows: RenderArrow[] = [
    ...from.arrows.map((a) => ({ ...a, opacity: 1 - span(p, 0, 0.35) })),
    ...to.arrows.map((a) => ({ ...a, opacity: span(p, 0.55, 0.9) })),
  ].filter((a) => a.opacity > 0.01)

  // Bands animate like tokens: new ones draw in late, removed ones fade out
  // early. A band present in both acts (matched by id) stays at opacity 1 —
  // it follows its players through the move with no additional work here.
  const fromBandIds = new Set(from.bands.map((b) => b.id))
  const toBandIds = new Set(to.bands.map((b) => b.id))

  const bands: RenderBand[] = [
    // Departing: fade out in the first 40% of the beat.
    ...from.bands
      .filter((b) => !toBandIds.has(b.id))
      .map((b) => ({ ...b, opacity: 1 - span(p, 0, 0.4) }))
      .filter((b) => b.opacity > 0.01),
    // Persistent: full opacity, shape follows live token positions.
    ...to.bands
      .filter((b) => fromBandIds.has(b.id))
      .map((b) => ({ ...b, opacity: 1 })),
    // Arriving: fade in late, same window as incoming players.
    ...to.bands
      .filter((b) => !fromBandIds.has(b.id))
      .map((b) => ({ ...b, opacity: span(p, 0.55, 0.9) }))
      .filter((b) => b.opacity > 0.01),
  ]

  // The camera travels on the same curve as the players, so the push-in and
  // the move arrive together instead of the frame chasing the ball.
  const shot = lerpShot(shotOf(system, from), shotOf(system, to), t)

  return { tokens, ball, arrows, bands, shot }
}

/**
 * Where playback is at time `ms`, given a per-act hold and a move duration.
 *
 * Hold-then-burst, the pacing note from src/components/visual/MiniBoard.astro:
 * long enough on each pose to actually read the shape, then a quick move. A
 * coach presenting can also drive this by index instead of by clock.
 */
export interface Timeline {
  index: number
  next: number
  p: number
  done: boolean
}

export const HOLD_MS = 2600
export const MOVE_MS = 1100

export function timelineAt(ms: number, actCount: number, hold = HOLD_MS, move = MOVE_MS): Timeline {
  if (actCount <= 1) return { index: 0, next: 0, p: 0, done: true }
  const beat = hold + move
  const total = actCount * beat - move
  const clamped = Math.min(ms, total)
  const index = Math.min(actCount - 1, Math.floor(clamped / beat))
  const within = clamped - index * beat
  const p = within <= hold ? 0 : (within - hold) / move
  return {
    index,
    next: Math.min(actCount - 1, index + 1),
    p,
    done: ms >= total,
  }
}

export function totalDuration(actCount: number, hold = HOLD_MS, move = MOVE_MS): number {
  return actCount <= 1 ? hold : actCount * (hold + move) - move
}
