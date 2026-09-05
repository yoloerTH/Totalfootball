/**
 * A published system, as a stranger sees it. `/p/k7f3q9`.
 *
 * ── WHY THIS IS NOT ./Viewer.tsx AND NOT ../editor/LockedStudio.tsx ──────────
 *
 * The viewer is a PRESENTATION surface: a coach stands in front of a room and
 * steps through phases, and it hides the site's own navigation so nothing of
 * ours is on the wall behind them. The locked studio is the TOOL, opened by
 * somebody about to take a system apart.
 *
 * This is a PAGE ABOUT A SYSTEM, read by somebody who arrived from a link and
 * may never have heard of us. It needs the board, who made it, what other
 * coaches said about it, and the way in — because a reader who liked what they
 * saw is the only growth this product has.
 *
 * ── IT PLAYS THE WAY THE COACH PUBLISHED IT, UNTIL THE READER TAKES OVER ─────
 *
 * A 'video' post runs; an 'image' post holds its cover phase. Pressing a phase
 * button stops the run and pins that phase, because a reader who has started
 * navigating has stopped watching, and a board that keeps animating under their
 * hand is fighting them. Pressing Play hands it back.
 *
 * ── THE PHOTOGRAPHS COME FROM A DIFFERENT BUCKET, AND THAT IS LOAD-BEARING ───
 *
 * The studio resolves `Token.photo` through `useSquadPhotos`, which SIGNS a
 * private object with the coach's session. Nobody reading this page has one. A
 * published post's faces were copied into the public bucket at publish time and
 * are resolved by `publishedPhotoUrls` inside `BoardMedia`. Reusing the
 * studio's hook here would quietly draw a board with no faces on it.
 */

import { useEffect, useState } from 'react'
import { BoardMedia } from '../social/BoardMedia'
import { Comments, ReportBox } from '../social/Comments'
import { ReactionBar } from '../social/ReactionBar'
import { when } from '../social/PostCard'
import { loadReactions, myReposts, repost, unrepost } from '../social/api'
import { loadPost, postIdFromPath, type Post } from '../posts'
import { loadPublicProfile, type PublicProfile } from '../account/cloud'
import { licenceLabel, roleLabel } from '../account/identity'
import { imageUrl } from '../account/images'
import { useSession } from '../account/session'
import { Mark } from './Mark'

type State = 'loading' | 'ready' | 'missing'

