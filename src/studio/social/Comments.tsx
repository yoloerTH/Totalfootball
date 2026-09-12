/**
 * The thread under a published system.
 *
 * ── THE COMPOSER SAYS WHAT COMMENTING DOES BEFORE IT IS PRESSED ──────────────
 *
 * "Posting as <name>. Coaches can see who wrote this." A comment column where
 * people are not sure whether they are visible is the single fastest way to
 * turn a coaching network into a sewer, and the copy costs one line. It is also
 * simply true: `studio_post_comments` returns the commenter's name whatever
 * their profile visibility, and that asymmetry with the feed is deliberate and
 * argued in supabase/025.
 *
 * ── TWO PEOPLE CAN DELETE A COMMENT ──────────────────────────────────────────
 *
 * Its author, and the coach whose post it is under. The second is the one that
 * matters at three in the morning: a coach who published a system is
 * responsible for what is written beneath it and must be able to remove
 * something without waiting for us to wake up. The policy in supabase/025 is
 * what enforces it; this file only draws the button for the two people who have
 * it.
 *
 * ── A COMMENT MAY CARRY A SYSTEM ────────────────────────────────────────────
 *
 * "Suggest a variation" under one of ours opens a copy in the studio; when the
 * coach publishes it, the publish dialog writes a comment here with `variation`
 * pointing at their new post. So a thread is not only sentences — it is the
 * reworks the system provoked, each one a board a reader can open and fork
 * again. The card is drawn as a STILL rather than a playing board: five moving
 * boards in a column is a thread nobody can read, and the post's own page is one
 * tap away and plays.
 *
 * ── AND A REPORT, WHICH GOES SOMEWHERE NOBODY CAN READ ───────────────────────
 *
 * §7 of docs/SOCIAL.md lists a report path as a thing that must exist before
 * public user content does. It writes to `studio_reports`, which has an insert
 * policy and no select policy for anybody — not for the reporter, not for the
 * reported. A readable reports table is a harassment surface of its own.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  REPORT_REASONS,
  addComment,
  loadComments,
  removeComment,
  report,
  type Comment,
} from './api'
import { BoardMedia } from './BoardMedia'
import { when } from './PostCard'
import { imageUrl } from '../account/images'
import { loadPost } from '../posts'
import type { System } from '../schema'

export function Comments({
  post,
  /** The reading coach, or '' when signed out. */
  owner,
  /** Who published the post, so the moderation button is drawn for them. */
  postOwner,
  myName,
  canWrite = true,
  onNeedsIdentity,
}: {
  post: string
  owner: string
  postOwner: string
  myName: string
  /**
   * Whether this coach has the @handle and the name the policy demands.
   *
   * THE COMPOSER IS NOT THE ENFORCEMENT — supabase/032 refuses the insert, and
   * `addComment` reports that refusal separately. This only decides whether a
   * coach is shown a textarea they are about to be refused from, which is a
   * courtesy rather than a security boundary. Defaults true so the post page,
   * which reaches its readers through a flow that already gated them, does not
   * have to think about it.
   */
  canWrite?: boolean
  /**
   * Open the two-field gate, when the host has one to open.
   *
   * Absent on surfaces that cannot show a dialog; there the prompt falls back to
   * a link to settings, which is slower and always works.
   */
  onNeedsIdentity?: () => void
}) {
  const [rows, setRows] = useState<Comment[]>([])
  const [state, setState] = useState<'loading' | 'ready'>('loading')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState<string>('')
  const [fault, setFault] = useState('')

  const refresh = async () => {
    const found = await loadComments(post)
    setRows(found)
    setState('ready')
  }

  useEffect(() => {
    let live = true
    void loadComments(post).then((found) => {
      if (!live) return
      setRows(found)
      setState('ready')
    })
    return () => {
      live = false
    }
  }, [post])

  const send = async () => {
    const body = draft.trim()
    if (!body || !owner) return
    setBusy(true)
    setFault('')
    const res = await addComment(post, owner, body)
    setBusy(false)
    if (res.ok) {
      setDraft('')
      await refresh()
      return
    }
    /*
     * THE DRAFT IS KEPT. A refusal that clears the box costs somebody the
     * paragraph they just wrote, and the commonest refusal here is "you have no
     * handle yet" — which is fixed in a dialog and then retried, with the text
     * still sitting there.
     */
    setFault(res.fault)
    if (res.needsIdentity) onNeedsIdentity?.()
  }

  const drop = async (id: string) => {
    const ok = await removeComment(id)
    if (ok) setRows((r) => r.filter((c) => c.id !== id))
  }

  return (
    <section id="comments" className="mt-10 scroll-mt-6">
      <h2 className="text-micro uppercase text-ink-faint">
        {rows.length === 0
          ? 'Comments'
          : `${rows.length} comment${rows.length === 1 ? '' : 's'}`}
      </h2>

      {owner && !canWrite ? (
        /*
         * Signed in, but standing behind nothing yet.
         *
         * Phrased as what a comment IS rather than as a rule being applied to
         * them: a thread where the bylines are real coaches is the whole reason
         * anybody reads it, and "pick a handle" on its own sounds like a form.
         */
        <div className="mt-3 rounded-xl border border-ink-hair bg-surface p-3">
          <p className="text-[13px] leading-relaxed text-ink-soft">
            Comments here carry your name. Pick an <span className="font-bold text-ink">@handle</span>{' '}
            and the name you coach under, and you can write under any system on the network.
          </p>
          {onNeedsIdentity ? (
            <button
              type="button"
              onClick={onNeedsIdentity}
              className="mt-2.5 rounded-md bg-ink px-3.5 py-1.5 text-[12px] font-bold text-paper"
            >
              Pick your handle
            </button>
          ) : (
            <a
              href="/studio/settings/"
              className="mt-2.5 inline-block rounded-md bg-ink px-3.5 py-1.5 text-[12px] font-bold text-paper no-underline"
            >
              Pick your handle
            </a>
          )}
        </div>
      ) : owner ? (
        <div className="mt-3 rounded-xl border border-ink-hair bg-surface p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
            rows={3}
            placeholder="What you would change, what you would keep, what it reminds you of."
            className="w-full resize-y rounded-md border border-ink-hair bg-paper px-2.5 py-2 text-[14px] leading-relaxed text-ink outline-none focus:border-ink-faint"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-ink-faint">
              Posting as {myName || 'yourself'}. Coaches can see who wrote it.
            </span>
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !draft.trim()}
              className="rounded-md bg-ink px-3.5 py-1.5 text-[12px] font-bold text-paper disabled:opacity-40"
            >
              {busy ? 'Posting' : 'Post'}
            </button>
          </div>
          {fault && <p className="mt-2 text-[12px] font-bold leading-snug text-ink">{fault}</p>}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-ink-hair bg-surface p-3 text-[13px] text-ink-soft">
          <a href="/studio/login/" className="font-bold text-ink">
            Sign in
          </a>{' '}
          to join the conversation. Reading it needs no account.
        </p>
      )}

      {state === 'loading' && <p className="mt-4 text-[13px] text-ink-faint">Loading…</p>}

      {state === 'ready' && rows.length === 0 && (
        <p className="mt-4 text-[13px] leading-relaxed text-ink-faint">
          Nothing yet. The first comment on a system is usually the one the coach who built it
          remembers.
        </p>
      )}

      <ul className="mt-4 list-none space-y-4 p-0">
        {rows.map((c) => {
          const face = imageUrl(c.avatarPath)
          const canDelete = owner && (owner === c.owner || owner === postOwner)
          return (
            <li key={c.id} className="flex gap-3">
              {face ? (
                <img
                  src={face}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full border border-ink-hair object-cover"
                />
              ) : (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink-hair bg-surface text-[12px] font-black text-ink-faint">
                  {(c.presenter[0] || '?').toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-2">
                  {c.handle ? (
                    <a
                      href={`/c/${c.handle}`}
                      className="text-[13px] font-bold text-ink no-underline hover:underline"
                    >
                      {c.presenter || `@${c.handle}`}
                    </a>
                  ) : (
                    <span className="text-[13px] font-bold text-ink">{c.presenter || 'A coach'}</span>
                  )}
                  <span className="text-[11px] text-ink-faint">{when(c.createdAt)}</span>
                </p>
                <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-ink-soft">
                  {c.body}
                </p>
                {c.variation && <VariationCard comment={c} />}
                <p className="mt-1 flex items-center gap-3">
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => void drop(c.id)}
                      className="text-[11px] font-bold text-ink-faint hover:text-ink"
                    >
                      {owner === c.owner ? 'Delete' : 'Remove'}
                    </button>
                  )}
                  {owner && owner !== c.owner && (
                    <button
                      type="button"
                      onClick={() => setReporting(reporting === c.id ? '' : c.id)}
                      className="text-[11px] font-bold text-ink-faint hover:text-ink"
                    >
                      Report
                    </button>
                  )}
                </p>

                {reporting === c.id && (
                  <ReportBox
                    kind="comment"
                    target={c.id}
                    reporter={owner}
                    onDone={() => setReporting('')}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * One coach's rework of the system above, sitting inside their comment.
 *
 * ── FETCHED WHEN IT IS LOOKED AT, NOT WHEN THE THREAD LOADS ──────────────────
 *
 * `studio_post_comments` deliberately returns the variation's title and length
 * and NOT its document — five variations would be a megabyte of jsonb to draw
 * five cards, and most of them are below the fold. So the row arrives with
 * enough to draw the frame immediately, and the board is fetched by `loadPost`
 * the first time this card comes near the viewport. A thread with thirty
 * comments makes no requests for boards nobody scrolled to.
 *
 * `rootMargin` starts the fetch a screen early, so in the ordinary case of
 * somebody scrolling at reading speed the board is already there when the frame
 * arrives.
 *
 * ── THE FRAME IS DRAWN BEFORE THE BOARD EXISTS, AND STAYS THE SAME SIZE ──────
 *
 * Title, phase count and the link are all in hand from the first paint, so the
 * card never appears from nothing under somebody's cursor. The board area holds
 * its own height while it is empty, because a thread that relayouts as you read
 * it is worse than one that loads slowly.
 */
function VariationCard({ comment }: { comment: Comment }) {
  const host = useRef<HTMLDivElement | null>(null)
  const [doc, setDoc] = useState<System | null>(null)
  const [coverAct, setCoverAct] = useState(0)
  const idp = useMemo(() => `var-${comment.id}`, [comment.id])

  useEffect(() => {
    const node = host.current
    if (!node) return
    let live = true

    const fetchIt = () => {
      void loadPost(comment.variation).then((found) => {
        // `loadPost` returns null for a post that has been taken down since the
        // thread loaded. The card then stays a link, which is the truth: the
        // comment still stands, the board behind it does not.
        if (!live || !found) return
        setDoc(found.doc)
        setCoverAct(found.coverAct ?? 0)
      })
    }

    if (typeof IntersectionObserver !== 'function') {
      fetchIt()
      return () => {
        live = false
      }
    }

    const watcher = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        watcher.disconnect()
        fetchIt()
      },
      { rootMargin: '600px 0px' },
    )
    watcher.observe(node)
    return () => {
      live = false
      watcher.disconnect()
    }
  }, [comment.variation])

  const phases = comment.variationPhases
  const href = `/p/?p=${encodeURIComponent(comment.variation)}`

  return (
    <div
      ref={host}
      className="mt-2.5 overflow-hidden rounded-xl border border-ink-hair bg-paper"
    >
      <p className="flex items-center gap-1.5 border-b border-ink-hair px-3 py-2">
        <span className="text-micro uppercase tracking-micro text-ink-faint">A variation</span>
      </p>
      <a href={href} className="block no-underline">
        <div className="grid min-h-[140px] place-items-center bg-paper-deep">
          {doc ? (
            /* A still. See the note at the top of this file: a column of playing
               boards is a thread nobody finishes reading. */
            <BoardMedia system={doc} media="image" coverAct={coverAct} idp={idp} allowPlay={false} />
          ) : (
            <span className="text-[12px] text-ink-faint">Loading the board…</span>
          )}
        </div>
        <div className="border-t border-ink-hair px-3 py-2.5">
          <span className="block text-[13px] font-bold text-ink">
            {comment.variationTitle || 'Their version'}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-faint">
            {phases > 0 && <span>{phases === 1 ? '1 phase' : `${phases} phases`}</span>}
            {comment.variationReactions > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{comment.variationReactions} reacted</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-bold text-ink">Open it →</span>
          </span>
        </div>
      </a>
    </div>
  )
}

/**
 * The report form, used for a comment and for a post.
 *
 * It says what happens next in plain words and does not pretend to be more than
 * it is: the report reaches us, and a human reads it. No ticket number, no
 * "your report has been received and is being processed", which is the tone
 * that makes people stop reporting things.
 */
export function ReportBox({
  kind,
  target,
  reporter,
  onDone,
}: {
  kind: 'post' | 'comment'
  target: string
  reporter: string
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  if (sent) {
    return (
      <p className="mt-2 rounded-lg border border-ink-hair bg-paper p-2.5 text-[12px] text-ink-soft">
        Sent. Somebody here reads these.
      </p>
    )
  }

  return (
    <div className="mt-2 rounded-lg border border-ink-hair bg-paper p-3">
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-label="Why you are reporting this"
        className="w-full rounded-md border border-ink-hair bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-ink-faint"
      >
        <option value="">What is wrong with it?</option>
        {REPORT_REASONS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 1000))}
        rows={2}
        placeholder="Anything we should know. Optional."
        className="mt-2 w-full resize-y rounded-md border border-ink-hair bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-ink-faint"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-2.5 py-1.5 text-[12px] font-bold text-ink-soft hover:bg-ink-hair"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!reason || busy}
          onClick={async () => {
            setBusy(true)
            const ok = await report(kind, target, reporter, reason, note)
            setBusy(false)
            if (ok) setSent(true)
          }}
          className="rounded-md bg-ink px-3 py-1.5 text-[12px] font-bold text-paper disabled:opacity-40"
        >
          Send report
        </button>
      </div>
    </div>
  )
}
