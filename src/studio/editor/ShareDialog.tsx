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
 * ── ACCOUNTS LANDED, AND THIS IS THAT CHANGE ────────────────────────────────
 *
 * The note here used to say "when accounts land these prefill from the profile
 * and this dialog becomes one button with a presenting-as line". They landed,
 * that did not happen, and the result was Share asking a signed-in coach for a
 * name they had already typed on the settings page (user, 2026-08-27).
 *
 * Two halves fix it and only one of them is in this file. The board is SIGNED
 * from the profile in ./StudioEditor.tsx, so the credit is filled in before
 * anything is published — that is the half that matters, because it is what
 * puts the right name on the video and the print sheet too, neither of which
 * has a dialog to ask in. This file's half is only that it now SHOWS the
 * signature rather than presenting three empty boxes: one line, and a button
 * for the coach who is presenting this one as somebody else.
 *
 * The fields still live on the document (`System.credit`), which is what made
 * this a change of two dozen lines rather than a migration.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Credit, System } from '../schema'
import { longUrl, publishSystem } from '../share'
import { STUDIO_EVENTS, track } from '../track'
import { Button, Field, Modal, TextInput } from './ui'
import { SHARE } from './guide'

/**
 * One of the send buttons that is really a link.
 *
 * An <a> and not a <button> with a `location.assign`, and the difference is not
 * pedantry: `wa.me` and `mailto:` hand off to another application, and a
 * browser will only allow that from a real navigation started by a real click.
 * Scripted navigations to an external scheme are blocked in enough places that
 * the button would appear to do nothing on somebody's machine and work fine on
 * ours.
 *
 * Styled to match `Button`'s quiet variant rather than importing it, because
 * Button renders a <button> and the whole point here is the element.
 */
function SendLink({
  href,
  label,
  disabled,
  onSend,
  children,
}: {
  href: string
  label: string
  disabled?: boolean
  onSend: () => void
  children: React.ReactNode
}) {
  return (
    <a
      href={disabled ? undefined : href}
      /*
       * Not on `mailto:`. A new tab is right for wa.me, which is a web page —
       * on a mail link the browser opens a tab, hands the URL to the mail
       * client and leaves an empty tab sitting there, which reads as the button
       * having half worked. A mail link navigates in place and the page it was
       * on never actually goes anywhere.
       */
      target={href.startsWith('mailto:') ? undefined : '_blank'}
      rel="noreferrer"
      aria-disabled={disabled}
      onClick={() => !disabled && onSend()}
      className={`inline-flex items-center gap-1.5 rounded-md border border-ink-hair px-3 py-2 text-xs font-bold text-ink-soft no-underline transition-colors ${
        disabled ? 'pointer-events-none opacity-40' : 'hover:bg-paper hover:text-ink'
      }`}
    >
      {children}
      {label}
    </a>
  )
}

interface Props {
  system: System
  /**
   * Whether the profile has a name or a club in it.
   *
   * Not whether the CREDIT is filled — that is read off the system, right here.
   * This says where it came from, which decides the wording: "this is how it
   * will be signed" to somebody whose settings page filled it in, and the
   * fields to somebody who has never told us who they are.
   */
  signedFromProfile?: boolean
  onCredit: (patch: Partial<Credit>) => void
  /** Remembers the id the server gave us, so the next share updates this link. */
  onPublished: (shareId: string) => void
  onClose: () => void
}

type Status = 'publishing' | 'short' | 'fallback'

