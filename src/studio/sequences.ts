/**
 * Saved sequences: a coach's personal library of reusable movement patterns.
 *
 * ── WHAT A SEQUENCE IS ───────────────────────────────────────────────────────
 *
 * A sequence is a slice of phases (Acts) extracted from a system, stripped of
 * identity, and stored for reuse. It is "the third-man run", not "the
 * third-man run that Owusu and Petrou did last Tuesday". When applied to a
 * new system, the positions are matched to whoever is on the board by
 * proximity, exactly as `injectSequence` in ./inject.ts already does.
 *
 * ── PERSON FIELDS ARE STRIPPED ───────────────────────────────────────────────
 *
 * `name`, `photo`, `playerId` are removed on capture. A sequence is a
 * movement pattern, and binding it to a squad would mean it stops working the
 * moment a player leaves. `label` and `side` survive — the first helps with
 * matching ("a CB, not a winger"), and the second tells us which team this
 * token belongs to. See PERSON_FIELDS and ROLE_FIELDS in ./schema.ts.
 *
 * ── COORDINATES AND VIEWS ────────────────────────────────────────────────────
 *
 * All positions in the studio are percent-of-crop (0–100), and the crop is
 * the pitch view. A player at (25, 50) on "attacking-half" is on a different
 * patch of grass to one at (25, 50) on "full". So every sequence stores the
 * `sourcePitch` it was captured from, and `remap()` in ./board/pitch.ts
 * translates the coordinates when the sequence is applied to a different view.
 * That function already handles every pitch-view switch in the editor.
 *
 * ── OPTIONAL REGION CAPTURE ──────────────────────────────────────────────────
 *
 * A coach may capture only a rectangle of the pitch — one corner of a rondo,
 * one channel of a pressing drill. When they do, coordinates are NORMALISED
 * to that region (0–100 within the rect) on capture, and DENORMALISED back
 * on apply. This means a 4v1 box captured from the left side of the pitch
 * works identically when placed on the right.
 *
 * ── STORAGE ──────────────────────────────────────────────────────────────────
 *
 * Local-first, cloud-synced — the same architecture as systems. A sequence is
 * in localStorage within a keystroke and in Supabase within a debounce, so
 * nothing is lost to a dropped connection. See ./storage.ts for the pattern
 * and the reasoning behind it.
 */

import type { Act, Arrow, Band, BallMark, GearMark, TextMark, Token, TeamStyle } from './schema'
import { uid, ballsOf, ballFields } from './schema'
import type { PitchViewId, SessionArea } from './board/pitch'
import { viewFor, remap } from './board/pitch'
import { scopedKey } from './scope'

// ── types ────────────────────────────────────────────────────────────────────

/** A rectangular region of the pitch, in percent-of-crop coordinates. */
export interface SequenceRegion {
  x: number
  y: number
  w: number
  h: number
}

/**
 * A saved sequence: a named, reusable set of phases.
 *
 * Stored in the coach's personal library, private to their account.
 * Can be applied to any system, on any pitch view, at any position.
 */
export interface SavedSequence {
  /** Unique identifier, generated on save. */
  id: string
  /** The coach's name for this sequence. */
  name: string
  /** ISO timestamp of last save. */
  updated: string
  /**
   * The pitch view this was captured from.
   *
   * ESSENTIAL. Percent coordinates are relative to the crop, so the same
   * numbers mean different grass on different views. `remap()` needs this
   * to translate correctly when applying to a different view.
   */
  sourcePitch: PitchViewId
  /**
   * The training grid dimensions, if captured from a training board.
   *
   * `viewFor()` needs the area to derive the training view's crop. Without
   * it, a sequence captured from a 40×30 grid would be remapped as if it
   * came from the default 30×20, and every mark would shift.
   */
  sourceArea?: SessionArea
  /**
   * Optional region the coach selected on capture.
   *
   * When present, coordinates in the stored acts are NORMALISED to this
   * rectangle (0–100 within the rect). On apply, they are denormalised
   * into whatever region of the target pitch the coach places them in.
   *
   * Absent means the whole pitch was captured — coordinates stored as-is.
   */
  region?: SequenceRegion
  /**
   * The captured phases, in order.
   *
   * Person fields stripped — this is about positions, not people.
   * Token ids are fresh but consistent WITHIN the sequence, so the tween
   * engine sees the same player across its own phases.
   */
  acts: Act[]
  /**
   * How many active (non-benched) tokens were in the source's first phase.
   *
   * Display-only: shown in the library card so a coach can see at a glance
   * whether a 4-player rondo fits a 6-player drill.
   */
  playerCount: number
  /**
   * The team colors captured with this sequence.
   * 
   * Ensures the sequence preserves the visual distinction between sides
   * when applied to a new system.
   */
  teams?: {
    us: TeamStyle
    them?: TeamStyle | null
  }
}

