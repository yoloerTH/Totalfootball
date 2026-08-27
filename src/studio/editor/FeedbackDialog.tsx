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
import { Mark } from '../viewer/Mark'

/**
 * A numbered section head.
 *
 * The three questions were three lines of small bold grey, which is how a form
 * looks and not how anything else in this product looks. Everywhere else on the
 * site a section opens with micro caps and a rule; the numbers are doing a
 * second job on top of that, which is to say out loud that there are exactly
 * three of these and where you are in them. A dialog that shows its own length
 * is one people finish.
 */
function Ask({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-ink-hair pt-4">
      <p className="flex items-baseline gap-2 text-micro uppercase text-ink-faint">
        <span className="font-black text-gold-deep">{String(n).padStart(2, '0')}</span>
        <span>{label}</span>
      </p>
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

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
            /*
             * The chosen number in GOLD rather than in ink.
             *
             * Every other selected control in the studio is ink-on-paper,
             * because they are all settings and a board full of gold would mean
             * nothing. This is not a setting, it is the one answer we asked for,
             * and it is the only place in the tool where the brand's own colour
             * is used to say "you have told us something".
             */
            className={`h-8 w-8 rounded-md text-[12px] font-bold tabular-nums transition-all ${
              value === n
                ? 'bg-gold text-ink shadow-paper'
                : 'bg-paper text-ink-soft hover:bg-ink-hair hover:text-ink'
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
      className="fixed inset-0 z-[80] flex justify-center overflow-y-auto overscroll-contain bg-ink/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={FEEDBACK.title}
      onPointerDown={(e) => e.target === e.currentTarget && !sent && onClose(false)}
    >
      <div className="my-auto w-full max-w-md overflow-hidden rounded-2xl border border-ink-hair bg-surface shadow-lift">
        {/*
         * THE BAR AT THE TOP is the whole reason this now looks like ours.
         *
         * The dialog used to open on a bold sentence, which is what a form
         * looks like anywhere. The gradient is the site's own — the same one
         * behind every section rule on the marketing pages — and it does one
         * useful thing beyond decoration: it says, before a word is read, that
         * this is the tool talking and not a survey widget bolted onto it. That
         * is exactly the doubt that stops somebody answering honestly.
         */}
        <div className="h-1 w-full bg-tf-gradient" />

        <div className="p-6">
          {sent ? (
            // The thanks. Given room rather than squeezed into the space the
            // form left behind: it is on screen for 1.4 seconds and it is the
            // last thing they see of this, so it gets the mark and the rule and
            // reads as a sign-off instead of as a toast.
            <div className="flex flex-col items-center py-8 text-center">
              <Mark size={38} />
              <div className="mt-4 h-[3px] w-8 rounded-full bg-gold" />
              <p className="mt-4 text-lg font-black tracking-display text-ink">{FEEDBACK.thanks}</p>
            </div>
          ) : (
            <>
              <header className="flex items-start gap-3.5">
                <div className="shrink-0 pt-0.5">
                  <Mark size={30} />
                </div>
                <div className="min-w-0">
                  <p className="text-micro uppercase text-ink-faint">The studio</p>
                  <h2 className="mt-1 text-xl font-black leading-tight tracking-display text-ink">
                    {FEEDBACK.title}
                  </h2>
                </div>
              </header>
              <p className="mt-2.5 text-[12px] leading-relaxed text-ink-soft">{FEEDBACK.body}</p>

              <div className="mt-5 space-y-4">
                <Ask n={1} label={FEEDBACK.rating}>
                  <StarRating value={rating} onChange={setRating} />
                </Ask>

                <Ask n={2} label={FEEDBACK.recommend}>
                  <Recommend value={recommend} onChange={setRecommend} />
                </Ask>

                <Ask n={3} label={FEEDBACK.note}>
                  <TextArea value={note} onChange={setNote} placeholder={FEEDBACK.notePlaceholder} rows={3} />
                </Ask>
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
    </div>
  )
}
