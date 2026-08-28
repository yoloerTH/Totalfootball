/**
 * The portal's offer to help finish a coach's profile.
 *
 * ── WHY A DOCKED PANEL AND NOT A MODAL ──────────────────────────────────────
 *
 * Because the panel is pointing at something that is already on the page. The
 * whole job here is "the settings are over there and they are worth ten
 * minutes", and a modal would cover the shelf, cover the header, and cover the
 * Personal settings link it is talking about — you cannot point at a thing from
 * on top of it. Docked in the corner, the panel and the highlighted link are
 * visible at the same time, and the coach can read one while looking at the
 * other.
 *
 * It also means the page stays usable. A coach who came here to open Tuesday's
 * session can ignore this entirely and never have to dismiss anything, which is
 * the behaviour that earns a prompt the right to appear again in six days.
 *
 * ── WHAT IT SAYS ────────────────────────────────────────────────────────────
 *
 * The three things still missing, each with the line from ./completion.ts
 * saying what finishing it CHANGES — not a percentage with a progress ring and
 * a "you're nearly there!". A coach does not owe us a complete profile; they
 * might want their name on their own work, and this is the difference between
 * telling them that and nagging them.
 *
 * Three at a time, out of seven. A list of everything unfinished reads as a
 * chore; three reads as a suggestion, and the CTA goes to the page where the
 * rest of them are anyway.
 *
 * ── AND WHY IT CANNOT BE MISSED ─────────────────────────────────────────────
 *
 * `onHighlight` is the other half of it. While this is up, the portal rings the
 * Personal settings link in the header — see Portal.tsx. The panel says what is
 * missing; the highlight says where you go. Neither works as well alone: a
 * prompt with a button teaches nothing about the page, and a ringed link with
 * no explanation is a decoration.
 *
 * ── AND WHY THE MARK IS ON IT ───────────────────────────────────────────────
 *
 * Because a card that slides into the corner of a page is, at a glance,
 * indistinguishable from the thing everybody has been trained to close without
 * reading. A coach gives it about a third of a second to prove it is not a
 * cookie banner or a chat widget, and the fastest way to prove that is the mark
 * they have already seen on the end of every short and at the foot of every
 * board they have shared. It is the same `Mark` the credit bar draws
 * (../viewer/Mark.tsx), not a lookalike — one geometry, or it is not a
 * signature.
 */

import { useEffect, useState } from 'react'
import type { Completion, ProfileStep } from './completion'
import { Mark } from '../viewer/Mark'
import { STUDIO_EVENTS, track } from '../track'

/** How many of the unfinished steps to actually list. See the header. */
const SHOWN = 3

const SETTINGS = '/studio/settings/'

/** Where a step's CTA lands. The anchors are on the sections in ./Settings.tsx. */
function hrefFor(step: ProfileStep | undefined): string {
  return step ? `${SETTINGS}#${step.anchor}` : SETTINGS
}

export function ProfileNudge({
  completion,
  onClose,
  onNever,
}: {
  completion: Completion
  /** Not now. The cadence in ./completion.ts decides when it comes back. */
  onClose: () => void
  /** Never again. A latch, and the only thing here that is one. */
  onNever: () => void
}) {
  /*
   * Slid in a beat after mount rather than on it.
   *
   * The portal is still settling when this decides to appear — the shelf is
   * being fetched, the cards are laying out — and a panel that arrives in the
   * middle of that reads as part of the page loading rather than as something
   * addressed to the reader. A short delay makes it an arrival.
   */
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 60)
    return () => clearTimeout(t)
  }, [])

  // Escape closes it, like every other dismissible thing in the studio. It is
  // NOT a `never` — the quickest way out has to be the least final one.
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  const next = completion.missing.slice(0, SHOWN)
  const rest = completion.missing.length - next.length

  return (
    <div
      role="complementary"
      aria-label="Finish your profile"
      /*
       * Bottom-LEFT, and it has to be.
       *
       * Bottom-right is the Naurra badge's corner — it is docked there on every
       * page by ../../layouts/BaseLayout.astro — and this card was landing on
       * top of it (user, 2026-08-27). Left is the free corner on this page:
       * ../../components/JoinPopup.astro owns it site-wide, and mutes itself
       * everywhere under `/studio/` that is not the studio's own front page, so
       * it never opens here. Two things in one corner is a stack; this way each
       * corner has one.
       */
      className={`fixed bottom-4 left-4 z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-ink-hair bg-surface p-5 shadow-lift transition-all duration-300 ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {/* Sized to sit on the cap-height of the line beside it, not centred
              on the block: the mark reads as a letterhead that way, and as a
              stray icon the other. */}
          <span className="mt-0.5 shrink-0">
            <Mark size={30} />
          </span>
          <div className="min-w-0">
            <p className="text-micro uppercase text-ink-faint">Total Football</p>
            <h2 className="mt-0.5 text-base font-black tracking-display text-ink">
              {completion.done === 0
                ? 'Put your name on your work'
                : `${completion.total - completion.done} things left`}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Not now"
          className="-mr-1.5 -mt-1.5 shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-ink-faint transition-colors hover:bg-ink-hair hover:text-ink"
        >
          ✕
        </button>
      </div>

      {/* The meter. A bar and a count, not a ring and a percentage: this is a
          list with some of it done, and a bar is what a list looks like. */}
      <div className="mt-3 flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-hair">
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-500"
            style={{ width: `${Math.round(completion.fraction * 100)}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-bold tabular-nums text-ink-faint">
          {completion.done}/{completion.total}
        </span>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">
        Everything here shows up somewhere: on the boards you share, on the films you export, on the page
        people reach when they look you up.
      </p>

      <ul className="mt-3 list-none space-y-2 p-0">
        {next.map((step) => (
          <li key={step.id}>
            <a
              href={hrefFor(step)}
              onClick={() => track(STUDIO_EVENTS.profileNudge, `open:${step.id}`)}
              className="group flex gap-2.5 rounded-lg px-2 py-1.5 -mx-2 no-underline transition-colors hover:bg-paper"
            >
              {/* An empty box, not a cross. Nothing here has gone wrong. */}
              <span
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-[4px] border-2 border-ink-hair transition-colors group-hover:border-ink-faint"
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-[12px] font-bold text-ink">{step.label}</span>
                <span className="block text-[11px] leading-snug text-ink-faint">{step.why}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      {rest > 0 && (
        <p className="mt-2 text-[11px] text-ink-faint">
          And {rest} more on the settings page.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={hrefFor(next[0])}
          onClick={() => track(STUDIO_EVENTS.profileNudge, 'open:cta')}
          className="rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-paper no-underline transition hover:-translate-y-px hover:shadow-lift"
        >
          Finish it now
        </a>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-ink-hair hover:text-ink"
        >
          Not now
        </button>
        {/* Last, quietest, and off to the side. It is the right thing to offer
            and the wrong thing to offer first — most people who press "not now"
            do come back and do it. */}
        <button
          type="button"
          onClick={onNever}
          className="ml-auto text-[11px] font-semibold text-ink-faint underline underline-offset-2 transition-colors hover:text-ink"
        >
          Don't ask again
        </button>
      </div>
    </div>
  )
}
