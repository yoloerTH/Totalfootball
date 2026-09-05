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
 * ── WHERE A DOCUMENT COMES FROM ──────────────────────────────────────────────
 *
 * The account. That is the whole list now — there is no local buffer to try
 * first and no order to get wrong (user, 2026-09-06). What is left is three
 * cases and one rule:
 *
 *  0. `?t=<template>`, which is not really "where a document came from" so much
 *     as "make me one": one of ours, copied, under a new id. It jumps the queue
 *     because it is the only case where the coach has asked for a NEW document
 *     rather than for the one they were working on — see the note by it below.
 *  1. `loadCloudSystem` says 'ok'. Open it.
 *  2. It says 'missing'. There is genuinely no such board, so make one.
 *  3. It says 'error'. WE DO NOT KNOW, and this file must not guess.
 *
 * THE RULE IS (3), and it is the whole reason `SystemRead` exists. A read that
 * failed used to be indistinguishable from a board that was not there, which
 * was survivable while localStorage held a copy to fall through to. It is not
 * survivable now: guessing "missing" on a dropped connection opens a BLANK
 * board under an id that has a real document behind it, and the autosave then
 * tries to write the blank over the coach's work. So an error is shown as an
 * error, with a retry, and nothing is mounted behind it.
 *
 * (supabase/016 would refuse that particular write anyway — a client that never
 * read the row sends a null version, and a null version against an existing row
 * is exactly the stale case the guard was written for. Being caught by the last
 * line of defence is not a reason to walk off the edge.)
 *
 * The wait for the session is why `status` has an 'unknown' state. Deciding
 * anything about a document before we know who is asking is the other way to
 * open the wrong board.
 *
 * ── WHY ../templates IS IMPORTED LAZILY ──────────────────────────────────────
 *
 * That module carries the seven template DOCUMENTS, not just their names, and
 * the two official ones are 35KB and 27KB of JSON on their own. Imported at the
 * top it becomes part of the editor's first load, so every coach opening a board
 * they have been working on all week pays to parse seven systems they did not
 * ask for. Case (0) is the only one that needs any of it, and it is the rarest
 * of the four, so it fetches the module when it turns out to be the case that
 * happened. The portal imports it eagerly — there, it IS the page.
 */

import { useEffect, useState } from 'react'
import StudioEditor, { newSystem } from './StudioEditor'
import { lastOpened, newSystemId, noteOpened } from '../storage'
import { creditOnly, loadCloudSystem, withProfile } from '../account/cloud'
import { hydrateProfile } from '../account/profile'
import { hydratePrefs } from '../account/prefs'
import { useSession } from '../account/session'
import type { System } from '../schema'

