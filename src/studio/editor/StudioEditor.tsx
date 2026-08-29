/**
 * The studio.
 *
 * One React island, entirely client-side, because the site builds static (see
 * astro.config.mjs `output: 'static'`) and because the editing loop — pick up a
 * counter, move it, put it down — has to be immediate. Nothing here round-trips
 * to a server; ../storage.ts writes to localStorage on every change and the
 * Supabase sync will sit behind that as a write-through cache.
 *
 * The constraint that shapes this file: a coach is not a designer. Every
 * control either picks football (a shape, a view, an intent) or picks identity
 * (their colours, their crest). None of them picks drawing properties. Dash
 * patterns, opacities, easing and z-order are decided in ../board and are not
 * exposed, which is the only reason a board built here still looks like ours.
 *
 * The second constraint, and the reason this file carries a whole guidance
 * layer: the people this is for are coaches in their fifties, not people who
 * use editors. The tool being capable is not the same as the tool being usable
 * by them. So every control has a hint written in their language (./guide.ts),
 * the mental model gets taught once on arrival (./Walkthrough.tsx), and the
 * order to do things in is on screen until it is not needed (./GuideRail.tsx).
 * An "Act" is a "phase" everywhere a coach can read it — see PHASE in
 * ./guide.ts for why the code does not rename the type.
 *
 * THE THREE THINGS THAT ARE EASY TO GET WRONG IN HERE:
 *
 *  · Every document change goes through `edit()` or `patchAct()`, both of which
 *    take a LABEL. The label is what groups a drag into one undo (./history.ts).
 *    A `setSystem` that skips them is a change a coach cannot take back.
 *  · Selection is one of two things at a time, never both: a player, or a mark.
 *    `select*` helpers enforce it so Delete never has to guess.
 *  · The layout exists twice — beside the board on a wide screen, stacked under
 *    it on a narrow one. The panels themselves are built ONCE, into variables,
 *    and composed differently. Do not fork them.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Board,
  clampToBoard,
  clientToPercent,
  type ArrowPart,
  type BoardMode,
  type FramePart,
} from '../board/Board'
import { arrowRim, bendFor } from '../board/Overlays'
import { arrowEnds, bindEnd, snapTarget } from '../arrows'
import { SET_PIECES, SET_PIECE_BY_ID, arrange, spotToPercent } from '../setpieces'
import { perform, type ActionKind, type Target } from '../actions'
import {
  PITCH_VIEWS,
  PITCH_GRID_LIST,
  PITCH_VIEW_LIST,
  aspect,
  cropRect,
  remap,
  resolveGrid,
  resolveViewId,
  toMetres,
  toPercent,
  toUnits,
  unitsToPercent,
} from '../board/pitch'
import type { PitchView } from '../board/pitch'
import { readableText, darken } from '../board/palette'
import {
  PITCH_SURFACES,
  DEFAULT_SURFACE,
  arrowStyle,
  BAND_CORNERS,
  BAND_EDGES,
  BAND_FILLS,
  BAND_STRENGTHS,
  BAND_STRINGS,
  BAND_TONES,
  resolveBandStyle,
  resolveSurface,
  resolveTextStyle,
  TEXT_ALIGNS,
  TEXT_LOOKS,
  TEXT_SIZES,
  TEXT_WEIGHTS,
  type BandStrength,
  type BandTone,
  type PitchSurfaceId,
} from '../board/surfaces'
import { BALLS, DEFAULT_BALL, resolveBall, type BallId } from '../balls'
import {
  CAMERA_MODES,
  CAMERA_PUSHES,
  cameraRect,
  frameMetres,
  resolveCamera,
  resolvePush,
  viewMetres,
  type CameraMode,
  type CameraPush,
} from '../camera'
import {
  FORMATIONS,
  FORMATION_BY_ID,
  castFor,
  formationsByFamily,
  mirrorBand,
  place,
  relabel,
  rescaleX,
  usBand,
  type LabelMode,
} from '../formations'
import {
  CENTRE_SPOT,
  DEFAULT_THEM,
  DEFAULT_US,
  ballFields,
  ballsOf,
  emptyAct,
  newBall,
  uid,
  withoutIdentity,
  type Act,
  type Arrow,
  type ArrowKind,
  type Band,
  type Bib,
  type BandKind,
  type BandShape,
  type Credit,
  type Cue,
  type Shot,
  type GearMark,
  type NamePlace,
  type PhotoPlace,
  type Side,
  type System,
  type TextMark,
  type Token,
} from '../schema'
import { GEAR, GEAR_GROUPS, GEAR_SIZE_MAX, GEAR_SIZE_MIN, gearSize, resolveGear } from '../gear'
import { shouldAsk, shouldAskOnOpen, type FeedbackContext } from '../feedback'
import { holdMs, moveMs } from '../pace'
import { resolveAct, timelineAt, totalDuration, tweenActs } from '../tween'
import {
  readGuide,
  readStripSize,
  saveSystem,
  writeGuide,
  writeStripSize,
  STRIP_HEIGHTS,
  STRIP_LABELS,
  STRIP_SIZES,
  type GuideState,
  type StripSize,
} from '../storage'
import { useCloudSync } from '../account/sync'
import { useSession } from '../account/session'
import { useProfileOrNull } from '../account/profile'
import { withProfile } from '../account/cloud'
import { imageUrl } from '../account/images'
import { SquadPick, useSquad, useSquadPhotos } from './SquadPick'
import { GuideRail } from './GuideRail'
import {
  ACTION,
  ARROW_MARK,
  ARROW_TOOL_IDS,
  LINE_TOOL_ID,
  TWO_POINT_TOOL_IDS,
  DRAWER,
  TEXT_TOOL_ID,
  HINT,
  NEWS,
  PHASE,
  RAIL_STEPS,
  TOOL_DOC,
  ZONE_TOOL_IDS,
  type RailStep,
  type ToolId,
} from './guide'
import { useHistory } from './history'
import { ShareDialog } from './ShareDialog'
import { SignInPanel, SignInPill, SignInWall } from './SignInWall'
import { SmallScreen, isSmallScreen } from './SmallScreen'
import { ThemeToggle } from './ThemeToggle'
import { VideoDialog } from './VideoDialog'
import { ExportDialog } from './ExportDialog'
import { Tip } from './Tip'
import { Walkthrough } from './Walkthrough'
import { UpgradesWalkthrough } from './UpgradesWalkthrough'
import { HelpPanel } from './HelpPanel'
import { HelpRing } from './HelpRing'
import { FeedbackDialog } from './FeedbackDialog'
import { PrintSheet } from '../viewer/PrintSheet'
import { PaceField } from './PaceField'
import { NewsBell } from './WhatsNew'
import {
  Button,
  ColorWell,
  ConfirmButton,
  Field,
  GearPicker,
  Panel,
  PicturePicker,
  Section,
  Segmented,
  Select,
  Slider,
  SurfacePicker,
  TextArea,
  TextInput,
  Toggle,
} from './ui'
import { NEWEST_NEWS_ID, unseenNews } from '../../data/whatsnew'

const CUES: Cue[] = ['PRESS', 'COVER', 'BALANCE', 'SPARE', 'JOCKEY', 'DROP']

/**
 * What the pointer does on the board. `select` moves and picks things up;
 * everything else is drawn by dragging, and reverts to `select` when it lands —
 * a coach draws one pass and then wants to move somebody, not draw nine passes.
 */
type Tool = ToolId

/**
 * Drawn by pulling between two points. Arrows AND the line.
 *
 * This is the drawing question: does the pointer draw a curve from where it
 * pressed to where it let go, does it keep the counters live so an end can be
 * dropped on one, and does it preview as a stroke. All six answer yes.
 */
const isArrowTool = (t: Tool): t is ArrowKind => (TWO_POINT_TOOL_IDS as readonly string[]).includes(t)

/**
 * The five that also POSE THE NEXT PHASE when they are tapped twice.
 *
 * A separate question from the one above, and it has to be, because the line
 * answers the two differently: it is drawn exactly like an arrow and it
 * performs nothing. Tapping a player with it armed must not arm him — there is
 * no second tap that could mean anything, `perform` in ../actions.ts has no
 * case for a line, and a coach who got a new phase out of drawing an offside
 * line would rightly call that broken.
 */
const isActionTool = (t: Tool): t is ActionKind => (ARROW_TOOL_IDS as readonly string[]).includes(t)
const isZoneTool = (t: Tool): t is 'danger' | 'zone' => (ZONE_TOOL_IDS as readonly string[]).includes(t)

/**
 * The one tool that is not a drag.
 *
 * Every other tool works by pressing the grass and pulling: an arrow is two
 * points, a zone is two corners. A block is a LIST OF PLAYERS, and there is no
 * honest way to express "these four, in this order" as a rectangle — a lasso
 * would pick up whoever happened to be standing inside it, which is exactly the
 * mistake the automatic block used to make when it took the four deepest
 * outfielders regardless of shape.
 *
 * So it is clicks, and it has to be told apart from the drag tools everywhere
 * the board decides what a pointer means. That is what this predicate is for.
 */
const isPickTool = (t: Tool): t is 'block' => t === 'block'

/**
 * The other tool that is not a drag — and unlike the block, not a sequence of
 * clicks either. It is ONE click.
 *
 * Writing on a board is the one mark with no geometry to draw: there are no
 * ends to pull and no corners to set, only a place for the words to start. So
 * the gesture is the shortest one there is, and everything else about the mark
 * is set afterwards in the panel, where a coach can actually see what they are
 * typing. Making a coach drag out a box first, before there was any text to
 * size it against, would be ceremony in front of the one thing they came to do.
 */
const isTextTool = (t: Tool): t is 'text' => t === TEXT_TOOL_ID

/** The most players a hand-drawn block can be threaded through. */
const BLOCK_MAX = 6

/**
 * How long after the studio opens the occasional feedback ask may fire.
 *
 * Long enough to have done something, short enough to still be at the board.
 * Forty seconds is roughly "placed a formation and looked at it" — before that
 * a coach has no opinion of today yet, and much after it they are mid-something
 * and the ask becomes an interruption rather than a pause.
 */
const OPEN_ASK_DELAY_MS = 40_000

/**
 * What is selected. One thing at a time and never two kinds at once, so Delete
 * and the inspector both have exactly one question to answer.
 */
type Selection = { kind: 'token'; id: string } | { kind: 'mark'; id: string } | null

/**
 * The outline a band is currently drawn with, resolved exactly the way
 * `resolveBandStyle` resolves it — including the older `solid: true`, so a
 * board saved before the three-way control existed opens with its own answer
 * selected rather than with the house default lit up under a solid edge.
 */
function bandEdgeOf(b: Band): string {
  if (BAND_EDGES.some((e) => e.id === b.edge)) return b.edge!
  if (b.solid) return 'solid'
  return b.kind === 'block' ? 'solid' : 'dashed'
}

/** Which side a band belongs to, read back off the players it runs through. */
function bandSide(band: Band, act: Act): Side {
  return act.tokens.find((t) => t.id === band.throughTokens?.[0])?.side ?? 'us'
}

/**
 * Carry a coach's per-player editing across a re-place.
 *
 * Re-placing a formation resets POSITIONS, which is the point of it. It must
 * not also throw away the label they retyped, the name they added, the player
 * they picked, the cue they assigned or the fade they set — those are the parts
 * they had to think about.
 * Matched by token id, which is stable by construction (see ../schema.ts).
 *
 * EVERY OPTIONAL FIELD ON `Token` HAS TO BE NAMED HERE. The list is spelled out
 * rather than spread because a spread would carry `x` and `y` too and undo the
 * re-placement entirely — which means adding a field to the schema and not to
 * this line silently drops it the next time a coach changes formation. `photo`
 * was the first one to prove it.
 *
 * `keepLabel` IS OFF WHEN THE SHAPE ITSELF CHANGES, and that is the one field
 * that cannot be carried blind. Re-placing a 4-3-3 as a 4-3-3 should keep the
 * label a coach retyped, because the man is still playing that position. Laying
 * a 4-2-3-1 over it should not: `us-LCM` exists in both and means something
 * different in each, so carrying the old label would leave a counter announcing
 * a position nobody on the board is playing. `place` has already written the
 * right one for the new shape, so the honest move is to let it stand.
 */
function withEdits(placed: Token[], previous: Token[], keepLabel = true): Token[] {
  const prev = new Map(previous.map((t) => [t.id, t]))
  return placed.map((t) => {
    const p = prev.get(t.id)
    if (!p) return t
    return {
      ...t,
      label: keepLabel ? p.label : t.label,
      name: p.name,
      photo: p.photo,
      cue: p.cue,
      dim: p.dim,
      // The bib is the one thing here that is not per-phase editing at all: it
      // is what the player is wearing, and a re-place is not a change of shirt.
      bib: p.bib,
    }
  })
}

/**
 * Every mark in a system, re-expressed against a different crop.
 *
 * Percent coordinates are relative to the view, so they cannot be carried from
 * one to another — but they can be RE-EXPRESSED: out to metres in the old view
 * and back into percent in the new one, which leaves everything on the same
 * patch of grass. Nobody is moved and nothing is deleted.
 *
 * At module scope because two callers need it and they must not disagree: the
 * pitch picker, and applying a set piece — which changes the view and poses the
 * board in one go, and would otherwise have to change the view, wait a render
 * for `system.pitch` to catch up, and then pose against a stale crop.
 */
function remapSystem(s: System, pitch: System['pitch']): System {
  const from = PITCH_VIEWS[resolveViewId(s.pitch)]
  const to = PITCH_VIEWS[resolveViewId(pitch)]
  if (from === to) return s.pitch === pitch ? s : { ...s, pitch }
  const rp = (p: { x: number; y: number }) => remap(from, to, p.x, p.y)
  return {
    ...s,
    pitch,
    acts: s.acts.map((a) => ({
      ...a,
      tokens: a.tokens.map((t) => ({ ...t, ...rp(t) })),
      ...ballFields(ballsOf(a).map((b) => ({ ...b, ...rp(b) }))),
      arrows: a.arrows.map((ar) => ({ ...ar, from: rp(ar.from), to: rp(ar.to) })),
      bands: a.bands.map((b) => {
        if (!b.rect) return b
        const tl = rp({ x: b.rect.x, y: b.rect.y })
        const br = rp({ x: b.rect.x + b.rect.w, y: b.rect.y + b.rect.h })
        return { ...b, rect: { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y } }
      }),
    })),
  }
}

/**
 * The id every set piece's delivery arrow is drawn under.
 *
 * Fixed rather than generated, so pressing a second set piece REPLACES the
 * first one's ball rather than leaving a corner routine with two crosses on it.
 * An arrow the coach drew themselves has a `uid` and is never this, so their
 * own work is untouched either way.
 */
const DELIVERY_ID = 'sp-delivery'

/**
 * The bib colours the button hands out, in order, and what they are called.
 *
 * Real bib colours, and picked to sit clear of BOTH default kits and of the
 * grass: the studio's green and the house red are already on the board, so a
 * bib that is nearly either of them tells a room nothing. Yellow first, because
 * a yellow bib is what is in every kit bag in the world.
 *
 * A coach who wants a colour that is not here picks one, and gets a bib in that
 * colour with a name they can change. This list only decides what they get when
 * they do not choose.
 */
const BIB_SEEDS: { name: string; base: string }[] = [
  { name: 'Yellows', base: '#F2C230' },
  { name: 'Blues', base: '#2F6FE0' },
  { name: 'Oranges', base: '#E8722C' },
  { name: 'Whites', base: '#F1F0EA' },
  { name: 'Pinks', base: '#E0569F' },
  { name: 'Blacks', base: '#2B2F36' },
]

/**
 * The bib picker on a selected player: no bib, then one swatch per bib on the
 * board, then a colour well that makes a new one.
 *
 * THE LAST SWATCH IS THE WHOLE ANSWER to "can I not just colour this one
 * player". It is a native colour input wearing a plus, and choosing a colour in
 * it makes a bib of that colour and puts this player in it. So a coach who
 * wants the keeper in yellow gets the keeper in yellow without ever meeting the
 * idea of a group, and a coach running three-colour training gets the group
 * they need, off one mechanism and one stored field. Two ways to colour a
 * counter would have meant two answers to "what colour is this man", which is
 * the thing `kitFor` exists to prevent.
 */
function BibSwatches({
  bibs,
  worn,
  onWear,
  onCreate,
  seed,
}: {
  bibs: Bib[]
  worn?: string
  onWear: (id: string | undefined) => void
  onCreate: (hex: string) => void
  /** What the colour well opens on: the next bib colour nobody has taken. */
  seed: string
}) {
  const swatch = (on: boolean) =>
    `flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
      on ? 'border-ink ring-2 ring-ink/25' : 'border-ink-hair hover:border-ink-faint'
    }`

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onWear(undefined)}
        aria-pressed={!worn}
        title="No bib. This player wears the team kit."
        className={`${swatch(!worn)} border-dashed text-[9px] uppercase text-ink-faint`}
      >
        Kit
      </button>
      {bibs.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => onWear(b.id)}
          aria-pressed={worn === b.id}
          title={b.name}
          className={swatch(worn === b.id)}
          style={{ background: b.base }}
        />
      ))}
      <span className={`${swatch(false)} relative overflow-hidden`} title="A colour of your own">
        <span className="pointer-events-none text-sm leading-none text-ink-faint">+</span>
        <input
          type="color"
          value={seed}
          onChange={(e) => onCreate(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Make a bib in a colour of your own"
        />
      </span>
    </div>
  )
}

/**
 * The band to lay the opposition into while "Keep my shape" is on.
 *
 * `undefined` — not null — because that is what `place` wants for "use the
 * view's own default", and there are shapes with nothing worth mirroring.
 */
function oppositionBand(tokens: Token[]): [number, number] | undefined {
  return mirrorBand(tokens.filter((t) => t.side === 'us').map((t) => t.x)) ?? undefined
}

/**
 * Which way a hand-picked block should be closed off, before the coach says.
 *
 * The question a block answers is "what is this unit protecting". When the unit
 * is the deepest thing on the pitch, the answer is the goal behind them, and
 * shading back to it is the drawing every video uses. When somebody of theirs
 * is standing BEHIND the picked line — a front three pressing, a midfield
 * screen — the goal is not what they are protecting, and shading to it swallows
 * their own team-mates and half the pitch with them. That was the whole
 * complaint (user, 2026-08-21) and this is the rule that answers it:
 *
 *   is there a team-mate deeper than everyone I picked? → close the shape
 *   nobody behind them but the keeper?                  → close to the goal
 *
 * A suggestion and not a decision: the coach has the control in front of them
 * while they are picking, and whatever they set is what gets stored.
 */
function suggestClose(picked: Token[], tokens: Token[], view: PitchView): 'goal' | 'shape' {
  if (!picked.length) return 'goal'
  const side = picked[0].side
  const depth = (t: Token) => {
    const m = toMetres(view, t.x, t.y).x
    return side === 'us' ? m : 105 - m
  }
  const front = Math.min(...picked.map(depth))
  const ids = new Set(picked.map((t) => t.id))
  // The keeper never counts. He is behind every line his team ever holds, and
  // counting him would mean no block is ever closed to the goal again.
  const behind = tokens.some(
    (t) => t.side === side && !ids.has(t.id) && !t.id.endsWith('-GK') && depth(t) < front - 1,
  )
  return behind ? 'shape' : 'goal'
}

/**
 * The deepest line of a side, worked out from where the players actually are.
 *
 * "Add block" used to take the four deepest outfielders, full stop, which is
 * right for a back four and wrong for every other shape we ship — a back three
 * got a fourth player dragged into its line, and a back five lost a wing-back.
 * Grouping by the GAP between players instead reads the line off the board:
 * defenders standing level are one line, and the space in front of them is
 * where the line ends. Three, four and five all come out correct, and so does a
 * back four that the coach has already dragged out of shape.
 *
 * Depth is measured in METRES, not in percent. Percent is percent-of-crop, so a
 * seven-metre gap is 7% of a full pitch and 23% of the box view, and a
 * percentage threshold would find a different line depending on how far the
 * camera happened to be pushed in.
 */
const LINE_GAP_M = 7
const LINE_MAX = 5

function backLine(tokens: Token[], side: Side, view: PitchView): Token[] {
  const outfield = tokens.filter((t) => t.side === side && !t.id.endsWith('-GK'))
  if (outfield.length < 2) return []

  // Distance from the goal this side is defending, in metres up the pitch.
  const depth = (t: Token) => {
    const m = toMetres(view, t.x, t.y).x
    return side === 'us' ? m : 105 - m
  }

  const sorted = [...outfield].sort((a, b) => depth(a) - depth(b))
  const line = [sorted[0]]
  for (let i = 1; i < sorted.length && line.length < LINE_MAX; i++) {
    if (depth(sorted[i]) - depth(sorted[i - 1]) > LINE_GAP_M) break
    line.push(sorted[i])
  }
  // Two players is the fewest that make a line worth shading. If the deepest
  // player is standing on their own, take the next one anyway rather than
  // refusing to do anything, which reads as a broken button.
  const chosen = line.length >= 2 ? line : sorted.slice(0, 2)
  return [...chosen].sort((a, b) => a.y - b.y)
}

/** Live media query. Drives the layout only; the small-screen door is separate. */
function useMediaQuery(query: string): boolean {
  // Read synchronously on first render. The studio is `client:only`, so there
  // is no server pass to mismatch against, and starting at `false` would build
  // the wide layout and then throw it away on a phone.
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}

interface Props {
  systemId: string
  initial: System
  /**
   * Open the studio, and let nobody change anything in it.
   *
   * WHAT THIS SERVES. `/o/press-4141` and `/o/escaping-the-trap` — our two
   * published systems, opened by somebody with no account, from a link a coach
   * passed on or from under one of the videos. The whole editor mounts: both
   * panels, the tool rail, the strip with every phase in it. Play works and the
   * phases step. Nothing else does, and every one of the dead controls opens the
   * door instead (./SignInWall.tsx).
   *
   * WHY THE WHOLE EDITOR RATHER THAN THE VIEWER. ../viewer/Viewer.tsx already
   * plays a system beautifully and it is still what a coach's own `/s/…` link
   * gets. But a slideshow shows the SYSTEM and hides the TOOL, and on these two
   * pages the tool is the thing being sold. Somebody who has just watched the
   * film should see the room it was built in.
   *
   * ── THE LOCK IS THE SEAM, NOT THE CHROME ─────────────────────────────────────
   *
   * `edit` below is wrapped, and every mutation in this file goes through it —
   * see `patchAct`. So the document cannot change no matter what is pressed,
   * what a stray handler does, or what somebody types into the console. The
   * greying and the intercepted regions are how it LOOKS right; that wrap is why
   * it IS right. Anything added to this file later inherits the lock for free by
   * doing what everything else already does.
   *
   * Three other things have to be switched off with it, and none of them are
   * cosmetic: the local autosave, the account sync, and everything that writes
   * to the guide. All three would otherwise treat a stranger looking at our
   * system as a coach working on theirs.
   */
  locked?: boolean
}

/**
 * Keep the magnified board covering the frame it is shown in.
 *
 * The wrapper is transformed from its top-left corner, so at zoom `z` its
 * content runs from `pan` to `pan + size × z`. The pan is therefore free
 * between `size × (1 − z)` and 0 — and at 100% that range collapses to exactly
 * one legal value, 0, which is what makes an unzoomed board unpannable without
 * a special case for it anywhere.
 */
function clampPan(x: number, y: number, z: number, w: number, h: number) {
  return {
    x: Math.max(w * (1 - z), Math.min(0, x)),
    y: Math.max(h * (1 - z), Math.min(0, y)),
  }
}

