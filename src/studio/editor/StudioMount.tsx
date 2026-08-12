/**
 * Resolves which system the editor should open, then mounts it.
 *
 * Split out from StudioEditor so the editor itself can stay a pure function of
 * `(systemId, initial)`. That keeps it testable, and it means the same editor
 * will serve a locally-scratched system today and a Supabase-backed one once
 * auth lands, with only this file deciding where the document came from.
 *
 * Reads `?s=<id>` to reopen a specific system, otherwise resumes the last one
 * touched, otherwise starts a new one.
 */

import { useEffect, useState } from 'react'
import StudioEditor, { newSystem } from './StudioEditor'
import { lastOpened, loadSystem, newSystemId } from '../storage'
import type { System } from '../schema'

export default function StudioMount() {
  const [state, setState] = useState<{ id: string; initial: System } | null>(null)

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('s')
    const id = requested ?? lastOpened() ?? newSystemId()
    const existing = loadSystem(id)
    setState({ id, initial: existing ?? newSystem() })
    // Keep the URL pointing at the system being edited, so a reload or a shared
    // link comes back to the same board rather than starting over.
    if (!requested) {
      const url = new URL(window.location.href)
      url.searchParams.set('s', id)
      window.history.replaceState(null, '', url)
    }
  }, [])

  if (!state) {
    return (
      <div className="flex h-[calc(100vh-4rem)] min-h-[620px] items-center justify-center bg-paper-deep">
        <p className="text-micro uppercase text-ink-faint">Opening the board…</p>
      </div>
    )
  }

  return <StudioEditor systemId={state.id} initial={state.initial} />
}
