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
 * One row in `studio_sequences` (supabase/019, 026, 027), and nowhere else.
 * There is no local copy and no offline buffer: a save either lands or is
 * reported. See the persistence block at the foot of this file.
 */

import type { Act, TeamStyle } from './schema'
import { uid, ballsOf, ballFields } from './schema'
import type { PitchViewId, SessionArea } from './board/pitch'
import { viewFor } from './board/pitch'
import type { MarkTransform } from './board/transform'
import {
  KEEP,
  compose,
  intoRegion,
  mapAct,
  mirrorTransform,
  outOfRegion,
  viewTransform,
} from './board/transform'

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
  return intoRegion(region).point(point)
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
  return outOfRegion(region).point(point)
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
 * Clip a single act to a region, then normalise it into that region's space.
 *
 * TWO STEPS, AND ONLY THE FIRST IS HERE. The clipping — which marks belong to
 * the drill the coach drew a box round — is the judgement, and it is written
 * out below. The coordinate shift is `intoRegion` in ./board/transform.ts, the
 * same walk every other coordinate change in the studio goes through, so a
 * field added to `Act` cannot arrive here carrying its old numbers.
 */
function normaliseAct(act: Act, region: SequenceRegion): Act {
  const tokens = act.tokens.filter((t) => insideRegion(t, region))
  const tokenIds = new Set(tokens.map((t) => t.id))

  const balls = ballsOf(act).filter((b) => insideRegion(b, region))

  // Keep arrows that have at least one end inside the region or bound to
  // a token that survived the filter.
  const arrows = act.arrows.filter((a) => {
    const fromIn = insideRegion(a.from, region) || (a.fromId && tokenIds.has(a.fromId))
    const toIn = insideRegion(a.to, region) || (a.toId && tokenIds.has(a.toId))
    return fromIn || toIn
  })

  const bands = act.bands.filter((b) => {
    if (b.rect) {
      return insideRegion(
        { x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 },
        region,
      )
    }
    // Block bands: keep if any of their through-tokens survived.
    if (b.throughTokens) return b.throughTokens.some((id) => tokenIds.has(id))
    return false
  })

  const texts = (act.texts ?? []).filter((t) => insideRegion(t, region))
  const gear = (act.gear ?? []).filter((g) => insideRegion(g, region))

  const clipped: Act = {
    ...act,
    tokens,
    ...ballFields(balls),
    arrows,
    bands,
    texts: texts.length > 0 ? texts : undefined,
    gear: gear.length > 0 ? gear : undefined,
    /*
     * THE CAMERA FRAME DOES NOT COME WITH IT. `shot` frames the phase it was
     * drawn on, and a sequence is a pattern that will be dropped somewhere else
     * on somebody else's board — carrying it would hand every system the
     * sequence is applied to a camera instruction the coach never gave. The
     * whole-pitch capture keeps it, because there the phases ARE the phases.
     */
    shot: undefined,
  }

  return mapAct(intoRegion(region), clipped)
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
 * How the coach wants a sequence laid down on THIS board.
 *
 * All three are optional and all three default to "as captured", so applying a
 * sequence with no options is the plain behaviour it always had.
 */
export interface SequencePlacement {
  /**
   * A rectangle of the target board to fit the sequence into.
   *
   * Only meaningful for a region-captured sequence, which is stored normalised
   * to its own box (0–100 inside it). Absent means the box it came out of.
   */
  region?: SequenceRegion
  /**
   * Mirror across the pitch's WIDTH: the left wing becomes the right wing.
   *
   * What a coach means by "put it on the other side" nearly every time. Named
   * for the flank rather than for a screen direction because percent y is
   * across the width on every board, upright or flat, while "horizontal" swaps
   * meaning between them. See `mirrorTransform` in ./board/transform.ts.
   */
  flanks?: boolean
  /** Mirror along the pitch's LENGTH: the attacking end becomes the defending one. */
  ends?: boolean
}

/**
 * The transform that takes a sequence's stored coordinates onto a target board.
 *
 * ── THE ORDER IS THE WHOLE OF IT ─────────────────────────────────────────────
 *
 * A region-captured sequence is stored in ITS OWN box, 0–100, with no view in
 * the numbers at all — that is what normalising did. So it goes straight out
 * into the target box and the view never enters: the coach chose where, and
 * where is where they drew it.
 *
 * A whole-pitch capture is stored in the SOURCE view's percent, so it has to be
 * re-expressed against the target crop before anything else touches it.
 *
 * The mirror is LAST in both cases, and it must be: it reflects about the
 * centre of the space the marks are now in. Mirroring a region-captured drill
 * before it is placed would reflect it about the middle of its own little box
 * and then drop it, unmoved, exactly where it was going anyway.
 *
 * Exported so the check script and the editor's preview can ask for the same
 * transform the apply will use, rather than each working it out again.
 */
export function placementTransform(
  sequence: SavedSequence,
  targetPitch: PitchViewId,
  targetArea?: SessionArea,
  placement?: SequencePlacement,
): MarkTransform {
  const toView = viewFor({ pitch: targetPitch, area: targetArea })
  const mirror = mirrorTransform(toView, {
    ends: placement?.ends,
    flanks: placement?.flanks,
  })

  if (sequence.region) {
    const box = placement?.region ?? sequence.region
    return compose(outOfRegion(box), mirror)
  }

  const fromView = viewFor({ pitch: sequence.sourcePitch, area: sequence.sourceArea })
  return compose(viewTransform(fromView, toView), mirror)
}

/**
 * Remap a sequence's acts onto a target board, mirrored and placed as asked.
 *
 * One transform, applied by the one walk. The three hand-written coordinate
 * loops this function used to contain — denormalise, remap, and a third in the
 * editor — are `placementTransform` and `mapAct` now, which is what makes
 * mirroring a two-line change rather than a fourth copy of the same loop.
 */
export function remapSequenceActs(
  sequence: SavedSequence,
  targetPitch: PitchViewId,
  targetArea?: SessionArea,
  placement?: SequencePlacement,
): Act[] {
  const t = placementTransform(sequence, targetPitch, targetArea, placement)
  if (t === KEEP) return sequence.acts
  return sequence.acts.map((act) => mapAct(t, act))
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

// ── persistence ──────────────────────────────────────────────────────────────

/**
 * The library lives in `studio_sequences` and nowhere else.
 *
 * ── IT USED TO BE A localStorage BLOB WITH A CLOUD MIRROR BEHIND IT ──────────
 *
 * That was worse than it sounds, because the mirror had never worked: 019
 * created the table without a GRANT, so every upsert came back
 * `42501 permission denied` and was swallowed as a "not yet" (supabase/026).
 * The library was local-only for three weeks and nothing said so — the panel
 * merged a cloud list that was always empty over a local list that was always
 * the whole truth, so the bug was invisible right up until somebody opened the
 * studio on a second machine.
 *
 * One store removes both halves of that: there is no merge to get wrong, and a
 * write that does not land is a rejected promise rather than a silence.
 *
 * ── EVERY FUNCTION HERE IS ASYNC AND THAT IS THE POINT ───────────────────────
 *
 * They were synchronous when the answer was a JSON.parse away. Making them
 * async is not a cost being paid for the database; it is the call sites being
 * made honest about the fact that saving can fail. `SaveSequenceDialog` and the
 * library panel both now know whether the sequence they just showed a coach a
 * confirmation for actually exists.
 *
 * ── AND THE LIST IS CACHED FOR THE TAB ───────────────────────────────────────
 *
 * `applySequence` needs a document by id from inside a synchronous handler, and
 * the library panel fetches the whole list a moment earlier. `cached` below is
 * that fetch, kept, so opening the Apply dialog is not a second round trip for
 * something already on screen. It is invalidated by every write from this tab
 * and is never the source of truth — `listSequences` always re-reads.
 */

import { db } from './account/client'

/** What the row looks like once the generated columns of supabase/027 are read. */
export interface SequenceRow {
  id: string
  /** The full document. Everything else on the row is generated from it. */
  sequence: SavedSequence
  /** Who owns it. Not always the reader: team libraries are shared (020). */
  owner: string
  updated: string
}

/**
 * Last known list, by id, for the life of the tab.
 *
 * A read-through convenience for `loadSequence`, not a store. Nothing is ever
 * served from here that has not been fetched this session, and nothing is
 * written here that has not landed in the database first.
 */
const cached = new Map<string, SavedSequence>()

/** Drop the cache. Called on sign-out with the rest of the session state. */
export function forgetSequences(): void {
  cached.clear()
}

/**
 * Normalise a row into the document the editor works with.
 *
 * The id and the timestamp are taken from the ROW rather than trusted from
 * inside `doc`, because the row is what the database sorts and de-duplicates
 * by. supabase/027 keeps the two in step on every write; this makes a document
 * written before that migration read correctly anyway.
 */
function toSequence(row: { id: string; doc: unknown; updated_at: string }): SavedSequence {
  const doc = (row.doc ?? {}) as SavedSequence
  return { ...doc, id: row.id, updated: row.updated_at }
}

/**
 * The coach's library, newest first.
 *
 * Returns null — NOT [] — when the fetch failed, so the panel can tell an empty
 * library from an unreachable server. They used to be the same value and the
 * panel had to guess, which with no local copy left to fall back on would mean
 * telling a coach with forty sequences that they have none.
 *
 * No `owner` filter: `studio_sequences_all_access` (supabase/020) already
 * returns own rows plus any team library this coach may view, and a filter here
 * would silently hide the second kind.
 */
export async function listSequences(): Promise<SequenceRow[] | null> {
  const supabase = db()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('studio_sequences')
    .select('id, doc, owner, updated_at')
    .order('updated_at', { ascending: false })
  if (error || !data) return null

  cached.clear()
  return data.map((row) => {
    const sequence = toSequence(row as { id: string; doc: unknown; updated_at: string })
    cached.set(sequence.id, sequence)
    return {
      id: sequence.id,
      sequence,
      owner: row.owner as string,
      updated: row.updated_at as string,
    }
  })
}

/** One sequence by id. Served from the tab's cache when the list is already in. */
export async function loadSequence(id: string): Promise<SavedSequence | null> {
  const hit = cached.get(id)
  if (hit) return hit
  const supabase = db()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('studio_sequences')
    .select('id, doc, updated_at')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  const sequence = toSequence(data as { id: string; doc: unknown; updated_at: string })
  cached.set(sequence.id, sequence)
  return sequence
}

/**
 * Write one, and hand back what the database actually stored.
 *
 * The returned document is the one to show the coach: supabase/027 stamps
 * `updated` from the database clock, so the copy in hand after a save is the
 * copy any other device will see. Returning the argument instead would put a
 * phone with a wrong clock at the top of its own library forever.
 *
 * `null` means it did not land. Every call site treats that as a failure the
 * coach is told about — there is no second store for it to be quietly correct
 * in any more.
 */
export async function saveSequence(seq: SavedSequence): Promise<SavedSequence | null> {
  const supabase = db()
  if (!supabase) return null
  const { data, error } = await supabase.rpc('studio_sequences_save', {
    p_id: seq.id,
    p_doc: seq,
  })
  if (error || !data) return null
  const result = data as { ok?: boolean; doc?: SavedSequence }
  if (!result.ok || !result.doc) return null
  cached.set(seq.id, result.doc)
  return result.doc
}

/** Delete one. `false` means it is still there. */
export async function deleteSequence(id: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false
  const { data, error } = await supabase.rpc('studio_sequences_delete', { p_id: id })
  if (error) return false
  cached.delete(id)
  return Boolean((data as { ok?: boolean } | null)?.ok)
}

/**
 * Rename one, without moving the document.
 *
 * The whole point of supabase/027's rename RPC: reading the document, editing
 * one string and posting the whole thing back is three times the bytes and
 * loses a re-capture made in another tab in between.
 */
export async function renameSequence(id: string, name: string): Promise<boolean> {
  const supabase = db()
  if (!supabase || !name.trim()) return false
  const { data, error } = await supabase.rpc('studio_sequences_rename', {
    p_id: id,
    p_name: name.trim(),
  })
  if (error) return false
  const ok = Boolean((data as { ok?: boolean } | null)?.ok)
  if (ok) {
    const hit = cached.get(id)
    if (hit) cached.set(id, { ...hit, name: name.trim() })
  }
  return ok
}

/** New sequence id. Same shape as system ids, for consistency. */
export function newSequenceId(): string {
  return `seq${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
