/**
 * Preferences, which live on the account and only on the account.
 *
 * ── WHAT THIS FILE IS THE OTHER HALF OF ──────────────────────────────────────
 *
 * ../storage.ts is a synchronous cache with no store behind it. This is the
 * store: supabase/014, one private row per coach, RLS'd like 005. Preferences
 * belong to a PERSON, so a coach who signs in on a second machine arrives with
 * their drawers as they left them and no walkthrough replaying at somebody who
 * finished it months ago.
 *
 * It used to be a mirror rather than a store — every write landed in
 * `localStorage` first and the upload was allowed to fail quietly behind it.
 * That is gone (user, 2026-09-06). Nothing is written to the browser, so the
 * debounced upload below is the only thing standing between a coach closing a
 * drawer and that fact existing anywhere. It still fails quietly, because the
 * alternative is interrupting somebody mid-drag about a drawer.
 *
 * ── AND THE ONE-TIME SWEEP ───────────────────────────────────────────────────
 *
 * `hydratePrefs` also runs ./adopt.ts, which moves whatever the old
 * localStorage layer left in this browser into the account and then deletes it.
 * It is here rather than at the two call sites because BOTH of them need it
 * done before they render: the portal to show the shelf, the editor to open the
 * sequence library. See that file for the stakes.
 */

import { db } from './client'
import {
  DEFAULT_CARRY,
  DEFAULT_SNAP,
  DEFAULT_STRIP_SIZE,
  GUIDE_DEFAULTS as GUIDE_BASE,
  applyPrefs,
  setPrefsSink,
  type GuideState,
  type Prefs,
  type ViewPrefs,
} from '../storage'
import { adoptLocalWork, clearLocalPrefs, readLocalPrefs, type Adopted } from './adopt'
import { WHATS_NEW } from '../../data/whatsnew'

/** Shape of the row supabase/014 hands back. `view_prefs`, not `view` — see 014. */
interface PrefsRow {
  guide: Partial<GuideState> | null
  view_prefs: Partial<ViewPrefs> | null
  last_system: string | null
}

// ── merging ──────────────────────────────────────────────────────────────────

/**
 * How far through the changelog a watermark is, as a position.
 *
 * WHATS_NEW is newest-first, so a LOWER index is further along. An id this
 * build has never heard of — written by a newer deploy, or an entry since
 * removed — reads as the very beginning rather than as the end: it must not be
 * able to mark a coach as having seen entries they have not.
 */
function newsRank(id: string): number {
  if (!id) return WHATS_NEW.length
  const i = WHATS_NEW.findIndex((n) => n.id === id)
  return i === -1 ? WHATS_NEW.length : i
}

/**
 * Reconcile the account's guide state with this browser's.
 *
 * ── EVERY FIELD IS MONOTONE, AND THAT IS WHY THIS WORKS WITHOUT CLOCKS ───────
 *
 * There is no per-field timestamp anywhere and there does not need to be. The
 * guide is a record of things that have HAPPENED: a latch that has been thrown,
 * a counter that has gone up, a watermark that has moved forward. Merging two
 * copies of that is taking the further-along of each, which is commutative,
 * idempotent and cannot lose a fact — a coach who drew their first arrow on the
 * laptop is not going to be taught arrows again by the desktop.
 *
 * `railOpen` is the exception and is handled at the call site, because it is
 * furniture rather than history. See `reconcile`.
 */
function latchGuide(remote: Partial<GuideState>, local: GuideState): GuideState {
  const on = (k: keyof GuideState) => Boolean(local[k]) || Boolean(remote[k])
  const high = (k: keyof GuideState) =>
    Math.max(Number(local[k]) || 0, Number(remote[k]) || 0)

  return {
    ...local,
    seen: on('seen'),
    moved: on('moved'),
    named: on('named'),
    phased: on('phased'),
    drew: on('drew'),
    played: on('played'),
    smallOk: on('smallOk'),
    profileNudgeOff: on('profileNudgeOff'),
    wins: high('wins'),
    feedbackAskedAt: high('feedbackAskedAt'),
    feedbackSentAt: high('feedbackSentAt'),
    profileNudgedAt: high('profileNudgedAt'),
    profileNudges: high('profileNudges'),
    // Furthest through the changelog wins, by the list's own order rather than
    // by string comparison — the ids are words, not versions.
    newsSeen:
      newsRank(remote.newsSeen ?? '') < newsRank(local.newsSeen)
        ? (remote.newsSeen as string)
        : local.newsSeen,
  }
}

