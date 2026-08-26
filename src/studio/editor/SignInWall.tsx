/**
 * The door, for somebody standing inside the studio who does not have a key.
 *
 * WHAT THIS IS FOR. `/o/press-4141` mounts the REAL editor, not a slideshow —
 * every panel, every tool, all eighteen phases in the strip — and locks it. See
 * the `locked` note at the top of ./StudioEditor.tsx. A stranger can press Play
 * and step through the system; the moment they reach for anything that would
 * change it, one of the three pieces below is what answers them.
 *
 * THE PATTERN IS THE ONE EVERY SOCIAL FEED USES, and it is used here for the
 * same reason: the thing being withheld has to be VISIBLE before withholding it
 * means anything. A greyed control that does nothing is a dead end and reads as
 * a broken page. A greyed control that opens this is an invitation, and the
 * coach has already seen exactly what they are being invited into.
 *
 * ── WHERE THEY LAND, AND WHY IT IS NOT THIS PAGE ─────────────────────────────
 *
 * Every route out of here is `/studio/login/` with no `?next=`, which means
 * `SignIn`'s own default takes over and lands them on `/studio/portal/` — see
 * `fallback` in ../account/SignIn.tsx.
 *
 * That is deliberate, and it is worth being clear about why signing in does not
 * simply unlock the page they were on. `/o/…` is OURS. It is a published system
 * with our credit on it, and no account will ever be allowed to edit it in
 * place. What an account gets them is a COPY, and the portal is where both
 * official systems already sit for every signed-in coach (`OFFICIAL` in
 * ../account/Portal.tsx) alongside the shelf and the five starters. So the
 * portal is not a detour on the way to the thing they wanted — it is the room
 * that thing is kept in, plus everything else they just got.
 *
 * ── THE COPY, AND THE ONE THING IT MUST NOT SAY ──────────────────────────────
 *
 * It must not promise that signing in returns them to this board unlocked. It
 * does not, and a promise broken in the first thirty seconds of a product is
 * worse than no invitation at all — the same mistake ../viewer/BuildCta.tsx has
 * a long note about making once already.
 */

import { useEffect } from 'react'
import { Mark } from '../viewer/Mark'
import { Button } from './ui'

/** One place, so the three pieces can never drift into disagreeing. */
export const WALL = {
  eyebrow: 'This one is ours',
  title: 'Sign in to build your own',
  body:
    'You are looking at the real studio, holding one of our published systems. Watch it as long as you like. Building takes a free account.',
  cta: 'Sign in or create an account',
  foot: 'Free. One press with Google. Both of these systems are waiting on the other side.',
} as const

/** Never `?next=`: see the note at the top of this file. */
export const LOGIN_HREF = '/studio/login/'

/**
 * The sheet, raised by the first thing a stranger presses that they cannot have.
 *
 * A dialog rather than a banner, and it takes the same shape as the studio's
 * other three (../editor/ShareDialog.tsx and friends) so it does not read as a
 * different product bolted on: same scrim, same card, same escape key.
 *
 * IT IS ALWAYS DISMISSABLE. Whatever else this is, it is not a paywall thrown
 * over somebody mid-sentence — they came to watch a system and they must be
 * able to get back to watching it with one press, from the backdrop, from
 * Escape, or from the button that says so.
 */
