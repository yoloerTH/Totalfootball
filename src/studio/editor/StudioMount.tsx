/**
 * Resolves which system the editor should open, then mounts it.
 *
 * Split out from StudioEditor so the editor itself can stay a pure function of
 * `(systemId, initial)`. That is what lets the same editor serve a scratch
 * system in a browser nobody has signed into and one pulled out of a coach's
 * account, with only this file deciding where the document came from.
 *
 * Reads `?s=<id>` to reopen a specific system, otherwise resumes the last one
 * touched, otherwise starts a new one.
 *
 * ── WHERE A DOCUMENT COMES FROM, IN ORDER ────────────────────────────────────
 *
 *  0. `?t=<template>`, which is not really "where a document came from" so much
 *     as "make me one": one of ours, copied, under a new id. It jumps the queue
 *     because it is the only case where the coach has asked for a NEW document
 *     rather than for the one they were working on — see the note by it below.
 *  1. localStorage. Always tried first, always instant, and correct on the
 *     machine the coach actually built the thing on.
 *  2. The account, but only if (1) missed AND somebody is signed in. This is
 *     the second-machine case: a system built on the laptop, opened from the
 *     phone off the portal, where the id is real but this browser has never
 *     seen it.
 *  3. A fresh board.
 *
 * The wait in (2) is why `status` has an 'unknown' state. Deciding "not in
 * localStorage, so make a new one" while the session is still being restored
 * would hand a coach a blank board and then autosave it OVER the system they
 * asked for. The one thing this file must never do.
 */

import { useEffect, useState } from 'react'
import StudioEditor, { newSystem } from './StudioEditor'
import { lastOpened, loadSystem, newSystemId } from '../storage'
import { loadCloudSystem, loadProfile, withProfile } from '../account/cloud'
import { fromTemplate, templateById } from '../templates'
import { useSession } from '../account/session'
import type { System } from '../schema'

export default function StudioMount() {
  const { status } = useSession()
  const [state, setState] = useState<{ id: string; initial: System } | null>(null)

  /*
   * The studio needs an account.
   *
   * It did not, for two sessions, and the reasoning for that is still written
   * all over ../storage.ts — a coach could land here and be dragging players
   * around before anyone asked who they were. The call has been reversed
   * (user, 2026-08-13): the board is behind the door now.
   *
   * localStorage-first stays exactly as it was, and it is not vestigial. It is
   * still what makes the editor survive a dropped connection mid-session, still
   * what makes an autosave instant, and `claimLocalSystems` still matters for
   * anyone who built something during the open alpha.
   */
  useEffect(() => {
    if (status !== 'out') return
    const next = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.replace(`/studio/login/?next=${next}`)
  }, [status])

  useEffect(() => {
    // Hold until we know whether there is an account to ask. See above.
    if (status !== 'in') return

    let live = true
    const params = new URLSearchParams(window.location.search)
    const requested = params.get('s')

    /*
     * "Open one of ours."
     *
     * Always a NEW id, never `lastOpened()`, and it must be decided before the
     * id is: resuming the last system here would be the worst outcome available
     * — a coach presses "Start from this one" and lands on the thing they were
     * already editing, with no sign anything went wrong.
     *
     * The copy is the coach's from this moment on. `fromTemplate` takes our
     * credit line and our share id off it, so pressing Share publishes THEIR
     * link rather than republishing ours.
     */
    const template = templateById(params.get('t'))
    const id = template ? newSystemId() : (requested ?? lastOpened() ?? newSystemId())

    const open = async () => {
      if (template) {
        const profile = await loadProfile()
        const copy = fromTemplate(template)
        if (!profile) return copy
        /*
         * The coach's name, but NOT the coach's colours.
         *
         * `withProfile` repaints the home kit, which is right for a blank board
         * — its own comment says it only fills what is empty — and wrong here:
         * these five were coloured deliberately, and a worked example that no
         * longer looks like the film it came from teaches less. Blanking the
         * colour is how you ask that function for the credit half, rather than
         * writing a second copy of it here that can drift.
         */
        return withProfile(copy, { ...profile, teamColour: '' })
      }
      const local = loadSystem(id)
      if (local) return local
      const remote = await loadCloudSystem(id)
      if (remote) return remote
      // A brand new board for a coach we already know something about opens in
      // their colours and already signed. See `withProfile`.
      const profile = await loadProfile()
      return profile ? withProfile(newSystem(), profile) : newSystem()
    }

    void open().then((initial) => {
      if (!live) return
      setState({ id, initial })
      // Keep the URL pointing at the system being edited, so a reload or a
      // shared link comes back to the same board rather than starting over.
      //
      // `t` is dropped at the same time, and that is the important half: left
      // in place, a reload would hand the coach a SECOND copy of the template
      // and abandon the one they had started editing.
      if (!requested || template) {
        const url = new URL(window.location.href)
        url.searchParams.set('s', id)
        url.searchParams.delete('t')
        window.history.replaceState(null, '', url)
      }
    })

    return () => {
      live = false
    }
  }, [status])

  if (!state) {
    return (
      <div className="flex h-[calc(100vh-4rem)] min-h-[620px] items-center justify-center bg-paper-deep">
        <p className="text-micro uppercase text-ink-faint">
          {status === 'out' ? 'Taking you to sign in…' : 'Opening the board…'}
        </p>
      </div>
    )
  }

  return <StudioEditor systemId={state.id} initial={state.initial} />
}
