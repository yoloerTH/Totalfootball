/**
 * A published system, as a stranger sees it. `/p/k7f3q9`.
 *
 * ── WHY THIS IS NOT ./Viewer.tsx AND NOT ../editor/LockedStudio.tsx ──────────
 *
 * The viewer is a PRESENTATION surface: a coach stands in front of a room and
 * steps through phases, and it hides the site's own navigation so nothing of
 * ours is on the wall behind them. The locked studio is the TOOL, opened by
 * somebody who is about to take a system apart.
 *
 * This is a PAGE ABOUT A SYSTEM, read by somebody who has never heard of us and
 * arrived from a link. It needs the board, the phases, who made it and what
 * they say it is for — and it needs the way in, because a reader who liked what
 * they saw is the only growth this product has. Neither of the other two is
 * that page, and bending one into it would cost both.
 *
 * ── THE PHOTOGRAPHS COME FROM A DIFFERENT BUCKET, AND THAT IS LOAD-BEARING ───
 *
 * The studio resolves `Token.photo` through `useSquadPhotos`, which SIGNS a
 * private object with the coach's session. Nobody reading this page has one. A
 * published post's faces were copied into the public bucket at publish time and
 * are resolved by `publishedPhotoUrls`. Reusing the studio's hook here would
 * quietly produce a board with no faces on it — and reusing this one in the
 * studio would produce broken images. See ../posts.ts.
 */

import { useEffect, useMemo, useState } from 'react'
import { Board } from '../board/Board'
import { resolveAct } from '../tween'
import { loadPost, postIdFromPath, publishedPhotoUrls, type Post } from '../posts'
import { loadPublicProfile, type PublicProfile } from '../account/cloud'
import { licenceLabel, roleLabel } from '../account/identity'
import { imageUrl } from '../account/images'
import { Mark } from './Mark'

type State = 'loading' | 'ready' | 'missing'

export default function PostView() {
  const [post, setPost] = useState<Post | null>(null)
  const [author, setAuthor] = useState<PublicProfile | null>(null)
  const [state, setState] = useState<State>('loading')
  const [index, setIndex] = useState(0)
  const [copied, setCopied] = useState(false)

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
      setState('ready')
    })
    return () => {
      live = false
    }
  }, [])

  // Resolved from the post's owner rather than from anything in the document:
  // the document may have been published with no name on it at all, and the
  // link to a coach's profile is a fact about the row, not about the board.
  useEffect(() => {
    if (!post?.owner) return
    let live = true
    void authorOf(post.owner).then((p) => {
      if (live) setAuthor(p)
    })
    return () => {
      live = false
    }
  }, [post?.owner])

  const system = post?.doc ?? null
  const photoHrefs = useMemo(() => (system ? publishedPhotoUrls(system) : {}), [system])
  const acts = system?.acts ?? []
  const act = acts[Math.min(index, Math.max(acts.length - 1, 0))]

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        <p className="text-[13px] text-ink-faint">Opening…</p>
      </div>
    )
  }

  // A post that was taken down, a link-only post whose id was mistyped and a
  // string that was never a post all say the same thing. Telling them apart
  // would be a way to find out what used to be here.
  if (state === 'missing' || !post || !system) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h1 className="text-title font-black tracking-display text-ink">Nothing here</h1>
        <p className="mx-auto mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          This link does not open a system. It may have been taken down, or the address may have a
          character out of place.
        </p>
        <a
          href="/studio/"
          className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-paper no-underline"
        >
          Open the studio
        </a>
      </div>
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const crest = imageUrl(author?.crestPath)
  const avatar = imageUrl(author?.avatarPath)

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <h1 className="text-title font-black tracking-display text-ink">{post.title}</h1>
      {post.summary && (
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">{post.summary}</p>
      )}

      {/* Who made it. Only ever a link when there is a profile to land on —
          an unlisted or private coach gets their name in plain text, which is
          what the document already says on the board's own credit bar. */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {(avatar || crest) && (
          <span className="flex -space-x-2">
            {avatar && (
              <img
                src={avatar}
                alt=""
                className="h-9 w-9 rounded-full border border-ink-hair object-cover"
              />
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
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-full border border-ink-hair px-3.5 py-2 text-[12px] font-bold text-ink-soft transition-colors hover:bg-ink-hair hover:text-ink"
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </span>
      </div>

      {/* The board. `idp` is per-mount, as everywhere else that draws one: the
          gradient and clip ids inside it are document-global, and two boards
          sharing a prefix clip each other's counters. */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-ink-hair bg-paper">
        {act && <Board system={system} act={resolveAct(act)} idp="post" photoHrefs={photoHrefs} />}
      </div>

      {acts.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {acts.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index}
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
                i === index
                  ? 'bg-ink text-paper'
                  : 'border border-ink-hair text-ink-soft hover:bg-ink-hair hover:text-ink'
              }`}
            >
              {a.title?.trim() || `Phase ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* The way in. A reader who got this far is the only growth this thing
          has, and a page that shows them somebody else's work without telling
          them where it was made has wasted the visit. */}
      <div className="mt-10 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-hair bg-paper p-5">
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
  if (!supabase) return null
  const { data, error } = await supabase
    .from('studio_profiles')
    .select('handle')
    .eq('id', owner)
    .maybeSingle()
  if (error || !data?.handle) return null
  return loadPublicProfile(data.handle as string)
}
