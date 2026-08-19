/**
 * The studio's document format.
 *
 * A System is one tactical presentation. It is stored as a single JSON document
 * (one `jsonb` column) rather than a normalised set of tables, because it is
 * always read and written whole, it is versioned as a unit, and a coach's
 * "undo" is just the previous document.
 *
 * THE ONE RULE THAT MATTERS: token `id` is stable across acts.
 *
 * An Act is a POSE, not a keyframe. The coach places the same eleven players in
 * act 1 and act 2; the animation between them is derived, never authored. That
 * is the whole product — they build slides, we hand back the film. It only
 * works if `LB` in act 1 and `LB` in act 2 are understood to be the same
 * player, which is what the id guarantees. Never regenerate ids on edit.
 */

import type { BallId } from './balls'
import type { PitchViewId } from './board/pitch'
import type { PitchSurfaceId } from './board/surfaces'
import type { CameraMode } from './camera'

/** Which side of the ball a token belongs to. Drives its colour. */
export type Side = 'us' | 'them'

/**
 * Live role cues, ported from the videos (editor/src/components/football/
 * TacticsBoard.tsx CUE_COLOR). These are the labels that reassign as the ball
 * moves and are the single most recognisable thing about the channel's boards.
 */
export type Cue = 'PRESS' | 'COVER' | 'BALANCE' | 'SPARE' | 'JOCKEY' | 'DROP'

export interface Token {
  /** Stable across acts. See the note at the top of this file. */
  id: string
  /** Percent of the visible board: 0–100 left→right, 0–100 top→bottom. */
  x: number
  y: number
  /** What is printed on the counter — a number ("6") or a position ("LB"). */
  label: string
  side: Side
  /** Optional player name, printed above the counter. */
  name?: string
  cue?: Cue
  /** Greyed back, for players who are not part of this act's lesson. */
  dim?: boolean
}

/**
 * Arrows carry the meaning on a coach's board: a run, a pass, a press, a
 * carry. The `kind` picks the house treatment (solid/dashed/squiggle + head),
 * so a coach chooses intent and we choose the drawing.
 */
export type ArrowKind = 'pass' | 'run' | 'carry' | 'press' | 'switch'

export interface Arrow {
  id: string
  kind: ArrowKind
  /** Percent coords, same space as tokens. */
  from: { x: number; y: number }
  to: { x: number; y: number }
  /**
   * Curvature, -1..1. 0 is straight; positive bows one way, negative the other.
   * Coaches draw curves, and a bowed pass reads as a different idea to a
   * straight one, so it is part of the vocabulary rather than a decoration.
   */
  bend?: number
  label?: string
}

/** Shaded areas: the defensive block, the danger zone, a channel to protect. */
export type BandKind = 'block' | 'danger' | 'zone'

export interface Band {
  id: string
  kind: BandKind
  /**
   * For 'block': the player line to trace, as token ids — the band fills from
   * that line to the goal, which is how the videos draw a back four's
   * protected space. Resolved at render time so the band follows the players
   * when they are dragged, instead of going stale.
   */
  throughTokens?: string[]
  /** For 'danger' | 'zone': an explicit rectangle in percent coords. */
  rect?: { x: number; y: number; w: number; h: number }
  label?: string
}

export interface Act {
  id: string
  /** Shown on the slide and in the act strip. */
  title: string
  /** One line under the board. Short enough to read in a glance. */
  caption: string
  /**
   * The long version: coaching points, triggers, what to look for. Optional and
   * usually empty.
   *
   * Deliberately a second field rather than a longer caption. They are read at
   * different distances and by different people — the caption is on the slide
   * while a room is looking at the board, and this is what a coach reads off
   * the printed page, or writes for the assistant who was not at the session.
   * One field would have to be short enough for the first job, which makes it
   * useless for the second.
   */
  notes?: string
  tokens: Token[]
  /** Percent coords, or null when the act is about shape rather than the ball. */
  ball: { x: number; y: number } | null
  arrows: Arrow[]
  bands: Band[]
}

/** A team's visual identity. Defaults come from the owner's profile. */
export interface TeamStyle {
  name: string
  /** Counter fill. */
  base: string
  /** The dome's shaded underside — a darker shade of `base`. */
  deep: string
  /** Label colour. White on most kits, ink on yellows and whites. */
  text: string
  /** Optional trim ring, for kits that need a second colour to read. */
  ring?: string
}

