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
import type { CameraMode, CameraPush } from './camera'

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
  /**
   * Object path of the player's photograph, in the private `players` bucket.
   *
   * A PATH AND NOT A URL, for two separate reasons. The first is the one
   * `crest_path` gives in supabase/012: a URL bakes in the project ref. The
   * second is particular to this bucket — it is private, so there is no durable
   * URL to store. A browser gets a signed one that expires within the hour, and
   * the exporter gets a `data:` URI. Both are resolved from this path at draw
   * time by `signPhotos` / `inlinePhotos` in ./account/squad.ts.
   *
   * A DOCUMENT CARRYING THIS IS NOT CARRYING THE PICTURE. Share a board and the
   * recipient sees the names and no faces, because the policy in supabase/013
   * will not sign a path they do not own. That is the intended behaviour and
   * not a gap to close casually; see the head of ./account/squad.ts.
   */
  photo?: string
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
  /**
   * Percent coords, same space as tokens.
   *
   * Where the end IS when it is not bound to anybody, and where it falls back
   * to when it is bound to a player this phase does not contain. Kept current
   * either way — see `bindEnd` in ../arrows.ts.
   */
  from: { x: number; y: number }
  to: { x: number; y: number }
  /**
   * The player an end is attached to, if it is attached to one.
   *
   * A `Band` has never stored its own shape: it names the players it threads
   * through and is worked out at render time, so it follows them. Arrows used
   * to be the exception, which made them wrong the moment anybody was dragged
   * — and since every phase of a system is the same players somewhere else,
   * that was most of the time. An end named here is read off whoever the
   * renderer is currently drawing, which means it follows its player through a
   * tween as well as around a pose.
   *
   * Absent means the end is on a piece of grass and meant to be: a through ball
   * into space, a run to the back post, a press towards an area. Both forms are
   * first class, and one arrow commonly has one of each.
   *
   * Undefined on every arrow drawn before this existed, which is exactly what
   * those arrows already did.
   */
  fromId?: string
  toId?: string
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
 * A piece of writing on the grass.
 *
 * ── WHY THIS IS ITS OWN MARK ────────────────────────────────────────────────
 *
 * There was text on the board before this: an arrow can be labelled, a shaded
 * area can be labelled, a phase has a title and a caption under it. Every one
 * of those is text ATTACHED to something — and a coach who wants to write "hold
 * until he commits" in the space between the lines had nowhere to put it except
 * a zone with its shading turned off and its outline turned off, which is a
 * text mark drawn by someone who did not have one (user, 2026-08-27).
 *
 * So this is the thing itself: a point, some words, and how they are set. It
 * carries no geometry beyond where it starts, which is what keeps it out of the
 * way of everything else — it is not a region, so it shades nothing, and it is
 * not a line, so it points at nothing.
 *
 * ── EVERY FIELD BUT THE FIRST THREE IS OPTIONAL ─────────────────────────────
 *
 * And they are all `string`, not unions, for the same reason `Band`'s
 * appearance fields are: the document format must not depend on the drawing
 * code, or a saved system stops being readable without it. `resolveTextStyle`
 * in ../board/surfaces.ts falls back to the house treatment on anything it does
 * not recognise, which is what makes a system written by a newer build open in
 * an older one instead of drawing nothing.
 */
export interface TextMark {
  id: string
  /** Percent coords, the same space a token is stored in. */
  x: number
  y: number
  /**
   * The words. Newlines are kept and drawn as lines — a coach writing three
   * bullet points wants three lines, not one long one, and asking them to place
   * three separate marks to get that would be the tool being difficult.
   */
  text: string
  /** 'xs' | 's' | 'm' | 'l' | 'xl'. See TEXT_SIZES: the number is METRES. */
  size?: string
  /** Arbitrary continuous scale multiplier. */
  scale?: number
  /** 'halo' | 'plate' | 'bare'. How it holds its edge against the board. */
  look?: string
  /** 'regular' | 'bold' | 'black'. */
  weight?: string
  /** 'left' | 'center' | 'right', measured about `x`. */
  align?: string
  /** A BAND_TONES id. Absent means the board's own ink. */
  tone?: string
  /**
   * Degrees, clockwise, about the mark's own anchor.
   *
   * For writing along a touchline or up a channel, which is a thing coaches do
   * on every whiteboard in the world and which no amount of moving the mark
   * around can substitute for. Absent means level, and level is what it should
   * almost always be — this is here for the one label that has to run with the
   * pitch rather than across it.
   */
  angle?: number
}

