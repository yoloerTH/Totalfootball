/**
 * The studio's in-memory session state.
 *
 * ── THIS FILE USED TO BE A localStorage LAYER. IT IS NOT ONE ANY MORE ────────
 *
 * Everything the studio keeps now lives in Supabase and nowhere else (user,
 * 2026-09-06). Systems are rows in `studio_systems`, sequences are rows in
 * `studio_sequences`, and every preference below is one row in `studio_prefs`.
 * Nothing here touches `localStorage`, `sessionStorage` or IndexedDB, and
 * nothing may be added that does.
 *
 * The old design wrote to the browser first and treated the server as a sync
 * target. It bought offline editing and it cost the two things that actually
 * hurt: the same document existed in two places with no way to say which was
 * right, and a shared laptop kept a copy of a coach's work that outlived their
 * session. Both were real bugs (see ./scope.ts) and both were bugs of this
 * shape rather than bugs in the implementation.
 *
 * ── WHAT THIS FILE IS NOW, AND WHY IT STILL EXISTS ───────────────────────────
 *
 * A synchronous READ CACHE over one Supabase row, for the whole life of a tab.
 *
 * It has to be synchronous. `readGuide()` is called inside a `useState`
 * initialiser and `readStripSize()` inside another; a promise cannot be
 * returned to either. So the shape is: ./account/prefs.ts fetches the row ONCE,
 * before anything renders, calls `applyPrefs` to fill the object below, and
 * from then on every read is a property access and every write updates the
 * object and hands a patch to the sink, which debounces it up to the row.
 *
 * The consequence, said plainly: this cache is not a copy of the truth that can
 * be opened tomorrow. It dies with the tab. If the upload fails the change is
 * lost when the tab closes, and that is the trade the account-only rule makes —
 * a preference nobody can be sure of is worth less than a document that only
 * exists in one place.
 *
 * ── WHAT IS NOT HERE ANY MORE ────────────────────────────────────────────────
 *
 * `listSystems`, `loadSystem`, `saveSystem`, `deleteSystem`, `clearSystems` and
 * `hasStored` are gone. Systems are read and written through ./account/cloud.ts
 * and only through it — a second store for the same document is the thing that
 * was wrong. `hasStored` answered "has this browser ever expressed a preference
 * for this account", which was only a question worth asking while a browser
 * held state of its own; the row is now simply the answer.
 */

import { RETIRED_AREAS, resolveViewId } from './board/pitch'
import type { System } from './schema'

/**
 * Bring a stored document up to date on the way out of the database.
 *
 * Read-time migration rather than a one-off sweep. A sweep would be possible
 * now that every document is a row we can reach — and it would still be wrong
 * to rely on: `doc` is written by the web studio, by the iOS app and by
 * scripts/push-system.mjs, so a document repaired on the server can be
 * overwritten by an older client an hour later. Repairing on the read path is
 * the only place that holds for every writer.
 *
 * Everything here must be idempotent and must never throw on a shape it does
 * not recognise. A coach losing a presentation to a schema tweak is the failure
 * this exists to prevent, and that has not changed with where the bytes live.
 */
export function migrate(system: System): System {
  // Pitch views that were retired (`middle-third`, `final-third`) map to their
  // nearest survivor. Marks are stored as percent-of-crop, so a view swap does
  // move them relative to the grass — but the alternative is a document that
  // names a view we no longer have, which renders as nothing at all.
  const pitch = resolveViewId(system.pitch)
  if (pitch === system.pitch) return system
  // The four fixed training boards became one board with a size, so the id
  // alone is not the whole of what a document said: `rondo-square` meant a
  // 20 x 20 with an inner box, and it still does. Carry the size across with
  // the id, or a saved rondo would open as the default 30 x 20 possession grid.
  const area = RETIRED_AREAS[system.pitch]
  return { ...system, pitch, ...(area && !system.area ? { area } : {}) }
}

/** A short, URL-safe id. Collision risk is irrelevant at one-coach scale. */
export function newSystemId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

// ── what the coach has already been shown ────────────────────────────────────