export interface System {
  /** Schema version, so stored documents can be migrated in place. */
  v: 1
  title: string
  /** Optional subtitle for the title slide. */
  subtitle?: string
  pitch: PitchViewId
  /**
   * Which match ball is on the board. A property of the whole presentation, not
   * of an act: a coach picks the 2010 ball because the session is about 2010,
   * and it would be nothing but a continuity error for it to change between two
   * poses of the same move. Undefined on documents written before balls existed
   * — `resolveBall()` in ./balls.ts supplies the default.
   */
  matchBall?: BallId
  /**
   * What the board is drawn on: paper, broadcast turf, floodlit night, slate.
   *
   * On the document rather than on the coach's settings, and that is the whole
   * design of it. A surface travels with the system into every export, print and
   * shared link, so what the room sees is what the coach chose — where a surface
   * that followed the VIEWER's day/night setting would render the same link two
   * different ways. Undefined on documents written before surfaces existed;
   * `resolveSurface()` in ./board/surfaces.ts supplies paper.
   */
  surface?: PitchSurfaceId
  /**
   * Whether the film moves, and how.
   *
   * On the document, alongside the surface and the match ball, because it is a
   * property of the presentation and not of whoever is watching it: a coach who
   * shot a system to follow the ball is handing over a system that follows the
   * ball, in the share link, the video and the printed page alike.
   *
   * It is NOT a second pitch view. Where the crop lands is what the system is
   * about and is the space every mark is stored in; this is only where the eye
   * goes while it plays, and it never moves a player. See ./camera.ts.
   *
   * Undefined on documents written before the camera existed —
   * `resolveCamera()` supplies 'off', which is exactly what they already did.
   */
  camera?: CameraMode
  teams: {
    us: TeamStyle
    /** null = no opposition on the board. */
    them: TeamStyle | null
  }
  acts: Act[]
  /**
   * Who is presenting this, filled in when it is shared.
   *
   * It goes in the credit bar under every slide and at the foot of the shared
   * viewer, next to our own mark — their name on the left, ours on the right.
   * That arrangement is the whole watermarking policy (see docs/STUDIO.md): a
   * credit line reads as authorship and nobody crops their own name off, where
   * a corner logo reads as a tax and everybody does.
   *
   * Typed in by hand today. Once accounts exist these come off the profile and
   * the fields are prefilled, which is the only reason they live on the
   * document rather than in the share dialog's own state.
   */
  credit?: Credit
  /**
   * The short id this system is published under, once it has been shared.
   *
   * Kept on the document so that sharing it again REFRESHES the link the coach
   * has already sent instead of minting a second one. That is the whole
   * difference between "share" meaning publish-a-copy and "share" meaning
   * here-is-my-system, and coaches mean the second one.
   */
  shareId?: string
}

export interface Credit {
  /** The coach. "Andreas Pangios". */
  presenter?: string
  /** Their club or team. "AEL Limassol U16". */
  team?: string
  /** One line of context: "Pre-season, week 2", "Away at Apollon". */
  note?: string
  /** ISO date, stamped when the link is made. Shown as a plain date. */
  sharedOn?: string
}

/** A team style that reads on the paper board before the coach sets their own. */
export const DEFAULT_US: TeamStyle = {
  name: 'Our team',
  base: '#08C16A',
  deep: '#06A659',
  text: '#FFFFFF',
}

export const DEFAULT_THEM: TeamStyle = {
  name: 'Opposition',
  base: '#E2473B',
  deep: '#B5392F',
  text: '#FFFFFF',
}

/**
 * Ids only need to be unique inside one document, so a short random suffix is
 * plenty and keeps the stored JSON readable when debugging.
 */
export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Where a ball goes when nobody has said where to put it: the centre spot.
 *
 * Used by the fresh document and by the Add ball button, which should agree —
 * a coach who removes the ball and adds it back expects it to land where it
 * started, not somewhere new.
 */
export const CENTRE_SPOT = { x: 50, y: 50 }

export function emptyAct(tokens: Token[] = [], n = 1): Act {
  return {
    id: uid('act'),
    title: `Act ${n}`,
    caption: '',
    tokens,
    ball: null,
    arrows: [],
    bands: [],
  }
}
