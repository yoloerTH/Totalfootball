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

/**
 * The outline a drawn area takes.
 *
 * A box is the default and is right for most of them — a pitch is a rectangle
 * and so are the spaces on it. The round box softens a zone that sits inside
 * play rather than against a line, and the ellipse is for the one thing a
 * rectangle genuinely misrepresents: a pocket of space, which has no edges and
 * which coaches draw as a circle on every whiteboard in the world.
 */
export type BandShape = 'box' | 'round' | 'ellipse'

export interface Band {
  id: string
  kind: BandKind
  /**
   * For 'block': the player line to trace, as token ids — the band fills from
   * that line to the goal, which is how the videos draw a back four's
   * protected space. Resolved at render time so the band follows the players
   * when they are dragged, instead of going stale.
   *
   * Written two ways now. "Our block" still works it out from the deepest line
   * (`backLine` in ../editor/StudioEditor.tsx), and the Block tool lets a coach
   * name the players themselves, in the order they want them threaded. The
   * STORED SHAPE IS IDENTICAL, which is the whole point: a hand-drawn block
   * follows its players exactly as a derived one does, because there is no such
   * thing here as a frozen block. A coach who draws a midfield three by hand
   * and then drags the pivot gets the band they would have drawn.
   */
  throughTokens?: string[]
  /**
   * True on a block whose players the COACH picked, one by one.
   *
   * The only thing this decides is what "Redraw our block" is allowed to throw
   * away. That button replaces the derived block for a side, which is right —
   * it is the same button that made it. It must NOT quietly delete a block a
   * coach picked player by player, and without a flag there is nothing to tell
   * the two apart: both are a list of token ids, and deliberately so.
   *
   * WHY THIS WAY ROUND. The obvious flag is `auto` on the derived one, and it
   * is wrong: every block in every document written before this existed is a
   * derived one and carries no flag at all, so `auto` would read false on all
   * of them and the Redraw button would stop recognising its own work on every
   * system already saved. Marking the NEW thing leaves the old ones meaning
   * exactly what they always meant, which is what a document format has to do.
   */
  drawn?: boolean
  /**
   * For 'block': how the shading is closed off.
   *
   * 'goal' fills from the player line back to the goal those players defend,
   * which is what a block IS and what every published video draws. 'shape'
   * closes the shading round the picked players themselves, the way a coach
   * rings a unit on a whiteboard.
   *
   * A block through a back four wants 'goal'. A block through a front three
   * pressing wants 'shape' — under 'goal' it shades the entire pitch back to
   * your own keeper, which is the bug this field exists to fix (user,
   * 2026-08-21). Absent means 'goal', so every block written before this reads
   * exactly as it was drawn.
   */
  close?: 'goal' | 'shape'
  /** For 'danger' | 'zone': an explicit rectangle in percent coords. */
  rect?: { x: number; y: number; w: number; h: number }
  label?: string
  /**
   * What the coach has changed about how it looks. All optional, and undefined
   * everywhere means "the house treatment for this kind", which is what every
   * band written before these existed still gets.
   *
   * They are on the BAND and not on the system, because two areas on the same
   * board are routinely making different points — the space to attack in gold
   * and the channel to protect in blue is one board, not two settings.
   *
   * Typed loosely here (`string`) rather than importing the unions from
   * ../board/surfaces.ts: the document format must not depend on the drawing
   * code, or a stored system stops being readable without it. The board
   * resolves them and falls back to the house value on anything it does not
   * recognise, which is also what makes an older build safe to open a newer
   * document in.
   */
  tone?: string
  strength?: string
  /** Drawn areas only. A block traces its players and has no outline to choose. */
  shape?: BandShape
  /**
   * Solid outline instead of the dashed one.
   *
   * SUPERSEDED BY `edge`, and kept because documents carry it. Nothing writes
   * it any more; `resolveBandStyle` in ../board/surfaces.ts still reads it when
   * `edge` is absent, so a board saved before the three-way control existed
   * opens with the outline it was given.
   */
  solid?: boolean
  /**
   * The outline: 'solid' | 'dashed' | 'none'.
   *
   * Dashed says "this region, roughly", solid says the edge is real, none
   * leaves the shading to speak for itself. A block's house default is solid
   * and an area's is dashed — the difference between a line of players and a
   * patch of grass.
   */
  edge?: string
  /** 'shade' (the default) or 'none', which leaves an outline round the space. */
  fill?: string
  /**
   * The line threaded through a block's players: 'off' | 'thin' | 'normal' |
   * 'thick'. Meaningless on an area drawn as a box, which has no line of
   * players, and ignored there rather than invented.
   */
  string?: string
  /**
   * How a closed block sits round its players: 'tight' | 'soft' | 'loose'.
   * Padding and corner radius together — see BAND_CORNERS. Only read when
   * `close` is 'shape'.
   */
  corner?: string
}

