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
import { DEFAULT_HOLD_MS, DEFAULT_MOVE_MS, moveRelax } from './pace'
import { BALL_KINDS, TOKEN_KINDS, bendOver, travel, type Pt } from './arrows'
import { ballsOf, type Act, type Arrow, type Band, type BallMark, type GearMark, type System, type TextMark, type Token } from './schema'

export interface RenderToken extends Token {
  opacity: number
  /** Pops above 1 briefly when a token arrives, matching the videos' entrances. */
  scale: number
}

export interface RenderArrow extends Arrow {
  /**
   * The transition alpha TIMES the coach's own `Arrow.opacity`.
   *
   * Those are two different facts — "half arrived" and "drawn faintly on
   * purpose" — and the board only ever needs their product, so they are
   * multiplied here rather than carried separately. An arrow the coach has
   * hidden is 0 all the way through the beat, which is exactly right: it never
   * flickers in during the fade.
   */
  opacity: number
}

/** The coach's own opacity for an arrow. Undefined is a fully drawn arrow. */
const drawnAt = (a: Arrow) => Math.min(1, Math.max(0, a.opacity ?? 1))

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

/**
 * A text mark carrying an opacity, exactly like a band.
 *
 * Text does not TRAVEL between phases even when the same mark is on both, and
 * that is deliberate rather than unfinished. A band follows its players because
 * it is drawn from them; a piece of writing is placed on the grass, and a
 * caption sliding across the board mid-move is the single most distracting
 * thing you can put on a tactics film. It appears, it holds, it goes.
 */
export interface RenderText extends TextMark {
  opacity: number
}

/**
 * A piece of gear carrying an opacity — and, unlike a text mark, a POSITION
 * that moves.
 *
 * Gear is the one mark that travels. A cone matched by id across two phases
 * lerps its x, y, size and angle over the beat, because a session plan whose
 * second phase is "the gate is wider now" shows that by widening the gate. It
 * takes no bow: `travel` routes a player around the arrows they would otherwise
 * walk through, and a cone does not walk anywhere — it is being repositioned by
 * a coach, and the honest picture of that is a straight line.
 */
export interface RenderGear extends GearMark {
  opacity: number
}

export interface RenderBall extends BallMark {
  opacity: number
}

