/**
 * The ? button, which used to reopen a five-screen tour and now answers questions.
 *
 * ── THE PROBLEM THIS EXISTS FOR ──────────────────────────────────────────────
 *
 * The studio is not short of guidance. There are seventy-odd control hints, a
 * documented entry for every tool, a what's-new list running to two dozen
 * entries, and a line under the board that changes with what you are doing. All
 * of it is written and all of it is good, and until now essentially all of it
 * was reachable only by HOVERING THE CONTROL IT DESCRIBES.
 *
 * That is a fine way to explain a control somebody has already found. It is no
 * way at all to answer "can this thing draw a pressing trap", because a coach
 * asking that question does not know which control to hover, and the honest
 * answer to a tool that cannot be asked is that it cannot do the thing. The
 * panel's whole job is to turn the words a coach already has — pass, badge,
 * cones, too fast, my name is not on it — into a control with a ring round it.
 *
 * ── WHY SEARCH AND CHIPS AND NOT ONE OR THE OTHER ────────────────────────────
 *
 * They serve two different people and both of them turn up. A coach with a word
 * in their head wants a box to type it in and is insulted by a menu. A coach who
 * has opened this because they are lost has no word — the whole problem is not
 * knowing what to call it — and to them an empty search box is a second thing
 * they have failed at. Chips give that person a way in that costs no vocabulary,
 * and they double as the map of what the studio can do, which is the thing
 * nobody ever reads the documentation to find out.
 *
 * ── WHY EVERY ANSWER ENDS IN A RING ──────────────────────────────────────────
 *
 * Because "it is under Teams and kit" is a sentence a coach has to hold in their
 * head while they go and look, and they will be back next month having lost it.
 * Show me opens the drawer, scrolls, and puts a ring on the control with the
 * rest of the rail still visible around it (./HelpRing.tsx), so what gets
 * learned is the place rather than the sentence. It is also the only way to be
 * SURE the answer is true: a topic pointing at a control that has been renamed
 * or removed cannot ring anything, and says so, where a paragraph of prose would
 * go on being confidently wrong for a year.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  HELP_GROUPS,
  HELP_TOPICS,
  queryWords,
  searchTopics,
  topicsInGroup,
  type HelpGroupId,
  type HelpTopic,
} from './guide'
import { show } from './spotlight'
import { WHATS_NEW, type NewsEntry } from '../../data/whatsnew'
import { STUDIO_EVENTS, track } from '../track'

/** How many what's-new entries hang off one topic. Three is a nudge, ten is a list. */
const RELATED = 3

/**
 * The what's-new entries that belong to a topic.
 *
 * OR here, unlike the topic search, and on purpose. This is not somebody's
 * query — it is a related list, and a related list that requires every word to
 * land returns nothing nearly always. The `where` field is worth as much as the
 * title because it is the one field in whatsnew.ts guaranteed to name a control
 * in the studio's own words, which is exactly what a topic's terms are made of.
 */
