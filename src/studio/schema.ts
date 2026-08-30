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
import type { PitchViewId, SessionArea } from './board/pitch'
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
  /** Optional player name, printed with the counter — see `System.namePlace`. */
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
  /**
   * Which row of the coach's own squad this counter was filled from.
   *
   * PROVENANCE. NOTHING READS IT AT DRAW TIME, and that is the whole design.
   * The name, the number and the photo path above are still COPIED onto the
   * document, so this field can name a player who has been deleted, renamed or
   * renumbered since, and every board drawn last autumn keeps the names it was
   * drawn with. ./account/squad.ts argues that at the top and it still holds:
   * a board is a record of a session that happened.
   *
   * What it buys is the question the copies cannot answer — WHICH ROLE IS
   * HOLDING WHOM. Matching a counter back to a squad row by name was the only
   * way to ask that, and a name is not a key: two lads called Owusu collapse
   * into one row, and a name corrected in settings stops matching the board it
   * came from. The lineup panel needs a definite answer for eleven roles at
   * once, so it gets one.
   *
   * It is therefore read by exactly two things, both of which the coach drives:
   * the lineup panel, to say who is on a role, and Refresh from squad, which
   * they press. A squad edit never reaches a board on its own.
   *
   * A PERSON FIELD — see `PERSON_FIELDS`. It moves across every act with the
   * name it arrived with, because a role that was Owusu on phase 1 and nobody
   * on phase 4 is the inconsistency this whole file exists to prevent.
   *
   * Stripped by `withoutIdentity` alongside the name and the photo. It is an
   * opaque uuid, but it is a key into an account-private table and it has no
   * business on a board being handed to a stranger.
   */
  playerId?: string
  cue?: Cue
  /** Greyed back, for players who are not part of this act's lesson. */
  dim?: boolean
  /**
   * The bib this player is wearing, as a `Bib.id`. Absent is the side's own
   * kit, which is every player on every board built before bibs existed.
   *
   * A `string` and not a union, the same call `Band`'s appearance fields make:
   * a document has to stay readable by code that has never heard of this
   * particular bib. An id that names nothing draws in the side's colour rather
   * than nothing at all, so deleting a bib cannot make a counter disappear.
   *
   * ── IT IS SET ON EVERY PHASE AT ONCE, unlike `cue` and `dim` beside it ─────
   *
   * Those two are what a player is DOING on this beat, and they are meant to
   * change from pose to pose. A bib is what they are WEARING for the session. A
   * player who changed shirt between two poses of the same move would read as a
   * different player arriving, which is the one thing the stable id exists to
   * prevent. So `assignBib` in ../editor/StudioEditor.tsx writes it across every
   * act. It is stored per-token per-act anyway, because that is what an act is.
   */
  bib?: string
  /**
   * Waiting on the side rather than in the exercise.
   *
   * ── WHY A DRILL STARTS WITH EVERYBODY ON THE BENCH ─────────────────────────
   *
   * A session is written by putting one player on each corner and two in the
   * middle. It is never written by squashing a 4-3-3 into a 20m square, which
   * is what changing to a training board used to do: `remapSystem` is the right
   * operation between two crops of a pitch and the wrong one for a change of
   * KIND. So switching onto a grid stands everybody down instead, and the coach
   * builds the drill by dragging on the ones they want. Building from scratch
   * is a first-class start, not a failure state — it is how every board a coach
   * already uses works (docs/TRAINING.md 1d).
   *
   * ── THE POSITION IS REAL, NOT A PLACEHOLDER ───────────────────────────────
   *
   * `x` and `y` of a benched player are the spot in the bench strip they are
   * actually standing on, written from `benchLayout` in ./board/pitch.ts
   * whenever the bench changes. This flag says WHY they are there, and it
   * drives two things: the row is re-laid so nobody collides, and the "players
   * are outside this view" warning stays quiet about them, because they are not
   * lost, they are waiting.
   *
   * Storing the flag and drawing them somewhere else would be the
   * cheaper-looking choice and it is wrong: an arrow bound to a benched player
   * would point at nothing, and the film would tween him out of a spot he was
   * never in.
   *
   * Per act, like `cue` and `dim`, because who is on the grid is exactly what
   * changes from phase to phase.
   */
  benched?: boolean
}