export default function StudioMount() {
  const { status, user } = useSession()
  const [state, setState] = useState<{
    id: string
    initial: System
    canEdit?: boolean
    /** Byte-for-byte what the database handed over. See `useCloudSync`. */
    stored: boolean
  } | null>(null)
  /**
   * The read failed, and we are saying so rather than inventing a board.
   *
   * A count rather than a flag, so pressing Retry re-runs the effect: the
   * dependency is the number, and the number goes up.
   */
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  /*
   * The studio needs an account.
   *
   * It did not, for two sessions, and ../storage.ts used to carry the argument
   * for that — a coach could land here and be dragging players around before
   * anyone asked who they were. The call was reversed (user, 2026-08-13): the
   * board is behind the door. That is now load-bearing rather than a product
   * decision, because the account is the only place a board can be written.
   */
  useEffect(() => {
    if (status !== 'out') return
    const next = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.replace(`/studio/login/?next=${next}`)
  }, [status])

  useEffect(() => {
    // Hold until we know whether there is an account to ask. See above.
    if (status !== 'in' || !user) return

    let live = true
    const params = new URLSearchParams(window.location.search)
    const requested = params.get('s')
    const wanted = params.get('t')

    /**
     * Which document, and under which id.
     *
     * `copied` is "this is a fresh copy of one of ours", which the URL rewrite
     * below needs and cannot infer: a copy has a `?s=` of its own to be given,
     * even when the coach arrived with one in the address bar.
     */
    const open = async (): Promise<
      | { ok: true; id: string; initial: System; copied: boolean; canEdit?: boolean; stored: boolean }
      | { ok: false }
    > => {
      /*
       * ── FIRST, AND ABOVE THE `?t=` BRANCH THAT RETURNS EARLY ───────────────
       *
       * Preferences down from the account BEFORE the editor exists.
       *
       * `StudioEditor` reads the guide in a `useState` initialiser, so anything
       * that arrives after it mounts arrives too late to be state, and shows up
       * as a walkthrough opening over a board a coach was already working on.
       * This is the one place that can wait for it: nothing is on screen yet
       * but "Opening the board…". See ../account/prefs.ts.
       *
       * It has to be the FIRST line of this function rather than a line near
       * the id, because the template branch below returns without ever
       * reaching that far — and a coach starting from a worked example is
       * exactly the coach most likely to be new here.
       */
      await hydratePrefs(user.id)

      /*
       * "Open one of ours."
       *
       * Always a NEW id, never `lastOpened()`: resuming the last system here
       * would be the worst outcome available — a coach presses "Start from this
       * one" and lands on the thing they were already editing, with no sign
       * anything went wrong.
       *
       * The copy is the coach's from this moment on. `fromTemplate` takes our
       * credit line and our share id off it, so pressing Share publishes THEIR
       * link rather than republishing ours.
       */
      if (wanted) {
        const { fromTemplate, templateById } = await import('../templates')
        const template = templateById(wanted)
        // An unknown `?t=` falls through to the ordinary path rather than
        // failing. The id has gone stale; the coach still wants a board.
        if (template) {
          const copy = fromTemplate(template)
          const { profile } = await hydrateProfile(user.id)
          /*
           * The coach's name, but NOT the coach's colours.
           *
           * `withProfile` repaints the kits, which is right for a blank
           * board — its own comment says it only fills what is empty — and
           * wrong here: these were coloured deliberately, and a worked example
           * that no longer looks like the film it came from teaches less.
           * `creditOnly` is how you ask that function for the credit half,
           * rather than writing a second copy of it here that can drift.
           *
           * It replaced `{ ...profile, teamColour: '' }`, which was correct
           * until the profile grew a second and third kit colour and then
           * silently was not. See ../account/cloud.ts.
           */
          const initial = profile ? withProfile(copy, creditOnly(profile)) : copy
          // `stored: false` — this document exists nowhere yet, so the autosave
          // must write it on open rather than wait for a first edit.
          return { ok: true, id: newSystemId(), initial, copied: true, canEdit: true, stored: false }
        }
      }

      const id = requested ?? lastOpened() ?? newSystemId()

      /*
       * ── THE ACCOUNT, AND NOTHING BEHIND IT ────────────────────────────────
       *
       * There used to be a localStorage buffer read after this one, and before
       * that a localStorage buffer read BEFORE it — which lost work: a laptop
       * holding a week-old copy opened the week-old copy, and the autosave
       * uploaded it over the desktop's two seconds later, silently.
       *
       * Both are gone. One store, one read, and the three answers it can give
       * are handled as three answers. See the header.
       */
      const remote = await loadCloudSystem(id, user.id)

      if (remote.status === 'error') return { ok: false }

      if (remote.status === 'ok') {
        return {
          ok: true,
          id,
          initial: remote.system,
          copied: false,
          canEdit: remote.canEdit,
          stored: true,
        }
      }

      // 'missing'. A brand new board for a coach we already know something
      // about opens in their colours and already signed. See `withProfile`.
      const { profile } = await hydrateProfile(user.id)
      const blank = newSystem()
      return {
        ok: true,
        id,
        initial: profile ? withProfile(blank, profile) : blank,
        copied: false,
        canEdit: true,
        stored: false,
      }
    }

    void open().then((result) => {
      if (!live) return
      if (!result.ok) {
        setFailed(true)
        return
      }
      const { id, initial, copied, canEdit, stored } = result
      setFailed(false)
      setState({ id, initial, canEdit, stored })
      /*
       * "Which board was I on", up to the account, once.
       *
       * It used to be a side effect of the local autosave, which meant it fired
       * every 400ms during a drag to re-state a fact that changes once a
       * session. Here it is one write, at the one moment the answer changes.
       *
       * Not for a locked board — one of ours, opened by somebody who is only
       * looking. Recording it would mean the coach who signs up an hour later,
       * sold on the studio by this exact page, opens onto a locked copy of our
       * system instead of a board of their own.
       */
      if (canEdit !== false) noteOpened(id)
      // Keep the URL pointing at the system being edited, so a reload or a
      // shared link comes back to the same board rather than starting over.
      //
      // `t` is dropped at the same time, and that is the important half: left
      // in place, a reload would hand the coach a SECOND copy of the template
      // and abandon the one they had started editing.
      if (!requested || copied) {
        const url = new URL(window.location.href)
        url.searchParams.set('s', id)
        url.searchParams.delete('t')
        window.history.replaceState(null, '', url)
      }
    })

    return () => {
      live = false
    }
  }, [status, user, attempt])

  /*
   * ── THE READ FAILED, AND THIS SAYS SO ────────────────────────────────────
   *
   * The one screen that did not need to exist while a local copy did. It is not
   * an apology and it is not a spinner: the coach's work is on the account,
   * intact, and the only thing wrong is that this browser could not reach it.
   * Saying that, and offering the one action that can change it, is the whole
   * job. Inventing a blank board here is how the work gets overwritten.
   */
  if (failed) {
    return (
      <div className="flex h-[calc(100vh-4rem)] min-h-[620px] flex-col items-center justify-center gap-4 bg-paper-deep px-6 text-center">
        <p className="text-sm text-ink">Could not reach your account.</p>
        <p className="max-w-sm text-xs leading-relaxed text-ink-faint">
          Your boards are safe — this browser just could not load them. Check your
          connection and try again.
        </p>
        <button
          type="button"
          className="rounded border border-ink-hair px-3 py-1.5 text-micro uppercase tracking-wide text-ink hover:bg-paper"
          onClick={() => {
            setFailed(false)
            setAttempt((n) => n + 1)
          }}
        >
          Try again
        </button>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="flex h-[calc(100vh-4rem)] min-h-[620px] items-center justify-center bg-paper-deep">
        <p className="text-micro uppercase text-ink-faint">
          {status === 'out' ? 'Taking you to sign in…' : 'Opening the board…'}
        </p>
      </div>
    )
  }

  return (
    <StudioEditor
      systemId={state.id}
      initial={state.initial}
      locked={state.canEdit === false}
      stored={state.stored}
    />
  )
}
