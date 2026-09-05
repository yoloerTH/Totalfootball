/**
 * The one-way door out of localStorage.
 *
 * ── WHY THIS FILE EXISTS AND WHY IT IS TEMPORARY ─────────────────────────────
 *
 * Everything the studio keeps now lives in Supabase (user, 2026-09-06). Every
 * other module was changed to stop reading and writing the browser; this one
 * exists solely to make sure that change does not take anybody's work with it.
 *
 * THE STAKES ARE NOT THEORETICAL. supabase/026 established that
 * `studio_sequences` was created without a GRANT and held ZERO rows across all
 * 157 accounts — so every sequence any coach has ever captured exists in
 * exactly one place: the `tf-studio:sequences:v1` key in their own browser.
 * Deleting the localStorage layer without this sweep would delete the entire
 * saved-sequence library of every user of the product, permanently.
 *
 * Systems are less dramatic — they have been mirrored to `studio_systems` since
 * supabase/005 and there are 324 rows — but "less dramatic" is not "safe": a
 * board built during a session that never got its upload in is still local-only
 * on that machine.
 *
 * ── IT NEEDS NO "HAVE I RUN" MARKER, BECAUSE IT REMOVES WHAT IT IMPORTS ──────
 *
 * A key is deleted only after the row it became has landed. So a second run
 * finds nothing and does nothing, a failed run leaves the key exactly where it
 * was and the next sign-in tries again, and there is no flag anywhere that can
 * be set on a browser where the sweep did not actually happen. That property is
 * why the marker approach in the file this replaced (`tf-studio:owner:adopted`)
 * was worth losing: a marker records an intention, a deleted key records a fact.
 *
 * ── WHICH SCOPES IT CLAIMS, AND WHICH IT WILL NOT TOUCH ──────────────────────
 *
 * The old layer namespaced every key by user id — `tf-studio:v1::<uuid>` — after
 * a leak in which one coach's boards were upserted into a stranger's account on
 * a shared browser (user, 2026-08-27). That leak is the reason this sweep reads
 * exactly three namespaces and no others:
 *
 *   `base`            written before namespacing existed. Ours by construction:
 *                     the studio has required an account since 2026-08-13, so
 *                     whoever wrote it is whoever is signed in here.
 *   `base::guest`     built before signing in, on this browser. Ownerless.
 *   `base::<our uid>` ours, said explicitly.
 *
 * `base::<somebody else's uid>` is LEFT WHERE IT IS. It is not ours to upload
 * and it is not ours to delete. It is claimed the next time that coach signs in
 * on this machine, which is the only correct time for it to move.
 *
 * ── WHEN THIS CAN BE DELETED ─────────────────────────────────────────────────
 *
 * Once the deploy has been live long enough that every active coach has signed
 * in on every browser they use. Until then it is load-bearing. Deleting it
 * early is silent: nobody gets an error, the work simply never arrives.
 */

import type { System } from '../schema'
import type { GuideState, Prefs, ViewPrefs } from '../storage'
import { DEFAULT_CARRY, DEFAULT_SNAP, DEFAULT_STRIP_SIZE, migrate } from '../storage'
import { db } from './client'

/** The namespace the old layer used for work done by nobody in particular. */
const GUEST = 'guest'

const SYSTEMS = 'tf-studio:v1'
const SEQUENCES = 'tf-studio:sequences:v1'
const GUIDE = 'tf-studio:guide:v1'
const SECTIONS = 'tf.studio.sections'
const STRIP = 'tf.studio.strip'
const SNAP = 'tf.studio.snap'
const CARRY = 'tf.studio.carry'

/** The markers the old scoping scheme kept. Nothing reads them any more. */
const MARKERS = ['tf-studio:owner', 'tf-studio:owner:adopted']

/** Every key the studio ever wrote, so the sweep can prove it left none behind. */
const BASES = [SYSTEMS, SEQUENCES, GUIDE, SECTIONS, STRIP, SNAP, CARRY]

function get(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
  } catch {
    // A private window. There is nothing to import and nothing to clean up.
    return null
  }
}

