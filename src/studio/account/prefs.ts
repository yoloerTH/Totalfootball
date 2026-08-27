/**
 * Preferences, mirrored to the account.
 *
 * ── WHAT THIS IS THE SECOND HALF OF ──────────────────────────────────────────
 *
 * The first half is ../scope.ts: every studio key in `localStorage` is now
 * namespaced by user id, so two accounts on one browser cannot read each
 * other's anything. That fixes the leak (user, 2026-08-27) and nothing else —
 * a coach who signs in on a second machine still arrives with the walkthrough
 * replaying and their drawers shut.
 *
 * This file closes that. Preferences belong to a PERSON, so they live with the
 * person: supabase/014, one private row per account, RLS'd like 005. A new
 * account is now provably clean rather than merely namespaced — the server has
 * no row for it, so there is nothing anywhere that could have come from
 * somebody else.
 *
 * ── LOCAL STAYS AUTHORITATIVE ────────────────────────────────────────────────
 *
 * The same bargain ../storage.ts has always made, and this changes none of it.
 * Every write lands in `localStorage` synchronously; the upload is debounced
 * behind it and is allowed to fail. A coach with no connection loses the
 * mirroring and keeps the studio.
 */

import { db } from './client'
import {
  applyPrefs,
  hasStored,
  readGuide,
  readView,
  setPrefsSink,
  type GuideState,
  type Prefs,
  type ViewPrefs,
} from '../storage'
import { WHATS_NEW } from '../../data/whatsnew'

/** Shape of the row supabase/014 hands back. `view_prefs`, not `view` — see 014. */
interface PrefsRow {
  guide: Partial<GuideState> | null
  view_prefs: Partial<ViewPrefs> | null
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
 * ── WHO WINS ON A PREFERENCE, WHICH IS NOT A FACT ────────────────────────────
 *
 * A latch merges. A preference has to be decided, and the deciding question is
 * whether this browser has ever expressed one for this account — which is what
 * `hasStored` answers and what a plain read cannot: the strip size reads
 * 'medium' on a machine that chose it and on a machine that has never been
 * opened, and those two must not be treated alike.
 *
 * So: a device you have used defends its own choice and pushes it up; a device
 * you have never opened inherits the account's. That is the behaviour a coach
 * would describe as "it remembered", in both directions.
 */
function reconcile(row: PrefsRow, local: Prefs): Prefs {
  const remoteGuide = row.guide ?? {}
  const remoteView = row.view_prefs ?? {}
  const stored = hasStored()

  const guide = latchGuide(remoteGuide, local.guide)
  if (!stored.guide && typeof remoteGuide.railOpen === 'boolean') {
    guide.railOpen = remoteGuide.railOpen
  }

  return {
    guide,
    view: {
      strip: !stored.strip && remoteView.strip ? remoteView.strip : local.view.strip,
      // Union either way; a drawer this browser has an opinion about keeps it.
      sections: stored.sections
        ? { ...(remoteView.sections ?? {}), ...local.view.sections }
        : { ...local.view.sections, ...(remoteView.sections ?? {}) },
    },
  }
}

// ── the wire ─────────────────────────────────────────────────────────────────

/**
 * One RPC for reading and for writing, and supabase/014 explains why: an empty
 * patch merges nothing and returns the row as it stands, creating an empty one
 * for an account that has never written. Hydration therefore cannot race a
 * first write, and there is no second code path to keep in step with this one.
 */
async function merge(patch: { guide?: unknown; view?: unknown }): Promise<PrefsRow | null> {
  const supabase = db()
  if (!supabase) return null
  const { data, error } = await supabase.rpc('studio_prefs_merge', {
    p_guide: patch.guide ?? {},
    p_view: patch.view ?? {},
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
let pending: { guide?: GuideState; view?: ViewPrefs } = {}

function push(patch: { guide?: GuideState; view?: ViewPrefs }): void {
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
 * starting a duplicate that would race it back into `applyPrefs`.
 */
const inflight = new Map<string, Promise<void>>()

/**
 * Bring this browser and this account into agreement, once per sign-in.
 *
 * MUST BE AWAITED BEFORE ANYTHING READS THE GUIDE. `readGuide()` is called in a
 * `useState` initialiser, so a hydration that lands after mount would leave a
 * walkthrough already on screen at a coach who finished it months ago — the
 * same failure ../../pages/studio/shoot.astro documents for its own seeding.
 * Both call sites gate on it: ../editor/StudioMount.tsx will not render the
 * editor until it resolves, and ./Portal.tsx will not judge the profile nudge.
 *
 * Registering the sink is the LAST thing it does. Doing it earlier would let
 * `applyPrefs` — or any write between the fetch and the reconcile — echo
 * straight back up as a patch, which is a write loop with itself.
 */
export function hydratePrefs(uid: string): Promise<void> {
  const already = inflight.get(uid)
  if (already) return already

  const run = (async () => {
    const local: Prefs = { guide: readGuide(), view: readView() }
    const row = await merge({})
    if (row) {
      const next = reconcile(row, local)
      applyPrefs(next)
      // Send the reconciled answer back, so the account gains whatever this
      // browser knew that it did not. Debounced like any other change: nothing
      // downstream is waiting on it.
      push(next)
    }
    setPrefsSink(push)
  })()

  inflight.set(uid, run)
  return run
}

/**
 * Stop mirroring. Called on the way out, before the sign-out navigation.
 *
 * Without it the sink stays registered against a client whose session has just
 * gone, and the next local write — a drawer closing as the page tears down —
 * would be a 401 in the console for something nobody asked for.
 */
export function stopPrefs(): void {
  if (timer) clearTimeout(timer)
  timer = null
  pending = {}
  inflight.clear()
  setPrefsSink(null)
}
