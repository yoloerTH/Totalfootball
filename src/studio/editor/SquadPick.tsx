/**
 * Putting a real player on a counter, and getting their face onto the board.
 *
 * ── THE HALF THAT ALREADY EXISTED ────────────────────────────────────────────
 *
 * A counter has always been able to carry a name: `Token.name` is in the schema,
 * the panel beside this one has a Name field, and `Token.tsx` prints it above
 * the counter. None of that changes. What this adds is the squad a coach keeps
 * in their personal settings, so a name that has been typed once is a press
 * rather than a retype, and so a name can arrive with a photograph attached.
 *
 * ── PICKING COPIES; IT DOES NOT LINK ─────────────────────────────────────────
 *
 * The name, the number and the photo path are written ONTO the token, into the
 * System document. Nothing afterwards follows the link back to the squad row.
 * ../account/squad.ts argues this at the top and it is the same rule
 * `withProfile` follows: a board is a record of a session that happened, and it
 * keeps the names it was drawn with even after a player has left the club.
 *
 * ── AND THE PHOTOS ARE NOT IN THE DOCUMENT ───────────────────────────────────
 *
 * Only a storage path is, pointing into a bucket that is private (supabase/013).
 * `useSquadPhotos` signs those paths for the coach's own board. A stranger
 * opening a shared link gets no signature, so they see the names and no faces —
 * which is the intended behaviour for photographs that are usually of children,
 * not a gap waiting to be closed.
 */

import { useEffect, useState } from 'react'
import type { System, Token } from '../schema'
import { listSquad, photoPaths, signPhotos, type Player } from '../account/squad'
import { useSession } from '../account/session'

/**
 * Storage path → signed URL, for every photograph anywhere in this system.
 *
 * Re-signed when the SET OF PATHS changes, not on every edit: the key below is
 * the sorted list of paths, so dragging a counter round the pitch for ten
 * minutes does not re-sign anything, while adding a player to the board does.
 *
 * Returns `{}` for a signed-out visitor, which is the ordinary case on a shared
 * board. `Board` draws a counter with no face for any path it cannot resolve, so
 * that path costs nothing and shows nothing broken.
 */
export function useSquadPhotos(system: System): Record<string, string> {
  const { status } = useSession()
  const [hrefs, setHrefs] = useState<Record<string, string>>({})
  const key = photoPaths(system).sort().join('|')

  useEffect(() => {
    if (status !== 'in' || !key) {
      setHrefs({})
      return
    }
    let live = true
    void signPhotos(key.split('|')).then((signed) => {
      if (live) setHrefs(signed)
    })
    return () => {
      live = false
    }
  }, [key, status])

  return hrefs
}

/**
 * The squad, loaded once for the life of the editor.
 *
 * Once, because it is a list of at most forty rows that changes only on another
 * page. Re-fetching it on every selection would be a request per click on a
 * counter for data that has not moved.
 */
export function useSquad(): Player[] {
  const { status, user } = useSession()
  const [squad, setSquad] = useState<Player[]>([])

  useEffect(() => {
    // The uid is now part of the question rather than something RLS is trusted
    // to supply, so this waits for a session instead of merely for a status.
    if (status !== 'in' || !user) return
    let live = true
    void listSquad(user.id).then((players) => {
      if (live) setSquad(players)
    })
    return () => {
      live = false
    }
  }, [status, user])

  return squad
}

/**
 * The picker itself: one row per player, and a way back out.
 *
 * Renders NOTHING when the squad is empty rather than an empty box with a link
 * to go and fill it. A coach who has never opened the squad page is not helped
 * by a permanent advertisement for it in the panel they use most; the panel
 * below still has the Name field it always had, and that is a complete way to
 * name a player. The pointer to settings appears only once there is a squad to
 * be out of date with — see the foot of this component.
 */
export function SquadPick({
  squad,
  token,
  onPick,
  onClear,
}: {
  squad: Player[]
  token: Token
  onPick: (player: Player) => void
  onClear: () => void
}) {
  if (squad.length === 0) return null

  // Matched on NAME, because that is what was copied. There is no id on the
  // token to match against, on purpose — see the note at the top of this file.
  const current = squad.find((p) => p.name === token.name)

  return (
    <div className="mb-3">
      <span className="mb-1.5 block text-[11px] font-bold text-ink-soft">From your squad</span>
      <div className="max-h-44 overflow-y-auto rounded-md border border-ink-hair bg-paper p-1">
        {squad.map((player) => {
          const on = current?.id === player.id
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => (on ? onClear() : onPick(player))}
              aria-pressed={on}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors ${
                on ? 'bg-ink-hair' : 'hover:bg-ink-hair/60'
              }`}
            >
              <span className="w-7 shrink-0 text-center font-mono text-[11px] font-bold text-ink-faint">
                {player.number || '—'}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-ink">
                {player.name}
              </span>
              {player.photoPath && (
                <span
                  className="shrink-0 text-[10px] font-bold uppercase tracking-micro text-ink-faint"
                  title="Has a photo"
                >
                  Photo
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
        Picking one fills the counter, the name and the face.{' '}
        <a
          href="/studio/settings/"
          className="font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
        >
          Edit your squad
        </a>
        .
      </p>
    </div>
  )
}
