/**
 * The pitch surfaces: what the board is drawn ON.
 *
 * Until now there was exactly one, and ./palette.ts said so in capitals: THE
 * BOARD IS ALWAYS LIGHT. That rule has not been abandoned, it has been made
 * precise. What it was protecting is that a deck must look the same to everyone
 * who sees it — the coach who made it, the room it is shown in, the phone it is
 * forwarded to. A board that followed the VIEWER's day/night setting breaks
 * that, because the same link then renders two different diagrams.
 *
 * A surface does not break it, because the surface is a property of the
 * DOCUMENT (see System.surface in ../schema.ts), chosen once by the coach and
 * carried into every export, print and share. Paper is still the default and
 * still the house look. The others are choices the coach makes on purpose, the
 * same way they choose the match ball.
 *
 * ── WHAT A SURFACE HAS TO SUPPLY ─────────────────────────────────────────────
 *
 * Everything on the board that is not a team colour. Not just the grass: the
 * markings, the type, the arrow ink, the knock-out behind that type, the light
 * and the vignette. Half a palette is the trap here — swap the grass for green
 * and leave the arrows on #161618 and a pass across the pitch disappears.
 *
 * So a surface is a COMPLETE BoardPalette, every consumer reads it through
 * `useSurface()`, and there is no path by which a component can accidentally
 * keep drawing in paper's ink.
 */

import { createContext, useContext } from 'react'
import { BOARD } from './palette'

/** Everything the board draws with, other than the two teams' colours. */
export interface BoardPalette {
  /** The ground beyond the pitch. Three stops, top → bottom. */
  stage: [string, string, string]
  /** The pitch rectangle itself, top → bottom. null = the stage shows through. */
  grass: [string, string] | null
  /** The mown pattern inside the pitch. */
  mow: {
    kind: 'checker' | 'stripe' | 'none'
    color: string
    alpha: number
    /** Band width (stripe) or square size (checker), in metres. */
    size: number
  }
  /** Pitch markings. */
  line: string
  lineSoft: string
  /**
   * Type, and the default arrow ink.
   *
   * `ink` and `halo` must be plain hex, not rgba: the video exporter derives
   * translucent variants of both with `rgba()` below, for a canvas that has no
   * concept of "this colour, softer".
   */
  ink: string
  inkSoft: string
  /** A cue chip filled with `ink`. Softened on paper, solid on the dark grounds. */
  inkChip: string
  /** Label colour that reads on top of `ink` / `inkSoft`. */
  onInk: string
  /**
   * The knock-out behind type and under arrow casings. It is the GROUND the
   * mark sits on, so it is grass where there is grass and paper where there is
   * not — never a fixed off-white, which on a green pitch draws a white
   * halo round every arrow.
   */
  halo: string
  gold: string
  goldDeep: string
  green: string
  greenDeep: string
  red: string
  redDeep: string
  /**
   * The fourth accent, and the only one that is not already a brand value.
   *
   * It exists for the shaded areas and nothing else. Gold, green and red are
   * all SAID something by the house style — gold is the ball and the thing to
   * watch, green is our team and a run, red is the opposition — so a coach who
   * wants a second neutral area on the same board has nowhere to put it that
   * does not read as a claim. Blue is the one accent with no meaning attached,
   * which is exactly what a "this space, over here" needs.
   *
   * Picked per surface rather than shared, for the reason spelled out on
   * BROADCAST below: a mid blue that reads on paper disappears on grass.
   */
  blue: string
  blueDeep: string
  /**
   * The four extra area colours.
   *
   * They exist for the same reason `blue` does and are held to the same test:
   * a shaded area has to read on all four grounds, so each one is picked per
   * surface rather than shared. They carry no house meaning — gold, green and
   * red are already spoken for, and a coach shading three neutral spaces on one
   * board needs three colours that are not making a claim.
   *
   * WHY THESE FOUR. They are the ones that stay apart from each other AND from
   * the three that mean something, on grass and on paper: violet and teal sit
   * where nothing else does, pink survives a green pitch better than any other
   * warm colour, and orange is the one coaches ask for by name. There is no
   * second yellow and no second green, because neither would be tellable from
   * the ball or from a run at the size a board is actually looked at.
   */
  violet: string
  orange: string
  teal: string
  pink: string
  /** Top-light, screened over everything. */
  light: { color: string; opacity: number }
  /** Edge fall-off, so the board sits in its frame rather than floating. */
  vignette: { color: string; opacity: number }
  /** The paper grain, at export only. Multiply on light grounds, screen on dark. */
  grain: { opacity: number; blend: 'multiply' | 'screen' }
}

