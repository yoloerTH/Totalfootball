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
    <section className={`border-b border-ink-hair px-4 py-4 ${className}`}>
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
    <div className="flex gap-1 rounded-lg bg-paper p-1" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition-colors ${
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

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span className="text-xs font-bold text-ink-soft">{label}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-green' : 'bg-ink-hair'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
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
