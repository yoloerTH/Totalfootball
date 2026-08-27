/**
 * The studio's chrome primitives.
 *
 * These follow the SITE's theme tokens (paper/surface/ink from
 * src/styles/global.css), which is the whole point of the split decided at the
 * start: the panels follow the room the coach is working in, the board follows
 * the document. So nothing in this file may hardcode a neutral — use the
 * tokens, and every theme comes for free.
 *
 * `SurfacePicker` is the one place that draws in board colours rather than
 * chrome ones, and it has to: it is a picture OF a board.
 */

import { useEffect, useState } from 'react'
import type React from 'react'
import type { BoardPalette } from '../board/surfaces'
import { readSections, writeSection } from '../storage'

/**
 * A drawer in the left rail.
 *
 * ── WHY THE PANELS NEEDED GROUPING AT ALL ────────────────────────────────────
 *
 * There are fourteen of them. Flat, in one column, that is a rail a coach
 * SCROLLS to find the pitch surface, and scrolling past twelve headings is how
 * a control stops being found at all — which is what happened to the writing
 * and to half the camera (user, 2026-08-27). Four named sections, each of which
 * can be shut, turns fourteen things to read into four things to choose
 * between.
 *
 * ── WHY EACH ONE IS INDEPENDENT ──────────────────────────────────────────────
 *
 * Not an accordion where opening one shuts the last. A coach setting up a
 * session has the board section and the equipment section open at once on
 * purpose, and a rail that closes the thing you were just using because you
 * touched something else is a rail that is fighting you. Anything may be open;
 * anything may be shut.
 *
 * ── AND WHY IT IS REMEMBERED ─────────────────────────────────────────────────
 *
 * In `localStorage`, per section, keyed by name. A coach who works with
 * Equipment open and Camera shut wants that on Tuesday as well, and re-shutting
 * four drawers on every page load is a tax on the person who bothered to tidy.
 * It fails soft in a private window, where reading it throws: the defaults are
 * good, and a rail that refuses to render because a browser will not remember a
 * boolean is worse than a rail that forgets.
 *
 * The key itself moved to ../storage.ts, which is where every studio key now
 * lives so that every one of them gets namespaced by account. This module used
 * to hold its own `tf.studio.sections`, and a second account signing in on the
 * same browser inherited the first one's open drawers along with everything
 * else (user, 2026-08-27). See ../scope.ts.
 */

