/**
 * The five reactions, and what a post has earned.
 *
 * ── WHAT IT SHOWS WHEN NOBODY HAS REACTED YET ────────────────────────────────
 *
 * All five, greyed, with no numbers. Not a hidden control that appears on
 * hover, and not a single "react" button that opens a menu: the whole point of
 * having five is that a reader sees the vocabulary before they have an opinion,
 * and learns that this network asks a better question than "did you like it".
 * A menu would hide exactly the thing worth showing.
 *
 * Once a kind has been used, its count sits beside it. A zero is never drawn —
 * "Golazo 0" reads as a verdict, and it is not one.
 *
 * ── OPTIMISTIC, AND HONEST ABOUT IT ─────────────────────────────────────────
 *
 * A tap moves the count immediately and calls the database afterwards; a
 * refusal puts it back. A reaction that waits on a round trip before it moves
 * feels broken on a train, and the failure it is guarding against — RLS
 * refusing the write — is one a signed-in coach on a public post will not hit.
 *
 * ── SIGNED OUT IS NOT AN ERROR STATE ─────────────────────────────────────────
 *
 * A stranger reading a shared link can see every count and press nothing. The
 * bar tells them what pressing would need, once, in the tooltip — it does not
 * throw a sign-in wall in front of somebody who came to look at a board.
 */

import { useState } from 'react'
import { REACTIONS } from './reactions'
import { react } from './api'

export function ReactionBar({
  post,
  owner,
  mine,
  kinds,
  /** Tight, for a card in a grid. Roomy, for the post page. */
  size = 'card',
}: {
  post: string
  /** The reading coach, or '' when nobody is signed in. */
  owner: string
  mine: string
  kinds: Record<string, number>
  size?: 'card' | 'page'
}) {
  const [chosen, setChosen] = useState(mine)
  const [counts, setCounts] = useState<Record<string, number>>(kinds)
  const [busy, setBusy] = useState(false)

  const tap = async (id: string) => {
    if (!owner || busy) return
    // Pressing the one already chosen takes it back. A reaction a coach cannot
    // withdraw is a reaction they will think twice about giving.
    const next = chosen === id ? '' : id
    const before = { chosen, counts }

    setChosen(next)
    setCounts((c) => {
      const copy = { ...c }
      if (before.chosen) copy[before.chosen] = Math.max((copy[before.chosen] ?? 1) - 1, 0)
      if (next) copy[next] = (copy[next] ?? 0) + 1
      return copy
    })

    setBusy(true)
    const ok = await react(post, owner, next)
    setBusy(false)
    if (!ok) {
      setChosen(before.chosen)
      setCounts(before.counts)
    }
  }

  const pad = size === 'page' ? 'px-3 py-2 text-[13px]' : 'px-2 py-1.5 text-[12px]'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {REACTIONS.map((r) => {
        const n = counts[r.id] ?? 0
        const on = chosen === r.id
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => void tap(r.id)}
            disabled={!owner}
            aria-pressed={on}
            title={owner ? r.meaning : `${r.meaning} Sign in to react.`}
            className={`inline-flex items-center gap-1.5 rounded-full border font-bold transition-colors ${pad} ${
              on
                ? 'border-green bg-green/15 text-ink'
                : 'border-ink-hair text-ink-faint hover:border-ink/25 hover:text-ink disabled:hover:border-ink-hair disabled:hover:text-ink-faint'
            } ${owner ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <span aria-hidden="true">{r.glyph}</span>
            <span className={size === 'card' ? 'hidden sm:inline' : ''}>{r.label}</span>
            {n > 0 && <span className="tabular-nums">{n}</span>}
          </button>
        )
      })}
    </div>
  )
}
