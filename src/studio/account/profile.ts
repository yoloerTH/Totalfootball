/**
 * One profile, read once, shared by everything that needs it.
 *
 * ── WHAT THIS REPLACES ───────────────────────────────────────────────────────
 *
 * Five independent `loadProfile()` calls: the portal, the editor, and three in
 * the mount path. Five round trips for one row, five separate races against the
 * session being restored, and no way at all for a save on the settings page to
 * reach a studio tab that already had the old answer. Each call site had also
 * grown its own reading of `null`, which is how a failed fetch came to look
 * exactly like a coach with no profile.
 *
 * ./prefs.ts already solved this shape — a memoised in-flight promise, keyed by
 * user id, plus a sink — and this is the same pattern with the addition a
 * profile needs and preferences do not: SUBSCRIBERS. Preferences are pulled
 * down once and held in memory, so a component reads them whenever
 * it likes. A profile is state that a form on another page can change while the
 * studio is open, so the studio has to be told.
 *
 * ── LOCAL IS NOT AUTHORITATIVE HERE, AND THAT IS THE DIFFERENCE ──────────────
 *
 * ../storage.ts and ./sync.ts make the browser the first writer because a
 * coach's WORK must survive a dropped connection mid-drag. A profile is not
 * work; it is one small row, edited on a page that exists to edit it, and it is
 * read to decide what to paint. Caching it in the browser would buy nothing
 * and cost the thing this file exists to provide — a single current answer —
 * because a stale copy is exactly what the bug in `loadProfile` produced.
 *
 * So: memory only, cleared on sign-out, re-read on the next page load. Nothing
 * about a coach's identity is kept on a machine after they leave it, which is
 * the same posture `wipeScope` takes in ../scope.ts.
 */

import { useEffect, useState } from 'react'
import { loadProfile, type Profile, type ProfileRead } from './cloud'

/**
 * What a consumer sees. `ProfileRead` plus the state it has before an answer.
 *
 * 'loading' is a fourth state and not an absence, for the reason ./session.ts
 * gives about `status`: a component that renders "you have no profile" during
 * the fetch has told the coach something untrue, and told it to them every
 * single time they open the page.
 */
export type ProfileStatus = 'loading' | 'row' | 'none' | 'error'

export interface ProfileState {
  status: ProfileStatus
  /** The row, or null. Never a placeholder — see `useProfile` on why. */
  profile: Profile | null
}

const LOADING: ProfileState = { status: 'loading', profile: null }

function toState(read: ProfileRead): ProfileState {
  return read.kind === 'row'
    ? { status: 'row', profile: read.profile }
    : { status: read.kind, profile: null }
}

// ── the one copy ─────────────────────────────────────────────────────────────

/** Whose profile is held. Guards against a stale answer for a previous coach. */
let held: string | null = null
let state: ProfileState = LOADING
let inflight: Promise<ProfileState> | null = null

const listeners = new Set<(s: ProfileState) => void>()

function publish(next: ProfileState): void {
  state = next
  for (const fn of listeners) fn(next)
}

/**
 * Fetch it, or join the fetch already running. Memoised per user id.
 *
 * Awaitable, because ../editor/StudioMount.tsx has to have the answer BEFORE it
 * decides what a new board looks like — a blank system painted after the fact
 * would repaint under a coach who had already started moving counters.
 */
export function hydrateProfile(uid: string): Promise<ProfileState> {
  if (held === uid && state.status !== 'loading' && !inflight) return Promise.resolve(state)
  if (held === uid && inflight) return inflight

  // A different coach: drop the previous answer before the request goes out, so
  // nothing can render the last account's crest while this one loads.
  if (held !== uid) {
    held = uid
    publish(LOADING)
  }

  inflight = loadProfile(uid)
    // `loadProfile` reports failure in its return value rather than by
    // throwing, so this catch is for the impossible one. It matters anyway:
    // a rejected promise left in `inflight` would be handed to every caller
    // that followed, and the page would never load again in that tab.
    .catch((): ProfileRead => ({ kind: 'error' }))
    .then((read) => {
      const next = toState(read)
      // A late answer for a coach who has since signed out or swapped is thrown
      // away rather than published. `held` is the only thing that decides.
      if (held !== uid) return state
      inflight = null
      publish(next)
      return next
    })

  return inflight
}

/**
 * Put a freshly saved profile in, without a round trip to confirm it.
 *
 * Called by the settings page after a successful write. The row that came back
 * from the database is the row we just sent — PostgREST accepted it — so
 * re-reading it would only add a request and a window in which the studio is
 * still painting the old kit.
 */
export function putProfile(profile: Profile): void {
  publish({ status: 'row', profile })
}

/**
 * Forget everything. Called from `signOut` beside `forgetVersions` and
 * `stopPrefs`, and for the same reason all three exist: the next account to
 * sign in on this machine must not be able to see a frame of the last one.
 */
export function forgetProfile(): void {
  held = null
  inflight = null
  publish(LOADING)
}

// ── reading it ───────────────────────────────────────────────────────────────

/**
 * The profile, and what kind of answer it is.
 *
 * `uid` comes from `useSession()` at the call site rather than being read here,
 * so this hook cannot fire a request before there is a session to fire it
 * with — which is the failure mode `loadProfile` used to have.
 *
 * NULL IS NOT REPLACED WITH `EMPTY_PROFILE`. It is tempting, and it is how the
 * settings page used to be written: `p ?? EMPTY_PROFILE` reads as a harmless
 * default right up until a failed fetch becomes an empty form and the next Save
 * writes the blanks over a real row. A caller that wants a blank to edit has to
 * ask for one on purpose, having looked at `status` first.
 */
export function useProfile(uid: string | null | undefined): ProfileState {
  const [local, setLocal] = useState<ProfileState>(() =>
    uid && held === uid ? state : LOADING,
  )

  useEffect(() => {
    if (!uid) {
      setLocal(LOADING)
      return
    }
    let live = true
    const listener = (s: ProfileState) => {
      if (live) setLocal(s)
    }
    listeners.add(listener)
    void hydrateProfile(uid).then((s) => {
      if (live) setLocal(s)
    })
    return () => {
      live = false
      listeners.delete(listener)
    }
  }, [uid])

  return local
}

/**
 * The profile if we have one, else null. For everything that only paints.
 *
 * The studio and the portal do not care whether a missing profile is a new
 * account or a bad connection: both mean "do not paint anything extra, and do
 * not say anything about it". Only ./Settings.tsx, which writes, needs the
 * distinction, and it uses `useProfile` directly.
 */
export function useProfileOrNull(uid: string | null | undefined): Profile | null {
  return useProfile(uid).profile
}