// ── capture ──────────────────────────────────────────────────────────────────

/**
 * Normalise a point from crop-percent space into a region's local space.
 *
 * A point at (30, 50) on a pitch, inside a region that starts at (20, 40)
 * and spans 20×20, becomes (50, 50) — the middle of the region. This is
 * reversible: `denormaliseFromRegion` gets you back.
 */
export function normaliseToRegion(
  point: { x: number; y: number },
  region: SequenceRegion,
): { x: number; y: number } {
  return {
    x: ((point.x - region.x) / region.w) * 100,
    y: ((point.y - region.y) / region.h) * 100,
  }
}

/**
 * Denormalise a point from region-local space back to crop-percent space.
 *
 * The inverse of `normaliseToRegion`, used when applying a region-captured
 * sequence back onto a pitch.
 */
export function denormaliseFromRegion(
  point: { x: number; y: number },
  region: SequenceRegion,
): { x: number; y: number } {
  return {
    x: region.x + (point.x / 100) * region.w,
    y: region.y + (point.y / 100) * region.h,
  }
}

/**
 * Test whether a point falls inside a region, with a small tolerance.
 *
 * The tolerance is generous on purpose: a player half a step outside the
 * rectangle is clearly part of the drill, and the alternative is a coach
 * who has to redraw the region a centimetre wider to pick them up.
 */
function insideRegion(
  point: { x: number; y: number },
  region: SequenceRegion,
  tolerance = 3,
): boolean {
  return (
    point.x >= region.x - tolerance &&
    point.x <= region.x + region.w + tolerance &&
    point.y >= region.y - tolerance &&
    point.y <= region.y + region.h + tolerance
  )
}

/**
 * Normalise a single act's contents to a region.
 *
 * Filters marks to those inside the region, then shifts their coordinates
 * into region-local space (0–100 within the rect).
 */
function normaliseAct(act: Act, region: SequenceRegion): Act {
  const rp = (p: { x: number; y: number }) => normaliseToRegion(p, region)

  const tokens = act.tokens
    .filter((t) => insideRegion(t, region))
    .map((t) => ({ ...t, ...rp(t) }))

  const tokenIds = new Set(tokens.map((t) => t.id))

  const balls = ballsOf(act)
    .filter((b) => insideRegion(b, region))
    .map((b) => ({ ...b, ...rp(b) }))

  // Keep arrows that have at least one end inside the region or bound to
  // a token that survived the filter.
  const arrows = act.arrows
    .filter((a) => {
      const fromIn = insideRegion(a.from, region) || (a.fromId && tokenIds.has(a.fromId))
      const toIn = insideRegion(a.to, region) || (a.toId && tokenIds.has(a.toId))
      return fromIn || toIn
    })
    .map((a) => ({ ...a, from: rp(a.from), to: rp(a.to) }))

  const bands = act.bands
    .filter((b) => {
      if (b.rect) return insideRegion({ x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 }, region)
      // Block bands: keep if any of their through-tokens survived.
      if (b.throughTokens) return b.throughTokens.some((id) => tokenIds.has(id))
      return false
    })
    .map((b) => {
      if (!b.rect) return b
      const tl = rp({ x: b.rect.x, y: b.rect.y })
      const br = rp({ x: b.rect.x + b.rect.w, y: b.rect.y + b.rect.h })
      return { ...b, rect: { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y } }
    })

  const texts = (act.texts ?? [])
    .filter((t) => insideRegion(t, region))
    .map((t) => ({ ...t, ...rp(t) }))

  const gear = (act.gear ?? [])
    .filter((g) => insideRegion(g, region))
    .map((g) => ({ ...g, ...rp(g) }))

  return {
    ...act,
    tokens,
    ...ballFields(balls),
    arrows,
    bands,
    texts: texts.length > 0 ? texts : undefined,
    gear: gear.length > 0 ? gear : undefined,
  }
}

