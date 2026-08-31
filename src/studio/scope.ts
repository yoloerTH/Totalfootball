/**
 * WHOSE BROWSER STATE THIS IS.
 *
 * Every key the studio writes to `localStorage` used to be global to the
 * browser: `tf-studio:v1`, `tf-studio:guide:v1`, `tf.studio.sections`,
 * `tf.studio.strip`. That is fine for one coach on one laptop and wrong the
 * moment a second account signs in on the same machine, which is exactly what
 * happened (user, 2026-08-27): a brand new account opened the studio and got
 * the previous coach's guidance state — no welcome walkthrough, no what's-new
 * panel, their last board reopened, and their name and kit on it.
 *
 * ── THE THREE THINGS THAT WENT WRONG, AND WHICH ONE THIS FILE FIXES ──────────
 *
 *  1. Preferences leaked. The new account read the old account's keys.
 *     THIS FILE. Every key is now suffixed `::<user id>`, so two accounts on
 *     one browser cannot see each other's anything.
 *
 *  2. Work leaked, and it leaked UPWARDS. `claimLocalSystems` read that same
 *     unscoped systems key and upserted it into whoever had just signed in.
 *     The `select('id')` it diffs against is RLS-filtered to the NEW user, so
 *     the previous coach's boards looked unclaimed and were copied into a
 *     stranger's account permanently. Fixed in ./account/cloud.ts, which now
 *     claims from the GUEST scope only — work that genuinely has no owner.
 *
 *  3. Signing out cleared nothing. It now clears the whole namespace —
 *     `wipeScope` below — because the account is the source of truth and the
 *     browser copy is a buffer. A buffer that outlives the session it was
 *     filled for is just somebody else's data on a shared laptop.
 *
 * RLS was never involved. supabase/005 held; nothing crossed the server.
 *
 * ── WHY A MARKER AND NOT SUPABASE'S OWN SESSION ──────────────────────────────
 *
 * `readGuide()` is called in a `useState` initialiser and has to answer
 * synchronously, while `supabase.auth.getSession()` is a promise. The obvious
 * dodge is to parse Supabase's own persisted token out of `localStorage`, but
 * that is an internal storage format (it chunks and base64-wraps large sessions
 * depending on version) and reading it means owning a parser for somebody
 * else's private encoding forever.
 *
 * So: our own marker, written by `useSession` the instant it settles. The
 * staleness window that implies is closed by the gates rather than by luck —
 * `StudioMount` and `Portal` both refuse to render until `status === 'in'`, so
 * nothing reads a scoped key before the real owner is known.
 */

/** The namespace for work done by nobody in particular. See `claimLocalSystems`. */
export const GUEST = 'guest'

const OWNER_KEY = 'tf-studio:owner'

let owner: string | null = null
let known = false

function safeGet(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
  } catch {
    // Private window. Everything downstream falls back to defaults, which is
    // the right thing to lose.
    return null
  }
}

/**
 * Who the scoped keys belong to right now. `null` means nobody is signed in.
 *
 * Read from storage once and then cached, because this sits in the hot path of
 * every `readGuide()` and every drawer toggle.
 */
export function currentOwner(): string | null {
  if (!known) {
    owner = safeGet(OWNER_KEY)
    known = true
  }
  return owner
}

/**
 * Called by `useSession` on every settle: sign-in, sign-out, token refresh and
 * the trip back from OAuth. Idempotent — the common case is the same id again.
 */
export function setOwner(id: string | null): void {
  const next = id ?? null
  if (known && owner === next) return
  owner = next
  known = true
  try {
    if (typeof localStorage === 'undefined') return
    if (next) {
      localStorage.setItem(OWNER_KEY, next)
      adoptLegacy(next)
    } else {
      localStorage.removeItem(OWNER_KEY)
    }
  } catch {
    // Quota or a private window. In-memory `owner` still scopes this session's
    // keys correctly; only the survival across a reload is lost.
  }
}