export function Section({
  title,
  hint,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string
  /** One line under the heading, read before the drawer is opened. */
  hint?: string
  defaultOpen?: boolean
  /** A count or a word on the right of the heading: "4 pieces", "On". */
  badge?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  // After mount, never during: `localStorage` does not exist while Astro is
  // rendering this on the server, and a first paint that disagreed with the
  // stored state would flash every drawer open before shutting them.
  useEffect(() => {
    const stored = readSections()[title]
    if (typeof stored === 'boolean') setOpen(stored)
  }, [title])

  const toggle = () => {
    const next = !open
    setOpen(next)
    writeSection(title, next)
  }

  return (
    <section className="border-b border-ink-hair">
      <h2>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          /* Tinted, so a DRAWER heading and the PANEL headings inside it are
             not two weights of the same thing. Without it the rail reads as
             one long list of labels again, which is the problem the drawers
             were opened to solve. */
          className={`flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-paper ${
            open ? 'bg-paper/70' : ''
          }`}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-black uppercase tracking-[0.09em] text-ink">
              {title}
            </span>
            {hint && !open && (
              <span className="mt-0.5 block truncate text-[11px] leading-snug text-ink-faint">{hint}</span>
            )}
          </span>
          {badge && (
            <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold text-ink-soft">
              {badge}
            </span>
          )}
          {/* A chevron drawn rather than a character: ▸ and ▾ are different
              widths in Inter, so the heading shifted by a pixel on every open. */}
          <svg
            viewBox="0 0 16 16"
            className={`h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform duration-200 ${
              open ? 'rotate-90' : ''
            }`}
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
      </h2>
      {/* Unmounted rather than hidden. These panels hold live pickers and
          sliders, and a shut drawer must not keep a focusable control in the
          tab order where nobody can see it. */}
      {open && <div className="pb-1">{children}</div>}
    </section>
  )
}

export function Panel({
  title,
  children,
  className = '',
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`border-b border-ink-hair px-4 py-4 last:border-b-0 ${className}`}>
      {title && <h3 className="mb-3 text-micro uppercase text-ink-faint">{title}</h3>}
      {children}
    </section>
  )
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  active = false,
  title,
  disabled = false,
  className = '',
  'aria-label': ariaLabel,
  'aria-haspopup': ariaHasPopup,
  'aria-expanded': ariaExpanded,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'ghost' | 'solid' | 'danger'
  active?: boolean
  /**
   * Native tooltip. Mostly unused now — the studio's hints go through
   * ./Tip.tsx, which shows on focus and on touch and can be read at a glance.
   * Kept for buttons whose label is already the whole explanation.
   */
  title?: string
  disabled?: boolean
  className?: string
  /** Needed by the icon-only buttons, whose label is an arrow or a question mark. */
  'aria-label'?: string
  /** For the buttons that open a menu rather than doing something. */
  'aria-haspopup'?: 'menu'
  'aria-expanded'?: boolean
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 disabled:pointer-events-none'
  const look =
    variant === 'solid'
      ? 'bg-ink text-paper hover:bg-ink/85'
      : variant === 'danger'
        ? 'text-ink-soft hover:bg-ink-hair hover:text-[#E2473B]'
        : active
          ? 'bg-ink-hair text-ink'
          : 'text-ink-soft hover:bg-ink-hair hover:text-ink'
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${look} ${className}`}
    >
      {children}
    </button>
  )
}

/**
 * A button that asks first.
 *
 * For the two actions that throw work away in one press — starting over, and
 * clearing every player off a phase. A confirm dialog is the usual answer and
 * it is the wrong one here: it is a second window to read, it lands in the
 * middle of the screen away from the thing it is about, and coaches dismiss it
 * without reading exactly like everyone else does. Turning the button itself
 * into the question keeps the answer where the question was asked.
 *
 * It resets after a few seconds, so a half-pressed Start over does not sit there
 * armed for the rest of the session waiting to be brushed.
 */
export function ConfirmButton({
  children,
  confirm,
  onConfirm,
  variant = 'danger',
  disabled = false,
  className = '',
}: {
  children: React.ReactNode
  /** The armed label. Says what will happen, not "Are you sure?". */
  confirm: string
  onConfirm: () => void
  variant?: 'ghost' | 'solid' | 'danger'
  disabled?: boolean
  className?: string
}) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <Button
      variant={armed ? 'solid' : variant}
      disabled={disabled}
      className={className}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else {
          setArmed(true)
        }
      }}
    >
      {armed ? confirm : children}
    </Button>
  )
}

/**
 * A row of mutually exclusive tabs. Used on small screens, where the two side
 * panels cannot both be beside the board and become one panel with a switch.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: Option<T>[]
  label: string
}) {
  return (
    /*
     * `min-w-0` on the buttons and `whitespace-nowrap` on the label.
     *
     * Without the first, `flex-1` will not shrink a button below the width of
     * its own word, so a three-option control in a 256px panel — Left · Centre ·
     * Right — pushed itself wider than the panel and the last option wrapped
     * out from under the other two (user, 2026-08-27). Without the second, they
     * shrink by breaking the words instead, which is not better.
     *
     * And `overflow-hidden text-ellipsis` because the pair above is not enough
     * on its own: a button narrower than its label lets the label hang out over
     * its neighbour, so Regular · Bold · Heavy in half a column came out as one
     * unreadable overlap rather than as three cramped buttons. Truncating is
     * the honest failure — you can see at a glance that the control has been
     * given too little room, which is the cue to lay it out down the panel
     * rather than across it. There is no arrangement of CSS that fits three
     * words into 116 points, and this is what asking for one looks like.
     */
    <div className="flex gap-1 rounded-lg bg-paper p-1" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-md px-1.5 py-1.5 text-xs font-bold transition-colors ${
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A labelled row. Keeps every control in the panels on the same rhythm. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-[11px] font-bold text-ink-soft">{label}</span>
      {children}
    </label>
  )
}

const INPUT =
  'w-full rounded-md border border-ink-hair bg-paper px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-ink-faint'

export function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT}
    />
  )
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${INPUT} resize-none leading-snug`}
    />
  )
}