/**
 * Remap all IDs in a set of acts so they are fresh but internally consistent.
 *
 * This is necessary because a sequence may be applied many times, and each
 * application must produce new IDs so the tween engine does not confuse
 * them with the players already on the board. But WITHIN the sequence, the
 * IDs must match across phases — a token on phase 1 and the same token on
 * phase 3 must share an id, or the animation would show two different people.
 */
function remapIds(acts: Act[]): Act[] {
  const tokenMap = new Map<string, string>()
  const arrowMap = new Map<string, string>()
  const bandMap = new Map<string, string>()
  const textMap = new Map<string, string>()
  const gearMap = new Map<string, string>()
  const ballMap = new Map<string, string>()

  // First pass: collect all unique IDs across all acts.
  for (const act of acts) {
    for (const t of act.tokens) {
      if (!tokenMap.has(t.id)) tokenMap.set(t.id, uid('tk'))
    }
    for (const a of act.arrows) {
      if (!arrowMap.has(a.id)) arrowMap.set(a.id, uid('ar'))
    }
    for (const b of act.bands) {
      if (!bandMap.has(b.id)) bandMap.set(b.id, uid('bd'))
    }
    for (const t of act.texts ?? []) {
      if (!textMap.has(t.id)) textMap.set(t.id, uid('tx'))
    }
    for (const g of act.gear ?? []) {
      if (!gearMap.has(g.id)) gearMap.set(g.id, uid('gr'))
    }
    for (const b of ballsOf(act)) {
      if (!ballMap.has(b.id)) ballMap.set(b.id, uid('bl'))
    }
  }

  const mid = <K extends string>(map: Map<string, string>, id: K): string =>
    map.get(id) ?? id

  // Second pass: rewrite.
  return acts.map((act) => ({
    ...act,
    id: uid('act'),
    tokens: act.tokens.map((t) => ({ ...t, id: mid(tokenMap, t.id) })),
    ...ballFields(
      ballsOf(act).map((b) => ({ ...b, id: mid(ballMap, b.id) })),
    ),
    arrows: act.arrows.map((a) => ({
      ...a,
      id: mid(arrowMap, a.id),
      fromId: a.fromId ? mid(tokenMap, a.fromId) : undefined,
      toId: a.toId ? mid(tokenMap, a.toId) : undefined,
    })),
    bands: act.bands.map((b) => ({
      ...b,
      id: mid(bandMap, b.id),
      throughTokens: b.throughTokens?.map((id) => mid(tokenMap, id)),
    })),
    texts: act.texts?.map((t) => ({ ...t, id: mid(textMap, t.id) })),
    gear: act.gear?.map((g) => ({ ...g, id: mid(gearMap, g.id) })),
  }))
}

/**
 * Capture a sequence from a range of acts in a system.
 *
 * This is the main entry point for the Save Sequence flow. It:
 * 1. Slices the requested range of phases
 * 2. Optionally clips to a region and normalises coordinates
 * 3. Strips person fields (name, photo, playerId)
 * 4. Remaps all IDs to be fresh but internally consistent
 * 5. Wraps it in a `SavedSequence` with source metadata
 */
