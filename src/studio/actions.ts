/**
 * Arrows that do the thing they describe.
 *
 * WHY THIS IS POSSIBLE AT ALL
 *
 * The five arrow tools were never five line styles. Pass, Run, Carry, Press and
 * Switch are five things that happen on a pitch, and ../editor/guide.ts has
 * always said so in prose: "a ball played from one player to another", "a player
 * moving without the ball", "a player travelling with the ball at their feet".
 * The studio knew what each one meant and drew a line anyway.
 *
 * The other half was already true too. `tweenActs` treats arrows as descriptions
 * of the TRANSITION, not of the pose: the old set is gone by 35% of the move and
 * the new set does not start until 55%, precisely because "an arrow that lingered
 * into a shape it no longer describes is the fastest way to make a board look
 * wrong". An arrow drawn on phase n has always meant "this is what happens
 * between here and phase n+1". This module lets it happen.
 *
 * THE LINE THIS MUST NOT CROSS
 *
 * ../tween.ts opens with the premise the whole product rests on: a coach poses
 * act 1 and act 2, nobody keyframes anything, and "the stored JSON never carries
 * animation state". An action is a POSING SHORTCUT and nothing else. It writes
 * an ordinary Act — the same shape a coach would have produced by dragging — and
 * then gets out of the way. Nothing here is re-read at render time, nothing is
 * derived, and a system built by tapping is indistinguishable from one built by
 * hand. After an action every player is still hand-draggable, and dragging one
 * does not invalidate anything.
 *
 * That is why an action BAKES rather than staying live. A live arrow — one that
 * re-runs whenever it moves — would make phase n+1 partly derived, and the
 * moment that is true "drag anyone anywhere" stops being true. That is a
 * different product, and a worse one for a coach who wants to nudge the one man
 * the engine put half a metre wrong.
 *
 * WHY SEVERAL ACTIONS LAND ON ONE PHASE
 *
 * Because that is the football. A pass, the overlapping run it releases, and the
 * press it beats all happen in the same beat, and giving each its own phase
 * would both misrepresent the move and make the film three times as long.
 * Actions therefore accumulate onto the NEXT phase, creating it only if it is
 * not there. The caller stays where it is afterwards, so the next action joins
 * the same transition rather than starting a new one.
 */

import { PITCH } from './board/pitch'
import { ballFields, ballsOf, uid } from './schema'
import type { Act, Arrow, ArrowKind, BallMark } from './schema'

export interface Pt {
  x: number
  y: number
}

/** What the second tap landed on. */
export type Target = { kind: 'token'; id: string } | { kind: 'spot'; pt: Pt }

/**
 * The kinds that ARE an action: something travels, and posing it is this file's
 * job.
 *
 * Every `ArrowKind` except the line, and stated as an exclusion rather than as
 * a second hand-written list so that the sixth kind somebody adds cannot be
 * quietly left out of both. The exhaustive `switch` in `perform` is what makes
 * this load-bearing: narrowing the parameter to this type means a new movement
 * kind fails to compile here until it has a case, and a new NON-movement kind
 * has to be excluded here before it can be drawn at all.
 */
export type ActionKind = Exclude<ArrowKind, 'line'>

/**
 * How close the ball has to be to count as being at somebody's feet, in percent
 * of the pitch's length.
 *
 * Used for one decision only: whether a player who runs takes the ball with
 * them. A run is defined as movement WITHOUT the ball, so ordinarily it leaves
 * the ball alone — but a coach who arms Run, taps the man on the ball and sends
 * him forward has plainly not asked for the ball to stay behind on the grass.
 * Reading possession off the board is what lets the tool be right in both cases
 * without asking.
 *
 * Deliberately generous. It is answering "is this the player on the ball", and
 * on any real board only one man is anywhere near it.
 */
const POSSESSION_PCT = 4

/**
 * How far short of their target a press stops, in METRES.
 *
 * A press closes somebody down; it does not stand on them. Arriving on the exact
 * spot puts two counters on top of each other, which reads as a tackle that has
 * already happened rather than as pressure being applied — and pressure being
 * applied is the entire idea the tool exists to draw.
 */