export interface RenderAct {
  tokens: RenderToken[]
  balls: RenderBall[]
  arrows: RenderArrow[]
  bands: RenderBand[]
  texts: RenderText[]
  gear: RenderGear[]
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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * The house easing curve: cubic-bezier(0.16, 1, 0.3, 1), and the family of
 * curves it relaxes into as a coach slows the move down.
 *
 * The same curve MiniBoard.astro animates on and the same feel as the shorts —
 * a fast departure that settles a long way out. It is what makes the board
 * look like ours rather than like a generic slide transition, so it is solved
 * properly here rather than approximated with an easeOut.
 *
 * `relax` blends toward an even ease-in-out. At 0 the arithmetic is the house
 * curve's and nothing about a stored system changes; at 1 the travel is spread
 * across the beat instead of being spent in the first tenth of it. WHY that is
 * tied to the clock is argued at length in ./pace.ts. This file only knows how
 * to draw the curve it is handed.
 *
 * It blends the CONTROL POINTS, not the two curves' outputs. That is the part
 * worth not getting wrong: every intermediate setting stays a real cubic bezier
 * — monotonic, smooth, and with no kink halfway up where two independently
 * eased values happened to cross.
 *
 * Newton-Raphson on x(t) to recover t, then evaluate y(t). Six iterations
 * rather than the four the fixed curve needed: the relaxed end of the family
 * has a gentler slope near the origin, so the first correction lands further
 * from the root and the extra passes cost nothing.
 */
const HOUSE_CURVE = { x1: 0.16, y1: 1, x2: 0.3, y2: 1 } as const
const EVEN_CURVE = { x1: 0.42, y1: 0.02, x2: 0.2, y2: 1 } as const

function bezier(a: number, b: number, t: number): number {
  const it = 1 - t
  return 3 * it * it * t * a + 3 * it * t * t * b + t * t * t
}

function bezierSlope(a: number, b: number, t: number): number {
  const it = 1 - t
  return 3 * it * it * a + 6 * it * t * (b - a) + 3 * t * t * (1 - b)
}

export function easeHouse(x: number, relax = 0): number {
  if (x <= 0) return 0
  if (x >= 1) return 1

  const r = Math.min(1, Math.max(0, relax))
  const x1 = lerp(HOUSE_CURVE.x1, EVEN_CURVE.x1, r)
  const y1 = lerp(HOUSE_CURVE.y1, EVEN_CURVE.y1, r)
  const x2 = lerp(HOUSE_CURVE.x2, EVEN_CURVE.x2, r)
  const y2 = lerp(HOUSE_CURVE.y2, EVEN_CURVE.y2, r)

  let t = x
  for (let i = 0; i < 6; i++) {
    const slope = bezierSlope(x1, x2, t)
    if (Math.abs(slope) < 1e-6) break
    t -= (bezier(x1, x2, t) - x) / slope
  }
  return bezier(y1, y2, t)
}

/** Clamp and remap `x` from [a,b] to [0,1]. */
const span = (x: number, a: number, b: number) =>
  b === a ? (x < a ? 0 : 1) : Math.min(1, Math.max(0, (x - a) / (b - a)))

/** An act at rest — everything present, nothing arriving. */
export function resolveAct(act: Act, system?: System): RenderAct {
  return {
    tokens: act.tokens.map((t) => ({ ...t, opacity: 1, scale: 1 })),
    balls: ballsOf(act).map((b) => ({ ...b, opacity: 1 })),
    arrows: act.arrows.map((a) => ({ ...a, opacity: drawnAt(a) })),
    bands: act.bands.map((b) => ({ ...b, opacity: 1 })),
    // `?? []` and not `act.texts.map`: the field is optional and absent on every
    // act written before it existed. See `Act.texts` in ./schema.ts.
    texts: (act.texts ?? []).map((t) => ({ ...t, opacity: 1 })),
    gear: (act.gear ?? []).map((g) => ({ ...g, opacity: 1 })),
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
 *  · Anything a BOWED arrow describes travels along that bow instead of down
 *    the chord. A coach who curls a pass round a defender has said where the
 *    ball goes; drawing the curve and then sending the ball straight through it
 *    made the film contradict the board it came from. Which arrow governs which
 *    movement is decided in ../arrows.ts, and an unbowed one is not a special
 *    case: a quadratic with its control point on the midpoint IS the chord, to
 *    the last bit, so everything built before this animates unchanged.
 *  · Cues switch at the midpoint, once the players are roughly in place.
 *  · The CAMERA moves across the whole beat on the same curve as the players,
 *    so a push-in lands with the shape rather than chasing it.
 */
export function tweenActs(from: Act, to: Act, p: number, system?: System): RenderAct {
  /*
   * The curve comes off the document, exactly as the camera does two lines
   * further down, so nothing above this function had to learn about it: every
   * caller that animates a real system — the editor's playback, the shared
   * viewer, the video exporter — was already passing one in for the camera.
   * No system means the house curve, which is what the preview page and any
   * bare tween want.
   */
  const relax = system ? moveRelax(system) : 0
  const t = easeHouse(Math.min(1, Math.max(0, p)), relax)
  const byId = new Map(to.tokens.map((tok) => [tok.id, tok]))
  const fromIds = new Set(from.tokens.map((tok) => tok.id))

  /*
   * The space the bows are solved in. `resolveViewId(undefined)` is 'full',
   * which is what a bare tween with no system should get and is also what it
   * has always effectively drawn.
   */
  const view = PITCH_VIEWS[resolveViewId(system?.pitch)]
  /*
   * Read off the phase the arrows are DRAWN on. An arrow belongs to the
   * transition out of `from`, which is exactly the transition being played.
   */
  const marks = from.arrows

  const tokens: RenderToken[] = []

  /*
   * How far each player travelled, kept for the ball. A ball whose journey is
   * the same journey as somebody else's is a ball being CARRIED, and it has to
   * take that player's bow or it leaves their feet halfway through the move.
   */
  const carried: { by: string; from: Pt; to: Pt; bend: number }[] = []

  for (const a of from.tokens) {
    const b = byId.get(a.id)
    if (b) {
      const bend = bendOver(marks, from.tokens, to.tokens, { from: a, to: b }, TOKEN_KINDS, view)
      const at = travel(a, b, bend, t, view)
      if (bend) carried.push({ by: a.id, from: { x: a.x, y: a.y }, to: { x: b.x, y: b.y }, bend })
      tokens.push({
        ...b,
        x: at.x,
        y: at.y,
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
    const k = easeHouse(span(p, 0.55, 1), relax)
    tokens.push({
      ...b,
      opacity: span(p, 0.55, 0.85),
      // a touch of overshoot on arrival, settling back to 1
      scale: 0.72 + 0.28 * k + Math.sin(k * Math.PI) * 0.09,
    })
  }

  /*
   * The balls, matched by id — the same rule the counters and the gear are on.
   *
   * A ball on both phases TRAVELS; one only on the way out fades; one only on
   * the way in fades up. Which is why the id matters: without it a rondo whose
   * six balls all move would be six balls blinking out and six others blinking
   * in, rather than six balls being played.
   */
  const fromBalls = ballsOf(from)
  const toBalls = ballsOf(to)
  const balls: RenderBall[] = []

  for (const a of fromBalls) {
    const b = toBalls.find((x) => x.id === a.id)
    if (!b) {
      balls.push({ ...a, opacity: 1 - span(p, 0, 0.4) })
      continue
    }
    const move = { from: a, to: b }
    /*
     * A carrier's bow first, and by an EXACT match on the journey rather
     * than by proximity: `perform` moves a carried ball by the player's
     * own displacement, so the two paths are the same path to the metre.
     * Anything looser would let a ball near a runner get dragged onto a
     * curve it was never on.
     */
    const rider = carried.find(
      (c) =>
        Math.abs(c.to.x - c.from.x - (b.x - a.x)) < 0.05 &&
        Math.abs(c.to.y - c.from.y - (b.y - a.y)) < 0.05,
    )
    const bend = rider
      ? rider.bend
      : bendOver(marks, from.tokens, to.tokens, move, BALL_KINDS, view)
    const at = travel(a, b, bend, t, view)
    balls.push({ id: a.id, x: at.x, y: at.y, opacity: 1 })
  }
  for (const b of toBalls) {
    if (fromBalls.some((x) => x.id === b.id)) continue
    balls.push({ ...b, opacity: span(p, 0.55, 0.85) })
  }

  const arrows: RenderArrow[] = [
    ...from.arrows.map((a) => ({ ...a, opacity: drawnAt(a) * (1 - span(p, 0, 0.35)) })),
    ...to.arrows.map((a) => ({ ...a, opacity: drawnAt(a) * span(p, 0.55, 0.9) })),
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

  /*
   * Text hands over the way the CHROME's words do rather than the way a band
   * does: the outgoing line is gone before the incoming one starts, with no
   * overlap in the middle. Two captions cross-fading through each other over a
   * moving board is unreadable, and unreadable is the one thing a caption
   * cannot be. A mark present on both phases and unchanged simply holds.
   */
  const fromTexts = from.texts ?? []
  const toTexts = to.texts ?? []
  const fromTextIds = new Set(fromTexts.map((x) => x.id))
  const toTextIds = new Set(toTexts.map((x) => x.id))

  const texts: RenderText[] = [
    ...fromTexts
      .filter((x) => !toTextIds.has(x.id))
      .map((x) => ({ ...x, opacity: 1 - span(p, 0, 0.32) })),
    ...toTexts.filter((x) => fromTextIds.has(x.id)).map((x) => ({ ...x, opacity: 1 })),
    ...toTexts
      .filter((x) => !fromTextIds.has(x.id))
      .map((x) => ({ ...x, opacity: span(p, 0.6, 0.95) })),
  ].filter((x) => x.opacity > 0.01)

  /*
   * Gear moves like a player and fades like a band.
   *
   * `t` and not `p`: the eased progress, so a cone being pushed two metres
   * wider accelerates and settles on the same curve the players do. A phase
   * where the coach moved the gate and nobody else moved should still read as
   * one motion rather than as a board with two different clocks on it.
   */
  const fromGear = from.gear ?? []
  const toGear = to.gear ?? []
  const toGearById = new Map(toGear.map((g) => [g.id, g]))
  const fromGearIds = new Set(fromGear.map((g) => g.id))

  const gear: RenderGear[] = [
    ...fromGear.map((g) => {
      const b = toGearById.get(g.id)
      if (!b) return { ...g, opacity: 1 - span(p, 0, 0.4) }
      return {
        ...b,
        x: g.x + (b.x - g.x) * t,
        y: g.y + (b.y - g.y) * t,
        size: (g.size ?? 1) + ((b.size ?? 1) - (g.size ?? 1)) * t,
        angle: (g.angle ?? 0) + ((b.angle ?? 0) - (g.angle ?? 0)) * t,
        opacity: 1,
      }
    }),
    ...toGear
      .filter((g) => !fromGearIds.has(g.id))
      .map((g) => ({ ...g, opacity: span(p, 0.55, 0.85) })),
  ].filter((g) => g.opacity > 0.01)

  // The camera travels on the same curve as the players, so the push-in and
  // the move arrive together instead of the frame chasing the ball.
  const shot = lerpShot(shotOf(system, from), shotOf(system, to), t)

  return { tokens, balls, arrows, bands, texts, gear, shot }
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

export function timelineAt(
  ms: number,
  actCount: number,
  hold = DEFAULT_HOLD_MS,
  move = DEFAULT_MOVE_MS,
): Timeline {
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

/**
 * A single phase with no pause is the one document the pace controls can
 * describe but a video cannot be: the hold IS the whole film, so a hold of zero
 * asks for zero frames. It gets a still instead, long enough to be a file
 * somebody can play. Every system with more than one phase, and every
 * single-phase system anybody has ever made (the shortest hold before the
 * control went to zero was 0.2s), is untouched by this.
 */
const STILL_MS = 600

export function totalDuration(actCount: number, hold = DEFAULT_HOLD_MS, move = DEFAULT_MOVE_MS): number {
  return actCount <= 1 ? Math.max(hold, STILL_MS) : actCount * (hold + move) - move
}
