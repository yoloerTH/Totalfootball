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
 * Two seconds, against the local autosave's 400ms.
 *
 * Long enough that dragging a back four across the pitch is one upload rather
 * than eight, short enough that a coach who switches to their phone finds the
 * change already there.
 */
const DEBOUNCE_MS = 2000

export function useCloudSync(systemId: string, system: System): SyncStatus {
  const { status, user } = useSession()
  const [sync, setSync] = useState<SyncStatus>('off')

  // What was last successfully written, so reopening a system nobody has
  // touched does not re-upload it, and so an idle tab is silent.
  const sent = useRef<string>('')
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (status !== 'in' || !user) {
      setSync('off')
      return
    }

    const payload = JSON.stringify(system)
    if (payload === sent.current) return

    let live = true
    const push = async () => {
      timer.current = null
      if (!live) return
      setSync('saving')
      const ok = await saveCloudSystem(systemId, system, user.id)
      if (!live) return
      if (ok) sent.current = payload
      setSync(ok ? 'saved' : 'behind')
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
  }, [systemId, system, status, user])

  return sync
}
