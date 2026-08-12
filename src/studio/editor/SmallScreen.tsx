/**
 * The small-screen door.
 *
 * A door, not a wall. The studio is a drag-and-drop board with a panel of
 * controls down each side and it is honestly better on a laptop, so it says so
 * once, on arrival, and offers to hand the coach the link for later. Then it
 * gets out of the way: "Carry on here anyway" is a real button that leads to a
 * real editor, because a coach on a touchline who wants to look at the thing
 * they built has a perfectly good reason to be on a phone.
 *
 * Shown once and latched (`smallOk` in ../storage.ts). Nagging somebody on
 * every visit about a screen they cannot change is just a worse version of
 * blocking them.
 *
 * The check runs ONCE, on mount, against the width at that moment — deliberately
 * not a live media query. A desktop coach dragging their window narrower for a
 * second should not have a full-screen interstitial thrown over their work.
 */

import { useEffect, useState } from 'react'
import { SMALL } from './guide'
import { Button } from './ui'

/** Below this, the two side panels and a usable board do not fit together. */
export const SMALL_WIDTH = 900

export function isSmallScreen(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < SMALL_WIDTH
}

export function SmallScreen({ onContinue }: { onContinue: () => void }) {
  const [copied, setCopied] = useState(false)

  // Reset the confirmation so a second press reads as a second copy.
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2400)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      // Clipboard access is refused on insecure origins and in some in-app
      // browsers. Selecting the address bar is still there, and a coach who
      // cannot copy the link should not be left with a dead-looking button.
      setCopied(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-paper-deep p-5">
      <div className="w-full max-w-sm">
        <Laptop />
        <h1 className="mt-6 text-2xl font-black leading-tight tracking-display text-ink">{SMALL.title}</h1>
        {SMALL.body.map((p) => (
          <p key={p} className="mt-3 text-sm leading-relaxed text-ink-soft">
            {p}
          </p>
        ))}

        <div className="mt-7 flex flex-col gap-2">
          <button
            type="button"
            onClick={copy}
            className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-bold text-paper transition-opacity active:opacity-80"
          >
            {copied ? SMALL.copied : SMALL.copyCta}
          </button>
          <Button onClick={onContinue} className="!py-3 !text-sm">
            {SMALL.stayCta}
          </Button>
        </div>

        <p className="mt-6 border-t border-ink-hair pt-4 text-[11px] leading-relaxed text-ink-faint">
          {SMALL.phoneTip}
        </p>
      </div>
    </div>
  )
}

/**
 * A laptop showing a board, drawn rather than illustrated — same paper stage,
 * same green counters, so the promise on the other side of the button is the
 * thing being pictured.
 */
function Laptop() {
  return (
    <svg viewBox="0 0 120 78" className="h-auto w-32" role="img" aria-label="A laptop showing the board">
      <rect x="12" y="6" width="96" height="60" rx="4" className="fill-ink/5 stroke-ink/20" strokeWidth="1.4" />
      <rect x="18" y="12" width="84" height="48" rx="2" fill="#ECEEE9" />
      <g stroke="rgba(28,34,30,0.28)" strokeWidth="0.7" fill="none">
        <rect x="22" y="16" width="76" height="40" />
        <line x1="60" y1="16" x2="60" y2="56" />
        <circle cx="60" cy="36" r="7" />
        <rect x="22" y="26" width="9" height="20" />
        <rect x="89" y="26" width="9" height="20" />
      </g>
      <circle cx="41" cy="30" r="3.1" className="fill-green" />
      <circle cx="52" cy="42" r="3.1" className="fill-green" />
      <circle cx="74" cy="27" r="3.1" fill="#E2473B" />
      <path d="M45 31 L69 28" stroke="#161618" strokeWidth="1" strokeLinecap="round" />
      <path d="M8 70 h104 a3 3 0 0 1 -3 3 h-98 a3 3 0 0 1 -3 -3 Z" className="fill-ink/20" />
    </svg>
  )
}