export function ShareDialog({
  system,
  signedFromProfile = false,
  onCredit,
  onPublished,
  onClose,
}: Props) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<Status>('publishing')
  const [copied, setCopied] = useState(false)
  const firstField = useRef<HTMLDivElement>(null)

  /*
   * The credit as it stands, and whether it needs asking about.
   *
   * `signed` is read off the DOCUMENT rather than off the profile, because the
   * document is what gets published — a board signed by hand for an assistant
   * is signed, whatever the settings page says.
   */
  const presenter = system.credit?.presenter?.trim() ?? ''
  const team = system.credit?.team?.trim() ?? ''
  const signed = Boolean(presenter || team)
  /*
   * Open the fields only when there is nothing to show, or when the coach asks.
   *
   * Not `useState(!signed)` alone: the board is signed from the profile by an
   * effect in ./StudioEditor.tsx, which can land a beat after this mounts. So
   * the initial value would be computed against an unsigned document and the
   * form would be open under a line that had by then filled itself in. Held as
   * an override instead — null means "follow the document".
   */
  const [editingCredit, setEditingCredit] = useState<boolean | null>(null)
  const showFields = editingCredit ?? !signed

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

  /**
   * ONE event per opening of this dialog, not one per publish. The effect below
   * republishes on every edit while the dialog is up — including each keystroke
   * of a club name, debounced — so counting publishes would count typing, and
   * "systems shared today" would be a number about nothing.
   */
  const counted = useRef(false)

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
        if (!counted.current) {
          counted.current = true
          track(STUDIO_EVENTS.sharePublished)
        }
        if (published.id !== system.shareId) onPublished(published.id)
      } catch {
        if (!live) return
        const fallback = await longUrl(system, window.location.origin)
        if (!live) return
        setUrl(fallback)
        setStatus('fallback')
        if (!counted.current) {
          counted.current = true
          track(STUDIO_EVENTS.shareFallback)
        }
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

  /**
   * What goes out with the link.
   *
   * The message and the URL as two lines rather than one string with the URL
   * buried in it: every chat app in the world previews the last URL it finds,
   * and a link on its own line is the one that gets a card with the board on
   * it. See SHARE.message for why there is a sentence at all.
   */
  const message = SHARE.message(system.title)
  const body = `${message}\n\n${url}`

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      track(STUDIO_EVENTS.shareSent, 'copy')
    } catch {
      // Insecure origin, or a browser that refuses without a gesture it
      // recognises. The field below is selectable, which is the fallback.
      setCopied(false)
    }
  }, [url])

  /**
   * The system share sheet, where there is one.
   *
   * Offered rather than assumed: `navigator.share` exists on every phone and on
   * roughly no desktop, so this button appears for the coach standing on a
   * touchline and not for the one at a laptop, where it would open nothing. It
   * is also the only route that reaches Telegram, Signal, AirDrop and whatever
   * a club is actually using, without us maintaining a list of them.
   */
  const canShareSheet =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const shareSheet = useCallback(async () => {
    try {
      await navigator.share({ title: system.title || 'A tactical system', text: message, url })
      track(STUDIO_EVENTS.shareSent, 'sheet')
    } catch {
      // Cancelled, or refused because the gesture was not recognised. Either
      // way the coach is looking at the same dialog with the link still in it.
    }
  }, [system.title, message, url])

  /* On `Modal` for the reason set out in ./VideoDialog.tsx. This one is the
     shortest of the three and still overflowed a laptop once the fields, the
     link, four send buttons and the footnote were all open at once. */
  return (
    <Modal
      title={SHARE.title}
      subtitle={SHARE.body}
      label="Share this system"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center gap-2">
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
      }
    >
      <>

        {/*
         * ── THE SIGNATURE ───────────────────────────────────────────────────
         *
         * A line, not a form, whenever we already know the answer. The credit
         * bar on a shared system carries the coach's name and club (see
         * ../viewer/CreditBar.tsx), and the settings page exists to collect
         * exactly that — so a signed-in coach opening Share should be told how
         * their work is about to be signed, not interrogated about it.
         *
         * "Sign it differently" is kept and it is not a formality: a board
         * presented by an assistant, or under the club's name rather than the
         * coach's, is a real thing and the document is where that belongs. It
         * changes THIS system only, which is why it edits the credit and not
         * the profile.
         */}
        {signed && !showFields && (
          <div className="mb-5 flex items-center gap-3 rounded-lg bg-paper p-3">
            <div className="min-w-0 flex-1">
              <p className="text-micro uppercase text-ink-faint">Signed by</p>
              <p className="mt-1 truncate text-sm font-bold text-ink">
                {presenter || team}
                {presenter && team && <span className="font-normal text-ink-soft"> · {team}</span>}
              </p>
              {system.credit?.note?.trim() && (
                <p className="mt-0.5 truncate text-[11px] text-ink-faint">{system.credit.note}</p>
              )}
            </div>
            <Button onClick={() => setEditingCredit(true)} className="shrink-0">
              Change
            </Button>
          </div>
        )}

        <div className={showFields ? 'mt-5' : 'hidden'} ref={firstField}>
          {signedFromProfile && showFields && (
            <p className="mb-3 rounded-lg bg-paper px-3 py-2 text-[11px] leading-snug text-ink-faint">
              This is how this system will be signed. Changing it here changes this system only — your settings
              stay as they are.
            </p>
          )}
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
          {signed && (
            <div className="-mt-1 mb-4">
              <Button onClick={() => setEditingCredit(false)}>Done signing</Button>
            </div>
          )}
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

        {/*
         * SEND IT, not "copy it".
         *
         * The old dialog ended at a clipboard button, which quietly made the
         * coach do the last and most important step somewhere else: switch app,
         * find the group, paste a bare URL, think of something to say about it.
         * Every one of those is a place to give up, and a link that never gets
         * sent is a system nobody sees and a coach who never finds out the tool
         * works. These are the two places these links actually go, plus the
         * phone's own share sheet for everywhere else.
         *
         * Copy stays, and stays first among equals: it is the one that works
         * when the answer is "a place none of these buttons know about".
         */}
        <div className="mt-4">
          <p className="text-micro uppercase text-ink-faint">{SHARE.send}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="solid"
              onClick={copy}
              disabled={status === 'publishing'}
              className="!px-4 !py-2.5 !text-sm"
            >
              {copied ? SHARE.sendCopied : SHARE.sendCopy}
            </Button>

            <SendLink
              href={`https://wa.me/?text=${encodeURIComponent(body)}`}
              disabled={status === 'publishing'}
              onSend={() => track(STUDIO_EVENTS.shareSent, 'whatsapp')}
              label={SHARE.sendWhatsapp}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
                <path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.44 1.32 4.94L2 22l5.34-1.4a9.8 9.8 0 0 0 4.7 1.2h.01c5.43 0 9.84-4.4 9.84-9.84 0-2.63-1.03-5.1-2.89-6.96A9.78 9.78 0 0 0 12.04 2Zm0 1.8a8 8 0 0 1 5.69 2.35 7.98 7.98 0 0 1 2.36 5.69c0 4.45-3.62 8.05-8.05 8.05a8.1 8.1 0 0 1-4.1-1.12l-.3-.17-3.05.8.81-2.97-.19-.31a7.95 7.95 0 0 1-1.22-4.28c0-4.44 3.61-8.04 8.05-8.04Zm-2.5 4.1c-.2 0-.51.07-.78.36-.27.3-1.03 1-1.03 2.44s1.06 2.83 1.2 3.02c.15.2 2.06 3.15 5 4.3 2.44.96 2.94.77 3.47.72.53-.05 1.7-.7 1.94-1.37.24-.68.24-1.25.17-1.37-.07-.12-.27-.2-.56-.34-.3-.15-1.74-.86-2.01-.96-.27-.1-.47-.15-.66.15-.2.29-.76.95-.93 1.15-.17.2-.34.22-.63.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.29-.02-.45.13-.6.13-.13.3-.34.44-.51.15-.17.2-.3.3-.5.1-.19.05-.36-.02-.5-.08-.15-.66-1.6-.9-2.18-.24-.57-.48-.5-.66-.5h-.45Z" />
              </svg>
            </SendLink>

            <SendLink
              href={`mailto:?subject=${encodeURIComponent(system.title || 'A tactical system')}&body=${encodeURIComponent(body)}`}
              disabled={status === 'publishing'}
              onSend={() => track(STUDIO_EVENTS.shareSent, 'mail')}
              label={SHARE.sendMail}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <rect
                  x="2.5"
                  y="4.5"
                  width="19"
                  height="15"
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M3 6.5 12 13l9-6.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </SendLink>

            {canShareSheet && (
              <Button onClick={shareSheet} disabled={status === 'publishing'}>
                {SHARE.sendMore}
              </Button>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">{SHARE.sendNote}</p>
        </div>

        <p className="mt-4 border-t border-ink-hair pt-3 text-[11px] leading-relaxed text-ink-faint">{SHARE.foot}</p>
      </>
    </Modal>
  )
}
