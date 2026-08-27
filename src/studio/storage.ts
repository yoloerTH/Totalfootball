/**
 * Local persistence.
 *
 * The studio saves to localStorage first and treats the server as a sync
 * target, not as the place work lives. The reason is about coaches rather than
 * about architecture: someone building a presentation the night before a
 * session cannot lose it to a dropped connection, an expired token or a 500.
 * Everything they type is on their own machine within a keystroke.
 *
 * This is now the write-through cache it always said it would become: the local
 * write is immediate and synchronous, the Supabase upsert is debounced behind
 * it (./account/sync.ts), and a failed upsert leaves the local copy
 * authoritative and retries on the next edit.
 *
 * NOTE: the studio itself now requires an account. That does not make any of
 * the above vestigial — it is what keeps the editor working through a dropped
 * connection mid-session, and it is still the only copy that exists in the two
 * seconds between a change and the upload.
 */

import { resolveViewId } from './board/pitch'
import { clearScoped, scopedKey } from './scope'
import type { System } from './schema'

/**
 * ── EVERY KEY BELOW IS A BASE, NOT A KEY ─────────────────────────────────────
 *
 * They are namespaced per signed-in account on the way to `localStorage` — see
 * ./scope.ts for what went wrong when they were not. Nothing in this file may
 * call `localStorage` with a bare base name again; that is the whole bug.
 *
 * The optional `who` on the read paths is not a convenience. `claimLocalSystems`
 * has to reach the GUEST scope specifically, from inside an account, and that
 * is the only legitimate reason to read a scope that is not the current one.
 */
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
 *
 * Exported because the cloud read path needs it too (./account/cloud.ts). A
 * document that came back from Supabase is exactly as likely to have been
 * written by an older build as one that came out of localStorage, and there is
 * only one right answer to what to do about that.
 */
