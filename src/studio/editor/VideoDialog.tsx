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
import type { System } from '../schema'
import { VIDEO_SHAPES, saveVideo, videoSeconds, videoSupported, type VideoShape } from '../video'
import { Button, Field, Segmented, Toggle } from './ui'
import { PaceField } from './PaceField'
import { VIDEO } from './guide'
import { STUDIO_EVENTS, track } from '../track'

type Status = 'idle' | 'working' | 'done' | 'failed'

export function VideoDialog({
  system,
  onHold,
  onHoldCommit,
  onClose,
}: {
  system: System
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
  onHoldCommit: () => void
  onClose: () => void
}) {
  const [shape, setShape] = useState<VideoShape['id']>('landscape')
  // Off by default, and only offered when there is one to show — see the note
  // on `VideoOptions.date`. A file outlives the day it was made.
  const [date, setDate] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const abort = useRef<AbortController | null>(null)

  const supported = videoSupported()
  const seconds = videoSeconds(system)

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
      const file = await renderVideo(system, {
        shape,
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
      track(STUDIO_EVENTS.videoSaved, shape)
    } catch (err) {
      // Stopping is not failing, and must not be reported as if it were.
      setStatus((err as Error)?.name === 'AbortError' ? 'idle' : 'failed')
    } finally {
      abort.current = null
    }
  }, [system, shape, date])

  const stop = useCallback(() => {
    abort.current?.abort()
    setStatus('idle')
    setProgress(0)
  }, [])

  const working = status === 'working'

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-ink/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Save this system as a video"
      onPointerDown={(e) => e.target === e.currentTarget && !working && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-ink-hair bg-surface p-6 shadow-lift">
        <h2 className="text-xl font-black tracking-display text-ink">{VIDEO.title}</h2>
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{VIDEO.body}</p>

        {!supported ? (
          <>
            <p className="mt-5 rounded-lg bg-paper p-3 text-[12px] leading-relaxed text-ink-soft">
              {VIDEO.unsupported}
            </p>
            <div className="mt-4 flex justify-end">
              <Button onClick={onClose}>Close</Button>
            </div>
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

              <div className="mt-4 border-t border-ink-hair pt-3">
                <PaceField system={system} onChange={onHold} onCommit={onHoldCommit} />
              </div>

              {system.credit?.sharedOn && (
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

            <div className="mt-4 flex flex-wrap items-center gap-2">
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

            <p className="mt-4 border-t border-ink-hair pt-3 text-[11px] leading-relaxed text-ink-faint">
              {VIDEO.foot}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