/**
 * Which parts of the studio a coach has actually done.
 *
 * Kept apart from the documents on purpose. This is about the PERSON, not about
 * a board: someone who learned to draw a pass on their first system should not
 * be told how to draw a pass again on their fourth. It is one jsonb column on
 * the coach's own `studio_prefs` row (supabase/014), so it follows them to the
 * next machine, which is the whole reason it stopped being a browser key.
 *
 * Every flag latches. They are "has this ever happened", not "is this true
 * now" — deleting the only arrow on the board should not un-teach the coach
 * what arrows are, and watching a finished checklist item flick back to
 * undone is the kind of thing that makes a tool feel like it is marking your
 * homework. That property is also what makes merging two devices' copies
 * trivial and lossless; see `latchGuide` in ./account/prefs.ts.
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
   * So: an escalating cadence, in `shouldNudge` (./account/completion.ts).
   */
  profileNudgedAt: number
  profileNudges: number
  profileNudgeOff: boolean
  /** Has seen the upgrades walkthrough (2nd+ visit) */
  upgradesSeen: boolean
}

/**
 * Exported so ./account/prefs.ts can spread a partial row over them.
 *
 * A field added in a later build must read as "not done yet" for every account
 * that has a row written before it existed, and the only way to guarantee that
 * is for one object to be the base of every read.
 */
export const GUIDE_DEFAULTS: GuideState = {
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
  upgradesSeen: false,
}

// ── the furniture ────────────────────────────────────────────────────────────

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
 * author does.
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

/**
 * Whether a dragged mark lines itself up with the ones around it.
 *
 * A PREFERENCE ABOUT THE TOOL, NOT A PROPERTY OF THE DOCUMENT, which is why it
 * is here and not in ./schema.ts. A shared board carries how the pitch is drawn
 * and where everybody stands; it must not carry the fact that the coach who
 * drew it prefers to work with the snap off, because it would then be imposed
 * on whoever opens it. See ./board/align.ts.
 *
 * On by default. It is the behaviour that was asked for, and it is suspendable
 * mid-drag by holding the ⌥ key — this switch exists for the iPad, which has no
 * modifier to hold.
 */
export const DEFAULT_SNAP = true

/**
 * Whether fixing somebody on one phase also fixes the phases still holding him.
 *
 * A workspace preference like the snap, not a document property: a board handed
 * to an assistant must not carry the fact that whoever drew it edits this way.
 * On by default, because the alternative — silently leaving three copies of a
 * mistake behind the one you corrected — is the behaviour that got reported.
 */
export const DEFAULT_CARRY = true

/**
 * What a coach's preferences look like on the wire. See ./account/prefs.ts.
 */
export interface Prefs {
  guide: GuideState
  view: ViewPrefs
  /**
   * The system to reopen. Empty for a coach who has not opened one yet.
   *
   * It used to live in the local systems store, which made "reopen where you
   * left off" a fact about a MACHINE. It is a fact about a coach: someone who
   * stops on the desktop and picks up the laptop should land on the same board.
   * See supabase/016.
   */
  last: string
}

export interface ViewPrefs {
  strip: StripSize
  /** The rail's open/shut state, per section name. See ./editor/ui.tsx. */
  sections: Record<string, boolean>
  snap: boolean
  /** Optional: an account synced before this preference existed has none. */
  carry?: boolean
}

// ── the cache itself ─────────────────────────────────────────────────────────

/**
 * One object, for the life of the tab.
 *
 * It starts at the defaults so a read before hydration is answered with
 * something sane rather than with a crash — but no component should ever get
 * that far. ../editor/StudioMount.tsx and ./account/Portal.tsx both await
 * `hydratePrefs` before they render anything that reads it, because a guide
 * that arrives after mount arrives as a walkthrough opening over a board the
 * coach was already working on.
 */
let cache: Prefs = {
  guide: { ...GUIDE_DEFAULTS },
  view: {
    strip: DEFAULT_STRIP_SIZE,
    sections: {},
    snap: DEFAULT_SNAP,
    carry: DEFAULT_CARRY,
  },
  last: '',
}

/**
 * Has the row landed?
 *
 * Read by ./account/prefs.ts to tell "the coach has never chosen a strip size"
 * from "we have not asked yet", which is the one distinction a defaults-filled
 * cache cannot express on its own.
 */
let hydrated = false

export function isHydrated(): boolean {
  return hydrated
}

export function readGuide(): GuideState {
  return { ...cache.guide }
}

export function writeGuide(patch: Partial<GuideState>): GuideState {
  cache.guide = { ...cache.guide, ...patch }
  const next = { ...cache.guide }
  sink?.({ guide: next })
  return next
}