/**
 * A palette hex at some opacity, as a CSS colour.
 *
 * For the video exporter, which draws its chrome onto a canvas: `ctx.fillStyle`
 * and `ctx.shadowColor` take one colour and there is no globalAlpha to spare —
 * it is already carrying the phase's own fade.
 */
export function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

export type PitchSurfaceId = 'paper' | 'broadcast' | 'night' | 'chalk'

export interface PitchSurface {
  id: PitchSurfaceId
  /** How a coach would ask for it. */
  name: string
  /** One line under the picker, in their language rather than ours. */
  story: string
  palette: BoardPalette
}

/**
 * THE HOUSE SURFACE. Exactly the numbers ./palette.ts has always drawn with,
 * restated as a palette rather than re-picked — `BOARD` is still the one place
 * the paper stage's hexes live, and the marketing components that draw a pitch
 * outside the studio still read it directly.
 */
const PAPER: BoardPalette = {
  stage: ['#F2F4EF', BOARD.paper, BOARD.paper2],
  grass: null,
  mow: { kind: 'checker', color: BOARD.turf, alpha: 1, size: 7 },
  line: BOARD.line,
  lineSoft: BOARD.lineSoft,
  ink: BOARD.ink,
  inkSoft: BOARD.inkSoft,
  inkChip: 'rgba(22,22,24,0.92)',
  onInk: '#FFFFFF',
  halo: BOARD.paper,
  gold: BOARD.gold,
  goldDeep: BOARD.goldDeep,
  green: BOARD.green,
  greenDeep: BOARD.greenDeep,
  red: BOARD.red,
  redDeep: BOARD.redDeep,
  blue: '#2F7BD6',
  blueDeep: '#2364B4',
  violet: '#7A4FD1',
  orange: '#E07A1F',
  teal: '#12938C',
  pink: '#D63C86',
  light: { color: '#FFFFFF', opacity: 0.55 },
  vignette: { color: '#141A16', opacity: 0.18 },
  grain: { opacity: 0.05, blend: 'multiply' },
}

/**
 * BROADCAST. A match on television: saturated turf, mown bands across the
 * length, hard white lines.
 *
 * The accents are lifted off the brand values rather than kept at them, and
 * that is the whole difference between this reading as designed and reading as
 * the paper board with a green filter over it. `greenDeep` (#06A659) is a run
 * arrow, and a run arrow drawn in it on this grass is a run arrow nobody can
 * see. Gold survives green almost untouched, which is why the videos use it for
 * the player to watch.
 */
const BROADCAST: BoardPalette = {
  stage: ['#1A5C34', '#15512D', '#104324'],
  grass: ['#2E8F53', '#22703E'],
  mow: { kind: 'stripe', color: '#FFFFFF', alpha: 0.055, size: 8 },
  line: 'rgba(255,255,255,0.86)',
  lineSoft: 'rgba(255,255,255,0.42)',
  ink: '#F5F9F3',
  inkSoft: 'rgba(245,249,243,0.72)',
  inkChip: '#F5F9F3',
  onInk: '#14472A',
  halo: '#1D5F37',
  gold: '#F2C55E',
  goldDeep: '#E4B23C',
  green: '#7CF2B0',
  greenDeep: '#5BE49B',
  red: '#FF7A6B',
  redDeep: '#F2604F',
  blue: '#8FCBFF',
  blueDeep: '#6DB4F5',
  violet: '#C0A6FF',
  orange: '#FFA765',
  teal: '#66E3D6',
  pink: '#FF9AC8',
  light: { color: '#FFFFFF', opacity: 0.12 },
  vignette: { color: '#03170C', opacity: 0.36 },
  grain: { opacity: 0.07, blend: 'screen' },
}