/**
 * A piece of training gear standing on the grass.
 *
 * ── WHY IT IS A MARK AND NOT A TOKEN ────────────────────────────────────────
 *
 * A cone and a centre-back are both objects at a position, and it is tempting
 * to make them the same object. They are not. A `Token` has an identity that
 * survives the whole system — it is a PERSON, it carries a name, a shirt, a
 * role cue and a photograph, it is what a bound arrow holds on to, and it is
 * what `relabel` renumbers when a coach switches to shirt numbers. None of that
 * means anything to a hurdle. Putting gear in `tokens` would put ladders in the
 * squad picker, in the counter labelling and in every block the Block tool
 * threads a line through, all to save one array.
 *
 * So it sits beside `texts`: a thing placed on the grass, owned by one phase.
 *
 * ── IT TRAVELS, THOUGH ──────────────────────────────────────────────────────
 *
 * Unlike a text mark, which appears and holds and goes. A piece of gear matched
 * by id across two phases LERPS between them on Play, exactly like a player
 * does (see ../tween.ts), because moving the cones IS the point of the phase in
 * a session plan — "and now the gate is two metres wider" is a thing a coach
 * shows by moving it, not by cutting to it.
 */
export interface GearMark {
  id: string
  /**
   * Which piece it is: a `GearPiece` id from ../gear.ts.
   *
   * `string` rather than a union, the same call `Band` and `TextMark` make. A
   * document must stay readable without the drawing code — `resolveGear` returns
   * null for a piece this build does not have and the board leaves it out,
   * which is how a system saved by a newer release still opens here.
   */
  kind: string
  /** Percent coords, the same space a token is stored in. */
  x: number
  y: number
  /**
   * A MULTIPLIER on the piece's own width, not a width in metres.
   *
   * So a coach who drags one cone bigger and the catalogue that later retunes
   * every cone do not fight: the stored number says "a bit bigger than a cone",
   * and what a cone is stays in one place. Absent means 1.
   */
  size?: number
  /** Degrees, clockwise, about its own centre. Absent means square to the pitch. */
  angle?: number
  /**
   * Mirrored left-to-right.
   *
   * Only one of the four axes is offered, because the other three are the same
   * three transforms: a piece flipped vertically is a piece flipped
   * horizontally and turned 180°, and `angle` already does that. One checkbox
   * and one slider cover every orientation a mini goal can be in.
   */
  flip?: boolean
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
  /**
   * Writing on the grass. See `TextMark`.
   *
   * OPTIONAL, and every reader has to treat `undefined` as an empty list. Every
   * act written before this existed has no such field, and a document format
   * that requires a migration to stay readable is a document format that will
   * one day fail to open somebody's season.
   */
  texts?: TextMark[]
  /**
   * The training gear on this phase. See `GearMark`.
   *
   * Optional under the same rule `texts` is, and for the same reason: every act
   * written before it existed has no such field, and `undefined` must read as
   * an empty list everywhere rather than as a document to migrate.
   */
  gear?: GearMark[]
}

