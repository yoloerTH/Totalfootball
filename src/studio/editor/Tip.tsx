/**
 * Tooltips.
 *
 * The studio is for coaches, not for people who use editors. Almost every
 * control here does something that is obvious once you have seen it happen and
 * completely opaque before — "Add block", "Fade back", "Switch" — so every one
 * of them gets a sentence of plain English attached.
 *
 * WHY NOT `title=`. The native tooltip takes about a second to appear, cannot
 * be styled, never appears on touch, and does not appear at all for a control
 * reached by keyboard. It is the right amount of effort for a hint nobody needs
 * and the wrong amount for a hint that is the difference between a coach using
 * the tool and closing it.
 *
 * WHY A PORTAL. Both side panels scroll (`overflow-y-auto`), and an absolutely
 * positioned tooltip inside a scroll container is clipped by it — the hint for
 * the last control in a panel would be a sliver. Rendering into `document.body`
 * at fixed coordinates escapes that, at the cost of having to place it by hand,
 * which is what `place()` below does.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Side = 'right' | 'left' | 'top' | 'bottom'

const GAP = 10
const MARGIN = 8
const WIDTH = 232

interface Box {
  top: number
  left: number
}

/**
 * Put the bubble on the requested side, flip it if it would leave the viewport,
 * then clamp. Measured against the real bubble rather than an estimate, so a
 * two-line hint and a five-line one both land correctly.
 */
function place(anchor: DOMRect, bubble: DOMRect, side: Side): Box {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let s = side

  if (s === 'right' && anchor.right + GAP + bubble.width > vw - MARGIN) s = 'left'
  else if (s === 'left' && anchor.left - GAP - bubble.width < MARGIN) s = 'right'
  else if (s === 'top' && anchor.top - GAP - bubble.height < MARGIN) s = 'bottom'
  else if (s === 'bottom' && anchor.bottom + GAP + bubble.height > vh - MARGIN) s = 'top'

  const horizontal = s === 'right' || s === 'left'
  const left = horizontal
    ? s === 'right'
      ? anchor.right + GAP
      : anchor.left - GAP - bubble.width
    : anchor.left + anchor.width / 2 - bubble.width / 2
  const top = horizontal
    ? anchor.top + anchor.height / 2 - bubble.height / 2
    : s === 'bottom'
      ? anchor.bottom + GAP
      : anchor.top - GAP - bubble.height

  return {
    left: Math.min(Math.max(MARGIN, left), vw - bubble.width - MARGIN),
    top: Math.min(Math.max(MARGIN, top), vh - bubble.height - MARGIN),
  }
}

interface Props {
  /** The hint. One or two sentences, in a coach's language, never ours. */
  text: React.ReactNode
  /** Optional bold first line — usually what the control is called. */
  title?: string
  children: React.ReactNode
  side?: Side
  /** Wrapper display. Selects and text fields need `block` to keep their width. */
  block?: boolean
  /**
   * An address for the help panel, if this control is one somebody might ask
   * for by name. It becomes `data-help` on the wrapper, and ./guide.ts targets
   * it by that string.
   *
   * OPTIONAL, and most tips will never set it. Panels and drawers get theirs
   * for free from their own headings (./ui.tsx); this is for the controls that
   * are neither — the buttons along the top bar and the strip under the board,
   * which have no heading to be addressed by.
   */
  help?: string
}

export function Tip({ text, title, children, side = 'right', block = false, help }: Props) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<Box | null>(null)

  const show = useCallback(() => setOpen(true), [])
  const hide = useCallback(() => {
    setOpen(false)
    setBox(null)
  }, [])

  // Measure after the bubble is in the DOM but before the browser paints it,
  // so it never flashes at 0,0 on its way to the right place.
  useEffect(() => {
    if (!open) return
    const anchor = anchorRef.current?.getBoundingClientRect()
    const bubble = bubbleRef.current?.getBoundingClientRect()
    if (anchor && bubble) setBox(place(anchor, bubble, side))
  }, [open, side])

  // Escape closes it, and any scroll dismisses it rather than leaving it
  // stranded over the wrong control — the bubble is fixed, its anchor is not.
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && hide()
    window.addEventListener('keydown', key)
    window.addEventListener('scroll', hide, true)
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('scroll', hide, true)
    }
  }, [open, hide])

  return (
    <span
      ref={anchorRef}
      data-help={help}
      className={block ? 'block' : 'inline-flex'}
      onPointerEnter={(e) => e.pointerType !== 'touch' && show()}
      onPointerLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      {open &&
        createPortal(
          <div
            ref={bubbleRef}
            role="tooltip"
            className="pointer-events-none fixed z-[70] rounded-lg border border-ink-hair bg-surface px-3 py-2 text-[11px] leading-relaxed text-ink-soft shadow-lift"
            style={{
              width: WIDTH,
              top: box?.top ?? 0,
              left: box?.left ?? 0,
              // Invisible until placed, rather than absent: it has to be in the
              // DOM to be measured at all.
              opacity: box ? 1 : 0,
            }}
          >
            {title && <span className="mb-0.5 block font-black text-ink">{title}</span>}
            {text}
          </div>,
          document.body,
        )}
    </span>
  )
}