/**
 * The whole reconciliation, guide and furniture.
 *
 * ── THERE IS ONLY ONE COPY NOW, SO THIS RUNS ONCE PER BROWSER AND THEN STOPS ─
 *
 * It used to run on every sign-in, arbitrating between the account's row and
 * whatever this browser had written for itself, with `hasStored` deciding who
 * won each field. That question — "has this device ever expressed a preference"
 * — only existed because the device held state. It does not, so the row IS the
 * answer and hydration is a straight read.
 *
 * The exception, and the only reason this function survives: the browsers that
 * still hold the OLD layer's keys. `seed` is what ./adopt.ts found in one of
 * them, and it is merged in exactly once before those keys are deleted. A
 * `seed` of null — every sign-in after the first, and every browser that never
 * ran the old build — takes the row unchanged.
 *
 * The merge is a latch merge, and that is safe for the same reason it always
 * was: every guide field records something that has HAPPENED, so taking the
 * further-along of each is commutative, idempotent and cannot lose a fact. The
 * furniture is decided rather than merged, and the local copy wins it — a coach
 * whose drawers were tidy on this machine yesterday should find them tidy
 * today, and this is the last time the machine gets a say.
 */
function reconcile(row: PrefsRow, seed: Partial<Prefs> | null): Prefs {
  const remoteGuide = row.guide ?? {}
  const remoteView = row.view_prefs ?? {}

  const guide = seed?.guide
    ? latchGuide(remoteGuide, { ...GUIDE_BASE, ...seed.guide })
    : { ...GUIDE_BASE, ...remoteGuide }

  // Furniture, when there is no seed: whatever the account says, falling back
  // to the defaults ../storage.ts already holds.
  const view: ViewPrefs = {
    strip: seed?.view?.strip ?? remoteView.strip ?? DEFAULT_STRIP_SIZE,
    // Union either way. A drawer either copy has an opinion about keeps it, and
    // the local one wins a disagreement for the reason in the header above.
    sections: { ...(remoteView.sections ?? {}), ...(seed?.view?.sections ?? {}) },
    // `typeof` and not a truthiness test, because the interesting value is `false`.
    snap:
      typeof seed?.view?.snap === 'boolean'
        ? seed.view.snap
        : typeof remoteView.snap === 'boolean'
          ? remoteView.snap
          : DEFAULT_SNAP,
    carry:
      typeof seed?.view?.carry === 'boolean'
        ? seed.view.carry
        : typeof remoteView.carry === 'boolean'
          ? remoteView.carry
          : DEFAULT_CARRY,
  }

  /*
   * THE ACCOUNT WINS OUTRIGHT, and always did.
   *
   * "Which board was I on" is not a preference about how this browser looks. It
   * is a single moving fact about the coach, and the account holds the most
   * recent version of it by construction — it was written by whichever device
   * they used last, which is the one they are asking to continue from.
   */
  return { guide, view, last: row.last_system ?? '' }
}

// ── the wire ─────────────────────────────────────────────────────────────────

/**
 * One RPC for reading and for writing, and supabase/014 explains why: an empty
 * patch merges nothing and returns the row as it stands, creating an empty one
 * for an account that has never written. Hydration therefore cannot race a
 * first write, and there is no second code path to keep in step with this one.
 */
async function merge(patch: {
  guide?: unknown
  view?: unknown
  last?: string
}): Promise<PrefsRow | null> {
  const supabase = db()
  if (!supabase) return null
  const { data, error } = await supabase.rpc('studio_prefs_merge', {
    p_guide: patch.guide ?? {},
    p_view: patch.view ?? {},
    // NULL means "not telling", never "clear it" — supabase/016 coalesces it
    // against what is already there. Hydration sends nothing and must not wipe
    // the board the coach was on.
    p_last: patch.last ?? null,
  })
  if (error || !data) return null
  return data as PrefsRow
}

/**
 * The upload, coalesced.
 *
 * `markGuide` fires on a drag, on a play, on a drawer — several times a second
 * during ordinary use. Each one is a real local write and none of them is worth
 * its own round trip, so they pile into one timer and go up together. The same
 * shape ./sync.ts uses for documents, for the same reason.
 *
 * A failure is silence. There is nothing here worth interrupting a coach for:
 * the preference is already applied in front of them, it is already in this
 * browser, and the next change will carry it up.
 */