/**
 * The rectangle of board to look at: a centre, and the box that must be in shot.
 *
 * All four numbers are percent-of-crop — the same space a token stores — so a
 * shot means the same thing as the marks it is framing, and `{50,50,100,100}`
 * is the whole view.
 *
 * A BOX RATHER THAN A ZOOM FACTOR, and the reason is the video. The exporter
 * renders through a widened, sometimes turned view so the grass reaches all
 * four edges of a 16:9 or 9:16 frame (`frameView` in ./videoRender.ts). A zoom
 * expressed as a fraction of the crop would mean something different against
 * that wider crop, and the film would come out framed looser than the preview a
 * coach approved. A box of grass means the same thing at every aspect: each
 * renderer fits it into whatever frame it has. Percent-of-crop is measured
 * against `x0..x1`, which the export view does not move — that is what makes
 * this work, and it is the same property tokens already rely on.
 */
export interface Shot {
  x: number
  y: number
  w: number
  h: number
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
  /**
   * Where the camera looks on THIS phase, when the coach has said so themselves.
   *
   * Undefined means "work it out", which is what every phase did before this
   * existed and what most of them should go on doing — the derivation in
   * ./camera.ts reads what the coach has already marked and is right nearly all
   * the time. This is the override for the phase where it is not: a phase about
   * a run nobody drew an arrow for, or one the coach simply wants wider.
   *
   * It is ignored entirely while the camera is Fixed. A hand-drawn frame is a
   * camera instruction, and a system with no camera has nothing to instruct.
   *
   * On the ACT and not on the system, unlike the mode: this is the one part of
   * the camera that is genuinely per-phase, which is the whole reason it needed
   * somewhere of its own to live.
   */
  shot?: Shot
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
  /**
   * How long each phase sits on screen before it starts moving, in
   * milliseconds. The move that follows it is a fixed length and is not part of
   * this number.
   *
   * On the document beside the camera and the surface, and for the same reason:
   * how quickly a system reads is something the coach decided, not something
   * the person watching it should have to. It drives Play, the shared viewer,
   * the video and the ball audio off one value, so the preview cannot promise a
   * pace the file does not keep.
   *
   * Undefined on documents written before pace existed. `holdMs()` in ./pace.ts
   * supplies 2600, which is what they have always run at, and clamps anything
   * outside the range this build will render.
   */
  hold?: number
  /**
   * How the two shapes share the board once an opposition is on it.
   *
   * Undefined or false — the default, and what every system saved before this
   * field existed was built under — gives each side its own half: our shape is
   * re-placed into the narrower band as the opposition arrives, and back out
   * across the board when they leave.
   *
   * True keeps our players exactly where the coach put them. The opposition is
   * fitted into the mirror of the ground we cover instead (see `mirrorBand` in
   * ./formations.ts), so a system built on the whole pitch is still on the
   * whole pitch after the toggle, and the spacing that was worked out at 74
   * percent of the board is not silently re-read at 48.
   *
   * It is a stored property of the document rather than a coach's setting for
   * the same reason the surface and the camera are: the arrangement is part of
   * what the system IS, and the share link, the print and the video all have
   * to open on the picture that was signed off.
   */
  keepShape?: boolean
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
