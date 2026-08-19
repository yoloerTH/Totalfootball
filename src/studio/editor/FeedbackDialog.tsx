/**
 * The one question we ask a coach.
 *
 * WHY THIS ONE IS A MODAL WHEN WHAT'S NEW IS NOT
 *
 * They look like the same kind of thing — something that opens by itself — and
 * they are not. What's New is us talking, so it has to be cheap to ignore. This
 * is us asking, and an ask that can be scrolled past is an ask nobody answers.
 * It is also shown at the one moment a coach is not mid-anything: a share link
 * has just been published or a film has just finished writing, and the dialog
 * they were using has closed. Nothing is interrupted, because nothing was
 * happening.
 *
 * WHY NOTHING IS REQUIRED
 *
 * Three inputs, none of them mandatory, and Send is live from the first touch.
 * A coach who opened this to report one broken thing must not have to score us
 * out of five first — that is how you turn a bug report into a dismissal. The
 * endpoint rejects a row that says nothing at all, which is the only floor.
 *
 * WHY THE STARS ARE A SLIDER
 *
 * Five stars with half steps is eleven values, and eleven radio buttons is a
 * worse control by every measure — it cannot be dragged, it reads as a wall of
 * boxes to a screen reader, and it takes ten tab stops to get past. `role
 * ="slider"` is what the thing actually is: one value, on a range, with arrow
 * keys. The stars are the picture of it.
 */

import { useCallback, useEffect, useState } from 'react'
import { FEEDBACK } from './guide'
import { Button, TextArea } from './ui'
import { sendFeedback, type FeedbackContext } from '../feedback'

const STAR = 'M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95z'

function Star({ fill }: { fill: number }) {
  const shape = (color: string, stroke: string) => (
    <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden="true">
      <path d={STAR} fill={color} stroke={stroke} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  )
  return (
    <span className="relative inline-flex">
      {shape('transparent', 'currentColor')}
      {/*
       * The filled star on top, in a box clipped to the fraction. A CSS clip
       * rather than an SVG one so there is no <defs> id to make unique — this
       * dialog can be open while the board below it is drawing forty of its own.
       */}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ width: `${fill * 100}%` }}
      >
        <span className="block w-7">{shape('#E6B23A', '#C9902B')}</span>
      </span>
    </span>
  )
}

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  // What the pointer is over, so the row previews the score before it is set.
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value ?? 0

  const nudge = (by: number) => onChange(Math.min(5, Math.max(0, (value ?? 0) + by)))

  return (
    <div className="flex items-center gap-2.5">
      <div
        role="slider"
        tabIndex={0}
        aria-label={FEEDBACK.rating}
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value ?? 0}
        aria-valuetext={value === null ? 'not answered' : `${value} out of 5`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(0.5)
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-0.5)
          else if (e.key === 'Home') onChange(0)
          else if (e.key === 'End') onChange(5)
          else return
          e.preventDefault()
        }}
        onPointerLeave={() => setHover(null)}
        className="flex text-ink-hair outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="relative">
            <Star fill={Math.min(1, Math.max(0, shown - i))} />
            {/* Two halves per star, so half a star is a place you can aim at
                rather than a pixel you have to find. */}
            {[0.5, 1].map((half) => (
              <button
                key={half}
                type="button"
                tabIndex={-1}
                aria-label={`${i + half} out of 5`}
                onPointerEnter={() => setHover(i + half)}
                onClick={() => onChange(i + half)}
                className="absolute top-0 h-full w-1/2"
                style={{ left: half === 0.5 ? 0 : '50%' }}
              />
            ))}
          </span>
        ))}
      </div>
      <span className="text-[13px] font-bold tabular-nums text-ink-soft">
        {value === null ? FEEDBACK.ratingHint : `${value.toFixed(1)} / 5`}
      </span>
    </div>
  )
}

function Recommend({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={FEEDBACK.recommend}>
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={`h-8 w-8 rounded-md text-[12px] font-bold tabular-nums transition-colors ${
              value === n ? 'bg-ink text-paper' : 'bg-paper text-ink-soft hover:bg-ink-hair hover:text-ink'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-bold uppercase tracking-wide text-ink-faint">
        <span>{FEEDBACK.recommendLow}</span>
        <span>{FEEDBACK.recommendHigh}</span>
      </div>
    </div>
  )
}

interface Props {
  context: FeedbackContext
  /** Called with `true` when they sent something, `false` when they did not. */
  onClose: (sent: boolean) => void
}

export function FeedbackDialog({ context, onClose }: Props) {
  const [rating, setRating] = useState<number | null>(null)
  const [recommend, setRecommend] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)

  const answered = rating !== null || recommend !== null || note.trim().length > 0

  const send = useCallback(async () => {
    if (!answered) return
    setSent(true)
    // Not awaited before the thanks appears. The coach has done their part and
    // should not watch a spinner for ours; `sendFeedback` never rejects and the
    // reply changes nothing they can see. See its own note.
    void sendFeedback({ rating, recommend, note, context })
    setTimeout(() => onClose(true), 1400)
  }, [answered, rating, recommend, note, context, onClose])

  // Escape is "not now". It must not count as an answer.
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && !sent && onClose(false)
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose, sent])

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-ink/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={FEEDBACK.title}
      onPointerDown={(e) => e.target === e.currentTarget && !sent && onClose(false)}
    >
      <div className="w-full max-w-md rounded-2xl border border-ink-hair bg-surface p-6 shadow-lift">
        {sent ? (
          <p className="py-6 text-center text-[15px] font-bold text-ink">{FEEDBACK.thanks}</p>
        ) : (
          <>
            <h2 className="text-xl font-black tracking-display text-ink">{FEEDBACK.title}</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{FEEDBACK.body}</p>

            <div className="mt-5">
              <p className="mb-2 text-[11px] font-bold text-ink-soft">{FEEDBACK.rating}</p>
              <StarRating value={rating} onChange={setRating} />
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[11px] font-bold text-ink-soft">{FEEDBACK.recommend}</p>
              <Recommend value={recommend} onChange={setRecommend} />
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[11px] font-bold text-ink-soft">{FEEDBACK.note}</p>
              <TextArea value={note} onChange={setNote} placeholder={FEEDBACK.notePlaceholder} rows={3} />
            </div>

            <div className="mt-5 flex items-center gap-2">
              <Button variant="solid" onClick={send} disabled={!answered} className="!px-4 !py-2.5 !text-sm">
                {FEEDBACK.send}
              </Button>
              <Button onClick={() => onClose(false)} className="ml-auto">
                {FEEDBACK.later}
              </Button>
            </div>

            <p className="mt-4 border-t border-ink-hair pt-3 text-[11px] leading-relaxed text-ink-faint">
              {FEEDBACK.foot}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