const PRESS_GAP_M = 3.4

/**
 * How far short of a MAN a run or a carry stops, in metres.
 *
 * This is the same rule as the press gap and it was missing, which is a bug
 * somebody found the hard way: a Run aimed at another player landed the runner
 * on that player's exact centre, and one counter vanished underneath another.
 * The arrow still points AT him — being run at is the whole picture — but the
 * runner arrives beside him.
 *
 * Wider than the press gap on purpose, and the number is not free. A counter is
 * TOKEN_R = 2.1m, so two of them touch at 4.2m centre to centre. At 4.4 they sit
 * a hand apart and both stay whole. A press is allowed to be tighter than that
 * because a press being uncomfortably close IS the thing it draws.
 *
 * A run aimed at a SPOT is untouched. A coach pointing at bare grass has said
 * where they want the man, and the tool does not get to argue about it.
 */
const RUN_GAP_M = 4.4

/** Where the ball settles when a pass arrives, measured back down the pass. */
const RECEIVE_GAP_PCT = 2.6

/**
 * A gap in metres, as a distance in board units along the heading travelled.
 *
 * THE BOARD IS NOT SQUARE. One unit along the pitch is 1.05m and one across it
 * is 0.68m, so a stand-off measured in raw units is half again as tight for a
 * man arriving from directly behind as for one arriving from the side — and the
 * counters overlap or do not depending on which way somebody happened to run.
 * The constants above are metres, because metres is what a coach means by "he
 * stops short of him", and this is the only place the difference is handled.
 */
function gapUnits(from: Pt, to: Pt, metres: number): number {
  const du = Math.hypot(to.x - from.x, to.y - from.y)
  if (du < 1e-9) return 0
  const dm = Math.hypot(((to.x - from.x) * PITCH.length) / 100, ((to.y - from.y) * PITCH.width) / 100)
  return (metres * du) / dm
}

const at = (act: Act, id: string) => act.tokens.find((t) => t.id === id) ?? null

/**
 * Move `from` towards `to`, stopping `gap` short of it.
 *
 * The early return is the whole reason this is a function. At close range a
 * naive subtraction sends the mover BACKWARDS past their own starting point,
 * so a press on somebody already two metres away would retreat — which looks
 * like a mistake in the football rather than in the arithmetic, and is the sort
 * of thing that gets blamed on the tool for a fortnight.
 */
function shortOf(from: Pt, to: Pt, gap: number): Pt {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len <= gap) return { x: from.x, y: from.y }
  const k = (len - gap) / len
  return { x: from.x + dx * k, y: from.y + dy * k }
}

/** Step `dist` from `from` along the line to `to`, and no further than `to`. */
function towards(from: Pt, to: Pt, dist: number): Pt {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len <= dist || len < 1e-9) return { x: to.x, y: to.y }
  const k = dist / len
  return { x: from.x + dx * k, y: from.y + dy * k }
}

/** Where a target sits in a given act. A named player who has left falls back. */
function targetIn(act: Act, target: Target, fallback: Pt): Pt {
  if (target.kind === 'spot') return target.pt
  const t = at(act, target.id)
  return t ? { x: t.x, y: t.y } : fallback
}

function moveToken(act: Act, id: string, pt: Pt): Act {
  return { ...act, tokens: act.tokens.map((t) => (t.id === id ? { ...t, ...pt } : t)) }
}

export interface Performed {
  /** Drawn on the phase the action was performed FROM. */
  arrow: Arrow
  /** The phase it produced. */
  next: Act
  /** Nothing on the board changed — the actor is not in the next phase. */
  posed: boolean
}

/**
 * Carry out one action, returning the arrow to draw and the phase it poses.
 *
 * PURE. It reads two acts and returns a new one, which is what makes it
 * testable against real geometry and what keeps the editor's copy of this
 * knowledge down to "which two things did the coach tap".
 *
 * `cur` is the phase being worked on; `next` is the phase after it, which the
 * caller supplies already copied forward. Positions for the ARROW are read from
 * `cur`, because that is the board the arrow is drawn on. Positions for the POSE
 * are read from `next`, because that is the board being changed — and those two
 * differ as soon as a second action lands on the same transition, which is the
 * whole point of letting them.
 */
