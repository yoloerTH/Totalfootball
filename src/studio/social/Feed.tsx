/**
 * The feed: what coaches have published, ranked or dated.
 *
 * ── FEATURED IS ARITHMETIC AND THE PAGE SAYS SO ──────────────────────────────
 *
 * The ranking is one line of SQL in supabase/025 — what a post has earned, over
 * how long it has had — and the footnote at the bottom of this page states it
 * in a sentence. That is not a technical detail leaking into the product: a
 * coach deciding whether to put a week of their thinking in public is entitled
 * to know what decides who sees it, and "our algorithm" as an unexplained
 * proper noun is how every other network lost that trust.
 *
 * ── THE TAB IS IN THE URL ────────────────────────────────────────────────────
 *
 * `?tab=recent`, read on mount and written on every change. So Recent can be
 * linked to, sent to somebody, and survives a reload — and a coach who prefers
 * it can bookmark it. It is one line of history API and it is the difference
 * between a view and a mode.
 *
 * ── AND THE EMPTY STATE IS THE MOST IMPORTANT SCREEN HERE ────────────────────
 *
 * §7: a feed with nothing in it is dead. Until there is something to show, this
 * says so in plain words and points at the one thing a coach can actually do
 * about it — publish one of their own. It never says "no results", which reads
 * as a broken search rather than a young network.
 */

import { useCallback, useEffect, useState } from 'react'
import { PostCard } from './PostCard'
import { FeedTabs, SocialShell } from './SocialShell'
import { loadFeed, myReposts, type FeedMode, type FeedPost } from './api'
import { useSession } from '../account/session'

const PAGE = 12

function modeFromUrl(): FeedMode {
  if (typeof window === 'undefined') return 'featured'
  return new URLSearchParams(window.location.search).get('tab') === 'recent'
    ? 'recent'
    : 'featured'
}

export default function Feed() {
  const { user } = useSession()
  const owner = user?.id ?? ''

  const [mode, setMode] = useState<FeedMode>(modeFromUrl)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [reposted, setReposted] = useState<Set<string>>(new Set())
  const [state, setState] = useState<'loading' | 'ready'>('loading')
  const [more, setMore] = useState(false)

  const read = useCallback(
    async (which: FeedMode, offset: number) => {
      const rows = await loadFeed(which, PAGE, offset)
      setPosts((prev) => (offset === 0 ? rows : [...prev, ...rows]))
      setMore(rows.length === PAGE)
      setState('ready')

      // Which of these the reader has already reposted, in ONE query rather
      // than one per card. The feed row cannot carry it the way it carries
      // `mine`, because a repost is a row about the reader and the post both.
      if (owner && rows.length) {
        const found = await myReposts(
          owner,
          rows.map((r) => r.id),
        )
        setReposted((prev) => new Set([...prev, ...found]))
      }
    },
    [owner],
  )

  useEffect(() => {
    setState('loading')
    void read(mode, 0)
  }, [mode, read])

  const choose = (next: FeedMode) => {
    setMode(next)
    const url = new URL(window.location.href)
    if (next === 'recent') url.searchParams.set('tab', 'recent')
    else url.searchParams.delete('tab')
    window.history.replaceState({}, '', url)
  }

  return (
    <SocialShell
      title="The network"
      note="Systems coaches have chosen to put in the open. Everything here was published on purpose, by somebody who owns it."
      tabs={<FeedTabs mode={mode} onMode={choose} />}
    >
      {state === 'loading' && <p className="mt-8 text-[13px] text-ink-faint">Loading…</p>}

      {state === 'ready' && posts.length === 0 && (
        <div className="mt-8 rounded-2xl border border-ink-hair bg-surface p-6">
          <p className="text-[15px] font-bold text-ink">Nothing published yet.</p>
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-ink-soft">
            This is new. The first systems here will be the ones coaches decided were worth other
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
        <div className="mt-6 space-y-6">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              owner={owner}
              reposted={reposted.has(post.id)}
              onReposted={(id, now) =>
                setReposted((prev) => {
                  const copy = new Set(prev)
                  if (now) copy.add(id)
                  else copy.delete(id)
                  return copy
                })
              }
            />
          ))}
        </div>
      )}

      {more && (
        <button
          type="button"
          onClick={() => void read(mode, posts.length)}
          className="mt-6 w-full rounded-full border border-ink-hair py-3 text-[13px] font-bold text-ink-soft transition-colors hover:bg-ink-hair hover:text-ink"
        >
          Show more
        </button>
      )}

      {posts.length > 0 && (
        <p className="mt-10 border-t border-ink-hair pt-5 text-[12px] leading-relaxed text-ink-faint">
          {mode === 'featured'
            ? 'Featured is what a system has earned — reactions, comments and reposts, with a repost counting most — divided by how long it has been up. Nothing is picked by hand, and nothing is paid for.'
            : 'Most recent is everything, newest first, with no ranking applied at all.'}
        </p>
      )}
    </SocialShell>
  )
}
