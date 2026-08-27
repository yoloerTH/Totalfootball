/**
 * The squad: a list of players a coach types ONCE and then picks from.
 *
 * This exists because a coach asked whether the board could show player names
 * and faces. Half of it already shipped — `Token.name` has been printed above
 * the counter since the studio was built, and the editor has always had a Name
 * field. What it did not have was memory. Naming eleven players meant typing
 * eleven names, and naming them again next week meant typing them again.
 *
 * So this page is a source, not a second editor. Nothing here reaches a board on
 * its own; the editor's player panel offers this list and copies a name, a
 * number and a photo onto a counter when the coach picks one. See the head of
 * ./squad.ts for why it copies rather than links — the short version is that a
 * board is a record of something that happened, and it keeps the names it was
 * drawn with even after a player has left the club.
 *
 * ── IT SAVES ITSELF ──────────────────────────────────────────────────────────
 *
 * Every other section of the settings page is part of one profile payload behind
 * one Save button. This one is a different table with its own policy, and
 * pretending otherwise would mean holding a squad of forty in form state and
 * writing all of it back on every press. Each row saves when the coach leaves
 * it, and the copy says so out loud rather than leaving them to wonder.
 *
 * ── THE PHOTOS ARE PRIVATE ───────────────────────────────────────────────────
 *
 * They are in a bucket that is not public, read through URLs that expire within
 * the hour, and they are very often photographs of children. supabase/013 argues
 * this at length. The consequence a coach can see from here is the one stated
 * under the section heading: share a board and the recipient gets the names and
 * not the faces. That is deliberate, and publishing a face stays a separate act
 * that has to be asked for.
 */

import { useCallback, useEffect, useState } from 'react'
import { IMAGE_ACCEPT, bust, uploadImage } from './images'
import {
  NAME_MAX,
  NUMBER_MAX,
  SQUAD_MAX,
  deletePlayer,
  listSquad,
  reorderSquad,
  savePlayer,
  signPhotos,
  type Player,
} from './squad'

const INPUT =
  'rounded-lg border border-ink-hair bg-surface px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-ink/30'

/**
 * Initials, for a player with no photograph.
 *
 * A placeholder that says WHO is missing a picture beats a generic silhouette
 * repeated eleven times, and it means the list is readable at a glance before
 * anybody has uploaded anything at all.
 */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function Face({ url, name }: { url: string; name: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="h-11 w-11 shrink-0 rounded-full border border-ink-hair bg-surface object-cover"
      />
    )
  }
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-ink-hair text-[11px] font-bold text-ink-faint">
      {initials(name)}
    </div>
  )
}

