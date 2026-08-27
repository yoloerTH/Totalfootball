/**
 * Images and paper: the two exports that are not a link and not a film.
 *
 * ── WHY ONE DIALOG AND NOT TWO ──────────────────────────────────────────────
 *
 * A PNG and a PDF are different files with nothing technical in common — one
 * rasterises through a canvas, the other is the browser's own print — but they
 * answer the identical question, which is "give me this as a file I can put in
 * something else". A coach reaching for either is standing in the same place
 * with the same errand. Splitting them would also have meant two more buttons
 * on a top bar already carrying six tool names, a Play, a Share and a Video.
 *
 * ── WHY THE PDF IS A BUTTON THAT OPENS THE BROWSER'S PRINT ──────────────────
 *
 * Because that IS the export. The whole system is already in the page as live
 * SVG (../viewer/PrintSheet.tsx) and the browser writes a better PDF from it
 * than any library we could ship — vector boards, real Inter, correct page
 * breaks. What was missing was never the machinery; it was that from the studio
 * you had to publish your system and open your own share link to reach it
 * (user, 2026-08-27). This is that door, and Cmd-P is still the other one.
 *
 * ── AND WHY THE IMAGE HALF IS SHAPED LIKE THE VIDEO DIALOG ──────────────────
 *
 * Same controls, same order, same words: shape, size, what goes on it. A coach
 * who has made a film once has already learnt this dialog. The one thing it
 * adds is WHICH PHASES, because a still is of one moment and a film is of all
 * of them, and "just this one" is the common case — a coach exporting a picture
 * is usually exporting the phase they are looking at.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { System } from '../schema'
import {
  DEFAULT_IMAGE_SHAPE,
  DEFAULT_IMAGE_SIZE,
  IMAGE_SHAPES,
  IMAGE_SIZES,
  imageSize,
  imagesSupported,
  resolveImageShape,
  resolveImageSize,
  saveImages,
  type ImageShape,
  type ImageSize,
} from '../image'
import { Button, Field, Modal, Segmented, Toggle } from './ui'
import { EXPORT } from './guide'
import { STUDIO_EVENTS, track } from '../track'

type Status = 'idle' | 'working' | 'done' | 'failed'
type Which = 'this' | 'all'

export function ExportDialog({
  system,
  /** Which phase the coach is looking at. The default subject of "this one". */
  actIndex,
  onSaved,
  onClose,
}: {
  system: System
  actIndex: number
  /** A file was actually written. Not "Save was pressed" — see `start`. */
  onSaved?: () => void
  onClose: () => void
}) {
  const [shape, setShape] = useState<ImageShape['id']>(DEFAULT_IMAGE_SHAPE)
  const [size, setSize] = useState<ImageSize['id']>(DEFAULT_IMAGE_SIZE)
  /*
   * Defaults to the phase on screen, and only offers "all" when there is more
   * than one. A segmented control with one meaningful option is furniture.
   */
  const [which, setWhich] = useState<Which>('this')
  const [chrome, setChrome] = useState(true)
  const [date, setDate] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [saved, setSaved] = useState(0)
  const abort = useRef<AbortController | null>(null)

  const supported = imagesSupported()
  const multi = system.acts.length > 1
  /*
   * `undefined` means every phase — see `ImageOptions.phases`. Derived rather
   * than held in state so the two controls cannot disagree, and worked out
   * inside `start` as well as here so the callback does not take a fresh array
   * as a dependency and rebuild itself on every render.
   */
  const everything = which === 'all' && multi
  const count = everything ? system.acts.length : 1
  const px = imageSize(resolveImageShape(shape), resolveImageSize(size))

  // Escape closes, except mid-render — the same bargain the video dialog is on.
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
    setSaved(0)
    try {
      // React's second renderer, fetched now rather than on page load. It is
      // the same module the film comes out of, so a coach who has already made
      // a video pays nothing for this at all. See ../videoRender.ts.
      const { renderStills } = await import('../videoRender')
      const files = await renderStills(system, {
        shape,
        size,
        chrome,
        date,
        phases: everything ? undefined : [actIndex],
        signal: controller.signal,
        onProgress: setProgress,
      })
      if (controller.signal.aborted) return
      await saveImages(files)
      if (controller.signal.aborted) return
      setSaved(files.length)
      setStatus('done')
      // Counted where the files are actually written. Shape and size together,
      // because the question worth answering is which combination coaches reach
      // for — and a count that cannot tell a square from a story answers none
      // of it. `printed` covers the other half of this dialog.
      track(STUDIO_EVENTS.imagesSaved, `${shape}-${size}${chrome ? '' : '-bare'}`)
      onSaved?.()
    } catch (err) {
      // Stopping is not failing, and must not be reported as if it were.
      setStatus((err as Error)?.name === 'AbortError' ? 'idle' : 'failed')
    } finally {
      abort.current = null
    }
  }, [system, shape, size, chrome, date, everything, actIndex, onSaved])

  const stop = useCallback(() => {
    abort.current?.abort()
    setStatus('idle')
    setProgress(0)
  }, [])

  const working = status === 'working'

  /* On `Modal` for the reason set out in ./VideoDialog.tsx: this dialog is two
     whole sections tall and was losing its heading off the top and Done off the
     bottom of a card nothing capped. */
  return (
    <Modal
      title={EXPORT.title}
      subtitle={EXPORT.body}
      label="Save this system as images or a PDF"
      onClose={() => !working && onClose()}
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose} disabled={working}>
            Done
          </Button>
        </div>
      }
    >
      <>
        {/* ── images ── */}
        <h3 className="text-micro uppercase tracking-micro text-ink-faint">{EXPORT.imagesTitle}</h3>
        <p className="mt-1 text-[11px] leading-snug text-ink-faint">{EXPORT.imagesBody}</p>

        {!supported ? (
          <p className="mt-3 rounded-lg bg-paper p-3 text-[12px] leading-relaxed text-ink-soft">
            {EXPORT.unsupported}
          </p>
        ) : (
          <>
            <div className="mt-3">
              <Field label={EXPORT.shape}>
                <Segmented
                  label={EXPORT.shape}
                  value={shape}
                  onChange={setShape}
                  options={IMAGE_SHAPES.map((s) => ({ value: s.id, label: s.label }))}
                />
              </Field>
              <p className="-mt-1 text-[11px] leading-snug text-ink-faint">
                {IMAGE_SHAPES.find((s) => s.id === shape)?.note}
              </p>

              <div className={`mt-3 grid gap-3 ${multi ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <Field label={EXPORT.size}>
                  <Segmented
                    label={EXPORT.size}
                    value={size}
                    onChange={setSize}
                    options={IMAGE_SIZES.map((q) => ({ value: q.id, label: q.label }))}
                  />
                </Field>
                {multi && (
                  <Field label={EXPORT.which}>
                    <Segmented
                      label={EXPORT.which}
                      value={which}
                      onChange={setWhich}
                      options={[
                        { value: 'this', label: `This one` },
                        { value: 'all', label: `All ${system.acts.length}` },
                      ]}
                    />
                  </Field>
                )}
              </div>
              <p className="-mt-1 text-[11px] leading-snug text-ink-faint">
                {px.w} × {px.h}. {IMAGE_SIZES.find((q) => q.id === size)?.note}
              </p>

              <div className="mt-3 border-t border-ink-hair pt-3">
                <Toggle checked={chrome} onChange={setChrome} label={EXPORT.chrome} />
                <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">
                  {chrome ? EXPORT.chromeOn : EXPORT.chromeOff}
                </p>
              </div>

              {/* Only when there is a date to show, and only when the words are
                  going on at all — it lives IN the credit line. */}
              {chrome && system.credit?.sharedOn && (
                <div className="mt-3 border-t border-ink-hair pt-2">
                  <Toggle checked={date} onChange={setDate} label={EXPORT.date} />
                </div>
              )}
            </div>

            <div className="mt-4 rounded-lg bg-paper p-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-micro uppercase text-ink-faint">
                  {working ? EXPORT.making : status === 'done' ? 'Saved' : 'The pictures'}
                </p>
                <p className="text-[11px] font-bold tabular-nums text-ink-soft">
                  {working
                    ? `${Math.round(progress * 100)}%`
                    : `${count} ${count === 1 ? 'image' : 'images'}`}
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-hair">
                <div
                  className="h-full rounded-full bg-ink transition-[width] duration-150"
                  style={{ width: `${(working || status === 'done' ? progress : 0) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] leading-snug text-ink-faint">
                {status === 'failed'
                  ? EXPORT.failed
                  : status === 'done'
                    ? EXPORT.ready(saved)
                    : count > 1
                      ? EXPORT.saving
                      : EXPORT.imagesBody}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {working ? (
                <Button variant="solid" onClick={stop} className="!px-4 !py-2.5 !text-sm">
                  Stop
                </Button>
              ) : (
                <Button variant="solid" onClick={start} className="!px-4 !py-2.5 !text-sm">
                  {status === 'done'
                    ? 'Save them again'
                    : count === 1
                      ? 'Save the image'
                      : `Save ${count} images`}
                </Button>
              )}
            </div>
          </>
        )}

        {/* ── paper ── */}
        <h3 className="mt-5 border-t border-ink-hair pt-4 text-micro uppercase tracking-micro text-ink-faint">
          {EXPORT.pdfTitle}
        </h3>
        <p className="mt-1 text-[11px] leading-snug text-ink-faint">{EXPORT.pdfBody}</p>
        <div className="mt-3">
          <Button
            onClick={() => {
              // Recorded BEFORE the call, because print() blocks the thread
              // until the coach has dealt with the browser's own dialog.
              track(STUDIO_EVENTS.printed)
              window.print()
            }}
            disabled={working}
          >
            {EXPORT.pdfButton}
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-ink-faint">{EXPORT.pdfNote}</p>
      </>
    </Modal>
  )
}
