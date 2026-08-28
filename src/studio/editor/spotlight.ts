/**
 * Taking a coach to a control and pointing at it.
 *
 * ── WHY THIS IS NOT THREE LINES OF `querySelector` ───────────────────────────
 *
 * Because the control usually is not there yet. The left rail is six drawers
 * and a shut drawer UNMOUNTS its contents (`Section` in ./ui.tsx) — deliberately,
 * so a hidden slider never sits in the tab order. That is right for the rail and
 * fatal for a naive "find it and ring it": half the targets in ./guide.ts do not
 * exist in the document at the moment somebody asks for them.
 *
 * So showing a target is a sequence, not a lookup: open the drawer that owns it,
 * wait for React to mount what was inside, scroll it to the middle, and only
 * then put the ring on. `show` below is that sequence.
 *
 * ── WHY AN EVENT FOR THE DRAWER AND A STORE FOR THE RING ─────────────────────
 *
 * The drawer is a fire-and-forget instruction to one component that already
 * knows its own name, and it is dispatched from a panel that has no reference to
 * it and never should — threading an `openDrawer` prop from the help panel down
 * through StudioEditor into the rail would put a prop on `Section` that exists
 * for one caller. An event costs nothing and keeps `Section` self-contained.
 *
 * The RING is different: it has to be readable by whatever draws it, survive
 * re-renders, and be cancellable from three places (Escape, a click elsewhere,
 * the next target). That is state, and it lives here rather than in a component
 * so that anything in the studio can point at anything without being wired to it.
 *
 * ── AND WHY IT GIVES UP ──────────────────────────────────────────────────────
 *
 * `WAIT_MS` is a real ceiling, not a safety net. A target can be legitimately
 * absent: the Selected player panel is not there when nobody is selected, and a
 * topic can outlive the control it was written for. Polling forever would leave
 * a coach looking at a help panel that closed and a ring that never arrived, so
 * a miss resolves false and the caller says so out loud (./HelpPanel.tsx).
 */

import type { HelpTarget } from './guide'

/** Fired at the rail. `detail` is the drawer's heading, exactly as rendered. */
export const OPEN_DRAWER = 'tf:open-drawer'

/** How long to wait for a drawer's contents to mount before giving up. */
const WAIT_MS = 800

export interface Spot {
  target: HelpTarget
  el: HTMLElement
  /** Bumped on every show, so pointing at the same control twice re-announces. */
  nonce: number
}

let current: Spot | null = null
let nonce = 0
const listeners = new Set<() => void>()

export function subscribeSpot(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSpot(): Spot | null {
  return current
}

function publish() {
  for (const fn of listeners) fn()
}

export function clearSpot() {
  if (!current) return
  current = null
  publish()
}

export function openDrawer(title: string) {
  window.dispatchEvent(new CustomEvent(OPEN_DRAWER, { detail: title }))
}

function find(anchor: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-help="${anchor}"]`)
}

/**
 * Wait for an element to exist, checking once per frame.
 *
 * Per FRAME rather than on a timer, because what is being waited for is a React
 * commit: an interval either fires before the render and wastes the tick or
 * lands late and adds lag a coach can feel. A frame is exactly the granularity
 * of the thing we are waiting on.
 */
function waitFor(anchor: string): Promise<HTMLElement | null> {
  const found = find(anchor)
  if (found) return Promise.resolve(found)
  return new Promise((resolve) => {
    const deadline = performance.now() + WAIT_MS
    const tick = () => {
      const el = find(anchor)
      if (el) return resolve(el)
      if (performance.now() > deadline) return resolve(null)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

/**
 * Take the coach to a target and ring it. False if it could not be found.
 *
 * The scroll is `center` and not `nearest`: a control that is technically on
 * screen but two pixels above the fold has been "shown" by any reasonable test
 * and found by nobody. If we are going to interrupt somebody to point at a
 * thing, it goes in the middle where they are already looking.
 */
export async function show(target: HelpTarget): Promise<boolean> {
  if (target.drawer) openDrawer(target.drawer)
  const el = await waitFor(target.anchor)
  if (!el) {
    clearSpot()
    return false
  }
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  nonce += 1
  current = { target, el, nonce }
  publish()
  return true
}