let timer: ReturnType<typeof setTimeout> | null = null
let pending: { guide?: GuideState; view?: ViewPrefs; last?: string } = {}

function push(patch: { guide?: GuideState; view?: ViewPrefs; last?: string }): void {
  pending = { ...pending, ...patch }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    const body = pending
    pending = {}
    timer = null
    void merge(body)
  }, 1200)
}

// ── hydration ────────────────────────────────────────────────────────────────

/**
 * Memoised per user id, and holding the PROMISE rather than a boolean.
 *
 * The portal and the editor both need this done before they read a flag, and on
 * a fast sign-in they ask within a frame of each other. Storing the in-flight
 * promise means the second caller waits on the first one's request instead of
 * starting a duplicate that would race it back into `applyPrefs` — and, now
 * that the sweep runs from in here, instead of running two sweeps at once
 * against the same localStorage keys.
 */
const inflight = new Map<string, Promise<Adopted>>()

/**
 * Fill the session cache from the account, once per sign-in, and clear out
 * whatever the old local layer left behind.
 *
 * MUST BE AWAITED BEFORE ANYTHING READS THE GUIDE. `readGuide()` is called in a
 * `useState` initialiser and answers out of a cache that starts at the
 * defaults, so a hydration that lands after mount leaves a walkthrough already
 * on screen at a coach who finished it months ago. Both call sites gate on it:
 * ../editor/StudioMount.tsx will not render the editor until it resolves, and
 * ./Portal.tsx will not judge the profile nudge.
 *
 * ── THE ORDER IS DELIBERATE ──────────────────────────────────────────────────
 *
 *  1. Read what the old localStorage layer is holding, if anything.
 *  2. Sweep this browser's documents into the account (./adopt.ts). Before the
 *     merge, so a coach whose only copy of a board was local has it on the
 *     shelf by the time the portal draws one.
 *  3. Merge, which both fetches the row and creates it for an account that has
 *     never written — supabase/014 explains why one RPC does both: an empty
 *     patch merges nothing and returns the row as it stands, so hydration
 *     cannot race a first write and there is no second code path to keep in
 *     step with this one.
 *  4. Apply, push the reconciled answer back, and only THEN delete the local
 *     keys. Deleting before the row has the merged copy is the one ordering
 *     that loses a preference for good.
 *
 * Registering the sink is the LAST thing it does. Doing it earlier would let
 * `applyPrefs` — or any write between the fetch and the reconcile — echo
 * straight back up as a patch, which is a write loop with itself.
 *
 * Returns what the sweep claimed, so the portal can say so once.
 */
export function hydratePrefs(uid: string): Promise<Adopted> {
  const already = inflight.get(uid)
  if (already) return already

  const run = (async (): Promise<Adopted> => {
    const seed = readLocalPrefs(uid)
    const adopted = await adoptLocalWork(uid)
    const row = await merge({})
    if (row) {
      const next = reconcile(row, seed)
      applyPrefs(next)
      // Send the reconciled answer back, so the account gains whatever the seed
      // knew that it did not. Debounced like any other change; nothing
      // downstream is waiting on it.
      if (seed) push(next)
      clearLocalPrefs(uid)
    }
    setPrefsSink(push)
    return adopted
  })()

  inflight.set(uid, run)
  return run
}

/**
 * Stop mirroring. Called on the way out, before the sign-out navigation.
 *
 * Without it the sink stays registered against a client whose session has just
 * gone, and the next write — a drawer closing as the page tears down — would be
 * a 401 in the console for something nobody asked for.
 *
 * ── IT FLUSHES FIRST, WHICH IT DID NOT NEED TO BEFORE ────────────────────────
 *
 * A pending patch used to be safe to drop: it was already in localStorage and
 * the next sign-in would push it up from there. There is no next sign-in to
 * push it from now, so a coach who shuts a drawer and immediately signs out
 * would lose that inside the 1200ms window. The flush is fire-and-forget —
 * `signOut` has already been called by the time this runs and waiting on it
 * would put a network round trip in front of somebody leaving.
 */
export function stopPrefs(): void {
  if (timer) clearTimeout(timer)
  timer = null
  if (Object.keys(pending).length) {
    const body = pending
    void merge(body)
  }
  pending = {}
  inflight.clear()
  setPrefsSink(null)
}
