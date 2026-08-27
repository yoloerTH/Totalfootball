/**
 * The write-through cache ../storage.ts always said this would become.
 *
 * The order is the whole design and it is not negotiable: **localStorage first,
 * synchronously, then Supabase behind it.** A coach building a presentation the
 * night before a session cannot lose it to a dropped connection, an expired
 * token or a 500, so the network is never in the path between a keystroke and
 * the work being safe. If this file stopped working entirely, the studio would
 * carry on exactly as it did before accounts existed.
 *
 * Which means a failed upload is not an error state, it is a "not yet". There
 * is no dialog, no retry queue and no red banner — the next edit tries again,
 * and reopening the system on this machine reads the local copy that never went
 * anywhere. The only thing the coach is told is when it HAS landed, because
 * "saved to your account" is information and "could not reach the server" mid-
 * drag is just noise about something they cannot act on.
 */

import { useEffect, useRef, useState } from 'react'
import type { System } from '../schema'
import { saveCloudSystem } from './cloud'
import { useSession } from './session'

export type SyncStatus =
  /** Signed out, or no accounts in this build. Local only, and that is fine. */
  | 'off'
  | 'saving'
  | 'saved'
  /** Tried and could not. Deliberately quiet — the next edit retries. */
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
 * Two seconds, against the local autosave's 400ms.
 *
 * Long enough that dragging a back four across the pitch is one upload rather
 * than eight, short enough that a coach who switches to their phone finds the
 * change already there.
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
export function useCloudSync(systemId: string, system: System, enabled = true): SyncStatus {
  const { status, user } = useSession()
  const [sync, setSync] = useState<SyncStatus>('off')

  // What was last successfully written, so reopening a system nobody has
  // touched does not re-upload it, and so an idle tab is silent.
  const sent = useRef<string>('')
  const timer = useRef<number | null>(null)
  /** Latches on a conflict. Cleared only by reloading the board. */
  const stuck = useRef(false)

  useEffect(() => {
    if (!enabled || status !== 'in' || !user) {
      setSync('off')
      return
    }

    // A conflict is terminal for this document in this tab. Nothing that
    // happens next can be uploaded honestly, so nothing tries.
    if (stuck.current) return

    const payload = JSON.stringify(system)
    if (payload === sent.current) return

    let live = true
    const push = async () => {
      timer.current = null
      if (!live) return
      setSync('saving')
      const result = await saveCloudSystem(systemId, system, user.id)
      if (!live) return
      if (result === 'saved') sent.current = payload
      if (result === 'conflict') stuck.current = true
      setSync(result === 'saved' ? 'saved' : result === 'conflict' ? 'conflict' : 'behind')
    }

    timer.current = window.setTimeout(push, DEBOUNCE_MS)

    /*
     * A coach who closes the laptop lid two seconds after their last change
     * should not have to reopen this machine for the work to reach the account.
     * `visibilitychange` is the event that actually fires on a mobile tab
     * switch and on closing a tab; `beforeunload` frequently does not.
     */
    const flush = () => {
      if (document.visibilityState === 'hidden' && timer.current !== null) {
        window.clearTimeout(timer.current)
        void push()
      }
    }
    document.addEventListener('visibilitychange', flush)

    return () => {
      live = false
      document.removeEventListener('visibilitychange', flush)
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [systemId, system, status, user, enabled])

  return sync
}