/*
 * ── EVERY FIELD ON `Token`, SORTED INTO ONE OF THREE KINDS ───────────────────
 *
 * A counter carries three unrelated sorts of fact, and the studio got one bug
 * out of each of them by not saying which was which:
 *
 *   THE ROLE     who this counter IS, across the whole document. Never edited.
 *   THE PERSON   who is filling that role this week. One value per document.
 *   THE POSE     what they are doing on THIS beat. One value per act.
 *
 * The distinction is not cosmetic — it decides how wide a write goes. A name is
 * a person fact, so retyping it on phase 1 has to reach phases 2 to 5; a cue is
 * a pose fact, so setting PRESS on phase 3 must NOT. Until these lists existed,
 * `name`, `photo` and `label` were being written one act at a time next to
 * `cue` and `dim`, which is why a coach had to open all five slides and type
 * the same substitution five times (user, 2026-08-29). `bib` had already been
 * moved to the wide write by hand, alone, with a comment explaining why — the
 * comment was right and the field was the only one that got the benefit.
 *
 * THEY ARE EXPORTED SO THAT A MACHINE CAN CHECK THEM. scripts/check-lineup.mjs
 * reads the field names out of the interface above and fails the build if any
 * one of them is in neither list, in both, or in a list twice. That is the same
 * job `withEdits` in ./editor/StudioEditor.tsx does by hand and has a comment
 * begging the next person not to forget — `photo` proved it could be forgotten.
 * A new field on `Token` now stops the build until somebody has decided which
 * kind of fact it is, which is a decision that takes ten seconds when the field
 * is written and a fortnight when it surfaces as a coach's bug report.
 */

/**
 * WHO A COUNTER IS. Fixed for the life of the document; no control writes them.
 *
 * `side` is here rather than among the person fields because a counter changing
 * team is not a substitution, it is a different board. Nothing in the editor
 * offers it, and the tween would have no idea what to do with it.
 */
export const ROLE_FIELDS = ['id', 'side'] as const

/**
 * WHO IS FILLING THE ROLE. Written across EVERY act at once.
 *
 * `label` is in this list and it is the only debatable one, so: what is printed
 * on a counter is a position in one house style ("LB") and a shirt number in
 * the other, and the studio lets a coach pick (`applyLabels`). Under the number
 * reading it is plainly the person. Under the position reading it belongs to
 * the role — but a role's position does not change between two poses of one
 * move either, so the wide write is correct in BOTH readings and the narrow one
 * is correct in neither. A counter reading "LB" on phase 1 and "3" on phase 4
 * is a bug however you argue it.
 *
 * `photo` and `playerId` travel with `name` because they are the same fact
 * arriving by a different route; splitting them is how a board ends up with a
 * face on three phases and a blank on the other two.
 */
export const PERSON_FIELDS = ['label', 'name', 'photo', 'playerId', 'bib'] as const

/**
 * WHAT THEY ARE DOING ON THIS BEAT. Written to the act the coach is looking at.
 *
 * `x`/`y` lead the list because they are the reason acts exist at all: the
 * difference between one act's coordinates and the next one's IS the animation.
 * Widening a write to include them would flatten a film into a still.
 *
 * `benched` is a pose and not a person, which reads oddly until you build a
 * session: who is on the grid and who is waiting is exactly what changes from
 * drill to drill. See `Token.benched`.
 */
export const PHASE_FIELDS = ['x', 'y', 'cue', 'dim', 'benched'] as const

