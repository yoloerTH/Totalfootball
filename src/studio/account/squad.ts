/**
 * The coach's own players: their names, their numbers and their faces.
 *
 * A squad exists so that naming a player is something a coach does ONCE rather
 * than every time they build a board. The editor already had a Name field on the
 * selected counter and it always will — this does not replace typing, it removes
 * the retyping.
 *
 * ── THE SQUAD IS A SOURCE, THE DOCUMENT IS A SNAPSHOT ────────────────────────
 *
 * Picking a player writes their name, number and photo path ONTO the token, into
 * the System document, and nothing afterwards follows the link back. This is the
 * same rule `withProfile` follows for the credit bar and the kit, and the same
 * rule docs/SOCIAL.md §3c sets for a published post: settings supply defaults to
 * a blank board and never edit one that already exists.
 *
 * It is worth being concrete about why, because the alternative looks tidier. If
 * a board held player IDs, then a coach who deletes a player who left in January
 * would silently blank a counter in every session they ran last autumn, and a
 * squad renumbered in pre-season would rewrite the history of the season before
 * it. A board is a record of a thing that happened. It keeps the names it was
 * drawn with.
 *
 * ── EVERYTHING HERE IS PRIVATE ───────────────────────────────────────────────
 *
 * `studio_squad` has one policy and it is own-row. The `players` bucket is not
 * public and photos are read through short-lived signed URLs. supabase/013 says
 * why at length; the short version is that a squad is usually children, and
 * `studio_profiles` — which is world-readable — was the wrong place for any of
 * it. A shared board therefore shows a stranger the NAMES a coach typed and not
 * the faces, because names are on the document and faces are behind a policy.
 *
 * Every function returns something harmless when there is no client or no
 * session, exactly as ./cloud.ts does.
 */

import type { System } from '../schema'
import { db } from './client'
import { removeImage, signedPlayerUrl } from './images'

/** One member of the squad. */
export interface Player {
  /** Server-issued uuid. Also names the photo object, so it is needed to upload one. */
  id: string
  name: string
  /** What goes on the counter: "6", "GK", "LCB". Text, because "GK" is an answer. */
  number: string
  /** Object path in the private `players` bucket. Empty when there is no photo. */
  photoPath: string
  sort: number
}

/** Mirrors the trigger in supabase/013. Shown to the coach before the database has to. */
export const SQUAD_MAX = 40

export const NAME_MAX = 18
export const NUMBER_MAX = 4

const TABLE = 'studio_squad'

const COLUMNS = 'id, name, number, photo_path, sort'

function toPlayer(row: Record<string, unknown>): Player {
  return {
    id: row.id as string,
    name: (row.name as string | null) ?? '',
    number: (row.number as string | null) ?? '',
    photoPath: (row.photo_path as string | null) ?? '',
    sort: (row.sort as number | null) ?? 0,
  }
}

/**
 * The squad, in the coach's own order. `[]` when signed out or offline.
 *
 * No `.eq('owner', …)`, for the reason the top of ./cloud.ts gives: the policy
 * in supabase/013 already restricts this table to the caller's own rows, and a
 * hand-written filter agreeing with it teaches the next reader that the filter
 * is what makes it safe.
 */
export async function listSquad(owner: string): Promise<Player[]> {
  const supabase = db()
  if (!supabase || !owner) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    // A squad is account-private and stays that way (user, 2026-08-28). RLS in
    // supabase/013 is what enforces that; this filter is so the query keeps
    // MEANING "mine" if a policy is ever added here. See `listCloudSystems` in
    // ./cloud.ts for the day that assumption cost a working profile page.
    .eq('owner', owner)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(toPlayer)
}

/**
 * Create or update one player. Returns the stored row, or `null` if it failed.
 *
 * The ROW COMES BACK rather than being assumed, because a new player's id is
 * issued by the database and the caller cannot upload a photo without it. An
 * insert here is genuinely two round trips for the coach — save the name, then
 * add the face — and that is the honest shape of it: there is nowhere to put a
 * photo until there is a player to put it on.
 */
export async function savePlayer(player: Player, owner: string): Promise<Player | null> {
  const supabase = db()
  if (!supabase) return null

  const row: Record<string, unknown> = {
    owner,
    name: player.name.trim().slice(0, NAME_MAX),
    // Empty goes up as NULL: the column is nullable and "no number" is a real
    // state, distinct from "a number that is the empty string".
    number: player.number.trim() ? player.number.trim().slice(0, NUMBER_MAX) : null,
    photo_path: player.photoPath || null,
    sort: player.sort,
  }
  // Omitted entirely on a new player so the column default issues one. Sending
  // an empty string would be rejected as a malformed uuid.
  if (player.id) row.id = player.id

  const { data, error } = await supabase.from(TABLE).upsert(row).select(COLUMNS).maybeSingle()
  if (error || !data) return null
  return toPlayer(data as Record<string, unknown>)
}

