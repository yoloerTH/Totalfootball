/**
 * One published system in a feed.
 *
 * ── THE BOARD IS THE CARD ────────────────────────────────────────────────────
 *
 * Not a thumbnail with the text beside it: the board fills the width and the
 * words sit under it. A coach recognises a 4-3-3 in a quarter of a second and
 * cannot recognise "Pressing structure · 6 phases" at all, which is the same
 * argument the portal makes for drawing real boards on its shelf. It is also
 * the only honest layout for a network whose unit of content is a diagram.
 *
 * ── WHAT SITS ON A CARD AND WHAT DOES NOT ────────────────────────────────────
 *
 * On it: who made it, the board, the title, the summary, the five reactions,
 * and the two acts that need somebody else's attention — comment and repost.
 * Not on it: the comment thread. A feed that unrolls forty comments in place is
 * a feed nobody scrolls past the second post of; the count is the door and the
 * post page is the room.
 *
 * ── REPOST ASKS FOR A NOTE, AND ASKING IS THE POINT ──────────────────────────
 *
 * A one-press repost is a like with a bigger number. The composer opens with an
 * empty note and a sentence explaining what a good one says, because a repost
 * carrying "we used this against a back three and it needed one change" is
 * worth more to the next reader than the post's own summary. The note is
 * optional — a coach who just wants to pass it on can — but the ask is made.
 */

import { useState } from 'react'
import { BoardMedia } from './BoardMedia'
import { ReactionBar } from './ReactionBar'
import { repost, unrepost, type FeedPost } from './api'
import { imageUrl } from '../account/images'
import { licenceLabel, roleLabel } from '../account/identity'

export function when(iso: string): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.floor((Date.now() - then) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  return months < 12 ? `${months}mo` : `${Math.floor(months / 12)}y`
}

/** The author line. Its own component because the post page draws it too. */
export function Author({
  post,
  compact = false,
}: {
  post: Pick<
    FeedPost,
    'handle' | 'presenter' | 'team' | 'role' | 'licence' | 'avatarPath' | 'crestPath' | 'doc'
  >
  compact?: boolean
}) {
  const avatar = imageUrl(post.avatarPath)
  const crest = imageUrl(post.crestPath)

  // A coach whose profile is not public is credited by whatever the DOCUMENT
  // carries, which is what they chose in the publish dialog. Never a link:
  // there is no page to land on, and inventing one would be a 404 with their
  // name on it.
  const name = post.presenter || post.doc?.credit?.presenter || 'A coach'
  const club = post.team || post.doc?.credit?.team || ''
  const under = [club, roleLabel(post.role), licenceLabel(post.licence)].filter(Boolean).join(' · ')

  const face = (
    <span className="flex shrink-0 -space-x-2">
      {avatar ? (
        <img src={avatar} alt="" className="h-9 w-9 rounded-full border border-ink-hair object-cover" />
      ) : (
        <span className="grid h-9 w-9 place-items-center rounded-full border border-ink-hair bg-surface text-[13px] font-black text-ink-faint">
          {(name[0] || '?').toUpperCase()}
        </span>
      )}
      {crest && (
        <img
          src={crest}
          alt=""
          className="h-9 w-9 rounded-full border border-ink-hair bg-surface object-contain p-1"
        />
      )}
    </span>
  )

  const words = (
    <span className="min-w-0">
      <span className="block truncate text-[14px] font-bold leading-tight text-ink">{name}</span>
      {!compact && under && (
        <span className="block truncate text-[12px] leading-tight text-ink-faint">{under}</span>
      )}
    </span>
  )

  if (!post.handle) {
    return (
      <span className="flex min-w-0 items-center gap-2.5">
        {face}
        {words}
      </span>
    )
  }

  return (
    <a
      href={`/c/${post.handle}`}
      className="flex min-w-0 items-center gap-2.5 no-underline hover:opacity-80"
    >
      {face}
      {words}
    </a>
  )
}

