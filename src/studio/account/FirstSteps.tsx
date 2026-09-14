/**
 * The first steps, on the shelf.
 *
 * ── WHY THE SHELF NEEDS THEM TOO ────────────────────────────────────────────
 *
 * Signing in lands a coach here, and until now nothing on this page taught them
 * anything: the walkthrough and the rail both live inside the editor. The iOS
 * app put its checklist on the Systems screen for the reason that holds here
 * as well: this is the page they land on every time, and the steps are a thing
 * to be reminded of BETWEEN sessions with the board. During one, the rail and
 * the hints do it.
 *
 * ── IT IS THE RAIL'S LIST, NOT A SECOND ONE ─────────────────────────────────
 *
 * Same steps, same latches, same open/shut state (`railOpen`). A coach who
 * folded the rail away in the editor has said they know their way round, and
 * finds it folded here. Only the step they are on carries its detail, for the
 * reason ../editor/GuideRail.tsx gives.
 *
 * ── AND IT TAKES ITSELF AWAY ────────────────────────────────────────────────
 *
 * On the last tick it is gone, with no celebration. A coach who has built a
 * system, played it and sent it needs the room back, not a badge.
 */

import { useMemo, useState } from 'react'
import { stepDone } from '../editor/GuideRail'
import { RAIL_STEPS } from '../editor/guide'
import { readGuide, writeGuide } from '../storage'
import { STUDIO_EVENTS, track } from '../track'
import type { CloudSystem } from './cloud'

/**
 * The board offered to take apart. Five phases, the full pitch, and the
 * shortest complete tactical idea we have: crowd one side, then switch it. The
 * same pick the iOS tour makes.
 */
const EXAMPLE = 'overload-isolate'

function Tick() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <circle cx="8" cy="8" r="7.5" className="fill-green" />
      <path
        d="M4.6 8.2 L7 10.6 L11.5 5.6"
        fill="none"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function FirstSteps({ systems }: { systems: CloudSystem[] }) {
  const [guide] = useState(readGuide)
  const [open, setOpen] = useState(guide.railOpen)

  const done = RAIL_STEPS.map((s) => stepDone(guide, s.id))
  const count = done.filter(Boolean).length
  const current = RAIL_STEPS.find((_, i) => !done[i])

  // The one they touched last, to carry on with.
  const recent = useMemo(
    () =>
      systems.reduce<CloudSystem | null>(
        (best, r) => (!best || Date.parse(r.updated) > Date.parse(best.updated) ? r : best),
        null,
      ),
    [systems],
  )

  if (!current) return null

  const toggle = () => {
    setOpen(!open)
    writeGuide({ railOpen: !open })
  }

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-ink-hair bg-surface shadow-paper">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span className="flex-1">
          <span className="block text-micro uppercase text-ink-faint">First steps</span>
          <span className="mt-1 block text-[15px] font-bold text-ink">
            {open ? 'Your first system, one step at a time' : `Next: ${current.label}`}
          </span>
        </span>
        <span className="text-[12px] font-black tabular-nums text-ink-soft">
          {count}/{RAIL_STEPS.length}
        </span>
        <svg
          viewBox="0 0 12 12"
          className={`h-3 w-3 text-ink-faint transition-transform ${open ? '' : '-rotate-90'}`}
          aria-hidden="true"
        >
          <path d="M2 4 L6 8 L10 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="grid gap-6 border-t border-ink-hair px-5 py-5 md:grid-cols-[minmax(0,1fr)_18rem]">
          <ol className="m-0 list-none space-y-2.5 p-0">
            {RAIL_STEPS.map((s, i) => {
              const isCurrent = s.id === current.id
              return (
                <li key={s.id} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                    {done[i] ? (
                      <Tick />
                    ) : (
                      <span
                        className={`h-3 w-3 rounded-full border ${
                          isCurrent ? 'border-gold bg-gold/25' : 'border-ink-hair'
                        }`}
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[14px] font-bold leading-snug ${
                        done[i] ? 'text-ink-faint line-through' : isCurrent ? 'text-ink' : 'text-ink-soft'
                      }`}
                    >
                      {s.label}
                    </span>
                    {isCurrent && (
                      <span className="mt-1 block max-w-prose text-[13px] leading-relaxed text-ink-soft">
                        {s.detail}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ol>

          <div className="flex flex-col gap-2.5">
            {recent && (
              <a
                href={`/studio/new/?s=${encodeURIComponent(recent.id)}`}
                title={recent.system.title.trim() || undefined}
                className="truncate rounded-full bg-ink px-5 py-2.5 text-center text-sm font-bold text-paper no-underline transition hover:-translate-y-px hover:shadow-lift"
              >
                {recent.system.title.trim() ? `Open ${recent.system.title.trim()}` : 'Open your last board'}
              </a>
            )}
            <a
              href={`/studio/new/?t=${EXAMPLE}`}
              onClick={() => track(STUDIO_EVENTS.templateOpened, EXAMPLE)}
              className="rounded-full border border-ink-hair px-5 py-2.5 text-center text-sm font-bold text-ink no-underline transition-colors hover:border-ink/25 hover:bg-paper/60"
            >
              Take a finished one apart
            </a>
            <p className="m-0 text-[12px] leading-relaxed text-ink-faint">
              The same list is in the right-hand panel of every board, and it ticks itself off as you go.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