function drop(key: string): void {
  try {
    localStorage?.removeItem(key)
  } catch {
    // As above. A key we cannot remove is a key we could not read either.
  }
}

/**
 * The three namespaces a base key may hold something of ours in, oldest first.
 *
 * Order is not cosmetic: later entries win in `pick` below, and the scoped copy
 * is newer than the bare one by construction — namespacing shipped after the
 * bare keys stopped being written.
 */
function ours(base: string, uid: string): string[] {
  return [base, `${base}::${GUEST}`, `${base}::${uid}`]
}

function parse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    // A half-written entry costs one key, not the sweep.
    return null
  }
}

// ── documents ────────────────────────────────────────────────────────────────

interface LocalSystems {
  systems?: Record<string, { system?: System; updated?: string }>
}

interface LocalSequences {
  sequences?: Record<string, Record<string, unknown>>
}

/**
 * Everything under one base, across our three namespaces, merged.
 *
 * A coach may have a board under the bare key AND under their scoped one — the
 * adoption in the old ./scope.ts copied rather than moved when both existed.
 * Later namespaces overwrite earlier ones per the ordering in `ours`.
 */
function collect<T>(base: string, uid: string, of: (v: unknown) => Record<string, T> | null): {
  items: Record<string, T>
  keys: string[]
} {
  const items: Record<string, T> = {}
  const keys: string[] = []
  for (const key of ours(base, uid)) {
    const raw = get(key)
    if (raw === null) continue
    keys.push(key)
    const bag = of(parse<unknown>(raw))
    if (bag) Object.assign(items, bag)
  }
  return { items, keys }
}

export interface Adopted {
  systems: number
  sequences: number
}

/**
 * Move this browser's leftovers into the account, then delete them.
 *
 * Returns how many rows were NEWLY created, so the portal can say so once. A
 * key that held only documents the account already had is still deleted and
 * still counts as zero — the sweep succeeded, there was simply nothing new in
 * it.
 */
export async function adoptLocalWork(uid: string): Promise<Adopted> {
  const supabase = db()
  if (!supabase || !uid) return { systems: 0, sequences: 0 }
  if (typeof localStorage === 'undefined') return { systems: 0, sequences: 0 }

  const out: Adopted = { systems: 0, sequences: 0 }

  // ── systems ────────────────────────────────────────────────────────────────
  const local = collect<System>(SYSTEMS, uid, (v) => {
    const store = v as LocalSystems | null
    if (!store || typeof store.systems !== 'object' || !store.systems) return null
    const bag: Record<string, System> = {}
    for (const [id, entry] of Object.entries(store.systems)) {
      if (entry?.system) bag[id] = migrate(entry.system)
    }
    return bag
  })

  if (local.keys.length) {
    const ids = Object.keys(local.items)
    let safe = true
    if (ids.length) {
      /*
       * ── ignoreDuplicates IS THE WHOLE SAFETY ARGUMENT ────────────────────
       *
       * A local copy is by definition one that did not get uploaded, which
       * means it is older than the row than any machine that DID upload. An
       * upsert that overwrote would let a laptop opened for the first time in
       * a fortnight destroy two weeks of work on the desktop. An id the
       * account already knows is left exactly as it is.
       *
       * Local ids are preserved rather than reissued, which is what the
       * composite primary key in supabase/005 is for.
       */
      const { error } = await supabase
        .from('studio_systems')
        .upsert(
          ids.map((id) => ({ id, owner: uid, doc: local.items[id] })),
          { onConflict: 'owner,id', ignoreDuplicates: true },
        )
        .select('id')
      if (error) safe = false
      else out.systems = ids.length
    }
    // Only once the write has landed. A key removed on the back of a request
    // that failed is work destroyed by the cleanup, which is the one outcome
    // this whole file exists to prevent.
    if (safe) for (const key of local.keys) drop(key)
  }

  // ── sequences ──────────────────────────────────────────────────────────────
  //
  // Through the RPC one at a time rather than as one upsert, because
  // `studio_sequences_save` (supabase/027) is what stamps `doc.id` and
  // `doc.updated` from the database clock — an upsert would put rows in that no
  // other write path could have produced. A library is a handful of documents,
  // so the round trips are affordable and the consistency is not optional.
  const seqs = collect<Record<string, unknown>>(SEQUENCES, uid, (v) => {
    const store = v as LocalSequences | null
    if (!store || typeof store.sequences !== 'object' || !store.sequences) return null
    return store.sequences
  })

  if (seqs.keys.length) {
    const ids = Object.keys(seqs.items)
    let safe = true
    if (ids.length) {
      // What the account already holds, so a re-captured sequence on another
      // machine is not clobbered by this browser's older copy.
      const { data: existing, error: readError } = await supabase
        .from('studio_sequences')
        .select('id')
      if (readError) safe = false
      else {
        const known = new Set((existing ?? []).map((r) => r.id as string))
        for (const id of ids) {
          if (known.has(id)) continue
          const { error } = await supabase.rpc('studio_sequences_save', {
            p_id: id,
            p_doc: seqs.items[id],
          })
          if (error) {
            safe = false
            break
          }
          out.sequences += 1
        }
      }
    }
    if (safe) for (const key of seqs.keys) drop(key)
  }

  return out
}