export function captureSequence(
  name: string,
  acts: Act[],
  fromIndex: number,
  toIndex: number,
  sourcePitch: PitchViewId,
  sourceArea?: SessionArea,
  region?: SequenceRegion,
  selectedTokenIds?: string[] | null,
  teams?: { us: TeamStyle; them?: TeamStyle | null }
): SavedSequence {
  let sliced = acts.slice(fromIndex, toIndex + 1).map((a) => structuredClone(a))

  // If specific tokens were selected, filter to those only (plus everything
  // that references them — arrows, bands).
  if (selectedTokenIds && selectedTokenIds.length > 0) {
    const ids = new Set(selectedTokenIds)
    sliced = sliced.map((act) => {
      const tokens = act.tokens.filter((t) => ids.has(t.id))
      const tokenIdSet = new Set(tokens.map((t) => t.id))
      return {
        ...act,
        tokens,
        arrows: act.arrows.filter((a) => {
          const fromIn = a.fromId ? tokenIdSet.has(a.fromId) : false
          const toIn = a.toId ? tokenIdSet.has(a.toId) : false
          // Keep if at least one end is bound to a selected player.
          return fromIn || toIn || (!a.fromId && !a.toId)
        }),
        bands: act.bands.filter((b) => {
          if (b.throughTokens) return b.throughTokens.some((id) => tokenIdSet.has(id))
          return true // Keep zone/danger bands
        }),
      }
    })
  }

  // Region normalisation.
  if (region) {
    sliced = sliced.map((act) => normaliseAct(act, region))
  }

  // Fresh but consistent IDs.
  sliced = remapIds(sliced)

  const firstAct = sliced[0]
  const playerCount = firstAct
    ? firstAct.tokens.filter((t) => !t.benched).length
    : 0

  return {
    id: uid('seq'),
    name,
    updated: new Date().toISOString(),
    sourcePitch,
    sourceArea,
    region,
    acts: sliced,
    playerCount,
    teams,
  }
}

// ── apply helpers ────────────────────────────────────────────────────────────

/**
 * Remap a sequence's acts from their source pitch view to a target view.
 *
 * If the sequence was captured with a region, the coordinates are first
 * denormalised from region-local space, then remapped between views. If
 * no target region is provided, they land at the position the region
 * occupied on the source view, remapped into the target.
 */
export function remapSequenceActs(
  sequence: SavedSequence,
  targetPitch: PitchViewId,
  targetArea?: SessionArea,
  targetRegion?: SequenceRegion,
): Act[] {
  const fromView = viewFor({ pitch: sequence.sourcePitch, area: sequence.sourceArea })
  const toView = viewFor({ pitch: targetPitch, area: targetArea })

  return sequence.acts.map((act) => {
    // Step 1: denormalise from region if the sequence was region-captured.
    let working = act
    if (sequence.region) {
      const region = targetRegion ?? sequence.region
      working = denormaliseAct(working, region)
    }

    // Step 2: remap between pitch views if they differ.
    if (fromView !== toView && !sequence.region) {
      // Full-pitch capture: direct remap.
      working = remapAct(working, fromView, toView)
    }
    // If region-captured, the denormalisation already placed coordinates
    // in the target's percent space (through the target region), so no
    // further remap is needed — the coach chose WHERE on this pitch.

    return working
  })
}

/**
 * Denormalise a single act from region-local space back to crop-percent.
 */
function denormaliseAct(act: Act, region: SequenceRegion): Act {
  const rp = (p: { x: number; y: number }) => denormaliseFromRegion(p, region)

  return {
    ...act,
    tokens: act.tokens.map((t) => ({ ...t, ...rp(t) })),
    ...ballFields(ballsOf(act).map((b) => ({ ...b, ...rp(b) }))),
    arrows: act.arrows.map((a) => ({ ...a, from: rp(a.from), to: rp(a.to) })),
    bands: act.bands.map((b) => {
      if (!b.rect) return b
      const tl = rp({ x: b.rect.x, y: b.rect.y })
      const br = rp({ x: b.rect.x + b.rect.w, y: b.rect.y + b.rect.h })
      return { ...b, rect: { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y } }
    }),
    texts: act.texts?.map((t) => ({ ...t, ...rp(t) })),
    gear: act.gear?.map((g) => ({ ...g, ...rp(g) })),
  }
}

/**
 * Remap a single act's coordinates from one pitch view to another.
 *
 * Uses the same `remap()` as `remapSystem` in StudioEditor.tsx —
 * metres are the bridge between two percent-of-crop spaces.
 */
