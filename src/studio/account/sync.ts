/**
 * The autosave. The only thing that writes a board down, anywhere.
 *
 * ── IT USED TO BE THE SECOND HALF OF A WRITE-THROUGH CACHE ───────────────────
 *
 * There was a synchronous localStorage write in front of this one, and three
 * paragraphs here about why the network must never be in the path between a
 * keystroke and the work being safe. That is gone (user, 2026-09-06): the
 * account is the only store, so this IS the path.
 *
 * A failed upload is still a "not yet" rather than an error state, and there is
 * still no dialog and no red banner, because the coach cannot act on it and the
 * next edit retries. What changed is what a failure costs: it used to cost
 * nothing at all, and it now costs the work done since the last one that landed
 * if the tab is closed before a retry succeeds. That is what `SyncStatus` is on
 * screen for, and it is why the flush on `visibilitychange` below matters more
 * than it did.
 *
 * ── AND IT NO LONGER SERIALISES THE DOCUMENT SIXTY TIMES A SECOND ────────────
 *
 * The comparison that decides whether there is anything to upload used to run
 * in the effect body, which React re-runs on every new `system` object — every
 * pointermove of every drag. `JSON.stringify` on a 35KB document, discarded
 * unread, at frame rate. It runs inside `push` now: once per upload, which is
 * the only moment its answer is used.
 */

import { useEffect, useRef, useState } from 'react'
import type { System } from '../schema'
import { saveCloudSystem } from './cloud'
import { useSession } from './session'

export type SyncStatus =
  /**
   * Signed out, on a locked board, or no accounts in this build.
   *
   * NOT SAVING ANYWHERE. It used to mean "local only, and that is fine"; there
   * is no local any more, so 'off' means the document in front of the coach is
   * not being written down. Every path that can reach it is one where that is
   * correct — a published board somebody is only reading — and the editor is
   * behind a sign-in wall for the one where it would not be.
   */
  | 'off'
  | 'saving'
  | 'saved'
  /**
   * Tried and could not: offline, a 500, an expired token.
   *
   * Quiet, and the next edit retries. It is no longer harmless, though — see
   * the header — so it is the status the indicator should be least shy about.
   */
  | 'behind'
  /**
   * The write LANDED and the answer was no: this board has been edited
   * somewhere newer (supabase/016).
   *
   * The one status here that is not quiet, and the difference is whether the
   * coach can do anything. 'behind' is weather — the next edit retries and a
   * warning would be noise. A conflict is not weather: two copies of this board
   * have diverged, every further keystroke widens the gap, and only the person
   * who knows which window they meant can settle it.
   *
   * Uploading STOPS here rather than retrying. Retrying would be refused every
   * time, and the only way to make it succeed would be to drop the guard, which
   * is the data loss this whole change was about.
   */
  | 'conflict'

/**
 * Two seconds.
 *
 * Long enough that dragging a back four across the pitch is one upload rather
 * than eight, short enough that a coach who switches to their phone finds the
 * change already there. It was two seconds when there was a 400ms local write
 * in front of it and it is still two seconds now that there is not: the number
 * was chosen against the drag, not against the safety net.
 */
const DEBOUNCE_MS = 2000

/**
 * `enabled` is off for a locked board — `/o/…`, one of ours, opened by somebody
 * who is only looking. Being signed out already produces 'off' below, so this
 * exists for the case that does not: a coach WITH an account opening one of our
 * published systems. Without it, the studio would quietly upload our document
 * into their shelf under an id they never asked for, and the first they would
 * know of it is a system they did not build appearing on their portal.
 *
 * A parameter rather than a conditional `useCloudSync` call at the one site
 * that needs it, because hooks cannot be called conditionally.
 */
export function useCloudSync(
  systemId: string,
  system: System,
  enabled = true,
  /**
   * True when `system` is the document as the database handed it over, byte for
   * byte, and nothing has been done to it since.
   *
   * ── WHY OPENING A BOARD SHOULD NOT WRITE IT ──────────────────────────────
   *
   * Without this, the first pass through the effect below always scheduled an
   * upload, because there was nothing to compare against yet. So merely opening
   * a system saved it: a wasted round trip, and — because `updated_at` is what
   * the portal sorts the shelf by — a shelf that reordered itself every time a
   * coach looked at a board. "Newest first" quietly meant "most recently
   * opened".
   *
   * It is a parameter rather than something inferred here because only
   * ../editor/StudioMount.tsx knows the answer. A board that came back from
   * `loadCloudSystem` is stored; a fresh board, a template copy and a board
   * that has had the coach's profile painted onto it are all documents that
   * exist nowhere yet and MUST be written on open.
   */
  stored = false,
): SyncStatus {
  const { status, user } = useSession()
  const [sync, setSync] = useState<SyncStatus>('off')

  /**
   * What was last successfully written, and for which board.
   *
   * The id is part of it so that switching systems inside one tab cannot
   * compare the new board against the old board's payload and conclude there is
   * nothing to do.
   */
  const sent = useRef<{ id: string; payload: string } | null>(null)
  const timer = useRef<number | null>(null)
  /** Latches on a conflict. Cleared only by reloading the board. */
  const stuck = useRef(false)

  /**
   * The document as of this render, for `push` to read when the timer fires.
   *
   * `push` must upload the LATEST version rather than the one that happened to
   * schedule it, and closing over `system` would upload whichever pointermove
   * won the race to set the timer.
   */
  const latest = useRef(system)
  latest.current = system

  useEffect(() => {
    if (!enabled || status !== 'in' || !user) {
      setSync('off')
      return
    }

    // A conflict is terminal for this document in this tab. Nothing that
    // happens next can be uploaded honestly, so nothing tries.
    if (stuck.current) return

    // First sight of this board. A document that came out of the database is
    // recorded as already sent — see `stored` above. Anything else is new and
    // falls through to be written.
    if (sent.current?.id !== systemId) {
      sent.current = { id: systemId, payload: stored ? JSON.stringify(system) : '' }
      if (stored) return
    }

    let live = true
    const push = async () => {
      timer.current = null
      if (!live) return
      // Serialised HERE and nowhere else: once per upload, rather than once per
      // frame of a drag. See the header.
      const doc = latest.current
      const payload = JSON.stringify(doc)
      if (payload === sent.current?.payload) {
        setSync('saved')
        return
      }
      setSync('saving')
      const result = await saveCloudSystem(systemId, doc, user.id)
      if (!live) return
      if (result === 'saved') sent.current = { id: systemId, payload }
      if (result === 'conflict') stuck.current = true
      setSync(result === 'saved' ? 'saved' : result === 'conflict' ? 'conflict' : 'behind')
    }

    timer.current = window.setTimeout(push, DEBOUNCE_MS)

    /*
     * A coach who closes the laptop lid two seconds after their last change
     * should not have to reopen this machine for the work to reach the account.
     * `visibilitychange` is the event that actually fires on a mobile tab
     * switch and on closing a tab; `beforeunload` frequently does not.
     *
     * This was a nicety while a local copy existed behind it. With the account
     * as the only store it is the difference between a change surviving and not
     * surviving, so it also runs on `pagehide` — which fires on a bfcache
     * navigation where `visibilitychange` alone can be missed.
     */
    const flush = () => {
      if (timer.current === null) return
      window.clearTimeout(timer.current)
      void push()
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', flush)

    return () => {
      live = false
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', flush)
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [systemId, system, status, user, enabled, stored])

  return sync
}
