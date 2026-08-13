/**
 * Share: sign it, then take the link.
 *
 * The signing is not a formality and it is not there to collect data. Every
 * shared system carries a credit bar — their name and club on the left, ours on
 * the right (see ../viewer/CreditBar.tsx) — and a bar with an empty left half
 * looks like a Total Football advert stapled to somebody else's work. Asking
 * for the name is what makes the watermark theirs.
 *
 * All three fields are optional and none of them blocks the link. A coach in a
 * hurry gets a working link on the first press; a coach presenting to a board
 * of directors gets their club on every page.
 *
 * WHEN ACCOUNTS LAND these prefill from the profile and this dialog becomes one
 * button with a "presenting as …" line. The fields live on the document
 * (`System.credit`) precisely so that nothing here has to move when they do.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Credit, System } from '../schema'
import { longUrl, publishSystem } from '../share'
import { Button, Field, TextInput } from './ui'
import { SHARE } from './guide'

interface Props {
  system: System
  onCredit: (patch: Partial<Credit>) => void
  /** Remembers the id the server gave us, so the next share updates this link. */
  onPublished: (shareId: string) => void
  onClose: () => void
}

type Status = 'publishing' | 'short' | 'fallback'

export function ShareDialog({ system, onCredit, onPublished, onClose }: Props) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<Status>('publishing')
  const [copied, setCopied] = useState(false)
  const firstField = useRef<HTMLDivElement>(null)

  /*
   * Publish on open, and again whenever the document changes while the dialog
   * is up — including while they are still typing their name, because a link
   * copied before the last keystroke would be a link with half a signature on
   * it. Debounced, or every keystroke would be a round trip.
   *
   * If publishing fails the coach still gets a link: the long self-contained
   * one, which needs nothing from us to work. Sharing must not fail closed.
   */
  // What was last sent up. Storing the id the server returns changes the
  // document, which would otherwise re-run this effect and publish the
  // identical thing straight back.
  const lastSent = useRef('')

  useEffect(() => {
    let live = true
    const t = setTimeout(async () => {
      const payload = JSON.stringify({ ...system, shareId: undefined })
      if (payload === lastSent.current) return
      lastSent.current = payload
      try {
        const published = await publishSystem(system, window.location.origin)
        if (!live) return
        setUrl(published.url)
        setStatus('short')
        if (published.id !== system.shareId) onPublished(published.id)
      } catch {
        if (!live) return
        const fallback = await longUrl(system, window.location.origin)
        if (!live) return
        setUrl(fallback)
        setStatus('fallback')
      }
    }, 400)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [system, onPublished])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2400)
    return () => clearTimeout(t)
  }, [copied])

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Insecure origin, or a browser that refuses without a gesture it
      // recognises. The field below is selectable, which is the fallback.
      setCopied(false)
    }
  }, [url])

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-ink/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Share this system"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-ink-hair bg-surface p-6 shadow-lift">
        <h2 className="text-xl font-black tracking-display text-ink">{SHARE.title}</h2>
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{SHARE.body}</p>

        <div className="mt-5" ref={firstField}>
          <Field label="Your name">
            <TextInput
              value={system.credit?.presenter ?? ''}
              onChange={(v) => onCredit({ presenter: v })}
              placeholder="Who is presenting this"
              maxLength={48}
            />
          </Field>
          <Field label="Club or team">
            <TextInput
              value={system.credit?.team ?? ''}
              onChange={(v) => onCredit({ team: v })}
              placeholder="AEL Limassol U16"
              maxLength={48}
            />
          </Field>
          <Field label="One line of context (optional)">
            <TextInput
              value={system.credit?.note ?? ''}
              onChange={(v) => onCredit({ note: v })}
              placeholder="Pre-season, week 2"
              maxLength={60}
            />
          </Field>
        </div>

        <div className="rounded-lg bg-paper p-3">
          <p className="text-micro uppercase text-ink-faint">The link</p>
          <p
            className={`mt-1.5 break-all leading-relaxed text-ink ${
              status === 'short' ? 'font-mono text-[13px] font-bold' : 'font-mono text-[10px] text-ink-soft'
            }`}
          >
            {status === 'publishing'
              ? 'Publishing…'
              : status === 'short'
                ? url
                : `${url.slice(0, 96)}…`}
          </p>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            {status === 'publishing' ? SHARE.publishing : status === 'short' ? SHARE.live : SHARE.fallback}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="solid"
            onClick={copy}
            disabled={status === 'publishing'}
            className="!px-4 !py-2.5 !text-sm"
          >
            {copied ? 'Link copied' : 'Copy the link'}
          </Button>
          <a
            href={url || '#'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-bold text-ink-soft no-underline transition-colors hover:bg-ink-hair hover:text-ink"
          >
            Open the viewer
          </a>
          <Button onClick={onClose} className="ml-auto">
            Done
          </Button>
        </div>

        <p className="mt-4 border-t border-ink-hair pt-3 text-[11px] leading-relaxed text-ink-faint">{SHARE.foot}</p>
      </div>
    </div>
  )
}