/**
 * NIGHT. The same pitch under floodlights: the green goes deep and cool, the
 * lines go to bone rather than white, and the light pools in the middle instead
 * of falling evenly. The vignette does most of the work — a floodlit pitch is a
 * bright middle inside a dark stadium, and without a heavy edge it just reads as
 * a dim broadcast.
 */
const NIGHT: BoardPalette = {
  stage: ['#081A10', '#05120A', '#030C06'],
  grass: ['#0E3D24', '#072617'],
  mow: { kind: 'stripe', color: '#DFF3E6', alpha: 0.045, size: 8 },
  line: 'rgba(232,246,237,0.62)',
  lineSoft: 'rgba(232,246,237,0.28)',
  ink: '#ECF5EE',
  inkSoft: 'rgba(236,245,238,0.7)',
  inkChip: '#ECF5EE',
  onInk: '#0B2E1C',
  halo: '#0C3520',
  gold: '#F5CB6A',
  goldDeep: '#E8B845',
  green: '#6FEFA8',
  greenDeep: '#4FDD93',
  red: '#FF8172',
  redDeep: '#F2685A',
  blue: '#8ACDFF',
  blueDeep: '#65B6F2',
  violet: '#C2A8FF',
  orange: '#FFAB6E',
  teal: '#6BE8DA',
  pink: '#FF9ECB',
  // Held DELIBERATELY low. `light` is screened over the whole board, and screen
  // is not a subtle operator on a dark ground: at the 0.55 paper wants, a
  // floodlit pitch comes out the colour of a wet afternoon. The pool has to be
  // faint and the vignette heavy, which is also what a floodlit pitch is —
  // a bright middle inside a dark stadium.
  light: { color: '#DCEEFF', opacity: 0.09 },
  vignette: { color: '#000804', opacity: 0.56 },
  grain: { opacity: 0.06, blend: 'screen' },
}

/**
 * CHALK. The board in the dressing room: slate, chalk-white markings, no grass
 * and no mow. The one surface that is not pretending to be a pitch, and the one
 * a coach reaches for when the session is about shape rather than about a game.
 */
const CHALK: BoardPalette = {
  stage: ['#1B1F22', '#15181B', '#101315'],
  grass: ['#1E2226', '#171A1D'],
  mow: { kind: 'none', color: '#FFFFFF', alpha: 0, size: 7 },
  line: 'rgba(242,246,238,0.6)',
  lineSoft: 'rgba(242,246,238,0.26)',
  ink: '#F3F4EF',
  inkSoft: 'rgba(243,244,239,0.64)',
  inkChip: '#F3F4EF',
  onInk: '#16191C',
  halo: '#1A1E21',
  gold: '#F2C55E',
  goldDeep: '#E4B23C',
  green: '#6BE9A4',
  greenDeep: '#4BD68F',
  red: '#FF8172',
  redDeep: '#F2685A',
  blue: '#84C3F5',
  blueDeep: '#61A9E6',
  violet: '#B9A2F2',
  orange: '#F5A469',
  teal: '#6BDFD1',
  pink: '#F79AC4',
  light: { color: '#FFFFFF', opacity: 0.07 },
  vignette: { color: '#000000', opacity: 0.46 },
  grain: { opacity: 0.1, blend: 'screen' },
}

/** In picker order. Paper first: it is the house default and stays it. */
export const PITCH_SURFACES: PitchSurface[] = [
  {
    id: 'paper',
    name: 'Paper',
    story: 'The stage every published short is drawn on. Prints cleanly and reads in any room.',
    palette: PAPER,
  },
  {
    id: 'broadcast',
    name: 'Broadcast',
    story: 'A match on television: mown turf, hard white lines.',
    palette: BROADCAST,
  },
  {
    id: 'night',
    name: 'Night',
    story: 'The same pitch under floodlights. The one for a screen in a dark room.',
    palette: NIGHT,
  },
  {
    id: 'chalk',
    name: 'Chalk',
    story: 'Slate and chalk, no grass. For sessions about shape rather than a game.',
    palette: CHALK,
  },
]

export const SURFACE_BY_ID = new Map(PITCH_SURFACES.map((s) => [s.id, s]))