/**
 * A storage key, namespaced.
 *
 * Pass `who` explicitly to reach a scope that is not the current one —
 * `scopedKey(KEY, GUEST)` is how the claim path reads unowned work.
 */
export function scopedKey(base: string, who?: string | null): string {
  const id = who === undefined ? currentOwner() : who
  return `${base}::${id ?? GUEST}`
}

/** Drop one base key from one scope. Used to retire guest work once claimed. */
export function clearScoped(base: string, who?: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(scopedKey(base, who))
  } catch {
    // Nothing to do about it, and nothing depends on it having worked.
  }
}

/**
 * Everything this browser holds for one account, gone.
 *
 * ── WHY SIGNING OUT NOW WIPES, WHEN IT DELIBERATELY DID NOT BEFORE ───────────
 *
 * Because the account became the source of truth. When the browser held the
 * only copy, keeping it was the whole point — wiping on sign-out would have
 * destroyed work. It no longer holds the only copy of anything: every system is
 * in `studio_systems`, every preference in `studio_prefs`, and signing back in
 * fetches both. What is left behind is a stale duplicate.
 *
 * On a shared laptop that duplicate is the entire problem. It is unreachable
 * through the UI — the next account reads its own namespace — but it is sitting
 * in the browser of a machine its owner has walked away from, and "unreachable
 * through our UI" is not the standard to hold somebody's work to.
 *
 * The owner MARKER is not cleared here; `setOwner(null)` does that, and doing
 * both in one function would make the order matter.
 */
export function wipeScope(who: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return
    for (const base of LEGACY) localStorage.removeItem(scopedKey(base, who))
  } catch {
    // A private window has nothing to wipe.
  }
}

// ── the one-time adoption ────────────────────────────────────────────────────

/**
 * Every key this file namespaces, in the form they had before it existed.
 *
 * Kept HERE rather than imported from the modules that own them, because those
 * modules import this one and the cycle would be for four string constants that
 * are frozen by definition — a legacy key never changes again.
 *
 * `wipeScope` iterates this too, which is the reason it is the complete list
 * and not just the ones adoption cared about. A key added to the studio and not
 * added here is a key that survives a sign-out.
 */
const LEGACY = ['tf-studio:v1', 'tf-studio:guide:v1', 'tf.studio.sections', 'tf.studio.strip', 'tf-studio:sequences:v1']

const ADOPTED_KEY = 'tf-studio:owner:adopted'

/**
 * Move the old unscoped keys into the first account that signs in after this
 * ships, exactly once.
 *
 * WHY THAT IS THE RIGHT OWNER, in almost every case. The studio has required an
 * account since 2026-08-13, so anything under a legacy key was written by
 * whoever was last signed in on this browser — and that is the same session
 * Supabase has persisted here and is about to hand back. The coach reloads
 * after the deploy and nothing has moved: same boards, same drawers open, no
 * walkthrough replayed at somebody who finished it months ago.
 *
 * WHERE IT IS WRONG: a browser where account A signed out and account B signed
 * in during the window between A writing those keys and this code shipping. B
 * adopts A's local copies. There is no bit anywhere in the browser that
 * distinguishes that case — the data was written without an owner and cannot be
 * given one after the fact. It costs one browser one time, it cannot recur once
 * the marker is set, and the alternative is stranding every existing coach's
 * local state to avoid it.
 *
 * The legacy keys are REMOVED as they are moved. Leaving them would leave a
 * loaded gun for the next build that forgot this file exists.
 */
function adoptLegacy(id: string): void {
  if (localStorage.getItem(ADOPTED_KEY)) return
  for (const base of LEGACY) {
    const raw = localStorage.getItem(base)
    if (raw === null) continue
    // Never overwrite: if this owner already has a scoped value, theirs is the
    // newer one and the legacy key is a leftover.
    if (localStorage.getItem(scopedKey(base, id)) === null) {
      localStorage.setItem(scopedKey(base, id), raw)
    }
    localStorage.removeItem(base)
  }
  localStorage.setItem(ADOPTED_KEY, id)
}
