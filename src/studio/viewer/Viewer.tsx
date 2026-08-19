/**
 * The shared viewer — what somebody sees when a coach sends them a link.
 *
 * This is the export. Not a file: a page. The plan said MP4 and MP4 needs
 * Remotion Lambda, a queue and a bill, and what a coach actually wants when
 * they say "can I send this to the lads" is a link that plays. A link plays on
 * a phone in a changing room with no app and no account, it is never the wrong
 * resolution, and it does not go stale: press Share again after changing a
 * phase and the link already sent shows the new version, because a share is
 * updated in place under the same id (../share.ts).
 *
 * It renders through the same ../board/Board and the same ../tween as the
 * editor, so what plays here is exactly what the coach was looking at while
 * they built it. There is no second renderer to drift.
 *
 * THREE AUDIENCES, ONE PAGE:
 *
 *  · Somebody who taps the link. Board, big; a caption; a next button.
 *  · A coach presenting off it. Play, keyboard arrows, no chrome in the way.
 *  · A coach printing it. Every phase, one per page, laid out by the print
 *    stylesheet in the page that mounts this. The browser prints the live SVG,
 *    so the PDF is VECTOR and the type is really Inter — which is the whole
 *    reason this is a print sheet and not a canvas rasteriser. See the font
 *    gotcha in docs/STUDIO.md §6; this route walks around it rather than
 *    solving it.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Board } from '../board/Board'
import { PITCH_VIEWS, aspect, resolveViewId } from '../board/pitch'
import { DEFAULT_HOLD_MS, holdMs } from '../pace'
import { MOVE_MS, resolveAct, tweenActs } from '../tween'
import { fetchShared, idFromPath, systemFromHash } from '../share'
import type { System } from '../schema'
import { CreditBar, formatDate } from './CreditBar'
import { Mark } from './Mark'
import { STUDIO_EVENTS, track } from '../track'

export default function Viewer() {
  const [system, setSystem] = useState<System | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'broken'>('loading')
  const [index, setIndex] = useState(0)
  /** A manual move between two phases, or the autoplay run. Both tween. */
  const [move, setMove] = useState<{ from: number; to: number; at: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [p, setP] = useState(1)

  /*
   * Where the system comes from, in order:
   *
   *  1. `/s/k7f3q9` — the short link. Fetched from /api/share/:id.
   *  2. `#s=…` — the self-contained fallback link, unpacked in the browser.
   *
   * Both end in the same place. Either way it is async, so the page has a real
   * loading state rather than a flash of empty pitch.
   */
  useEffect(() => {
    let live = true
    const read = async () => {
      const id = idFromPath(window.location.pathname)
      const s = id ? await fetchShared(id) : await systemFromHash(window.location.hash)
      if (!live) return
      setSystem(s)
      setState(s ? 'ready' : 'broken')
      setIndex(0)
    }
    read()
    // Someone editing the fragment by hand still gets the right system.
    window.addEventListener('hashchange', read)
    return () => {
      live = false
      window.removeEventListener('hashchange', read)
    }
  }, [])

  const count = system?.acts.length ?? 0

  /** Step to a phase, tweening from wherever we are. */
  const goTo = useCallback(
    (next: number, autoplaying = false) => {
      setIndex((cur) => {
        const to = Math.min(Math.max(0, next), Math.max(0, count - 1))
        if (to === cur) return cur
        setMove({ from: cur, to, at: performance.now() })
        setP(0)
        return to
      })
      if (!autoplaying) setPlaying(false)
    },
    [count],
  )

  // One animation loop for both the manual step and the autoplay run. Autoplay
  // is "hold, then move", the pacing from ../tween.ts — the same beat as the
  // shorts, so a system watched here has the rhythm of one that was filmed.
  /*
   * The pace the coach set, so a link plays at the speed of the film it came
   * from. The fallback is only reached before the document has loaded, when
   * there is nothing on screen to pace anyway.
   */
  const hold = system ? holdMs(system) : DEFAULT_HOLD_MS

  const holdUntil = useRef(0)
  useEffect(() => {
    if (!move && !playing) return
    let raf = 0
    const tick = () => {
      const now = performance.now()
      if (move) {
        const t = Math.min(1, (now - move.at) / MOVE_MS)
        setP(t)
        if (t >= 1) {
          setMove(null)
          holdUntil.current = now + hold
        }
      } else if (playing) {
        if (now >= holdUntil.current) {
          if (index >= count - 1) setPlaying(false)
          else goTo(index + 1, true)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [move, playing, index, count, goTo, hold])

  const play = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    setPlaying(true)
    if (index >= count - 1) {
      // Replaying from the end starts again from the top rather than doing
      // nothing, which is what pressing play on a finished video does.
      setIndex(0)
      setMove(null)
      setP(1)
    }
    holdUntil.current = performance.now() + hold * 0.6
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goTo(index + 1)
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') goTo(index - 1)
      if (e.key === ' ') {
        e.preventDefault()
        play()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count, goTo, playing])

  // Swipe, because most of these links are opened on a phone.
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current
    if (!start) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    // Horizontal and decisive, or it was a scroll.
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) goTo(index + (dx < 0 ? 1 : -1))
    touch.current = null
  }

  if (state === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-paper-deep">
        <p className="text-micro uppercase text-ink-faint">Opening…</p>
      </div>
    )
  }

  if (state === 'broken' || !system) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-paper-deep p-6">
        <div className="max-w-sm text-center">
          <Mark size={44} />
          <h1 className="mt-4 text-xl font-black tracking-display text-ink">This link did not open</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Either the system it points at is no longer published, or the link was cut short on its way here,
            wrapped by an email, trimmed by a message app. Ask whoever sent it for a fresh one, or build your own.
          </p>
          <a
            href="/studio/new/"
            className="mt-5 inline-flex rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-paper no-underline"
          >
            Open the studio
          </a>
        </div>
      </div>
    )
  }

  const view = PITCH_VIEWS[resolveViewId(system.pitch)]
  const act = system.acts[Math.min(index, count - 1)]
  // `p` is linear time. tweenActs applies the house curve itself — easing it
  // here as well would ease it twice and land somewhere nobody chose.
  const rendered =
    move && p < 1
      ? tweenActs(system.acts[move.from], system.acts[move.to], p, system)
      : resolveAct(act, system)

  return (
    <>
      {/* ── on screen ── */}
      <div className="tf-screen flex min-h-[100dvh] flex-col bg-paper-deep text-ink">
        <header className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-black tracking-display text-ink sm:text-lg">
              {system.title || 'A tactical system'}
            </h1>
            {system.subtitle && <p className="truncate text-[12px] text-ink-faint">{system.subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              // The print stylesheet IS the PDF export (see the page's header
              // comment), so this press is the only signal that anybody uses
              // it. Recorded before the call, because print() blocks.
              track(STUDIO_EVENTS.printed)
              window.print()
            }}
            className="shrink-0 rounded-lg border border-ink-hair px-3 py-1.5 text-xs font-bold text-ink-soft transition-colors hover:bg-surface"
          >
            Print / PDF
          </button>
        </header>

        <main
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 pb-4 sm:px-6"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="max-h-[58dvh] w-full max-w-4xl overflow-hidden rounded-xl shadow-lift"
            style={{ aspectRatio: aspect(view) }}
          >
            <Board system={system} act={rendered} idp="watch" />
          </div>

          <div className="w-full max-w-2xl text-center">
            <p className="text-micro uppercase text-ink-faint">
              {index + 1} of {count}
            </p>
            {act.title && (
              <h2 className="mt-1.5 text-lg font-black tracking-display text-ink sm:text-xl">{act.title}</h2>
            )}
            {act.caption && <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{act.caption}</p>}
            {act.notes && (
              <p className="mx-auto mt-2.5 max-w-prose whitespace-pre-line text-[13px] leading-relaxed text-ink-faint">
                {act.notes}
              </p>
            )}
          </div>

          {/* Controls. Big enough for a thumb, quiet enough to ignore. */}
          <div className="flex items-center gap-3">
            <Step dir="left" onClick={() => goTo(index - 1)} disabled={index === 0} />
            <div className="flex items-center gap-1.5">
              {system.acts.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={`Phase ${i + 1}${a.title ? `: ${a.title}` : ''}`}
                  onClick={() => goTo(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === index ? 'w-6 bg-ink' : 'w-2 bg-ink-hair hover:bg-ink-faint'
                  }`}
                />
              ))}
            </div>
            <Step dir="right" onClick={() => goTo(index + 1)} disabled={index >= count - 1} />
            {count > 1 && (
              <button
                type="button"
                onClick={play}
                className="ml-1 rounded-lg bg-ink px-4 py-2 text-xs font-bold text-paper transition-opacity hover:opacity-85"
              >
                {playing ? 'Pause' : 'Play all'}
              </button>
            )}
          </div>
        </main>

        <footer className="bg-surface">
          <div className="mx-auto max-w-4xl">
            <CreditBar credit={system.credit} />
          </div>
        </footer>
      </div>

      {/* ── on paper ── */}
      <PrintSheet system={system} />
    </>
  )
}

function Step({ dir, onClick, disabled }: { dir: 'left' | 'right'; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? 'Previous phase' : 'Next phase'}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-hair bg-surface text-ink-soft transition-colors hover:text-ink disabled:opacity-30"
    >
      <svg viewBox="0 0 12 12" className="h-4 w-4" aria-hidden="true">
        <path
          d={dir === 'left' ? 'M7.5 2 L3.5 6 L7.5 10' : 'M4.5 2 L8.5 6 L4.5 10'}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

/**
 * Every phase, one per page. Hidden on screen, shown by the print stylesheet.
 *
 * It is built as real DOM rather than generated on demand for one reason worth
 * keeping: the thing that prints is the thing that was on screen. There is no
 * export path with its own bugs, no fonts to embed, no ball to inline — the
 * browser already has all of it loaded, and it prints the SVG as vector.
 */
function PrintSheet({ system }: { system: System }) {
  const view = PITCH_VIEWS[resolveViewId(system.pitch)]
  const credit = system.credit

  return (
    <div className="tf-print" aria-hidden="true">
      {/* cover */}
      <section className="tf-slide tf-cover">
        <div className="tf-cover-mid">
          <Mark size={54} ink="#161618" />
          <h1 className="tf-cover-title">{system.title || 'A tactical system'}</h1>
          {system.subtitle && <p className="tf-cover-sub">{system.subtitle}</p>}
          <p className="tf-cover-meta">
            {[credit?.presenter, credit?.team].filter(Boolean).join(' · ')}
            {credit?.note ? ` · ${credit.note}` : ''}
          </p>
          <p className="tf-cover-date">{formatDate(credit?.sharedOn)}</p>
        </div>
        <p className="tf-cover-foot">
          {system.acts.length} {system.acts.length === 1 ? 'phase' : 'phases'} · Made with Total Football
        </p>
      </section>

      {system.acts.map((a, i) => (
        <section key={a.id} className="tf-slide">
          <header className="tf-slide-head">
            <span className="tf-slide-n">
              {i + 1} / {system.acts.length}
            </span>
            <h2 className="tf-slide-title">{a.title || `Phase ${i + 1}`}</h2>
          </header>

          <div className="tf-slide-board" style={{ aspectRatio: aspect(view) }}>
            <Board system={system} act={resolveAct(a, system)} idp={`print-${a.id}`} />
          </div>

          {a.caption && <p className="tf-slide-caption">{a.caption}</p>}
          {a.notes && <p className="tf-slide-notes">{a.notes}</p>}

          <div className="tf-slide-credit">
            <CreditBar credit={credit} compact />
          </div>
        </section>
      ))}
    </div>
  )
}