export const DEFAULT_SURFACE: PitchSurfaceId = 'paper'

/** Coerce a stored id — including one we have since dropped — to a real surface. */
export function resolveSurface(id: string | undefined): PitchSurface {
  return SURFACE_BY_ID.get((id ?? DEFAULT_SURFACE) as PitchSurfaceId)
    ?? SURFACE_BY_ID.get(DEFAULT_SURFACE)!
}

/**
 * The palette the board is currently drawing in.
 *
 * Provided by Board.tsx from the document's own surface, so every part of the
 * board — markings, counters, arrows, bands — is reading one palette and none of
 * them can be left behind on paper's ink. The default is PAPER, which is what
 * keeps the marketing components that render a `Token` outside a `Board`
 * working exactly as before.
 */
export const SurfaceContext = createContext<BoardPalette>(PAPER)

export function useSurface(): BoardPalette {
  return useContext(SurfaceContext)
}

/** Cue colours. PRESS is the hot one: gold is "the player to watch". */
export function cueColor(p: BoardPalette): Record<string, string> {
  return {
    PRESS: p.goldDeep,
    COVER: p.ink,
    BALANCE: p.greenDeep,
    SPARE: p.inkSoft,
    JOCKEY: p.goldDeep,
    DROP: p.greenDeep,
  }
}

/**
 * Arrow treatments, one per intent.
 *
 * `width` and `dash` are in METRES, like every other size on the board, and are
 * converted at draw time. Storing a dash as a ready-made SVG string is the trap
 * here: `strokeDasharray` is in user units, so "1.6 1.1" would mean 16cm of ink
 * and 11cm of gap and render as a solid line.
 *
 * `head` IS ON EVERY ROW, including the five that have never had a choice about
 * it. A `head?: boolean` read as "absent means yes" would put the knowledge
 * that a pass has an arrowhead in the drawing code rather than in this table,
 * and this table is meant to be the whole answer to "what does this kind look
 * like" — somebody adding the sixth kind should be able to read the row above
 * theirs and know what they have to fill in.
 */
export function arrowStyle(p: BoardPalette) {
  return {
    pass: { color: p.ink, dash: null as [number, number] | null, width: 0.42, wavy: false, head: true },
    run: { color: p.greenDeep, dash: [1.5, 1.05] as [number, number] | null, width: 0.42, wavy: false, head: true },
    carry: { color: p.ink, dash: null as [number, number] | null, width: 0.42, wavy: true, head: true },
    press: { color: p.goldDeep, dash: null as [number, number] | null, width: 0.5, wavy: false, head: true },
    switch: { color: p.ink, dash: [2.4, 1.3] as [number, number] | null, width: 0.5, wavy: false, head: true },
    /*
     * The divider. Solid ink, no head, and THINNER than a pass on purpose.
     *
     * A line is the only mark here that is not an event. It sits under the
     * football rather than in it — the height the press starts from, the line
     * they will not step past — so it has to be readable without competing
     * with the arrows drawn across it. Same colour as a pass at the same weight
     * would have made the quietest mark on the board the loudest.
     */
    line: { color: p.ink, dash: null as [number, number] | null, width: 0.3, wavy: false, head: false },
  }
}

/** Band fills, keyed by kind. Widths and opacities match the videos' BlockBand. */
export function bandStyle(p: BoardPalette) {
  return {
    block: { tone: p.green, fill: 0.22, edge: 0.4, string: 0.7 },
    danger: { tone: p.gold, fill: 0.18, edge: 0.35, string: 0 },
    zone: { tone: p.ink, fill: 0.08, edge: 0.22, string: 0 },
  }
}

