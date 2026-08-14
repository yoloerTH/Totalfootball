/**
 * The portal: everything a coach has built, and the way into a new one.
 *
 * This is not the studio and must not try to be. The studio is a tool you are
 * inside; this is the shelf you take things off. So: no board controls, no
 * tools, nothing that edits a document. One decision per card — open it — and
 * the rest of the row kept quiet underneath.
 *
 * THE THUMBNAILS ARE REAL BOARDS. Each card renders the system's first phase
 * through the same `Board` the editor and the viewer use, at card size. It
 * costs an SVG per card and it is worth it: a coach recognises their own 4-3-3
 * instantly and cannot recognise "System 4 — 3 phases" at all. It also means a
 * shelf of systems is the first thing they see that looks like the videos.
 *
 * WHAT A CARD SAYS ABOUT ITS SYSTEM. Three things, and each is something a coach
 * cannot work out from the picture: how long it is, when they last touched it,
 * and whether it is out in the world. The last one used to be invisible, which
 * meant the only way to find out whether a system had a link — and therefore
 * whether editing it would change what somebody had already been sent — was to
 * open it and press Share.
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

/** The shape a card's picture takes before it has one. Also the new tile's. */
const CARD_ASPECT = aspect(PITCH_VIEWS[resolveViewId(undefined)])

