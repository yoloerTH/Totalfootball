/**
 * The ring the help panel leaves round a control, and the line beside it.
 *
 * Named for what it draws rather than for the module that drives it: the state
 * and the sequencing live in ./spotlight.ts, and one filesystem in this project
 * is case-insensitive, so `Spotlight.tsx` beside `spotlight.ts` is one file to
 * TypeScript and two to git.
 *
 * ── WHY A RING AND NOT A DIMMED OVERLAY ──────────────────────────────────────
 *
 * The usual product-tour move is to black out the page and cut a hole over the
 * control. It photographs well and it teaches nothing, because the one thing a
 * coach needs to learn here is WHERE this lives — which drawer, next to what,
 * how far down the rail — and every one of those facts is in the pixels an
 * overlay has just painted over. A ring leaves the rail intact, so the answer
 * to "where is the camera control" is seen in its place among the others and is
 * still findable next Tuesday without us.
 *
 * It is also the reason the ring does not trap anything. Pointer events go
 * straight through it: a coach who has been shown the control can use the
 * control, in the same motion, without dismissing anything first. A tour step
 * with a Next button would make them ask permission to touch their own tool.
 *
 * ── WHY IT FOLLOWS ───────────────────────────────────────────────────────────
 *
 * Measured every frame while it is up, rather than once on arrival. The rail
 * scrolls, drawers above the target open and shut, the window resizes, and the
 * board's own layout moves things sideways when a panel appears. A ring
 * measured once is a rectangle of empty air a second later, pointing confidently
 * at nothing, which is worse than no ring at all. rAF is cheap for the few
 * seconds this is alive and it is only alive on purpose.
 *
 * ── AND WHY IT LEAVES ON ITS OWN ─────────────────────────────────────────────
 *
 * A highlight nobody dismissed is a highlight that becomes furniture. This one
 * goes on Escape, on the next press anywhere, and on a timer if neither happens
 * — a coach who was called away comes back to their studio rather than to a
 * pulsing box they now have to deal with.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { clearSpot, getSpot, subscribeSpot } from './spotlight'

/** How long the ring stands if nothing dismisses it. */
const LINGER_MS = 7000

/** Breathing room between the control's edge and the ring. */
const PAD = 5

interface Box {
  top: number
  left: number
  width: number
  height: number
}

function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect()
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  }
}

export function HelpRing() {
  const spot = useSyncExternalStore(subscribeSpot, getSpot, () => null)
  const [box, setBox] = useState<Box | null>(null)

  const el = spot?.el ?? null
  const nonce = spot?.nonce ?? 0

  // Re-measured every frame while it is up. See the header.
  useEffect(() => {
    if (!el) {
      setBox(null)
      return
    }
    let raf = 0
    const tick = () => {
      setBox(boxOf(el))
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [el])

  /*
   * Dismissal. `nonce` is in the deps rather than `el` alone so that pointing
   * twice at the SAME control restarts the timer — otherwise the second ask
   * inherits whatever was left of the first ask's seven seconds and can blink
   * out almost immediately, which reads as the studio ignoring the press.
   *
   * The press listener is on the capture phase and deliberately does not
   * swallow the event: the press that dismisses the ring is usually the press
   * that uses the control, and both should happen.
   */
  useEffect(() => {
    if (!el) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && clearSpot()
    const press = () => clearSpot()
    const timer = window.setTimeout(clearSpot, LINGER_MS)
    window.addEventListener('keydown', key)
    // A frame's delay, or the click that opened this closes it again.
    const arm = window.setTimeout(
      () => window.addEventListener('pointerdown', press, true),
      0,
    )
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(arm)
      window.removeEventListener('keydown', key)
      window.removeEventListener('pointerdown', press, true)
    }
  }, [el, nonce])

  if (!spot || !box) return null

  /*
   * The label goes under the ring, unless the ring is low enough that under
   * would be off screen. Left-aligned with the ring rather than centred on it:
   * these targets are panels in a narrow rail as often as they are buttons, and
   * a centred label on a 260px panel floats in the middle of nothing.
   */
  const below = box.top + box.height + 8
  const labelTop = below + 30 > window.innerHeight ? box.top - 30 : below

  return createPortal(
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-[80] rounded-xl ring-2 ring-ink ring-offset-2 ring-offset-transparent motion-safe:animate-pulse"
        style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
      />
      {/*
        Live, and the only announcement this makes. A sighted coach has the ring;
        a coach on a screen reader has just pressed "Show me" and been given a
        scroll and nothing else, so the name of what was found is said out loud.
      */}
      <div
        role="status"
        className="pointer-events-none fixed z-[80] max-w-[15rem] rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-bold leading-snug text-paper shadow-lift"
        style={{ top: labelTop, left: Math.max(8, box.left) }}
      >
        Here it is: {spot.target.name}
      </div>
    </>,
    document.body,
  )
}
