/**
 * What's new — the bell in the toolbar, and the list behind it.
 *
 * WHY A PANEL AND NOT A MODAL
 *
 * This opens by itself, which is the whole point of it: a coach who has been
 * away for three months will not go looking for a changelog, so it has to come
 * to them. Something that opens by itself has to be cheap to ignore, and a
 * centred modal over the board is not — it blanks the work, it takes the
 * keyboard, and it has to be dismissed before anything else can happen. The
 * walkthrough earns that because a coach who has never seen the studio cannot
 * use it yet. A list of things that got better does not earn it. So this hangs
 * off its own button in the corner, the board stays visible and unchanged
 * underneath, and clicking anywhere is enough to make it go away.
 *
 * WHY THERE IS STILL A BACKDROP
 *
 * It is invisible and it does nothing except swallow the click that closes the
 * panel. Without it that click lands on the board, and dismissing a changelog
 * would deselect the player the coach had picked, or start a drag. Closing
 * something is not consent to edit the thing behind it.
 *
 * WHY THERE IS NO UNREAD DOT ON THE BELL
 *
 * There was one, and it could never be seen. Every state that would light it is
 * a state the panel opens itself in, and opening the panel is what marks the
 * list read — so the dot existed for one frame on load and never again. A badge
 * that cannot be reached is not a subtle badge, it is dead code that looks like
 * a feature. The panel opening IS the notification; the bell is the way back to
 * the list afterwards, exactly like the `?` beside it is the way back to the
 * walkthrough, and that one has never needed a dot either.
 *
 * WHY THE PER-ENTRY MARKERS DO NOT CLEAR AS YOU READ
 *
 * The watermark moves the moment the panel opens, so markers derived from it
 * would clear in the same frame the list appeared — marking a list nobody had
 * had a chance to look at. They come off a list frozen when the editor mounted
 * instead: `unread` below, owned by ./StudioEditor.tsx.
 */

import { useCallback, useEffect, useState } from 'react'
import { NEWS } from './guide'
import { WHATS_NEW, type NewsEntry, type NewsKind } from '../../data/whatsnew'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/**
 * "19 August 2026", split by hand.
 *
 * Not `new Date(iso).toLocaleDateString()`. A bare `YYYY-MM-DD` is parsed as
 * UTC midnight and then printed in the reader's zone, so every entry shows a
 * day early to everybody west of Greenwich — which is most of the audience for
 * a football site. The string is already the date we mean; splitting it is the
 * version with no timezone in it at all.
 */
function niceDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/**
 * The size-of-change marker.
 *
 * Gold and green are the two fixed brand colours — they are the same in all
 * four rooms — so the text on them is a fixed dark ink rather than the `ink`
 * token. The token flips to near-white in Night and would leave a pale word on
 * a pale gold chip. This is the exception the rule in ./ui.tsx is about: a
 * hardcoded neutral is wrong on a themed surface, and right on one that never
 * changes.
 */
const KIND_CLASS: Record<NewsKind, string> = {
  new: 'bg-gold text-[#161618]',
  better: 'bg-green text-[#161618]',
  fixed: 'bg-ink-hair text-ink-soft',
}