export interface Option<T extends string> {
  value: T
  label: string
}

/**
 * A select, optionally grouped.
 *
 * Grouping is not decoration on the formation picker: there are 24 shapes now,
 * and a flat list of 24 is a wall. "Four at the back / Three at the back / Five
 * at the back / From the archive / Start from scratch" is how a coach narrows
 * it down before they read a single name.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  groups,
  id,
}: {
  value: T
  onChange: (v: T) => void
  options?: Option<T>[]
  groups?: { label: string; options: Option<T>[] }[]
  id?: string
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={INPUT}
    >
      {groups
        ? groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))
        : options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
    </select>
  )
}

/**
 * A row of picture buttons — used for the match ball.
 *
 * A dropdown is the wrong control for this. Nobody knows which World Cup ball
 * is which by name, and everybody recognises them on sight.
 */
export function PicturePicker<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T
  onChange: (v: T) => void
  items: { value: T; label: string; src: string | null }[]
  label: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="radio"
          aria-checked={value === it.value}
          aria-label={it.label}
          onClick={() => onChange(it.value)}
          className={`flex h-11 w-11 items-center justify-center rounded-lg border-2 bg-paper p-1 transition ${
            value === it.value ? 'border-gold' : 'border-ink-hair hover:border-ink-faint'
          }`}
        >
          {it.src ? (
            <img src={it.src} alt="" className="h-full w-full object-contain" />
          ) : (
            // The drawn ball, at button scale — the same five-pentagon
            // suggestion Token.tsx falls back to.
            <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden="true">
              <circle cx="16" cy="16" r="13" fill="#F4F4F0" stroke="#161618" strokeWidth="2" />
              <circle cx="16" cy="16" r="4" fill="#161618" />
              {[0, 72, 144, 216, 288].map((d) => {
                const r = ((d - 90) * Math.PI) / 180
                return (
                  <circle
                    key={d}
                    cx={16 + Math.cos(r) * 8.2}
                    cy={16 + Math.sin(r) * 8.2}
                    r="2.3"
                    fill="#161618"
                  />
                )
              })}
            </svg>
          )}
        </button>
      ))}
    </div>
  )
}

/**
 * A row of miniature pitches — used for the pitch surface.
 *
 * The same control as the match ball's, for the same reason: nobody picks a
 * ground by its name, everybody picks it on sight. Each swatch is a real pitch
 * drawn in that surface's own palette — its grass, its mow, its line colour —
 * rather than a flat colour chip, because "Night" and "Chalk" are both dark and
 * a coach choosing between two dark squares is guessing. A halfway line and a
 * centre circle are enough to make each one obviously a pitch.
 */
