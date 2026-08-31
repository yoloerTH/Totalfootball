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
      shot: sourceAct.shot,
      camera: sourceAct.camera
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
