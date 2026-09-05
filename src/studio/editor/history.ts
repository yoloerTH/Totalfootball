/**
 * Undo.
 *
 * The guidance layer spends its whole vocabulary telling a coach to try things:
 * drag someone and see, add a phase and move them, draw it and press Play.
 * Asking that of somebody without giving them a way back is not a fair ask, and
 * it was the biggest usability gap left in the studio.
 *
 * WHY A SNAPSHOT STACK AND NOT A COMMAND LOG. A System is one small JSON
 * document that is already serialised for the account on every change (see
 * ../storage.ts). Keeping sixty copies of it costs less than a single board
 * thumbnail, and a snapshot cannot get out of step with the document the way an
 * inverse-command log does the first time someone adds an operation and forgets
 * to write its undo. The whole editor already funnels every mutation through
 * one seam, which is what makes this a hook rather than a rewrite.
 *
 * WHAT COUNTS AS ONE UNDO. Not one state change — a coach dragging a counter
 * across the pitch produces one per animation frame, and typing a title
 * produces one per keystroke. Edits are labelled, and consecutive edits with
 * the SAME label inside a short window collapse into the entry they started.
 * So a whole drag is one undo, a typed title is one undo, and a pause of a
 * second between two words starts a second one, which is roughly where a person
 * would expect the boundary to be anyway.
 *
 * WHAT IS NOT UNDOABLE. Anything that is not the document: which phase you are
 * looking at, which tool is armed, what is selected. Undo restores the phase
 * that was current when the change was made (see `meta`), because undoing a
 * change to a phase you cannot see is indistinguishable from nothing happening.
 */

import { useCallback, useRef, useState } from 'react'

/** How long two edits with the same label keep collapsing into one entry. */
const COALESCE_MS = 700

/** Deep enough for a session; a System is a few KB. */
const LIMIT = 60

interface Entry<T, M> {
  value: T
  meta: M
}

export interface History<T, M> {
  value: T
  /** Change the document AND push an undo entry, subject to coalescing. */
  edit: (label: string, fn: (current: T) => T) => void
  /**
   * Change the document WITHOUT touching the stack. For writes that are not the
   * coach's edit — a migration on open, a sync landing from elsewhere.
   */
  replace: (fn: (current: T) => T) => void
  /** Close the current coalescing window, so the next edit starts a new entry. */
  seal: () => void
  /** Both return the meta captured with the restored state, or null. */
  undo: () => M | null
  redo: () => M | null
  canUndo: boolean
  canRedo: boolean
}

/**
 * @param initial   the document as opened
 * @param getMeta   reads the editor state to restore alongside an undo — in
 *                  practice which phase was on screen. Called at capture time.
 */
export function useHistory<T, M>(initial: T, getMeta: () => M): History<T, M> {
  const [value, setValue] = useState<T>(initial)
  // Depth is state so the buttons can disable; the stacks themselves are refs,
  // because they are read and written inside event handlers that must not be
  // rebuilt on every push.
  const [depth, setDepth] = useState({ past: 0, future: 0 })

  const past = useRef<Entry<T, M>[]>([])
  const future = useRef<Entry<T, M>[]>([])
  const current = useRef(initial)
  const coalescing = useRef<{ label: string; at: number } | null>(null)

  // Synced on render rather than inside the state updater: an updater has to
  // stay pure, and React runs it twice in development to prove that it is.
  current.current = value
  const metaRef = useRef(getMeta)
  metaRef.current = getMeta

  const sync = useCallback(() => {
    setDepth({ past: past.current.length, future: future.current.length })
  }, [])

  const edit = useCallback(
    (label: string, fn: (current: T) => T) => {
      const now = Date.now()
      const open = coalescing.current
      if (open && open.label === label && now - open.at < COALESCE_MS) {
        // Inside an open window: extend it rather than opening another. The
        // refresh is what makes a four-second drag one entry instead of six.
        open.at = now
      } else {
        coalescing.current = { label, at: now }
        past.current = [...past.current, { value: current.current, meta: metaRef.current() }].slice(-LIMIT)
        future.current = []
        sync()
      }
      setValue((prev) => fn(prev))
    },
    [sync],
  )

  const replace = useCallback((fn: (current: T) => T) => setValue((prev) => fn(prev)), [])

  const seal = useCallback(() => {
    coalescing.current = null
  }, [])

  const undo = useCallback(() => {
    const entry = past.current[past.current.length - 1]
    if (!entry) return null
    past.current = past.current.slice(0, -1)
    future.current = [...future.current, { value: current.current, meta: metaRef.current() }]
    coalescing.current = null
    current.current = entry.value
    setValue(entry.value)
    sync()
    return entry.meta
  }, [sync])

  const redo = useCallback(() => {
    const entry = future.current[future.current.length - 1]
    if (!entry) return null
    future.current = future.current.slice(0, -1)
    past.current = [...past.current, { value: current.current, meta: metaRef.current() }]
    coalescing.current = null
    current.current = entry.value
    setValue(entry.value)
    sync()
    return entry.meta
  }, [sync])

  return {
    value,
    edit,
    replace,
    seal,
    undo,
    redo,
    canUndo: depth.past > 0,
    canRedo: depth.future > 0,
  }
}
