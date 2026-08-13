/**
 * The portal: everything a coach has built, and the way into a new one.
 *
 * This is not the studio and must not try to be. The studio is a tool you are
 * inside; this is the shelf you take things off. So: no board controls, no
 * tools, nothing that edits a document. One decision per card — open it — and
 * the rest of the row behind a hover.
 *
 * THE THUMBNAILS ARE REAL BOARDS. Each card renders the system's first phase
 * through the same `Board` the editor and the viewer use, at card size. It
 * costs an SVG per card and it is worth it: a coach recognises their own 4-3-3
 * instantly and cannot recognise "System 4 — 3 phases" at all. It also means a
 * shelf of systems is the first thing they see that looks like the videos.
 *
 * WHAT HAPPENS ON FIRST SIGN-IN. The studio works with no account, so the
 * ordinary path is: build something, like it, then sign up. `claimLocalSystems`
 * runs before the first list and moves whatever is in this browser into the
 * account, keeping ids. If that did not happen, signing up would be the moment
 * a coach's work vanished, and adoption-first would be worse than a login wall.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Board } from '../board/Board'
import { PITCH_VIEWS, aspect, resolveViewId } from '../board/pitch'
import type { System } from '../schema'
import { listSystems, newSystemId, saveSystem, deleteSystem as deleteLocal } from '../storage'
import { STUDIO_EVENTS, track } from '../track'
import { resolveAct } from '../tween'
import { useSession, signOut } from './session'
import {
  claimLocalSystems,
  deleteCloudSystem,
  listCloudSystems,
  saveCloudSystem,
  type CloudSystem,
} from './cloud'

type Load = 'working' | 'ready' | 'local-only'

export default function Portal() {
  const { status, user } = useSession()
  const [systems, setSystems] = useState<CloudSystem[]>([])
  const [load, setLoad] = useState<Load>('working')
  const [claimed, setClaimed] = useState(0)

  // Signed out: go and sign in, and come back here afterwards.
  useEffect(() => {
    if (status !== 'out') return
    const next = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.replace(`/studio/login/?next=${next}`)
  }, [status])

  const refresh = useCallback(async (owner: string, claim: boolean) => {
    if (claim) {
      const n = await claimLocalSystems(owner)
      if (n) setClaimed(n)
    }
    const rows = await listCloudSystems()
    if (rows.length > 0) {
      setSystems(rows)
      setLoad('ready')
      return
    }
    /*
     * An empty list is ambiguous — a new account and an unreachable server look
     * identical from here. Falling back to what is on this machine is both the
     * safer read and the more useful one: it is never wrong to show a coach the
     * work that is on the laptop in front of them.
     */
    const local = listSystems()
    setSystems(local.map((l) => ({ id: l.id, system: l.system, updated: l.updated })))
    setLoad(local.length ? 'local-only' : 'ready')
  }, [])

  useEffect(() => {
    if (status !== 'in' || !user) return
    void refresh(user.id, true)
  }, [status, user, refresh])

  const create = useCallback(() => {
    // Written locally before we navigate, so the editor opens on a real
    // document even if the network is having a bad day. The write-through cache
    // in the editor pushes it up from there.
    track(STUDIO_EVENTS.newSystem)
    const id = newSystemId()
    window.location.href = `/studio/new/?s=${encodeURIComponent(id)}`
  }, [])

  const duplicate = useCallback(
    async (row: CloudSystem) => {
      if (!user) return
      const id = newSystemId()
      const copy: System = {
        ...structuredClone(row.system),
        title: row.system.title ? `${row.system.title} (copy)` : '',
        // A copy is not published. Keeping the shareId would mean pressing
        // Share on the duplicate silently overwrote the original's link.
        shareId: undefined,
      }
      saveSystem(id, copy)
      await saveCloudSystem(id, copy, user.id)
      void refresh(user.id, false)
    },
    [user, refresh],
  )

  const rename = useCallback(
    async (row: CloudSystem, title: string) => {
      if (!user) return
      const next = { ...row.system, title }
      setSystems((s) => s.map((r) => (r.id === row.id ? { ...r, system: next } : r)))
      saveSystem(row.id, next)
      await saveCloudSystem(row.id, next, user.id)
    },
    [user],
  )

  const remove = useCallback(
    async (row: CloudSystem) => {
      setSystems((s) => s.filter((r) => r.id !== row.id))
      deleteLocal(row.id)
      await deleteCloudSystem(row.id)
    },
    [],
  )

  if (status !== 'in') {
    return (
      <Centre>
        <p className="text-micro uppercase text-ink-faint">
          {status === 'unknown' ? 'Opening your shelf…' : 'Taking you to sign in…'}
        </p>
      </Centre>
    )
  }

  return (
    <div className="mx-auto max-w-shell px-5 py-10 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-hair pb-6">
        <div>
          <p className="text-micro uppercase text-ink-faint">Your systems</p>
          <h1 className="mt-2 text-title font-black tracking-display text-ink">
            {systems.length === 0
              ? 'Nothing on the shelf yet'
              : `${systems.length} system${systems.length === 1 ? '' : 's'}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/studio/settings/"
            className="rounded-lg px-3 py-2 text-sm font-bold text-ink-soft no-underline transition-colors hover:bg-ink-hair hover:text-ink"
          >
            Settings
          </a>
          <button
            type="button"
            onClick={() => void signOut().then(() => window.location.replace('/studio/'))}
            className="rounded-lg px-3 py-2 text-sm font-bold text-ink-soft transition-colors hover:bg-ink-hair hover:text-ink"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={create}
            className="rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-paper transition-opacity hover:opacity-90"
          >
            New system
          </button>
        </div>
      </header>

      {claimed > 0 && (
        <p className="mt-5 rounded-lg bg-green/10 px-4 py-3 text-[13px] leading-relaxed text-ink">
          <span className="font-bold">
            {claimed} system{claimed === 1 ? '' : 's'} from this browser {claimed === 1 ? 'is' : 'are'} now
            on your account.
          </span>{' '}
          They will be here on any machine you sign in from.
        </p>
      )}

      {load === 'local-only' && (
        <p className="mt-5 rounded-lg bg-gold/10 px-4 py-3 text-[13px] leading-relaxed text-ink">
          <span className="font-bold">Showing what is on this machine.</span> We could not reach your
          account just now — nothing is lost, and these will sync when the connection comes back.
        </p>
      )}

      {load === 'working' ? (
        <Centre>
          <p className="text-micro uppercase text-ink-faint">Fetching your systems…</p>
        </Centre>
      ) : systems.length === 0 ? (
        <Empty onNew={create} />
      ) : (
        <ul className="mt-8 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {systems.map((row) => (
            <Card
              key={row.id}
              row={row}
              onDuplicate={() => void duplicate(row)}
              onRename={(t) => void rename(row, t)}
              onDelete={() => void remove(row)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// ── one system ───────────────────────────────────────────────────────────────

function Card({
  row,
  onDuplicate,
  onRename,
  onDelete,
}: {
  row: CloudSystem
  onDuplicate: () => void
  onRename: (title: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row.system.title)
  const [confirming, setConfirming] = useState(false)

  const view = PITCH_VIEWS[resolveViewId(row.system.pitch)]
  const first = row.system.acts[0]
  const href = `/studio/new/?s=${encodeURIComponent(row.id)}`
  const phases = row.system.acts.length

  // Every board on the page shares one <defs> namespace unless they are told
  // apart, and two boards with the same gradient ids paint each other's colours.
  const idp = useMemo(() => `card-${row.id}`, [row.id])

  return (
    <li className="group relative overflow-hidden rounded-xl border border-ink-hair bg-surface shadow-paper transition-shadow hover:shadow-lift">
      <a href={href} className="block no-underline" aria-label={`Open ${row.system.title || 'this system'}`}>
        <div className="w-full bg-paper" style={{ aspectRatio: aspect(view) }}>
          {first && <Board system={row.system} act={resolveAct(first)} idp={idp} />}
        </div>
      </a>

      <div className="border-t border-ink-hair p-4">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditing(false)
              if (draft !== row.system.title) onRename(draft)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                setDraft(row.system.title)
                setEditing(false)
              }
            }}
            maxLength={80}
            className="w-full rounded-md border border-ink-hair bg-paper px-2 py-1 text-[15px] font-bold text-ink outline-none"
          />
        ) : (
          <a href={href} className="block truncate text-[15px] font-bold leading-tight text-ink no-underline">
            {row.system.title || 'Untitled system'}
          </a>
        )}

        <p className="mt-1 text-[12px] text-ink-faint">
          {phases} phase{phases === 1 ? '' : 's'} · {when(row.updated)}
        </p>

        {/* Kept out of the tab order until the card is focused or hovered, so
            tabbing through a shelf of twelve systems is twelve stops and not
            forty-eight. */}
        <div className="mt-3 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <Small onClick={() => setEditing(true)}>Rename</Small>
          <Small onClick={onDuplicate}>Duplicate</Small>
          {confirming ? (
            <Small danger onClick={onDelete}>
              Yes, delete it
            </Small>
          ) : (
            <Small danger onClick={() => setConfirming(true)}>
              Delete
            </Small>
          )}
        </div>
      </div>
    </li>
  )
}

function Small({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-[12px] font-bold transition-colors ${
        danger ? 'text-ink-faint hover:bg-ink-hair hover:text-[#E2473B]' : 'text-ink-faint hover:bg-ink-hair hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * The empty state, which is the most important screen in the portal.
 *
 * A blank shelf with one button is the moment a coach decides whether this is
 * for them, and "New system" alone asks them to invent something on the spot.
 * The second door is the library: we have systems worth opening, and starting
 * from a finished one is how most people learn a tool they did not ask for.
 */
function Empty({ onNew }: { onNew: () => void }) {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-ink-hair bg-paper px-6 py-16 text-center">
      <h2 className="text-section font-black tracking-display text-ink">Build your first one</h2>
      <p className="mx-auto mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
        A system is a board posed phase by phase. Put your shape down, move it to where the ball takes
        it, and the movement between the two comes back as film.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onNew}
          className="rounded-lg bg-ink px-5 py-3 text-sm font-bold text-paper transition-opacity hover:opacity-90"
        >
          Start a new system
        </button>
        <a
          href="/library/"
          className="rounded-lg border border-ink-hair px-5 py-3 text-sm font-bold text-ink no-underline transition-colors hover:bg-ink-hair"
        >
          Look at one of ours first
        </a>
      </div>
    </div>
  )
}

function Centre({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50vh] items-center justify-center">{children}</div>
}

/**
 * "Today", "Yesterday", then a date.
 *
 * A shelf is read by recency, and "12 August 2026" makes a coach do the
 * subtraction themselves for the two answers they ask for most.
 */
function when(iso: string): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const day = 86_400_000
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const diff = midnight.getTime() - new Date(then).setHours(0, 0, 0, 0)
  if (diff <= 0) return 'today'
  if (diff <= day) return 'yesterday'
  if (diff < 7 * day) return `${Math.round(diff / day)} days ago`
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}
