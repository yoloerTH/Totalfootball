/**
 * The step-by-step rail.
 *
 * The walkthrough teaches the idea once and disappears. This is what teaches
 * the sequence, and it stays until it is not needed — five things to do, in the
 * order they make sense, with only the CURRENT one expanded.
 *
 * Why only the current one: a coach who opens the studio and finds five
 * paragraphs of instructions reads none of them. One instruction at a time,
 * with the finished ones ticked above it, is the same amount of information
 * arriving at a rate someone can act on. It is also honest about progress,
 * which is the part that keeps people going.
 *
 * The steps are latched, never re-derived (see `GuideState` in ../storage.ts):
 * deleting your only arrow does not un-teach you what arrows are.
 */

import { RAIL_STEPS, type RailStep } from './guide'

interface Props {
  done: Record<RailStep['id'], boolean>
  open: boolean
  onToggle: (open: boolean) => void
  /** Reopens the welcome walkthrough. */
  onReplay: () => void
}

function Tick() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
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

export function GuideRail({ done, open, onToggle, onReplay }: Props) {
  const count = RAIL_STEPS.filter((s) => done[s.id]).length
  const total = RAIL_STEPS.length
  const complete = count === total
  // The step they are on: the first one not yet done.
  const current = RAIL_STEPS.find((s) => !done[s.id])

  return (
    <section className="border-b border-ink-hair bg-paper/40">
      <button
        type="button"
        onClick={() => onToggle(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex-1 text-micro uppercase text-ink-faint">
          {complete ? 'You have the basics' : 'First steps'}
        </span>
        <span className="text-[11px] font-black tabular-nums text-ink-soft">
          {count}/{total}
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
        <div className="px-4 pb-4">
          {complete ? (
            <p className="text-[11px] leading-relaxed text-ink-faint">
              That is everything you need to build a system. The rest of the controls all have a
              hint. Hover over one to see what it does.{' '}
              <button type="button" onClick={onReplay} className="font-bold text-ink underline underline-offset-2">
                Read the guide again
              </button>
            </p>
          ) : (
            <ol className="space-y-2">
              {RAIL_STEPS.map((s) => {
                const isDone = done[s.id]
                const isCurrent = s.id === current?.id
                return (
                  <li key={s.id} className="flex gap-2">
                    <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                      {isDone ? (
                        <Tick />
                      ) : (
                        <span
                          className={`h-2.5 w-2.5 rounded-full border ${
                            isCurrent ? 'border-gold bg-gold/25' : 'border-ink-hair'
                          }`}
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[11px] font-bold leading-snug ${
                          isDone ? 'text-ink-faint line-through' : isCurrent ? 'text-ink' : 'text-ink-soft'
                        }`}
                      >
                        {s.label}
                      </span>
                      {isCurrent && (
                        <span className="mt-1 block text-[11px] leading-relaxed text-ink-faint">{s.detail}</span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