/**
 * The preferences this browser was holding, as a seed for the first merge.
 *
 * ── READ, NOT DELETED ────────────────────────────────────────────────────────
 *
 * `adoptLocalWork` deletes a key once its contents are safely a row. This one
 * cannot: the caller hands what comes back to `studio_prefs_merge`, and the
 * result of that merge is not known until after this function has returned.
 * `clearLocalPrefs` below is the second half, called once the row is back.
 *
 * Returns null when this browser was holding nothing, which is the ordinary
 * case and the one that must cost nothing — every sign-in after the first runs
 * through here.
 */
export function readLocalPrefs(uid: string): Partial<Prefs> | null {
  if (typeof localStorage === 'undefined') return null

  let guide: Partial<GuideState> | null = null
  const view: Partial<ViewPrefs> = {}
  let found = false

  for (const key of ours(GUIDE, uid)) {
    const parsed = parse<Partial<GuideState>>(get(key))
    if (parsed) {
      guide = { ...(guide ?? {}), ...parsed }
      found = true
    }
  }
  for (const key of ours(SECTIONS, uid)) {
    const parsed = parse<Record<string, boolean>>(get(key))
    if (parsed) {
      view.sections = { ...(view.sections ?? {}), ...parsed }
      found = true
    }
  }
  for (const key of ours(STRIP, uid)) {
    const raw = get(key)
    if (raw === 'small' || raw === 'medium' || raw === 'large') {
      view.strip = raw
      found = true
    }
  }
  for (const key of ours(SNAP, uid)) {
    const raw = get(key)
    if (raw !== null) {
      view.snap = raw === 'on'
      found = true
    }
  }
  for (const key of ours(CARRY, uid)) {
    const raw = get(key)
    if (raw !== null) {
      view.carry = raw === 'on'
      found = true
    }
  }

  if (!found) return null
  return {
    ...(guide ? { guide: guide as GuideState } : {}),
    view: {
      strip: view.strip ?? DEFAULT_STRIP_SIZE,
      sections: view.sections ?? {},
      snap: view.snap ?? DEFAULT_SNAP,
      carry: view.carry ?? DEFAULT_CARRY,
    },
  }
}

/**
 * Every studio key this browser holds for us, in every namespace, gone.
 *
 * Called once the merged preferences are back from the server, so nothing is
 * removed before the account has it. The document keys are normally already
 * gone by this point — `adoptLocalWork` drops them as it imports — and they are
 * listed anyway so that one function is the complete answer to "is there any
 * studio state left in this browser".
 */
export function clearLocalPrefs(uid: string): void {
  if (typeof localStorage === 'undefined') return
  for (const base of BASES) for (const key of ours(base, uid)) drop(key)
  for (const key of MARKERS) drop(key)
}
