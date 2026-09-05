/**
 * The chrome every page inside the network shares.
 *
 * ── WHY THE NETWORK NEEDS A SHELL OF ITS OWN ─────────────────────────────────
 *
 * The site already has a nav, and it is about the site: Library, Studio,
 * Intelligence, Course. Inside the network a coach is asking different
 * questions — what is good this week, what is new, what has this person made —
 * and those need to be one press apart from each other rather than one press
 * from a course page. So there is a second, narrower bar: the feed's two tabs,
 * the way back to their own shelf, and nothing else.
 *
 * It is a bar and not a sidebar because the network is read on a phone at a
 * training ground, and a sidebar on a phone is a hamburger nobody opens.
 */

import type { ReactNode } from 'react'
import { Mark } from '../viewer/Mark'

export function SocialShell({
  title,
  note,
  tabs,
  children,
}: {
  title: string
  note?: string
  /** The feed's Featured/Recent. A profile passes none. */
  tabs?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-5 sm:py-12">
      <header className="border-b border-ink-hair pb-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <a
            href="/studio/portal/"
            className="text-[12px] font-bold text-ink-soft no-underline hover:text-ink"
          >
            ‹ Your systems
          </a>
          <a
            href="/feed/"
            className="flex items-center gap-2 text-[12px] font-bold text-ink-faint no-underline hover:text-ink"
          >
            <Mark size={16} />
            The network
          </a>
        </div>

        <h1 className="mt-3 text-title font-black tracking-display text-ink">{title}</h1>
        {note && <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-ink-soft">{note}</p>}
        {tabs && <div className="mt-4">{tabs}</div>}
      </header>

      {children}
    </div>
  )
}

/**
 * The two ways to read the feed.
 *
 * ── FEATURED IS FIRST, AND RECENT IS ALWAYS THERE ────────────────────────────
 *
 * Featured is the better read on most days: it is what the network thought was
 * worth something, and a new coach opening this for the first time should land
 * on the best of it rather than on whatever was posted eleven minutes ago.
 *
 * But Recent is never hidden behind a menu, because a chronological view is the
 * promise that publishing here is not a lottery. A coach who posts at nine in
 * the morning can point somebody at Recent and know their system is there. A
 * network with only a ranked feed asks people to trust an algorithm they cannot
 * see; this one shows them the raw list beside it.
 */
export function FeedTabs({
  mode,
  onMode,
}: {
  mode: 'featured' | 'recent'
  onMode: (next: 'featured' | 'recent') => void
}) {
  const tab = (id: 'featured' | 'recent', label: string, hint: string) => (
    <button
      key={id}
      type="button"
      onClick={() => onMode(id)}
      aria-pressed={mode === id}
      title={hint}
      className={`rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${
        mode === id
          ? 'bg-ink text-paper'
          : 'border border-ink-hair text-ink-soft hover:bg-ink-hair hover:text-ink'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex items-center gap-2">
      {tab('featured', 'Featured', 'What coaches have reacted to, weighed against how long it has been up.')}
      {tab('recent', 'Most recent', 'Everything, newest first. No ranking at all.')}
    </div>
  )
}