export function SurfacePicker<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T
  onChange: (v: T) => void
  items: { value: T; label: string; palette: BoardPalette }[]
  label: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {items.map((it) => {
        const p = it.palette
        const grass = p.grass ? p.grass[0] : p.stage[1]
        const grassDeep = p.grass ? p.grass[1] : p.stage[2]
        return (
          <button
            key={it.value}
            type="button"
            role="radio"
            aria-checked={value === it.value}
            aria-label={it.label}
            title={it.label}
            onClick={() => onChange(it.value)}
            className={`h-11 w-[3.4rem] overflow-hidden rounded-lg border-2 transition ${
              value === it.value ? 'border-gold' : 'border-ink-hair hover:border-ink-faint'
            }`}
          >
            <svg viewBox="0 0 68 44" className="h-full w-full" aria-hidden="true">
              <defs>
                <linearGradient id={`sw-${it.value}`} x1="0" y1="0" x2="0.3" y2="1">
                  <stop offset="0%" stopColor={grass} />
                  <stop offset="100%" stopColor={grassDeep} />
                </linearGradient>
              </defs>
              <rect width="68" height="44" fill={`url(#sw-${it.value})`} />
              {p.mow.kind === 'stripe' && (
                <g fill={p.mow.color} fillOpacity={p.mow.alpha * 2.2}>
                  {[0, 2, 4].map((i) => (
                    <rect key={i} x={i * 11.4} y="0" width="11.4" height="44" />
                  ))}
                </g>
              )}
              <g fill="none" stroke={p.line} strokeWidth="1.1">
                <rect x="3.5" y="3.5" width="61" height="37" />
                <line x1="34" y1="3.5" x2="34" y2="40.5" />
                <circle cx="34" cy="22" r="7" />
              </g>
            </svg>
          </button>
        )
      })}
    </div>
  )
}

/**
 * A colour well. Deliberately a native colour input rather than a custom
 * picker: a coach entering their club's hex from a brand guide is the common
 * case, and every OS picker already supports that.
 */
