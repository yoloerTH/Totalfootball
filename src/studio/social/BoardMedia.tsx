/**
 * A published system as the feed shows it: a still, or the board playing.
 *
 * ── "VIDEO" IS THE DOCUMENT MOVING, NOT A FILE ───────────────────────────────
 *
 * The post IS the JSON. Every phase, every arrow and the coach's own pace are
 * already in it, and ../tween.ts is what the studio, the viewer and the mp4
 * exporter all use to turn that into motion. So a video post plays the document
 * through the same engine, at the same pace, in the reader's browser.
 *
 * What that buys, beyond not writing an encoder into the publish path:
 *
 *   · Publishing stays instant. Encoding an mp4 costs a coach a minute of
 *     watching a progress bar, and costs us megabytes per post forever.
 *   · There is one truth. A rendered file is a second copy of the system that
 *     goes stale the moment the coach edits — and a post is a snapshot, so it
 *     would go stale silently.
 *   · It is sharper than any file at any width, because it is vectors.
 *
 * The mp4 exporter is not replaced and is not competing: it exists so a coach
 * can put a system on Instagram, which cannot be handed a document. See
 * ../videoRender.ts.
 *
 * ── ONE BOARD MOVES AT A TIME, AND ONLY WHEN IT IS ON SCREEN ─────────────────
 *
 * Each playing board is a `requestAnimationFrame` loop over an SVG with
 * twenty-two counters in it. Ten of those running behind a scrolled feed is a
 * hot phone and a flat battery, so playback is driven by an
 * `IntersectionObserver` and stops the moment a card leaves the viewport. A
 * card the reader cannot see is a card that costs nothing.
 *
 * `prefers-reduced-motion` STOPS IT ENTIRELY and shows the cover still. A
 * looping animation is exactly the thing that setting exists to turn off.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Board } from '../board/Board'
import { aspect, viewFor } from '../board/pitch'
import { cameraRect } from '../camera'
import { DEFAULT_HOLD_MS, DEFAULT_MOVE_MS, holdMs, moveMs } from '../pace'
import { resolveAct, tweenActs } from '../tween'
import { publishedPhotoUrls } from '../posts'
import type { System } from '../schema'

/**
 * Where a system is in its run, as a phase index and a fraction between two.
 *
 * Held as one object rather than three pieces of state so a frame cannot be
 * drawn half-updated — the index from this tick and the progress from the last
 * is a counter that jumps backwards.
 */
interface Frame {
  from: number
  to: number
  /** 0 while holding on `from`, 0→1 while moving to `to`. */
  p: number
}

/**
 * How tall a board may be in a feed.
 *
 * A viewport fraction rather than pixels, so it holds on a phone where 70vh is
 * most of the screen and exactly right; the pixel bound stops a board becoming
 * a poster on a 27-inch monitor. Measured before it existed: one portrait
 * system was 2,400px tall in a 430px column, which is one system per three
 * swipes and a reader who never reaches the second post.
 */
const CAP = 'min(70vh, 620px)'