function remapAct(
  act: Act,
  from: ReturnType<typeof viewFor>,
  to: ReturnType<typeof viewFor>,
): Act {
  const rp = (p: { x: number; y: number }) => remap(from, to, p.x, p.y)

  return {
    ...act,
    tokens: act.tokens.map((t) => ({ ...t, ...rp(t) })),
    ...ballFields(ballsOf(act).map((b) => ({ ...b, ...rp(b) }))),
    arrows: act.arrows.map((a) => ({ ...a, from: rp(a.from), to: rp(a.to) })),
    bands: act.bands.map((b) => {
      if (!b.rect) return b
      const tl = rp({ x: b.rect.x, y: b.rect.y })
      const br = rp({ x: b.rect.x + b.rect.w, y: b.rect.y + b.rect.h })
      return { ...b, rect: { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y } }
    }),
    texts: act.texts?.map((t) => ({ ...t, ...rp(t) })),
    gear: act.gear?.map((g) => ({ ...g, ...rp(g) })),
  }
}

/**
 * Build the acts for a range-insert: the sequence phases, followed by
 * static holds of the last pose to fill the remaining slots.
 *
 * A 9-phase sequence placed into a 15-phase window produces 9 active
 * phases and 6 static holds. The holds duplicate the last pose with no
 * arrows — arrows mean movement, and a hold has none.
 */
export function buildRangeActs(
  sequenceActs: Act[],
  rangeLength: number,
): Act[] {
  const out: Act[] = []

  for (let i = 0; i < rangeLength; i++) {
    if (i < sequenceActs.length) {
      out.push(sequenceActs[i])
    } else {
      // Static hold: last pose, no arrows (arrows imply movement).
      const last = sequenceActs[sequenceActs.length - 1]
      out.push({
        ...structuredClone(last),
        id: uid('act'),
        title: `Hold`,
        caption: '',
        arrows: [],
        // tokens, balls, gear, bands, texts stay — they define the scene
      })
    }
  }

  return out
}

// ── local persistence ────────────────────────────────────────────────────────

/**
 * The localStorage key for saved sequences.
 *
 * Scoped per user via `scopedKey()` in ./scope.ts — no cross-account leaks.
 * Listed in `LEGACY` in scope.ts so `wipeScope()` clears it on sign-out.
 */
const SEQ_KEY = 'tf-studio:sequences:v1'

interface SequenceStore {
  sequences: Record<string, SavedSequence>
}

function readStore(): SequenceStore {
  if (typeof localStorage === 'undefined') return { sequences: {} }
  try {
    const raw = localStorage.getItem(scopedKey(SEQ_KEY))
    if (!raw) return { sequences: {} }
    const parsed = JSON.parse(raw) as SequenceStore
    if (!parsed || typeof parsed !== 'object' || typeof parsed.sequences !== 'object') {
      return { sequences: {} }
    }
    return parsed
  } catch {
    return { sequences: {} }
  }
}

function writeStore(store: SequenceStore): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(scopedKey(SEQ_KEY), JSON.stringify(store))
  } catch {
    // Quota exceeded or private window. The sequence still lives in the
    // caller's state; only the persistence across a reload is lost.
  }
}

export function listSequences(): SavedSequence[] {
  const store = readStore()
  return Object.values(store.sequences).sort(
    (a, b) => b.updated.localeCompare(a.updated),
  )
}

export function loadSequence(id: string): SavedSequence | null {
  return readStore().sequences[id] ?? null
}

export function saveSequence(seq: SavedSequence): void {
  const store = readStore()
  store.sequences[seq.id] = { ...seq, updated: new Date().toISOString() }
  writeStore(store)
}

export function deleteSequence(id: string): void {
  const store = readStore()
  delete store.sequences[id]
  writeStore(store)
}

export function renameSequence(id: string, name: string): void {
  const store = readStore()
  const seq = store.sequences[id]
  if (seq) {
    seq.name = name
    seq.updated = new Date().toISOString()
    writeStore(store)
  }
}

/** New sequence id. Same shape as system ids, for consistency. */
export function newSequenceId(): string {
  return `seq${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