export function ColorWell({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2.5">
      <span
        className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-ink-hair"
        style={{ background: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />
      </span>
      <span className="text-xs text-ink-soft">{label}</span>
      <code className="ml-auto text-[11px] uppercase text-ink-faint">{value}</code>
    </label>
  )
}

/**
 * A slider, for the one setting that is a quantity rather than a choice.
 *
 * Native `input[type=range]`, not a custom track. It is the only control here a
 * coach might reach for on a touchscreen mid-drag, and the platform's own is
 * the one with the right thumb size, the right keyboard behaviour and the right
 * accessible name already attached.
 *
 * `onCommit` is separate from `onChange` because a drag fires change on every
 * pixel. The caller wants all of those in the document as they happen — the
 * number beside the slider has to move — and exactly one of them in the undo
 * stack. See `seal` in ./history.ts.
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  label,
  readout,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  /** Fired when the drag lands. */
  onCommit?: () => void
  label: string
  /** What the current value says, in the coach's units. */
  readout: string
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-bold text-ink-soft">{label}</span>
        <span className="text-[11px] font-bold tabular-nums text-ink">{readout}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-hair accent-gold outline-none"
      />
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  /**
   * Off, and not the coach's to turn on right now.
   *
   * For a switch whose answer is decided by another switch — see the lockup in
   * ./ExportDialog.tsx. It is a real `disabled` on the input rather than a
   * grey wrapper and a swallowed handler, so a keyboard skips it and a screen
   * reader says so; the caller supplies the sentence explaining why.
   */
  disabled = false,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 py-1 ${
        disabled ? 'cursor-default opacity-50' : 'cursor-pointer'
      }`}
    >
      <span className="text-xs font-bold text-ink-soft">{label}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-green' : 'bg-ink-hair'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
        />
        <span
          className={`pointer-events-none absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-all ${
            checked ? 'left-[1.125rem]' : 'left-0.5'
          }`}
        />
      </span>
    </label>
  )
}

/**
 * The shell every studio dialog sits in.
 *
 * ── THE BUG THIS EXISTS TO FIX ───────────────────────────────────────────────
 *
 * The dialogs were `fixed inset-0 flex items-center justify-center
 * overflow-y-auto`, with a card that had no height limit. That combination is a
 * trap: once the card is taller than the window, centring pushes its top ABOVE
 * the scroll container's origin, and content scrolled off the top of a scroll
 * container cannot be scrolled back to. So the Video dialog lost its heading at
 * the top and its footnote at the bottom simultaneously, and filled the screen
 * edge to edge doing it (user, 2026-08-27).
 *
 * The fix is to stop asking one element to be both the scroller and the card:
 *
 *  · The BACKDROP scrolls, and the card is centred inside it with `my-auto`,
 *    which centres while still yielding to the card's own top margin — unlike
 *    `items-center`, which does not.
 *  · The CARD is capped at the window height minus its own margin, and lays out
 *    as a column.
 *  · The BODY is the only part that scrolls. The title stays at the top and the
 *    buttons stay at the bottom, which is what makes a long dialog readable at
 *    all: on a laptop the Save button was below the fold of a dialog that had
 *    no fold to be below.
 *
 * On a phone it comes up from the bottom edge and squares off its lower
 * corners, which is where a sheet belongs — the same shape ./SignInWall.tsx
 * already used.
 */
export function Modal({
  title,
  subtitle,
  onClose,
  label,
  children,
  footer,
  width = 'md',
}: {
  title: string
  subtitle?: React.ReactNode
  onClose: () => void
  /** The accessible name, when the visible title is not the whole story. */
  label?: string
  children: React.ReactNode
  /** Pinned under the scrolling body. Where Done and the action button go. */
  footer?: React.ReactNode
  width?: 'md' | 'lg'
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex justify-center overflow-y-auto overscroll-contain bg-ink/55 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={label ?? title}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`my-auto flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-ink-hair bg-surface shadow-lift sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl ${
          width === 'lg' ? 'max-w-lg' : 'max-w-md'
        }`}
      >
        <div className="shrink-0 border-b border-ink-hair px-6 pb-4 pt-5">
          <div className="flex items-start gap-3">
            <h2 className="min-w-0 flex-1 text-xl font-black tracking-display text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-paper hover:text-ink"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                <path
                  d="m4 4 8 8M12 4l-8 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          {subtitle && <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{subtitle}</p>}
        </div>

        {/* `min-h-0` is load-bearing: without it a flex child refuses to shrink
            below its content and the cap above does nothing at all. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-ink-hair bg-surface px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  )
}

/**
 * The training-gear picker: drawers of pictures, one press to put one down.
 *
 * Pictures and not a list of names, the same call `PicturePicker` makes for the
 * match balls and for the same reason — a coach knows a bosu ball on sight and
 * could not pick one out of a dropdown. Grouped, because nineteen pieces in one
 * grid is a wall, and the drawers are named for the job rather than the object:
 * "Hurdles and ladders" is what somebody is looking for, "Agility" is a
 * category we invented.
 *
 * Pressing a piece ADDS one. It is not a mode and there is nothing to disarm —
 * the piece lands on the board already selected, and you drag it where you want
 * it, exactly like the ball. So the same button can be pressed four times to
 * put four cones down, which is what laying out a drill actually is.
 */
export function GearPicker({
  groups,
  onAdd,
}: {
  groups: { id: string; label: string; items: { id: string; name: string; thumb: string }[] }[]
  onAdd: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.id}>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-faint">
            {g.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {g.items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => onAdd(it.id)}
                title={`Put a ${it.name.toLowerCase()} on the board`}
                aria-label={`Add ${it.name}`}
                className="group flex h-14 w-14 items-center justify-center rounded-lg border border-ink-hair bg-paper p-1.5 transition hover:border-gold hover:bg-surface"
              >
                {/* `max-h-full max-w-full` and NOT `h-full w-full`. The second
                    pair only contains a picture whose box has a definite height
                    to resolve 100% against; in this flex well the mannequin,
                    the pole and the inflatable defender — all about 1:4 —
                    took their width from it and their height from the asset,
                    and grew straight out of the bottom (user, 2026-08-27).
                    A max-constraint needs no definite box to work. */}
                <img
                  src={it.thumb}
                  alt=""
                  loading="lazy"
                  className="max-h-full max-w-full object-contain transition-transform group-hover:scale-110"
                />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