/** Quiet chrome action — Settings, Sign out. Present, never competing. */
const QUIET =
  'rounded-full px-3.5 py-2 text-sm font-semibold text-ink-soft no-underline transition-colors hover:bg-ink-hair hover:text-ink'

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

  const remove = useCallback(async (row: CloudSystem) => {
    setSystems((s) => s.filter((r) => r.id !== row.id))
    deleteLocal(row.id)
    await deleteCloudSystem(row.id)
  }, [])

  /** The shelf in three numbers. Only the ones that are true get shown. */
  const tally = useMemo(() => {
    const phases = systems.reduce((n, r) => n + r.system.acts.length, 0)
    const shared = systems.filter((r) => r.system.shareId).length
    return { systems: systems.length, phases, shared }
  }, [systems])

  if (status !== 'in') {
    return (
      <Centre>{status === 'unknown' ? 'Opening your shelf…' : 'Taking you to sign in…'}</Centre>
    )
  }

  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
      <header className="border-b border-ink-hair pb-7">
        <p className="text-micro uppercase text-ink-faint">Your shelf</p>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
          <div>
            <h1 className="text-title font-black tracking-display text-ink">Your systems</h1>
            {load !== 'working' && systems.length > 0 && <Tally {...tally} />}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Which account this is. The one question the chrome can answer
                that the page cannot, and the reason a coach with a club address
                and a personal one ever knows which shelf they are looking at. */}
            {user?.email && (
              <span
                className="mr-2 hidden max-w-[15rem] truncate text-[13px] text-ink-faint lg:block"
                title={user.email}
              >
                {user.email}
              </span>
            )}
            <a href="/studio/settings/" className={QUIET}>
              Settings
            </a>
            <button
              type="button"
              onClick={() => void signOut().then(() => window.location.replace('/studio/'))}
              className={QUIET}
            >
              Sign out
            </button>
            <button
              type="button"
              onClick={create}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-paper transition hover:-translate-y-px hover:shadow-lift"
            >
              New system
            </button>
          </div>
        </div>
      </header>

      {claimed > 0 && (
        <Notice tone="green">
          <span className="font-bold">
            {claimed} system{claimed === 1 ? '' : 's'} from this browser {claimed === 1 ? 'is' : 'are'}{' '}
            now on your account.
          </span>{' '}
          They will be here on any machine you sign in from.
        </Notice>
      )}

      {load === 'local-only' && (
        <Notice tone="gold">
          <span className="font-bold">Showing what is on this machine.</span> We could not reach your
          account just now — nothing is lost, and these will sync when the connection comes back.
        </Notice>
      )}

      {load === 'working' ? (
        <Skeleton />
      ) : systems.length === 0 ? (
        <Empty onNew={create} />
      ) : (
        <ul className="mt-8 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {/* First in the grid, not only in the header: on a shelf you have
              scrolled halfway down, the way to add one should be in the shelf. */}
          <NewTile onClick={create} />
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

// ── the shelf in numbers ─────────────────────────────────────────────────────

/**
 * Systems, phases, links out.
 *
 * One line, not three tiles. A dashboard of stat cards would be the reflex and
 * it would be wrong twice over: none of these numbers is worth a card, and the
 * cards on this page are supposed to mean "a system you can open".
 */
function Tally({ systems, phases, shared }: { systems: number; phases: number; shared: number }) {
  const parts = [
    { n: systems, one: 'system', many: 'systems' },
    { n: phases, one: 'phase', many: 'phases' },
    // Nothing shared yet is not a zero worth printing.
    ...(shared > 0 ? [{ n: shared, one: 'link out', many: 'links out' }] : []),
  ]
  return (
    <p className="mt-4 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[13px] text-ink-faint">
      {parts.map((p, i) => (
        <span key={p.one} className="flex items-baseline gap-2.5">
          {i > 0 && <span aria-hidden="true">·</span>}
          <span>
            <span className="font-black tabular-nums text-ink">{p.n}</span>{' '}
            {p.n === 1 ? p.one : p.many}
          </span>
        </span>
      ))}
    </p>
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

  // Disarm on its own, like the studio's ConfirmButton does. A half-pressed
  // Delete must not sit armed on a shelf for the rest of the afternoon waiting
  // for somebody to brush it.
  useEffect(() => {
    if (!confirming) return
    const t = setTimeout(() => setConfirming(false), 4000)
    return () => clearTimeout(t)
  }, [confirming])

  const view = PITCH_VIEWS[resolveViewId(row.system.pitch)]
  const first = row.system.acts[0]
  const href = `/studio/new/?s=${encodeURIComponent(row.id)}`
  const phases = row.system.acts.length
  const shareId = row.system.shareId

  // Every board on the page shares one <defs> namespace unless they are told
  // apart, and two boards with the same gradient ids paint each other's colours.
  const idp = useMemo(() => `card-${row.id}`, [row.id])

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-hair bg-surface shadow-paper transition duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <a
        href={href}
        className="block no-underline"
        aria-label={`Open ${row.system.title || 'this system'}`}
      >
        <div className="w-full overflow-hidden bg-paper" style={{ aspectRatio: aspect(view) }}>
          {/* The board leans in a little under the cursor. It is the only
              motion on a card, and it is on the one part of it that is worth
              looking at. */}
          <div className="h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.035]">
            {first && <Board system={row.system} act={resolveAct(first)} idp={idp} />}
          </div>
        </div>
      </a>

      <div className="flex flex-1 flex-col border-t border-ink-hair p-4">
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
            className="w-full rounded-md border border-ink-hair bg-paper px-2 py-1 text-[15px] font-bold text-ink outline-none focus:border-ink/25"
          />
        ) : (
          <a
            href={href}
            className="block truncate text-[15px] font-bold leading-tight text-ink no-underline"
          >
            {row.system.title || 'Untitled system'}
          </a>
        )}

        <div className="mt-2.5 flex items-center gap-2.5">
          <Phases n={phases} />
          <span className="text-[12px] text-ink-faint">{when(row.updated)}</span>
          {/* Published, and the link itself. Not an anchor nested inside the
              card's own — it sits outside it, and it goes somewhere else: what
              the people this was sent to are looking at right now. */}
          {shareId && (
            <a
              href={`/s/${shareId}`}
              target="_blank"
              rel="noopener"
              title="Open the link you sent"
              className="ml-auto shrink-0 rounded-full bg-gold/15 px-2.5 py-1 font-mono text-[11px] font-bold text-ink no-underline transition-colors hover:bg-gold/30"
            >
              /s/{shareId}
            </a>
          )}
        </div>

        {/*
          Faint until you go near them, never hidden. They used to be opacity-0
          until hover or focus-within, which reads well on a laptop and leaves a
          coach on a phone with no way to rename anything — a touch screen has
          no hover, and opacity does not take a button out of the tab order
          anyway, so the trade it was making was not one it was getting.
        */}
        <div className="mt-3 flex items-center gap-1 pt-1 text-ink-faint transition-colors group-focus-within:text-ink-soft group-hover:text-ink-soft">
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

/**
 * How many phases, as the phases themselves.
 *
 * A miniature of the editor's phase strip rather than the words "3 phases": on
 * a shelf of twelve, the length of a system is compared far quicker than it is
 * read, and this is the same row of tiles a coach clicks along inside the
 * studio. The words are still there for anyone who cannot see the tiles.
 */
function Phases({ n }: { n: number }) {
  const shown = Math.min(n, 8)
  return (
    <span className="flex shrink-0 items-center gap-[3px]" title={`${n} phase${n === 1 ? '' : 's'}`}>
      <span className="sr-only">
        {n} phase{n === 1 ? '' : 's'}
      </span>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} aria-hidden="true" className="block h-[11px] w-[5px] rounded-[1.5px] bg-ink/25" />
      ))}
      {n > shown && (
        <span aria-hidden="true" className="ml-0.5 text-[11px] font-bold text-ink-faint">
          +{n - shown}
        </span>
      )}
    </span>
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
      className={`rounded-md px-2 py-1 text-[12px] font-bold text-current transition-colors hover:bg-ink-hair ${
        danger ? 'hover:text-[#E2473B]' : 'hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

// ── the way in ───────────────────────────────────────────────────────────────

/**
 * A blank board at the head of the shelf.
 *
 * Same proportions as a card, drawn as a pitch that has not been marked out
 * yet, so the grid reads as boards all the way across instead of as boards with
 * a button stuck on the front.
 */
function NewTile({ onClick }: { onClick: () => void }) {
  return (
    <li className="flex">
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full flex-col overflow-hidden rounded-2xl border border-dashed border-ink-hair text-left transition duration-300 hover:-translate-y-0.5 hover:border-ink/25 hover:bg-surface/60"
      >
        <span className="grid w-full place-items-center" style={{ aspectRatio: CARD_ASPECT }}>
          <span className="grid h-12 w-12 place-items-center rounded-full border border-ink-hair text-ink-faint transition-colors group-hover:border-ink/25 group-hover:text-ink">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        </span>
        <span className="w-full flex-1 border-t border-dashed border-ink-hair p-4">
          <span className="block text-[15px] font-bold leading-tight text-ink">New system</span>
          <span className="mt-1.5 block text-[12px] text-ink-faint">
            A pitch, your shape on it, and the first phase.
          </span>
        </span>
      </button>
    </li>
  )
}

// ── the two waits ────────────────────────────────────────────────────────────

/**
 * The shelf, before it has arrived.
 *
 * A line of type saying "Fetching your systems…" tells a coach to wait and
 * shows them nothing. Six card-shaped holes tell them what is coming and stop
 * the page jumping when it does.
 */
function Skeleton() {
  return (
    <>
      <p className="sr-only" role="status">
        Fetching your systems
      </p>
      <ul className="mt-8 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li
            key={i}
            aria-hidden="true"
            className="overflow-hidden rounded-2xl border border-ink-hair bg-surface shadow-paper"
          >
            <div
              className="w-full animate-pulse bg-ink/[0.04]"
              style={{ aspectRatio: CARD_ASPECT }}
            />
            <div className="border-t border-ink-hair p-4">
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-ink/[0.07]" />
              <div className="mt-3 h-2.5 w-1/3 animate-pulse rounded bg-ink/[0.05]" />
            </div>
          </li>
        ))}
      </ul>
    </>
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
    <div className="mt-10 rounded-3xl border border-dashed border-ink-hair px-6 py-16 text-center">
      <h2 className="text-section font-black tracking-display text-ink">Build your first one</h2>
      <p className="mx-auto mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
        A system is a board posed phase by phase. Put your shape down, move it to where the ball takes
        it, and the movement between the two comes back as film.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onNew}
          className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-paper transition hover:-translate-y-px hover:shadow-lift"
        >
          Start a new system
        </button>
        <a
          href="/library/"
          className="rounded-full border border-ink-hair px-6 py-3 text-sm font-bold text-ink no-underline transition-colors hover:border-ink/25 hover:bg-surface/60"
        >
          Look at one of ours first
        </a>
      </div>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'green' | 'gold'; children: React.ReactNode }) {
  return (
    <p
      className={`mt-6 rounded-xl border-l-[3px] px-4 py-3 text-[13px] leading-relaxed text-ink ${
        tone === 'green' ? 'border-green bg-green/[0.07]' : 'border-gold bg-gold/[0.09]'
      }`}
    >
      {children}
    </p>
  )
}

function Centre({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5">
      <p className="text-micro uppercase text-ink-faint">{children}</p>
    </div>
  )
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
