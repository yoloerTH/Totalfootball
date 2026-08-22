/**
 * The one thing a shared link asks of the person who opened it.
 *
 * WHY THIS EXISTS AT ALL. Until now the only route from a shared system back to
 * the studio was the words "Made with Total Football" at the foot of the page —
 * a credit, correctly set as a credit, which is to say quiet enough that nobody
 * reads it as an invitation. That is the right treatment for a watermark and
 * the wrong one for the single highest-intent moment this product has: somebody
 * who is not a coach of ours has just watched a whole tactical system play
 * through, understood it, and is holding the tool that made it. If they are
 * ever going to build one, it is in the ten seconds after the last phase.
 *
 * SO IT IS SHOWN AFTER THE LAST PHASE AND NOT BEFORE. Not a banner across the
 * top, not a modal over the board, not a thing that fades in on a timer while
 * they are still reading phase two. The board is somebody else's work and the
 * whole trust of a share link is that we do not put ourselves in front of it.
 * When the system has finished saying what it had to say, the page has room for
 * one clear sentence of our own, and it earns it by waiting.
 *
 * IT NEVER BLOCKS THE REPLAY. It sits under the controls, in the flow, so Play
 * and the phase dots stay exactly where they were. A coach presenting off a
 * link on a projector must be able to go back to phase one without dismissing
 * anything.
 *
 * THE COPY, AND THE ONE THING IT MUST NOT SAY. It says what they get and what
 * it costs, because both are the objection. Free is true and is the fact that
 * stops somebody bouncing.
 *
 * "Nothing to sign up for" is NOT true and used to be printed here. The studio
 * went behind an account on 2026-08-13 (see ../editor/StudioMount.tsx) and this
 * card was written before that; a stranger pressed a button promising no
 * sign-up and landed on a sign-in page, which is the worst possible first
 * thirty seconds of a product — not because the wall is wrong, but because we
 * told them it was not there. What is said instead is the true version of the
 * same reassurance: it is free, it is one press with Google, and the page they
 * land on says what the account keeps for them.
 */

import { STUDIO_EVENTS, track } from '../track'
import { Mark } from './Mark'

/** Where the press came from, so the two placements can be told apart. */
type Where = 'end' | 'credit'

const STUDIO_URL = '/studio/new/'

function go(where: Where) {
  track(STUDIO_EVENTS.viewerCta, where)
}

/**
 * The end card, under the controls on the last phase.
 *
 * Gold rule, a line of display type, one solid button. The same three moves the
 * rest of the site opens a section with, so it reads as part of the page rather
 * than as an advert dropped into it.
 */
export function BuildCta({ phases }: { phases: number }) {
  return (
    <div className="w-full max-w-2xl">
      <div className="rounded-xl border border-ink-hair bg-surface px-5 py-5 text-center shadow-paper sm:px-8">
        <div className="mx-auto h-[3px] w-10 rounded-full bg-gold" />

        <h2 className="mt-3.5 text-xl font-black leading-tight tracking-display text-ink sm:text-2xl">
          That is the system. Now build yours.
        </h2>
        <p className="mx-auto mt-2 max-w-prose text-[13px] leading-relaxed text-ink-soft">
          Drag your players into shape, draw the runs, add a second phase, and the studio turns it into a film
          and a link like this one. It is free, it runs in the browser you are already holding, and you are in
          with one press of Google.
        </p>

        <div className="mt-4 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <a
            href={STUDIO_URL}
            onClick={() => go('end')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-bold text-paper no-underline transition-opacity hover:opacity-85 sm:w-auto"
          >
            Build your own, free
            <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                d="M2.5 6 H9 M6 2.5 L9.5 6 L6 9.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <a
            href="/library/"
            className="inline-flex w-full items-center justify-center rounded-lg border border-ink-hair px-4 py-3 text-sm font-bold text-ink-soft no-underline transition-colors hover:bg-paper hover:text-ink sm:w-auto"
          >
            See more systems
          </a>
        </div>

        <p className="mt-3.5 text-[11px] leading-snug text-ink-faint">
          {phases === 1
            ? 'This one is a single phase. Most take about five minutes to put together.'
            : `This one is ${phases} phases. That is about five minutes of work.`}
        </p>
      </div>
    </div>
  )
}

/**
 * The credit bar's right-hand half, made into something you can tell is a link.
 *
 * It is still the watermark and it still sits opposite the coach's own name —
 * the policy in ./CreditBar.tsx has not moved. What has changed is that it now
 * looks pressable: a hairline box, a gold arrow, and a second line that says
 * what pressing it does. A credit that nobody knows is a door is a credit that
 * converts nobody, and the fix for that is not to make it louder than the
 * coach's name, it is to make it legible as a door.
 */
export function CreditCta({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href={STUDIO_URL}
      onClick={() => go('credit')}
      className="group flex shrink-0 items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 no-underline transition-colors hover:border-ink-hair hover:bg-paper"
    >
      <Mark size={compact ? 22 : 26} />
      <span className="text-left leading-tight">
        <span className="block text-[10px] font-bold uppercase leading-tight tracking-micro text-ink-faint">
          Made with Total Football
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[12px] font-black leading-tight tracking-display text-ink">
          Build your own
          <svg viewBox="0 0 12 12" className="h-3 w-3 text-gold-deep" aria-hidden="true">
            <path
              d="M2.5 6 H9 M6 2.5 L9.5 6 L6 9.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
    </a>
  )
}