/**
 * The colours a coach may repaint a shaded area in.
 *
 * A LIST, AND NOT A COLOUR PICKER. The board is the house style and the whole
 * constraint the studio is built on is that a coach chooses MEANING and we
 * choose the drawing — the same argument that makes arrows take an intent
 * rather than a dash pattern. A hex field would let somebody put a purple
 * trapezium on a broadcast pitch, and the first thing that happens to a board
 * like that is that it stops looking like it came off the channel.
 *
 * The list went from five to nine (user, 2026-08-21) and the constraint did
 * not move: every one of them is still picked BY US, per surface, and tested
 * against the four grounds. What changed is that five was not enough colours to
 * say four different things on one board — a coach shading a trap, a channel
 * and two pockets ran out at three and started reusing red, which reads as
 * danger whether they meant it or not.
 *
 * Each one resolves through the surface's own palette, so "red" on paper and
 * "red" on a floodlit pitch are two different hexes and both of them read.
 * That is why this is a function of the palette and not a table of colours.
 *
 * The names are what a coach would say out loud, and the notes say what each
 * one already means on our boards, so picking one is picking a meaning. The
 * first five carry meaning; the last four deliberately do not, and their notes
 * say so rather than inventing one.
 */
export type BandTone = 'gold' | 'red' | 'green' | 'blue' | 'grey' | 'violet' | 'orange' | 'teal' | 'pink'

export const BAND_TONES: { id: BandTone; label: string; note: string }[] = [
  { id: 'gold', label: 'Gold', note: 'The space to attack. The house colour for the thing to watch.' },
  { id: 'red', label: 'Red', note: 'Danger, or where they hurt you.' },
  { id: 'green', label: 'Green', note: 'Ours: the block, the space we are protecting.' },
  { id: 'blue', label: 'Blue', note: 'Neutral. A channel, a trap, a zone with nothing claimed about it.' },
  { id: 'grey', label: 'Grey', note: 'Quiet. Shades an area without pulling the eye to it.' },
  { id: 'violet', label: 'Violet', note: 'A second neutral, for when blue is already saying something else.' },
  { id: 'orange', label: 'Orange', note: 'Warm without being danger. Good for a second space to attack.' },
  { id: 'teal', label: 'Teal', note: 'Cool and quiet. Reads clearly on grass, where grey goes muddy.' },
  { id: 'pink', label: 'Pink', note: 'The one nothing else on a pitch looks like. For the area that must not be missed.' },
]

export function bandTone(p: BoardPalette, tone: BandTone): string {
  switch (tone) {
    case 'gold':
      return p.gold
    case 'red':
      return p.red
    case 'green':
      return p.green
    case 'blue':
      return p.blue
    case 'grey':
      return p.ink
    case 'violet':
      return p.violet
    case 'orange':
      return p.orange
    case 'teal':
      return p.teal
    case 'pink':
      return p.pink
  }
}

/**
 * How strongly a shaded area is laid down: a multiplier on the house opacity.
 *
 * A multiplier and not an opacity, so the three kinds keep their relationship
 * to each other — a block at "Strong" is still heavier than a zone at "Strong",
 * because a block is the more important mark and the house style says so. A
 * coach setting an absolute alpha would flatten that on the first board they
 * touched.
 *
 * Three steps rather than a slider. The difference between 0.55 and 0.6 is not
 * visible on a pitch, so a slider offers a precision that does not exist and
 * costs a decision every time it is looked at.
 */
export type BandStrength = 'soft' | 'normal' | 'strong'

export const BAND_STRENGTHS: { id: BandStrength; label: string; mul: number }[] = [
  { id: 'soft', label: 'Soft', mul: 0.55 },
  { id: 'normal', label: 'Normal', mul: 1 },
  { id: 'strong', label: 'Strong', mul: 1.75 },
]

/**
 * The outline round a shaded area.
 *
 * Dashed says "this region, roughly"; solid says the edge is real; none takes
 * the line away entirely and leaves the shading to do the work, which is what a
 * soft area behind a busy part of the pitch wants.
 *
 * `solid?: boolean` in ../schema.ts is the older, narrower version of this
 * control and is still read — see `resolveBandStyle`. Nothing writes it any
 * more, and no stored document changes meaning.
 */
export type BandEdge = 'solid' | 'dashed' | 'none'

export const BAND_EDGES: { id: BandEdge; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'none', label: 'None' },
]