export function SignInWall({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-ink/55 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={WALL.title}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* A sheet from the bottom on a phone, a card in the middle on a desktop.
          Same element, and the rounding is what carries the difference: a card
          floating in the centre is rounded all round, a sheet sitting on the
          bottom edge of the screen is rounded only at the top. */}
      <div className="w-full max-w-md rounded-t-2xl border border-ink-hair bg-surface p-6 shadow-lift sm:rounded-2xl">
        {/*
          The mark, and it earns its place here rather than being decoration.
          This sheet is the first moment on the page that says who is asking —
          the board above it is the SYSTEM's, and a stranger who followed a link
          from under a video may not have read a single word of ours yet. So the
          lockup goes at the top of the one card that asks them for something.

          `text-ink` on the row, not inherited: the mark's ball and studs draw in
          `currentColor` (see ../viewer/Mark.tsx), so hanging this off a faint
          parent would print half the logo at 38% and leave the gold ring around
          nothing.
        */}
        <div className="flex items-center gap-2.5 text-ink">
          <Mark size={30} />
          <span className="text-[13px] font-black tracking-display">Total Football</span>
        </div>

        <p className="mt-5 micro text-ink-faint">{WALL.eyebrow}</p>
        <h2 className="mt-2.5 text-xl font-black tracking-display text-ink">{WALL.title}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{WALL.body}</p>

        <a
          href={LOGIN_HREF}
          className="mt-5 flex w-full items-center justify-center rounded-xl bg-ink px-4 py-3 text-sm font-black text-paper transition-colors hover:bg-ink/85"
        >
          {WALL.cta}
        </a>

        <p className="mt-3 text-center text-[12px] leading-relaxed text-ink-faint">{WALL.foot}</p>

        {/* Deliberately the quietest thing in the card, and deliberately still
            here. See the note above about this never being a paywall. */}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-[12px] font-bold text-ink-faint transition-colors hover:text-ink-soft"
        >
          Keep watching
        </button>
      </div>
    </div>
  )
}

/**
 * The standing invitation in the top bar.
 *
 * It takes the slot the sync status uses (`Saved`, `Saving…`), which is empty
 * on a locked board and would stay empty forever — a word about work being kept
 * is meaningless where no work can be done. So the one piece of chrome that has
 * nothing to say here is replaced by the one thing this page is for.
 *
 * Never a `Button`: this navigates, and a link that looks like a button but is
 * not one cannot be opened in a new tab, which is exactly what somebody
 * half-persuaded does with it.
 */
export function SignInPill() {
  return (
    <a
      href={LOGIN_HREF}
      className="shrink-0 rounded-md bg-ink px-2.5 py-1.5 text-xs font-black text-paper transition-colors hover:bg-ink/85"
    >
      Sign in
    </a>
  )
}

/**
 * The card at the head of the right-hand panel, where the guide rail lives on a
 * board somebody owns.
 *
 * That rail counts off the five things a coach has learned to do
 * (../editor/GuideRail.tsx). To a stranger it is a scorecard for a game they
 * are not playing, so on a locked board it is taken out and this stands in its
 * place. Same slot, same weight, and it is the first thing read on the panel
 * that carries the title and the caption — the two fields most likely to be
 * reached for and the two that most obviously belong to somebody.
 */
export function SignInPanel({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="border-b border-ink-hair bg-paper/60 p-4">
      {/* Inline, where the sheet stacks it: this card sits at the head of a
          16rem panel and has to leave room for the sentence that matters, so
          the mark goes beside the eyebrow rather than above it.

          24 AND NOT SMALLER. The mark is a ball with five studs and three
          arrows around it (../viewer/Mark.tsx) and it has a floor — at 18 the
          studs close up and the whole thing reads as a dark blob in a gold
          ring, which is worse than no logo. 24 is the smallest size at which it
          is still the mark. `text-ink` for the same reason it is set on the
          sheet: the ball draws in `currentColor`. */}
      <div className="flex items-center gap-2.5 text-ink">
        <Mark size={24} />
        <p className="micro text-ink-faint">{WALL.eyebrow}</p>
      </div>
      <p className="mt-2.5 text-[13px] font-bold leading-snug text-ink">
        Press Play, or step through the phases below. This board is read only.
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
        A free account gets you your own copy of it, and everything else in the studio.
      </p>
      <a
        href={LOGIN_HREF}
        className="mt-3.5 flex w-full items-center justify-center rounded-lg bg-ink px-3 py-2 text-xs font-black text-paper transition-colors hover:bg-ink/85"
      >
        Sign in or sign up
      </a>
      {/* The second door, for somebody who wants the sentence before the form.
          It costs one line and it is the only way to read the whole pitch
          without leaving the page. */}
      <div className="mt-2 flex justify-center">
        <Button onClick={onOpen} className="!text-[11px]">
          What does an account get me?
        </Button>
      </div>
    </div>
  )
}