export default function SquadEditor({ owner }: { owner: string }) {
  const [squad, setSquad] = useState<Player[]>([])
  /** Storage path → a signed URL. Never stored; see ./images.ts. */
  const [faces, setFaces] = useState<Record<string, string>>({})
  const [ready, setReady] = useState(false)
  const [fault, setFault] = useState('')
  /** The id of the row currently doing i/o, so only that row shows it. */
  const [busy, setBusy] = useState('')
  const [draft, setDraft] = useState({ name: '', number: '' })

  const resign = useCallback(async (players: Player[]) => {
    const paths = players.map((p) => p.photoPath).filter(Boolean)
    if (paths.length === 0) return
    setFaces(await signPhotos(paths))
  }, [])

  useEffect(() => {
    let live = true
    void listSquad(owner).then(async (players) => {
      if (!live) return
      setSquad(players)
      setReady(true)
      await resign(players)
    })
    return () => {
      live = false
    }
  }, [resign, owner])

  /**
   * Write one row back, and reconcile the list with what the DATABASE returned.
   *
   * Not with what was sent: `savePlayer` trims and caps, and a new player's id
   * is issued by the column default. Trusting the local copy would leave the
   * row unable to accept a photograph, because there would be no id to name the
   * object after.
   */
  const persist = useCallback(async (player: Player) => {
    if (!player.name.trim()) return
    setBusy(player.id)
    const stored = await savePlayer(player, owner)
    setBusy('')
    if (!stored) {
      setFault('That did not save. Check your connection and try again.')
      return
    }
    setFault('')
    setSquad((s) => s.map((p) => (p.id === stored.id ? stored : p)))
  }, [owner])

  const add = useCallback(async () => {
    const name = draft.name.trim()
    if (!name) return
    if (squad.length >= SQUAD_MAX) {
      setFault(`A squad holds at most ${SQUAD_MAX} players.`)
      return
    }
    setBusy('new')
    const stored = await savePlayer(
      { id: '', name, number: draft.number.trim(), photoPath: '', sort: squad.length },
      owner,
    )
    setBusy('')
    if (!stored) {
      setFault('That did not save. Check your connection and try again.')
      return
    }
    setFault('')
    setSquad((s) => [...s, stored])
    setDraft({ name: '', number: '' })
  }, [draft, owner, squad.length])

  const remove = useCallback(async (player: Player) => {
    setBusy(player.id)
    const ok = await deletePlayer(player)
    setBusy('')
    if (!ok) {
      setFault('That did not delete. Check your connection and try again.')
      return
    }
    setFault('')
    setSquad((s) => s.filter((p) => p.id !== player.id))
  }, [])

  const onPhoto = useCallback(
    async (player: Player, file: File | undefined) => {
      if (!file) return
      setBusy(player.id)
      const { path, fault: bad } = await uploadImage(file, owner, 'player', player.id)
      if (bad) {
        setBusy('')
        setFault(bad)
        return
      }
      const stored = await savePlayer({ ...player, photoPath: path }, owner)
      setBusy('')
      if (!stored) {
        setFault('The picture uploaded but the player did not save. Try again.')
        return
      }
      setFault('')
      setSquad((s) => s.map((p) => (p.id === stored.id ? stored : p)))
      // Busted, because the object is overwritten in place and the URL does not
      // change when the image does. See ./images.ts.
      const signed = await signPhotos([path])
      setFaces((f) => ({ ...f, [path]: bust(signed[path] ?? '') }))
    },
    [owner],
  )

  /**
   * Move one player up or down, and write the whole order back.
   *
   * Buttons rather than dragging. A team sheet is reordered rarely and read
   * often, and drag-and-drop that works with a mouse, a touchscreen and a
   * keyboard is a great deal of code to make a rare action slightly nicer.
   */
  const move = useCallback(
    async (index: number, by: number) => {
      const to = index + by
      if (to < 0 || to >= squad.length) return
      const next = [...squad]
      ;[next[index], next[to]] = [next[to], next[index]]
      setSquad(next.map((p, i) => ({ ...p, sort: i })))
      if (!(await reorderSquad(next, owner))) {
        setFault('That did not save. Check your connection and try again.')
      }
    },
    [owner, squad],
  )

  if (!ready) {
    return <p className="mt-5 text-[13px] text-ink-faint">Opening your squad…</p>
  }

  return (
    <div className="mt-5">
      {squad.length > 0 && (
        <ul className="space-y-2">
          {squad.map((player, i) => (
            <li
              key={player.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-hair bg-paper p-2.5"
            >
              <Face url={faces[player.photoPath] ?? ''} name={player.name} />

              <input
                value={player.number}
                onChange={(e) =>
                  setSquad((s) =>
                    s.map((p) => (p.id === player.id ? { ...p, number: e.target.value } : p)),
                  )
                }
                onBlur={() => void persist(player)}
                placeholder="6"
                maxLength={NUMBER_MAX}
                aria-label={`Number for ${player.name}`}
                className={`${INPUT} w-14 text-center font-mono`}
              />

              <input
                value={player.name}
                onChange={(e) =>
                  setSquad((s) =>
                    s.map((p) => (p.id === player.id ? { ...p, name: e.target.value } : p)),
                  )
                }
                onBlur={() => void persist(player)}
                placeholder="Name"
                maxLength={NAME_MAX}
                aria-label="Player name"
                className={`${INPUT} min-w-0 flex-1`}
              />

              <label className="shrink-0 cursor-pointer rounded-lg border border-ink-hair px-3 py-2.5 text-[12px] font-bold text-ink transition-colors hover:bg-ink-hair">
                {busy === player.id ? 'Working…' : player.photoPath ? 'Replace' : 'Photo'}
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
                  disabled={busy === player.id}
                  onChange={(e) => {
                    void onPhoto(player, e.target.files?.[0])
                    // Cleared so choosing the same file twice fires a change.
                    e.target.value = ''
                  }}
                  className="hidden"
                />
              </label>

              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => void move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${player.name} up`}
                  className="rounded-lg px-2 py-2 text-[13px] font-bold text-ink-faint transition-colors hover:bg-ink-hair hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => void move(i, 1)}
                  disabled={i === squad.length - 1}
                  aria-label={`Move ${player.name} down`}
                  className="rounded-lg px-2 py-2 text-[13px] font-bold text-ink-faint transition-colors hover:bg-ink-hair hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => void remove(player)}
                  aria-label={`Remove ${player.name} from your squad`}
                  className="rounded-lg px-2.5 py-2 text-[13px] font-bold text-ink-faint transition-colors hover:bg-ink-hair hover:text-ink"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Adding is its own row rather than a blank one appended to the list,
          so an empty name is never a player who half exists. */}
      {squad.length < SQUAD_MAX && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-hair pt-3">
          <input
            value={draft.number}
            onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value }))}
            placeholder="6"
            maxLength={NUMBER_MAX}
            aria-label="Number"
            className={`${INPUT} w-14 text-center font-mono`}
          />
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void add()
              }
            }}
            placeholder="Add a player"
            maxLength={NAME_MAX}
            aria-label="New player's name"
            className={`${INPUT} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={!draft.name.trim() || busy === 'new'}
            className="shrink-0 rounded-lg border border-ink-hair px-4 py-2.5 text-[13px] font-bold text-ink transition-colors hover:bg-ink-hair disabled:opacity-40"
          >
            {busy === 'new' ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}

      <p className="mt-3 text-[12px] leading-snug text-ink-faint">
        {squad.length === 0
          ? 'Add a player and their name is one press away on every board you build after that. A photo can wait until they exist.'
          : `${squad.length} of ${SQUAD_MAX}. Changes here save on their own — there is no need to press Save at the foot of the page.`}
      </p>

      {fault && <p className="mt-2 text-[12px] font-bold leading-snug text-ink">{fault}</p>}
    </div>
  )
}