export function migrate(system: System): System {
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

function read(who?: string | null): Store {
  if (typeof localStorage === 'undefined') return { systems: {} }
  try {
    const raw = localStorage.getItem(scopedKey(KEY, who))
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
    localStorage.setItem(scopedKey(KEY), JSON.stringify(store))
  } catch {
    // Quota exceeded, or Safari private mode. Losing the autosave is survivable;
    // taking the editor down with an uncaught throw mid-drag is not.
  }
}

export function listSystems(who?: string | null): { id: string; system: System; updated: string }[] {
  const store = read(who)
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

/**
 * Throw away one scope's systems wholesale.
 *
 * Exists for one caller: `claimLocalSystems` retiring the GUEST scope once its
 * contents are safely in an account. Guest work that is left behind is work the
 * NEXT account to sign in on this browser will claim, which is the leak this
 * whole change is about.
 */
export function clearSystems(who?: string | null): void {
  clearScoped(KEY, who)
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
   * The id of the newest entry in data/whatsnew.ts this coach has had in front
   * of them. Empty means they have never opened the panel, which is right for
   * somebody who has been building systems since before there was a panel.
   *
   * A watermark rather than a set of read ids, and rather than a count of
   * visits. The question a coach wants answered is "is there anything here I
   * have not seen", and that is one comparison against an ordered list. A visit
   * count answers a different question badly: somebody who has signed in three
   * times without finishing a system wants the guide, not a changelog, and
   * somebody back after three months wants the changelog on their first return.
   *
   * The one field here that is not a latch, because it moves forward rather
   * than turning on. It still never moves back.
   */
  newsSeen: string
  /**
   * How many times the studio has finished the job: a share link published, a
   * film written. Not visits, and not systems started.
   *
   * It exists to time the one question we ask a coach (../feedback.ts). A
   * number of sessions would have been easier and would have measured
   * attendance; this measures whether the tool worked, which is the only thing
   * that makes somebody's opinion worth having.
   */
  wins: number
  /** When we last put the feedback dialog in front of them. 0 = never. */
  feedbackAskedAt: number
  /** When they last actually sent something. 0 = never. */
  feedbackSentAt: number
  /**
   * Has been told the studio wants a bigger screen, and chosen to carry on
   * anyway. Latches like the rest: somebody who has made that decision once
   * should not be asked again every time they open the tab on the same phone.
   */
  smallOk: boolean
  /**
   * ── THE PROFILE NUDGE ────────────────────────────────────────────────────
   *
   * When the portal last offered to help finish the coach's profile, how many
   * times it has, and whether they have told it to stop.
   *
   * THREE FIELDS AND NOT ONE FLAG, because the thing being modelled is not
   * "have they seen it" but "how often is it fair to ask". A profile is worth
   * completing — it is what puts a coach's name and kit and crest on every
   * board they share — and a single latch would mean asking once, on the day
   * they were least likely to care, and never again. A boolean per visit would
   * mean asking every time, which is how a good prompt becomes an advert.
   *
   * So: an escalating cadence, in `shouldNudge` (../account/completion.ts).
   * Kept HERE with the rest of the teaching state rather than on the profile
   * row, because it is a fact about this browser's relationship with the tool
   * and not about the coach — the same reason `seen` and `newsSeen` are local.
   */
  profileNudgedAt: number
  profileNudges: number
  profileNudgeOff: boolean
}

const GUIDE_DEFAULTS: GuideState = {
  seen: false,
  moved: false,
  named: false,
  phased: false,
  drew: false,
  played: false,
  railOpen: true,
  newsSeen: '',
  wins: 0,
  feedbackAskedAt: 0,
  feedbackSentAt: 0,
  smallOk: false,
  profileNudgedAt: 0,
  profileNudges: 0,
  profileNudgeOff: false,
}

export function readGuide(): GuideState {
  if (typeof localStorage === 'undefined') return { ...GUIDE_DEFAULTS }
  try {
    const raw = localStorage.getItem(scopedKey(GUIDE_KEY))
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
      localStorage.setItem(scopedKey(GUIDE_KEY), JSON.stringify(next))
    } catch {
      // Same reasoning as the autosave: losing the teaching state is survivable.
    }
  }
  sink?.({ guide: next })
  return next
}

/**
 * ── HOW BIG THE PHASE STRIP IS ───────────────────────────────────────────────
 *
 * A view preference, and the only one down here that is NOT part of the guide.
 *
 * It is kept out of `GuideState` for one concrete reason: `markGuide` refuses
 * to write on a locked board, because a stranger reading somebody else's system
 * must not be marked as having been taught anything. That rule is right for
 * teaching and wrong for furniture — a stranger on a phone looking at an
 * upright board has exactly the same reason to want the strip smaller as its
 * author does, and their choice should stick for the next link they open.
 *
 * WHY IT EXISTS AT ALL. The strip used to size its thumbnails by WIDTH, which
 * meant its height was whatever the pitch's aspect made it: about 62px on a
 * landscape board and about 148px on the upright one. So the pitch view that
 * needs the most vertical room on screen was the one that got the least, and
 * the board a coach is editing was squeezed into what the strip left (user,
 * 2026-08-27). The strip is now sized by HEIGHT, so it costs the same whatever
 * the pitch, and this is the coach's say in what that height is.
 */
export type StripSize = 'small' | 'medium' | 'large'

/** Thumbnail height in CSS pixels, wide screen and stacked. */
export const STRIP_HEIGHTS: Record<StripSize, { wide: number; stacked: number }> = {
  small: { wide: 54, stacked: 46 },
  medium: { wide: 76, stacked: 62 },
  large: { wide: 104, stacked: 84 },
}

export const STRIP_LABELS: Record<StripSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
}

/** In the order the cycle button steps through them. */
export const STRIP_SIZES: StripSize[] = ['small', 'medium', 'large']

export const DEFAULT_STRIP_SIZE: StripSize = 'medium'

const STRIP_KEY = 'tf.studio.strip'

export function readStripSize(): StripSize {
  if (typeof localStorage === 'undefined') return DEFAULT_STRIP_SIZE
  try {
    const raw = localStorage.getItem(scopedKey(STRIP_KEY))
    return STRIP_SIZES.includes(raw as StripSize) ? (raw as StripSize) : DEFAULT_STRIP_SIZE
  } catch {
    return DEFAULT_STRIP_SIZE
  }
}