function Entry({ entry, unread }: { entry: NewsEntry; unread: boolean }) {
  const isSpecial = entry.id === 'repeat-drill'
  
  return (
    <li className={`border-t border-ink-hair px-4 py-3.5 first:border-t-0 ${isSpecial ? 'bg-gold/5 rounded-xl outline outline-1 outline-gold m-2' : ''}`}>
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${KIND_CLASS[entry.kind]}`}
        >
          {NEWS.kind[entry.kind]}
        </span>
        <time dateTime={entry.date} className="text-[11px] font-bold text-ink-faint">
          {niceDate(entry.date)}
        </time>
        {unread && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-ink-faint">
            {NEWS.unread}
            <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
          </span>
        )}
      </div>
      <h3 className="mb-1 text-sm font-black leading-snug tracking-display text-ink">{entry.title}</h3>
      <p className="mb-2 text-[13px] leading-relaxed text-ink-soft">{entry.body}</p>
      
      {isSpecial ? (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[11px] font-bold text-ink-faint">{entry.where}</p>
          <button 
            type="button" 
            className="rounded-full bg-gold px-3 py-1 text-[11px] font-bold text-[#161618] hover:bg-gold/90 transition-colors"
            onClick={() => {
              // Trigger a global custom event to launch the guide
              window.dispatchEvent(new CustomEvent('start-guide-repeat-drill'))
            }}
          >
            Read the guide
          </button>
        </div>
      ) : (
        <p className="text-[11px] font-bold text-ink-faint">{entry.where}</p>
      )}
    </li>
  )
}

interface Props {
  open: boolean
  /** Ids still marked unread, frozen at mount. See the note at the top. */
  unread: string[]
  onOpen: () => void
  onClose: () => void
}

export function NewsBell({ open, unread, onOpen, onClose }: Props) {
  const [atEnd, setAtEnd] = useState(false)

  /*
   * Measured when the list mounts, not just on scroll.
   *
   * `onScroll` alone would leave `atEnd` false for a list too short to scroll,
   * and hang a "there is more below" fade off the bottom of a list that ends
   * where it looks like it ends. Six entries always overflow today; the panel
   * should not start lying the day somebody trims it to two.
   */
  const measure = useCallback((el: HTMLUListElement | null) => {
    if (el) setAtEnd(el.scrollHeight - el.clientHeight <= 2)
  }, [])

  // Escape closes it, like every other layer in the studio. Nothing traps focus
  // here on purpose — this is a panel beside the work, not a door in front of
  // it, and a coach who tabs straight past it back to the board is doing the
  // right thing.
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open, onClose])

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60]"
          onPointerDown={onClose}
          aria-hidden="true"
        />
      )}

      <div className={`relative shrink-0 ${open ? 'z-[61]' : ''}`}>
        <button
          type="button"
          onClick={open ? onClose : onOpen}
          aria-label={NEWS.title}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`inline-flex items-center justify-center rounded-md p-1.5 transition-colors ${
            open ? 'bg-ink-hair text-ink' : 'text-ink-soft hover:bg-ink-hair hover:text-ink'
          }`}
        >
          <svg viewBox="0 0 20 20" className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" fill="none">
            <path
              d="M10 2.6a4.7 4.7 0 0 0-4.7 4.7c0 3.4-1 4.6-1.6 5.2-.3.3-.1.9.4.9h11.8c.5 0 .7-.6.4-.9-.6-.6-1.6-1.8-1.6-5.2A4.7 4.7 0 0 0 10 2.6Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M8.2 16.1a1.9 1.9 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {open && (
          <div
            role="dialog"
            aria-label={NEWS.title}
            className="absolute right-0 top-[calc(100%+0.6rem)] w-[min(23rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-ink-hair bg-surface shadow-lift"
          >
            <div className="border-b border-ink-hair px-4 py-3">
              <h2 className="text-base font-black tracking-display text-ink">{NEWS.title}</h2>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{NEWS.body}</p>
            </div>

            {WHATS_NEW.length === 0 ? (
              <p className="px-4 py-5 text-[13px] text-ink-soft">{NEWS.empty}</p>
            ) : (
              <div className="relative">
                <ul
                  ref={measure}
                  className="max-h-[min(34rem,calc(100dvh-8rem))] overflow-y-auto overscroll-contain"
                  onScroll={(e) => {
                    const el = e.currentTarget
                    setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 2)
                  }}
                >
                  {WHATS_NEW.map((e) => (
                    <Entry key={e.id} entry={e} unread={unread.includes(e.id)} />
                  ))}
                </ul>
                {/*
                 * The list is cut off mid-sentence at the bottom, which is what
                 * a scrollable list looks like on a Mac — where the scrollbar
                 * is invisible until you touch it. Without a cue that reads as
                 * "there is more", a truncated word reads as a broken panel.
                 * It goes when there genuinely is no more, so the cue is never
                 * pointing at nothing.
                 */}
                {!atEnd && (
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent"
                    aria-hidden="true"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