/**
 * How the inside of a shaded area is rendered.
 *
 * 'shade'  — the default: a gradient fill and (for a block) the string through
 *            the players.
 * 'none'   — no fill; the border outline speaks for itself.
 * 'hatch'  — ruled diagonally instead of washed. The same ink as a shade, laid
 *            on as lines, which is how a coach's own slide marks a channel he
 *            wants crossed: it says "this space, treated differently" without
 *            burying the grass or the players standing on it, and it survives
 *            being printed in black and white, which a wash does not.
 * 'line'   — no fill and no border polygon at all. Only the string threaded
 *            through the players is drawn. NOT hatching, despite the name:
 *            "line" here is the string through a block's players. Meaningful
 *            only on a block (which has a string); on an area drawn as a box it
 *            would leave nothing visible at all, so the UI gates it to blocks.
 */
export type BandFill = 'shade' | 'none' | 'line' | 'hatch'

export const BAND_FILLS: { id: BandFill; label: string }[] = [
  { id: 'shade', label: 'Shaded' },
  { id: 'hatch', label: 'Hatched' },
  { id: 'none', label: 'Outline' },
  { id: 'line', label: 'Line only' },
]

/**
 * The line threaded through the players a block runs through.
 *
 * It is what says "these men are one unit" rather than "this area happens to
 * have players in it", so it is on by default on a block and has never existed
 * on an area drawn as a box. Off is for the coach who wants the space and not
 * the string.
 */
export type BandString = 'off' | 'thin' | 'normal' | 'thick'

export const BAND_STRINGS: { id: BandString; label: string; width: number }[] = [
  { id: 'off', label: 'Off', width: 0 },
  { id: 'thin', label: 'Thin', width: 0.62 },
  { id: 'normal', label: 'Mid', width: 1.15 },
  { id: 'thick', label: 'Thick', width: 1.8 },
]

/**
 * How far a closed block sits off its players.
 *
 * One number, because the shape is a hull grown by exactly this much in every
 * direction (see `dilatedHull` in ./Overlays.tsx) — so the padding IS the
 * corner radius, and a coach moving one is moving both, which is the
 * relationship they would have to keep by hand otherwise.
 *
 * In metres from the centre of a counter, so the floor is `TOKEN_R` (2.1m)
 * plus enough to clear the ring: anything under about 2.5 cuts through the
 * players it is supposed to be holding together.
 */
export type BandCorner = 'tight' | 'soft' | 'loose'

export const BAND_CORNERS: { id: BandCorner; label: string; pad: number }[] = [
  { id: 'tight', label: 'Tight', pad: 2.9 },
  { id: 'soft', label: 'Soft', pad: 3.7 },
  { id: 'loose', label: 'Loose', pad: 4.9 },
]

/** What the coach has overridden, as stored — loose strings, narrowed here. */
export interface BandOverrides {
  tone?: string
  strength?: string
  edge?: string
  fill?: string
  string?: string
  corner?: string
  /** The older boolean form of `edge`. Read, never written. */
  solid?: boolean
}

const pick = <T extends { id: string }>(table: T[], id: string | undefined): T | undefined =>
  table.find((t) => t.id === id)

/**
 * The style one band actually draws with: the house treatment for its kind,
 * with whatever the coach has overridden on top.
 *
 * ONE FUNCTION, called by the board and by nothing else, so the precedence
 * between "what kind of area is this" and "what did the coach ask for" is
 * decided in a single place. Every override is resolved through a table, so a
 * value we do not recognise — a document written by a newer build — falls back
 * to the house treatment instead of drawing nothing.
 *
 * Fill is clamped: at 1.75x a block would be approaching opaque, and a shaded
 * area you cannot see the players through is not a shaded area, it is a hole in
 * the board.
 */