function usePlayback(system: System, playing: boolean, startAt: number): Frame {
  const acts = system.acts.length
  const [frame, setFrame] = useState<Frame>({ from: startAt, to: startAt, p: 0 })
  const hold = holdMs(system) || DEFAULT_HOLD_MS
  const move = moveMs(system) || DEFAULT_MOVE_MS

  useEffect(() => {
    if (!playing || acts < 2) {
      setFrame({ from: startAt, to: startAt, p: 0 })
      return
    }

    let raf = 0
    let at = startAt
    // The first hold is shortened: a reader who has just scrolled a card into
    // view is watching NOW, and two and a half seconds of a still board is how
    // they learn this one does not move.
    let until = performance.now() + hold * 0.4
    let moving: { from: number; to: number; at: number } | null = null

    const tick = () => {
      const now = performance.now()
      if (moving) {
        const p = Math.min(1, (now - moving.at) / move)
        setFrame({ from: moving.from, to: moving.to, p })
        if (p >= 1) {
          at = moving.to
          moving = null
          until = now + hold
        }
      } else if (now >= until) {
        // Loops. A feed card that stopped on the last phase would be a still
        // board by the time most readers reached it.
        const next = (at + 1) % acts
        moving = { from: at, to: next, at: now }
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, acts, hold, move, startAt])

  return frame
}

/** Honours the reader's own setting, and re-reads it if they change it. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const listen = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', listen)
    return () => mq.removeEventListener('change', listen)
  }, [])
  return reduced
}

export function BoardMedia({
  system,
  media,
  coverAct,
  /** A stable prefix for this board's gradient and clip ids. See `Board`. */
  idp,
  /** Off on a page that draws many boards but wants none of them moving. */
  allowPlay = true,
}: {
  system: System
  media: 'image' | 'video'
  coverAct: number
  idp: string
  allowPlay?: boolean
}) {
  const host = useRef<HTMLDivElement | null>(null)
  const [onScreen, setOnScreen] = useState(false)
  const reduced = useReducedMotion()

  const acts = system.acts
  const start = Math.min(Math.max(coverAct, 0), Math.max(acts.length - 1, 0))
  const playing = allowPlay && media === 'video' && !reduced && onScreen && acts.length > 1

  const frame = usePlayback(system, playing, start)

  useEffect(() => {
    const node = host.current
    if (!node || media !== 'video') return
    const io = new IntersectionObserver(
      (entries) => setOnScreen(entries.some((e) => e.isIntersecting)),
      // A third of the card, so a board does not start playing while it is a
      // sliver at the bottom edge and finish before the reader arrives.
      { threshold: 0.35 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [media])

  const photoHrefs = useMemo(() => publishedPhotoUrls(system), [system])
  const view = viewFor(system)

  /**
   * The shape the board is actually DRAWN in, camera included.
   *
   * `aspect(view)` is the shape of the pitch crop, and it is the wrong number
   * whenever a phase has a camera on it: `Board` draws
   * `cameraViewBox(view, act.shot, act.frame)`, which can be a good deal
   * narrower. Sizing the box by the crop and letting the board letterbox inside
   * it left every camera-framed system sitting between two grey margins — which
   * reads as a rendering fault rather than as a choice.
   *
   * TAKEN FROM THE COVER PHASE AND HELD THERE, deliberately. A film's camera
   * moves from phase to phase, and a box that resized with it would make the
   * whole page jump every few seconds while it played. One shape, chosen from
   * the frame the coach picked as the opening one, and the rest of the phases
   * letterbox inside it by however much the camera differs.
   */
  const drawnAspect = useMemo(() => {
    const cover = resolveAct(acts[start] ?? acts[0], system)
    const rect = cameraRect(view, cover.shot ?? null, cover.frame)
    return rect.h > 0 ? rect.w / rect.h : aspect(view)
  }, [acts, start, system, view])

  const rendered =
    playing && frame.p > 0 && frame.p < 1 && acts[frame.from] && acts[frame.to]
      ? tweenActs(acts[frame.from], acts[frame.to], frame.p, system)
      : resolveAct(acts[playing ? frame.from : start] ?? acts[0], system)

  if (!acts.length) return null

  return (
    <div ref={host} className="relative w-full overflow-hidden bg-paper">
      {/* The board keeps its own shape, capped. See CAP above for why, and
          `Board`'s `preserveAspectRatio="xMidYMid meet"` for what happens at
          the edges: never cropped, never stretched. */}
      <div
        className="mx-auto"
        style={{
          aspectRatio: drawnAspect,
          // The cap is applied to the WIDTH, derived from the height limit and
          // the board's own aspect, rather than to the height directly. Capping
          // the height alone leaves the box its full width, and a portrait
          // board then sits in the middle of two grey gutters — which is what
          // the first cut did, and it looked like a bug on every vertical
          // system. This way the box keeps the board's shape and simply gets
          // smaller, centred, with nothing beside it.
          maxHeight: CAP,
          width: `min(100%, calc(${CAP} * ${drawnAspect}))`,
        }}
      >
        <Board system={system} act={rendered} idp={idp} photoHrefs={photoHrefs} />
      </div>

      {/* What kind of post this is, said on the media rather than in a caption.
          A reader scrolling past should know a board is going to move before it
          moves — and know that a still one is not broken. */}
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-paper">
        {media === 'video'
          ? `${acts.length} phases${playing ? '' : reduced ? ' · still' : ''}`
          : acts.length > 1
            ? `Phase ${start + 1} of ${acts.length}`
            : 'One phase'}
      </span>
    </div>
  )
}