export function perform(kind: ActionKind, cur: Act, next: Act, actorId: string, target: Target): Performed | null {
  const actorCur = at(cur, actorId)
  if (!actorCur) return null

  const fromPt: Pt = { x: actorCur.x, y: actorCur.y }
  const toPtCur = targetIn(cur, target, fromPt)

  const arrow: Arrow = {
    id: uid('ar'),
    kind,
    from: fromPt,
    to: toPtCur,
    fromId: actorId,
    ...(target.kind === 'token' ? { toId: target.id } : null),
  }

  const actorNext = at(next, actorId)
  if (!actorNext) return { arrow, next, posed: false }

  const here: Pt = { x: actorNext.x, y: actorNext.y }
  const there = targetIn(next, target, toPtCur)

  /*
   * THE BALL AT THE ACTOR'S FEET, not "the ball".
   *
   * A phase can have several (see `BallMark` in ./schema.ts), and a pass is
   * played with the one the passer actually has. Nearest to them is the whole
   * rule, and it is the same test `run` below already used to decide whether a
   * player was carrying: on the ordinary one-ball phase it picks that ball and
   * nothing about these actions has changed.
   */
  const balls = ballsOf(next)
  const ball =
    balls.length === 0
      ? null
      : balls.reduce((best, b) =>
          Math.hypot(b.x - here.x, b.y - here.y) < Math.hypot(best.x - here.x, best.y - here.y)
            ? b
            : best,
        )
  /** Put one ball somewhere, leaving the others where they are. */
  const moveBall = (act: Act, at: BallMark | null, to: Pt): Act =>
    at
      ? { ...act, ...ballFields(ballsOf(act).map((b) => (b.id === at.id ? { ...b, ...to } : b))) }
      : act

  switch (kind) {
    case 'pass':
    case 'switch': {
      // The ball travels and nobody moves. It settles just short of the
      // receiver rather than under them, so the counter stays readable and the
      // ball reads as having arrived rather than as being part of the man.
      // From the receiver, back down the pass towards whoever played it.
      const rest = target.kind === 'token' ? towards(there, here, RECEIVE_GAP_PCT) : there
      return { arrow, next: moveBall(next, ball, rest), posed: true }
    }

    case 'carry': {
      // Player and ball travel together, keeping whatever offset the coach had
      // already given the ball — a carry does not re-tidy their board. Driving
      // AT a man stops in front of him; driving at a spot arrives on it.
      const land = target.kind === 'token' ? shortOf(here, there, gapUnits(here, there, RUN_GAP_M)) : there
      const moved = moveToken(next, actorId, land)
      const dx = land.x - here.x
      const dy = land.y - here.y
      return {
        arrow,
        next: moveBall(moved, ball, ball ? { x: ball.x + dx, y: ball.y + dy } : here),
        posed: true,
      }
    }

    case 'run': {
      // Movement without the ball — unless this is the player on it, in which
      // case leaving the ball behind is not what anybody asked for. Running at a
      // man stops beside him; running to a spot arrives on it.
      const land = target.kind === 'token' ? shortOf(here, there, gapUnits(here, there, RUN_GAP_M)) : there
      const moved = moveToken(next, actorId, land)
      const carrying = Boolean(ball) && Math.hypot(ball!.x - here.x, ball!.y - here.y) <= POSSESSION_PCT
      if (!carrying) return { arrow, next: moved, posed: true }
      const dx = land.x - here.x
      const dy = land.y - here.y
      return {
        arrow,
        next: moveBall(moved, ball, { x: ball!.x + dx, y: ball!.y + dy }),
        posed: true,
      }
    }

    case 'press': {
      // Close down and stop short. The ball is not touched: a press is pressure
      // going on, and whether it wins the ball is the next phase's business.
      return {
        arrow,
        next: moveToken(next, actorId, shortOf(here, there, gapUnits(here, there, PRESS_GAP_M))),
        posed: true,
      }
    }
  }
}
