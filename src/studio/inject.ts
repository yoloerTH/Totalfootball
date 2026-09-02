import type { Act, Token, Arrow, Band, System, BallMark } from './schema'
import { PHASE_FIELDS, uid, CENTRE_SPOT, ballFields, ballsOf } from './schema'

/**
 * A greedy matching algorithm to find the closest pairs between sources and targets.
 * Works perfectly for ~22 players.
 */
function matchItems<T, U>(
  sources: T[],
  targets: U[],
  getDist: (s: T, t: U) => number
): { source: T; target: U }[] {
  const pairs: { s: T; t: U; dist: number }[] = []
  for (const s of sources) {
    for (const t of targets) {
      pairs.push({ s, t, dist: getDist(s, t) })
    }
  }
  pairs.sort((a, b) => a.dist - b.dist)

  const matchedSources = new Set<T>()
  const matchedTargets = new Set<U>()
  const result: { source: T; target: U }[] = []

  for (const pair of pairs) {
    if (!matchedSources.has(pair.s) && !matchedTargets.has(pair.t)) {
      matchedSources.add(pair.s)
      matchedTargets.add(pair.t)
      result.push({ source: pair.s, target: pair.t })
    }
  }
  return result
}

export function injectSequence(
  targetAct: Act,
  sequenceActs: Act[],
  selectedTokenIds?: string[] | null,
  includeRealignment: boolean = true
): Act[] {
  if (sequenceActs.length === 0) return []

  const seqFirst = sequenceActs[0]

  let targetTokens = targetAct.tokens.filter(t => !t.benched)
  if (selectedTokenIds && selectedTokenIds.length > 0) {
    targetTokens = targetTokens.filter(t => selectedTokenIds.includes(t.id))
  }

  // 1. Match active tokens
  const tokenMatches = matchItems(
    seqFirst.tokens.filter(t => !t.benched),
    targetTokens,
    (s, t) => Math.hypot(s.x - t.x, s.y - t.y)
  )

  const tokenMapping = new Map<string, string>() // sourceId -> targetId
  let totalDx = 0
  let totalDy = 0
  let samePlayersMatchCount = 0

  for (const m of tokenMatches) {
    tokenMapping.set(m.source.id, m.target.id)
    if (m.source.id === m.target.id) {
      samePlayersMatchCount++
    }
    totalDx += m.target.x - m.source.x
    totalDy += m.target.y - m.source.y
  }

  const isNewSetOfPlayers = samePlayersMatchCount < tokenMatches.length / 2

  const avgDx = isNewSetOfPlayers && tokenMatches.length > 0 ? totalDx / tokenMatches.length : 0
  const avgDy = isNewSetOfPlayers && tokenMatches.length > 0 ? totalDy / tokenMatches.length : 0

  // 2. Match balls
  const seqBalls = ballsOf(seqFirst)
  let targetBalls = ballsOf(targetAct)
  const ballMatches = matchItems(
    seqBalls,
    targetBalls,
    (s, t) => Math.hypot(s.x - t.x, s.y - t.y)
  )
  const ballMapping = new Map<string, string>()
  for (const m of ballMatches) {
    ballMapping.set(m.source.id, m.target.id)
  }

  // 3. Create persistent ID mappings for arrows and bands across the sequence
  const arrowIdMap = new Map<string, string>()
  const bandIdMap = new Map<string, string>()
  const textIdMap = new Map<string, string>()
  const gearIdMap = new Map<string, string>()

  for (const act of sequenceActs) {
    for (const a of act.arrows) {
      if (!arrowIdMap.has(a.id)) arrowIdMap.set(a.id, uid('ar'))
    }
    for (const b of act.bands) {
      if (!bandIdMap.has(b.id)) bandIdMap.set(b.id, uid('bd'))
    }
    for (const txt of (act.texts || [])) {
      if (!textIdMap.has(txt.id)) textIdMap.set(txt.id, uid('tx'))
    }
    for (const g of (act.gear || [])) {
      if (!gearIdMap.has(g.id)) gearIdMap.set(g.id, uid('gr'))
    }
  }

  const cloneAct = (sourceAct: Act, title: string, isRealignment: boolean): Act => {
    const newTokens = targetAct.tokens.map(targetToken => {
      let sourceId: string | undefined
      for (const [s, t] of tokenMapping.entries()) {
        if (t === targetToken.id) {
          sourceId = s
          break
        }
      }

      if (sourceId) {
        const sourceToken = sourceAct.tokens.find(t => t.id === sourceId)
        if (sourceToken) {
          return {
            ...targetToken, 
            x: sourceToken.x + avgDx, 
            y: sourceToken.y + avgDy,
            cue: sourceToken.cue,
            dim: sourceToken.dim,
            benched: sourceToken.benched
          }
        }
      }
      return targetToken
    })

    for (const sourceToken of sourceAct.tokens) {
      if (!tokenMapping.has(sourceToken.id)) {
        newTokens.push({
          ...sourceToken,
          x: sourceToken.x + avgDx,
          y: sourceToken.y + avgDy,
        })
      }
    }

    const newBalls = targetBalls.map(targetBall => {
      let sourceId: string | undefined
      for (const [s, t] of ballMapping.entries()) {
        if (t === targetBall.id) {
          sourceId = s
          break
        }
      }
      if (sourceId) {
        const sourceBall = ballsOf(sourceAct).find(b => b.id === sourceId)
        if (sourceBall) {
          return { ...targetBall, x: sourceBall.x + avgDx, y: sourceBall.y + avgDy }
        }
      }
      return targetBall
    })

    for (const sourceBall of ballsOf(sourceAct)) {
      if (!ballMapping.has(sourceBall.id)) {
        newBalls.push({
          ...sourceBall,
          x: sourceBall.x + avgDx,
          y: sourceBall.y + avgDy,
        })
      }
    }

    const newArrows = sourceAct.arrows.map(a => ({
      ...a,
      id: arrowIdMap.get(a.id)!,
      fromId: a.fromId && tokenMapping.has(a.fromId) ? tokenMapping.get(a.fromId) : a.fromId,
      toId: a.toId && tokenMapping.has(a.toId) ? tokenMapping.get(a.toId) : a.toId
    }))

    const newBands = sourceAct.bands.map(b => ({
      ...b,
      id: bandIdMap.get(b.id)!,
      throughTokens: b.throughTokens
        ? b.throughTokens.map(id => tokenMapping.has(id) ? tokenMapping.get(id)! : id)
        : undefined
    }))

    let finalTexts = [...(targetAct.texts || [])]
    let finalGear = [...(targetAct.gear || [])]

    if (isNewSetOfPlayers || tokenMatches.length === 0) {
      const clonedTexts = (sourceAct.texts || []).map(txt => ({
        ...txt,
        id: textIdMap.get(txt.id)!,
        x: txt.x + avgDx,
        y: txt.y + avgDy
      }))
      const clonedGear = (sourceAct.gear || []).map(g => ({
        ...g,
        id: gearIdMap.get(g.id)!,
        x: g.x + avgDx,
        y: g.y + avgDy
      }))
      finalTexts = [...finalTexts, ...clonedTexts]
      finalGear = [...finalGear, ...clonedGear]
    }

    return {
      ...targetAct,
      id: uid('act'),
      title,
      caption: isRealignment ? 'Players reset to starting positions' : sourceAct.caption,
      tokens: newTokens,
      ...ballFields(newBalls),
      arrows: isRealignment ? newArrows : [...targetAct.arrows, ...newArrows],
      bands: isRealignment ? newBands : [...targetAct.bands, ...newBands],
      texts: finalTexts,
      gear: finalGear,
      /*
       * THE BOARD'S FRAME WINS. These used to be taken from the sequence
       * unconditionally, which meant applying a drill silently replaced a
       * camera frame the coach had drawn on that phase with one captured on a
       * different board months earlier — a change that is invisible in the
       * editor and only shows up in the exported film. The sequence's frame is
       * still used where there is nothing to overwrite.
       */
      shot: targetAct.shot ?? sourceAct.shot,
      camera: targetAct.camera ?? sourceAct.camera
    }
  }

  const injectedActs: Act[] = []

  if (includeRealignment) {
    injectedActs.push(cloneAct(seqFirst, 'Realignment', true))
  }

  for (let i = 0; i < sequenceActs.length; i++) {
    injectedActs.push(cloneAct(sequenceActs[i], sequenceActs[i].title, false))
  }

  return injectedActs
}

