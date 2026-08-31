/**
 * Save it as a video.
 *
 * Deliberately a second dialog rather than a tab inside ShareDialog. Sharing is
 * one press and a link; this is a choice, a wait and a download, and bolting a
 * minute-long progress bar onto the control a coach uses in five seconds would
 * make the fast path feel like the slow one.
 *
 * The shape of the wait is the whole design here. A coach who presses Save and
 * watches a still bar for forty seconds concludes it has hung — so the bar
 * moves per frame, the seconds it is making are stated before they commit, and
 * Stop is a real button rather than a browser tab they have to kill.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { withoutIdentity, type System } from '../schema'
import {
  DEFAULT_QUALITY,
  VIDEO_FRAME_RATES,
  VIDEO_QUALITIES,
  VIDEO_SHAPES,
  frameSize,
  resolveQuality,
  resolveShape,
  saveVideo,
  videoSeconds,
  videoSupported,
  type VideoFps,
  type VideoQuality,
  type VideoShape,
} from '../video'
import { Button, Field, Modal, Segmented, Toggle } from './ui'
import { PaceField } from './PaceField'
import { VIDEO } from './guide'
import { STUDIO_EVENTS, track } from '../track'
import { IdentityToggle } from './IdentityToggle'

type Status = 'idle' | 'working' | 'done' | 'failed'

export function VideoDialog({
  system,
  identity,
  onIdentity,
  identityIsDefault,
  unsigned,
  onHold,
  onMove,
  onPaceMode,
  onPaceCommit,
  onSaved,
  onSwitchMode,
  onClose,
}: {
  system: System
  /** Whether the coach's name, club, crest and squad go into the file. */
  identity: boolean
  onIdentity: (next: boolean) => void
  /** True while `identity` is still the account default and not a choice. */
  identityIsDefault: boolean
  /** The system carries no name or club. See ./IdentityToggle.tsx. */
  unsigned: boolean
  /**
   * Pace edits the DOCUMENT from inside an export dialog, which looks like a
   * layering mistake and is not. A coach only discovers a film is too slow by
   * watching one, and this is where they are standing when they find out —
   * sending them back to a side panel to fix it, then back here to re-render,
   * is three steps for a setting they are already looking at the effect of.
   * What it writes is the system's own pace, so Play and the share link move
   * with it; see ../pace.ts for why that is the right place for it to live.
   */
  onHold: (ms: number) => void
  onMove: (ms: number) => void
  onPaceMode: (mode: 'curve' | 'linear') => void
  onPaceCommit: () => void
  /** A file was actually written. Not "Save was pressed" — see `start`. */
  onSaved?: () => void
  onSwitchMode?: (mode: 'image' | 'video') => void
  onClose: () => void
}) {
  const [shape, setShape] = useState<VideoShape['id']>('landscape')
  /*
   * Size and rate, remembered only for as long as the dialog is open.
   *
   * NOT stored on the document, and not in the coach's settings either. The
   * document already carries the things that are true about the SYSTEM — its
   * pace, its surface, its camera — and how big a file is wanted is a fact
   * about the errand, not about the tactics: the same system goes out at 1080p
   * to YouTube on Monday and at 720p into a group chat on Friday. Defaulting to
   * the best one every time is the honest behaviour; making a coach notice they
   * are still on last week's setting is not.
   */
  const [quality, setQuality] = useState<VideoQuality['id']>(DEFAULT_QUALITY)
  const [fps, setFps] = useState<VideoFps>(30)
  // Off by default, and only offered when there is one to show — see the note
  // on `VideoOptions.date`. A file outlives the day it was made.
  const [date, setDate] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const abort = useRef<AbortController | null>(null)

  const supported = videoSupported()
  const seconds = videoSeconds(system)
  const size = frameSize(resolveShape(shape), resolveQuality(quality))
  /**
   * How much work this combination is, against 1080p30 as 1.
   *
   * Pixels times frames, which is what the rasteriser and the encoder both
   * actually scale with — the board is re-drawn per frame and the encoder eats
   * per pixel, so 720p60 and 1080p30 land within a few per cent of each other
   * and the number says so instead of implying that 60fps is always the slow
   * one. Rounded to a half, because this is a warning and not a benchmark.
   */
  const effort =
    Math.round(((size.w * size.h * fps) / (1920 * 1080 * 30)) * 2) / 2

  // Escape closes, except mid-render: a coach who has waited forty seconds
  // should not lose the file to a stray keypress. Stop is explicit.
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && status !== 'working' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose, status])

  useEffect(() => () => abort.current?.abort(), [])

  const start = useCallback(async () => {
    const controller = new AbortController()
    abort.current = controller
    setStatus('working')
    setProgress(0)
    try {
      // The encoder, the muxer and React's second renderer, fetched now rather
      // than on page load — see ../video.ts. It lands while the coach is still
      // reading the dialog, so the wait they notice is the render, not this.
      const { renderVideo } = await import('../videoRender')
      // Stripped before the renderer sees it, exactly as the picture and the
      // link are. See `withoutIdentity` in ../schema.ts.
      const file = await renderVideo(identity ? system : withoutIdentity(system), {
        shape,
        quality,
        fps,
        date,
        signal: controller.signal,
        onProgress: setProgress,
      })
      if (controller.signal.aborted) return
      saveVideo(file)
      setStatus('done')
      // Counted where the file is actually written, not where Save is pressed:
      // a render that was stopped or that failed is not a video, and the two
      // numbers diverging is the point of measuring it.
      // Shape, size and rate together, because the question the number has to
      // answer is which combination coaches actually reach for — and a count of
      // "vertical" that cannot tell 720p30 from 1080p60 answers none of it.
      track(STUDIO_EVENTS.videoSaved, `${shape}-${quality}p${fps}${identity ? '' : '-anon'}`)
      onSaved?.()
    } catch (err) {
      // Stopping is not failing, and must not be reported as if it were.
      setStatus((err as Error)?.name === 'AbortError' ? 'idle' : 'failed')
    } finally {
      abort.current = null
    }
  }, [system, identity, shape, quality, fps, date, onSaved])

  const stop = useCallback(() => {
    abort.current?.abort()
    setStatus('idle')
    setProgress(0)
  }, [])

  const working = status === 'working'

  /*
   * ── WHY THIS IS A `Modal` NOW ───────────────────────────────────────────
   *
   * This is the tallest dialog in the studio — orientation, size, smoothness,
   * two pace sliders, the date toggle, the film summary and a footnote — and it
   * was drawn as a centred card with no height limit inside a scrolling
   * backdrop. Past about 800px of window that combination loses BOTH ends at
   * once: centring pushes the heading above the scroller's origin, where it
   * cannot be scrolled back to, and Save the video falls off the bottom. It
   * filled the screen edge to edge doing it (user, 2026-08-27).
   *
   * `Modal` in ./ui.tsx caps the card, scrolls only the middle of it, and pins
   * Save the video to the bottom where a coach can always reach it.
   */
  return (
    <Modal
      title={VIDEO.title}
      subtitle={VIDEO.body}
      label="Save this system as a video"
      onClose={() => !working && onClose()}
      footer={
        supported ? (
          <div className="flex flex-wrap items-center gap-2">
            {working ? (
              <Button variant="solid" onClick={stop} className="!px-4 !py-2.5 !text-sm">
                Stop
              </Button>
            ) : (
              <Button variant="solid" onClick={start} className="!px-4 !py-2.5 !text-sm">
                {status === 'done' ? 'Make it again' : 'Save the video'}
              </Button>
            )}
            <Button onClick={onClose} disabled={working} className="ml-auto">
              Done
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        )
      }
    >
      <>
        {onSwitchMode && (
          <div className="mb-6">
            <Segmented
              label="Export Format"
              value="video"
              onChange={(v) => onSwitchMode(v as 'image' | 'video')}
              options={[
                { value: 'image', label: 'Images & PDF' },
                { value: 'video', label: 'Video' },
              ]}
            />
          </div>
        )}
        {!supported ? (
          <>
            <p className="rounded-lg bg-paper p-3 text-[12px] leading-relaxed text-ink-soft">
              {VIDEO.unsupported}
            </p>
          </>
        ) : (
          <>
            <div className="mt-5">
              <Field label={VIDEO.shape}>
                <Segmented
                  label={VIDEO.shape}
                  value={shape}
                  onChange={setShape}
                  options={VIDEO_SHAPES.map((s) => ({ value: s.id, label: s.label }))}
                />
              </Field>
              <p className="-mt-1 text-[11px] leading-snug text-ink-faint">
                {VIDEO_SHAPES.find((s) => s.id === shape)?.note}
              </p>

              {/*
               * Size and rate, side by side under the shape.
               *
               * Two controls rather than a single "quality" list, because they
               * cost different things and are chosen for different reasons: the
               * size decides how sharp it is on a projector, the rate decides
               * whether a slow pan judders. A merged list of four presets would
               * hide which one a coach is actually paying for.
               */}
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-hair pt-3">
                <Field label={VIDEO.quality}>
                  <Segmented
                    label={VIDEO.quality}
                    value={quality}
                    onChange={setQuality}
                    options={VIDEO_QUALITIES.map((q) => ({ value: q.id, label: q.label }))}
                  />
                </Field>
                <Field label={VIDEO.fps}>
                  <Segmented
                    label={VIDEO.fps}
                    value={String(fps)}
                    onChange={(v) => setFps(Number(v) as VideoFps)}
                    options={VIDEO_FRAME_RATES.map((r) => ({ value: String(r), label: `${r}fps` }))}
                  />
                </Field>
              </div>
              {/*
               * What the two settings just bought, in pixels and in wait.
               *
               * The pixel count is the honest unit and the wait is the one that
               * actually decides it — the whole reason 720p is offered is that
               * this runs on the coach's own laptop, so the cost of the choice
               * has to be visible at the moment it is made rather than
               * discovered three minutes into a progress bar.
               */}
              <p className="-mt-1 text-[11px] leading-snug text-ink-faint">
                {VIDEO.size(size.w, size.h, effort)}
              </p>

              <div className="mt-4 border-t border-ink-hair pt-3">
                <PaceField system={system} onHold={onHold} onMove={onMove} onPaceMode={onPaceMode} onCommit={onPaceCommit} />
              </div>

              <div className="mt-3 border-t border-ink-hair pt-3">
                <IdentityToggle
                  unsigned={unsigned}
                  on={identity}
                  onChange={onIdentity}
                  what="this film"
                  fromDefault={identityIsDefault}
                />
              </div>

              {/* Only while there is a name for the date to sit beside. With
                  the identity off, the credit line is the neutral one and a
                  date stamped under it says nothing about anything. */}
              {identity && system.credit?.sharedOn && (
                <div className="mt-3 border-t border-ink-hair pt-2">
                  <Toggle checked={date} onChange={setDate} label={VIDEO.date} />
                </div>
              )}
            </div>

            <div className="mt-4 rounded-lg bg-paper p-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-micro uppercase text-ink-faint">
                  {working ? VIDEO.making : status === 'done' ? VIDEO.ready : 'The film'}
                </p>
                <p className="text-[11px] font-bold tabular-nums text-ink-soft">
                  {working
                    ? `${Math.round(progress * 100)}%`
                    : `${system.acts.length} phases · ${seconds.toFixed(1)}s`}
                </p>
              </div>

              {/* A track that is always there, so the box does not change
                  height the moment the render starts. */}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-hair">
                <div
                  className="h-full rounded-full bg-ink transition-[width] duration-150"
                  style={{ width: `${(working || status === 'done' ? progress : 0) * 100}%` }}
                />
              </div>

              <p className="mt-2 text-[11px] leading-snug text-ink-faint">
                {status === 'failed' ? VIDEO.failed : working ? VIDEO.slow : status === 'done' ? VIDEO.ready : VIDEO.slow}
              </p>
            </div>

            <p className="mt-4 border-t border-ink-hair pt-3 text-[11px] leading-relaxed text-ink-faint">
              {VIDEO.foot}
            </p>
          </>
        )}
      </>
    </Modal>
  )
}