/** A team's visual identity. Defaults come from the owner's profile. */
/**
 * The shirt, beyond one flat colour.
 *
 * Four patterns and a plain shirt, chosen because all four still READ inside a
 * 2.1 m counter on a board zoomed out to the whole pitch. Quarters and checks
 * were considered and dropped: they turn to mush at that size, and a kit nobody
 * can identify is worse than no pattern at all.
 *
 * Drawn by `Token.tsx` as flat bands clipped to the counter, under the inner
 * shade and the highlight, so a striped counter is still the same glossy object
 * as a plain one. Pure SVG — no fetch, no filter — which is why the video
 * exporter needed no changes for any of this. See `videoRender.ts` on what a
 * serialised board can and cannot resolve.
 */
export type KitPattern = 'solid' | 'stripes' | 'hoops' | 'halves' | 'sash'

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
  /**
   * The shirt's pattern. Absent or 'solid' is a plain shirt, which is what
   * every system built before this existed is, and it stays that way.
   */
  pattern?: KitPattern
  /**
   * The pattern's second colour — the stripe, the hoop, the far half, the sash.
   *
   * Its shaded twin is DERIVED by `darken()` at render time rather than stored,
   * exactly as `deep` is derived from `base`. supabase/005 gives the reason and
   * it has not changed: a stored copy is a third place for the same fact to
   * live and the one that goes stale.
   */
  alt?: string
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
  /** A multiplier on the match ball's own width. */
  matchBallSize?: number
  /** Angle in degrees. */
  matchBallAngle?: number
  /** A universal multiplier for player counter sizes across the board. */
  tokenSize?: number
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
   * HOW FAR the camera pushes in, when it is following.
   *
   * A second control rather than more modes, because "does the eye move" and
   * "how close does it get" are genuinely different questions and folding them
   * into one list would make a coach who wants a calmer film go looking under
   * the heading that says Fixed.
   *
   * The derivation in ./camera.ts was tuned for the videos, where a shot is cut
   * to and held. A studio film travels between every shot, and at the old
   * settings a four-phase system was a camera lunging at the ball and back out
   * again four times (user, 2026-08-27). 'gentle' is the default now: it leaves
   * more grass round the action and refuses to go tighter than about two
   * thirds of the view, so the movement reads as a drift rather than a zoom.
   *
   * Undefined means 'gentle', which is a DELIBERATE change of behaviour for
   * systems written before this existed. The alternative was to leave every
   * saved system on a setting the coach never chose and has already complained
   * about, and there is nothing here that can be lost by it — the camera is a
   * render-time crop and not a single stored coordinate.
   */
  push?: CameraPush
  /**
   * The club crest, drawn in the corner of the board.
   *
   * TWO fields rather than one nullable URL, and the split is what makes the
   * toggle honest. `crestUrl` is WHICH crest — copied off the coach's profile
   * onto the document, because a share link is opened by somebody who has no
   * profile and a video is watched by somebody who has no browser session, and
   * a board that only shows its crest to its author is not a crest. `showCrest`
   * is WHETHER to draw it, which is a thing a coach changes per system: the
   * same club badge belongs on a presentation to the board and is noise on a
   * session plan for the under-11s.
   *
   * Keeping them apart means turning it off does not throw the URL away, so
   * turning it back on is a toggle rather than a trip to the settings page.
   *
   * A PUBLIC url, on purpose. `crests` is the one open bucket (see
   * ../account/images.ts) precisely so a crest can be drawn on boards that get
   * shared, printed and filmed. Player photographs are the opposite case and
   * live behind signed URLs; nothing here may ever hold one.
   *
   * Absent on every document written before this existed, which draws no crest
   * — exactly what they already did.
   */
  crestUrl?: string
  showCrest?: boolean
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
   * How long the move OUT of each phase takes, in milliseconds.
   *
   * The other half of the beat, and the one a coach reaches for when they
   * cannot follow the football rather than when they are bored of waiting for
   * it. Slowing it also relaxes the easing curve, so the extra time is spent
   * travelling rather than settling — `easeHouse` in ./tween.ts.
   *
   * Undefined on documents written before the move was adjustable. `moveMs()`
   * in ./pace.ts supplies 1100, which is what they have always run at, and is
   * also the floor: this slider only goes slower.
   */
  move?: number
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