/* ── ADDING A SEQUENCE WITHOUT DISTURBING THE BOARD ────────────────────────── */

/**
 * Which marks an apply put on the board, so the caller can select them.
 *
 * The shape `multiSelect` in ../editor/StudioEditor.tsx already uses, on
 * purpose: the coach's next move after dropping a drill is to slide it into
 * place, and handing the editor exactly the ids it selects with a marquee means
 * the group drag it already has works on the thing that just landed, with no
 * second gesture and no second implementation of dragging.
 */
export interface AddedMarks {
  tokens: string[]
  gear: string[]
  balls: string[]
  texts: string[]
  marks: string[]
}

const emptyAdded = (): AddedMarks => ({ tokens: [], gear: [], balls: [], texts: [], marks: [] })

/**
 * Fresh ids for a whole sequence, consistent across its own phases.
 *
 * A sequence carries ids from capture, and a coach who applies the same drill
 * twice to one system would otherwise get two sets of marks claiming to be the
 * same objects — the tween engine would see one player teleporting between the
 * two copies on Play. Fresh per apply, stable within it, which is what makes a
 * token on phase 1 and the same token on phase 3 the same person.
 */
function freshen(acts: Act[]): { acts: Act[]; added: AddedMarks } {
  const maps = {
    tk: new Map<string, string>(),
    gr: new Map<string, string>(),
    bl: new Map<string, string>(),
    tx: new Map<string, string>(),
    ar: new Map<string, string>(),
    bd: new Map<string, string>(),
  }
  const take = (m: Map<string, string>, prefix: string, id: string) => {
    let next = m.get(id)
    if (!next) {
      next = uid(prefix)
      m.set(id, next)
    }
    return next
  }

  const out = acts.map((a) => ({
    ...a,
    id: uid('act'),
    tokens: a.tokens.map((t) => ({ ...t, id: take(maps.tk, 'tk', t.id) })),
    ...ballFields(ballsOf(a).map((b) => ({ ...b, id: take(maps.bl, 'bl', b.id) }))),
    arrows: a.arrows.map((ar) => ({
      ...ar,
      id: take(maps.ar, 'ar', ar.id),
      // An end BOUND to a player has to follow that player into his new id, and
      // an end bound to somebody the sequence does not contain is dropped to the
      // grass it already names — the coordinates are kept current for exactly
      // this (see `Arrow.fromId` in ../schema.ts), so the arrow survives as a
      // mark on the pitch rather than snapping onto a stranger who happens to
      // hold that id on the board it is landing on.
      fromId: ar.fromId ? maps.tk.get(ar.fromId) : undefined,
      toId: ar.toId ? maps.tk.get(ar.toId) : undefined,
    })),
    bands: a.bands.map((b) => ({
      ...b,
      id: take(maps.bd, 'bd', b.id),
      throughTokens: b.throughTokens
        ?.map((id) => maps.tk.get(id))
        .filter((id): id is string => Boolean(id)),
    })),
    texts: a.texts?.map((t) => ({ ...t, id: take(maps.tx, 'tx', t.id) })),
    gear: a.gear?.map((g) => ({ ...g, id: take(maps.gr, 'gr', g.id) })),
  }))

  return {
    acts: out,
    added: {
      tokens: [...maps.tk.values()],
      gear: [...maps.gr.values()],
      balls: [...maps.bl.values()],
      texts: [...maps.tx.values()],
      marks: [...maps.ar.values(), ...maps.bd.values()],
    },
  }
}

