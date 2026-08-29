/**
 * Set pieces: a ball, a goal, and twenty-two men laid out in METRES.
 *
 * ── WHY THIS IS NOT A FORMATION ─────────────────────────────────────────────
 *
 * `formations.ts` stores a shape in team space — `depth` 0→1 from a side's own
 * goal to its front line, `width` 0→1 across — and `place()` maps that into a
 * band of whatever crop the coach is on. That is exactly right for a shape,
 * which is a set of RELATIONSHIPS and has to survive a change of view, and
 * exactly wrong for a dead ball, which is a set of ABSOLUTE distances from one
 * goal. A near-post runner stands five metres off the six-yard line. Not "a
 * proportion of the band" — five metres. Squeeze that through a band and the
 * routine stops being true the moment anything about the crop changes.
 *
 * So a set piece is authored here in metres and placed straight through
 * `toPercent`, touching neither `BANDS` nor `castFor`.
 *
 * ── THE COORDINATE SPACE, WHICH IS THE POINT OF THE FILE ────────────────────
 *
 * Every spot is `{ d, s }`, read off the goal THE BALL IS GOING INTO:
 *
 *   · `d` — metres out from that goal line. 0 is on the line, 16.5 is the edge
 *           of the penalty area, 52.5 is the halfway line.
 *   · `s` — metres across, 0 at the LEFT edge of the screen, 68 at the right.
 *
 * `s` is screen-relative and not pitch-relative, and that is deliberate: it
 * makes one authored routine read identically on both boards. `spotToMetres`
 * is where the two views diverge and the only place they do — the attacking
 * board hangs its goal at x=105 and runs `s` with the pitch's y, the defending
 * board hangs ours at x=0 and runs `s` against it, because that board is turned
 * the other way (`flip` in board/pitch.ts). Author once, read the same twice.
 *
 * ── WHY THE CASTS ARE SEPARATE FROM THE PIECES ──────────────────────────────
 *
 * The shape of a corner does not depend on which side of it you are. An
 * in-swinger is the same eleven positions whether you are hitting it or
 * defending it, so `INSWINGER` and `ZONAL` are written once and the pieces
 * below compose them, saying only which cast belongs to the coach (`ours`) and
 * which board it is drawn on. Two boards, one geometry, no chance of the
 * attacking corner and the defending corner quietly disagreeing about where the
 * near post runner stands.
 *
 * ── SPACING IS CHECKED, NOT EYEBALLED ───────────────────────────────────────
 *
 * A counter is 4.2m across on a board drawn in real metres (`TOKEN_R` in
 * board/Token.tsx), which is enormous next to an 18.32m six-yard box. Twenty-two
 * of them in a penalty area WILL collide, and a routine whose near-post runner
 * is hidden under his marker teaches nothing. `scripts/check-setpieces.mjs`
 * runs every pair on every piece and prints the ones that foul, with the metres
 * they are short by. Nothing here was measured by eye.
 */

import { PITCH, toPercent } from './board/pitch'
import type { PitchView, PitchViewId } from './board/pitch'
import type { ArrowKind, Side, Token } from './schema'

/** Clear metres wanted between two counters on the SAME side. Two counters plus air. */
export const CLEAR_SAME = 4.6

/**
 * Clear metres wanted between counters on OPPOSITE sides.
 *
 * Tighter on purpose. A marker who stands 4.6m off his man has not marked him,
 * and a diagram that separates every duel to keep the counters tidy has drawn a
 * different set piece from the one the coach meant. The rims may touch; the
 * faces and the numbers must still be readable, which is what this buys.
 */
export const CLEAR_CROSS = 3.6

/** A point on a set-piece board. See the coordinate note above. */
export interface Spot {
  /** Metres out from the goal the ball is going into. */
  d: number
  /** Metres across, 0 at the left edge of the screen. */
  s: number
  /**
   * What goes on the counter when there is nobody yet to stand here.
   *
   * Only ever used for a side with no players on the phase at all. A coach who
   * has already picked their squad keeps their own men, their names and their
   * faces — see `arrange`.
   */
  label: string
  /** The one spot on a cast that must be the goalkeeper. */
  gk?: boolean
}