export function PostCard({
  post,
  /** The reading coach, or '' when signed out. */
  owner,
  reposted,
  onReposted,
  /**
   * Off on a profile page, where every card is by the same person.
   *
   * Repeating "Marta Oyelaran · Vale Rangers · Coach · UEFA A" above each of
   * their own systems is the page telling you a thing it told you at the top,
   * once per card. In a feed it is the most important line on the card; on a
   * profile it is furniture.
   */
  showAuthor = true,
}: {
  post: FeedPost
  owner: string
  reposted: boolean
  onReposted: (id: string, now: boolean) => void
  showAuthor?: boolean
}) {
  const [composing, setComposing] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const mine = owner && owner === post.owner

  const send = async () => {
    if (!owner) return
    setBusy(true)
    const ok = await repost(post.id, owner, note)
    setBusy(false)
    if (ok) {
      setComposing(false)
      setNote('')
      onReposted(post.id, true)
    }
  }

  const undo = async () => {
    if (!owner) return
    setBusy(true)
    const ok = await unrepost(post.id, owner)
    setBusy(false)
    if (ok) onReposted(post.id, false)
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-ink-hair bg-surface">
      <header className="flex items-center gap-3 px-4 pb-3 pt-4">
        {showAuthor ? (
          <Author post={post} />
        ) : (
          <span className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">
            {post.media === 'video' ? 'Plays' : 'Still'}
          </span>
        )}
        <span className="ml-auto shrink-0 text-[12px] text-ink-faint">{when(post.publishedAt)}</span>
      </header>

      <a href={`/p/${post.id}`} className="block no-underline">
        <BoardMedia
          system={post.doc}
          media={post.media}
          coverAct={post.coverAct}
          idp={`c${post.id}`}
        />
      </a>

      <div className="p-4">
        <a href={`/p/${post.id}`} className="block no-underline">
          <h2 className="text-[17px] font-bold leading-tight text-ink">{post.title}</h2>
          {post.summary && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{post.summary}</p>
          )}
        </a>

        <div className="mt-3.5">
          <ReactionBar post={post.id} owner={owner} mine={post.mine} kinds={post.kinds} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink-hair pt-3">
          <a
            href={`/p/${post.id}#comments`}
            className="text-[12px] font-bold text-ink-faint no-underline hover:text-ink"
          >
            💬 {post.commentCount > 0 ? post.commentCount : ''} Comment
            {post.commentCount === 1 ? '' : 's'}
          </a>

          {/* A coach cannot repost their own system — the database refuses it,
              so the button is not offered. See `studio_reposts_not_own`. */}
          {!mine && (
            <button
              type="button"
              onClick={() => (reposted ? void undo() : setComposing((v) => !v))}
              disabled={!owner || busy}
              title={owner ? undefined : 'Sign in to repost'}
              className={`text-[12px] font-bold transition-colors ${
                reposted ? 'text-green' : 'text-ink-faint hover:text-ink'
              } disabled:cursor-default disabled:hover:text-ink-faint`}
            >
              🔁 {post.repostCount > 0 ? post.repostCount : ''} {reposted ? 'Reposted' : 'Repost'}
            </button>
          )}

          <a
            href={`/p/${post.id}`}
            className="ml-auto text-[12px] font-bold text-ink no-underline hover:underline"
          >
            Open it →
          </a>
        </div>

        {composing && !reposted && (
          <div className="mt-3 rounded-xl border border-ink-hair bg-paper p-3">
            <label className="block">
              <span className="text-[11px] font-bold text-ink-soft">
                Say why you are passing it on
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 280))}
                rows={2}
                placeholder="What you would change, who it is for, where it worked."
                className="mt-1.5 w-full resize-y rounded-md border border-ink-hair bg-surface px-2.5 py-1.5 text-[13px] leading-relaxed text-ink outline-none focus:border-ink-faint"
              />
            </label>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[11px] text-ink-faint">
                Optional, and worth more than the system’s own summary to the next reader.
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComposing(false)}
                  className="rounded-md px-2.5 py-1.5 text-[12px] font-bold text-ink-soft hover:bg-ink-hair"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={busy}
                  className="rounded-md bg-ink px-3 py-1.5 text-[12px] font-bold text-paper disabled:opacity-40"
                >
                  {busy ? 'Reposting' : 'Repost'}
                </button>
              </span>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