/**
 * Carry a phase edit forward, through the phases that were only HOLDING.
 *
 * ── WHY THIS IS NOT JUST `PERSON_FIELDS` WITH MORE FIELDS IN IT ─────────────
 *
 * Because the note above is right: widening a positional write to every act
 * flattens a film into a still. A man standing at A on phase 15 and at B on
 * phase 16 IS the run, and a rule that wrote A across the whole document would
 * delete every run in it.
 *
 * But the complaint that produces this is real and it is not that (user,
 * 2026-08-30). A coach fixes somebody's position on phase 15, moves on, and
 * finds him back in the wrong place on 16, 17 and 18 — because those phases
 * were duplicated from 15 while it was still wrong, and the man is not running
 * anywhere in them. He is standing still, in three copies of a mistake.
 *
 * So the rule is neither "this phase" nor "every phase". It is THIS PHASE AND
 * THE ONES STILL HOLDING IT: walk forward, and stop at the first phase where
 * the man is somewhere else, because somewhere else is a pose somebody chose.
 * A hold gets corrected, a run is never touched, and the difference between
 * them is already written on the board in the only place it could be.
 *
 * Pure, and given the acts rather than the system, so the rule can be read and
 * tested without an editor around it.
 */
export function carryForward(
  acts: Act[],
  from: number,
  id: string,
  before: Partial<Token>,
  after: Partial<Token>,
): Act[] {
  const keys = Object.keys(before) as (keyof Token)[]
  if (keys.length === 0) return acts
  // Positions are copied structurally when a phase is duplicated, so they come
  // back bit-identical. The tolerance is for a document that has been through a
  // JSON round trip, not for "near enough" — 1e-9 of a pitch is a nanometre.
  const same = (a: unknown, b: unknown) =>
    typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b

  const out = acts.slice()
  for (let i = from + 1; i < out.length; i++) {
    const t = out[i].tokens.find((x) => x.id === id)
    if (!t || !keys.every((k) => same(t[k], before[k]))) return out
    out[i] = { ...out[i], tokens: out[i].tokens.map((x) => (x.id === id ? { ...x, ...after } : x)) }
  }
  return out
}

/** A field a coach's edit can travel across every act on. */
export type PersonField = (typeof PERSON_FIELDS)[number]

/**
 * Arrows carry the meaning on a coach's board: a run, a pass, a press, a
 * carry. The `kind` picks the house treatment (solid/dashed/squiggle + head),
 * so a coach chooses intent and we choose the drawing.
 */
export type ArrowKind = 'pass' | 'run' | 'carry' | 'press' | 'switch' | 'line'

/**
 * 'line' IS THE ODD ONE OUT, and deliberately in this union rather than beside
 * it.
 *
 * Every other kind is a MOVEMENT: something travels, and the two taps that draw
 * it also pose the next phase (see ../actions.ts). A line moves nothing. It is
 * the mark a coach draws across a board to divide it — the line of
 * confrontation, an offside line, the edge of the space they are giving up —
 * and it is drawn with no head for exactly that reason: a head says "this way",
 * and a line has no this-way to say.
 *
 * It shares this type anyway because it shares everything else. It is two
 * points, it bows on the same handle, it takes a label in the same place, it
 * binds to players and follows them, and it fades on the same strength slider.
 * Giving it its own mark type would have meant a second copy of all of that
 * behaviour, kept true by hand, so that one boolean could live somewhere
 * tidier. `TOKEN_KINDS` and `BALL_KINDS` in ../arrows.ts are what keep it out
 * of the movement machinery, and `perform` is never handed one.
 */

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
  /**
   * How strongly it is drawn, 0..1. Undefined means 1, which is what every
   * arrow drawn before this existed already did.
   *
   * WHY AN ARROW GETS TO BE INVISIBLE AT ALL
   *
   * A phase is not a picture, it is a beat in an explanation, and a coach
   * explaining a pattern wants the arrows to ARRIVE — the run first, then the
   * pass it opens. Until now the only way to stage that was to keep drawing
   * the same arrow again on later phases, which meant redrawing it every time
   * anything about it changed. Setting it to 0 on the early phases and back to
   * 1 on the phase it belongs to says the same thing once.
   *
   * It is authored, and it is SEPARATE from the transition alpha in
   * ../tween.ts. The two multiply: an arrow the coach has set to 40% still
   * fades in over the beat, to 40%. See `RenderArrow`.
   *
   * A hidden arrow is still on the phase and still in the marks list, because
   * hiding is a staging decision and deleting is not. It keeps its ends bound
   * and follows its players while it is invisible, so the phase it reappears on
   * has it in the right place with no work.
   */
  opacity?: number
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
 *
 * The triangle and the diamond are the two shapes a space is DIRECTIONAL in. A
 * pressing trap is a funnel — wide where they receive it, narrow where it
 * closes — and drawn as a box it says the opposite, that the whole area is
 * equally bad to be in. A diamond is the same argument about a pocket between
 * four players: it is widest across the middle and it has a top and a bottom,
 * which is what makes it read as the space between the lines rather than a
 * patch of grass (user, 2026-08-28).
 *
 * ALL FIVE STORE THE SAME `rect`. The shape is appearance, not geometry: the
 * resize grips are the same four corners whichever is showing, changing a
 * triangle to an oval is a repaint rather than a redraw, and a build that has
 * never heard of a diamond opens the document and draws the box it is stored
 * as. That is what makes adding one of these safe.
 */