export default function PostView() {
  const { user } = useSession()
  const owner = user?.id ?? ''

  const [post, setPost] = useState<Post | null>(null)
  const [author, setAuthor] = useState<PublicProfile | null>(null)
  const [state, setState] = useState<State>('loading')
  /** A phase the reader has pinned, or null while it plays as published. */
  const [pinned, setPinned] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [reactions, setReactions] = useState<{ kinds: Record<string, number>; mine: string }>({
    kinds: {},
    mine: '',
  })
  const [reposted, setReposted] = useState(false)
  const [reporting, setReporting] = useState(false)

  useEffect(() => {
    let live = true
    const id = postIdFromPath(window.location.pathname, window.location.search)
    if (!id) {
      setState('missing')
      return
    }
    void loadPost(id).then((found) => {
      if (!live) return
      if (!found) {
        setState('missing')
        return
      }
      setPost(found)
      setPinned(found.media === 'image' ? found.coverAct : null)
      setState('ready')
    })
    return () => {
      live = false
    }
  }, [])

  // The author, the reactions and this reader's repost, all after the post and
  // none of them blocking it. A post whose author read fails is still a post.
  useEffect(() => {
    if (!post) return
    let live = true
    void authorOf(post.owner).then((p) => live && setAuthor(p))
    void loadReactions(post.id, owner).then((r) => live && setReactions(r))
    if (owner) void myReposts(owner, [post.id]).then((s) => live && setReposted(s.has(post.id)))
    return () => {
      live = false
    }
  }, [post, owner])

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        <p className="text-[13px] text-ink-faint">Opening…</p>
      </div>
    )
  }

  // A post taken down, a link-only post whose id was mistyped and a string that
  // was never a post all say the same thing. Telling them apart would be a way
  // to find out what used to be here.
  if (state === 'missing' || !post) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h1 className="text-title font-black tracking-display text-ink">Nothing here</h1>
        <p className="mx-auto mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          This link does not open a system. It may have been taken down, or the address may have a
          character out of place.
        </p>
        <a
          href="/feed/"
          className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-paper no-underline"
        >
          See what else is published
        </a>
      </div>
    )
  }

  const system = post.doc
  const acts = system.acts ?? []
  const crest = imageUrl(author?.crestPath)
  const avatar = imageUrl(author?.avatarPath)
  const mine = owner && owner === post.owner

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const toggleRepost = async () => {
    if (!owner) return
    const ok = reposted ? await unrepost(post.id, owner) : await repost(post.id, owner, '')
    if (ok) setReposted(!reposted)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-5 sm:py-12">
      <a
        href="/feed/"
        className="mb-6 inline-flex items-center gap-2 text-[12px] font-bold text-ink-faint no-underline hover:text-ink"
      >
        <Mark size={16} />
        The network
      </a>

      <h1 className="text-title font-black tracking-display text-ink">{post.title}</h1>
      {post.summary && (
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">{post.summary}</p>
      )}

      {/* Who made it. A link only when there is a public profile to land on —
          an unlisted or private coach gets their name in plain text, because a
          link to a page that does not open is a 404 with their name on it. */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {(avatar || crest) && (
          <span className="flex -space-x-2">
            {avatar && (
              <img src={avatar} alt="" className="h-9 w-9 rounded-full border border-ink-hair object-cover" />
            )}
            {crest && (
              <img
                src={crest}
                alt=""
                className="h-9 w-9 rounded-full border border-ink-hair bg-surface object-contain p-1"
              />
            )}
          </span>
        )}
        <div className="min-w-0">
          {author ? (
            <a
              href={`/c/${author.handle}`}
              className="text-[14px] font-bold text-ink no-underline hover:underline"
            >
              {author.presenter || `@${author.handle}`}
            </a>
          ) : (
            <span className="text-[14px] font-bold text-ink">
              {system.credit?.presenter || 'A coach on Total Football'}
            </span>
          )}
          <p className="text-[12px] text-ink-faint">
            {[
              author?.team || system.credit?.team,
              roleLabel(author?.role),
              licenceLabel(author?.licence),
              when(post.publishedAt),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="ml-auto rounded-full border border-ink-hair px-3.5 py-2 text-[12px] font-bold text-ink-soft transition-colors hover:bg-ink-hair hover:text-ink"
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-ink-hair bg-paper">
        <BoardMedia
          system={system}
          media={pinned === null ? post.media : 'image'}
          coverAct={pinned === null ? post.coverAct : pinned}
          idp="post"
        />
      </div>

      {acts.length > 1 && (
        <PhaseRail
          acts={acts}
          pinned={pinned}
          canPlay={post.media === 'video'}
          onPin={setPinned}
          onPlay={() => setPinned(null)}
        />
      )}

      {/* The phase's own words, when the reader has pinned one. The board says
          what happens; these say why, and they are the part a coach writes. */}
      {pinned !== null && acts[pinned] && (acts[pinned].caption || acts[pinned].notes) && (
        <div className="mt-4 rounded-xl border border-ink-hair bg-surface p-4">
          {acts[pinned].caption && (
            <p className="text-[14px] font-bold leading-snug text-ink">{acts[pinned].caption}</p>
          )}
          {acts[pinned].notes && (
            <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">
              {acts[pinned].notes}
            </p>
          )}
        </div>
      )}

      <div className="mt-6">
        <ReactionBar
          post={post.id}
          owner={owner}
          mine={reactions.mine}
          kinds={reactions.kinds}
          size="page"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-ink-hair pt-4">
        {!mine && (
          <button
            type="button"
            onClick={() => void toggleRepost()}
            disabled={!owner}
            title={owner ? undefined : 'Sign in to repost'}
            className={`text-[12px] font-bold transition-colors ${
              reposted ? 'text-green' : 'text-ink-faint hover:text-ink'
            } disabled:cursor-default`}
          >
            🔁 {post.repostCount > 0 ? post.repostCount : ''} {reposted ? 'Reposted' : 'Repost'}
          </button>
        )}
        {owner && !mine && (
          <button
            type="button"
            onClick={() => setReporting((v) => !v)}
            className="text-[12px] font-bold text-ink-faint hover:text-ink"
          >
            Report
          </button>
        )}
        <span className="ml-auto text-[12px] text-ink-faint">
          {post.forkCount > 0 && `${post.forkCount} forked · `}
          {acts.length} phase{acts.length === 1 ? '' : 's'}
        </span>
      </div>

      {reporting && (
        <ReportBox
          kind="post"
          target={post.id}
          reporter={owner}
          onDone={() => setReporting(false)}
        />
      )}

      <Comments
        post={post.id}
        owner={owner}
        postOwner={post.owner}
        myName={user?.email?.split('@')[0] ?? ''}
      />

      {/* The way in. A reader who got this far is the only growth this thing
          has, and a page that shows them somebody else's work without saying
          where it was made has wasted the visit. */}
      <div className="mt-12 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-hair bg-surface p-5">
        <Mark size={22} />
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-soft">
          Built in the Total Football studio. Boards like this one are free to make.
        </p>
        <a
          href="/studio/"
          className="rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-paper no-underline transition-opacity hover:opacity-90"
        >
          Build one
        </a>
      </div>
    </div>
  )
}

/**
 * Getting around the phases, at both sizes a system comes in.
 *
 * ── ONE CHIP PER PHASE STOPS WORKING AT ABOUT TWELVE ─────────────────────────
 *
 * A session is six phases and a chip each is perfect: every phase is named, and
 * the names ARE the argument. A film is forty-four, and forty-four chips is a
 * paragraph of buttons that pushes the reactions off the screen — measured on
 * the real 2-3-5 build-up document, which has 44.
 *
 * So a long system gets a scrubber instead: previous, next, a slider, and the
 * name of the phase you are on. Nothing is hidden that was not already
 * unreadable, and the one thing a reader of a long film actually does — move
 * through it in order — becomes one control rather than a hunt.
 */
function PhaseRail({
  acts,
  pinned,
  canPlay,
  onPin,
  onPlay,
}: {
  acts: { title?: string }[]
  pinned: number | null
  canPlay: boolean
  onPin: (i: number) => void
  onPlay: () => void
}) {
  const play = canPlay && (
    <button
      type="button"
      onClick={() => (pinned === null ? onPin(0) : onPlay())}
      className="shrink-0 rounded-full border border-ink-hair px-3 py-1.5 text-[12px] font-bold text-ink-soft transition-colors hover:bg-ink-hair hover:text-ink"
    >
      {pinned === null ? '⏸ Hold' : '▶ Play it'}
    </button>
  )

  if (acts.length <= 12) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {play}
        {acts.map((a, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPin(i)}
            aria-current={pinned === i}
            className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
              pinned === i
                ? 'bg-ink text-paper'
                : 'border border-ink-hair text-ink-soft hover:bg-ink-hair hover:text-ink'
            }`}
          >
            {a.title?.trim() || `Phase ${i + 1}`}
          </button>
        ))}
      </div>
    )
  }

  const at = pinned ?? 0
  const step = (delta: number) => onPin(Math.min(Math.max(at + delta, 0), acts.length - 1))

  return (
    <div className="mt-3 rounded-xl border border-ink-hair bg-surface p-3">
      <div className="flex items-center gap-2">
        {play}
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={at === 0}
          aria-label="Previous phase"
          className="rounded-full border border-ink-hair px-2.5 py-1.5 text-[12px] font-bold text-ink-soft disabled:opacity-30"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={at >= acts.length - 1}
          aria-label="Next phase"
          className="rounded-full border border-ink-hair px-2.5 py-1.5 text-[12px] font-bold text-ink-soft disabled:opacity-30"
        >
          ›
        </button>
        <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-ink">
          {acts[at]?.title?.trim() || `Phase ${at + 1}`}
        </span>
        <span className="shrink-0 text-[12px] tabular-nums text-ink-faint">
          {at + 1} / {acts.length}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={acts.length - 1}
        value={at}
        aria-label="Phase"
        onChange={(e) => onPin(Number(e.target.value))}
        className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-hair accent-gold outline-none"
      />
    </div>
  )
}

/**
 * The author's public profile, by account id.
 *
 * Goes through the TABLE and not through `studio_profile_by_handle`, because
 * this page does not know the handle — and that is the right restriction rather
 * than a gap to fill. The table policy (012) exposes public profiles only, so a
 * coach whose profile is private or link-only is not named here as a side
 * effect of publishing a system. They chose one of those states; a post must
 * not undo it.
 */
async function authorOf(owner: string): Promise<PublicProfile | null> {
  const { db } = await import('../account/client')
  const supabase = db()
  if (!supabase || !owner) return null
  const { data, error } = await supabase
    .from('studio_profiles')
    .select('handle')
    .eq('id', owner)
    .maybeSingle()
  if (error || !data?.handle) return null
  return loadPublicProfile(data.handle as string)
}