export function readStripSize(): StripSize {
  return cache.view.strip
}

export function writeStripSize(size: StripSize): void {
  cache.view = { ...cache.view, strip: size }
  sink?.({ view: readView() })
}

export function readSnap(): boolean {
  return cache.view.snap
}

export function writeSnap(on: boolean): void {
  cache.view = { ...cache.view, snap: on }
  sink?.({ view: readView() })
}

export function readCarry(): boolean {
  return cache.view.carry ?? DEFAULT_CARRY
}

export function writeCarry(on: boolean): void {
  cache.view = { ...cache.view, carry: on }
  sink?.({ view: readView() })
}

export function readSections(): Record<string, boolean> {
  return { ...cache.view.sections }
}

export function writeSection(title: string, open: boolean): void {
  cache.view = { ...cache.view, sections: { ...cache.view.sections, [title]: open } }
  sink?.({ view: readView() })
}

export function readView(): ViewPrefs {
  return { ...cache.view, sections: { ...cache.view.sections } }
}

/** The board to reopen, straight off the coach's account. See `Prefs.last`. */
export function lastOpened(): string | null {
  return cache.last || null
}

/**
 * Remember which board is open, for the next device this coach picks up.
 *
 * Called by ../editor/StudioMount.tsx once, when a board is opened, and NOT by
 * the autosave. The autosave runs every 400ms during a drag and the board a
 * coach is on is the same one it was 400ms ago; sending that up on every edit
 * was a write per keystroke for a fact that changes once a session.
 */
export function noteOpened(id: string): void {
  if (!id || cache.last === id) return
  cache.last = id
  sink?.({ last: id })
}

/**
 * Overwrite the cache wholesale, WITHOUT sending it back up.
 *
 * For hydration only: the merged answer has just come down from the server, and
 * echoing it straight back would be a write loop between two tabs.
 */
export function applyPrefs(prefs: Partial<Prefs>): void {
  if (prefs.guide) cache.guide = { ...GUIDE_DEFAULTS, ...prefs.guide }
  if (prefs.view) {
    cache.view = {
      strip: prefs.view.strip ?? DEFAULT_STRIP_SIZE,
      sections: { ...(prefs.view.sections ?? {}) },
      snap: typeof prefs.view.snap === 'boolean' ? prefs.view.snap : DEFAULT_SNAP,
      carry: typeof prefs.view.carry === 'boolean' ? prefs.view.carry : DEFAULT_CARRY,
    }
  }
  if (typeof prefs.last === 'string') cache.last = prefs.last
  hydrated = true
}

/**
 * Back to defaults. Called on sign-out, beside `forgetVersions` and
 * `forgetProfile`.
 *
 * The account is the only store, so there is nothing here to preserve and one
 * concrete reason to drop it: on a shared laptop the next coach to sign in must
 * not spend a single render inside the previous one's guide state. That used to
 * need a whole namespacing scheme (./scope.ts) because the state outlived the
 * session in the browser. It does not outlive it any more, and this is the
 * entire replacement for that scheme.
 */
export function resetSession(): void {
  cache = {
    guide: { ...GUIDE_DEFAULTS },
    view: {
      strip: DEFAULT_STRIP_SIZE,
      sections: {},
      snap: DEFAULT_SNAP,
      carry: DEFAULT_CARRY,
    },
    last: '',
  }
  hydrated = false
}

/**
 * ── WHY A SINK AND NOT AN IMPORT ─────────────────────────────────────────────
 *
 * The preferences above are mirrored to Supabase by ./account/prefs.ts, which
 * already imports this file — ./account/cloud.ts does too. Importing it back
 * from here is a cycle, and a cycle in a module that runs inside a `useState`
 * initialiser is a half-initialised export at exactly the wrong moment.
 *
 * So the account layer registers itself, and this file stays the bottom of the
 * stack: it holds the session's state and knows nothing about who is signed in.
 * With nothing registered — the shoot page, a signed-out render — writes land in
 * the cache and go no further, which is right: there is no account to put them
 * on.
 */
type PrefsSink = (patch: { guide?: GuideState; view?: ViewPrefs; last?: string }) => void

let sink: PrefsSink | null = null

export function setPrefsSink(fn: PrefsSink | null): void {
  sink = fn
}