/**
 * Lay a sequence onto a board WITHOUT touching anything already on it.
 *
 * ── WHY THIS IS NOT `injectSequence` ────────────────────────────────────────
 *
 * `injectSequence` above matches the drill's players to the players already
 * standing on the phase and moves those players into the drill. That is a real
 * thing a coach wants — "my actual back four runs this" — and it is why it is
 * still here. It is also the wrong default, because most of the time a saved
 * sequence is a PATTERN being added to a board that is already a system, and
 * matching it by proximity picks up whichever eleven men happen to be nearest
 * and teleports them into a rondo (user, 2026-09-02).
 *
 * So this is the other half: the sequence arrives as its OWN counters, arrows,
 * cones and zones, with fresh ids, and every mark already on the phase is
 * returned byte-identical. Nothing is matched, nothing is moved, nothing is
 * deleted. Where it lands is decided before it gets here, by
 * `placementTransform` in ../sequences.ts, which is the coach's own answer
 * rather than one inferred from an average of the men it displaced.
 *
 * ── ONE PHASE OF THE SEQUENCE PER PHASE OF THE BOARD ────────────────────────
 *
 * `bases` is the run of board phases the drill will occupy, already in the
 * order they will appear. Each one keeps its own marks and gains the sequence's
 * pose for that beat. A run longer than the sequence holds its last pose, which
 * is what `buildRangeActs` means by a static hold, and it is done here rather
 * than after so the held phases keep the board's own content too.
 *
 * ── TITLES ──────────────────────────────────────────────────────────────────
 *
 * `naming` is 'sequence' when the phases are NEW — they are the drill's phases
 * and they should read as the drill — and 'board' when the sequence is being
 * laid over phases the coach already wrote, where the title on screen is theirs
 * and overwriting it would be the tool editing their words.
 */