/**
 * Remove a player, and their photograph with them.
 *
 * STORAGE FIRST, ROW SECOND, the same order ./images.ts argues for: a row
 * pointing at a deleted object shows a broken image, a deleted row leaving an
 * object behind is a stray 40 KB. Only one of those is visible to anybody.
 *
 * Deleting a player does NOT touch any board they appear on. See the note at the
 * top of this file: those boards hold a name, not a reference.
 */
export async function deletePlayer(player: Player): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false
  if (player.photoPath) await removeImage(player.photoPath)
  const { error } = await supabase.from(TABLE).delete().eq('id', player.id)
  return !error
}

/**
 * Persist a whole reordering in one go. Returns whether it landed.
 *
 * One request rather than one per player, because a coach dragging a team sheet
 * into order generates a lot of small moves and a partial write would leave the
 * list in an order nobody chose.
 */
export async function reorderSquad(players: Player[], owner: string): Promise<boolean> {
  const supabase = db()
  if (!supabase || players.length === 0) return false
  const { error } = await supabase.from(TABLE).upsert(
    players.map((p, i) => ({
      id: p.id,
      owner,
      name: p.name,
      number: p.number || null,
      photo_path: p.photoPath || null,
      sort: i,
    })),
  )
  return !error
}

// ── photographs, on their way to a board ─────────────────────────────────────

/**
 * Every distinct photo path used anywhere in a system.
 *
 * DISTINCT, and across all acts, which is the whole reason this is a function
 * rather than a `map` at the call site. One player is on the board in all six
 * phases of a session; signing their photo six times would be six requests for
 * one picture, and inlining it six times would put the same base64 blob into an
 * exported document six times over.
 */
export function photoPaths(system: System): string[] {
  const seen = new Set<string>()
  for (const act of system.acts) {
    for (const token of act.tokens) {
      if (token.photo) seen.add(token.photo)
    }
  }
  return [...seen]
}

/**
 * Storage path → a URL a browser can draw, for the live board.
 *
 * Signed, so they expire; see `signedPlayerUrl` on why an hour. A path that
 * cannot be signed — a photo deleted from another machine, a session that has
 * gone stale — is simply absent from the result, and `Token` draws the counter
 * without a face rather than a broken image. A missing photograph must never be
 * the thing that stops a coach working.
 */
export async function signPhotos(paths: string[]): Promise<Record<string, string>> {
  const urls = await Promise.all(paths.map((p) => signedPlayerUrl(p)))
  const out: Record<string, string> = {}
  paths.forEach((p, i) => {
    if (urls[i]) out[p] = urls[i]
  })
  return out
}

/**
 * Storage path → a `data:` URI, for the exporter.
 *
 * ── THIS IS NOT AN OPTIMISATION, IT IS THE ONLY WAY IT WORKS ─────────────────
 *
 * ../videoRender.ts serialises the board to an SVG string and rasterises it
 * through an `<img>`. A canvas will not fetch an external href out of a
 * serialised SVG, AND IT DOES NOT ERROR WHEN IT FAILS — the picture is simply
 * gone from the video, with nothing in the console to say so. `inlineBall` in
 * ../balls.ts pays exactly this tax for the match ball and its comment explains
 * the same trap. Anything drawn from a URL has to be inlined before the first
 * frame or it will not be in any of them.
 *
 * Done ONCE up front for the whole render rather than per frame: it is the same
 * face on all four hundred of them, and a signed URL that expired halfway
 * through a long export would otherwise take the second half of the video with
 * it.
 *
 * A photo that fails to fetch is left out, and the board draws that counter
 * without a face. A silent gap is bad; a render that fails at frame 300 of 400
 * because one player left the club is worse.
 */
export async function inlinePhotos(paths: string[]): Promise<Record<string, string>> {
  const signed = await signPhotos(paths)
  const out: Record<string, string> = {}

  await Promise.all(
    Object.entries(signed).map(async ([path, url]) => {
      try {
        const res = await fetch(url)
        if (!res.ok) return
        const blob = await res.blob()
        const uri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        out[path] = uri
      } catch {
        // Left out on purpose. See above.
      }
    }),
  )

  return out
}