export default function StudioEditor({ systemId, initial, locked = false }: Props) {
  /*
   * A locked board opens on the first phase that has anybody on it.
   *
   * WHY THIS IS NOT ALWAYS 0. `the-4-1-4-1-press.json` opens on a title card —
   * a phase with a name and no players, which is exactly right in the film it
   * was rendered for and is a BARE PITCH as the first thing on a public page.
   * Somebody arriving from under that video, having been told this is the board
   * the system was built on, would land on an empty one; they have no reason to
   * press anything after that and every reason to leave.
   *
   * It is a viewing decision, not a change to the document. Phase one is still
   * in the strip, still one click away, and Play still runs the film from the
   * top — playback reads the whole timeline, never `actIndex`.
   *
   * Only when locked. A coach who owns this document must open on the phase
   * they left, empty or not, because on their board an empty phase is a phase
   * they are in the middle of building.
   */
  const [actIndex, setActIndex] = useState(() => {
    if (!locked) return 0
    const first = initial.acts.findIndex((a) => a.tokens.length > 0)
    return first === -1 ? 0 : first
  })
  const [selection, setSelection] = useState<Selection>(null)
  const [tool, setTool] = useState<Tool>('select')
  /**
   * The players picked so far for a hand-drawn block, in the order they were
   * clicked. Empty whenever the Block tool is not armed.
   *
   * ORDER IS THE DATA. The band threads a string through these ids in exactly
   * this sequence, so a coach who clicks left-back → centre-back → centre-back →
   * right-back gets a line across the pitch, and one who clicks them out of
   * order gets a zigzag and can see immediately that they did. Sorting them for
   * the coach would be second-guessing a deliberate act: a midfield screen with
   * one player dropped between the other two is a real shape and it is drawn by
   * clicking the deep one second.
   */
  const [blockPick, setBlockPick] = useState<string[]>([])
  /**
   * How the line being picked will be closed off.
   *
   * 'auto' is the default and is not a third way of drawing it — it means "keep
   * asking `suggestClose` as I click", so the answer follows the shape while it
   * is being built and a coach who picks a back four and then adds the two
   * midfielders in front of them sees it change from the goal to a closed shape
   * the moment that is the right drawing. Touching the control pins it.
   */
  const [blockClose, setBlockClose] = useState<'auto' | 'goal' | 'shape'>('auto')
  const [dragging, setDragging] = useState<{ kind: 'token' | 'ball'; id: string } | null>(null)
  const [pending, setPending] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null)
  /*
   * The counter an arrow end will take hold of if the coach lets go now.
   * Held in state ONLY to draw the ring on him — the binding itself is written
   * straight into the document on every move, so releasing outside a gesture
   * cannot leave the mark and the highlight disagreeing about what happened.
   */
  const [snapId, setSnapId] = useState<string | null>(null)
  /*
   * The player an armed arrow tool is acting FROM, between the two taps.
   *
   * A toggle rather than an append, for the reason `blockPick` is one: the
   * commonest mistake with a tap-to-pick control is tapping the wrong man, and
   * the only recovery anybody looks for is tapping him again. Nobody halfway
   * through drawing one mark thinks to reach for undo.
   */
  const [actor, setActor] = useState<string | null>(null)
  const [playhead, setPlayhead] = useState<number | null>(null)
  const [labels, setLabels] = useState<LabelMode>('position')
  const [usFormation, setUsFormation] = useState('4-3-3')
  const [themFormation, setThemFormation] = useState('4-4-2')
  /**
   * The shape a coach has asked for and not yet been given.
   *
   * Held here rather than applied on the spot because re-placing a shape throws
   * away every position posed by hand on the phases it lands on, and coaches
   * were finding that out afterwards (2026-08-28). The pickers stay on the
   * shape that is actually on the board while this is set, so cancelling needs
   * nothing put back.
   */
  const [shapePrompt, setShapePrompt] = useState<{ side: Side; formationId: string } | null>(null)
  /** The set piece last laid down, so the picker shows what the board is. Not on the document: it is a starting position, and the moment a coach drags anybody it stops being true of the board and starts being true only of where they began. */
  const [setPieceId, setSetPieceId] = useState('')
  const [preSetPieceSystem, setPreSetPieceSystem] = useState<System | null>(null)
  const [panelTab, setPanelTab] = useState<'setup' | 'phase'>('setup')

  // The phase on screen travels with an undo entry: taking back a change made
  // on phase 3 has to put you back on phase 3 to be worth anything.
  const actIndexRef = useRef(actIndex)
  actIndexRef.current = actIndex
  const getMeta = useCallback(() => ({ actIndex: actIndexRef.current }), [])
  const history = useHistory<System, { actIndex: number }>(initial, getMeta)
  const system = history.value
  // `rawEdit` is the real one, and it is taken apart from `history` on purpose:
  // it is the stable `useCallback` out of ./history.ts, where the object around
  // it is rebuilt every render. The wrapper below inherits that stability, and
  // every memoised handler in this file that closes over `edit` depends on it.
  const { edit: rawEdit, seal, replace } = history

  /** Is the sign-in sheet up? Only ever true on a locked board. */
  const [wall, setWall] = useState(false)

  /**
   * Somebody reached for something they cannot have.
   *
   * Returns whether it was refused, so a caller that has other work to do can
   * bail on one line: `if (refuse()) return`.
   */
  const refuse = useCallback((): boolean => {
    if (!locked) return false
    setWall(true)
    return true
  }, [locked])

  /**
   * THE LOCK. Every change to the document in this file goes through `edit`, so
   * wrapping it here is the whole of it — there is no second path to the
   * document and no control that can find one.
   *
   * A refused edit is not silent. It raises the sheet, which is what makes a
   * greyed board answer back rather than just fail to respond: a stranger who
   * grabs a player and finds them nailed down is being told something, and this
   * is where they are told it.
   */
  const edit = useCallback(
    (label: string, fn: (s: System) => System) => {
      if (refuse()) return
      rawEdit(label, fn)
    },
    [refuse, rawEdit],
  )

  /**
   * Spread onto a region that is greyed and inert while locked.
   *
   * CAPTURE, and on the CONTAINER. Doing it here rather than at each control is
   * not laziness — it is the only version that cannot rot. The setup panel alone
   * holds a dozen selects, colour wells and toggles, and a rule written into
   * each of them is a rule the next control added to the panel will not have.
   * A capturing handler on the region covers everything inside it, including
   * whatever gets added tomorrow.
   *
   * `preventDefault` on the pointer is what stops a locked <input> taking focus
   * and showing a caret, which would say "type here" to somebody who cannot.
   *
   * `data-locked` carries the greying, in ../../styles/global.css. It is left to
   * CSS rather than to a Tailwind class per site so that a region keeps its own
   * layout classes untouched and the treatment can be changed in one place.
   */
  const inert = locked
    ? {
        'data-locked': '',
        onPointerDownCapture: (e: React.PointerEvent) => {
          e.preventDefault()
          e.stopPropagation()
          refuse()
        },
        onClickCapture: (e: React.MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          refuse()
        },
        onKeyDownCapture: (e: React.KeyboardEvent) => {
          // Tab has to keep working. Somebody reading the page with a keyboard
          // is still allowed to move around it; they are only stopped from
          // changing it.
          if (e.key === 'Tab') return
          e.preventDefault()
          e.stopPropagation()
          refuse()
        },
      }
    : {}

  // ── what the coach has been taught ─────────────────────────────────────────
  const [guide, setGuide] = useState<GuideState>(() => readGuide())
  /*
   * How tall the phase strip's thumbnails are. A view preference in its own
   * corner of localStorage rather than in the guide, because it has to be
   * writable on a locked board — see `readStripSize` in ../storage.ts.
   */
  const [stripSize, setStripSize] = useState<StripSize>(readStripSize)
  const [walkthrough, setWalkthrough] = useState(false)
  const [upgradesWalkthrough, setUpgradesWalkthrough] = useState(false)
  /*
   * The help panel, which is what the ? button opens now.
   *
   * Separate from `walkthrough` rather than a mode of it. They answer opposite
   * questions: the walkthrough is for somebody with no idea what this is and
   * runs once, the panel is for somebody with a specific thing they cannot find
   * and is opened for years afterwards. Folding the second into the first would
   * mean paging through five screens about counters to be told where the crest
   * setting is. The panel offers the tour as one of its entries, which is the
   * right relationship between them.
   */
  const [help, setHelp] = useState(false)
  const [news, setNews] = useState(false)
  /**
   * Which what's-new entries carry a "not read yet" marker, decided once on
   * mount and never recomputed.
   *
   * It has to be frozen, because opening the panel moves the watermark forward
   * immediately — see `openNews`. Deriving the markers from the watermark would
   * clear every one of them in the same frame the list appeared.
   *
   * A coach who has not been through the walkthrough gets none. Everything on
   * the list shipped before they arrived, so none of it is news to them; they
   * are marked caught up when the walkthrough closes.
   */
  const [newsUnread] = useState<string[]>(() => {
    const g = readGuide()
    return g.seen ? unseenNews(g.newsSeen).map((e) => e.id) : []
  })
  const [sharing, setSharing] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackContext | null>(null)
  /*
   * A win that has happened but has not been acted on yet.
   *
   * The ask waits for the export dialog to CLOSE rather than firing the moment
   * a link is published, because otherwise two modals stack — the coach is
   * looking at the link they just made, and a form lands on top of it. A ref
   * rather than state: nothing renders differently for it, and it is written
   * from inside a callback the dialog owns.
   */
  const pendingWin = useRef<FeedbackContext | null>(null)
  const [makingVideo, setMakingVideo] = useState(false)
  const [exporting, setExporting] = useState(false)
  // Evaluated once, on mount: a desktop coach narrowing their window should not
  // have an interstitial thrown over their work. See ./SmallScreen.tsx.
  const [tooSmall, setTooSmall] = useState(false)

  // A ref alongside the state so `markGuide` can compare against the current
  // value without taking it as a dependency — it is called from pointer
  // handlers that must not be rebuilt on every flag change.
  const guideRef = useRef(guide)
  guideRef.current = guide

  /**
   * Is the studio in the middle of something?
   *
   * Read only by the delayed feedback ask, which decides forty seconds before
   * it fires and must check again on the way out — a coach who opened the video
   * dialog inside the wait is not somebody to put a form over. Assigned near the
   * foot of the component, where every one of these states exists.
   */
  const busyRef = useRef(false)

  const markGuide = useCallback(
    (patch: Partial<GuideState>) => {
    /*
     * A locked board teaches nobody anything, so it must not record having
     * taught them.
     *
     * The guide is a claim about what THIS coach has done in the studio, and it
     * is written to the browser rather than to an account. Left running here, a
     * stranger pressing Play on one of our systems would be marked as having
     * played one, and the walkthrough they have never seen would be marked as
     * shipped news they have already read — so the day they do sign up, the
     * studio would open on a board with its rail already ticked off and nothing
     * offering to show them round. The one visit that most needs the guide is
     * the one this would have spent it on.
     */
    if (locked) return
    const cur = guideRef.current
    const changed = (Object.keys(patch) as (keyof GuideState)[]).some((k) => cur[k] !== patch[k])
    if (!changed) return
    const next = writeGuide(patch)
    // The ref is normally refreshed on render, which is too late for anything
    // that latches a flag and then reads the guide back in the same tick — the
    // feedback ask does exactly that. Writing it here as well makes the ref
    // mean "what is stored", always.
      guideRef.current = next
      setGuide(next)
    },
    [locked],
  )

  /**
   * The watermark moves when the panel OPENS, not when it closes.
   *
   * Opening it is the coach having been told; what they do next is their
   * business. Waiting for a close would mean a dot that survives being read and
   * comes back on the next visit for anyone who dismisses the panel with
   * Escape, or by clicking the board, which is most people.
   */
  const openNews = useCallback(() => {
    setNews(true)
    markGuide({ newsSeen: NEWEST_NEWS_ID })
  }, [markGuide])

  /**
   * One gate, one thing on arrival.
   *
   * The three are mutually exclusive on purpose and the chain is the only place
   * that decides between them: a phone is told it is a phone, a coach who has
   * never been here is taught the studio, and everybody else is shown what
   * changed. Two of these opening together is the failure this shape exists to
   * prevent — the walkthrough and the what's-new panel would sit on top of each
   * other on the one load where a returning coach most needs the studio to look
   * like it knows what it is doing.
   */
  useEffect(() => {
    /*
     * None of the three, on a locked board.
     *
     * The walkthrough teaches controls that are switched off, the what's-new
     * panel lists changes to a tool the reader has never used, and the small
     * screen interstitial is the worst of the three by some distance: it exists
     * to stop a coach trying to POSE on a phone, which is genuinely no good,
     * and here there is nothing to pose. Somebody arriving from a link under one
     * of the videos is on a phone almost by definition, and the stacked layout
     * plays a system on one perfectly well. Throwing up a wall telling them to
     * come back on a laptop is a door closed on the exact person these two pages
     * were built for. The only thing that greets a stranger is ./SignInWall.tsx.
     */
    if (locked) return
    if (isSmallScreen() && !guideRef.current.smallOk) setTooSmall(true)
    else if (!guideRef.current.seen) setWalkthrough(true)
    else if (!guideRef.current.upgradesSeen) setUpgradesWalkthrough(true)
    else if (guideRef.current.newsSeen !== NEWEST_NEWS_ID) openNews()
  }, [openNews, locked])

  /**
   * And, occasionally, the question — on the way in rather than after a win.
   *
   * NOT PART OF THE CHAIN ABOVE, and not instant. The chain decides what a
   * coach is shown ON ARRIVAL, and this is deliberately not that: it waits
   * until they have been in the tool long enough to have a view of today, and
   * it checks on the way out of the wait that the studio is not busy. Somebody
   * who arrived, opened the video dialog and started a render must not have a
   * form put over it.
   *
   * The delay is also what keeps it out of the chain's way without needing to
   * know about it: a walkthrough or a what's-new panel opened on arrival is
   * long since read or dismissed by the time this fires, and if it is not, the
   * guard below sees it and this opening simply is not the one.
   *
   * `shouldAskOnOpen` rolls a die, so most eligible openings are still quiet.
   * See ../feedback.ts.
   */
  useEffect(() => {
    // And never of somebody who is not a coach of ours yet. The question is
    // "how is the studio treating you", which has no answer from a chair
    // nobody is sitting in.
    if (locked) return
    if (!shouldAskOnOpen(guideRef.current)) return
    const t = setTimeout(() => {
      // Re-read rather than trusting the decision made 40 seconds ago: a coach
      // can publish a link inside the wait, be asked at the moment that lands,
      // and this would then ask them a second time.
      if (!shouldAsk(guideRef.current)) return
      if (busyRef.current) return
      markGuide({ feedbackAskedAt: Date.now() })
      setFeedback('open')
    }, OPEN_ASK_DELAY_MS)
    return () => clearTimeout(t)
  }, [markGuide, locked])

  // Every clock in the editor reads these two values — playback below, the
  // length quoted in the video dialog, and the beat the ball is struck on.
  const hold = holdMs(system)
  const move = moveMs(system)

  const svgRef = useRef<SVGSVGElement | null>(null)

  /*
   * ── ZOOMING THE WORKSPACE ────────────────────────────────────────────────
   *
   * The zoom is a CSS transform on a wrapper around the board, so what is
   * magnified is the one picture the board already draws — pitch, counters and
   * marks together. Nothing downstream of a press has to know about it:
   * `clientToPercent` goes through the SVG's own screen CTM, which carries the
   * wrapper's transform, so a pointer lands on the same blade of grass at 600%
   * as it does at 100% (verified in Chromium and WebKit, 2026-08-28).
   *
   * THE ZOOM AND THE PAN ARE ONE VALUE. They were two pieces of state, and the
   * pan was computed inside the zoom's own updater — a state update raised
   * during another update, which React is free to run more than once. Holding
   * the pair in a ref and mirroring it into state means every gesture composes
   * off the value the last one wrote, in the frame it wrote it, rather than off
   * whatever a pending render happens to be carrying.
   */
  const boardContainerRef = useRef<HTMLDivElement | null>(null)
  const [workspaceZoom, setWorkspaceZoom] = useState(1)
  const [workspacePan, setWorkspacePan] = useState({ x: 0, y: 0 })
  const workspaceRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } })

  /**
   * Zoom to `z`, holding the board still under (cx, cy) — a point measured from
   * the top-left of the board's frame.
   *
   * Pinning the point under the cursor is what makes a pinch feel like the
   * grass is being pulled up towards the fingers, rather than the picture being
   * swapped for a bigger one and re-centred.
   */
  const zoomAbout = useCallback((z: number, cx: number, cy: number) => {
    const el = boardContainerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const cur = workspaceRef.current
    const next = Math.min(10, Math.max(1, z))
    // Where the board sits under that point now, in unmagnified board pixels.
    const localX = (cx - cur.pan.x) / cur.zoom
    const localY = (cy - cur.pan.y) / cur.zoom
    const pan = clampPan(cx - localX * next, cy - localY * next, next, width, height)
    workspaceRef.current = { zoom: next, pan }
    setWorkspaceZoom(next)
    setWorkspacePan(pan)
  }, [])

  /** Zoom by a factor about the middle of the frame. What the buttons do. */
  const zoomBy = useCallback(
    (factor: number) => {
      const el = boardContainerRef.current
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      zoomAbout(workspaceRef.current.zoom * factor, width / 2, height / 2)
    },
    [zoomAbout],
  )

  const resetZoom = useCallback(() => {
    workspaceRef.current = { zoom: 1, pan: { x: 0, y: 0 } }
    setWorkspaceZoom(1)
    setWorkspacePan({ x: 0, y: 0 })
  }, [])

  const panBy = useCallback((dx: number, dy: number) => {
    const el = boardContainerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const cur = workspaceRef.current
    const pan = clampPan(cur.pan.x + dx, cur.pan.y + dy, cur.zoom, width, height)
    workspaceRef.current = { zoom: cur.zoom, pan }
    setWorkspacePan(pan)
  }, [])

  const isPanningRef = useRef(false)
  const lastPanPointRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const el = boardContainerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      // A trackpad pinch and ctrl+scroll arrive as the same event.
      if (e.ctrlKey) {
        e.preventDefault()
        const rect = el.getBoundingClientRect()
        zoomAbout(
          workspaceRef.current.zoom * Math.exp(-e.deltaY * 0.01),
          e.clientX - rect.left,
          e.clientY - rect.top,
        )
        return
      }
      // An unzoomed board has nowhere to go, and swallowing the scroll there
      // would pin the page whenever the pointer happened to rest over it.
      if (workspaceRef.current.zoom === 1) return
      e.preventDefault()
      panBy(-e.deltaX, -e.deltaY)
    }

    const handlePointerDown = (e: PointerEvent) => {
      // Middle click, or alt+left: the two gestures that mean "move the paper"
      // in every drawing tool, and neither of them is a gesture the board has
      // any other use for.
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault()
        isPanningRef.current = true
        lastPanPointRef.current = { x: e.clientX, y: e.clientY }
        el.setPointerCapture(e.pointerId)
        el.style.cursor = 'grabbing'
      }
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPanningRef.current) return
      e.preventDefault()
      panBy(e.clientX - lastPanPointRef.current.x, e.clientY - lastPanPointRef.current.y)
      lastPanPointRef.current = { x: e.clientX, y: e.clientY }
    }

    const handlePointerUp = (e: PointerEvent) => {
      if (!isPanningRef.current) return
      isPanningRef.current = false
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* the capture was never taken; the gesture is over either way */
      }
      el.style.cursor = ''
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('pointerdown', handlePointerDown)
    el.addEventListener('pointermove', handlePointerMove)
    el.addEventListener('pointerup', handlePointerUp)
    el.addEventListener('pointercancel', handlePointerUp)

    return () => {
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('pointerdown', handlePointerDown)
      el.removeEventListener('pointermove', handlePointerMove)
      el.removeEventListener('pointerup', handlePointerUp)
      el.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [zoomAbout, panBy])

  /*
   * The frame currently on screen, for the drag handler to start from.
   *
   * A ref because `beginFrameDrag` is built long before `rendered` exists, and
   * because taking the shot as a dependency would rebuild the handler on every
   * frame of the very drag it is running.
   */
  const shotRef = useRef<Shot | null>(null)
  const view = PITCH_VIEWS[resolveViewId(system.pitch)]
  /*
   * How close this system's camera is allowed to get, as a fraction of the crop.
   *
   * Read once here and passed to every camera call in this file, so the outline
   * the coach drags, the metres the panel reads out and the frame the film is
   * shot through are all bounded by the same number. Splitting them is how a
   * preview starts promising a shot the video does not keep.
   */
  const tightest = resolvePush(system.push).tightest
  const act = system.acts[Math.min(actIndex, system.acts.length - 1)]

  /*
   * ── THE COACH'S OWN KIT AND CREST, ON A BOARD THAT ALREADY EXISTS ─────────
   *
   * `withProfile` has always painted a coach's colours onto a NEW board, and
   * that was the whole of it — so a coach who set their kit in Settings after
   * starting a system, or who changed it, saw nothing change in the studio and
   * reasonably concluded the setting did not work (user, 2026-08-27).
   *
   * It is not a bug in `withProfile`; it is that nothing ever offered to apply
   * it again. A document is the coach's and must not be repainted behind their
   * back — a system deliberately coloured for an opponent's kit would be
   * destroyed by that — so this is a BUTTON, on a panel, next to a preview of
   * what it will do. Explicit, undoable, and reaching the whole kit rather than
   * the base colour the ColorWell can already reach.
   *
   * READ THROUGH THE SHARED STORE (../account/profile.ts) rather than fetched
   * here. It used to be its own `loadProfile()` on mount, which was a second
   * request for a row ../account/../editor/StudioMount.tsx had already asked
   * for, and — worse — it was ungated: it fired whether or not there was a
   * session yet, and an anonymous read of studio_profiles returns other
   * people's public rows.
   *
   * Now it subscribes, so a coach who changes their kit on the settings page
   * and comes back to a studio tab that was already open sees the new one. It
   * used to be loaded once and never refetched, and that was the whole of why
   * the panel could be out of date.
   *
   * `null` — signed out, offline, no profile yet — still simply means the panel
   * does not appear.
   */
  const { user } = useSession()
  const profile = useProfileOrNull(user?.id)

  /**
   * ── WHETHER THIS COACH'S NAME LEAVES WITH THEIR WORK ─────────────────────
   *
   * `null` means "nobody has said", which is not the same as "no" and must not
   * render as one. The account holds the default (`profile.showIdentity`,
   * supabase/017) and this holds the exception, so a coach who wants their name
   * off ONE board can say so here without changing what the next board does,
   * and a coach who wants it off everywhere says so once in settings and is
   * never asked again.
   *
   * It lives up here rather than inside the export dialog because it reaches
   * further than that dialog does: the PDF goes through `PrintSheet`, which is
   * mounted in this tree at all times, and a switch that changed the pictures
   * but not the printout would be worse than no switch.
   *
   * Not persisted, deliberately. An exception that outlived the session would
   * be a default nobody set and nobody could find.
   */
  const [identityChoice, setIdentityChoice] = useState<boolean | null>(null)
  const identityDefault = profile?.showIdentity ?? true
  const identity = identityChoice ?? identityDefault

  /**
   * The board as it will leave. Only ever a copy; the document is untouched.
   *
   * Memoised because `PrintSheet` renders every phase's board and is in the
   * tree on every keystroke — a fresh object per render would redraw the whole
   * printout each time a caption gained a letter.
   */
  const outbound = useMemo(
    () => (identity ? system : withoutIdentity(system)),
    [identity, system],
  )

  /**
   * Sign the board from the profile, once, if it is not signed already.
   *
   * ── THE BUG ──────────────────────────────────────────────────────────────
   *
   * Share asked for a name that had already been given on the settings page
   * (user, 2026-08-27). `withProfile` fills the credit, but only where it is
   * called: when a BOARD IS CREATED (./StudioMount.tsx). Every board made
   * before the coach filled their profile in — and every one made before the
   * profile existed at all — carries an empty credit for ever, so the share
   * dialog opens on three blank fields and asks a question the studio already
   * knows the answer to.
   *
   * ── WHY IT IS `replace` AND NOT `edit` ───────────────────────────────────
   *
   * This is not something the coach did, so it has no business sitting in their
   * undo stack between two things they did do — the same call `rememberShareId`
   * makes for the id the server hands back. It does still reach the autosave and
   * the cloud, which is the point: the signature has to be ON the document by
   * the time anything is published from it.
   *
   * ── AND WHY IT ONLY EVER FILLS A GAP ─────────────────────────────────────
   *
   * A credit that says something is a credit the coach may have typed by hand —
   * a board presented by an assistant, or under a club's name rather than their
   * own — and quietly overwriting that with the profile would be the settings
   * page reaching in and correcting them. Empty means unasked; anything else is
   * an answer.
   */
  useEffect(() => {
    if (!profile || locked) return
    const presenter = profile.presenter.trim()
    const team = profile.team.trim()
    if (!presenter && !team) return
    replace((sys) => {
      const c = sys.credit ?? {}
      const wants: Partial<Credit> = {}
      if (!c.presenter?.trim() && presenter) wants.presenter = presenter
      if (!c.team?.trim() && team) wants.team = team
      return Object.keys(wants).length ? { ...sys, credit: { ...c, ...wants } } : sys
    })
  }, [profile, locked, replace])

  /*
   * Whether this system would go out with nobody's name on it.
   *
   * Off the DOCUMENT, not off the profile, and that distinction is the whole
   * value of the line it drives (./IdentityToggle.tsx): a board signed by hand
   * for one assistant is signed, and telling that coach their film is anonymous
   * because their account page is empty would be false. The effect above signs
   * the board from the profile where there is one, so in the ordinary case this
   * is the profile's answer arriving by the honest route.
   */
  const unsigned = !(system.credit?.presenter?.trim() || system.credit?.team?.trim())

  const myCrest = profile?.crestPath ? imageUrl(profile.crestPath) : ''
  const myKit = profile?.teamColour.trim() ?? ''
  const stacked = useMediaQuery('(max-width: 1023px)')

  // Whether there is an opposition is asked of a PHASE, not of the document —
  // `teams.them` only carries their kit. Both of these read straight off the
  // acts so the panel can never claim something the board is not showing.
  const themHere = Boolean(act?.tokens.some((t) => t.side === 'them'))
  const themOnPhases = useMemo(
    () => system.acts.flatMap((a, i) => (a.tokens.some((t) => t.side === 'them') ? [i] : [])),
    [system.acts],
  )

  // Autosave. Debounced so a drag writes once when it settles rather than on
  // every pointermove, which would serialise the whole document 60 times a
  // second for no benefit.
  useEffect(() => {
    /*
     * A locked board is never written down, anywhere.
     *
     * The document cannot change, so there is nothing here worth keeping — but
     * that is not the reason. The reason is `lastOpened()`: saving would put OUR
     * system id at the head of this browser's shelf, and ./StudioMount.tsx opens
     * whatever is there. So the coach who signs up an hour later, having been
     * sold on the studio by this exact page, would open it onto a locked copy of
     * our system instead of a board of their own.
     */
    if (locked) return
    const t = setTimeout(() => saveSystem(systemId, system), 400)
    return () => clearTimeout(t)
  }, [systemId, system, locked])

  // And behind that, the account — if there is one. Local is authoritative and
  // this never blocks it; see ../account/sync.ts. Off entirely when locked, for
  // the signed-in coach who opens one of ours: see `enabled` over there.
  const cloud = useCloudSync(systemId, system, !locked)

  /**
   * The coach's squad, and signed URLs for whichever faces are on this board.
   *
   * Both are empty for a signed-out visitor and for a coach who has never added
   * a player, and both cost nothing in that case — `useSquadPhotos` does not
   * even make a request when no token on the board carries a photo. See
   * ./SquadPick.tsx.
   */
  const squad = useSquad()
  const photoHrefs = useSquadPhotos(system)

  // Deleting the last phase, or undoing back past one, can leave the index
  // pointing at nothing. Render already clamps; this keeps the state honest so
  // the strip highlights the phase actually on screen.
  useEffect(() => {
    if (actIndex > system.acts.length - 1) setActIndex(Math.max(0, system.acts.length - 1))
  }, [actIndex, system.acts.length])

  /**
   * Latch the guide steps that are readable off the document.
   *
   * Doing it here rather than at each call site means a coach who returns to a
   * system they built last week is not told to add a second phase — the rail
   * catches up with the document the moment it opens.
   */
  useEffect(() => {
    const patch: Partial<GuideState> = {}
    if (system.title.trim()) patch.named = true
    if (system.acts.length >= 2) patch.phased = true
    if (system.acts.some((a) => a.arrows.length > 0)) patch.drew = true
    if (Object.keys(patch).length) markGuide(patch)
  }, [system, markGuide])

  /** Every mutation goes through here, so autosave and undo have one seam. */
  const patchAct = useCallback(
    (label: string, fn: (a: Act) => Act) => {
      edit(label, (s) => ({
        ...s,
        acts: s.acts.map((a, i) => (i === Math.min(actIndexRef.current, s.acts.length - 1) ? fn(a) : a)),
      }))
    },
    [edit],
  )

  // ── selection ──────────────────────────────────────────────────────────────
  const selectedToken = selection?.kind === 'token' ? (act?.tokens.find((t) => t.id === selection.id) ?? null) : null
  const selectedMarkId = selection?.kind === 'mark' ? selection.id : null
  const selectedArrow = selectedMarkId ? (act?.arrows.find((a) => a.id === selectedMarkId) ?? null) : null
  const selectedBand = selectedMarkId ? (act?.bands.find((b) => b.id === selectedMarkId) ?? null) : null
  const selectedText = selectedMarkId
    ? ((act?.texts ?? []).find((t) => t.id === selectedMarkId) ?? null)
    : null
  const selectedGear = selectedMarkId
    ? ((act?.gear ?? []).find((g) => g.id === selectedMarkId) ?? null)
    : null

  /** Take the selected thing off this phase. Returns whether there was one. */
  /*
   * ── THE BALLS ON THIS PHASE ───────────────────────────────────────────────
   *
   * A phase used to have a ball or not, and one button toggled it. It can now
   * have as many as the drill needs (see `BallMark` in ../schema.ts), so the
   * toggle became an add and a remove.
   */
  const ballsHere = act ? ballsOf(act) : []
  const selectedBallId =
    selectedMarkId && ballsHere.some((b) => b.id === selectedMarkId) ? selectedMarkId : null

  /**
   * Somewhere to put the next one.
   *
   * The centre spot, unless there is already a ball sitting on it — dropping a
   * second ball exactly on top of the first looks like the button did nothing,
   * and the coach has to drag the top one off to find out it worked. Steps down
   * the diagonal until the spot is clear, and gives up in the middle of the
   * board rather than walking off the pitch.
   */
  const nextBallSpot = (balls: { x: number; y: number }[]) => {
    const taken = (x: number, y: number) => balls.some((b) => Math.hypot(b.x - x, b.y - y) < 3.5)
    let { x, y } = CENTRE_SPOT
    for (let i = 0; i < 24 && taken(x, y); i++) {
      x = 8 + ((x - 8 + 5) % 84)
      y = 8 + ((y - 8 + 4) % 84)
    }
    return { x, y }
  }

  const addBall = () => {
    patchAct('ball-add', (a) => {
      const balls = ballsOf(a)
      return { ...a, ...ballFields([...balls, newBall(nextBallSpot(balls))]) }
    })
    seal()
  }

  /** The selected one if a ball is selected, otherwise the last one added. */
  const removeBall = () => {
    patchAct('ball-remove', (a) => {
      const balls = ballsOf(a)
      if (balls.length === 0) return a
      const id = selectedBallId ?? balls[balls.length - 1].id
      return { ...a, ...ballFields(balls.filter((b) => b.id !== id)) }
    })
    if (selectedBallId) setSelection(null)
    seal()
  }

  const deleteSelection = useCallback((): boolean => {
    if (!selection) return false
    const { kind, id } = selection
    patchAct('delete', (a) =>
      kind === 'token'
        ? { ...a, tokens: a.tokens.filter((t) => t.id !== id) }
        : {
            ...a,
            ...ballFields(ballsOf(a).filter((b) => b.id !== id)),
            arrows: a.arrows.filter((x) => x.id !== id),
            bands: a.bands.filter((b) => b.id !== id),
            texts: (a.texts ?? []).filter((x) => x.id !== id),
            gear: (a.gear ?? []).filter((g) => g.id !== id),
          },
    )
    seal()
    setSelection(null)
    return true
  }, [selection, patchAct, seal])

  // ── undo ───────────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    const meta = history.undo()
    if (!meta) return
    setActIndex(meta.actIndex)
    setSelection(null)
    setPlayhead(null)
  }, [history])

  const redo = useCallback(() => {
    const meta = history.redo()
    if (!meta) return
    setActIndex(meta.actIndex)
    setSelection(null)
    setPlayhead(null)
  }, [history])

  // ── phases ─────────────────────────────────────────────────────────────────
  /**
   * Move the view to another phase. NOT an edit — nothing about the document
   * changes, which is exactly the distinction the footer's two pairs of arrows
   * were failing to make. Navigation steps between moments; reordering changes
   * the order they happen in.
   */
  const goToPhase = useCallback(
    (i: number) => {
      setActIndex((cur) => {
        const next = Math.min(Math.max(0, i), system.acts.length - 1)
        if (next !== cur) {
          setSelection(null)
          setPlayhead(null)
        }
        return next
      })
    },
    [system.acts.length],
  )

  // ── keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      const mod = e.metaKey || e.ctrlKey

      // Typing wins, including the shortcuts. Cmd+Z in the title field has to
      // take back the last letter, not the last thing that happened on the
      // board — a coach fixing a typo does not expect their shape to revert.
      if (typing) return

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (mod) return

      if (e.key === 'Escape') {
        setTool('select')
        setPending(null)
        setSelection(null)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (deleteSelection()) e.preventDefault()
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPhase(actIndexRef.current - 1)
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToPhase(actIndexRef.current + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, deleteSelection, goToPhase])

  // ── gestures on the board ──────────────────────────────────────────────────
  /*
   * A gesture binds its own listeners, in the handler, at the moment the
   * pointer goes down. It used to be bound from an effect keyed on the
   * gesture's state, and that lost fast gestures outright: `setDragging`
   * schedules a render, the effect only runs once React has committed it, and
   * every pointermove delivered in between is dropped. A flick — press, a few
   * moves and a release, all arriving in one task, which is exactly how a
   * quick drag lands — moved the counter ZERO pixels. Measured in a browser,
   * not reasoned about.
   *
   * `setPointerCapture` on the <svg> is the other half. Without it a release
   * outside the window is never delivered: the drag stays live, and the next
   * click anywhere in the studio is spent dropping a counter that has been
   * following the cursor ever since.
   *
   * The capture goes on the <svg> rather than on the counter because the <svg>
   * is the node that is certain to still be there when the pointer comes up —
   * a counter can be re-keyed by a phase change mid-gesture.
   *
   * `end` is kept in a ref so unmounting mid-drag cannot leak the listeners.
   */
  const endGesture = useRef<(() => void) | null>(null)
  useEffect(() => () => endGesture.current?.(), [])

  const bindGesture = useCallback(
    (
      pointerId: number,
      onMove: (e: PointerEvent) => void,
      onEnd: () => void,
    ) => {
      const svg = svgRef.current
      // Safari on an old iPad throws rather than no-ops. Capture is an
      // improvement to the gesture, not a requirement of it.
      try {
        svg?.setPointerCapture(pointerId)
      } catch {
        /* no capture; the window listeners still carry the gesture */
      }
      const move = (e: PointerEvent) => {
        if (e.pointerId === pointerId) onMove(e)
      }
      const finish = () => {
        endGesture.current = null
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        try {
          svg?.releasePointerCapture(pointerId)
        } catch {
          /* already released with the capture that was never taken */
        }
        onEnd()
      }
      const up = (e: PointerEvent) => {
        if (e.pointerId === pointerId) finish()
      }
      endGesture.current = finish
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    },
    [],
  )

  /**
   * Dragging a counter or the ball.
   *
   * WHERE IT WAS GRABBED IS KEPT, which is the whole of what this does beyond
   * the obvious. It used to put the counter's CENTRE under the cursor on the
   * way down, so grabbing a player anywhere but dead centre teleported them by
   * the width of the grab before the drag had begun. On a board at 100% that is
   * a counter 38px across and a jump of about 14px — irritating, easy to miss.
   * Zoomed in it is the same jump in METRES OF GRASS, and metres of grass are
   * screen pixels multiplied by the zoom: at 550% the counter lurches 74px out
   * from under the finger that touched it (measured, user, 2026-08-28).
   *
   * Holding the offset instead means the counter goes exactly where the cursor
   * goes, at every zoom, which is what dragging has always meant. The gear and
   * text drags below already worked this way; this brings the counters and the
   * ball into line with them rather than inventing a third way.
   */
  const beginDrag = useCallback(
    (drag: { kind: 'token' | 'ball'; id: string }, e: React.PointerEvent) => {
      const svg = svgRef.current
      const source = act
      if (!svg || !source) return
      e.stopPropagation()
      // Without this the browser starts a text selection on the way down, and
      // then paints it across the pitch for the rest of the drag.
      e.preventDefault()

      // Where the thing is NOW. Read once, on the way down: reading it per move
      // would compound the offset against a position this gesture is writing.
      const base =
        drag.kind === 'ball'
          ? ballsOf(source).find((b) => b.id === drag.id)
          : source.tokens.find((t) => t.id === drag.id)
      if (!base) return

      const down = clientToPercent(svg, view, e.clientX, e.clientY)
      const grab = clampToBoard(down.x, down.y)

      setDragging(drag)

      bindGesture(
        e.pointerId,
        (ev) => {
          const raw = clientToPercent(svg, view, ev.clientX, ev.clientY)
          const q = clampToBoard(raw.x, raw.y)
          const p = clampToBoard(base.x + (q.x - grab.x), base.y + (q.y - grab.y))
          // One label for the whole gesture: ../history.ts collapses it into a
          // single undo entry, and `seal()` on release closes it so the next
          // drag of the same counter is its own.
          patchAct(`drag:${drag.id}`, (a) =>
            drag.kind === 'ball'
              ? { ...a, ...ballFields(ballsOf(a).map((b) => (b.id === drag.id ? { ...b, ...p } : b))) }
              : { ...a, tokens: a.tokens.map((t) => (t.id === drag.id ? { ...t, ...p } : t)) },
          )
        },
        () => {
          if (drag.kind === 'token') markGuide({ moved: true })
          seal()
          setDragging(null)
        },
      )
    },
    [act, bindGesture, view, patchAct, markGuide, seal],
  )

  /**
   * Carry out an armed arrow tool: draw the mark, and pose the phase after it.
   *
   * ONE `edit`, NOT TWO. The arrow lands on this phase and the pose lands on the
   * next one, and a coach who presses undo means "put that back" about both
   * halves — an action that took two entries to reverse would be a worse tool
   * than drawing it by hand.
   *
   * The next phase is created only if it is not already there, and the caller
   * stays where it is. That is what lets a pass, the overlapping run it releases
   * and the press it beats all land on the SAME transition instead of becoming
   * three phases of a film that is now three times as long. See ../actions.ts.
   */
  const performAction = useCallback(
    (kind: ActionKind, actorId: string, target: Target) => {
      edit(`action:${kind}`, (s) => {
        const i = Math.min(actIndex, s.acts.length - 1)
        const cur = s.acts[i]
        const hasNext = i + 1 < s.acts.length
        const next: Act = hasNext
          ? s.acts[i + 1]
          : {
              ...structuredClone(cur),
              id: uid('act'),
              // The title comes across in the clone and is deliberately not
              // overwritten here. See `addAct`.
              /*
               * A copied-forward phase does NOT inherit this one's ARROWS. They
               * describe the move INTO it, so carrying them across would leave
               * the board annotated with something that has already happened.
               *
               * LINES ARE THE EXCEPTION, and they are the exception because
               * they are not events. A line has no head and fires no action: it
               * is furniture — a corridor edge, the seam between two sectors,
               * the near post to the far post. A coach who rules a sector grid
               * out of lines and then taps two players to draw a pass was
               * losing the whole grid on the phase the pass created, while "Add
               * phase" (which clones everything) kept it. The rule is not
               * "clear the arrows list", it is "clear what described the move",
               * and a line never did.
               */
              arrows: structuredClone(cur.arrows.filter((a) => a.kind === LINE_TOOL_ID)),
            }

        const done = perform(kind, cur, next, actorId, target)
        if (!done) return s

        const acts = [...s.acts]
        acts[i] = { ...cur, arrows: [...cur.arrows, done.arrow] }
        if (hasNext) acts[i + 1] = done.next
        else acts.splice(i + 1, 0, done.next)
        return { ...s, acts }
      })
      seal()
    },
    [actIndex, edit, seal],
  )

  /**
   * Adjusting an arrow after it has been drawn.
   *
   * WHY THIS EXISTS AT ALL
   *
   * An arrow used to be final the instant the drag ended: the only edits were a
   * bend slider and a caption in the side panel, so an end that landed two
   * metres short meant deleting it and drawing it again. Every other mark on
   * the board — the zones, the camera frame — has been draggable by its own
   * handles for as long as it has existed. This is the one that was missing.
   *
   * FOUR PARTS, AND `move` IS THE INTERESTING ONE
   *
   * Dragging the body moves the ends that are ON GRASS and leaves the ends that
   * belong to a player exactly where they are. That looks like an inconsistency
   * and is the opposite: each end obeys whoever owns it, so shifting a run's
   * finishing point away from a defender does not silently tear its start off
   * the player who is making it. Nothing is unbound behind the coach's back —
   * to free an end, you drag that end.
   *
   * THE BEND IS SOLVED IN UNITS, NOT IN PERCENT
   *
   * `bend` is applied to the points the board actually draws, which are units,
   * and units are metre space. Percent is percent of the crop along each axis
   * and the crop is not square, so a perpendicular measured in percent points
   * somewhere the arrow does not bow. Same reason the rim inset is done there.
   * `bendFor` is the exact inverse of the offset `arrowGeometry` applies, over
   * the same rim-inset endpoints the handle is drawn from, so the handle stays
   * under the pointer rather than near it.
   */
  /**
   * Dragging a piece of writing.
   *
   * The simplest gesture in the file, and it is short for a reason worth
   * stating: a text mark has ONE point. There are no ends that might belong to
   * a player, no bend to invert, no corners whose opposite has to be held. The
   * whole of it is "the pointer moved this far, so the words moved this far",
   * done in percent because percent is where the mark lives and there is no
   * geometry here that percent's non-square axes could distort.
   *
   * The offset is taken from the pointer's own position at press rather than
   * from the mark's, so grabbing a caption by its corner does not snap its
   * middle under the cursor.
   */
  const beginTextDrag = useCallback(
    (id: string, e: React.PointerEvent<SVGElement>) => {
      const svg = svgRef.current
      const source = act
      if (!svg || !source) return
      e.stopPropagation()
      e.preventDefault()

      const base = (source.texts ?? []).find((x) => x.id === id)
      if (!base) return

      const down = clientToPercent(svg, view, e.clientX, e.clientY)
      const grab = clampToBoard(down.x, down.y)

      bindGesture(
        e.pointerId,
        (ev) => {
          const raw = clientToPercent(svg, view, ev.clientX, ev.clientY)
          const p = clampToBoard(raw.x, raw.y)
          const at = clampToBoard(base.x + (p.x - grab.x), base.y + (p.y - grab.y))
          patchAct(`text:${id}:move`, (a) => ({
            ...a,
            texts: (a.texts ?? []).map((x) => (x.id === id ? { ...x, ...at } : x)),
          }))
        },
        () => seal(),
      )

    },
    [act, bindGesture, view, patchAct, seal],
  )

  const beginTextScale = useCallback(
    (id: string, e: React.PointerEvent<SVGElement>) => {
      const svg = svgRef.current
      const source = act
      if (!svg || !source) return
      e.stopPropagation()
      e.preventDefault()

      const base = (source.texts ?? []).find((x) => x.id === id)
      if (!base) return

      const down = clientToPercent(svg, view, e.clientX, e.clientY)
      const d0 = Math.hypot(down.x - base.x, down.y - base.y) || 1
      const initialScale = base.scale ?? 1

      bindGesture(
        e.pointerId,
        (ev) => {
          const raw = clientToPercent(svg, view, ev.clientX, ev.clientY)
          const p = clampToBoard(raw.x, raw.y)
          const d1 = Math.hypot(p.x - base.x, p.y - base.y)
          const newScale = Math.max(0.1, Math.min(5, initialScale * (d1 / d0)))
          patchAct(`text:${id}:scale`, (a) => ({
            ...a,
            texts: (a.texts ?? []).map((x) => (x.id === id ? { ...x, scale: newScale } : x)),
          }))
        },
        () => seal(),
      )
    },
    [act, bindGesture, view, patchAct, seal],
  )

  /**
   * Dragging a piece of training gear.
   *
   * The text drag, to the line, and deliberately so: a piece of gear is also
   * one point, and its size and its angle are set in the panel rather than by
   * pulling at handles on the board. That is not a shortcut — a marker cone is
   * 1.8m across on a board 68m wide, which is a target too small to hang four
   * corner grips off without burying the piece under its own furniture. The
   * panel has room for a slider; the grass does not.
   */
  const beginGearDrag = useCallback(
    (id: string, e: React.PointerEvent<SVGElement>) => {
      const svg = svgRef.current
      const source = act
      if (!svg || !source) return
      e.stopPropagation()
      e.preventDefault()

      const base = (source.gear ?? []).find((g) => g.id === id)
      if (!base) return

      const down = clientToPercent(svg, view, e.clientX, e.clientY)
      const grab = clampToBoard(down.x, down.y)

      bindGesture(
        e.pointerId,
        (ev) => {
          const raw = clientToPercent(svg, view, ev.clientX, ev.clientY)
          const q = clampToBoard(raw.x, raw.y)
          const at = clampToBoard(base.x + (q.x - grab.x), base.y + (q.y - grab.y))
          patchAct(`gear:${id}:move`, (a) => ({
            ...a,
            gear: (a.gear ?? []).map((g) => (g.id === id ? { ...g, ...at } : g)),
          }))
        },
        () => seal(),
      )
    },
    [act, bindGesture, view, patchAct, seal],
  )

  const beginArrowDrag = useCallback(
    (id: string, part: ArrowPart, e: React.PointerEvent<SVGElement>) => {
      const svg = svgRef.current
      const source = act
      if (!svg || !source) return
      e.stopPropagation()
      e.preventDefault()

      const base = source.arrows.find((x) => x.id === id)
      if (!base) return

      // The gesture reads the arrow as it was when the pointer went down, so a
      // `move` translates from a fixed origin instead of accumulating its own
      // rounding a frame at a time.
      const down = clientToPercent(svg, view, e.clientX, e.clientY)
      const grab = clampToBoard(down.x, down.y)

      bindGesture(
        e.pointerId,
        (ev) => {
          const raw = clientToPercent(svg, view, ev.clientX, ev.clientY)
          const p = clampToBoard(raw.x, raw.y)

          if (part === 'bend') {
            const ends = arrowEnds(base, source.tokens)
            const { a: ua, b: ub } = arrowRim(
              toUnits(view, ends.from.x, ends.from.y),
              toUnits(view, ends.to.x, ends.to.y),
              ends.fromBound,
              ends.toBound,
            )
            const bend = bendFor(ua, ub, toUnits(view, p.x, p.y))
            patchAct(`arrow:${id}:bend`, (a) => ({
              ...a,
              arrows: a.arrows.map((x) => (x.id === id ? { ...x, bend } : x)),
            }))
            return
          }

          if (part === 'move') {
            const dx = p.x - grab.x
            const dy = p.y - grab.y
            patchAct(`arrow:${id}:move`, (a) => ({
              ...a,
              arrows: a.arrows.map((x) =>
                x.id === id
                  ? {
                      ...x,
                      // A bound end is held by its player. Only the ends on
                      // grass travel with the body.
                      from: x.fromId ? x.from : clampToBoard(base.from.x + dx, base.from.y + dy),
                      to: x.toId ? x.to : clampToBoard(base.to.x + dx, base.to.y + dy),
                    }
                  : x,
              ),
            }))
            return
          }

          // An end. `exclude` is the OTHER end's player, so a drag cannot land
          // both ends of one arrow on the same man.
          const other = part === 'from' ? base.toId : base.fromId
          const target = snapTarget(view, p, source.tokens, other)
          setSnapId(target)
          patchAct(`arrow:${id}:${part}`, (a) => ({
            ...a,
            arrows: a.arrows.map((x) => (x.id === id ? bindEnd(x, part, p, target) : x)),
          }))
        },
        () => {
          setSnapId(null)
          seal()
        },
      )
    },
    [act, bindGesture, view, patchAct, seal],
  )

  /**
   * Adjusting the camera's frame.
   *
   * The maths is done in BOARD UNITS rather than in percent, and that is the
   * only interesting thing about it. Percent-of-crop is measured along the
   * pitch, and the upright views stand the pitch on its end — so the corner a
   * coach grabbed at the top left of their screen is not the top-left corner in
   * percent, and a resize written in percent moves a box the coach did not
   * touch. Units are what is actually on screen. The two conversions are exact
   * inverses (`toUnits` / `unitsToPercent` in ../board/pitch.ts), so the round
   * trip costs nothing and the geometry stays in the space the pointer is in.
   *
   * The starting box comes from `cameraRect`, not from `act.shot`: what is
   * drawn has already been fitted to the crop's aspect and clamped to the
   * grass, and grabbing the corner of one rectangle only to watch a DIFFERENT
   * one start moving is what makes a tool feel broken.
   *
   * A derived frame is grabbable, and grabbing it is what turns it into the
   * coach's own — there is no mode to enter first. The Camera panel's "Back to
   * automatic" is how they hand it back.
   */
  const beginFrameDrag = useCallback(
    (part: FramePart, e: React.PointerEvent<SVGElement>) => {
      const svg = svgRef.current
      if (!svg) return
      e.stopPropagation()
      e.preventDefault()

      const start = cameraRect(view, shotRef.current, tightest)
      const crop = cropRect(view)
      const down = clientToPercent(svg, view, e.clientX, e.clientY)
      const downU = toUnits(view, down.x, down.y)
      const mid = { x: start.x + start.w / 2, y: start.y + start.h / 2 }
      /*
       * How far the pressed corner started from the middle. Never zero, because
       * it goes underneath a division — a press exactly on the centre of the
       * frame cannot happen through a corner grip, but a bad number here would
       * be an Infinity written into the document rather than a wrong drag.
       */
      const reach = {
        x: Math.max(start.w * 0.02, Math.abs(downU.x - mid.x)),
        y: Math.max(start.h * 0.02, Math.abs(downU.y - mid.y)),
      }

      bindGesture(
        e.pointerId,
        (ev) => {
          const p = clientToPercent(svg, view, ev.clientX, ev.clientY)
          const pu = toUnits(view, p.x, p.y)

          let box: { x: number; y: number; w: number; h: number }
          if (part === 'move') {
            box = { ...start, x: start.x + (pu.x - downU.x), y: start.y + (pu.y - downU.y) }
          } else {
            /*
             * ── A CORNER ZOOMS ABOUT THE MIDDLE. IT DOES NOT ANCHOR. ────────
             *
             * This used to pin the opposite corner, the way a photo editor
             * resizes a rectangle, and it was the wrong gesture for a CAMERA.
             * Pinning one corner moves the centre by half of every size change,
             * so a coach pulling a corner outward to "see a bit more" watched
             * the shot slide off what they had framed — and then `cameraRect`
             * clamped it to the grass and slid it again. That is the whole of
             * "it moves when I just want to expand" (user, 2026-08-27).
             *
             * Scaling about the middle makes the two gestures mean exactly one
             * thing each: an edge MOVES the shot, a corner CHANGES HOW MUCH IS
             * IN IT, and neither one does any of the other. It is also what the
             * word zoom already means to everybody.
             *
             * The scale is the larger of the two axes' ratios rather than the
             * diagonal distance, so dragging out sideways widens the frame even
             * when the pointer has not travelled downward at all — a coach
             * pulling a corner straight out along one axis is asking for more,
             * and a diagonal-only reading would give them almost none of it.
             */
            const k = Math.max(
              Math.abs(pu.x - mid.x) / reach.x,
              Math.abs(pu.y - mid.y) / reach.y,
            )
            // Never degenerate. `cameraRect` enforces the real floor on the way
            // out; this only stops a box of no width being stored on the way in.
            const min = crop.w * 0.08
            const w = Math.max(min, start.w * k)
            const h = Math.max(min, start.h * k)
            box = { x: mid.x - w / 2, y: mid.y - h / 2, w, h }
          }

          const a = unitsToPercent(view, box.x, box.y)
          const b = unitsToPercent(view, box.x + box.w, box.y + box.h)
          patchAct('frame', (act2) => ({
            ...act2,
            shot: {
              x: (a.x + b.x) / 2,
              y: (a.y + b.y) / 2,
              w: Math.abs(b.x - a.x),
              h: Math.abs(b.y - a.y),
            },
          }))
        },
        () => seal(),
      )
    },
    [bindGesture, view, patchAct, seal, tightest],
  )

  /**
   * Moving and resizing a drawn area.
   *
   * The same maths as the camera frame above, in BOARD UNITS for the same
   * reason: percent-of-crop runs along the pitch, the upright views stand the
   * pitch on its end, and a resize written in percent moves the corner the
   * coach did not grab. The round trip through `toUnits` / `unitsToPercent` is
   * exact, so nothing is lost by working in the space the pointer is actually
   * in and converting back at the end.
   *
   * The band is read out of `act` at PRESS time and held in `start`, so the
   * gesture is measured against where the box was when it was grabbed rather
   * than against wherever the last frame left it — which is what stops a
   * resize from accelerating away as the pointer moves.
   */
  const beginZoneDrag = useCallback(
    (id: string, part: FramePart, e: React.PointerEvent<SVGElement>) => {
      const svg = svgRef.current
      if (!svg) return
      const band = act?.bands.find((b) => b.id === id)
      if (!band?.rect) return
      e.stopPropagation()
      e.preventDefault()

      const a = toUnits(view, band.rect.x, band.rect.y)
      const c = toUnits(view, band.rect.x + band.rect.w, band.rect.y + band.rect.h)
      const start = {
        x: Math.min(a.x, c.x),
        y: Math.min(a.y, c.y),
        w: Math.abs(c.x - a.x),
        h: Math.abs(c.y - a.y),
      }
      const crop = cropRect(view)
      const down = clientToPercent(svg, view, e.clientX, e.clientY)
      const downU = toUnits(view, down.x, down.y)
      // The corner that stays put while its opposite is dragged.
      const anchorPt = {
        x: part === 'nw' || part === 'sw' ? start.x + start.w : start.x,
        y: part === 'nw' || part === 'ne' ? start.y + start.h : start.y,
      }

      bindGesture(
        e.pointerId,
        (ev) => {
          const q = clientToPercent(svg, view, ev.clientX, ev.clientY)
          const qu = toUnits(view, q.x, q.y)

          let box: { x: number; y: number; w: number; h: number }
          if (part === 'move') {
            box = { ...start, x: start.x + (qu.x - downU.x), y: start.y + (qu.y - downU.y) }
          } else {
            // A floor, not a clamp to the grass. A zone is allowed to run off
            // the edge of the crop — a coach shading the space wide of the
            // touchline is making a real point — but a box of no width is a
            // mark that cannot be seen or grabbed again.
            const min = crop.w * 0.03
            const x0 = Math.min(anchorPt.x, qu.x)
            const x1 = Math.max(anchorPt.x, qu.x)
            const y0 = Math.min(anchorPt.y, qu.y)
            const y1 = Math.max(anchorPt.y, qu.y)
            box = { x: x0, y: y0, w: Math.max(min, x1 - x0), h: Math.max(min, y1 - y0) }
          }

          const p1 = unitsToPercent(view, box.x, box.y)
          const p2 = unitsToPercent(view, box.x + box.w, box.y + box.h)
          const rect = rectOf(p1, p2)
          // One label for the whole gesture, so ../history.ts folds it into a
          // single undo rather than one per frame of the drag.
          patchAct(`zone:${id}`, (a2) => ({
            ...a2,
            bands: a2.bands.map((b) => (b.id === id ? { ...b, rect } : b)),
          }))
        },
        () => seal(),
      )
    },
    [act, bindGesture, view, patchAct, seal],
  )

  /**
   * What the line being picked would be closed with if nobody said otherwise,
   * recomputed on every click. See `suggestClose`.
   */
  const closeSuggestion = useMemo(
    () =>
      suggestClose(
        blockPick.map((id) => act?.tokens.find((t) => t.id === id)).filter((t): t is Token => Boolean(t)),
        act?.tokens ?? [],
        view,
      ),
    [blockPick, act, view],
  )
  /** What the preview draws and what the commit stores. */
  const effectiveClose = blockClose === 'auto' ? closeSuggestion : blockClose

  /**
   * Picking the players a hand-drawn block runs through.
   *
   * A toggle, not an append. The commonest mistake with a click-to-pick control
   * is clicking the wrong man, and the only recovery anybody looks for is
   * clicking him again — an undo stack does not occur to somebody halfway
   * through drawing one mark. Taking him out leaves the rest of the order
   * intact, which is the behaviour that makes the mistake cost nothing.
   */
  const pickForBlock = useCallback((id: string) => {
    setBlockPick((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length >= BLOCK_MAX
          ? cur
          : [...cur, id],
    )
  }, [])

  /**
   * Commit the picked line, if there is one worth committing.
   *
   * Two players is the floor: a band through one man has no line to thread and
   * would fill the whole width of the pitch from a single point, which is not
   * an idea anybody is trying to express. Below the floor this cancels rather
   * than complaining — the coach armed a tool and changed their mind, which is
   * not an error.
   *
   * READS `blockPick` DIRECTLY, and does not write the document from inside a
   * state updater. It used to do both at once — `setBlockPick(cur => { patch;
   * return [] })` — which is a document write during React's render phase. It
   * happened to work; it is also exactly the shape that appends the band twice
   * the day anything re-invokes the updater, and a duplicate band is invisible
   * on the board and takes two deletes to remove.
   */
  const commitBlockPick = useCallback(() => {
    if (blockPick.length >= 2) {
      const close = blockClose === 'auto' ? closeSuggestion : blockClose
      patchAct('block', (a) => ({
        ...a,
        bands: [
          ...a.bands,
          {
            id: uid('bd'),
            kind: 'block' as BandKind,
            throughTokens: blockPick,
            drawn: true,
            // Absent means the goal — see `close` on Band in ../schema.ts. Only
            // the choice that differs from the house one is written down.
            ...(close === 'shape' ? { close: 'shape' as const } : null),
          },
        ],
      }))
      seal()
    }
    setBlockPick([])
    setBlockClose('auto')
    setTool('select')
  }, [blockPick, blockClose, closeSuggestion, patchAct, seal])

  const cancelBlockPick = useCallback(() => {
    setBlockPick([])
    setBlockClose('auto')
    setTool('select')
  }, [])

  // Enter draws it, Escape forgets it. Live only while the tool is armed, so
  // neither key is taken away from anything else in the studio.
  useEffect(() => {
    if (tool !== 'block') return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitBlockPick()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelBlockPick()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [tool, commitBlockPick, cancelBlockPick])

  // Leaving the tool by any other route — picking another tool, a phase change,
  // an undo — must not leave a half-picked line waiting to be committed by an
  // Enter pressed for some other reason.
  useEffect(() => {
    if (tool === 'block') return
    if (blockPick.length) setBlockPick([])
    if (blockClose !== 'auto') setBlockClose('auto')
  }, [tool, blockPick.length, blockClose])

  /*
   * An armed actor must not outlive the tool or the phase it was armed in. The
   * second tap would otherwise land on a different idea from the first — a
   * press aimed at a man who is no longer on this board, or a pass performed
   * with the Run tool because the coach switched between taps.
   */
  useEffect(() => {
    setActor(null)
  }, [tool, actIndex])

  /*
   * Arrows and shaded areas are the same gesture: press, drag, release. They
   * differ only in what gets committed, so they share one handler rather than
   * two that drift apart.
   */
  const beginDraw = useCallback(
    /**
     * `startTokenId` is the counter the press landed on, when it landed on one.
     *
     * Arrow tools keep counters live rather than taking them away, which every
     * other drawing tool does. It is the same bargain the Block tool struck: a
     * tool whose whole job is naming players cannot have the players switched
     * off. Dragging still works exactly as it did — the gesture just knows
     * where it started, and a press that never travels is read as a tap on that
     * man instead of being thrown away as a misclick.
     */
    (e: React.PointerEvent, startTokenId: string | null = null) => {
      const svg = svgRef.current
      const source = act
      if (!svg || !source) return
      e.preventDefault()
      const from = clientToPercent(svg, view, e.clientX, e.clientY)
      // Held here as well as in state: the commit at the end reads these
      // locals, so it cannot land on a stale render's copy of the drag.
      let to = from
      setPending({ from, to })

      bindGesture(
        e.pointerId,
        (ev) => {
          to = clientToPercent(svg, view, ev.clientX, ev.clientY)
          // Straightened BEFORE `pending` is set and before the commit reads
          // it, so the preview a coach is judging the drag by is the mark they
          // will get. A constraint that only applied on release would be a
          // line that jumped when they let go of it.
          if (ev.shiftKey) {
            to = isZoneTool(tool) ? constrainBox(view, from, to) : constrainDrag(view, from, to)
          }
          setPending({ from, to })
          // Ring the man the head will attach to, so the coach can see the
          // arrow is going to hold on to him before they let go of it.
          if (isArrowTool(tool)) setSnapId(snapTarget(view, to, source.tokens))
        },
        () => {
          /*
           * ── CLICK OR DRAG IS A SCREEN-DISTANCE QUESTION ──────────────────
           *
           * This threshold is three percent of the BOARD, and a percent of the
           * board is screen pixels divided by the workspace zoom. Left in board
           * units it meant a coach at 250% had to pull two and a half times as
           * far before the studio would call it a drag, and at 600% a 120-pixel
           * pull was still read as a tap (measured, 2026-08-28).
           *
           * What that cost was never a missing arrow, which would at least have
           * been legible. A tap ARMS the man under it, so the swallowed drag
           * armed somebody and the NEXT drag fired the two-tap action instead:
           * an arrow out of a player nobody had pointed at, and a new phase
           * posed behind it. That is the "arrows show completely wrongly"
           * (user, 2026-08-28).
           *
           * Dividing by the zoom keeps the threshold the same distance under
           * the finger at every magnification, and leaves 100% exactly where it
           * has always been.
           */
          const { zoom } = workspaceRef.current
          if (isArrowTool(tool)) {
            const travelled = Math.hypot(to.x - from.x, to.y - from.y) > 3 / zoom
            if (travelled) {
              /*
               * Both ends look for a player as the arrow lands, so the common
               * case — dragging from one counter to another — comes out bound
               * without the coach doing anything about it, and the arrow
               * follows them both from then on. `fromId` is excluded from the
               * far end's search so a short arrow between two men standing
               * close cannot attach both ends to the same one.
               */
              const fromId = snapTarget(view, from, source.tokens) ?? undefined
              const toId = snapTarget(view, to, source.tokens, fromId) ?? undefined
              patchAct('arrow', (a) => ({
                ...a,
                arrows: [
                  ...a.arrows,
                  { id: uid('ar'), kind: tool, from, to, ...(fromId ? { fromId } : null), ...(toId ? { toId } : null) },
                ],
              }))
              seal()
            } else if (!isActionTool(tool)) {
              /*
               * A LINE THAT NEVER TRAVELLED IS NOTHING, and is dropped here.
               *
               * Every branch below this one is about the two-tap action, and a
               * line has no action to fire — so a click with it armed has to
               * mean "I changed my mind", not "arm this man". Falling through
               * would leave `actor` set on a tool that can never spend it, and
               * the next drag would fire somebody else's pass.
               */
            } else if (!actor) {
              /*
               * First tap. It only arms if it landed on somebody: an action has
               * to come FROM a player, and a tap on grass with nothing armed is
               * a coach who has not started yet rather than one who has made a
               * mistake worth interrupting them about.
               */
              if (startTokenId) {
                setActor(startTokenId)
                setPending(null)
                setSnapId(null)
                // The tool stays armed. The second tap is the other half of it.
                return
              }
            } else if (startTokenId === actor) {
              // Tapping the armed man again takes it back.
              setActor(null)
              setPending(null)
              setSnapId(null)
              return
            } else {
              performAction(
                tool,
                actor,
                startTokenId ? { kind: 'token', id: startTokenId } : { kind: 'spot', pt: to },
              )
              setActor(null)
            }
          } else if (isZoneTool(tool)) {
            // A sliver of a box is a misdrag. Both sides have to be real —
            // and "real" is a size on the screen, so it comes down by the zoom
            // for the same reason the arrow's threshold above does.
            const sliver = 4 / zoom
            if (Math.abs(to.x - from.x) > sliver && Math.abs(to.y - from.y) > sliver) {
              patchAct('zone', (a) => ({
                ...a,
                bands: [...a.bands, { id: uid('bd'), kind: tool, rect: rectOf(from, to) }],
              }))
              seal()
            }
          } else if (isTextTool(tool)) {
            /*
             * ── PLACING WRITING ──────────────────────────────────────────────
             *
             * At `from` and not at `to`, so a click and a small accidental drag
             * both put the words where the coach pressed. There is no minimum
             * gesture to satisfy and no sliver to reject: unlike a zone, a text
             * mark drawn by a twitch is a text mark in the right place.
             *
             * It is placed EMPTY and then selected, which is the whole design of
             * this tool. The alternative is a prompt, and a prompt is a modal in
             * front of a board — a coach cannot see what they are writing over
             * while a dialog is covering it. Here the mark is on the grass from
             * the first frame, the panel opens on it, and every keystroke lands
             * on the board where they can judge it.
             *
             * `size: 'm'` and no other field: everything else is house default,
             * resolved at draw time. Writing the defaults into the document
             * would freeze today's house style into every note ever placed.
             */
            const id = uid('tx')
            patchAct('text', (a) => ({
              ...a,
              texts: [...(a.texts ?? []), { id, x: from.x, y: from.y, text: '', size: 'm' }],
            }))
            seal()
            setSelection({ kind: 'mark', id })
          }
          setPending(null)
          setSnapId(null)
          setTool('select')
        },
      )
    },
    [act, actor, bindGesture, view, tool, patchAct, performAction, seal, setSelection],
  )

  // ── playback ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (playhead === null) return
    let raf = 0
    const start = performance.now() - playhead
    const total = totalDuration(system.acts.length, hold, move)
    const step = () => {
      const t = performance.now() - start
      if (t >= total) {
        setPlayhead(null)
        setActIndex(system.acts.length - 1)
        return
      }
      setPlayhead(t)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // Restarting on every playhead tick would reset `start`; the ref-free
    // approach here is to depend only on whether playback is on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playhead === null, system.acts.length, hold, move])

  const timeline = playhead === null ? null : timelineAt(playhead, system.acts.length, hold, move)
  const rendered = useMemo(() => {
    if (timeline) {
      return tweenActs(system.acts[timeline.index], system.acts[timeline.next], timeline.p, system)
    }
    const base = resolveAct(act, system)
    /*
     * The line as it is being picked, drawn as a real block rather than as
     * dots on the chosen players.
     *
     * It is the only honest preview: what a coach is deciding is not "are these
     * the right four men", it is "is this the right SHAPE", and the shape is
     * the shaded space behind them. Showing it live is what makes clicking a
     * fifth player and watching the band swing an obviously reversible act.
     * Under two picks there is no line yet and nothing to show.
     */
    if (isPickTool(tool)) {
      return blockPick.length >= 2
        ? {
            ...base,
            bands: [
              ...base.bands,
              {
                id: 'preview',
                kind: 'block' as BandKind,
                throughTokens: blockPick,
                close: effectiveClose,
                opacity: 1,
              },
            ],
          }
        : base
    }
    if (!pending) return base
    // Preview the mark being drawn, without committing it to the document.
    if (isArrowTool(tool)) {
      return {
        ...base,
        arrows: [
          ...base.arrows,
          { id: 'preview', kind: tool, from: pending.from, to: pending.to, opacity: 0.6 },
        ],
      }
    }
    if (isZoneTool(tool)) {
      return {
        ...base,
        bands: [
          ...base.bands,
          { id: 'preview', kind: tool, rect: rectOf(pending.from, pending.to), opacity: 1 },
        ],
      }
    }
    return base
    // On the WHOLE system, not on `system.acts`.
    //
    // The narrow list was right while a pose was only ever a function of the
    // acts. It stopped being right the moment the camera arrived: the shot is
    // derived from `system.camera` and `system.pitch`, and flipping the camera
    // makes a new system object while leaving the acts array — and `act` — at
    // the same reference, so nothing here changed and the board went on
    // drawing the previous frame. Naming the two fields would fix today's bug
    // and leave the same trap set for the next render-affecting field, so this
    // depends on the document. The cost is re-posing 22 counters when a title
    // is typed, which is nothing.
  }, [timeline, system, act, pending, tool, blockPick, effectiveClose])

  shotRef.current = rendered.shot

  /**
   * Hand this phase a frame to drag.
   *
   * It starts as exactly what the camera was already doing, so pressing it
   * changes nothing on screen — which is the point. A button that jumped the
   * shot somewhere else before the coach had touched anything would be asking
   * them to undo it first. When there is nothing derived to copy, it opens on a
   * middling box over the middle of the board: something to grab, and obviously
   * a starting point rather than an opinion.
   */
  const frameByHand = useCallback(() => {
    const shot = shotRef.current ?? { x: 50, y: 50, w: 62, h: 62 }
    patchAct('frame', (a) => ({ ...a, shot }))
    seal()
  }, [patchAct, seal])

  /**
   * The tool did its job. Counted, and remembered until the dialog is out of
   * the way — see ../feedback.ts for why this is what times the one question we
   * ask, and why a count of visits would have been the wrong number.
   */
  const recordWin = useCallback(
    (context: FeedbackContext) => {
      markGuide({ wins: guideRef.current.wins + 1 })
      pendingWin.current = context
    },
    [markGuide],
  )

  /**
   * Shutting an export dialog, and asking on the way out if this is the one.
   *
   * `feedbackAskedAt` is stamped when the dialog OPENS, not when it is
   * answered. Dismissing is an answer for our purposes: somebody who did not
   * want to be asked today is exactly the person who must not be asked again
   * next week.
   */
  const closeExport = useCallback(() => {
    setSharing(false)
    setMakingVideo(false)
    setExporting(false)
    const win = pendingWin.current
    pendingWin.current = null
    if (win && shouldAsk(guideRef.current)) {
      markGuide({ feedbackAskedAt: Date.now() })
      setFeedback(win)
    }
  }, [markGuide])

  const playing = playhead !== null
  const drawing = tool !== 'select'
  // Everything that means "not now" for the ask above. Recomputed every render,
  // which is exactly what a ref read from inside a timeout wants.
  busyRef.current =
    playing ||
    drawing ||
    sharing ||
    makingVideo ||
    exporting ||
    walkthrough ||
    help ||
    news ||
    tooSmall ||
    feedback !== null
  /**
   * A tool that takes the GRASS, as opposed to one that takes clicks on
   * players. Everything the board withholds while a mark is being drawn — the
   * counters, the camera frame, mark selection — is withheld because a drag
   * across the pitch must not be stolen by whatever is under it. The Block tool
   * is the opposite case: it needs the counters to be clickable and nothing
   * else to be, so the two cannot share one flag.
   */
  /*
   * Which tools take the counters away.
   *
   * The zone tools do: a box dragged across a player is one gesture and must
   * not be interrupted by him. The Block tool never did, because clicking
   * players IS that tool. Arrow tools have now joined it for the same reason —
   * they name players too — and they keep the drag by starting the same gesture
   * from the counter instead of from the grass under it.
   */
  const dragging_tool = drawing && !isPickTool(tool) && !isArrowTool(tool)

  /**
   * What the pointer is for, as the board understands it — see `BoardMode` in
   * ../board/Board.tsx. Playing counts as Move: nothing on the board can be
   * touched during playback, and a crosshair over a film is a lie.
   */
  const boardMode: BoardMode = playing
    ? 'move'
    : dragging || pending
      ? 'dragging'
      : isPickTool(tool)
        ? 'pick'
        : drawing
          ? 'draw'
          : 'move'

  // ── team + shape actions ───────────────────────────────────────────────────

  /**
   * Whether anybody has been moved off their formation position on this phase.
   *
   * This is the question the shape picker has to answer before it re-places
   * anyone, because the positions are the ONLY thing a re-place destroys:
   * names, faces, cues, fades and bibs all survive it now (`withEdits`), and
   * arrows are left alone and follow whoever they are bound to.
   *
   * IT ASKS EVERY FORMATION, not the one the picker is showing. `usFormation`
   * is editor state that starts at 4-3-3 and is not read back off a document,
   * so a system reopened tomorrow would have a picker that disagrees with the
   * board, and testing against it would call a pristine phase hand-posed. A
   * phase that matches ANY shape's placement exactly is a phase nobody has
   * touched, whatever the picker happens to say. Thirty formations by eleven
   * players is nothing, and it only runs on a click.
   *
   * When it is wrong it is wrong towards warning, which is the right direction:
   * the cost of a needless prompt is a click, and the cost of a missed one is a
   * phase of somebody's work.
   */
  const posedByHand = (side: Side, a: Act): boolean => {
    const here = a.tokens.filter((t) => t.side === side)
    if (here.length === 0) return false
    const keep = Boolean(system.keepShape)
    const wide = side === 'us' && (keep || !a.tokens.some((t) => t.side === 'them'))
    const band = keep && side === 'them' ? oppositionBand(a.tokens) : undefined
    const at = new Map(here.map((t) => [t.id, t]))
    return !FORMATIONS.some((f) => {
      const placed = place(f, side, system.pitch, labels, wide, band)
      if (placed.length !== here.length) return false
      return placed.every((q) => {
        const t = at.get(q.id)
        // `place` rounds to a tenth, so anything inside that is the same spot.
        return Boolean(t) && Math.abs(t!.x - q.x) < 0.15 && Math.abs(t!.y - q.y) < 0.15
      })
    })
  }

  /**
   * Lay a shape down, on this phase or on all of them.
   *
   * `scope` is the half of this that was missing. A coach on phase 3 who picked
   * a back three got it on phase 3 and nowhere else, which reads as the studio
   * having reverted them to phase 1 rather than as the change landing on one
   * phase (2026-08-28). Both answers are legitimate, so the prompt asks.
   */
  const applyFormation = (side: Side, formationId: string, scope: 'phase' | 'all' = 'phase') => {
    const f = FORMATION_BY_ID.get(formationId)
    if (!f) return
    const keep = Boolean(system.keepShape)
    const lay = (a: Act): Act => {
      // Whether our shape gets the wide band is asked of THIS phase, because
      // an opposition is something a phase has or does not have. With "Keep my
      // shape" on the answer is always wide, and a new opposition shape is
      // fitted to the mirror of what is already on the pitch.
      const wide = side === 'us' && (keep || !a.tokens.some((t) => t.side === 'them'))
      const band = keep && side === 'them' ? oppositionBand(a.tokens) : undefined
      return {
        ...a,
        tokens: [
          ...a.tokens.filter((t) => t.side !== side),
          // Everything the coach typed, picked or assigned rides across; only
          // the positions and the position labels come from the new shape.
          ...withEdits(place(f, side, system.pitch, labels, wide, band), a.tokens, false),
        ],
      }
    }
    if (scope === 'all') {
      // A phase that has none of this side is LEFT ALONE. "Every phase" is a
      // scope, not an instruction to conjure an opposition onto phases the
      // coach deliberately left them off.
      edit('formation', (sys) => ({
        ...sys,
        acts: sys.acts.map((a) => (a.tokens.some((t) => t.side === side) ? lay(a) : a)),
      }))
    } else {
      patchAct('formation', lay)
    }
    seal()
    if (side === 'us') setUsFormation(formationId)
    else setThemFormation(formationId)
  }

  /**
   * A coach picked a shape. Whether they are asked anything first.
   *
   * Silent on the one case where there is genuinely nothing to say: a single
   * phase with nobody moved off their marks, which is a coach trying shapes on
   * before they start work. Every other case has a real question in it, either
   * "this will cost you the positions on phase 2 and 3" or, on a system with
   * several phases and nothing posed yet, simply "which phases did you mean".
   */
  const chooseFormation = (side: Side, formationId: string) => {
    const posed = system.acts.some((a) => posedByHand(side, a))
    if (!posed && system.acts.length === 1) applyFormation(side, formationId)
    else setShapePrompt({ side, formationId })
  }

  /**
   * The question a shape picker asks before it re-places anybody.
   *
   * Under the picker that asked it, and not in a modal over the board. The
   * coach is looking at the control they just used, the thing they are being
   * asked about is the board behind it, and a dialog that blanks the board to
   * ask "are you sure" hides the only evidence they have.
   */
  const shapePromptFor = (side: Side) => {
    if (shapePrompt?.side !== side) return null
    const f = FORMATION_BY_ID.get(shapePrompt.formationId)
    const posed = system.acts.map((a, i) => (posedByHand(side, a) ? i + 1 : 0)).filter(Boolean)
    const many = system.acts.length > 1
    const list =
      posed.length > 1 ? `${posed.slice(0, -1).join(', ')} and ${posed[posed.length - 1]}` : String(posed[0])
    const go = (scope: 'phase' | 'all') => {
      applyFormation(side, shapePrompt.formationId, scope)
      setShapePrompt(null)
    }
    return (
      <div className="mt-3 rounded border border-ink-hair bg-ink/5 p-3">
        <p className="text-[11px] font-medium leading-snug text-ink-soft">
          {f?.name ?? 'That shape'} puts {side === 'us' ? 'your' : 'their'} players back on formation positions.
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">
          {posed.length === 0
            ? `Nobody has been moved off their marks yet, so nothing is lost. Choose which ${PHASE.many} it lands on.`
            : `${posed.length > 1 ? PHASE.Many : PHASE.One} ${list} ${
                posed.length > 1 ? 'have' : 'has'
              } positions you posed by hand, and re-placing loses them. Names, faces, cues, fades and bibs are kept, and Undo puts it all back.`}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Button variant="solid" onClick={() => go('phase')}>
            {many ? `This ${PHASE.one} only` : 'Change the shape'}
          </Button>
          {many && <Button onClick={() => go('all')}>Every {PHASE.one}</Button>}
          <Button variant="ghost" onClick={() => setShapePrompt(null)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  /**
   * Change the pitch view without destroying anything.
   *
   * Percent coordinates are relative to the crop, so they cannot simply be
   * carried over — but they can be re-expressed. Every mark goes out to metres
   * in the old view and back into percent in the new one, which keeps it on the
   * same patch of grass. Players who fall outside the new crop stay in the
   * document and reappear when it widens; `Re-place shapes` is there for when
   * the coach actually wants the shape fitted to the view they are now on.
   *
   * The earlier version of this re-placed both formations and deleted every
   * arrow in every act, which is a lot of a coach's work to throw away for a
   * change they might be making to take a second look.
   */
  const setPitch = (pitch: System['pitch']) => {
    edit('pitch', (s) => remapSystem(s, pitch))
    seal()
  }

  /**
   * Lay a set piece down: the board it wants, and everybody on their marks.
   *
   * ── ONE EDIT, AND THE ORDER INSIDE IT MATTERS ──────────────────────────────
   *
   * The view change goes first, through `remapSystem`, so the arrows and shaded
   * areas the coach has already drawn come across onto the same grass. Only
   * then are the players posed, because a spot is authored in metres off the
   * goal and has to be turned into percent of the crop it is actually landing
   * on. Doing it as two edits would pose against the crop the coach was on a
   * render ago and put a near-post runner in the car park.
   *
   * ── THIS PHASE ONLY ────────────────────────────────────────────────────────
   *
   * Same call `Re-place shapes` makes, and for the same reason: a set piece is
   * the FIRST phase of a routine, not the routine. A coach lays the corner out,
   * adds a phase, and moves three men — stamping the starting positions onto
   * every phase would flatten exactly the work they came here to do. The view
   * is a property of the system, so that part does land everywhere.
   */
  const applySetPiece = (id: string) => {
    if (id === '') {
      if (preSetPieceSystem) {
        edit('setpiece', () => preSetPieceSystem)
        seal()
      }
      setSetPieceId('')
      setPreSetPieceSystem(null)
      return
    }

    if (!setPieceId && !preSetPieceSystem) {
      setPreSetPieceSystem(system)
    }

    const piece = SET_PIECE_BY_ID.get(id)
    if (!piece) return
    const view = PITCH_VIEWS[piece.view]
    edit('setpiece', (s) => {
      const moved = remapSystem(s, piece.view)
      const here = Math.min(actIndexRef.current, moved.acts.length - 1)
      return {
        ...moved,
        tokenSize: piece.tokenSize ?? moved.tokenSize,
        acts: moved.acts.map((a, i) => {
          if (i !== here) return a
          // An opposition is something a PHASE has. A set piece does not
          // conjure one onto a board the coach deliberately left one team on.
          const hasThem = a.tokens.some((t) => t.side === 'them')
          const at = spotToPercent(view, piece.ball)
          const balls = ballsOf(a)
          return {
            ...a,
            tokens: [
              ...arrange(piece, 'us', view, a.tokens),
              ...(hasThem ? arrange(piece, 'them', view, a.tokens) : []),
            ],
            bands: [
              ...a.bands,
              ...(piece.bands?.map((b, bi) => {
                const p1 = spotToPercent(view, { d: b.rect.d, s: b.rect.s })
                const p2 = spotToPercent(view, { d: b.rect.d + b.rect.h, s: b.rect.s + b.rect.w })
                return {
                  id: `sp-band-${a.id}-${bi}`,
                  kind: b.kind,
                  shape: b.shape ?? 'box',
                  label: b.label,
                  tone: b.tone,
                  rect: {
                    x: Math.min(p1.x, p2.x),
                    y: Math.min(p1.y, p2.y),
                    w: Math.abs(p2.x - p1.x),
                    h: Math.abs(p2.y - p1.y),
                  },
                } as Band
              }) ?? []),
            ],
            gear: [
              ...(a.gear ?? []),
              ...(piece.gear?.map((g, gi) => {
                const at = spotToPercent(view, { d: g.d, s: g.s })
                return {
                  id: `sp-gear-${a.id}-${gi}`,
                  kind: g.gear,
                  x: at.x,
                  y: at.y,
                }
              }) ?? []),
            ],
            // The ball that is already here is MOVED, keeping its id, so a
            // phase that follows still tweens the same ball rather than
            // cutting one away and another in. Any others are left alone.
            ...ballFields([{ ...(balls[0] ?? newBall()), ...at }, ...balls.slice(1)]),
            arrows: piece.delivery
              ? [
                  ...a.arrows.filter((ar) => ar.id !== DELIVERY_ID),
                  {
                    id: DELIVERY_ID,
                    kind: piece.delivery.kind,
                    from: at,
                    to: spotToPercent(view, piece.delivery),
                    bend: piece.delivery.bend,
                  },
                ]
              : a.arrows,
          }
        }),
      }
    })
    setSetPieceId(id)
    seal()
  }

  /** Snap both shapes back to their formation defaults, fitted to this view. */
  const replaceShapes = () => {
    const us = FORMATION_BY_ID.get(usFormation)
    const them = FORMATION_BY_ID.get(themFormation)
    const keep = Boolean(system.keepShape)
    patchAct('replace', (a) => {
      // This phase only, and it does not conjure an opposition onto a phase
      // that has none — it re-places the shapes that are standing here.
      const hasThem = a.tokens.some((t) => t.side === 'them')
      const ours = us ? withEdits(place(us, 'us', system.pitch, labels, keep || !hasThem), a.tokens) : []
      return {
        ...a,
        tokens: [
          ...ours,
          ...(hasThem && them
            ? withEdits(
                place(them, 'them', system.pitch, labels, false, keep ? oppositionBand(ours) : undefined),
                a.tokens,
              )
            : []),
        ],
      }
    })
    seal()
  }

  /**
   * Put the opposition on THIS phase, or take them off it.
   *
   * Per phase, and that is the point of it. An opposition is not a property of
   * the system, it is something a particular moment of the system has: a coach
   * lays six phases out building a shape and then wants the eleven reds on the
   * seventh, where the point is made. Stamping them onto every phase — which
   * is what this used to do — means opening the six earlier ones again to take
   * them off, and the fade in and out of a phase where they arrive is not
   * available at all.
   *
   * The band our own shape gets is settled the same two ways as before:
   *
   *  · Default — each side gets a half. Our shape on this phase is re-placed
   *    into the narrower band as the opposition arrives and back out across
   *    the board when they leave.
   *  · Keep my shape — our tokens are not touched, at all, in either
   *    direction. The opposition is laid into the mirror of the ground we
   *    already cover.
   */
  const toggleOpposition = (on: boolean) => {
    edit('opposition', (s) => {
      const us = FORMATION_BY_ID.get(usFormation)
      const them = FORMATION_BY_ID.get(themFormation)
      const keep = Boolean(s.keepShape)
      const here = Math.min(actIndexRef.current, s.acts.length - 1)
      const acts = s.acts.map((a, i) => {
        if (i !== here) return a
        const ours = keep
          ? a.tokens.filter((t) => t.side === 'us')
          : us
            ? withEdits(place(us, 'us', s.pitch, labels, !on), a.tokens)
            : []
        return {
          ...a,
          tokens: [
            ...ours,
            ...(on && them
              ? withEdits(
                  place(them, 'them', s.pitch, labels, false, keep ? oppositionBand(ours) : undefined),
                  a.tokens,
                )
              : []),
          ],
        }
      })
      /*
       * `teams.them` is the opposition's KIT — one colour and one name for
       * whoever we are playing, which cannot sensibly differ between two poses
       * of the same move. So it is not per phase: it comes into being with the
       * first phase that puts an opposition on and goes away with the last one
       * that takes them off, which is exactly when the colour well is worth
       * showing. Deriving it from the acts rather than from the toggle also
       * means it can never drift out of step with what is on the board.
       */
      const anywhere = acts.some((a) => a.tokens.some((t) => t.side === 'them'))
      return {
        ...s,
        teams: { ...s.teams, them: anywhere ? (s.teams.them ?? DEFAULT_THEM) : null },
        acts,
      }
    })
    seal()
  }

  /**
   * Switch how the two shapes share the board.
   *
   * Both directions are reversible and neither one regenerates our shape from
   * its formation template — the whole point of the switch is that a system
   * the coach built by hand survives it. Our tokens are only ever RESCALED
   * between the two bands, so every relationship inside the shape is a ratio
   * that comes back intact when the switch goes the other way.
   *
   * Unlike the opposition toggle this is a document-wide switch and has to be:
   * it decides how much of the board our shape occupies, and our shape has to
   * occupy the same board on every phase or the players slide sideways between
   * two poses that were meant to be still.
   *
   * A phase with no opposition on it is left completely alone. Under either
   * setting our shape already has the wide band to itself there, so there is
   * nothing to rescale and nobody to place against.
   */
  const toggleKeepShape = (on: boolean) => {
    edit('keepShape', (s) => {
      if (!s.teams.them) return { ...s, keepShape: on }
      const them = FORMATION_BY_ID.get(themFormation)
      const from = usBand(s.pitch, !on)
      const to = usBand(s.pitch, on)
      return {
        ...s,
        keepShape: on,
        acts: s.acts.map((a) => {
          const theirs = a.tokens.filter((t) => t.side === 'them')
          if (!theirs.length) return a
          const ours = a.tokens
            .filter((t) => t.side === 'us')
            .map((t) => ({ ...t, x: rescaleX(t.x, from, to) }))
          return {
            ...a,
            tokens: [
              ...ours,
              ...(them
                ? withEdits(
                    place(them, 'them', s.pitch, labels, false, on ? oppositionBand(ours) : undefined),
                    a.tokens,
                  )
                : theirs),
            ],
          }
        }),
      }
    })
    seal()
  }

  const setTeamColor = (side: Side, base: string) => {
    edit(`colour:${side}`, (s) => ({
      ...s,
      teams: {
        ...s.teams,
        [side]: {
          ...(side === 'us' ? s.teams.us : (s.teams.them ?? DEFAULT_THEM)),
          base,
          deep: darken(base),
          text: readableText(base),
        },
      },
    }))
  }

  // ── bibs ───────────────────────────────────────────────────────────────────

  /** Every bib on this board. Empty on a board that has never had one. */
  const bibs = system.bibs ?? []

  /** How many players on this phase are in a given bib. */
  const bibWorn = (id: string) => act.tokens.filter((t) => t.bib === id).length

  /** The next seed colour nobody on this board has taken. */
  const nextBib = () =>
    BIB_SEEDS.find((b) => !bibs.some((x) => x.base.toUpperCase() === b.base.toUpperCase())) ?? BIB_SEEDS[0]

  /**
   * Put a bib on a player, or take theirs off. ON EVERY PHASE.
   *
   * Which is the whole difference between this and `patchToken` beside it. A
   * cue and a fade are per-phase because they are what somebody is doing on
   * this beat. A bib is what they are wearing for the session, and a player who
   * changed shirt halfway through a move would read as a substitution. See
   * `Token.bib` in ../schema.ts.
   */
  const assignBib = (tokenId: string, bib: string | undefined) => {
    edit('bib:wear', (s) => ({
      ...s,
      acts: s.acts.map((a) => ({
        ...a,
        tokens: a.tokens.map((t) => (t.id === tokenId ? { ...t, bib } : t)),
      })),
    }))
    seal()
  }

  /**
   * A new bib.
   *
   * `base` is a colour the coach picked for themselves, off the plus on the
   * player panel; without one it takes the next off BIB_SEEDS. `wearer` puts it
   * straight onto somebody, so choosing a colour for one player is one gesture
   * rather than make-a-bib-then-assign-it.
   */
  const addBib = (base?: string, wearer?: string) => {
    const seed = nextBib()
    const hex = base ?? seed.base
    const bib: Bib = {
      id: uid('bib'),
      name: base ? `Bib ${bibs.length + 1}` : seed.name,
      base: hex,
      deep: darken(hex),
      text: readableText(hex),
    }
    edit('bib:add', (s) => ({
      ...s,
      bibs: [...(s.bibs ?? []), bib],
      acts: wearer
        ? s.acts.map((a) => ({
            ...a,
            tokens: a.tokens.map((t) => (t.id === wearer ? { ...t, bib: bib.id } : t)),
          }))
        : s.acts,
    }))
    seal()
  }

  /**
   * Recolour a bib. `deep` and the label colour are derived here for the same
   * reason `setTeamColor` derives them: they are the same fact twice, and a
   * stored copy is the one that goes stale.
   */
  const setBibColour = (id: string, base: string) => {
    edit(`bib:colour:${id}`, (s) => ({
      ...s,
      bibs: (s.bibs ?? []).map((b) =>
        b.id === id ? { ...b, base, deep: darken(base), text: readableText(base) } : b,
      ),
    }))
  }

  const renameBib = (id: string, name: string) => {
    edit(`bib:name:${id}`, (s) => ({
      ...s,
      bibs: (s.bibs ?? []).map((b) => (b.id === id ? { ...b, name } : b)),
    }))
  }

  /**
   * Take a bib off the board. Everybody in it goes back to their side's kit, on
   * every phase.
   *
   * `kitFor` would draw them that way anyway, since an id naming nothing falls
   * back to the side. Clearing it is about the document rather than the picture:
   * a counter carrying the id of a bib that no longer exists is a counter
   * claiming something untrue, and it is the kind of thing that comes back as a
   * bug the day anything else learns to read the field.
   */
  const removeBib = (id: string) => {
    edit('bib:remove', (s) => ({
      ...s,
      bibs: (s.bibs ?? []).filter((b) => b.id !== id),
      acts: s.acts.map((a) => ({
        ...a,
        tokens: a.tokens.map((t) => (t.bib === id ? { ...t, bib: undefined } : t)),
      })),
    }))
    seal()
  }

  /**
   * Paint the coach's own kit onto this board.
   *
   * `withProfile` and not a hand-written patch, deliberately: it is the same
   * function that paints a NEW board, so "use my kit" cannot come to mean
   * something different from "start a board" the next time the kit grows a
   * field. The last time that spelling was written out by hand at a call site
   * it silently stopped covering the ring and the pattern — see `creditOnly`
   * in ../account/cloud.ts, which exists because of exactly that.
   */
  const applyMyKit = () => {
    const p = profile
    if (!p) return
    edit('kit:mine', (s) => withProfile(s, p))
    seal()
  }

  /**
   * The way back from "Use my kit".
   *
   * Undo was the only route to this, and Undo is the wrong tool for it: it is
   * the LAST move, so a coach who painted their kit on, then moved four
   * players, then decided the green read better had no way back that did not
   * also throw away the four players (user, 2026-08-27). This is a move of its
   * own — forwards, undoable, and unrelated to what else has happened since.
   *
   * `name` is kept. The club is who the board belongs to and this button is
   * about what colour it is drawn in; wiping "AEL Limassol U16" back to "Our
   * team" because somebody wanted the house green would be answering a
   * question nobody asked. The ring, the pattern and the second colour DO go —
   * they are the kit, and a half-reverted kit is the state this button exists
   * to get out of.
   */
  const useHouseColours = () => {
    edit('kit:house', (s) => ({
      ...s,
      teams: {
        ...s.teams,
        us: {
          ...s.teams.us,
          base: DEFAULT_US.base,
          deep: DEFAULT_US.deep,
          text: DEFAULT_US.text,
          ring: undefined,
          pattern: undefined,
          alt: undefined,
        },
      },
    }))
    seal()
  }

  const applyLabels = (mode: LabelMode) => {
    setLabels(mode)
    edit('labels', (s) => ({
      ...s,
      acts: s.acts.map((a) => ({
        ...a,
        tokens: [
          ...relabel(a.tokens.filter((t) => t.side === 'us'), usFormation, mode),
          ...relabel(a.tokens.filter((t) => t.side === 'them'), themFormation, mode),
        ],
      })),
    }))
    seal()
  }

  /**
   * One more counter, for a twelfth man or a shape that is not eleven a side.
   *
   * The id is checked against EVERY act, not just this one. A token id is the
   * identity that makes tweening work (see ../schema.ts), so reusing an id that
   * exists in another act would quietly weld the new counter to a player who
   * was removed from this one — and they would fly across the board on Play.
   */
  const addPlayer = (side: Side) => {
    edit('add-player', (s) => {
      const taken = new Set(s.acts.flatMap((a) => a.tokens.map((t) => t.id)))
      let n = 1
      while (taken.has(`${side}-X${n}`)) n++
      const id = `${side}-X${n}`
      return {
        ...s,
        acts: s.acts.map((a, i) =>
          i === actIndex
            ? { ...a, tokens: [...a.tokens, { id, x: 50, y: 50, label: String(n), side }] }
            : a,
        ),
      }
    })
    seal()
  }

  /**
   * Empty the whole thing and start again.
   *
   * Undoable like everything else, which is what lets the button be a button
   * rather than a modal with a warning triangle on it. The editor state that is
   * not in the document — which shape the pickers are showing, which tool is
   * armed — has to be put back by hand, or the panels would describe a board
   * that is no longer there.
   */
  const startOver = () => {
    edit('reset', () => newSystem())
    seal()
    setActIndex(0)
    setSelection(null)
    setTool('select')
    setPending(null)
    setPlayhead(null)
    setUsFormation('4-3-3')
    setThemFormation('4-4-2')
    setLabels('position')
  }

  /**
   * Open the share dialog, stamping the date the link was made.
   *
   * The date is set here rather than at encode time so it is part of the
   * document a coach can see and the autosave keeps — a link remade tomorrow
   * says tomorrow, which is what the credit line is claiming.
   */
  const openShare = () => {
    edit('share', (s) => ({
      ...s,
      credit: { ...s.credit, sharedOn: s.credit?.sharedOn ?? new Date().toISOString() },
    }))
    seal()
    setSharing(true)
  }

  const patchCredit = (patch: Partial<Credit>) => {
    edit('credit', (s) => ({ ...s, credit: { ...s.credit, ...patch } }))
  }

  /**
   * Keep the id the server published under.
   *
   * `replace`, not `edit`: this is the server telling us where the document
   * now lives, not something the coach did, and it has no business sitting in
   * their undo stack between two things they actually changed.
   */
  const rememberShareId = useCallback(
    (shareId: string) => replace((s) => (s.shareId === shareId ? s : { ...s, shareId })),
    [replace],
  )

  // ── act actions ────────────────────────────────────────────────────────────
  const addAct = () => {
    // A new act starts as a COPY of the current one. That is the whole authoring
    // model: you do not build a new board, you move the one you have, and the
    // difference between the two becomes the animation.
    edit('add-phase', (s) => {
      const src = s.acts[Math.min(actIndex, s.acts.length - 1)]
      /*
       * ── THE TITLE COMES ACROSS WITH EVERYTHING ELSE ──────────────────────
       *
       * `structuredClone` already carries it; there is no `title:` line here
       * because there is nothing to override it with. This used to stamp
       * "Phase 7" on the new one, and that was wrong in both directions at
       * once (user, 2026-08-28).
       *
       * Wrong when the coach had titled the phase, because a system is
       * normally several beats of ONE idea: three phases of "Pressing trap"
       * with the men in different places. Stamping a number over that threw
       * away the words they had typed and made them type them again, on every
       * phase, forever.
       *
       * Wrong when they had NOT titled it, because "Phase 7" is not a title,
       * it is a count — the strip under the board already numbers every
       * thumbnail, the phase panel says which of how many, and the film draws
       * it in the corner. Writing the number a fourth time, into the field
       * meant for the coach's own words, meant every board went out with a
       * heading that said nothing.
       *
       * So: empty stays empty, and words stay put until the coach changes
       * them. The one rule, and it holds for `duplicateAct` and for the phase
       * an arrow's two taps create as well.
       */
      const copy: Act = {
        ...structuredClone(src),
        id: uid('act'),
      }
      const acts = [...s.acts]
      acts.splice(actIndex + 1, 0, copy)
      return { ...s, acts }
    })
    seal()
    setActIndex((i) => i + 1)
    setSelection(null)
  }

  /**
   * Duplicate this phase, in place, keeping what it says.
   *
   * WHY THIS IS NOT JUST `addAct` WITH A DIFFERENT LABEL
   *
   * `addAct` also copies the current phase, but it copies it as the NEXT
   * MOMENT: it takes the number after the last one and calls itself "Phase 7",
   * because the thing a coach does with it is move somebody and let the
   * difference become the animation.
   *
   * A duplicate is a different intention. It is "keep this one as it is while I
   * try something", or "say this again with one more arrow showing" — a slow
   * reveal is literally the same board four times with a different arrow turned
   * up on each.
   *
   * It USED to append "(copy)". It does not any more, and the reason is that
   * `addAct` now carries the title across too: a suffix here would be the one
   * phase in the run wearing a mark the others do not, and every phase added
   * after it would inherit "(copy)" and carry it to the end of the deck. The
   * strip numbers the thumbnails, which is what tells two identical boards
   * apart; the title says what they are both about.
   *
   * `structuredClone` and a fresh act id, but the ids INSIDE are kept: token
   * ids are the join that makes movement work across phases (see ../tween.ts),
   * and a copy whose players were strangers to the phase before it would
   * animate as eleven men leaving and eleven arriving.
   */
  const duplicateAct = () => {
    edit('duplicate-phase', (s) => {
      const i = Math.min(actIndex, s.acts.length - 1)
      const src = s.acts[i]
      const copy: Act = {
        ...structuredClone(src),
        id: uid('act'),
        title: src.title,
      }
      const acts = [...s.acts]
      acts.splice(i + 1, 0, copy)
      return { ...s, acts }
    })
    seal()
    setActIndex((i) => i + 1)
    setSelection(null)
  }

  const deleteAct = () => {
    if (system.acts.length <= 1) return
    edit('delete-phase', (s) => ({ ...s, acts: s.acts.filter((_, i) => i !== actIndex) }))
    seal()
    setActIndex((i) => Math.max(0, i - 1))
    setSelection(null)
  }

  /** Reorder: this phase changes places with its neighbour. */
  const moveAct = (dir: -1 | 1) => {
    const to = actIndex + dir
    if (to < 0 || to >= system.acts.length) return
    edit('reorder', (s) => {
      const acts = [...s.acts]
      const [a] = acts.splice(actIndex, 1)
      acts.splice(to, 0, a)
      return { ...s, acts }
    })
    seal()
    setActIndex(to)
  }

  // ── selection editing ──────────────────────────────────────────────────────
  const patchToken = (patch: Partial<Token>, label: string) => {
    if (!selectedToken) return
    const id = selectedToken.id
    patchAct(`token:${label}`, (a) => ({
      ...a,
      tokens: a.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }

  const patchMark = (patch: Partial<Arrow>) => {
    if (!selectedMarkId) return
    patchAct('mark', (a) => ({
      ...a,
      arrows: a.arrows.map((x) => (x.id === selectedMarkId ? { ...x, ...patch } : x)),
    }))
  }

  /**
   * Change one field of the selected writing.
   *
   * `undefined` CLEARS a field rather than setting it, which is why every
   * control below passes `v || undefined` when a coach picks the house value.
   * A document that stores `size: 'm'` on every note has frozen today's default
   * into itself; one that stores nothing gets whatever the house style is when
   * it is next opened. Same policy the bands are on.
   */
  const patchText = (patch: Partial<TextMark>) => {
    if (!selectedMarkId) return
    patchAct('text-style', (a) => ({
      ...a,
      texts: (a.texts ?? []).map((x) => (x.id === selectedMarkId ? { ...x, ...patch } : x)),
    }))
  }

  /** Change one field of the selected gear. Same clearing policy as the text. */
  const patchGear = (patch: Partial<GearMark>, label = 'gear-style') => {
    if (!selectedMarkId) return
    patchAct(label, (a) => ({
      ...a,
      gear: (a.gear ?? []).map((g) => (g.id === selectedMarkId ? { ...g, ...patch } : g)),
    }))
  }

  /**
   * Put a piece of gear on the board.
   *
   * ── WHERE IT LANDS, AND WHY IT IS NOT WHERE YOU CLICKED ──────────────────
   *
   * The middle of the board, already selected, ready to be dragged — the same
   * bargain the ball is on, which is what was asked for. The alternative was to
   * arm the piece like a tool and place it on the next press of the grass,
   * which puts it exactly where they meant first time and costs a mode:
   * something to arm, something to cancel, and a press on the pitch that no
   * longer means what it means the rest of the time. Laying out a drill is six
   * or eight pieces, and six presses of one button beats six arm-and-place
   * cycles.
   *
   * Fanned off dead centre by how many are already down, so putting four cones
   * out does not stack four cones in one place — which reads as the button
   * having fired once.
   *
   * STEP is 7% of the crop, which is about 4.8m of grass — wider than every
   * piece in the catalogue except the ladder and the mini goal. At 3.5% they
   * came down overlapping each other, which is the bug this fan exists to
   * avoid rather than a smaller version of it. Five across, then a row down,
   * and it wraps rather than walking off the touchline.
   */
  const addGear = (kind: string) => {
    const piece = resolveGear(kind)
    if (!piece) return
    const id = uid('gr')
    const n = (act.gear ?? []).length
    const STEP = 7
    patchAct('gear:add', (a) => ({
      ...a,
      gear: [
        ...(a.gear ?? []),
        {
          id,
          kind,
          x: Math.min(92, Math.max(8, 50 + ((n % 5) - 2) * STEP)),
          y: Math.min(92, Math.max(8, 42 + (Math.floor(n / 5) % 3) * STEP)),
        },
      ],
    }))
    seal()
    setSelection({ kind: 'mark', id })
  }

  /**
   * Shade the space a side's deepest line is protecting.
   *
   * One block per side, replaced rather than stacked: two overlapping blocks for
   * the same back four is never what anybody meant, and the second one would
   * hide the first.
   */
  const addBlockBand = (side: Side) => {
    const line = backLine(act.tokens, side, view)
    if (line.length < 2) return
    patchAct('block', (a) => ({
      ...a,
      // Only the DERIVED block for this side is replaced. A block the coach
      // picked player by player survives, because this button did not make it
      // and has no business deciding it is finished with — see `drawn` in
      // ../schema.ts. Without that flag this filter took both, so pressing
      // Redraw silently deleted a hand-drawn midfield line.
      bands: [
        ...a.bands.filter((b) => !(b.kind === 'block' && !b.drawn && bandSide(b, a) === side)),
        { id: uid('bd'), kind: 'block' as BandKind, throughTokens: line.map((t) => t.id) },
      ],
    }))
    seal()
  }

  const blockFor = (side: Side) =>
    act?.bands.find((b) => b.kind === 'block' && !b.drawn && bandSide(b, act) === side)

  /**
   * Change one thing about the selected shaded area.
   *
   * `what` names the FIELD as well as the band, so ../history.ts collapses a
   * run of keystrokes in the label into one undo entry without also swallowing
   * the colour change that follows it. One label for the whole panel would make
   * a single Undo take back both, which is never what anybody meant.
   */
  const patchBand = (what: string, patch: Partial<Band>) => {
    if (!selectedMarkId) return
    patchAct(`band:${selectedMarkId}:${what}`, (a) => ({
      ...a,
      bands: a.bands.map((b) => (b.id === selectedMarkId ? { ...b, ...patch } : b)),
    }))
  }
  const usIsBlank = Boolean(FORMATION_BY_ID.get(usFormation)?.blank)
  const chosenPiece = SET_PIECE_BY_ID.get(setPieceId)
  // What is on THIS phase, for the drawer badges and the two "clear it" rows.
  // Counted here rather than at each use so the badge and the button can never
  // disagree about whether there is anything to clear.
  const gearHere = (act.gear ?? []).length
  const textsHere = (act.texts ?? []).length
  const ball = resolveBall(system.matchBall)
  const surface = resolveSurface(system.surface)
  const grid = resolveGrid(system.grid)
  const camera = resolveCamera(system.camera)
  const cameraMode = CAMERA_MODES.find((c) => c.id === camera) ?? CAMERA_MODES[0]
  const push = resolvePush(system.push)
  /*
   * Whether the board already wears the profile's kit.
   *
   * Compared case-insensitively on the four fields the kit actually is. It only
   * decides one line of type, so a false negative costs a coach one harmless
   * press of a button — which is why it is a plain comparison and not something
   * that has to resolve derived colours to be right.
   */
  const same = (a: string | undefined, b: string | undefined) =>
    (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
  /**
   * Whether our side is already in the house green, ring and pattern included.
   *
   * Read the same way `kitMatches` is, so the two lines under the buttons can
   * never both claim to be the current state.
   */
  const houseMatches =
    same(system.teams.us.base, DEFAULT_US.base) &&
    !system.teams.us.ring &&
    !system.teams.us.alt &&
    (system.teams.us.pattern ?? 'solid') === 'solid'

  const kitMatches =
    Boolean(myKit) &&
    same(system.teams.us.base, myKit) &&
    same(system.teams.us.ring, profile?.kitRing) &&
    same(system.teams.us.alt, profile?.kitAlt) &&
    same(system.teams.us.pattern ?? 'solid', profile?.kitPattern || 'solid')
  // Read out in metres of grass rather than as a zoom factor — see ../camera.ts.
  const frameWide = frameMetres(view, rendered.shot, tightest)
  const viewWide = viewMetres(view)
  const formationGroups = useMemo(
    () =>
      formationsByFamily().map((g) => ({
        label: g.family,
        options: g.formations.map((f) => ({ value: f.id, label: f.name })),
      })),
    [],
  )

  /**
   * How many of each side this view will actually place, and whether that is
   * fewer than eleven.
   *
   * Said out loud under the pitch picker, because a coach who presses Re-place
   * shapes on "their box" and gets six players needs to know that was the tool
   * fitting the shape to the crop, not the tool losing five of their players.
   */
  const cast = useMemo(() => {
    const f = FORMATION_BY_ID.get(usFormation)
    const t = FORMATION_BY_ID.get(themFormation)
    const us = f ? castFor(f, 'us', system.pitch).length : 11
    const them = t ? castFor(t, 'them', system.pitch).length : 11
    const partial = (f ? us < f.slots.length : false) || (system.teams.them && t ? them < t.slots.length : false)
    return { us, them, partial }
  }, [usFormation, themFormation, system.pitch, system.teams.them])

  const railDone = useMemo(
    () =>
      RAIL_STEPS.reduce(
        (acc, s) => {
          acc[s.id] = guide[s.id]
          return acc
        },
        {} as Record<RailStep['id'], boolean>,
      ),
    [guide],
  )

  /**
   * Players who are in the document but not on screen.
   *
   * Changing to a tighter view is deliberately non-destructive — everyone stays
   * on the patch of grass the coach put them on, and those outside the new crop
   * reappear when it widens (see `setPitch`). Correct, and completely baffling
   * from the outside: pick "Their box" from a full-pitch 4-3-3 and ten players
   * silently vanish. So say it, and say what to do about it.
   */
  const offCrop = act ? act.tokens.filter((t) => t.x < -2 || t.x > 102 || t.y < -2 || t.y > 102).length : 0

  if (!act) return null

  if (tooSmall) {
    return (
      <SmallScreen
        onContinue={() => {
          markGuide({ smallOk: true })
          setTooSmall(false)
          // Picks the chain back up where it left off, so a coach who came in
          // through the door still gets whichever of the two was owed to them.
          if (!guideRef.current.seen) setWalkthrough(true)
          else if (!guideRef.current.upgradesSeen) setUpgradesWalkthrough(true)
          else if (guideRef.current.newsSeen !== NEWEST_NEWS_ID) openNews()
        }}
      />
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // The pieces. Built once, arranged twice — see the note at the top of the
  // file. Anything that reads differently between the two layouts is a bug.
  // ────────────────────────────────────────────────────────────────────────────

  const toolbar = (
    <header className="flex shrink-0 items-center gap-2 border-b border-ink-hair bg-surface px-3 py-2.5 lg:gap-3 lg:px-4">
      {/* The title is a field a coach types in and, on a locked board, the
          name of a published system — so it is read as a heading there rather
          than dressed as an input nobody may use. */}
      {/* NOT `inert` when locked — there is nothing to intercept on a heading,
          and greying it would dim the name of the system as well as the field
          it replaced. This is the one piece of the top bar that is content. */}
      {/*
        The name of the system, and where it goes when there is no room for it.
        See also the locked branch of `boardLine`, which is the other half of
        this and must be read with it.

        On a phone this bar is already carrying six tool names, Play, Share,
        Video and the sign-in pill. `flex-1` is `grow-1 shrink-1 basis-0%`, so
        the title asks for no width of its own and gets whatever is left, which
        there is not: it truncates to two characters and an ellipsis, which is
        worse than absent. That is survivable on a coach's own board — the field
        is usually empty and they know what they are building — and not here,
        where the name IS the page.

        So on the stacked layout the locked title comes off the bar entirely and
        goes under the board instead, where there is a whole line for it and
        where the reader is already looking.
      */}
      <div className={locked && stacked ? 'hidden' : 'min-w-0 flex-1'} {...(locked ? {} : inert)}>
        {locked ? (
          <h1 className="truncate text-sm font-black tracking-display text-ink">{system.title}</h1>
        ) : (
          <Tip text={HINT.title} title="Name of this system" side="bottom" help="title">
            <input
              value={system.title}
              onChange={(e) => edit('title', (s) => ({ ...s, title: e.target.value }))}
              placeholder="Name your system…"
              aria-label="Name of this system"
              className="w-full max-w-sm bg-transparent text-sm font-black tracking-display text-ink outline-none placeholder:text-ink-faint"
            />
          </Tip>
        )}
      </div>

      {/* Undo and redo are the one greyed pair with nothing to sell. There is
          no history on a board that cannot be changed, so they come off
          entirely rather than sitting there permanently dimmed. */}
      {!locked && (
        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-paper p-1">
          <Tip text={HINT.undo} title="Undo" side="bottom">
            <Button onClick={undo} disabled={!history.canUndo} className="!px-2" aria-label="Undo">
              <Arc dir="left" />
            </Button>
          </Tip>
          <Tip text={HINT.redo} title="Redo" side="bottom">
            <Button onClick={redo} disabled={!history.canRedo} className="!px-2" aria-label="Redo">
              <Arc dir="right" />
            </Button>
          </Tip>
        </div>
      )}

      {/* The mark vocabulary. Scrolls rather than wraps on a narrow screen, so
          the board never gets pushed off the bottom by a second row. */}
      {/* The tool rail is the single most valuable thing on a locked board.
          It is the vocabulary — Move, Pass, Run, Carry, Press, Switch — and
          reading it is most of understanding what the studio does, which is why
          it stays on screen greyed rather than being taken away. */}
      {/*
       * `lg:shrink-0`, and it is a bug fix rather than a tidy.
       *
       * The rail was `min-w-0 … overflow-x-auto` next to a title on `flex-1`,
       * which makes the RAIL the thing that gives way when the bar runs out of
       * room. It gives way silently — there is no scrollbar on a trackpad — so
       * the last button in it just is not there, and the last button in it is
       * Text. That is why the writing tool could not be found on a laptop
       * (user, 2026-08-27): it was off the right-hand edge of a strip nothing
       * said could be scrolled.
       *
       * On a wide screen the rail now holds its full width and the TITLE gives
       * way instead, which it is built to do — it truncates, and a truncated
       * name of a system you are looking at is a much cheaper loss than a tool
       * you cannot see. Below `lg` it still scrolls, because on a phone there
       * genuinely is not room and scrolling is the honest answer.
       */}
      <div
        className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg bg-paper p-1 lg:shrink-0 lg:overflow-visible"
        {...inert}
      >
        {(['select', ...TWO_POINT_TOOL_IDS] as Tool[]).map((id) => (
          <Tip key={id} text={<ToolText id={id} />} title={TOOL_DOC[id].label} side="bottom" help={`tool:${id}`}>
            <Button active={tool === id} onClick={() => setTool(id)} className="!px-2 lg:!px-2.5">
              {TOOL_DOC[id].label}
            </Button>
          </Tip>
        ))}
        {/* Text sits at the end of the rail with the arrows rather than down in
            a panel, because it is a MARK a coach adds to a phase, and the rail
            is where they already look for those. Behind a rule, because it is
            not an arrow: everything to the left of the line is drawn between
            two points, and this is words at one. It also has a door in the
            panel — see the Writing panel in `setupPanel`. */}
        <span className="mx-0.5 h-5 w-px shrink-0 bg-ink-hair" aria-hidden="true" />
        <Tip text={<ToolText id={TEXT_TOOL_ID} />} title={TOOL_DOC[TEXT_TOOL_ID].label} side="bottom" help={`tool:${TEXT_TOOL_ID}`}>
          <Button
            active={tool === TEXT_TOOL_ID}
            onClick={() => setTool(TEXT_TOOL_ID)}
            className="!px-2 lg:!px-2.5"
          >
            {TOOL_DOC[TEXT_TOOL_ID].label}
          </Button>
        </Tip>
      </div>

      {/* The hints stay on every greyed control, and that is deliberate: only
          the press is intercepted, never the hover, so reading what Pass or
          Share or Video does is the one thing a stranger CAN do with them. It
          is most of what this page is for.

          These two are the exception that has to be rewritten rather than
          reused. "Stop and go back to editing" is addressed to somebody who was
          editing, and "you need two phases before there is anything to watch"
          is advice to somebody building one. Both are wrong in the same way
          here: they describe a job the reader does not have. */}
      <Tip
        text={
          locked
            ? playing
              ? 'Stop the film and hold on this moment.'
              : `Runs all ${system.acts.length} ${PHASE.many} in order, at the pace this system was filmed at.`
            : playing
              ? HINT.stop
              : HINT.play
        }
        title={playing ? 'Stop' : 'Play'}
        side="bottom"
        help="play"
      >
        <Button
          variant="solid"
          onClick={() => {
            if (!playing) markGuide({ played: true })
            setPlayhead(playing ? null : 0)
          }}
          disabled={system.acts.length < 2}
        >
          {playing ? 'Stop' : 'Play'}
        </Button>
      </Tip>

      {/* Share and Video say what a coach walks out of here with: a link, and
          a film. Both greyed, both doors. */}
      <div className="flex shrink-0 items-center gap-2 lg:gap-3" {...inert}>
        <Tip text={HINT.share} title="Share" side="bottom" help="share">
          <Button onClick={openShare}>Share</Button>
        </Tip>

        <Tip text={HINT.video} title="Video" side="bottom" help="video">
          <Button onClick={() => setMakingVideo(true)}>Video</Button>
        </Tip>

        {/* Images and the PDF. Up here with Share and Video rather than down a
            panel, because it is the third thing a coach walks out of here with
            and it was the one you could not reach without publishing first. */}
        <Tip text={HINT.export} title="Images and PDF" side="bottom" help="export">
          <Button onClick={() => setExporting(true)}>Export</Button>
        </Tip>
      </div>

      {/*
       * Only ever says that the work HAS landed. A coach cannot act on "could
       * not reach the server", their work is already safe on this machine
       * either way, and a warning they cannot do anything about mid-drag is
       * just noise — see ../account/sync.ts.
       *
       * On a locked board the slot can never fill, because nothing is being
       * saved — so the sign-in pill takes it. See ./SignInWall.tsx.
       */}
      {locked ? (
        <SignInPill />
      ) : (
        <>
          {(cloud === 'saving' || cloud === 'saved') && (
            <span className="hidden shrink-0 text-[11px] font-bold text-ink-faint lg:inline">
              {cloud === 'saving' ? 'Saving…' : 'Saved'}
            </span>
          )}
          {/*
            * The one sync state that is NOT quiet, and it is shown on every
            * width rather than `lg:` only. A coach whose changes have stopped
            * being saved has to be told on a phone as much as on a desktop —
            * more, since the phone is the likelier second window. See the
            * `conflict` note in ../account/sync.ts.
            */}
          {cloud === 'conflict' && (
            <span
              role="status"
              className="shrink-0 rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400"
            >
              Open in another window — reload to get the newest
            </span>
          )}
        </>
      )}

      {/* The theme is the one setting on this bar that belongs to the READER
          rather than to the document, so it stays live on a locked board.
          Somebody watching a system on a bright train platform is allowed to
          turn the lights on. */}
      {/* Wrapped only to give the help panel something to ring: this button is
          the one control on the bar with no Tip round it, because what it does
          is visible the instant it is pressed. */}
      <span data-help="theme" className="inline-flex">
        <ThemeToggle />
      </span>

      {/* Both of these are about a coach's own history with the studio: what
          has changed since they were last here, and a tour of controls that are
          switched off. Neither means anything to a stranger. */}
      {!locked && (
        <>
          <Tip text={HINT.news} title={NEWS.title} side="bottom">
            <NewsBell
              open={news}
              unread={newsUnread}
              onOpen={openNews}
              onClose={() => setNews(false)}
            />
          </Tip>

          <Tip text={HINT.help} title="Help" side="bottom" help="help">
            <Button
              onClick={() => setHelp((open) => !open)}
              active={help}
              className="!px-2"
              aria-label="Search the studio for help"
              aria-expanded={help}
            >
              ?
            </Button>
          </Tip>
        </>
      )}
    </header>
  )

  /*
   * The board itself is intercepted rather than greyed.
   *
   * `inert` here takes the pointer handlers and leaves the pixels alone — see
   * the `data-locked` rule in ../../styles/global.css, which exempts the board.
   * Dimming the one thing a stranger came to look at would be an odd way to
   * show it to them; the greying is for the CONTROLS around it, and the board
   * stays at full strength and plays at full strength.
   *
   * The interception still matters even though `edit` already refuses
   * everything: without it, grabbing a player would arm a gesture, put the
   * marching-ants ring on a counter and swallow the press, so the board would
   * look alive and do nothing. With it, the first touch on the grass raises the
   * sheet, which is the answer somebody reaching for a player is owed.
   */
  const boardStage = (
    <div
      ref={boardContainerRef}
      className="tf-board relative min-h-0 max-h-full max-w-full overflow-hidden rounded-xl shadow-lift"
      style={{ aspectRatio: aspect(view), height: '100%' }}
      {...inert}
    >
      <div 
        style={{
          transform: `translate(${workspacePan.x}px, ${workspacePan.y}px) scale(${workspaceZoom})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%',
          willChange: 'transform',
        }}
      >
      <Board
        svgRef={svgRef}
        system={system}
        act={rendered}
        idp="studio"
        mode={boardMode}
        photoHrefs={photoHrefs}
        /* Wide while posing with the shot outlined on top; the real push-in
           happens on Play. See `showFrame` in ../board/Board.tsx. */
        showFrame={!playing}
        /* Withheld while a drawing tool is armed, for the same reason marks
           are: a coach dragging out a zone across the frame's edge must not
           have the camera grab the gesture instead. */
        onFramePointerDown={playing || drawing ? undefined : beginFrameDrag}
        /* The snap target wins while an arrow end is in the air: it is the
           counter the coach is acting on, and it is the one thing on the board
           that tells them the end is about to attach rather than land. */
        activeTokenId={
          snapId ??
          actor ??
          (dragging && dragging.kind === 'token' ? dragging.id : (selectedToken?.id ?? null))
        }
        activeMarkId={selectedMarkId}
        onTextChange={(id, text) => { if (selectedMarkId === id) patchText({ text }) }}
        onTextScaleDown={beginTextScale}
        /* Counters stay live while the Block tool is armed — that tool IS
           clicking counters — and a click on one picks it for the line instead
           of starting a drag. Every other drawing tool takes them away. */
        onTokenPointerDown={
          playing || dragging_tool
            ? undefined
            : (id, e) => {
                if (isPickTool(tool)) {
                  e.stopPropagation()
                  e.preventDefault()
                  pickForBlock(id)
                  return
                }
                if (isArrowTool(tool)) {
                  // Not a drag of the player: the same press-and-pull the grass
                  // gets, told which counter it started on. Releasing without
                  // travelling is the tap that arms or fires the action.
                  e.stopPropagation()
                  beginDraw(e, id)
                  return
                }
                setSelection({ kind: 'token', id })
                beginDrag({ kind: 'token', id }, e)
              }
        }
        /* Marks are only pickable with the Move tool: a drawing tool has to be
           able to start a new mark on top of one that is already there. */
        onArrowPointerDown={
          playing || drawing
            ? undefined
            : (id, e) => {
                e.stopPropagation()
                /* Pressing an arrow that is already selected starts moving it;
                   pressing an unselected one only selects it. Otherwise the
                   click that picks a mark out of a crowded phase also nudges
                   it, and a coach cannot select without editing. */
                if (selectedMarkId === id) beginArrowDrag(id, 'move', e)
                else setSelection({ kind: 'mark', id })
              }
        }
        /* Handles on the selected arrow only, and only with the Move tool —
           the same bargain the zone's grips are on. */
        onArrowGripPointerDown={playing || drawing ? undefined : beginArrowDrag}
        onBandPointerDown={
          playing || drawing
            ? undefined
            : (id, e) => {
                e.stopPropagation()
                setSelection({ kind: 'mark', id })
              }
        }
        /* The same bargain the arrow is on: the first press selects, the second
           moves. On writing it matters more than anywhere else, because a text
           mark's hit box is the whole block of words — the biggest target on
           the board — and a coach clicking one to edit it must not find they
           have shifted it half a metre in the process. */
        onTextPointerDown={
          playing || drawing
            ? undefined
            : (id, e) => {
                e.stopPropagation()
                if (selectedMarkId === id) beginTextDrag(id, e)
                else setSelection({ kind: 'mark', id })
              }
        }
        /* Gear is on the same first-press-selects bargain as the writing, and
           needs it just as much: a mannequin is a big opaque target sitting
           under the players, and a coach clicking one to turn it must not find
           they have walked it two metres up the pitch. */
        onGearPointerDown={
          playing || drawing
            ? undefined
            : (id, e) => {
                e.stopPropagation()
                if (selectedMarkId === id) beginGearDrag(id, e)
                else setSelection({ kind: 'mark', id })
              }
        }
        /* Handles on the selected area only, and only with the Move tool. */
        onZonePointerDown={playing || drawing ? undefined : beginZoneDrag}
        onBallPointerDown={
          playing || drawing
            ? undefined
            : (id, e) => {
                setSelection({ kind: 'mark', id })
                beginDrag({ kind: 'ball', id }, e)
              }
        }
        onBackgroundPointerDown={(e) => {
          if (playing) return
          if (isPickTool(tool)) {
            // Pressing the grass finishes the line, the way pressing the grass
            // finishes a polygon in every drawing tool anybody has used. Under
            // two players it cancels instead; `commitBlockPick` decides which,
            // so the rule lives in one place rather than in every caller.
            e.preventDefault()
            commitBlockPick()
            return
          }
          if (!drawing) {
            setSelection(null)
            // Pressing the grass is a deselect, never the start of a text
            // selection dragged across the board.
            e.preventDefault()
            return
          }
          beginDraw(e)
        }}
      />
      </div>

      {/* Zoom UI Overlay */}
      <div 
        data-help="zoom"
        className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-ink/90 p-1 text-paper shadow backdrop-blur-sm transition-opacity"
        style={{ opacity: playing ? 0 : 1, pointerEvents: playing ? 'none' : 'auto', zIndex: 50 }}
      >
        <button
          onClick={() => zoomBy(1 / 1.25)}
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-white/20 active:bg-white/30"
          title="Zoom out"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/></svg>
        </button>
        <span className="w-12 text-center text-[11px] font-bold tracking-wider">
          {Math.round(workspaceZoom * 100)}%
        </span>
        <button
          onClick={() => zoomBy(1.25)}
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-white/20 active:bg-white/30"
          title="Zoom in"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14m-7-7h14"/></svg>
        </button>
        {workspaceZoom !== 1 && (
          <>
            <div className="mx-1 h-4 w-px bg-white/20" />
            <button
              onClick={resetZoom}
              className="mr-0.5 flex h-7 w-7 items-center justify-center rounded hover:bg-white/20 active:bg-white/30"
              title="Reset zoom"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </>
        )}
        <div className="mx-1 h-4 w-px bg-white/20" />
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              boardContainerRef.current?.requestFullscreen?.();
            } else {
              document.exitFullscreen?.();
            }
          }}
          className="mr-0.5 flex h-7 w-7 items-center justify-center rounded hover:bg-white/20 active:bg-white/30"
          title="Toggle full screen"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>
      </div>
    </div>
  )

  /*
   * The line under the board. This is the highest-value piece of guidance in
   * the studio, because it is the only one in the place a coach is already
   * looking. It says what to do next, in context: how to use the tool they just
   * picked, what they have selected, or that one phase does not animate and why.
   */
  const boardLine = (
    <p className="shrink-0 px-3 text-center text-[11px] leading-snug text-ink-faint">
      {locked ? (
        /*
         * The line under the board is the most-read guidance in the studio,
         * because it is in the only place a coach is already looking. Every
         * sentence it normally carries tells somebody what to DO next, which on
         * a locked board is a sentence about a thing they cannot do — the
         * default is "Move the players to where they finish, then press Play",
         * addressed to a stranger who cannot move a player. So it says what IS
         * true here instead, in the same voice: which phase, out of how many,
         * and the two controls that work.
         */
        <>
          {/* The title, on the layout that had to give it up. See the toolbar. */}
          {stacked && <span className="font-black tracking-display text-ink">{system.title} · </span>}
          <span className="font-bold text-ink">
            {PHASE.One} {Math.min(actIndex, system.acts.length - 1) + 1} of {system.acts.length}
            {act?.title ? `: ${act.title}` : ''}.
          </span>{' '}
          Press Play to watch it run, or pick a {PHASE.one} below to jump to it.
        </>
      ) : isPickTool(tool) ? (
        // Its own branch above the generic drawing one, because this tool has a
        // running state and the useful sentence is a count: how many are in the
        // line so far, and what the next press does.
        <>
          <span className="font-bold text-ink">
            {blockPick.length === 0
              ? 'Click the first player in the line.'
              : `${blockPick.length} ${blockPick.length === 1 ? 'player' : 'players'} picked.`}
          </span>{' '}
          {blockPick.length >= 2
            ? 'Press Enter to draw it, keep clicking to add more, or click a player again to take them out.'
            : blockPick.length === 1
              ? 'Click the next one along. A block needs at least two.'
              : HINT.blockPicking}
        </>
      ) : isActionTool(tool) ? (
        // Its own branch above the generic drawing one, for the same reason the
        // Block tool has one: this tool has a running state, and the useful
        // sentence is which of the two taps the coach is on. NOT `isArrowTool`:
        // the line has no two taps to be part-way through, so it falls to the
        // generic branch below and gets `TOOL_DOC.line.drag`, which is the
        // sentence that is actually true of it.
        <>
          <span className="font-bold text-ink">{actor ? ACTION.aim[tool] : ACTION.arm[tool]}</span>{' '}
          {actor ? ACTION.armed : ACTION.also}
        </>
      ) : drawing ? (
        <>
          <span className="font-bold text-ink">{TOOL_DOC[tool].drag}</span> {TOOL_DOC[tool].when}
        </>
      ) : playing ? (
        <>
          Playing all {system.acts.length} {PHASE.many}.
        </>
      ) : selectedArrow ? (
        <>
          <span className="font-bold text-ink">{markName(selectedArrow, act)} selected.</span> Drag its ends onto
          counters, drag the middle to bow it, or press Delete to take it off.
        </>
      ) : selectedText ? (
        <>
          <span className="font-bold text-ink">Writing selected.</span> Type in the panel, drag the words to move
          them, or press Delete to take them off.
        </>
      ) : selectedBand ? (
        // Its own sentence now that a shaded area has controls of its own.
        // "Bend it" was arrow language borrowed for want of anything better to
        // say, and it named the one thing a band has never been able to do.
        <>
          <span className="font-bold text-ink">{markName(selectedBand, act)} selected.</span>{' '}
          {selectedBand.kind === 'block'
            ? 'Choose what it shades on the right, the goal behind them or the space around them, or drag any of the players it runs through to reshape it.'
            : 'Drag inside it to move it, take a gold corner to resize it, or change its colour and shape on the right.'}
        </>
      ) : offCrop > 0 ? (
        <>
          <span className="font-bold text-ink">
            {offCrop} {offCrop === 1 ? 'player is' : 'players are'} outside this view.
          </span>{' '}
          They are still in your system: widen the pitch view to see them again, or press Re-place shapes to fit
          everyone inside it.
        </>
      ) : system.acts.length < 2 ? (
        <>
          <span className="font-bold text-ink-soft">
            {PHASE.One} {actIndex + 1} of {system.acts.length}.
          </span>{' '}
          One {PHASE.one} is a still picture. Add a second below and move someone, and it becomes a move.
        </>
      ) : (
        <>
          <span className="font-bold text-ink-soft">
            {PHASE.One} {actIndex + 1} of {system.acts.length}
            {act.title ? `: ${act.title}` : ''}.
          </span>{' '}
          Move the players to where they finish, then press Play.
        </>
      )}
    </p>
  )

  /*
   * The phase strip: navigation on the left of it, reordering on the right.
   *
   * These two used to be one pair of arrows that reordered, and every coach who
   * met them read them as "next phase" — reasonably, since they sit under a row
   * of thumbnails. They are now separated by the strip itself, the navigation
   * pair is unlabelled chevrons where a carousel would put them, and the
   * reordering pair says the word "Move".
   */
  const stripHeight = STRIP_HEIGHTS[stripSize][stacked ? 'stacked' : 'wide']
  /** What that height comes out as across, on this pitch. Decides the caption. */
  const thumbWidth = stripHeight * aspect(view)

  const cycleStrip = () => {
    const next = STRIP_SIZES[(STRIP_SIZES.indexOf(stripSize) + 1) % STRIP_SIZES.length]
    setStripSize(next)
    writeStripSize(next)
  }

  const phaseStrip = (
    <footer
      data-help="phaseStrip"
      className="flex shrink-0 select-none items-center gap-2 border-t border-ink-hair bg-surface px-2 py-2 lg:gap-3 lg:px-4 lg:py-3"
    >
      <Tip text={HINT.prevPhase} title={`Previous ${PHASE.one}`} side="top">
        <Button
          onClick={() => goToPhase(actIndex - 1)}
          disabled={actIndex === 0}
          className="!px-2"
          aria-label={`Go to the previous ${PHASE.one}`}
        >
          <Chevron dir="left" />
        </Button>
      </Tip>

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        {system.acts.map((a, i) => (
          <button
            key={a.id}
            type="button"
            onClick={() => goToPhase(i)}
            className={`group relative shrink-0 overflow-hidden rounded-md border-2 bg-paper transition ${
              i === (timeline?.index ?? actIndex) ? 'border-gold' : 'border-ink-hair hover:border-ink-faint'
            }`}
            /*
             * HEIGHT, and the width follows the pitch's aspect.
             *
             * Sizing by width made the strip's height a function of the pitch
             * view: about 62px on a landscape board and about 148px on the
             * upright one, so the view that most needs vertical room for the
             * board was the one the strip took most of it from (user,
             * 2026-08-27). Fixing the height instead costs the same footer on
             * every view, and the upright thumbnails simply get narrow — which
             * is what an upright pitch looks like.
             */
            style={{ height: stripHeight, aspectRatio: aspect(view) }}
            title={`${PHASE.One} ${i + 1}${a.title ? `: ${a.title}` : ''}`}
          >
            {/* No system, so no camera: a thumbnail is for finding a phase by
                its shape, which a push-in would crop away. */}
            <Board
              system={system}
              act={resolveAct(a)}
              idp={`thumb-${a.id}`}
              photoHrefs={photoHrefs}
            />
            {/*
              The number always; the title only when there is width for a
              readable amount of it.

              It used to be `{i + 1}. {a.title}` unconstrained, which wrapped to
              three or four lines and covered half the picture it was labelling
              — and the picture is the whole reason a coach looks at this strip.
              An upright thumbnail is about 50 points wide, where two truncated
              words are worse than none: the `title` attribute and the line
              under the board both carry the full text.
            */}
            <span className="absolute bottom-0 left-0 right-0 truncate bg-ink/75 px-1 py-0.5 text-[10px] font-bold leading-tight text-paper">
              {i + 1}
              {a.title && thumbWidth >= 96 ? `. ${a.title}` : ''}
            </span>
          </button>
        ))}
        <span {...inert}>
          <Tip text={HINT.addPhase} title={`Add ${PHASE.one}`} side="top" help="addPhase">
            <Button onClick={addAct} variant={system.acts.length < 2 ? 'solid' : 'ghost'}>
              + Add {PHASE.one}
            </Button>
          </Tip>
        </span>
      </div>

      <Tip text={HINT.nextPhase} title={`Next ${PHASE.one}`} side="top">
        <Button
          onClick={() => goToPhase(actIndex + 1)}
          disabled={actIndex >= system.acts.length - 1}
          className="!px-2"
          aria-label={`Go to the next ${PHASE.one}`}
        >
          <Chevron dir="right" />
        </Button>
      </Tip>

      {/*
        How big the strip is, and it is OUTSIDE `inert`.

        Changing it changes nothing about the system — it is the same decision
        as scrolling — so it stays pressable on a locked board, and it is the
        one control down here a stranger on a phone has as much use for as the
        author does. One button that cycles rather than three that do not fit:
        the strip's whole complaint is that it is taking room from the board,
        and answering it with 70 points of segmented control would be a joke.
      */}
      <Tip
        text="How tall the row of phases is. Smaller gives the board more room, which is worth having on the upright pitch. It is remembered for every board you open."
        title="Strip size"
        side="top"
      >
        <Button
          onClick={cycleStrip}
          className="!px-2"
          aria-label={`The row of phases is ${STRIP_LABELS[stripSize].toLowerCase()}. Press to change it.`}
        >
          <StripGlyph size={stripSize} />
          <span className="hidden lg:inline">{STRIP_LABELS[stripSize]}</span>
        </Button>
      </Tip>

      {/*
        Reordering and deleting. The thumbnails to their left and the two
        chevrons around them stay live on a locked board — stepping between
        phases is the whole of what a stranger is here to do — and only this
        group, which changes the film rather than watching it, is greyed.

        AND ON A PHONE IT IS NOT THERE AT ALL. Greying a control costs nothing on
        a desktop, where there is room for both it and the strip. In 390 points
        it costs about 40% of the strip, so a reader gets one and a half phases
        of thirteen to scroll through and the space goes to three buttons nobody
        may press. The rule the rest of this file follows is that a switched-off
        control stays because reading it sells the tool; it does not survive
        taking the working control's room away.
      */}
      <div
        className={`${locked && stacked ? 'hidden' : 'flex'} shrink-0 items-center gap-1 border-l border-ink-hair pl-2`}
        {...inert}
      >
        <Tip text={HINT.movePhaseBack} title="Move earlier" side="top">
          <Button
            onClick={() => moveAct(-1)}
            disabled={actIndex === 0 || system.acts.length < 2}
            aria-label={`Move this ${PHASE.one} earlier in the order`}
          >
            ↤ Move
          </Button>
        </Tip>
        <Tip text={HINT.movePhaseOn} title="Move later" side="top">
          <Button
            onClick={() => moveAct(1)}
            disabled={actIndex === system.acts.length - 1 || system.acts.length < 2}
            aria-label={`Move this ${PHASE.one} later in the order`}
          >
            Move ↦
          </Button>
        </Tip>
        {/* Between reordering and deleting, because it is the same class of
            thing they are: what this phase IS in the running order, rather
            than what is drawn on it. */}
        <Tip text={HINT.copyPhase} title={`Duplicate ${PHASE.one}`} side="top">
          <Button onClick={duplicateAct} aria-label={`Make a copy of this ${PHASE.one}`} className="!px-2">
            ⧉<span className="hidden lg:inline">Copy</span>
          </Button>
        </Tip>
        <Tip text={HINT.deletePhase} title={`Delete ${PHASE.one}`} side="top">
          <Button variant="danger" onClick={deleteAct} disabled={system.acts.length <= 1}>
            Delete
          </Button>
        </Tip>
      </div>
    </footer>
  )

  // ── the setup panel (left on a wide screen) ────────────────────────────────
  const setupPanel = (
    <>
      {/*
        ── THE RAIL, IN DRAWERS ────────────────────────────────────────────

        Fourteen panels in one column is a rail you scroll rather than read,
        and a control you scroll past is a control nobody finds — which is
        exactly what happened to the writing and to half of the camera (user,
        2026-08-27). Six named drawers turns "find the pitch surface" into one
        decision instead of twelve.

        The three a coach touches on every board open by default: what the
        board IS, who is on it, and what is on this phase. Equipment, the film
        and the destructive one start shut, and `Section` remembers whatever
        the coach does about that. See ./ui.tsx.
      */}

      <Section
        title={DRAWER.board}
        hint="Pitch view, set pieces, surface, camera"
        defaultOpen
        badge={view.label}
      >
        <Panel title="Pitch view">
          <Tip text={HINT.pitchView} title="Pitch view" block>
            <Select
              value={system.pitch}
              onChange={setPitch}
              options={PITCH_VIEW_LIST.map((v) => ({ value: v.id, label: v.label }))}
            />
          </Tip>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            <span className="text-ink-soft">{view.hint}</span> {view.useFor}
          </p>
          {cast.partial && (
            <Tip text={HINT.pitchFit} title="Who fits on this view" block>
              <p className="mt-2 rounded-md bg-paper px-2 py-1.5 text-[11px] leading-snug text-ink-faint">
                A shape placed here puts on{' '}
                <span className="font-bold text-ink-soft">{cast.us} of yours</span>
                {system.teams.them ? (
                  <>
                    {' '}
                    and <span className="font-bold text-ink-soft">{cast.them} of theirs</span>
                  </>
                ) : null}
                . This part of the pitch cannot hold a full team.
              </p>
            </Tip>
          )}
        </Panel>

        <Panel title="Set pieces">
          <Tip text={HINT.setPiece} title="Set pieces" block>
            <Select
              value={setPieceId}
              onChange={applySetPiece}
              options={[
                { value: '', label: 'Choose a set piece\u2026' },
                ...SET_PIECES.map((p) => ({ value: p.id, label: p.label })),
              ]}
            />
          </Tip>
          {chosenPiece && !themHere && (
            <p className="mt-2 rounded-md bg-paper px-2 py-1.5 text-[11px] leading-snug text-ink-faint">
              Only your side is on this {PHASE.one}, so only your side has been placed. A dead ball is an argument
              between two teams: turn <span className="font-bold text-ink-soft">The other team</span> on under Teams
              and kit and pick the set piece again to get theirs.
            </p>
          )}
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            {chosenPiece ? (
              <>
                <span className="text-ink-soft">{chosenPiece.family}.</span> {chosenPiece.hint}
              </>
            ) : (
              <>
                <span className="text-ink-soft">Turns the board upright with the goal at the top</span> and puts
                everybody on their marks. It moves the players you already have, so their names and faces come with
                them. This {PHASE.one} only.
              </>
            )}
          </p>
        </Panel>

        <Panel title="Markings">
          <Tip text={HINT.pitchGrid} title="Markings" block>
            <Select
              value={system.grid ?? 'none'}
              onChange={(id: string) => {
                edit('grid', (s) => ({ ...s, grid: id }))
                seal()
              }}
              options={PITCH_GRID_LIST.map((g) => ({ value: g.id, label: g.label }))}
            />
          </Tip>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            <span className="text-ink-soft">{grid.hint}</span> {grid.useFor}
          </p>
        </Panel>

        <Panel title="Pitch">
          <Tip text={HINT.surface} title="What the pitch is drawn on" block>
            <SurfacePicker
              label="Pitch"
              value={system.surface ?? DEFAULT_SURFACE}
              onChange={(id: PitchSurfaceId) => {
                edit('surface', (s) => ({ ...s, surface: id }))
                seal()
              }}
              items={PITCH_SURFACES.map((s) => ({ value: s.id, label: s.name, palette: s.palette }))}
            />
          </Tip>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            <span className="font-bold text-ink-soft">{surface.name}.</span> {surface.story}
          </p>
        </Panel>

        <Panel title="Camera">
          <Tip text={HINT.camera} title="How the film is shot" block>
            <Segmented
              label="Camera"
              value={camera}
              onChange={(id: CameraMode) => {
                edit('camera', (s) => ({ ...s, camera: id }))
                seal()
              }}
              options={CAMERA_MODES.map((c) => ({ value: c.id, label: c.label }))}
            />
          </Tip>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            <span className="font-bold text-ink-soft">{cameraMode.label}.</span> {cameraMode.hint}
          </p>
          {camera === 'follow' && (
            <>
              {/*
               * HOW FAR it goes, under WHETHER it goes. Two controls rather than
               * five modes: "does the eye move" and "how close does it get" are
               * different questions, and a coach who wants a calmer film should
               * not have to find it under a heading that says Fixed.
               */}
              <div className="mt-3 border-t border-ink-hair pt-3">
                <Field label="How far it pushes in">
                  <Segmented
                    label="How far it pushes in"
                    value={push.id}
                    onChange={(id: CameraPush) => {
                      edit('push', (s) => ({ ...s, push: id }))
                      seal()
                    }}
                    options={CAMERA_PUSHES.map((c) => ({ value: c.id, label: c.label }))}
                  />
                </Field>
                <p className="-mt-1 text-[11px] leading-snug text-ink-faint">{push.hint}</p>
              </div>

              <p className="mt-2 text-[11px] leading-snug text-ink-faint">
                {rendered.shot ? (
                  <>
                    This {PHASE.one} is shot{' '}
                    <span className="font-bold text-ink-soft">{Math.round(frameWide)} metres</span>{' '}
                    across, out of {Math.round(viewWide)}. The dashed box is what the film sees
                    {act.shot ? ', and you set it' : ''}.
                  </>
                ) : (
                  <>
                    This {PHASE.one} is shot wide. Put the ball on the board, or draw an arrow, and the
                    camera has something to point at.
                  </>
                )}
              </p>

              {/*
               * Two states, one line of type between them.
               *
               * With a box on the board there is nothing to press: dragging it is
               * the control, and a button that says "now you may move it" would
               * be a step in the way of a thing that already works. What needs a
               * button is the way BACK — an automatic frame is the good default
               * and a coach who has overridden one phase must be able to undo
               * that without knowing where they dragged it from.
               */}
              <p className="mt-2 text-[11px] leading-snug text-ink-faint">
                {act.shot
                  ? 'Drag an EDGE of the box to move it. Drag a CORNER to zoom, which grows the box around its middle and leaves the shot pointing where you put it.'
                  : rendered.shot
                    ? 'Worked out from what is on this ' +
                      PHASE.one +
                      '. Drag an edge to move it, a corner to zoom.'
                    : 'You can still frame it by hand.'}
              </p>

              <div className="mt-2.5">
                {act.shot ? (
                  <Tip
                    text={`Throws away the frame you drew on this ${PHASE.one} and goes back to working it out from the ball, the arrows and anyone you have given a role to.`}
                    title="Back to automatic"
                  >
                    <Button onClick={() => patchAct('frame', (a) => ({ ...a, shot: undefined }))}>
                      Back to automatic
                    </Button>
                  </Tip>
                ) : (
                  <Tip
                    text={`Puts a frame on this ${PHASE.one} for you to drag. Until you move it, it is exactly what the camera was going to do anyway.`}
                    title="Frame it yourself"
                  >
                    <Button onClick={frameByHand}>Frame it yourself</Button>
                  </Tip>
                )}
              </div>
            </>
          )}
        </Panel>
      </Section>

      <Section
        title={DRAWER.teams}
        hint="Shapes, colours, what is on the counters"
        defaultOpen
        badge={themHere ? 'Both' : 'Us'}
      >
        <Panel title="Our shape">
          <Tip text={HINT.formationUs} title="Our shape" block>
            <Select value={usFormation} onChange={(v) => chooseFormation('us', v)} groups={formationGroups} />
          </Tip>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">{FORMATION_BY_ID.get(usFormation)?.hint}</p>
          {shapePromptFor('us')}
          <div className="mt-3">
            <Tip text={HINT.colourUs} title="Our colour" block>
              <ColorWell value={system.teams.us.base} onChange={(c) => setTeamColor('us', c)} label="Our colour" />
            </Tip>
          </div>
          <div className="mt-3">
            <Tip
              text={
                usIsBlank
                  ? 'Puts all eleven back on the touchline so you can lay them out again from scratch.'
                  : HINT.replace
              }
              title={usIsBlank ? 'Back to the touchline' : 'Re-place shapes'}
            >
              <Button onClick={replaceShapes}>{usIsBlank ? 'Back to the touchline' : 'Re-place shapes'}</Button>
            </Tip>
          </div>
        </Panel>

        {/*
         * ── YOUR CLUB ────────────────────────────────────────────────────────
         *
         * Only appears when there is something in the profile to offer. A panel
         * that says "you have not set a kit" on every board a coach opens is a
         * standing reproach for a thing most of them will never want; the door to
         * setting one is on the portal, where they went to sign in.
         */}
        {(myKit || myCrest) && (
          <Panel title="Your club">
            {myKit && (
              <>
                <Tip
                  text="Paints your kit from Settings onto our side of this board: the colour, the ring, the pattern and its second colour. It changes this system only, and Undo puts it straight back."
                  title="Use my kit"
                >
                  <div className="flex items-center gap-2.5">
                    <Button onClick={applyMyKit}>Use my kit</Button>
                    {/* The kit itself, not a description of it. Three wells is
                        the smallest honest preview: a coach with hoops needs to
                        see the second colour is the one they set. */}
                    <span className="flex items-center gap-1.5" aria-hidden="true">
                      {[myKit, profile?.kitAlt.trim(), profile?.kitRing.trim()]
                        .filter(Boolean)
                        .map((hex, i) => (
                          <span
                            key={i}
                            className="h-5 w-5 rounded-full border border-ink-hair"
                            style={{ background: hex as string }}
                          />
                        ))}
                    </span>
                  </div>
                </Tip>
                <p className="mt-2 text-[11px] leading-snug text-ink-faint">
                  {kitMatches
                    ? 'This board is already in your kit.'
                    : 'This board is not in your kit yet. Our colour above changes the base only; this brings the whole kit across.'}
                </p>

                {/*
                 * The way back, beside the way there.
                 *
                 * Withheld while the board is ALREADY in the house colours,
                 * which is the state most boards spend their life in — a
                 * permanently useless button under a useful one is how a panel
                 * starts being skimmed instead of read. Undo is not this: Undo is
                 * the last move, and by the time a coach has decided the green
                 * read better they have usually moved four players since.
                 */}
                {!houseMatches && (
                  <div className="mt-3 border-t border-ink-hair pt-3">
                    <Tip
                      text="Puts our side back to the studio's own green, and takes off the ring, the pattern and the second colour. Your club name and your crest stay as they are."
                      title="House colours"
                    >
                      <div className="flex items-center gap-2.5">
                        <Button onClick={useHouseColours}>House colours</Button>
                        <span
                          className="h-5 w-5 rounded-full border border-ink-hair"
                          style={{ background: DEFAULT_US.base }}
                          aria-hidden="true"
                        />
                      </div>
                    </Tip>
                    <p className="mt-2 text-[11px] leading-snug text-ink-faint">
                      The colour this board started in, before any kit was painted on it.
                    </p>
                  </div>
                )}
              </>
            )}

            {myCrest && (
              <div className={myKit ? 'mt-3 border-t border-ink-hair pt-3' : ''}>
                <Tip
                  text="Draws your crest in the top-left corner of the board. It travels with the system into the share link, the print sheet, the images and the film."
                  title="Show my crest"
                  block
                >
                  <Toggle
                    checked={Boolean(system.showCrest)}
                    onChange={(on) => {
                      // The URL is written on the way ON and never taken off
                      // again, so turning it back on is a toggle rather than a
                      // trip to the settings page. See `crestUrl` in ../schema.ts.
                      edit('crest', (sys) => ({
                        ...sys,
                        showCrest: on,
                        crestUrl: on ? myCrest : sys.crestUrl,
                      }))
                      seal()
                    }}
                    label="Show my crest on the board"
                  />
                </Tip>
                <div className="mt-2 flex items-center gap-2">
                  <img src={myCrest} alt="" className="h-7 w-7 shrink-0 object-contain" />
                  <p className="text-[11px] leading-snug text-ink-faint">
                    {system.showCrest
                      ? 'Top-left of the board, on every phase.'
                      : 'Off. The board stays as it is.'}
                  </p>
                </div>
              </div>
            )}
          </Panel>
        )}

        <Panel title="Opposition">
          <Tip text={HINT.opposition} title="Show opposition" block>
            <Toggle checked={themHere} onChange={toggleOpposition} label={`Show opposition on ${PHASE.one} ${actIndex + 1}`} />
          </Tip>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            {themOnPhases.length === 0
              ? `No opposition on any ${PHASE.one} yet.`
              : themOnPhases.length === system.acts.length
                ? `On every ${PHASE.one}.`
                : `On ${themOnPhases.length === 1 ? PHASE.one : PHASE.many} ${themOnPhases.map((n) => n + 1).join(', ')}.`}
          </p>
          <div className="mt-3">
            <Tip text={HINT.keepShape} title="Keep my shape" block>
              <Toggle checked={Boolean(system.keepShape)} onChange={toggleKeepShape} label="Keep my shape" />
            </Tip>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            {system.keepShape
              ? 'Your shape holds the whole pitch. The opposition comes on around it.'
              : 'Each team lines up in its own half when the opposition is on.'}
          </p>
          {system.teams.them && (
            <div className="mt-3">
              <Tip text={HINT.formationThem} title="Their shape" block>
                <Select value={themFormation} onChange={(v) => chooseFormation('them', v)} groups={formationGroups} />
              </Tip>
              {shapePromptFor('them')}
              <div className="mt-3">
                <Tip text={HINT.colourThem} title="Their colour" block>
                  <ColorWell
                    value={system.teams.them.base}
                    onChange={(c) => setTeamColor('them', c)}
                    label="Their colour"
                  />
                </Tip>
              </div>
            </div>
          )}
        </Panel>

        {/*
         * ── BIBS ─────────────────────────────────────────────────────────────
         *
         * Below the two shapes, because that is the order the question arrives
         * in: a coach lays out who is on the pitch and then decides what they
         * are wearing. It is a full panel rather than a row inside Our shape
         * because a bib belongs to neither side, which is the whole idea of one.
         *
         * On a board with no bibs this is one sentence and one button. Nothing
         * about bibs appears on the player panel until a bib exists, so the
         * ordinary two-team board is exactly the board it was.
         */}
        <Panel title="Bibs">
          <p className="text-[11px] leading-snug text-ink-faint">
            {bibs.length === 0
              ? 'For a session that is not two teams: three-colour training, seven against seven plus seven, or a keeper in a different shirt. Add a colour, then put it on players from Selected player.'
              : `Pick a player on the board to put one of these on them. A bib holds across every ${PHASE.one}.`}
          </p>
          {bibs.map((b) => (
            <div key={b.id} className="mt-3 flex items-center gap-2">
              <span
                className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-ink-hair"
                style={{ background: b.base }}
              >
                <input
                  type="color"
                  value={b.base}
                  onChange={(e) => setBibColour(b.id, e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label={`${b.name} colour`}
                />
              </span>
              <TextInput value={b.name} onChange={(v) => renameBib(b.id, v)} maxLength={14} />
              <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-ink-faint">
                {bibWorn(b.id)}
              </span>
              <Button
                variant="ghost"
                className="!px-2"
                onClick={() => removeBib(b.id)}
                aria-label={`Remove ${b.name}`}
              >
                ×
              </Button>
            </div>
          ))}
          <div className="mt-3">
            <Tip text={HINT.bibs} title="Bibs" block>
              <Button onClick={() => addBib()}>{bibs.length === 0 ? 'Add a bib colour' : 'Add another'}</Button>
            </Tip>
          </div>
        </Panel>

        <Panel title="Counters">
          <Tip text={HINT.labels} title="What is on the counters" block>
            <Select
              value={labels}
              onChange={applyLabels}
              options={[
                { value: 'position', label: 'Positions (CB, DM, ST)' },
                { value: 'number', label: 'Shirt numbers' },
              ]}
            />
          </Tip>
          <div className="mt-3">
            <Tip
              text="Makes all player counters universally larger or smaller."
              title="Counter size"
              side="left"
              block
            >
              <Slider
                label="Size"
                min={0.5}
                max={2.0}
                step={0.05}
                value={system.tokenSize ?? 1}
                onChange={(v) => edit('token:size', (s) => ({ ...s, tokenSize: v === 1 ? undefined : v }))}
                onCommit={seal}
                readout={`${(system.tokenSize ?? 1).toFixed(2)}×`}
              />
            </Tip>
          </div>
          <div className="mt-3">
            <Tip text={HINT.namePlace} title="Player names" side="left" block>
              <Select
                value={system.namePlace ?? 'above'}
                onChange={(v) => {
                  edit('token:namePlace', (s) => ({
                    ...s,
                    namePlace: v === 'above' ? undefined : (v as NamePlace),
                  }))
                  seal()
                }}
                options={[
                  { value: 'above', label: 'Names above the counter' },
                  { value: 'below', label: 'Names below the counter' },
                ]}
              />
            </Tip>
          </div>
          <div className="mt-3">
            <Tip text={HINT.photoPlace} title="Player photos" side="left" block>
              <Select
                value={system.photoPlace ?? 'above'}
                onChange={(v) => {
                  edit('token:photoPlace', (s) => ({
                    ...s,
                    photoPlace: v === 'above' ? undefined : (v as PhotoPlace),
                  }))
                  seal()
                }}
                options={[
                  { value: 'above', label: 'Photos above the counter' },
                  { value: 'inside', label: 'Photos in the counter' },
                ]}
              />
            </Tip>
          </div>
          <div className="mt-3">
            <Tip text="Rotate player photos if they appear sideways on the board." title="Photo rotation" side="left" block>
              <Select
                value={String(system.photoAngle ?? 0)}
                onChange={(v) => {
                  edit('token:photoAngle', (s) => ({
                    ...s,
                    photoAngle: v === '0' ? undefined : Number(v),
                  }))
                  seal()
                }}
                options={[
                  { value: '0', label: 'Upright (0°)' },
                  { value: '90', label: 'Rotated right (90°)' },
                  { value: '180', label: 'Upside down (180°)' },
                  { value: '270', label: 'Rotated left (270°)' },
                ]}
              />
            </Tip>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            {system.photoPlace === 'inside'
              ? 'A photographed player wears their face on the counter, and their number sits in front of their name.'
              : 'A photographed player wears their face above the counter, over the name.'}
          </p>
        </Panel>
      </Section>

      <Section
        title={DRAWER.equipment}
        hint="The match ball, and the gear on the grass"
        badge={gearHere > 0 ? String(gearHere) : undefined}
      >
        <Panel title="Match ball">
          <Tip text={HINT.ball} title="Match ball" block>
            <PicturePicker
              label="Match ball"
              value={system.matchBall ?? DEFAULT_BALL}
              onChange={(id: BallId) => {
                edit('ball', (s) => ({ ...s, matchBall: id }))
                seal()
              }}
              items={BALLS.map((b) => ({ value: b.id, label: b.name, src: b.src }))}
            />
          </Tip>
          <div className="mt-3">
            <Tip
              text="Makes the match ball bigger or smaller across the whole drill."
              title="Match ball size"
              side="left"
              block
            >
              <Slider
                label="Size"
                min={GEAR_SIZE_MIN}
                max={GEAR_SIZE_MAX}
                step={0.05}
                value={system.matchBallSize ?? 1}
                onChange={(v) => edit('ball:size', (s) => ({ ...s, matchBallSize: v === 1 ? undefined : v }))}
                onCommit={seal}
                readout={`${(system.matchBallSize ?? 1).toFixed(2)}×`}
              />
            </Tip>
          </div>
          <div className="mt-3">
            <Tip
              text="Spins the match ball globally."
              title="Match ball turn"
              side="left"
              block
            >
              <Slider
                label="Turn"
                min={0}
                max={355}
                step={5}
                value={system.matchBallAngle ?? 0}
                onChange={(v) => edit('ball:angle', (s) => ({ ...s, matchBallAngle: v === 0 ? undefined : v }))}
                onCommit={seal}
                readout={`${system.matchBallAngle ?? 0}°`}
              />
            </Tip>
          </div>
          <p className="mt-3 text-[11px] leading-snug text-ink-faint border-t border-ink-hair pt-3">
            <span className="font-bold text-ink-soft">{ball.name}.</span> {ball.story}
          </p>
        </Panel>

      {/*
       * ── TRAINING GEAR ──────────────────────────────────────────────────
       *
       * The other half of Equipment. The panel above picks the ONE ball this
       * system is played with; this one puts objects on the grass, and there
       * can be as many of them as the drill needs.
       *
       * Pressing a piece adds one. It is not a mode — see `addGear` — so four
       * presses of the cone is four cones, which is what laying out a gate
       * actually is.
       *
       * AND THE BALLS DRAWER NOW HOLDS EVERY BALL. It used to be two anonymous
       * ones under the heading "Loose balls", separate from the five
       * photographed match balls in the panel above — a split with nothing
       * behind it, since a ball is a ball (user, 2026-08-27). The one real
       * distinction is what a ball is FOR, and it is stated below rather than
       * enforced by keeping two catalogues.
       */}
      <Panel title="Training gear">
        <p className="mb-2.5 text-[11px] leading-snug text-ink-faint">
          Press a piece to put one on the board. It lands in the middle, already picked up — drag it where you want
          it, then use the panel on the right to size it or turn it. Gear belongs to this {PHASE.one}, and it moves
          between {PHASE.many} on Play exactly like a player does.
        </p>
        <p className="mb-2.5 text-[11px] leading-snug text-ink-faint">
          <span className="font-bold text-ink-soft">Balls are in here too.</span> All of them, the same ones as
          above. The ball you pick above is the one the move is about — it travels along the passes. These are balls
          you PUT somewhere, as many as you like, and each one sizes and turns like any other piece.
        </p>
        <GearPicker
          onAdd={addGear}
          groups={GEAR_GROUPS.map((g) => ({
            id: g.id,
            label: g.label,
            items: GEAR.filter((it) => it.group === g.id).map((it) => ({
              id: it.id,
              name: it.name,
              thumb: it.thumb,
            })),
          }))}
        />
        {gearHere > 0 && (
          <div className="mt-3 flex items-center gap-1.5">
            <Tip text={`Takes every piece of equipment off this ${PHASE.one}. The players, the arrows and the shaded areas stay.`} title="Clear the gear">
              <ConfirmButton
                confirm="Yes, clear it"
                onConfirm={() => {
                  patchAct('clear-gear', (a) => ({ ...a, gear: [] }))
                  seal()
                }}
              >
                Clear the gear
              </ConfirmButton>
            </Tip>
            <span className="text-[11px] text-ink-faint">
              {gearHere} {gearHere === 1 ? 'piece' : 'pieces'} on this {PHASE.one}.
            </span>
          </div>
        )}
      </Panel>
      </Section>

      <Section
        title={DRAWER.phase}
        hint="Players, shaded areas, writing"
        defaultOpen
        badge={String(act.tokens.length)}
      >
        <Panel title={`Players on this ${PHASE.one}`}>
          <div className="flex flex-wrap gap-1.5">
            <Tip text={HINT.addBall} title="Add a ball">
              <Button onClick={addBall}>+ Ball</Button>
            </Tip>
            <Tip text={HINT.removeBall} title="Take a ball off">
              <Button onClick={removeBall} disabled={ballsHere.length === 0}>
                {selectedBallId ? 'Remove this ball' : 'Remove ball'}
              </Button>
            </Tip>
            <Tip text={HINT.addPlayer} title="Add a player">
              <Button onClick={() => addPlayer('us')}>+ Player</Button>
            </Tip>
            <Tip text={HINT.clearPitch} title="Clear the pitch">
              <ConfirmButton
                confirm="Yes, clear them"
                onConfirm={() => {
                  patchAct('clear-players', (a) => ({ ...a, tokens: [] }))
                  seal()
                }}
                disabled={act.tokens.length === 0}
              >
                Clear players
              </ConfirmButton>
            </Tip>
          </div>
        </Panel>

        {/*
         * Shaded areas, all in one place and all explained.
         *
         * "Add block" on its own was the least understood control in the studio:
         * a coach pressed it, half the pitch went green, and nothing said what had
         * been decided on their behalf. Sitting it next to the two areas you draw
         * by hand makes the shape of the idea obvious — one is worked out from
         * your players, two are drawn where you say.
         */}
        <Panel title="Shaded areas">
          <p className="mb-2.5 text-[11px] leading-snug text-ink-faint">
            One block is worked out from your deepest line. Draw the rest yourself: pick the players for a block of
            your own, or drag a box out for an area. Click any of them afterwards to change its colour, its shape or
            what it says.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Tip text={HINT.block} title={blockFor('us') ? 'Redraw our block' : 'Our block'}>
              <Button onClick={() => addBlockBand('us')} active={Boolean(blockFor('us'))}>
                {blockFor('us') ? 'Redraw our block' : 'Our block'}
              </Button>
            </Tip>
            {system.teams.them && (
              <Tip text={HINT.blockThem} title={blockFor('them') ? 'Redraw their block' : 'Their block'}>
                <Button onClick={() => addBlockBand('them')} active={Boolean(blockFor('them'))}>
                  {blockFor('them') ? 'Redraw their block' : 'Their block'}
                </Button>
              </Tip>
            )}
            {/*
             * Draw a block by hand. Sits with the two automatic ones rather than
             * up in the arrow toolbar, because what a coach is choosing between
             * here is "work it out for me" and "I will pick them", and those two
             * belong side by side.
             */}
            <Tip text={HINT.blockDraw} title="Draw a block">
              {/* The label does not change to "Cancel" when it is armed. The
                  active state already says it is on, the panel below carries the
                  real Cancel, and two buttons a centimetre apart both reading
                  Cancel is a worse control than one that keeps its name. */}
              <Button
                active={tool === 'block'}
                onClick={() => (tool === 'block' ? cancelBlockPick() : setTool('block'))}
              >
                Draw a block
              </Button>
            </Tip>
            {ZONE_TOOL_IDS.map((id) => (
              <Tip key={id} text={<ToolText id={id} />} title={TOOL_DOC[id].label}>
                <Button active={tool === id} onClick={() => setTool(tool === id ? 'select' : id)}>
                  {TOOL_DOC[id].label}
                </Button>
              </Tip>
            ))}
          </div>
          {tool === 'block' ? (
            <div className="mt-2.5 rounded-lg bg-paper p-2.5">
              <p className="text-[11px] leading-snug text-ink">
                <span className="font-bold">
                  {blockPick.length === 0
                    ? 'Nobody picked yet.'
                    : `${blockPick.length} picked${blockPick.length >= BLOCK_MAX ? ' (the most it takes)' : ''}.`}
                </span>{' '}
                {HINT.blockPicking}
              </p>
              {/*
               * Offered HERE, while the line is being picked, and not only in the
               * inspector afterwards. The board is already drawing the answer —
               * see the preview band — so this is a control a coach can watch
               * rather than one they have to imagine, and the choice it makes is
               * the difference between a block and a flood across the pitch.
               */}
              {blockPick.length >= 2 && (
                <div className="mt-2.5">
                  <Tip text={HINT.blockClose} title="What it shades" side="left" block>
                    <Field label="Shades">
                      <Segmented
                        label="What it shades"
                        value={effectiveClose}
                        onChange={(v) => setBlockClose(v as 'goal' | 'shape')}
                        options={[
                          { value: 'goal', label: 'To the goal' },
                          { value: 'shape', label: 'Around them' },
                        ]}
                      />
                    </Field>
                  </Tip>
                </div>
              )}
              <div className="mt-2 flex gap-1.5">
                <Button variant="solid" onClick={commitBlockPick} disabled={blockPick.length < 2}>
                  Draw it
                </Button>
                <Button onClick={cancelBlockPick}>Cancel</Button>
              </div>
            </div>
          ) : (
            blockFor('us') && (
              <p className="mt-2 text-[11px] leading-snug text-ink-faint">{HINT.blockRedraw}</p>
            )
          )}
        </Panel>

      {/*
       * ── WRITING ────────────────────────────────────────────────────────
       *
       * The text tool has been in the top rail since it shipped, at the end of
       * the arrows, and it was NOT FOUND (user, 2026-08-27) — the rail scrolls
       * sideways on anything narrower than a desktop and Text is the last thing
       * in it, so on most screens it was simply off the edge.
       *
       * So it gets a home here as well, beside the shaded areas, which is the
       * other panel full of "things I add to this phase". Two doors to one tool
       * is not duplication when one of them is the door people actually walk
       * through; the rail keeps it because that is where a coach who knows the
       * studio reaches, and this is where a coach who does not will look.
       */}
      <Panel title="Writing">
        <p className="mb-2.5 text-[11px] leading-snug text-ink-faint">
          {TOOL_DOC[TEXT_TOOL_ID].what} {TOOL_DOC[TEXT_TOOL_ID].when}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Tip text={<ToolText id={TEXT_TOOL_ID} />} title={TOOL_DOC[TEXT_TOOL_ID].label}>
            <Button
              active={tool === TEXT_TOOL_ID}
              onClick={() => setTool(tool === TEXT_TOOL_ID ? 'select' : TEXT_TOOL_ID)}
            >
              {tool === TEXT_TOOL_ID ? 'Click the pitch…' : 'Write on the pitch'}
            </Button>
          </Tip>
        </div>
        {textsHere > 0 && (
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            {textsHere} {textsHere === 1 ? 'piece' : 'pieces'} of writing on this {PHASE.one}. Click one on the
            board to change it.
          </p>
        )}
      </Panel>
      </Section>

      <Section title={DRAWER.film} hint={`How long each ${PHASE.one} holds`}>
        <Panel title="Pace">
          <Tip text={HINT.pace} title="The hold and the move" block>
            <PaceField
              system={system}
              onHold={(ms) => edit('pace', (sys) => ({ ...sys, hold: ms }))}
              onMove={(ms) => edit('pace', (sys) => ({ ...sys, move: ms }))}
              onCommit={seal}
            />
          </Tip>
        </Panel>
      </Section>

      <Section title={DRAWER.system} hint="Start over">
        <Panel title="This system">
          <Tip text={HINT.reset} title="Start over">
            <ConfirmButton confirm="Yes, start over" onConfirm={startOver}>
              Start over
            </ConfirmButton>
          </Tip>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            Everything you do is saved on this computer as you go. Undo takes back anything, including this.
          </p>
        </Panel>
      </Section>
    </>
  )

  // ── the phase panel (right on a wide screen) ───────────────────────────────
  // The chips in this list are the marks that are on the board, so they are
  // tinted from the board's own palette rather than from paper's: a run arrow
  // listed in #06A659 beside a run arrow drawn in mint is two different things.
  const arrows = arrowStyle(surface.palette)
  const bandTone = (b: Band) =>
    resolveBandStyle(surface.palette, b.kind, {
      tone: b.tone as BandTone | undefined,
      strength: b.strength as BandStrength | undefined,
    }).tone
  const marks: {
    id: string
    name: string
    tone: string
    kind: 'arrow' | 'band' | 'text' | 'gear'
    /**
     * How faint it is on the board, when that is not obvious from the board.
     *
     * An arrow turned down to nothing is invisible there BY DESIGN, so without
     * this the list is the only place it exists and gives no sign of it — and a
     * coach who has hidden six arrows to stage a reveal needs to see which
     * six. Undefined on everything that cannot be faded.
     */
    faded?: number
  }[] = [
    ...act.arrows.map((a) => ({
      id: a.id,
      name: TOOL_DOC[a.kind].label,
      tone: arrows[a.kind].color,
      kind: 'arrow' as const,
      faded: (a.opacity ?? 1) < 1 ? (a.opacity ?? 1) : undefined,
    })),
    // Resolved rather than read straight off `bandStyle`, so a zone repainted
    // red shows a red dot here. A list whose swatches disagree with the board
    // is worse than a list with no swatches.
    ...act.bands.map((b) => ({
      id: b.id,
      name: markName(b, act),
      tone: bandTone(b),
      kind: 'band' as const,
    })),
    // Named by its own first line, truncated. A list of four marks all called
    // "Text" is a list you have to click through one at a time; a list that
    // says "Hold until he commits" is a list you can read.
    ...(act.texts ?? []).map((t) => ({
      id: t.id,
      name: textMarkName(t),
      tone: resolveTextStyle(surface.palette, t).colour,
      kind: 'text' as const,
    })),
    // Named for the piece rather than "Gear", for the same reason writing is
    // named by its own first line: a phase with a ladder, a mannequin and six
    // cones on it should read as that in the list, not as nine identical rows.
    ...(act.gear ?? []).map((g) => ({
      id: g.id,
      name: resolveGear(g.kind)?.name ?? 'Equipment',
      tone: surface.palette.gold,
      kind: 'gear' as const,
    })),
  ]

  const phasePanel = (
    <>
      <Panel title={`${PHASE.One} ${actIndex + 1} of ${system.acts.length}`}>
        <Field label="Title">
          <Tip text={HINT.phaseTitle} title="Title" side="left" block help="phaseWords">
            <TextInput
              value={act.title}
              onChange={(v) => patchAct('phase-title', (a) => ({ ...a, title: v }))}
              placeholder="What this moment shows"
              maxLength={60}
            />
          </Tip>
        </Field>
        <Field label="Caption">
          <Tip text={HINT.phaseCaption} title="Caption" side="left" block>
            <TextArea
              value={act.caption}
              onChange={(v) => patchAct('phase-caption', (a) => ({ ...a, caption: v }))}
              placeholder="One line a coach can read at a glance"
            />
          </Tip>
        </Field>
        <Field label="Description (optional)">
          <Tip text={HINT.phaseNotes} title="Description" side="left" block>
            <TextArea
              value={act.notes ?? ''}
              onChange={(v) => patchAct('phase-notes', (a) => ({ ...a, notes: v || undefined }))}
              placeholder="Coaching points, triggers, what to look for"
              rows={4}
            />
          </Tip>
        </Field>
      </Panel>

      {selectedToken ? (
        <Panel title="Selected player">
          {/* Above the fields rather than below them, because picking a player
              FILLS those fields. A control that rewrites the two inputs under it
              belongs where it can be seen doing so. */}
          <SquadPick
            squad={squad}
            token={selectedToken}
            onPick={(player) =>
              patchToken(
                {
                  // The squad's number wins if there is one, and the counter
                  // keeps whatever it had if there is not. A player with no
                  // number is a real entry, and blanking a counter that already
                  // said "6" would be the picker taking something away.
                  label: player.number || selectedToken.label,
                  name: player.name,
                  photo: player.photoPath || undefined,
                },
                'player',
              )
            }
            // Clears what the pick put there and nothing else. The counter's
            // label is left alone for the same reason it is kept above: it is a
            // position on the board, not a property of the person.
            onClear={() => patchToken({ name: undefined, photo: undefined }, 'player')}
          />
          <Field label="On the counter">
            <Tip text={HINT.playerLabel} title="On the counter" side="left" block>
              <TextInput value={selectedToken.label} onChange={(v) => patchToken({ label: v }, 'label')} maxLength={4} />
            </Tip>
          </Field>
          <Field label="Name (optional)">
            <Tip text={HINT.playerName} title="Name" side="left" block>
              <TextInput
                value={selectedToken.name ?? ''}
                onChange={(v) => patchToken({ name: v || undefined }, 'name')}
                placeholder="Printed above the counter"
                maxLength={18}
              />
            </Tip>
          </Field>
          <Field label="Role cue">
            <Tip text={HINT.playerCue} title="Role cue" side="left" block>
              <Select
                value={(selectedToken.cue ?? '') as string}
                onChange={(v) => patchToken({ cue: (v || undefined) as Cue | undefined }, 'cue')}
                options={[{ value: '', label: 'None' }, ...CUES.map((c) => ({ value: c as string, label: c }))]}
              />
            </Tip>
          </Field>
          {/* Only once there is a bib to wear. A board that is two teams stays
              a board that is two teams, and the way in is the Bibs panel under
              Teams and kit, where a coach already goes for colour. */}
          {bibs.length > 0 && (
            <Field label="Bib">
              <Tip text={HINT.bib} title="Bib" side="left" block>
                <BibSwatches
                  bibs={bibs}
                  worn={selectedToken.bib}
                  onWear={(id) => assignBib(selectedToken.id, id)}
                  onCreate={(hex) => addBib(hex, selectedToken.id)}
                  seed={nextBib().base}
                />
              </Tip>
            </Field>
          )}
          <Tip text={HINT.playerDim} title="Fade back" side="left" block>
            <Toggle
              checked={Boolean(selectedToken.dim)}
              onChange={(v) => patchToken({ dim: v || undefined }, 'dim')}
              label="Fade back"
            />
          </Tip>
          <div className="mt-3">
            <Tip text={HINT.playerRemove} title="Remove" side="left">
              <Button variant="danger" onClick={deleteSelection}>
                Remove from this {PHASE.one}
              </Button>
            </Tip>
          </div>
        </Panel>
      ) : selectedArrow ? (
        <Panel title={`Selected ${TOOL_DOC[selectedArrow.kind].label.toLowerCase()}`}>
          <p className="mb-3 text-[11px] leading-relaxed text-ink-faint">{TOOL_DOC[selectedArrow.kind].what}</p>
          {/*
           * Whether the ends are attached is invisible on the board — an arrow
           * holding a player and one merely finishing near them are drawn the
           * same, and behave completely differently the moment anybody moves.
           */}
          <p className="mb-3 text-[11px] leading-relaxed text-ink-soft">
            {ARROW_MARK.ends(tokenLabel(selectedArrow.fromId, act), tokenLabel(selectedArrow.toId, act))}
          </p>
          <p className="mb-3 text-[11px] leading-relaxed text-ink-faint">{ARROW_MARK.adjust}</p>
          <Field label="Bend">
            <input
              type="range"
              min={-1}
              max={1}
              step={0.1}
              value={selectedArrow.bend ?? 0}
              onChange={(e) => patchMark({ bend: Number(e.target.value) || undefined })}
              className="w-full accent-ink"
              aria-label="How much the arrow bows"
            />
            <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">{ARROW_MARK.bow}</p>
          </Field>
          <Field label={`Strength: ${Math.round((selectedArrow.opacity ?? 1) * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={selectedArrow.opacity ?? 1}
              /*
               * `|| undefined` at 1, the same policy the bend and the label are
               * on: a document that stores `opacity: 1` on every arrow has
               * written today's default into itself. `>= 0.999` rather than
               * `=== 1` because a range step lands on 0.9999999 often enough.
               */
              onChange={(e) => {
                const v = Number(e.target.value)
                patchMark({ opacity: v >= 0.999 ? undefined : v })
              }}
              onPointerUp={seal}
              onKeyUp={seal}
              className="w-full accent-ink"
              aria-label="How strongly this arrow is drawn"
            />
            <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">{ARROW_MARK.strength}</p>
          </Field>
          <Field label="Label (optional)">
            <TextInput
              value={selectedArrow.label ?? ''}
              onChange={(v) => patchMark({ label: v || undefined })}
              placeholder="Printed on the arrow"
              maxLength={18}
            />
          </Field>
          <Tip text={HINT.deleteMark} title="Delete" side="left">
            <Button variant="danger" onClick={deleteSelection}>
              Delete this arrow
            </Button>
          </Tip>
        </Panel>
      ) : selectedBand ? (
        /*
         * A shaded area, and everything about it a coach may change.
         *
         * The order is the order of the questions: what does it SAY (the
         * words), what does it MEAN (the colour), how loudly (the strength),
         * and only then what shape it is. Shape and outline are last and are
         * only offered on a drawn area — a block traces the players it runs
         * through and has no outline to choose, and offering the control
         * greyed out would be four dead buttons under the one thing on this
         * panel that is actually different about a block.
         */
        <Panel title={`Selected ${markName(selectedBand, act).toLowerCase()}`}>
          <p className="mb-3 text-[11px] leading-relaxed text-ink-faint">
            {selectedBand.kind === 'block'
              ? 'Tied to the players it runs through. Drag any of them and it reshapes.'
              : HINT.bandMove}
          </p>

          <Tip text={HINT.bandLabel} title="What it says" side="left" block>
            <Field label="Label">
              <TextInput
                value={selectedBand.label ?? ''}
                onChange={(v) => patchBand('label', { label: v || undefined })}
                placeholder="Cutback zone"
                maxLength={28}
              />
            </Field>
          </Tip>

          <Tip text={HINT.bandTone} title="Colour" side="left" block>
            <Field label="Colour">
              <Select
                value={(selectedBand.tone ?? 'house') as string}
                onChange={(v) => {
                  patchBand('tone', { tone: v === 'house' ? undefined : v })
                  seal()
                }}
                options={[
                  // "As it comes" and not a sixth colour: it means "whatever
                  // this KIND of area is meant to be", which is a different
                  // answer for a block and a danger area, and it is the value
                  // every band written before this control existed carries.
                  { value: 'house', label: 'As it comes' },
                  ...BAND_TONES.map((t) => ({ value: t.id, label: t.label })),
                ]}
              />
            </Field>
          </Tip>
          <p className="-mt-1 mb-2 text-[11px] leading-snug text-ink-faint">
            {BAND_TONES.find((t) => t.id === selectedBand.tone)?.note ??
              'The house colour for this kind of area.'}
          </p>

          <Tip text={HINT.bandStrength} title="How heavy" side="left" block>
            <Field label="Strength">
              <Segmented
                label="Strength"
                value={(selectedBand.strength ?? 'normal') as string}
                onChange={(v) => {
                  patchBand('strength', { strength: v === 'normal' ? undefined : v })
                  seal()
                }}
                options={BAND_STRENGTHS.map((b) => ({ value: b.id, label: b.label }))}
              />
            </Field>
          </Tip>

          {/*
           * A block's own question, and the one the tool was getting wrong: is
           * this unit protecting the goal behind it, or is it a shape on the
           * pitch? Everything below this is the same for every shaded area.
           */}
          {selectedBand.kind === 'block' && (
            <>
              <Tip text={HINT.blockClose} title="What it shades" side="left" block>
                <Field label="Shades">
                  <Segmented
                    label="What it shades"
                    value={selectedBand.close === 'shape' ? 'shape' : 'goal'}
                    onChange={(v) => {
                      patchBand('close', { close: v === 'shape' ? 'shape' : undefined })
                      seal()
                    }}
                    options={[
                      { value: 'goal', label: 'To the goal' },
                      { value: 'shape', label: 'Around them' },
                    ]}
                  />
                </Field>
              </Tip>

              {selectedBand.close === 'shape' && (
                <Tip text={HINT.bandCorner} title="Corners" side="left" block>
                  <Field label="Corners">
                    <Segmented
                      label="Corners"
                      value={
                        BAND_CORNERS.some((c) => c.id === selectedBand.corner)
                          ? selectedBand.corner!
                          : 'soft'
                      }
                      onChange={(v) => {
                        patchBand('corner', { corner: v === 'soft' ? undefined : v })
                        seal()
                      }}
                      options={BAND_CORNERS.map((c) => ({ value: c.id, label: c.label }))}
                    />
                  </Field>
                </Tip>
              )}
            </>
          )}

          {selectedBand.kind !== 'block' && (
            <Tip text={HINT.bandShape} title="Shape" side="left" block>
              <Field label="Shape">
                <Segmented
                  label="Shape"
                  value={selectedBand.shape ?? 'box'}
                  onChange={(v) => {
                    patchBand('shape', { shape: v === 'box' ? undefined : (v as BandShape) })
                    seal()
                  }}
                  options={[
                    { value: 'box', label: 'Box' },
                    { value: 'round', label: 'Rounded' },
                    { value: 'ellipse', label: 'Oval' },
                    { value: 'triangle', label: 'Triangle' },
                    { value: 'diamond', label: 'Diamond' },
                  ]}
                />
              </Field>
            </Tip>
          )}

          {/*
           * The outline, three ways rather than the old solid/dashed switch.
           * `solid` is cleared as this is written: the two fields disagreeing
           * about a band is a bug waiting for whoever reads the document next,
           * and the board resolving `edge` first would hide it from us here.
           *
           * Hidden when 'line only' is active — there is no polygon to outline.
           */}
          {selectedBand.fill !== 'line' && (
            <Tip text={HINT.bandEdge} title="Its outline" side="left" block>
              <Field label="Outline">
                <Segmented
                  label="Its outline"
                  value={bandEdgeOf(selectedBand)}
                  onChange={(v) => {
                    patchBand('edge', { edge: v, solid: undefined })
                    seal()
                  }}
                  options={BAND_EDGES.map((e) => ({ value: e.id, label: e.label }))}
                />
              </Field>
            </Tip>
          )}

          <Tip text={HINT.bandFill} title="Inside it" side="left" block>
            <Field label="Inside">
              <Segmented
                label="Inside it"
                value={
                  selectedBand.fill === 'none'
                    ? 'none'
                    : selectedBand.fill === 'line'
                      ? 'line'
                      : selectedBand.fill === 'hatch'
                        ? 'hatch'
                        : 'shade'
                }
                onChange={(v) => {
                  // When switching TO 'line only', ensure the string is not
                  // 'off' — an invisible line-only block is a confusing mark.
                  if (v === 'line' && selectedBand.string === 'off') {
                    patchBand('fill+string', { fill: 'line', string: undefined })
                  } else {
                    patchBand('fill', { fill: v === 'shade' ? undefined : v })
                  }
                  seal()
                }}
                options={
                  // 'Line only' is meaningful only for blocks (which have a
                  // string). On a zone it would make the mark invisible, so
                  // we hide it there rather than let a coach set it by accident.
                  selectedBand.kind === 'block'
                    ? BAND_FILLS.map((f) => ({ value: f.id, label: f.label }))
                    : BAND_FILLS.filter((f) => f.id !== 'line').map((f) => ({ value: f.id, label: f.label }))
                }
              />
            </Field>
          </Tip>

          {selectedBand.kind === 'block' && (
            <Tip text={HINT.bandString} title="The line through them" side="left" block>
              <Field label="Line through the players">
                <Segmented
                  label="The line through them"
                  value={
                    BAND_STRINGS.some((t) => t.id === selectedBand.string)
                      ? selectedBand.string!
                      : 'normal'
                  }
                  onChange={(v) => {
                    patchBand('string', { string: v === 'normal' ? undefined : v })
                    seal()
                  }}
                  options={BAND_STRINGS.map((t) => ({ value: t.id, label: t.label }))}
                />
              </Field>
            </Tip>
          )}

          <div className="mt-3">
            <Tip text={HINT.deleteMark} title="Delete" side="left">
              <Button variant="danger" onClick={deleteSelection}>
                Delete this area
              </Button>
            </Tip>
          </div>
        </Panel>
      ) : selectedText ? (
        /*
         * ── SELECTED WRITING ──────────────────────────────────────────────
         *
         * The words first and everything else under a rule, because that is the
         * order a coach works in: they place a mark to say something, they type
         * it, and only then do they decide how loud it is. A panel that opened
         * on five appearance controls with an empty text box at the bottom
         * would be asking them to dress a sentence they have not written.
         */
        <Panel title="Selected text">
          <Field label="What it says">
            <TextArea
              value={selectedText.text}
              onChange={(v) => patchText({ text: v })}
              placeholder="Type on the board…"
            />
          </Field>
          <p className="-mt-1 text-[11px] leading-snug text-ink-faint">
            Every line you type is a line on the board. Drag the words to move them.
          </p>

          {/*
           * ── EVERY CONTROL IN THIS PANEL GETS THE WHOLE COLUMN ─────────────
           *
           * Size, Weight, Aligned: all three were laid out two to a row, which
           * in a 256pt panel is about 116pt each. Size has FIVE options and
           * Weight has three whole words, so the two of them shared a row that
           * could hold neither — XS S M L XL ran together and Regular · Bold ·
           * Heavy overlapped into an unreadable smear (user, 2026-08-27).
           *
           * The arithmetic, once, so nobody pairs them up again: a `Segmented`
           * spends 8pt of its own padding plus 3pt of gap per option, and a
           * 12px bold label needs about 9pt a character. Five options need
           * ~150pt; "Regular" alone needs ~55pt, so three of them need ~185pt.
           * Neither goes in 116. One per row it is, and the panel is a column
           * you scroll anyway.
           */}
          <div className="mt-3 border-t border-ink-hair pt-3">
            <Field label="Size">
              <Segmented
                label="Size"
                value={TEXT_SIZES.some((t) => t.id === selectedText.size) ? selectedText.size! : 'm'}
                onChange={(v) => patchText({ size: v === 'm' ? undefined : v })}
                options={TEXT_SIZES.map((t) => ({ value: t.id, label: t.label }))}
              />
            </Field>
            <Field label="Weight">
              <Segmented
                label="Weight"
                value={
                  TEXT_WEIGHTS.some((t) => t.id === selectedText.weight) ? selectedText.weight! : 'black'
                }
                onChange={(v) => patchText({ weight: v === 'black' ? undefined : v })}
                options={TEXT_WEIGHTS.map((t) => ({ value: t.id, label: t.label }))}
              />
            </Field>
          </div>
          <p className="-mt-1 text-[11px] leading-snug text-ink-faint">
            {TEXT_SIZES.find((t) => t.id === (selectedText.size ?? 'm'))?.note}
          </p>

          <div className="mt-3">
            <Field label="How it sits on the board">
              <Segmented
                label="How it sits on the board"
                value={TEXT_LOOKS.some((t) => t.id === selectedText.look) ? selectedText.look! : 'halo'}
                onChange={(v) => patchText({ look: v === 'halo' ? undefined : v })}
                options={TEXT_LOOKS.map((t) => ({ value: t.id, label: t.label }))}
              />
            </Field>
            <p className="-mt-1 text-[11px] leading-snug text-ink-faint">
              {TEXT_LOOKS.find((t) => t.id === (selectedText.look ?? 'halo'))?.note}
            </p>
          </div>

          <div className="mt-3">
            <Field label="Colour">
              {/* The same nine the shaded areas are painted from, plus the
                  board's own ink at the top. A second colour vocabulary for
                  text would mean a caption and the area it names could not be
                  made to match. */}
              <Select
                value={(selectedText.tone ?? 'ink') as string}
                onChange={(v) => patchText({ tone: v === 'ink' ? undefined : v })}
                options={[
                  { value: 'ink', label: 'Board ink (default)' },
                  ...BAND_TONES.map((t) => ({ value: t.id, label: t.label })),
                ]}
              />
            </Field>
            <p className="-mt-1 text-[11px] leading-snug text-ink-faint">
              {BAND_TONES.find((t) => t.id === selectedText.tone)?.note ??
                'The colour the rest of the board is written in.'}
            </p>
          </div>

          {/* Aligned and Angle, one per row, for the reason set out above the
              Size control. The slider was the worse half of that pairing: about
              70 points of track and a readout beside it, which is not a control
              anybody can set an angle with. */}
          <div className="mt-3">
            <Field label="Aligned">
              <Segmented
                label="Aligned"
                value={
                  TEXT_ALIGNS.some((t) => t.id === selectedText.align) ? selectedText.align! : 'center'
                }
                onChange={(v) => patchText({ align: v === 'center' ? undefined : v })}
                options={TEXT_ALIGNS.map((t) => ({ value: t.id, label: t.label }))}
              />
            </Field>
            {/* The same `Slider` every other panel uses, rather than a bare
                range input with a readout bolted to its side. Full width, and
                the number sits over the track where the gear panel puts it. */}
            <Slider
              label="Angle"
              min={-90}
              max={90}
              step={5}
              value={selectedText.angle ?? 0}
              onChange={(v) => patchText({ angle: v || undefined })}
              onCommit={seal}
              readout={`${selectedText.angle ?? 0}°`}
            />
          </div>
          {/* `mt-2`, not the `-mt-1` the other notes use: those follow a `Field`,
              which carries its own bottom margin, and this one follows a
              `Slider`, which does not. */}
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            Turn it to write along a touchline or up a channel. Level reads best for everything else.
          </p>

          <div className="mt-3">
            <Tip text={HINT.deleteMark} title="Delete" side="left">
              <Button variant="danger" onClick={deleteSelection}>
                Delete this text
              </Button>
            </Tip>
          </div>
        </Panel>
      ) : selectedGear ? (
        /*
         * ── SELECTED GEAR ────────────────────────────────────────────────
         *
         * Two controls: how big, and which way round. Position is not among them
         * because position is the drag — putting x and y in a panel as numbers
         * would be offering a worse way to do the thing the board already does
         * better. A third, "Mirror it", was here and has gone; the note further
         * down says why.
         *
         * The picture is at the top and it is the real asset rather than a
         * name, for the same reason the picker is pictures: on a phase with
         * four cones and two hurdles, "Mini hurdle" does not tell you which of
         * the two you have hold of, and the gold outline on the board does.
         */
        <Panel title="Selected equipment">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-ink-hair bg-paper p-1">
              {/* `max-h-full max-w-full`, for the reason set out on the same
                  line of GearPicker in ./ui.tsx: `h-full` needs a definite box
                  to resolve against and does not get one here, so a 1:4 asset
                  took its width from the well and its height from itself and
                  hung out of the bottom of the panel (user, 2026-08-27). */}
              <img
                src={resolveGear(selectedGear.kind)?.thumb}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-bold text-ink">
                {resolveGear(selectedGear.kind)?.name ?? 'Equipment'}
              </span>
              <span className="block text-[11px] text-ink-faint">
                {(() => {
                  const piece = resolveGear(selectedGear.kind)
                  if (!piece) return 'This piece is not in this build.'
                  const size = gearSize(piece, selectedGear.size)
                  return `${size.w.toFixed(1)} × ${size.h.toFixed(1)} m on the grass`
                })()}
              </span>
            </span>
          </div>

          <div className="mb-3">
            <Tip
              text="How big it draws, as a multiple of the piece's own size. Metres of grass, like everything else on this board — so it stays the same size on screen whichever pitch view you are on."
              title="Size"
              side="left"
              block
            >
              <Slider
                label="Size"
                min={GEAR_SIZE_MIN}
                max={GEAR_SIZE_MAX}
                step={0.05}
                value={selectedGear.size ?? 1}
                onChange={(v) => patchGear({ size: v === 1 ? undefined : v }, 'gear:size')}
                onCommit={seal}
                readout={`${(selectedGear.size ?? 1).toFixed(2)}×`}
              />
            </Tip>
          </div>

          <div className="mb-3">
            <Tip
              text="Turns it about its own middle, so it stays where you put it. A ladder down the channel, a mini goal facing the way the drill attacks."
              title="Which way round"
              side="left"
              block
            >
              <Slider
                label="Turn"
                min={0}
                max={355}
                step={5}
                value={selectedGear.angle ?? 0}
                onChange={(v) => patchGear({ angle: v === 0 ? undefined : v }, 'gear:angle')}
                onCommit={seal}
                readout={`${selectedGear.angle ?? 0}°`}
              />
            </Tip>
          </div>

          {/*
           * ── THERE IS NO "MIRROR IT" HERE ANY MORE ──────────────────────────
           *
           * There was, and it did nothing you could see on any piece in the
           * catalogue (user, 2026-08-27). Not a bug in the transform — the flip
           * in ../board/Overlays.tsx is a correct reflection about the piece's
           * own middle — but a control with no subject: a cone, a ball, a
           * hurdle, a ladder, a bosu, a mini goal, a mannequin and a pole are
           * all bilaterally symmetric, so their reflection is the drawing they
           * already were. What is left over is the turn, which reaches every
           * orientation the artwork actually has.
           *
           * `flip` STAYS in the schema and stays honoured by the renderer, so a
           * document saved by an older build still draws exactly as its author
           * left it. What has gone is the offer to set it.
           */}

          {/* Back to square. Only offered once it is not — a button that says
              "reset" on a piece nobody has touched is a control asking to be
              read and then ignored. */}
          {(selectedGear.size ?? 1) !== 1 || selectedGear.angle || selectedGear.flip ? (
            <div className="mt-3">
              <Tip
                text="Puts it back to its own size and square to the pitch. It stays exactly where it is."
                title="Back to square"
              >
                <Button
                  onClick={() => {
                    patchGear({ size: undefined, angle: undefined, flip: undefined }, 'gear:reset')
                    seal()
                  }}
                >
                  Back to square
                </Button>
              </Tip>
            </div>
          ) : null}

          <div className="mt-3">
            <Tip text={HINT.deleteMark} title="Delete" side="left">
              <Button variant="danger" onClick={deleteSelection}>
                Take it off
              </Button>
            </Tip>
          </div>
        </Panel>
      ) : (
        <Panel title="Nothing selected">
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Click a counter to rename it, give it a role cue, or fade it back. Click an arrow, a shaded area or a
            piece of writing to change it or take it off. Click a piece of equipment to resize it or turn it. A
            player removed here is only gone from this {PHASE.one}.
          </p>
        </Panel>
      )}

      {/*
       * Everything drawn on this phase, as a list.
       *
       * The board is the natural place to click an arrow and the list is the
       * reliable one: arrows overlap, a short one under a counter is hard to
       * hit, and a coach who wants "that pass, not this one" gone should not
       * have to fight for it. Clearing all of them is still here, one row down,
       * where it stops being the only option and becomes a shortcut.
       */}
      <Panel title={`Marks on this ${PHASE.one}`}>
        {marks.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Nothing drawn yet. Pick Pass, Run, Carry, Press, Switch or Line at the top and drag on the
            board, or pick Text and click where you want to write.
          </p>
        ) : (
          <>
            <p className="mb-2 text-[11px] leading-snug text-ink-faint">{HINT.marks}</p>
            <ul className="space-y-1">
              {marks.map((m) => (
                <li
                  key={m.id}
                  className={`flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors ${
                    selectedMarkId === m.id ? 'bg-ink-hair' : 'hover:bg-ink-hair/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelection({ kind: 'mark', id: m.id })}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {/* The dot sits on a disc of the board's own ground, which
                        is both a truer picture of the mark and the only way it
                        reads: on the chalk surface a pass is drawn in near
                        white, and a bare white dot on a day-mode panel is
                        nothing at all. */}
                    <span
                      className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-ink-hair"
                      style={{ background: surface.palette.halo }}
                      aria-hidden="true"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: m.tone }} />
                    </span>
                    <span className="truncate text-[11px] font-bold text-ink-soft">{m.name}</span>
                    {m.faded !== undefined && (
                      <span className="shrink-0 rounded bg-ink-hair px-1 text-[10px] font-bold text-ink-faint">
                        {m.faded === 0 ? 'Hidden' : `${Math.round(m.faded * 100)}%`}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete this ${m.name.toLowerCase()}`}
                    onClick={() => {
                      patchAct('delete-mark', (a) => ({
                        ...a,
                        arrows: a.arrows.filter((x) => x.id !== m.id),
                        bands: a.bands.filter((b) => b.id !== m.id),
                        texts: (a.texts ?? []).filter((x) => x.id !== m.id),
                        gear: (a.gear ?? []).filter((g) => g.id !== m.id),
                      }))
                      seal()
                      if (selectedMarkId === m.id) setSelection(null)
                    }}
                    className="shrink-0 rounded px-1.5 text-xs font-bold text-ink-faint transition-colors hover:text-[#E2473B]"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {/*
               * HIDE, then reveal one. The pair above Clear, because they are
               * the reversible answer to the same wish and a coach who wanted
               * a quiet board should meet them before they meet the button
               * that throws the work away.
               *
               * `undefined` rather than 1 on the way back, so the arrows come
               * out of it storing nothing — the same policy every other
               * house-value control on this panel is on.
               */}
              <Tip text={HINT.hideArrows} title="Hide arrows">
                <Button
                  onClick={() => {
                    patchAct('hide-arrows', (a) => ({
                      ...a,
                      arrows: a.arrows.map((x) => ({ ...x, opacity: 0 })),
                    }))
                    seal()
                  }}
                  disabled={act.arrows.every((a) => (a.opacity ?? 1) === 0)}
                >
                  Hide all arrows
                </Button>
              </Tip>
              <Tip text={HINT.showArrows} title="Show arrows">
                <Button
                  onClick={() => {
                    patchAct('show-arrows', (a) => ({
                      ...a,
                      arrows: a.arrows.map((x) => ({ ...x, opacity: undefined })),
                    }))
                    seal()
                  }}
                  disabled={act.arrows.every((a) => (a.opacity ?? 1) === 1)}
                >
                  Show all arrows
                </Button>
              </Tip>
              <Tip text={HINT.clearArrows} title="Clear arrows">
                <Button
                  onClick={() => {
                    patchAct('clear-arrows', (a) => ({ ...a, arrows: [] }))
                    seal()
                  }}
                  disabled={act.arrows.length === 0}
                >
                  Clear arrows
                </Button>
              </Tip>
              <Tip text={HINT.clearZones} title="Clear zones">
                <Button
                  onClick={() => {
                    patchAct('clear-zones', (a) => ({ ...a, bands: [] }))
                    seal()
                  }}
                  disabled={act.bands.length === 0}
                >
                  Clear areas
                </Button>
              </Tip>
            </div>
          </>
        )}
      </Panel>
    </>
  )

  /*
   * The head of the right-hand panel. Two different things in the same slot.
   *
   * On a coach's own board it is the guide rail — five things they have learned
   * to do, and how many are left. On a locked one that is a scorecard for a game
   * the reader is not playing, so the invitation takes the slot instead. Same
   * position on the panel that carries the title and the caption, which are the
   * two fields most obviously somebody's.
   *
   * NOT inside `inert`. The card is the one thing on the panel that is meant to
   * be pressed.
   */
  const rail = locked ? (
    <SignInPanel onOpen={() => setWall(true)} />
  ) : (
    <GuideRail
      done={railDone}
      open={guide.railOpen}
      onToggle={(o) => markGuide({ railOpen: o })}
      onReplay={() => setWalkthrough(true)}
    />
  )

  const overlays = (
    <>
      {/*
        Outside `walkthrough`'s branch and outside every dialog, because the
        ring it leaves has to survive the panel closing — Show me shuts the
        panel first so it stops covering the rail it is pointing into, and a
        highlight mounted inside the thing that just unmounted would never be
        seen. See ./HelpRing.tsx.
      */}
      <HelpRing />
      {help && (
        <HelpPanel
          onClose={() => setHelp(false)}
          onWalkthrough={() => {
            setHelp(false)
            setWalkthrough(true)
          }}
          onNews={() => {
            setHelp(false)
            openNews()
          }}
        />
      )}
      {walkthrough && (
        <Walkthrough
          onClose={() => {
            setWalkthrough(false)
            // Caught up, not behind. Somebody who has just been shown the
            // studio for the first time has no "since you were last here", and
            // a list of six things they have never not had is a worse welcome
            // than no list at all.
            markGuide({ seen: true, newsSeen: NEWEST_NEWS_ID })
          }}
        />
      )}
      {upgradesWalkthrough && (
        <UpgradesWalkthrough
          onClose={() => {
            setUpgradesWalkthrough(false)
            markGuide({ upgradesSeen: true })
            if (guideRef.current.newsSeen !== NEWEST_NEWS_ID) openNews()
          }}
        />
      )}
      {sharing && (
        <ShareDialog
          system={system}
          identity={identity}
          onIdentity={setIdentityChoice}
          identityIsDefault={identityChoice === null}
          /* So the dialog can say "presenting as …" instead of asking again.
             See the effect that signs the board from the profile above. */
          signedFromProfile={Boolean(profile?.presenter.trim() || profile?.team.trim())}
          onCredit={patchCredit}
          onPublished={(id) => {
            rememberShareId(id)
            recordWin('share')
          }}
          onClose={closeExport}
        />
      )}
      {makingVideo && (
        <VideoDialog
          system={system}
          identity={identity}
          onIdentity={setIdentityChoice}
          identityIsDefault={identityChoice === null}
          unsigned={unsigned}
          onHold={(ms) => edit('pace', (sys) => ({ ...sys, hold: ms }))}
          onMove={(ms) => edit('pace', (sys) => ({ ...sys, move: ms }))}
          onPaceCommit={seal}
          onSaved={() => recordWin('video')}
          onClose={closeExport}
        />
      )}
      {exporting && (
        <ExportDialog
          system={system}
          actIndex={actIndex}
          identity={identity}
          onIdentity={setIdentityChoice}
          identityIsDefault={identityChoice === null}
          unsigned={unsigned}
          onSaved={() => recordWin('images')}
          onClose={closeExport}
        />
      )}
      {feedback && (
        <FeedbackDialog
          context={feedback}
          onClose={(sent) => {
            if (sent) markGuide({ feedbackSentAt: Date.now() })
            setFeedback(null)
          }}
        />
      )}
      {/* The only one of the five that a locked board can raise, and the only
          one the other four can never stack under: nothing else here opens. */}
      {wall && <SignInWall onClose={() => setWall(false)} />}

    </>
  )

  // ── stacked: the board on top, one panel under it ──────────────────────────
  if (stacked) {
    return (
      <>
      {/* `tf-screen` so printing takes the whole editor off the page and leaves
          the print sheet below it. See src/styles/global.css. */}
      <div className="tf-screen flex h-[100dvh] flex-col bg-paper-deep text-ink">
        {toolbar}
        <main className="flex shrink-0 select-none flex-col items-center gap-2 p-3">
          <div className="flex h-[36dvh] min-h-[180px] w-full items-center justify-center">{boardStage}</div>
          {boardLine}
        </main>
        {phaseStrip}
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-ink-hair bg-surface">
          {/* The rail leads on a locked board and trails on an unlocked one.
              Stacked, this panel is below the fold of a phone — an invitation
              at the bottom of it is an invitation nobody scrolls to, where the
              guide rail is a summary and belongs at the end. */}
          {locked && rail}
          {/* Switching which panel is on screen shows different controls; it
              changes nothing. So the tabs stay live even locked — this is how
              a stranger gets to SEE the phase panel at all. */}
          <div className="sticky top-0 z-10 border-b border-ink-hair bg-surface p-2">
            <Segmented
              label="Which controls to show"
              value={panelTab}
              onChange={setPanelTab}
              options={[
                { value: 'setup', label: 'Set up' },
                { value: 'phase', label: `This ${PHASE.one}` },
              ]}
            />
          </div>
          <div {...inert}>{panelTab === 'setup' ? setupPanel : phasePanel}</div>
          {!locked && rail}
        </div>
        {overlays}
      </div>

      {/*
       * ── THE PDF ─────────────────────────────────────────────────────────────
       *
       * Always in the document and never on screen: `display: none` until the
       * browser is printing, at which point this IS the page and `.tf-screen`
       * above is the part that disappears. The same sheet the shared viewer
       * prints (../viewer/PrintSheet.tsx), which is the property that matters —
       * a coach's own PDF and the one their assistant gets off the link are the
       * same document.
       *
       * OUTSIDE the `.tf-screen` element and not inside `overlays`, which is
       * where it was first put. `@media print` hides `.tf-screen` with an
       * `!important`, so a print sheet nested in it inherits the hiding and the
       * PDF comes out as one blank page — a fault that is invisible in the
       * editor and only shows up in the print preview.
       *
       * It is in the tree at all times rather than behind a button because
       * printing is the browser's own gesture: Cmd-P has to work, and the
       * Export dialog's PDF button is a second door onto the same thing rather
       * than the only one. The cost is one hidden render of every phase's board
       * per keystroke, and boards are cheap — the viewer has always carried
       * exactly this.
       */}
      <PrintSheet system={outbound} />
    </>
    )
  }

  // ── wide: panel, board, panel ──────────────────────────────────────────────
  return (
    <>
    <div className="tf-screen flex h-[100dvh] min-h-[620px] flex-col bg-paper-deep text-ink">
      {toolbar}

      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-ink-hair bg-surface" {...inert}>
          {setupPanel}
        </aside>

        <main className="flex min-w-0 flex-1 select-none flex-col items-center justify-center gap-3 overflow-hidden p-6">
          {boardStage}
          {boardLine}
        </main>

        {/* The rail is outside `inert` and the panel under it is inside, which
            is why this aside is not spread as a whole: the invitation at the top
            of this column has to stay pressable while everything below it is
            greyed. */}
        <aside className="w-64 shrink-0 overflow-y-auto border-l border-ink-hair bg-surface">
          {rail}
          <div {...inert}>{phasePanel}</div>
        </aside>
      </div>

      {phaseStrip}
      {overlays}
    </div>

      {/* Outside `.tf-screen`. See the stacked layout above for why. */}
      <PrintSheet system={outbound} />
    </>
  )
}

// ── small pieces ─────────────────────────────────────────────────────────────

/* ── HOLD SHIFT TO KEEP IT STRAIGHT ──────────────────────────────────────────
 *
 * A coach ruling corridors onto the board was eyeballing every one of them, and
 * a grid of eyeballed lines is a grid that says "about here" when the whole
 * point of drawing it was to say "here". Shift is the gesture every drawing
 * tool on earth already uses for this, so it needs no control, no setting and
 * nothing to discover: hold it and the drag comes out straight.
 *
 * IN METRES, NOT PERCENT, and that is the part worth reading twice. A drag is
 * held as percent-of-crop, and the crop is not square — on "their half" a
 * percent across is roughly a third of a percent along. Snapping to 45° in
 * percent space would therefore draw a line at 45° to nothing in particular,
 * and a "vertical" one would be vertical, correctly, only by accident of which
 * axis it fell on. Metres are the grass, the board preserves its aspect ratio
 * when it is fitted, so a diagonal constrained in metres is a diagonal on the
 * screen and a diagonal on the printed page.
 *
 * The upright view is the same rule read honestly: the axes are the PITCH's, so
 * a constrained line runs along or across the grass, which is what a coach
 * means by straight, and is the same direction the ruled grid runs. It appears
 * turned on screen because the whole pitch is turned.
 */

/** The eight directions a constrained drag can point in: every 45°. */
const CONSTRAIN_STEP = Math.PI / 4

/**
 * The far end of a drag, snapped to the nearest 45° from where it started.
 *
 * PROJECTED onto that direction rather than swung round to it, so the mark ends
 * level with the pointer instead of running past it. Snapping to the nearest of
 * eight means the pointer is never more than 22.5° off the chosen line, so the
 * projection never shortens the drag by more than eight percent — the line ends
 * where the coach is pointing, straightened.
 */
function constrainDrag(
  v: PitchView,
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  const a = toMetres(v, from.x, from.y)
  const b = toMetres(v, to.x, to.y)
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0 && dy === 0) return to
  const ang = Math.round(Math.atan2(dy, dx) / CONSTRAIN_STEP) * CONSTRAIN_STEP
  const ux = Math.cos(ang)
  const uy = Math.sin(ang)
  const len = dx * ux + dy * uy
  return toPercent(v, a.x + ux * len, a.y + uy * len)
}

/**
 * The far corner of a dragged box, squared off on the grass.
 *
 * A rectangle is already axis-aligned, so shift has nothing to straighten here
 * and the useful constraint is the other one every drawing tool offers: equal
 * sides. Squared in METRES for the same reason as above — a box with equal
 * percentages is a box that is only square on the full pitch.
 */
function constrainBox(
  v: PitchView,
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  const a = toMetres(v, from.x, from.y)
  const b = toMetres(v, to.x, to.y)
  const side = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))
  return toPercent(
    v,
    a.x + Math.sign(b.x - a.x || 1) * side,
    a.y + Math.sign(b.y - a.y || 1) * side,
  )
}

/** A rectangle in percent space from two dragged corners, always positive. */
function rectOf(a: { x: number; y: number }, b: { x: number; y: number }) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  }
}

/** What to call a mark in a list or a panel title. */
/** What is printed on a counter, for naming an arrow's end in a sentence. */
function tokenLabel(id: string | undefined, act: Act | undefined): string | null {
  if (!id || !act) return null
  return act.tokens.find((t) => t.id === id)?.label ?? null
}

/**
 * What a text mark is called in the list of marks.
 *
 * Its own first line, because that is what it IS. Trimmed to something that
 * fits a narrow panel without wrapping, and with the ellipsis added only when
 * something was actually cut — a name that ends in "…" when nothing was removed
 * is a small lie that makes a coach look for text that is not there.
 */
function textMarkName(t: { text: string }): string {
  const first = (t.text ?? '').split('\n')[0].trim()
  if (!first) return 'Empty text'
  return first.length > 24 ? `${first.slice(0, 24).trimEnd()}…` : first
}

function markName(mark: Arrow | Band, act: Act): string {
  // A label the coach typed wins over anything we would have called it. It is
  // the name they chose for the thing, it is already drawn on the board, and a
  // panel that calls it something else is a panel about a different mark. This
  // also does the work of telling three hand-drawn blocks apart, which "Our
  // block" three times over cannot.
  if ('kind' in mark && mark.label?.trim()) return mark.label.trim()

  if ('throughTokens' in mark && mark.throughTokens?.length) {
    const ours = bandSide(mark, act) === 'us'
    // The derived one is "the" block for its side. A hand-picked line is one of
    // possibly several, so it is named by its size instead of claiming to be
    // the side's block.
    if (!mark.drawn) return ours ? 'Our block' : 'Their block'
    const n = mark.throughTokens.length
    return `${ours ? 'Our' : 'Their'} block of ${n}`
  }
  if (mark.kind === 'block') return 'Block'
  return TOOL_DOC[mark.kind].label
}

/**
 * A tool's tooltip: what it means, then when to reach for it.
 *
 * The second line is the one that matters. A coach can work out that Pass draws
 * a passing arrow; what they cannot work out is that a switch is for the one
 * ball that moves the whole opposition, and a board where everything is a
 * switch says nothing.
 */
function ToolText({ id }: { id: ToolId }) {
  return (
    <>
      {TOOL_DOC[id].what}
      <span className="mt-1.5 block text-ink-faint">
        <span className="font-bold uppercase tracking-micro text-[9px]">When</span> {TOOL_DOC[id].when}
      </span>
    </>
  )
}

/**
 * Three thumbnails at the height the strip is currently set to.
 *
 * Draws the SETTING rather than the gesture. An up-down arrow would say that
 * something changes; this says what the strip is now, which is the half a coach
 * cannot otherwise read off a button.
 */
function StripGlyph({ size }: { size: StripSize }) {
  const h = size === 'small' ? 4 : size === 'medium' ? 7 : 10
  return (
    <svg viewBox="0 0 16 12" className="h-4 w-4" aria-hidden="true">
      {[1, 6, 11].map((x) => (
        <rect key={x} x={x} y={11 - h} width="4" height={h} rx="1" fill="currentColor" />
      ))}
    </svg>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 12 12" className="h-4 w-4" aria-hidden="true">
      <path
        d={dir === 'left' ? 'M7.5 2 L3.5 6 L7.5 10' : 'M4.5 2 L8.5 6 L4.5 10'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Undo / redo. A turning arrow, which is what everyone else's undo looks like. */
function Arc({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      aria-hidden="true"
      style={dir === 'right' ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path
        d="M3 7.5 A5 5 0 1 1 5.2 12.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M3 3.4 V7.7 H7.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * A fresh system: one phase, our 4-3-3, ball on the centre spot, no opposition.
 *
 * The ball is ON. It was off, and every single board a coach built began with
 * the same click to turn it on — a football board without a ball is not a
 * neutral starting point, it is an unfinished one. Turning it off is one click
 * for the rare act that is about shape alone, and every act after this one is a
 * copy of the one before it, so this decides the ball for the whole document.
 */
export function newSystem(): System {
  const f = FORMATION_BY_ID.get('4-3-3')!
  return {
    v: 1,
    title: '',
    pitch: 'full',
    matchBall: DEFAULT_BALL,
    surface: DEFAULT_SURFACE,
    // "Keep my shape" is ON for anything built from today, and OFF — by being
    // absent — on every document written before it existed. A coach lays out a
    // system across the whole pitch and then puts an opposition on ONE phase
    // of it; folding the shape into its own half for that one phase and back
    // out for the next would slide the whole team sideways mid-move. Systems
    // already saved keep the arrangement they were signed off with, and the
    // switch is right there in the Opposition panel either way.
    keepShape: true,
    teams: { us: DEFAULT_US, them: null },
    acts: [
      {
        ...emptyAct(place(f, 'us', 'full', 'position', true)),
        // UNTITLED, and it has to be: every phase after this one is a copy of
        // the one before it and now keeps its title, so a starter stamped
        // "Phase 1" would put "Phase 1" on all thirty-six of them. An empty
        // title draws nothing at all, which is the right thing for a board
        // whose coach has not said what it is about yet.
        title: '',
        // `newBall()` sits on the centre spot, so the legacy mirror agrees.
        ...ballFields([newBall()]),
      },
    ],
  }
}