export function addSequence(
  bases: Act[],
  sequenceActs: Act[],
  naming: 'sequence' | 'board' = 'sequence',
): { acts: Act[]; added: AddedMarks } {
  if (sequenceActs.length === 0 || bases.length === 0) {
    return { acts: bases, added: emptyAdded() }
  }

  const { acts: seq, added } = freshen(sequenceActs)

  const acts = bases.map((base, i) => {
    const held = i >= seq.length
    const src = held ? seq[seq.length - 1] : seq[i]

    return {
      ...base,
      id: uid('act'),
      title: naming === 'sequence' ? (held ? 'Hold' : src.title) : base.title,
      caption: naming === 'sequence' ? (held ? '' : src.caption) : base.caption,
      tokens: [...base.tokens, ...src.tokens],
      ...ballFields([...ballsOf(base), ...ballsOf(src)]),
      // A hold has no arrows: an arrow is a movement, and nothing is moving on a
      // phase that repeats the last pose. The BOARD's own arrows stay either
      // way — they are not ours to strip.
      arrows: [...base.arrows, ...(held ? [] : src.arrows)],
      bands: [...base.bands, ...src.bands],
      texts: mergeMarks(base.texts, src.texts),
      gear: mergeMarks(base.gear, src.gear),
      /*
       * THE CAMERA STAYS THE BOARD'S. `shot` and `camera` are instructions
       * about how to film this phase, and a drill dropped into the corner of a
       * system has no business reframing it. The one exception is a phase that
       * has no frame of its own to keep, on which the sequence's is strictly
       * more information than the nothing that was there.
       */
      shot: base.shot ?? (naming === 'sequence' ? src.shot : undefined),
      camera: base.camera ?? (naming === 'sequence' ? src.camera : undefined),
    }
  })

  return { acts, added }
}

/**
 * Two optional mark lists into one, staying undefined when both were.
 *
 * `texts` and `gear` are absent on every act written before they existed, and
 * writing `[]` onto one puts a change into the diff of a document nobody
 * edited. See `Act.texts` in ../schema.ts.
 */
function mergeMarks<T>(a: T[] | undefined, b: T[] | undefined): T[] | undefined {
  if (!a && !b) return undefined
  return [...(a ?? []), ...(b ?? [])]
}