export function writeStripSize(size: StripSize): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(scopedKey(STRIP_KEY), size)
    } catch {
      // Same bargain as the autosave: losing a view preference is survivable.
    }
  }
  sink?.({ view: readView() })
}

// ── which drawers are open ──────────────────────────────────────────

/**
 * The rail's open/shut state, per section name.
 *
 * It lived in ./editor/ui.tsx, reading and writing a bare `tf.studio.sections`
 * of its own. It is here now for one reason: this file is where key namespacing
 * happens, and a second module touching `localStorage` directly is a second
 * module that can forget to. See ./scope.ts.
 */
const SECTIONS_KEY = 'tf.studio.sections'

export function readSections(): Record<string, boolean> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(scopedKey(SECTIONS_KEY))
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {}
  } catch {
    // A private window. The drawer still opens; it just will not be remembered.
    return {}
  }
}

export function writeSection(title: string, open: boolean): void {
  const next = { ...readSections(), [title]: open }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(scopedKey(SECTIONS_KEY), JSON.stringify(next))
    } catch {
      // As above.
    }
  }
  sink?.({ view: { strip: readStripSize(), sections: next } })
}

// ── the way up to the account ──────────────────────────────────────

/**
 * What a coach's preferences look like on the wire. See ./account/prefs.ts.
 */
export interface Prefs {
  guide: GuideState
  view: ViewPrefs
}

export interface ViewPrefs {
  strip: StripSize
  sections: Record<string, boolean>
}

export function readView(): ViewPrefs {
  return { strip: readStripSize(), sections: readSections() }
}

/**
 * Which preferences this browser has actually written for the current account.
 *
 * Hydration needs it to answer one question honestly: on a device a coach has
 * used before, THEIR last choice here wins; on a device they have never opened,
 * there is no choice to defend and the account's copy should simply arrive. A
 * default is indistinguishable from a decision without this — read the strip
 * size on a fresh machine and it says 'medium' either way. See ./account/prefs.ts.
 */
export function hasStored(): { guide: boolean; strip: boolean; sections: boolean } {
  const has = (base: string) => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(scopedKey(base)) !== null
    } catch {
      return false
    }
  }
  return { guide: has(GUIDE_KEY), strip: has(STRIP_KEY), sections: has(SECTIONS_KEY) }
}

/**
 * ── WHY A SINK AND NOT AN IMPORT ─────────────────────────────────────────────
 *
 * The preferences above now mirror to Supabase so they follow a coach to their
 * next machine, and the module that does that (./account/prefs.ts) already
 * imports this one — ./account/cloud.ts does too. Importing it back from here
 * is a cycle, and a cycle in a module that runs inside a `useState` initialiser
 * is a half-initialised export at exactly the wrong moment.
 *
 * So the account layer registers itself, and this file stays the bottom of the
 * stack: it knows how to persist locally and knows nothing about who is signed
 * in. With nothing registered — the shoot page, a signed-out render — the local
 * write is the whole story, which is what it was before any of this.
 */
type PrefsSink = (patch: { guide?: GuideState; view?: ViewPrefs }) => void

let sink: PrefsSink | null = null

export function setPrefsSink(fn: PrefsSink | null): void {
  sink = fn
}

/**
 * Overwrite local preferences wholesale, WITHOUT sending them back up.
 *
 * For hydration only: the merged answer has just come down from the server, and
 * echoing it straight back would be a write loop between two tabs.
 */
export function applyPrefs(prefs: Partial<Prefs>): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (prefs.guide) {
      localStorage.setItem(scopedKey(GUIDE_KEY), JSON.stringify(prefs.guide))
    }
    if (prefs.view) {
      localStorage.setItem(scopedKey(STRIP_KEY), prefs.view.strip)
      localStorage.setItem(scopedKey(SECTIONS_KEY), JSON.stringify(prefs.view.sections))
    }
  } catch {
    // Same bargain as everywhere else in this file.
  }
}