export function resolveBandStyle(
  p: BoardPalette,
  kind: 'block' | 'danger' | 'zone',
  overrides?: BandOverrides,
) {
  const base = bandStyle(p)[kind]
  const mul = pick(BAND_STRENGTHS, overrides?.strength)?.mul ?? 1
  const toneId = pick(BAND_TONES, overrides?.tone)?.id
  // A block's outline is solid by default and an area's is dashed, which is the
  // difference between a line of players and a region of grass. `solid: true`
  // is the old control and still means what it meant.
  const houseEdge: BandEdge = kind === 'block' ? 'solid' : 'dashed'
  const edge = pick(BAND_EDGES, overrides?.edge)?.id ?? (overrides?.solid ? 'solid' : houseEdge)
  const fill = pick(BAND_FILLS, overrides?.fill)?.id ?? 'shade'
  // Only a block has ever had a string; an area drawn as a box has no line of
  // players to thread. `base.string` carries that (0.7 on a block, 0 on the
  // rest), so an override on an area is ignored rather than inventing one.
  const stringId = pick(BAND_STRINGS, overrides?.string)?.id
  const corner = pick(BAND_CORNERS, overrides?.corner) ?? BAND_CORNERS[1]

  const ink = Math.min(0.9, base.edge * (mul > 1 ? 1.25 : 1))

  // 'line' mode: no polygon at all — the string through the players is the
  // entire mark. No blank guard applies because the mark IS visible.
  if (fill === 'line') {
    return {
      tone: toneId ? bandTone(p, toneId) : base.tone,
      fill: 0,
      edge: 0,
      dashed: false,
      string: base.string > 0 && stringId === 'off' ? 0 : base.string,
      stringWidth: pick(BAND_STRINGS, stringId)?.width ?? 1.15,
      pad: corner.pad,
      hatch: false,
    }
  }

  /*
   * A mark that is neither shaded nor outlined is not a mark, it is a hole in
   * the document: invisible on the board, unhittable with a pointer, and
   * findable only in the list of marks. Outline wins in that case, because the
   * coach who turned the shading off is the one who wanted the edge.
   *
   * This guard does NOT fire for 'line' (handled above): a line-only block is
   * visible via its string and must never have an outline forced onto it.
   */
  const blank = fill === 'none' && edge === 'none'

  return {
    tone: toneId ? bandTone(p, toneId) : base.tone,
    /** 0 when the coach asked for an outline: the gradient is still built, at zero. */
    fill: fill === 'none' ? 0 : Math.min(0.46, base.fill * mul),
    /** Stroke opacity. 0 means no outline at all. */
    edge: edge === 'none' && !blank ? 0 : ink,
    dashed: blank ? houseEdge === 'dashed' : edge === 'dashed',
    /** Stroke opacity of the string through the players. */
    string: base.string > 0 && stringId === 'off' ? 0 : base.string,
    /** Its width in metres. Left at the house width unless the coach moved it. */
    stringWidth: pick(BAND_STRINGS, stringId)?.width ?? 1.15,
    /** How far a closed block sits off its players, in metres. */
    pad: corner.pad,
    /**
     * Rule the inside rather than washing it. `fill` above still carries the
     * strength the coach asked for — the drawing decides what to do with it,
     * which is a wash at that opacity or ruled lines carrying the same ink.
     */
    hatch: fill === 'hatch',
  }
}

// ── written text ─────────────────────────────────────────────────────────────

/**
 * How big a piece of text on the board is, in METRES of grass.
 *
 * Metres and not pixels, and not points, for the reason every other measurement
 * on this board is metres: all five pitch views crop the same 68m width, so a
 * caption written at 2.6m is the same size on screen on a full pitch and in the
 * final third. Set it in pixels and the same note is a whisper on one view and
 * a billboard on another.
 *
 * The steps are named against what is already on the board rather than against
 * each other, because "medium" tells a coach nothing and "as tall as the number
 * on a counter" tells them exactly where it will land. A counter is 4.2m across
 * and its number is drawn at about 1.7m, which is what makes `note` the step
 * that matches the board's own type.
 */
export type TextSize = 'xs' | 's' | 'm' | 'l' | 'xl'

export const TEXT_SIZES: { id: TextSize; label: string; note: string; metres: number }[] = [
  { id: 'xs', label: 'XS', note: 'Smaller than a shirt number. For a note beside a mark.', metres: 1.3 },
  { id: 's', label: 'S', note: 'About the size of the number on a counter.', metres: 1.8 },
  { id: 'm', label: 'M', note: 'Reads across a room. The one to write a coaching point at.', metres: 2.5 },
  { id: 'l', label: 'L', note: 'As tall as a counter. A heading on the board.', metres: 3.6 },
  { id: 'xl', label: 'XL', note: 'The biggest thing on the pitch. One phrase, no more.', metres: 5.2 },
]

