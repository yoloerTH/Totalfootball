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
import { withoutIdentity, type System } from '../schema'
import {
  DEFAULT_IMAGE_SHAPE,
  DEFAULT_IMAGE_SIZE,
  IMAGE_SHAPES,
  IMAGE_SIZES,
  imageSize,
  imagesSupported,
  resolveImageShape,
  resolveImageSize,
  resolveParts,
  saveImages,
  type ChromeParts,
  type ImageShape,
  type ImageSize,
} from '../image'
import { Button, Field, Modal, Segmented, Toggle } from './ui'
import { IdentityToggle } from './IdentityToggle'
import { EXPORT } from './guide'
import { STUDIO_EVENTS, track } from '../track'

type Status = 'idle' | 'working' | 'done' | 'failed'
type Which = 'this' | 'all'

export function ExportDialog({
  system,
  /** Which phase the coach is looking at. The default subject of "this one". */
  actIndex,
  /**
   * Whether the coach's name, club, crest and squad go on the file.
   *
   * LIFTED OUT OF THIS DIALOG rather than held here, because the PDF half of it
   * is not rendered here: printing goes through `PrintSheet`, which lives in
   * the editor's tree and is always mounted. A switch that changed the pictures
   * and not the printout would be the worst of both.
   */
  identity,
  onIdentity,
  /** True while `identity` is still the account default and not a choice. */
  identityIsDefault,
  onSaved,
  onClose,
}: {
  system: System
  actIndex: number
  identity: boolean
  onIdentity: (next: boolean) => void
  identityIsDefault: boolean
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
  /*
   * ── WHICH OF THE WORDS ───────────────────────────────────────────────────
   *
   * All on, which is what the single `chrome` switch used to mean and is still
   * what most coaches want. `chrome` stays as the master: turning it off takes
   * everything off in one press, which is the common shape of the "I am putting
   * this in my own deck" errand and should not cost four presses.
   *
   * Held as the whole record rather than four booleans so the tie between the
   * credit and our lockup can be applied in one place, by `resolveParts` — the
   * same function the renderer runs its own options through, so what the dialog
   * shows and what the PNG gets cannot disagree.
   *
   * WHAT THE COACH SET, AND WHAT THAT COMES TO, are two values and not one.
   * `asked` is every switch as they left it; `parts` is that with the watermark
   * rule applied. Folding the rule back into the state would mean taking your
   * own name off dropped our mark — correct — and putting your name back on
   * left our mark off, which nobody asked for and which reads as the dialog
   * having forgotten. Deriving instead makes the tie a view of the choice
   * rather than an edit to it.
   */
  const [asked, setAsked] = useState<ChromeParts>(() => resolveParts())
  const parts = resolveParts(asked)
  const setPart = (k: keyof ChromeParts, on: boolean) =>
    setAsked((prev) => ({ ...prev, [k]: on }))
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
      // The document is stripped BEFORE it reaches the renderer, rather than
      // the renderer being asked to leave things out. One function decides what
      // "my details" means (`withoutIdentity`) and every export asks it the
      // same question; nothing downstream has to remember the list.
      const files = await renderStills(identity ? system : withoutIdentity(system), {
        shape,
        size,
        chrome,
        parts,
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
      track(
        STUDIO_EVENTS.imagesSaved,
        `${shape}-${size}${chrome ? '' : '-bare'}${identity ? '' : '-anon'}`,
      )
      onSaved?.()
    } catch (err) {
      // Stopping is not failing, and must not be reported as if it were.
      setStatus((err as Error)?.name === 'AbortError' ? 'idle' : 'failed')
    } finally {
      abort.current = null
    }
  }, [system, identity, shape, size, chrome, parts, date, everything, actIndex, onSaved])

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

              <div className="mt-3 flex flex-col gap-3">
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

              {/* ABOVE the layout switches, because it is a different KIND of
                  question. The four below are about what a picture looks like;
                  this one is about what leaves the building with it. */}
              <div className="mt-3 border-t border-ink-hair pt-3">
                <IdentityToggle
                  on={identity}
                  onChange={onIdentity}
                  what="this picture and the printout"
                  fromDefault={identityIsDefault}
                />
              </div>

              <div className="mt-3 border-t border-ink-hair pt-3">
                <Toggle checked={chrome} onChange={setChrome} label={EXPORT.chrome} />
                <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">
                  {chrome ? EXPORT.chromeOn : EXPORT.chromeOff}
                </p>
              </div>

              {/*
                ── AND WHICH OF THEM ──────────────────────────────────────────
                Indented under the master and only there when it is on, so the
                dialog reads as one question with a follow-up rather than five
                switches of equal weight. Nothing here is reachable while the
                words are off, which is why they are hidden and not greyed: four
                dead rows would make the "no words" answer look like the broken
                one.
              */}
              {chrome && (
                <div className="mt-2 space-y-2 border-l-2 border-ink-hair pl-3">
                  <Part
                    on={parts.head}
                    onChange={(v) => setPart('head', v)}
                    label={EXPORT.partHead}
                    note={EXPORT.partHeadNote}
                  />
                  <Part
                    on={parts.words}
                    onChange={(v) => setPart('words', v)}
                    label={EXPORT.partWords}
                    note={EXPORT.partWordsNote}
                  />
                  <Part
                    on={parts.credit}
                    onChange={(v) => setPart('credit', v)}
                    label={EXPORT.partCredit}
                    note={EXPORT.partCreditNote}
                  />
                  <Part
                    on={parts.lockup}
                    onChange={(v) => setPart('lockup', v)}
                    disabled={!parts.credit}
                    label={EXPORT.partLockup}
                    note={parts.credit ? EXPORT.partLockupNote : EXPORT.partLockupTied}
                  />

                  {/* Only when there is a date to show, and only when the line
                      it lives IN is going on. */}
                  {parts.credit && system.credit?.sharedOn && (
                    <div className="border-t border-ink-hair pt-2">
                      <Toggle checked={date} onChange={setDate} label={EXPORT.date} />
                    </div>
                  )}
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

/**
 * One switch and the line that says what it puts on the picture.
 *
 * `disabled` greys rather than hides, and it is the one place in this dialog
 * that greys: the coach has not made a mistake, they have made a choice with a
 * consequence, and the consequence is worth being able to read. The note under
 * it changes to say so.
 */
function Part({
  on,
  onChange,
  label,
  note,
  disabled = false,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
  note: string
  disabled?: boolean
}) {
  return (
    <div>
      <Toggle checked={on} onChange={onChange} label={label} disabled={disabled} />
      <p className={`mt-0.5 text-[11px] leading-snug text-ink-faint ${disabled ? 'opacity-70' : ''}`}>
        {note}
      </p>
    </div>
  )
}
