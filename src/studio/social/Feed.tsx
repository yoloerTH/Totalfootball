/**
 * Everything coaches have published, newest first.
 *
 * ── THIS IS THE PLAINEST HONEST VERSION, AND THAT IS ON PURPOSE ──────────────
 *
 * The feed's design — what a card shows, whether there is a like, whether there
 * is a repost, how ranking works — is the conversation after this one (user,
 * 2026-09-04), and docs/SOCIAL.md §0a is emphatic that the mechanics are what
 * decide whether the quality of what gets posted goes up or down. So nothing
 * here pretends to have answered that. It lists what exists, newest first, and
 * it exists so the portal's invitation has somewhere to land.
 *
 * WHAT IT DELIBERATELY DOES NOT DO YET: no board thumbnails, because `listFeed`
 * does not fetch documents and a card that pulled a 40KB jsonb each would make
 * the list cost a megabyte to read. When the design lands, the right answer is
 * a rendered still on the row (§5a's rasteriser) and not a document per card.
 *
 * ── THE COLD START IS THE REAL RISK HERE, NOT THE LAYOUT ─────────────────────
 *
 * §7: a feed with nothing in it is dead, and the first coach to arrive at an
 * empty one does not come back. Until there is something to show, the empty
 * state says so in plain words and points at the thing a coach CAN do, which is
 * publish one of their own. It never says "no results", which reads as a broken
 * search rather than a young product.
 */

import { useEffect, useState } from 'react'
import { listFeed, type PostCard } from '../posts'
import { Mark } from '../viewer/Mark'

type State = 'loading' | 'ready'

function when(iso: string): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? 'a month ago' : `${months} months ago`
}

export default function Feed() {
  const [posts, setPosts] = useState<PostCard[]>([])
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    let live = true
    void listFeed().then((rows) => {
      if (!live) return
      setPosts(rows)
      setState('ready')
    })
    return () => {
      live = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <header className="border-b border-ink-hair pb-6">
        <a
          href="/studio/portal/"
          className="text-[13px] font-bold text-ink-soft no-underline hover:text-ink"
        >
          ‹ Your systems
        </a>
        <h1 className="mt-3 flex items-center gap-3 text-title font-black tracking-display text-ink">
          <Mark size={26} />
          Published systems
        </h1>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          Work other coaches have chosen to put in the open. Everything here was published on
          purpose, by somebody who owns it.
        </p>
      </header>

      {state === 'loading' && <p className="mt-8 text-[13px] text-ink-faint">Loading…</p>}

      {state === 'ready' && posts.length === 0 && (
        <div className="mt-10 rounded-2xl border border-ink-hair bg-paper p-6">
          <p className="text-[15px] font-bold text-ink">Nothing published yet.</p>
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-ink-soft">
            This is new. The first systems here will be the ones coaches decide are worth other
            people reading, and yours can be one of them — open a system on your shelf and press
            Publish.
          </p>
          <a
            href="/studio/portal/"
            className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-paper no-underline"
          >
            Go to your systems
          </a>
        </div>
      )}

      {posts.length > 0 && (
        <ul className="mt-8 grid list-none grid-cols-1 gap-4 p-0">
          {posts.map((post) => (
            <li key={post.id}>
              <a
                href={`/p/${post.id}`}
                className="block rounded-2xl border border-ink-hair bg-paper p-5 no-underline transition-colors hover:border-ink/25"
              >
                <span className="block text-[16px] font-bold leading-tight text-ink">
                  {post.title}
                </span>
                {post.summary && (
                  <span className="mt-2 block text-[13px] leading-relaxed text-ink-soft">
                    {post.summary}
                  </span>
                )}
                <span className="mt-3 block text-[12px] text-ink-faint">{when(post.publishedAt)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