/**
 * How the text sits on the grass.
 *
 * Three, and each one solves a different legibility problem rather than being a
 * decoration:
 *
 *  · `halo` is the board's own trick, the one the player names already use: the
 *    type is stroked in the surface's halo colour underneath itself, so it holds
 *    its edge over a pitch line, a shaded area or a counter without putting a
 *    box on the board. It is the default because it costs nothing visually.
 *  · `plate` is a filled card behind the words. For a note that has to survive
 *    being written across the busiest part of the board, and for anything a
 *    coach wants to read as a caption rather than as a marking.
 *  · `bare` is the type and nothing else. For a big quiet heading on empty
 *    grass, where a halo would only add a fringe.
 */
export type TextLook = 'halo' | 'plate' | 'bare'

export const TEXT_LOOKS: { id: TextLook; label: string; note: string }[] = [
  { id: 'halo', label: 'Halo', note: 'Outlined in the board colour, so it reads over anything.' },
  { id: 'plate', label: 'Plate', note: 'On a filled card. The most legible, and the loudest.' },
  { id: 'bare', label: 'Plain', note: 'Just the letters. For a heading on empty grass.' },
]

export type TextWeight = 'regular' | 'bold' | 'black'

export const TEXT_WEIGHTS: { id: TextWeight; label: string; value: number }[] = [
  { id: 'regular', label: 'Regular', value: 500 },
  { id: 'bold', label: 'Bold', value: 700 },
  { id: 'black', label: 'Heavy', value: 900 },
]

export type TextAlign = 'left' | 'center' | 'right'

export const TEXT_ALIGNS: { id: TextAlign; label: string; anchor: 'start' | 'middle' | 'end' }[] = [
  { id: 'left', label: 'Left', anchor: 'start' },
  { id: 'center', label: 'Centre', anchor: 'middle' },
  { id: 'right', label: 'Right', anchor: 'end' },
]

/**
 * Everything a text mark needs to draw itself, resolved from what the coach
 * chose and what this build knows about.
 *
 * Same posture as `resolveBandStyle`: every field goes through a table, so a
 * value written by a newer build falls back to the house treatment rather than
 * drawing nothing. A document must stay readable in an older studio.
 */
export function resolveTextStyle(
  p: BoardPalette,
  overrides?: { size?: string; look?: string; weight?: string; align?: string; tone?: string },
) {
  const size = pick(TEXT_SIZES, overrides?.size) ?? TEXT_SIZES[2]
  const look = pick(TEXT_LOOKS, overrides?.look) ?? TEXT_LOOKS[0]
  const weight = pick(TEXT_WEIGHTS, overrides?.weight) ?? TEXT_WEIGHTS[2]
  const align = pick(TEXT_ALIGNS, overrides?.align) ?? TEXT_ALIGNS[1]
  const toneId = pick(BAND_TONES, overrides?.tone)?.id
  const colour = toneId ? bandTone(p, toneId) : p.ink

  return {
    /** Cap height in METRES. The caller converts with `U`. */
    metres: size.metres,
    look: look.id,
    weight: weight.value,
    anchor: align.anchor,
    align: align.id,
    colour,
    /*
     * On a plate the words are drawn on the tone, so they cannot also BE the
     * tone. `onInk` is the surface's own answer to "what do you write on a
     * filled ink chip", which is the same question — see the cue chips in
     * ../board/Token.tsx, which have had this problem solved since the start.
     */
    plateInk: colour === p.ink || colour === p.inkSoft ? p.onInk : '#FFFFFF',
    plateFill: colour === p.ink ? p.inkChip : colour,
    halo: p.halo,
  }
}

/**
 * The paper instances of the three, for the illustrations that draw an arrow or
 * a cue OUTSIDE a board — the walkthrough's diagram, chiefly. They are derived
 * rather than written out a second time, so a change to the house treatment
 * cannot land on the board and miss the diagram explaining it.
 */
export const CUE_COLOR = cueColor(PAPER)
export const ARROW_STYLE = arrowStyle(PAPER)
export const BAND_STYLE = bandStyle(PAPER)