export interface SetPiece {
  id: string
  /** How a coach says it. */
  label: string
  /** Grouping in the picker. */
  family: string
  /** One line on what it is for, in their language. */
  hint: string
  /** The board it is drawn on. Applying a piece switches the view to this. */
  view: PitchViewId
  /** Which cast is the coach's own side. */
  ours: 'attack' | 'defend'
  /** Where the ball is placed. */
  ball: { d: number; s: number }
  attack: Spot[]
  defend: Spot[]
  /**
   * The delivery, drawn from the ball.
   *
   * One arrow and no more. The rest of a routine is the coach's to draw, and a
   * board that arrives with nine arrows on it is a board they have to clear
   * before they can think. This one is here because the ball has to go
   * somewhere for the picture to mean anything, and because a bowed delivery is
   * the mark that says in-swinger rather than "a ball, at a corner".
   */
  delivery?: { d: number; s: number; bend: number; kind: ArrowKind }
}

/* ── THE CASTS ──────────────────────────────────────────────────────────────
 *
 * Ordered MOST IMPORTANT FIRST, and that ordering is load-bearing: a coach with
 * seven players on the phase gets the seven spots that matter, not the first
 * seven somebody happened to type. The goalkeeper is first on any cast that
 * defends and last on any cast that attacks, for the same reason — theirs is
 * standing on the halfway line, and if only seven counters are going down he is
 * not one of them.
 */

/** Attacking a corner from the RIGHT of the screen: near post flick, far post finish. */
const INSWINGER: Spot[] = [
  { d: 3.0, s: 63.0, label: 'LW' },
  { d: 10.5, s: 40.5, label: 'CB' },
  { d: 11.5, s: 35.0, label: 'ST' },
  { d: 10.5, s: 29.5, label: 'CB' },
  { d: 15.5, s: 37.5, label: 'CF' },
  { d: 20.5, s: 31.0, label: 'CM' },
  { d: 8.0, s: 58.0, label: 'RW' },
  { d: 16.0, s: 46.0, label: 'RB' },
  { d: 28.0, s: 40.0, label: 'DM' },
  { d: 41.0, s: 26.0, label: 'LB' },
  { d: 50.0, s: 34.0, label: 'GK', gk: true },
]

/** The same corner played short: two out to the flag, the box held back. */
const CORNER_SHORT: Spot[] = [
  { d: 2.5, s: 63.0, label: 'LW' },
  { d: 8.0, s: 61.0, label: 'RW' },
  { d: 15.0, s: 56.0, label: 'RB' },
  { d: 10.5, s: 40.5, label: 'CB' },
  { d: 11.5, s: 35.0, label: 'ST' },
  { d: 10.5, s: 29.5, label: 'CB' },
  { d: 16.0, s: 37.5, label: 'CF' },
  { d: 21.5, s: 30.0, label: 'CM' },
  { d: 29.0, s: 44.0, label: 'DM' },
  { d: 41.0, s: 26.0, label: 'LB' },
  { d: 50.0, s: 34.0, label: 'GK', gk: true },
]

/** Defending a corner: four zonal on the six, both posts, two men marked, one out short. */
const ZONAL: Spot[] = [
  { d: 1.5, s: 34.0, label: 'GK', gk: true },
  { d: 0.8, s: 39.0, label: 'LB' },
  { d: 0.8, s: 29.0, label: 'RB' },
  { d: 6.0, s: 42.5, label: 'CB' },
  { d: 6.0, s: 37.5, label: 'CB' },
  { d: 6.0, s: 32.5, label: 'DM' },
  { d: 6.0, s: 27.5, label: 'CM' },
  { d: 9.5, s: 47.0, label: 'CM' },
  { d: 17.5, s: 33.0, label: 'ST' },
  { d: 21.0, s: 38.0, label: 'CF' },
  { d: 11.5, s: 54.0, label: 'RW' },
]

/** Attacking a wide free kick from the right, delivered into the box. */
const FK_WIDE_ON: Spot[] = [
  { d: 25.5, s: 59.5, label: 'LW' },
  { d: 26.5, s: 53.0, label: 'CM' },
  { d: 8.5, s: 39.0, label: 'CB' },
  { d: 9.5, s: 33.5, label: 'ST' },
  { d: 8.5, s: 28.0, label: 'CB' },
  { d: 17.5, s: 35.5, label: 'CF' },
  { d: 17.5, s: 29.5, label: 'RB' },
  { d: 20.0, s: 40.0, label: 'RW' },
  { d: 30.0, s: 34.0, label: 'DM' },
  { d: 42.0, s: 26.0, label: 'LB' },
  { d: 50.0, s: 34.0, label: 'GK', gk: true },
]