export type BandShape = 'box' | 'round' | 'ellipse' | 'triangle' | 'diamond'

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
 * A match ball on the grass.
 *
 * ── WHY THERE ARE SEVERAL, AND WHY THEY ARE ALL "THE MATCH BALL" ────────────
 *
 * There was one ball per phase, and for a move being taught — a switch, a
 * rotation, a pressing trap — one is right, because the whole point is that
 * everyone is looking at the same object. But a session is not only moves. A
 * rondo has a ball per grid, a finishing station has a rack of them beside the
 * cone, and a coach drawing that had to choose which one to lie about.
 *
 * There is no second class of ball, though, and that is deliberate: an earlier
 * pass at this put anonymous "loose balls" in the gear picker beside the
 * photographed match balls, which meant two vocabularies for one object and a
 * coach who wanted a Trionda lying on the grass beside the Trionda being passed
 * could not have one (user, 2026-08-27). Every ball here is a match ball,
 * wearing whatever `System.matchBall` says, at the system's size and turn.
 *
 * ── WHAT THE ID IS FOR ──────────────────────────────────────────────────────
 *
 * The same thing gear ids are for: a ball matched by id across two phases LERPS
 * between them on Play (../tween.ts), so it is that ball travelling rather than
 * one vanishing and another appearing. It is also how ../actions.ts knows which
 * ball a pass moved, and how ../audio.ts knows one was kicked.
 */
