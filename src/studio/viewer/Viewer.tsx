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
import { aspect, viewFor } from '../board/pitch'
import { DEFAULT_HOLD_MS, DEFAULT_MOVE_MS, holdMs, moveMs } from '../pace'
import { resolveAct, tweenActs } from '../tween'
import { fetchShared, idFromPath, systemFromHash, templateIdFromUrl } from '../share'
import type { System } from '../schema'
import { BuildCta } from './BuildCta'
import { PrintSheet } from './PrintSheet'
import { CreditBar } from './CreditBar'
import { Mark } from './Mark'
import { STUDIO_EVENTS, track } from '../track'

/**
 * The three link shapes, resolved to one document.
 *
 * Split out of the component because it is the only part of the viewer that
 * cares where a system came from, and because the template branch has to be
 * able to `await import` without that turning the effect inside out.
 */
async function resolve(): Promise<System | null> {
  const shared = idFromPath(window.location.pathname)
  if (shared) return fetchShared(shared)

  const ours = templateIdFromUrl(window.location.pathname, window.location.search)
  if (ours) {
    // Lazy, for the same reason StudioMount is: the seven documents are 90KB,
    // and a coach opening somebody else's `/s/` link must not pay for ours.
    const { templateById } = await import('../templates')
    const template = templateById(ours)
    if (!template) return null
    /*
     * Signed, here and nowhere else.
     *
     * The stored document carries no credit — `scripts/pull-system.mjs` takes
     * it off, and `fromTemplate` takes it off again for the coach's editable
     * copy, because a copy of ours is theirs and must not go out under our
     * name. A link to the ORIGINAL is the opposite case: it is ours, it is
     * being shown to somebody who may never have heard of us, and the credit
     * bar is the only thing on the page that says whose system this is.
     */
    return { ...template.system, credit: { presenter: 'Total Football' } }
  }

  return systemFromHash(window.location.hash)
}

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
   *  1. `/s/k7f3q9` — a coach's short link. Fetched from /api/share/:id.
   *  2. `?t=press-4141` — one of OURS. Read out of the template registry, which
   *     is in the bundle, so this branch touches no network and cannot 404.
   *     NOTE: `/o/press-4141/` no longer arrives here. It is a real page now,
   *     and it opens the locked studio rather than this viewer — see
   *     src/pages/o/[slug].astro. What is left on this branch is the `?t=`
   *     spelling, for links posted before those pages existed and for anybody
   *     who wants the slideshow and the print sheet instead of the tool.
   *  3. `#s=…` — the self-contained fallback link, unpacked in the browser.
   *
   * All three end in the same place. Either way it is async, so the page has a
   * real loading state rather than a flash of empty pitch.
   */
  useEffect(() => {
    let live = true
    const read = async () => {
      const s = await resolve()
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
  const moveFor = system ? moveMs(system) : DEFAULT_MOVE_MS

  const holdUntil = useRef(0)
  useEffect(() => {
    if (!move && !playing) return
    let raf = 0
    const tick = () => {
      const now = performance.now()
      if (move) {
        const t = Math.min(1, (now - move.at) / moveFor)
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
  }, [move, playing, index, count, goTo, hold, moveFor])

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

  const view = viewFor(system)
  const act = system.acts[Math.min(index, count - 1)]
  // `p` is linear time. tweenActs applies the house curve itself — easing it
  // here as well would ease it twice and land somewhere nobody chose.
  const rendered =
    move && p < 1
      ? tweenActs(system.acts[move.from], system.acts[move.to], p, system)
      : resolveAct(act, system)

  // Settled on the last phase: at the end, and not still travelling towards it.
  // A single-phase system counts as finished the moment it has loaded — there is
  // nothing left for it to do.
  const atEnd = index >= count - 1 && !move

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

          {/*
           * The invitation, once the system has finished saying its piece.
           *
           * Gated on being ON the last phase and NOT mid-playback, which are two
           * conditions rather than one on purpose: arriving at the end of an
           * autoplay run and stopping there should show it, and scrubbing
           * through the last phase on the way somewhere should not. See the
           * header of ./BuildCta.tsx for why it waits at all.
           */}
          {atEnd && !playing && <BuildCta phases={count} />}
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
