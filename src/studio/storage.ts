/**
 * Local persistence.
 *
 * The studio saves to localStorage first and treats the server as a sync
 * target, not as the place work lives. Two reasons, both about coaches rather
 * than about architecture:
 *
 *  · A coach building a presentation the night before a session cannot lose it
 *    to a dropped connection, an expired token or a 500. Everything they type
 *    is on their own machine within a keystroke.
 *  · It lets the whole studio be used, and demoed, before anyone has signed up.
 *    Adoption first was the explicit plan; a login wall in front of the drag
 *    interaction would kill it.
 *
 * When auth lands this becomes the write-through cache: local write is
 * immediate, the Supabase upsert is debounced behind it, and a failed upsert
 * leaves the local copy authoritative and retries.
 */

import { resolveViewId } from './board/pitch'
import type { System } from './schema'

const KEY = 'tf-studio:v1'

/**
 * Bring a stored document up to date on the way out of storage.
 *
 * Read-time migration rather than a one-off sweep, because there is no server
 * to run a sweep on: a coach's only copy is in their own browser, and it may
 * have been written by a build from before whatever we changed. Keeping this on
 * the read path means a document is repaired the moment it is opened, and a
 * document nobody opens costs nothing.
 *
 * Everything here must be idempotent and must never throw on a shape it does
 * not recognise — the alternative is a coach losing a presentation to a schema
 * tweak, which is exactly what localStorage-first was meant to prevent.
 */
function migrate(system: System): System {
  // Pitch views that were retired (`middle-third`, `final-third`) map to their
  // nearest survivor. Marks are stored as percent-of-crop, so a view swap does
  // move them relative to the grass — but the alternative is a document that
  // names a view we no longer have, which renders as nothing at all.
  const pitch = resolveViewId(system.pitch)
  return pitch === system.pitch ? system : { ...system, pitch }
}

interface Store {
  systems: Record<string, { system: System; updated: string }>
  /** Last system opened, so the studio reopens where the coach left off. */
  last?: string
}

function read(): Store {
  if (typeof localStorage === 'undefined') return { systems: {} }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { systems: {} }
    const parsed = JSON.parse(raw) as Store
    // A hand-edited or half-written entry should cost one system, not the studio.
    if (!parsed || typeof parsed !== 'object' || typeof parsed.systems !== 'object') {
      return { systems: {} }
    }
    return parsed
  } catch {
    return { systems: {} }
  }
}

function write(store: Store): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // Quota exceeded, or Safari private mode. Losing the autosave is survivable;
    // taking the editor down with an uncaught throw mid-drag is not.
  }
}

export function listSystems(): { id: string; system: System; updated: string }[] {
  const store = read()
  return Object.entries(store.systems)
    .map(([id, v]) => ({ id, ...v, system: migrate(v.system) }))
    .sort((a, b) => b.updated.localeCompare(a.updated))
}

export function loadSystem(id: string): System | null {
  const system = read().systems[id]?.system
  return system ? migrate(system) : null
}

export function saveSystem(id: string, system: System): void {
  const store = read()
  store.systems[id] = { system, updated: new Date().toISOString() }
  store.last = id
  write(store)
}

export function deleteSystem(id: string): void {
  const store = read()
  delete store.systems[id]
  if (store.last === id) delete store.last
  write(store)
}

export function lastOpened(): string | null {
  return read().last ?? null
}

/** A short, URL-safe id. Collision risk is irrelevant at one-coach scale. */
export function newSystemId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

// ── what the coach has already been shown ────────────────────────────────────

const GUIDE_KEY = 'tf-studio:guide:v1'

/**
 * Which parts of the studio a coach has actually done.
 *
 * Kept apart from the systems store on purpose. This is about the PERSON, not
 * about a document: someone who learned to draw a pass on their first system
 * should not be told how to draw a pass again on their fourth. It also means
 * clearing a system never resets the teaching, and the teaching never bloats a
 * document that will one day be synced.
 *
 * Every flag latches. They are "has this ever happened", not "is this true
 * now" — deleting the only arrow on the board should not un-teach the coach
 * what arrows are, and watching a finished checklist item flick back to
 * undone is the kind of thing that makes a tool feel like it is marking your
 * homework.
 */
export interface GuideState {
  /** The welcome walkthrough has been read or skipped. */
  seen: boolean
  /** Has dragged a counter. */
  moved: boolean
  /** Has given a system a name. */
  named: boolean
  /** Has a second phase. */
  phased: boolean
  /** Has drawn an arrow. */
  drew: boolean
  /** Has pressed Play. */
  played: boolean
  /** The step-by-step rail is open. Defaults on — this is a first-use tool. */
  railOpen: boolean
  /**
   * Has been told the studio wants a bigger screen, and chosen to carry on
   * anyway. Latches like the rest: somebody who has made that decision once
   * should not be asked again every time they open the tab on the same phone.
   */
  smallOk: boolean
}

const GUIDE_DEFAULTS: GuideState = {
  seen: false,
  moved: false,
  named: false,
  phased: false,
  drew: false,
  played: false,
  railOpen: true,
  smallOk: false,
}

export function readGuide(): GuideState {
  if (typeof localStorage === 'undefined') return { ...GUIDE_DEFAULTS }
  try {
    const raw = localStorage.getItem(GUIDE_KEY)
    if (!raw) return { ...GUIDE_DEFAULTS }
    // Spread over the defaults so a flag added in a later build reads as
    // "not done yet" rather than as undefined.
    return { ...GUIDE_DEFAULTS, ...(JSON.parse(raw) as Partial<GuideState>) }
  } catch {
    return { ...GUIDE_DEFAULTS }
  }
}

export function writeGuide(patch: Partial<GuideState>): GuideState {
  const next = { ...readGuide(), ...patch }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(GUIDE_KEY, JSON.stringify(next))
    } catch {
      // Same reasoning as the autosave: losing the teaching state is survivable.
    }
  }
  return next
}