function relatedNews(topic: HelpTopic): NewsEntry[] {
  const words = queryWords([topic.label, ...topic.terms].join(' '))
  return WHATS_NEW.map((entry) => {
    const hay = `${entry.title} ${entry.where} ${entry.body}`.toLowerCase()
    let score = 0
    for (const word of words) if (word.length > 3 && hay.includes(word)) score += 1
    return { entry, score }
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, RELATED)
    .map((r) => r.entry)
}

function Chip({
  children,
  active = false,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
        active
          ? 'border-ink bg-ink text-paper'
          : 'border-ink-hair text-ink-soft hover:border-ink-faint hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export function HelpPanel({
  onClose,
  onWalkthrough,
  onNews,
}: {
  onClose: () => void
  onWalkthrough: () => void
  onNews: () => void
}) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<HelpGroupId | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  /** Set when Show me could not find its control. See the header. */
  const [miss, setMiss] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focused on open. This panel is a search box first, and a search box that
  // needs to be clicked before it can be typed in has wasted the press that
  // opened it.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  const results = useMemo(() => {
    if (query.trim()) return searchTopics(query)
    if (group) return topicsInGroup(group)
    return []
  }, [query, group])

  /*
   * A search that found nothing, reported once the typing stops.
   *
   * The single most valuable thing this panel can tell us. Every miss is a
   * coach who had a word for what they wanted and did not find it here, and the
   * fix is nearly always one line added to a topic's `terms` in ./guide.ts.
   * Debounced, because otherwise "cones" reports c, co, con and cone as
   * failures on its way to succeeding.
   */
  useEffect(() => {
    const q = query.trim()
    if (!q || results.length) return
    const t = setTimeout(() => track(STUDIO_EVENTS.helpMiss, q.slice(0, 40)), 900)
    return () => clearTimeout(t)
  }, [query, results.length])

  /*
   * A SEARCH opens its best answer. BROWSING opens nothing.
   *
   * Those are two different acts and they want opposite defaults. Somebody who
   * typed "long ball" has asked a question, and a list of two headings with the
   * answer folded up inside the first is that question going unanswered until
   * they press again. Somebody who pressed "Marks" has asked to look around,
   * and twelve topics with the first one unfolded pushes the other eleven off
   * the panel — the one thing they came to see.
   *
   * `openId` overrides either, so a coach can still fold the top answer away
   * and read the second, which is the case where this would otherwise fight
   * them.
   */
  const auto = query.trim() ? (results[0]?.id ?? null) : null
  // `''` is not the same as `null` here: null means the coach has not chosen,
  // so the search's own answer stands, and '' means they folded it away
  // themselves and it must stay folded.
  const expanded = openId === null ? auto : openId

  const run = async (topic: HelpTopic) => {
    setMiss(null)
    track(STUDIO_EVENTS.help, `topic:${topic.id}`)
    if (topic.action === 'walkthrough') return onWalkthrough()
    if (topic.action === 'news') return onNews()
    if (topic.action === 'settings') {
      window.location.href = '/studio/settings/'
      return
    }
    if (!topic.target) return
    // Closed BEFORE the ring, not after: the panel is docked over the top-right
    // of the rail and would be covering half the things it points at.
    onClose()
    const found = await show(topic.target)
    if (found) return
    /*
     * The control is not there. Some topics know why, and where to go instead.
     *
     * Nothing is reopened first: the panel has already gone, and popping it
     * back up to say "not here, try the settings page" would be two dismissals
     * for one question. A topic that named a fallback goes straight there.
     */
    if (topic.fallback === 'settings') {
      track(STUDIO_EVENTS.help, `fallback:${topic.id}`)
      window.location.href = '/studio/settings/'
      return
    }
    setMiss(topic.target.name)
  }

  const search = (value: string) => {
    setQuery(value)
    setOpenId(null)
    setMiss(null)
    if (value.trim()) setGroup(null)
  }

  return (
    <div
      role="dialog"
      aria-label="Help"
      className="fixed right-3 top-14 z-[75] flex max-h-[min(34rem,calc(100vh-5rem))] w-[min(23rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-ink-hair bg-surface shadow-lift"
    >
      <div className="flex items-center gap-2 border-b border-ink-hair px-3 py-2.5">
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="What do you want to do?"
          aria-label="Search the studio"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close help"
          className="-mr-1 shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-ink-faint transition-colors hover:bg-ink-hair hover:text-ink"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {miss && (
          /*
           * Honest rather than silent. A topic can point at a panel that is only
           * there when something is selected, and telling somebody the control
           * is not on screen right now is the difference between a tool with a
           * condition and a tool that ignored them.
           */
          <p className="mb-3 rounded-lg bg-paper px-2.5 py-2 text-[11px] leading-snug text-ink-soft">
            {miss} is not on the board at the moment. Some panels only appear once there is something
            for them to work on — a player selected, a mark picked out, a kit saved to your account.
          </p>
        )}

        {query.trim() && results.length === 0 && (
          <p className="mb-3 text-[12px] leading-relaxed text-ink-soft">
            Nothing matches that. Try one of these instead, or ask us directly with the speech bubble
            at the foot of the rail.
          </p>
        )}

        {results.length > 0 && (
          <ul className="m-0 list-none space-y-1 p-0">
            {results.map((topic) => {
              const open = expanded === topic.id
              const news = open ? relatedNews(topic) : []
              return (
                <li key={topic.id} className="rounded-xl border border-transparent">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? '' : topic.id)}
                    aria-expanded={open}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-bold transition-colors ${
                      open ? 'text-ink' : 'text-ink-soft hover:bg-paper hover:text-ink'
                    }`}
                  >
                    <span className="min-w-0 flex-1">{topic.label}</span>
                    <svg
                      viewBox="0 0 16 16"
                      className={`h-3 w-3 shrink-0 text-ink-faint transition-transform ${open ? 'rotate-90' : ''}`}
                      aria-hidden="true"
                    >
                      <path
                        d="M6 3.5 10.5 8 6 12.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {open && (
                    <div className="px-2 pb-3 pt-0.5">
                      {topic.body.map((line, i) => (
                        <p key={i} className="mt-1.5 text-[11px] leading-relaxed text-ink-soft first:mt-0">
                          {line}
                        </p>
                      ))}

                      <button
                        type="button"
                        onClick={() => void run(topic)}
                        className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold text-paper transition hover:-translate-y-px hover:shadow-lift"
                      >
                        {topic.action === 'walkthrough'
                          ? 'Show me round'
                          : topic.action === 'news'
                            ? 'Open the list'
                            : topic.action === 'settings'
                              ? 'Open Personal settings'
                              : 'Show me'}
                        <span aria-hidden="true">›</span>
                      </button>

                      {news.length > 0 && (
                        <div className="mt-3 border-t border-ink-hair pt-2">
                          <p className="text-[9px] font-black uppercase tracking-micro text-ink-faint">
                            Added lately
                          </p>
                          <ul className="mt-1 list-none space-y-0.5 p-0">
                            {news.map((entry) => (
                              <li key={entry.id} className="text-[11px] leading-snug text-ink-soft">
                                {entry.title}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {!query.trim() && !group && (
          <>
            <p className="text-[12px] leading-relaxed text-ink-soft">
              Type what you are trying to do, in your own words. Or pick a part of the studio and see
              what is in it.
            </p>
            <ul className="mt-3 list-none space-y-1 p-0">
              {HELP_GROUPS.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setGroup(g.id)
                      setOpenId(null)
                      track(STUDIO_EVENTS.help, `group:${g.id}`)
                    }}
                    className="group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-paper"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-bold text-ink">{g.label}</span>
                      <span className="block text-[11px] leading-snug text-ink-faint">{g.blurb}</span>
                    </span>
                    <span
                      className="shrink-0 text-[11px] font-bold tabular-nums text-ink-faint"
                      aria-hidden="true"
                    >
                      {topicsInGroup(g.id).length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-ink-hair px-3 py-2.5">
        {group || query.trim() ? (
          <Chip
            onClick={() => {
              setGroup(null)
              setQuery('')
              setOpenId(null)
              setMiss(null)
            }}
          >
            ‹ All of it
          </Chip>
        ) : null}
        {HELP_GROUPS.map((g) => (
          <Chip
            key={g.id}
            active={group === g.id}
            onClick={() => {
              setQuery('')
              setOpenId(null)
              setMiss(null)
              setGroup(group === g.id ? null : g.id)
              track(STUDIO_EVENTS.help, `group:${g.id}`)
            }}
          >
            {g.label}
          </Chip>
        ))}
        {/* Last, and always there whatever is on screen above it. Somebody who
            has typed three things and found none of them is exactly who the
            five-screen tour was written for, and it should never be more than
            one press away. */}
        <button
          type="button"
          onClick={() => {
            track(STUDIO_EVENTS.help, 'walkthrough')
            onWalkthrough()
          }}
          className="ml-auto text-[11px] font-semibold text-ink-faint underline underline-offset-2 transition-colors hover:text-ink"
        >
          Show me round again
        </button>
      </div>
    </div>
  )
}

/** Every topic, for the check that each one still points at something real. */
export const ALL_TOPICS = HELP_TOPICS