/** Defending it: a flat line holding the edge of the box, two spare inside. */
const FK_WIDE_OFF: Spot[] = [
  { d: 4.0, s: 33.0, label: 'GK', gk: true },
  { d: 13.5, s: 43.0, label: 'LB' },
  { d: 13.5, s: 38.0, label: 'CB' },
  { d: 13.5, s: 33.0, label: 'CB' },
  { d: 13.5, s: 28.0, label: 'CB' },
  { d: 13.5, s: 23.0, label: 'RB' },
  { d: 4.5, s: 38.0, label: 'DM' },
  { d: 4.5, s: 28.0, label: 'CM' },
  { d: 17.0, s: 47.5, label: 'RW' },
  { d: 22.5, s: 52.0, label: 'CM' },
  { d: 25.0, s: 40.0, label: 'ST' },
]

/** Defending a direct free kick: a wall of five, nine metres off the ball. */
const FK_DIRECT_OFF: Spot[] = [
  { d: 4.0, s: 30.0, label: 'GK', gk: true },
  { d: 13.9, s: 29.5, label: 'CB' },
  { d: 13.9, s: 34.2, label: 'CB' },
  { d: 13.9, s: 38.9, label: 'ST' },
  { d: 13.9, s: 43.6, label: 'CF' },
  { d: 13.9, s: 24.8, label: 'DM' },
  { d: 8.0, s: 39.0, label: 'LB' },
  { d: 8.0, s: 25.0, label: 'RB' },
  { d: 8.0, s: 44.5, label: 'LW' },
  { d: 18.0, s: 27.0, label: 'CM' },
  { d: 18.5, s: 46.5, label: 'RW' },
]

/** Taking it: two over the ball, the rest spread for the second ball. */
const FK_DIRECT_ON: Spot[] = [
  { d: 26.5, s: 31.5, label: 'CM' },
  { d: 24.5, s: 37.5, label: 'LW' },
  { d: 27.0, s: 26.5, label: 'RW' },
  { d: 18.0, s: 36.0, label: 'ST' },
  { d: 18.5, s: 41.0, label: 'CF' },
  { d: 14.0, s: 20.0, label: 'LB' },
  { d: 14.0, s: 49.0, label: 'RB' },
  { d: 9.0, s: 48.5, label: 'CB' },
  { d: 30.0, s: 40.0, label: 'DM' },
  { d: 42.0, s: 28.0, label: 'CB' },
  { d: 50.0, s: 34.0, label: 'GK', gk: true },
]

/**
 * The pieces, in picker order.
 *
 * Five, and every one of them is a board a coach has actually stood in front of
 * a room and drawn. Corners first because corners are most of the dead balls
 * anybody rehearses, and the defensive corner sits with them rather than in a
 * group of its own — a coach working on corners this week works on both ends of
 * them in the same session.
 */
export const SET_PIECES: SetPiece[] = [
  {
    id: 'corner-in',
    label: 'Attacking corner, in-swinger',
    family: 'Corners',
    hint: 'Taken from the right, bent towards the goal, three arriving across the six.',
    view: 'attacking-set-piece',
    ours: 'attack',
    ball: { d: 0.8, s: 66.5 },
    attack: INSWINGER,
    defend: ZONAL,
    delivery: { d: 8.5, s: 36.0, bend: 0.35, kind: 'pass' },
  },
  {
    id: 'corner-short',
    label: 'Attacking corner, short',
    family: 'Corners',
    hint: 'Two to the flag to make it 2 v 1, the cross from an improved angle.',
    view: 'attacking-set-piece',
    ours: 'attack',
    ball: { d: 0.8, s: 66.5 },
    attack: CORNER_SHORT,
    defend: ZONAL,
    delivery: { d: 7.0, s: 60.0, bend: 0, kind: 'pass' },
  },
  {
    id: 'corner-defend',
    label: 'Defending a corner, zonal',
    family: 'Corners',
    hint: 'Four across the six, both posts filled, two men picked up, one out short.',
    view: 'defending-set-piece',
    ours: 'defend',
    ball: { d: 0.8, s: 66.5 },
    attack: INSWINGER,
    defend: ZONAL,
    delivery: { d: 8.5, s: 36.0, bend: 0.35, kind: 'pass' },
  },
  {
    id: 'fk-wide',
    label: 'Wide free kick, delivered',
    family: 'Free kicks',
    hint: 'From the right channel into the box, three attacking the line.',
    view: 'attacking-set-piece',
    ours: 'attack',
    ball: { d: 24.0, s: 56.0 },
    attack: FK_WIDE_ON,
    defend: FK_WIDE_OFF,
    delivery: { d: 9.0, s: 34.0, bend: 0.3, kind: 'pass' },
  },
  {
    id: 'fk-wall',
    label: 'Defending a free kick, wall',
    family: 'Free kicks',
    hint: 'Central, on the edge of the D. A wall of five at the regulation nine metres.',
    view: 'defending-set-piece',
    ours: 'defend',
    ball: { d: 23.0, s: 34.0 },
    attack: FK_DIRECT_ON,
    defend: FK_DIRECT_OFF,
    delivery: { d: 0.5, s: 37.0, bend: 0.25, kind: 'pass' },
  },
]