export interface BallMark {
  id: string
  /** Percent coords, the same space a token is stored in. */
  x: number
  y: number
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
  /**
   * This phase's camera, overriding the document's.
   *
   * Undefined is "use the system's", and that is what every phase written
   * before this existed says. Its one real use is a starting line: mark the
   * phases before the idea starts 'off' and the camera holds still through the
   * opening, then begins to track, without any of those phases being reframed.
   * The editor writes it that way and nobody should have to set it by hand.
   */
  camera?: CameraMode
  tokens: Token[]
  /**
   * THE LEGACY SINGLE BALL. Read `balls` instead — see `ballsOf`.
   *
   * Every act used to have exactly one ball or none, and this held it. It is
   * still written, mirroring `balls[0]`, for one reason: a share link is a
   * document in a URL, and somebody opening one in a tab that has an older
   * bundle cached must not get a board with no ball on it. It costs two numbers
   * per act to keep that promise.
   *
   * Nothing should READ it except `ballsOf`, which uses it as the answer for a
   * document written before `balls` existed.
   */
  ball: { x: number; y: number } | null
  /**
   * The match balls on this phase. See `BallMark`.
   *
   * Optional because every act written before this existed has none of it, and
   * `ballsOf` reads those through `ball` above.
   */
  balls?: BallMark[]
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

/**
 * A training bib: a colour worn by a player, over whatever their side is in.
 *
 * Coaches asked for three things and they are one thing (2026-08-28): a keeper
 * who is not in the outfield shirt, three-colour training, and seven against
 * seven plus seven.
 *
 * ── WHY THIS IS NOT A THIRD `Side` ──────────────────────────────────────────
 *
 * Seven plus seven has three groups on the grass, so the obvious model is a
 * third side. It is the wrong one. `side` is TACTICS: it decides which way a
 * formation faces, which goal a block shades back to, which half of the board a
 * shape is laid into and what "Keep my shape" mirrors — see ./formations.ts.
 * None of those has an answer for a group of neutrals, and a third side would
 * mean teaching every one of them a case they have no opinion about.
 *
 * A bib is PAINT. The plus-seven are still on a side for the geometry; they are
 * just not drawn in that side's colour. Which is also what happens on the
 * grass, where the neutrals join whichever team has the ball.
 *
 * ── WHY IT IS A NAMED LIST AND NOT A COLOUR PER PLAYER ──────────────────────
 *
 * It is both, through one mechanism. A bib worn by one player IS a per-player
 * colour, and that is how the keeper gets a different shirt: the picker makes
 * one for you when you choose a colour instead of a swatch. What the list buys
 * is the case they actually asked about. Three-colour training is three
 * swatches and twenty-one clicks rather than twenty-one colour pickers, the
 * seven yellows are the SAME yellow, and "the neutrals" is a thing with a name
 * that can be counted, recoloured in one place, and printed in a legend later.
 *
 * ── IT IS A `TeamStyle`, AND THAT IS THE WHOLE IMPLEMENTATION ───────────────
 *
 * Not a hex string. `Token` already knows how to dress a counter from one of
 * these — the dome, the shaded underside, the trim ring, the pattern and its
 * second colour, the label colour that flips to stay readable — so a bib that
 * was a bare colour would be a second and poorer way of doing what the board
 * already does. Bibs can therefore have hoops, and no drawing code was added
 * for any of this: `kitFor` below hands one to the same component that is
 * handed `teams.us`, and the video exporter, the print sheet and every share
 * link are pure SVG off that single call.
 */
export interface Bib extends TeamStyle {
  /** Referenced by `Token.bib`. */
  id: string
}

/**
 * Where a player's name sits relative to their counter.
 *
 * 'above' is the original and the default. 'below' is for a board whose room is
 * above the players — a full-pitch view where the names collided with the title
 * plate, or a system whose photographs are raised and want the air.
 */
export type NamePlace = 'above' | 'below'

/**
 * Where a player's photograph sits.
 *
 * 'above' raises it over the counter, which keeps the kit, the pattern and the
 * number all readable at once — see the long note in ./board/Token.tsx.
 * 'inside' puts the face in the counter itself and sends the number out to ride
 * in front of the name. It is the stronger picture of ONE player, which is what
 * a coach wants when the board is a starting eleven rather than a movement.
 */
export type PhotoPlace = 'above' | 'inside'

export interface System {
  /** Schema version, so stored documents can be migrated in place. */
  v: 1
  title: string
  /** Optional subtitle for the title slide. */
  subtitle?: string
  /** Optional folder to organise the system. */
  folder?: string
  pitch: PitchViewId
  /**
   * The coned rectangle a session is run in — only on a training board.
   *
   * WHY IT IS ON THE SYSTEM AND NOT ON THE VIEW. The size of the grid is the
   * thing a coach changes most: rondos run 8x8 to 40x40, possession games out
   * to 40x35, small-sided pitches to 91x55 (docs/TRAINING.md 1b, 1e). Four
   * fixed views were four points in that range. A view is a CROP, and the crop
   * here is derived from these two numbers plus the margin — see `trainingView`
   * and `viewFor` in ./board/pitch.ts, which are the only things that read it.
   *
   * Absent on every match view and on every document written before this
   * existed, and `viewFor` fills in `DEFAULT_AREA` when it is missing, so a
   * board that names `training` without one is a 30 x 20 possession grid.
   */
  area?: SessionArea
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
   * Where a player's name is printed, and where their photograph goes.
   *
   * On the SYSTEM and never on a player, for the same reason the surface is:
   * a board with three names above, two below and one face in a counter is a
   * board a room has to learn before it can read. One choice, twenty-two
   * counters, and it travels into every export, print and share link.
   *
   * Undefined is the way the board has always drawn — name above the counter,
   * photograph above the name — so every document written before this reads
   * back exactly as it was filmed.
   */
  namePlace?: NamePlace
  photoPlace?: PhotoPlace
  /** Optional rotation for all player photos (0, 90, 180, 270) */
  photoAngle?: number
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
   * The grid ruled onto the pitch: thirds, five channels, the eighteen
   * numbered zones. Empty or absent is the plain pitch.
   *
   * On the document beside the surface, and furniture rather than a mark: a
   * coach who works in corridors gets the corridors ruled in, at the real
   * numbers, in every phase and every export, instead of redrawing them by
   * hand at the top of each session. It is NOT a second pitch view — the view
   * is the crop, this is what is ruled onto whatever the crop shows, and the
   * two multiply.
   *
   * A loose `string` for the same reason a band's appearance is (see `Band`):
   * a grid added next year must not stop this build opening the file. Unknown
   * values fall back to the plain pitch in `resolveGrid()`.
   */
  grid?: string
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
  /**
   * The bibs this board has, if any. See `Bib`.
   *
   * Absent or empty is a board with nobody in a bib, which is every board built
   * before they existed and most boards after — a tactics presentation is two
   * teams and wants none of this. Nothing about bibs is drawn until a coach
   * makes one.
   *
   * On the SYSTEM and beside `teams`, rather than on the coach's profile. The
   * groups are part of what this session IS: a share link, a printed page and a
   * film all have to open on the same three colours the coach assigned, where a
   * profile setting would draw one link two ways for two viewers. Same call the
   * surface and the camera make.
   */
  bibs?: Bib[]
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
 * What one counter is drawn in: their bib if they are wearing one, their side's
 * kit if they are not.
 *
 * THE ONE WAY TO ASK, for the reason `ballsOf` is the one way to read a phase's
 * balls. Every surface that draws a player goes through ./board/Board.tsx,
 * which goes through here, so there is no renderer that can be left painting a
 * neutral in the home shirt.
 *
 * A bib id that names nothing resolves to the side. That covers a bib the coach
 * deleted and a document written by a build that has bibs this one has never
 * heard of: the board comes up in the wrong colour, which is recoverable, and
 * never with holes in it, which is not.
 */
export function kitFor(system: System, token: Pick<Token, 'side' | 'bib'>): TeamStyle {
  const bib = token.bib ? system.bibs?.find((b) => b.id === token.bib) : undefined
  if (bib) return bib
  return token.side === 'us' ? system.teams.us : (system.teams.them ?? system.teams.us)
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
/**
 * The same board with nothing on it that names anybody.
 *
 * ── WHAT "PERSONAL DETAILS" MEANS, LISTED RATHER THAN IMPLIED ────────────────
 *
 * A coach asked to be able to send a board without their name on it (user,
 * 2026-08-28), and the honest reading of that request is wider than the credit
 * line. Three separate things on a document identify somebody:
 *
 *   1. THE COACH.  `credit.presenter` and `credit.team`.
 *   2. THE CLUB.   The crest. Also its URL, which contains the account's uuid.
 *   3. THE SQUAD.  Every player's `name`, and every `photo` path — which again
 *      contains the account's uuid, and which is account-private data by
 *      decision (see ./account/squad.ts). A shared board never carried the
 *      FACES, because supabase/013 will not sign a path a stranger does not
 *      own, but it did carry the names. `playerId` joined them when the lineup
 *      panel was built: it is a key into `studio_squad`, which is own-row.
 *
 * Taking one and leaving the others is the kind of half-answer that reads as a
 * bug: a board that says "not presented by anybody" over eleven counters with
 * real children's names on them has not hidden anything.
 *
 * ── WHAT IT DELIBERATELY KEEPS ───────────────────────────────────────────────
 *
 * The tactics. Counter labels ("6", "LB") are positions and not people, the
 * kit colours are the coach's taste rather than their identity, and
 * `credit.note` ("Pre-season, week 2") is about the session. `sharedOn` stays
 * too: it says how current the thing you are reading is, which is the one piece
 * of provenance an anonymous board still owes its reader.
 *
 * ── IT IS APPLIED AT THE EDGE, AND NEVER TO THE STORED DOCUMENT ──────────────
 *
 * The board on the coach's screen keeps every one of these. This runs on the
 * copy handed to an exporter, a renderer or `publishSystem`, so turning the
 * switch back on restores everything without anything having been recovered.
 * For a share link that is also the strong form of the promise: the names are
 * not hidden in the public row behind a flag the viewer is trusted to honour,
 * they were never sent.
 */
export function withoutIdentity(system: System): System {
  const credit = system.credit
    ? { ...system.credit, presenter: undefined, team: undefined }
    : undefined

  return {
    ...system,
    credit,
    // Both halves. `showCrest` alone would leave the URL — and the account uuid
    // inside it — in a published row that draws no crest, which is the leak
    // without even the picture to show for it.
    showCrest: false,
    crestUrl: undefined,
    acts: system.acts.map((act) => ({
      ...act,
      tokens: act.tokens.map((t) =>
        // `playerId` with the other two, not because a uuid names anybody to a
        // stranger but because it is a key into a table only this account may
        // read, and a document that carries one is carrying a reference to
        // private data for no reader who could ever use it. All three or none:
        // taking the name and leaving the pointer to the name is the shape of
        // leak this whole function exists to avoid.
        t.name || t.photo || t.playerId
          ? { ...t, name: undefined, photo: undefined, playerId: undefined }
          : t,
      ),
    })),
  }
}

export const CENTRE_SPOT = { x: 50, y: 50 }

/**
 * The balls on an act, whenever and however it was written.
 *
 * THE ONE WAY TO READ THEM. `Act.balls` is the truth on anything written since
 * balls became a list; `Act.ball` is the truth on everything before it, and a
 * document from then is a document a coach can still open from a link they sent
 * last month. Every reader goes through here so neither of those is a special
 * case anywhere else in the codebase.
 */
export function ballsOf(act: Act): BallMark[] {
  if (act.balls) return act.balls
  return act.ball ? [{ id: LEGACY_BALL_ID, ...act.ball }] : []
}

/**
 * The id a document's original single ball is read back under.
 *
 * Stable rather than generated, so a ball that was on two phases before the
 * list existed is still the SAME ball on both of them and still travels between
 * them on Play. A fresh uid per act would have quietly turned every move into a
 * ball vanishing and another one appearing.
 */
export const LEGACY_BALL_ID = 'ball'

/**
 * The two fields that say where the balls are, to spread into an act.
 *
 * FIELDS rather than a whole act, deliberately. A `withBalls(act, …)` that
 * returned the act would have to spread `...act` inside itself, and spreading
 * that into an object literal already halfway through rebuilding the act — as
 * the pitch-view remap does — would quietly put the ORIGINAL tokens back over
 * the remapped ones. Returning only what it owns cannot do that.
 *
 * The mirror is the reason it is a function at all: `ball` has to keep saying
 * what the first ball is, or a share link opened against an older bundle loses
 * its ball. See `Act.ball`.
 */
export function ballFields(balls: BallMark[]): Pick<Act, 'balls' | 'ball'> {
  const first = balls[0]
  return { balls, ball: first ? { x: first.x, y: first.y } : null }
}

/** A new ball, at a spot of your choosing. */
export function newBall(at: { x: number; y: number } = CENTRE_SPOT): BallMark {
  return { id: uid('ball'), x: at.x, y: at.y }
}

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