export const SET_PIECE_BY_ID = new Map(SET_PIECES.map((p) => [p.id, p]))

/**
 * A spot, in pitch metres, for the board it is being drawn on.
 *
 * THE ONLY PLACE THE TWO BOARDS DIFFER. See the coordinate note at the top.
 */
export function spotToMetres(view: PitchView, sp: { d: number; s: number }): { x: number; y: number } {
  return view.flip
    ? { x: sp.d, y: PITCH.width - sp.s }
    : { x: PITCH.length - sp.d, y: sp.s }
}

/** A spot, in the percent-of-crop a token and an arrow are stored in. */
export function spotToPercent(view: PitchView, sp: { d: number; s: number }): { x: number; y: number } {
  const m = spotToMetres(view, sp)
  const p = toPercent(view, m.x, m.y)
  return { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }
}

/** Which cast is whose, on this piece. */
export function castFor(piece: SetPiece, side: Side): Spot[] {
  const ours = piece.ours === 'attack' ? piece.attack : piece.defend
  const theirs = piece.ours === 'attack' ? piece.defend : piece.attack
  return side === 'us' ? ours : theirs
}

/** A token that looks like the goalkeeper, by the label a shape gives one. */
function isKeeper(t: Token): boolean {
  return t.label.trim().toUpperCase() === 'GK' || /-GK$/i.test(t.id)
}

/**
 * Move a side onto a set piece.
 *
 * ── IT MOVES PEOPLE, IT DOES NOT REPLACE THEM ───────────────────────────────
 *
 * This is the whole difference between this and `place()`, and it is the reason
 * a coach can press a set piece on a board they have spent an hour on. Their
 * players keep their ids, their names, their faces, their bibs and their cues,
 * and only their positions change. A stable id is what every tween in the
 * document is joined on (see schema.ts), so handing back eleven strangers would
 * break the move between this phase and the one after it — and it would throw
 * away the squad, which on a set-piece board is most of the value: a corner
 * routine is about WHICH man attacks the near post.
 *
 * The keeper is matched first and by himself. Everyone else is dealt out in
 * document order onto the spots in cast order, so the important spots fill
 * first and a short-handed side simply leaves the deep ones empty.
 *
 * Anybody past the end of the cast is LEFT WHERE THEY STAND rather than
 * deleted, the same promise `castFor` makes in formations.ts: a coach with
 * fourteen counters on a phase put the extra three there on purpose.
 */
export function arrange(piece: SetPiece, side: Side, view: PitchView, tokens: Token[]): Token[] {
  const spots = castFor(piece, side)
  const mine = tokens.filter((t) => t.side === side)

  if (mine.length === 0) {
    return spots.map((sp, i) => ({
      id: `${side}-sp${i + 1}`,
      ...spotToPercent(view, sp),
      label: sp.label,
      side,
    }))
  }

  const keeperSpot = spots.findIndex((sp) => sp.gk)
  const keeper = mine.find(isKeeper)
  const rest = mine.filter((t) => t !== keeper)

  const taken: Token[] = []
  let next = 0
  spots.forEach((sp, i) => {
    if (i === keeperSpot && keeper) {
      taken.push({ ...keeper, ...spotToPercent(view, sp) })
      return
    }
    const t = rest[next]
    if (!t) return
    next += 1
    taken.push({ ...t, ...spotToPercent(view, sp) })
  })

  const moved = new Set(taken.map((t) => t.id))
  return [...taken, ...mine.filter((t) => !moved.has(t.id))]
}
