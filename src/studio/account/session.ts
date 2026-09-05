/**
 * Who is signed in, and the four ways to change that.
 *
 * A hook rather than a context provider. The reference implementation wraps the
 * whole app in an AuthProvider, which is the right shape for a single-page app;
 * this site is Astro, every studio page is its own island, and there is no
 * common React root to hang a provider from. `supabase.auth` is already a
 * process-wide singleton with its own subscription model, so a hook that
 * subscribes to it gives every island the same answer without a tree to thread
 * it through.
 *
 * `status` is three states and not a boolean, because "signed out" and "we do
 * not know yet" must not render the same. A gate that treats the unknown state
 * as signed-out bounces a signed-in coach to the login page for the half second
 * before the session is restored, every single time they open the portal.
 */

import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { accountsEnabled, db } from './client'
import { resetSession } from '../storage'
import { forgetSequences } from '../sequences'
import { forgetVersions } from './cloud'
import { forgetProfile } from './profile'
import { stopPrefs } from './prefs'

/**
 * Who every in-memory cache in the studio currently belongs to.
 *
 * MODULE SCOPE, NOT EFFECT SCOPE, and the distinction is a bug waiting to be
 * reintroduced: `useSession` is an ordinary hook, so half a dozen components
 * each run their own copy of the effect below. A per-effect answer to "has the
 * coach changed" is `null` for every one of them on mount, so a panel opening
 * mid-session would clear the profile and version caches out from under the
 * editor. There is one browser, one signed-in coach and therefore one answer.
 *
 * `undefined` is "nobody has asked yet" and is distinct from `null`, which is
 * "signed out" — otherwise the very first settle of a signed-out visitor would
 * look like a change and clear caches that were never filled.
 */
let whose: string | null | undefined = undefined

export type SessionStatus = 'unknown' | 'in' | 'out'

export interface SessionState {
  status: SessionStatus
  session: Session | null
  user: User | null
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    // With no Supabase env there is nothing to wait for, and a gate that waits
    // forever renders a spinner nobody can get past.
    status: accountsEnabled ? 'unknown' : 'out',
    session: null,
    user: null,
  })

  useEffect(() => {
    const supabase = db()
    if (!supabase) return

    let live = true
    const settle = (session: Session | null) => {
      if (!live) return
      /*
       * BEFORE the setState, and outside the `live` guard's spirit on purpose.
       *
       * A session change means the in-memory caches belong to the wrong coach.
       * There used to be a whole namespacing scheme here (`setOwner`, the old
       * ../scope.ts) because those caches lived in localStorage and outlived the
       * session that filled them — a new coach signing in on a browser that had
       * already been used got the previous one's guide state, their last board
       * and their kit (user, 2026-08-27). Nothing outlives the tab any more, so
       * emptying it is the whole fix, and it is one line.
       *
       * A token refresh settles with the SAME user, and must not empty a cache
       * the editor is mid-session against; only an actual change of coach does.
       */
      const next = session?.user.id ?? null
      if (next !== whose) {
        whose = next
        resetSession()
        forgetVersions()
        forgetSequences()
        forgetProfile()
      }
      setState({ status: session ? 'in' : 'out', session, user: session?.user ?? null })
    }

    supabase.auth.getSession().then(({ data }) => settle(data.session))

    // Fires on sign-in, sign-out, token refresh, and once on the way back from
    // the OAuth redirect. Subscribing covers the redirect case without this
    // hook needing to know a redirect happened.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => settle(session))

    return () => {
      live = false
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}

// ── the four actions ─────────────────────────────────────────────────────────

/**
 * Errors a coach can read.
 *
 * Supabase's messages are written for developers ("Invalid login credentials",
 * "User already registered"). A coach in their fifties reading "Invalid login
 * credentials" does not learn whether they typed the wrong password or have no
 * account at all, which is the only thing they need to know next.
 */
function readable(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) {
    return 'That email and password do not match an account. Check the password, or make one below.'
  }
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'There is already an account with that email. Sign in instead.'
  }
  if (m.includes('email not confirmed')) {
    return 'Check your email and open the link we sent, then sign in.'
  }
  if (m.includes('password') && m.includes('6')) {
    return 'Passwords need to be at least six characters.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many tries. Wait a minute and go again.'
  }
  if (m.includes('unable to validate email') || m.includes('invalid email')) {
    return 'That does not look like an email address.'
  }
  return message
}

export interface AuthResult {
  ok: boolean
  /** Set when the coach must go and open an email before they can sign in. */
  checkEmail?: boolean
  error?: string
}

const NO_CLIENT: AuthResult = {
  ok: false,
  error: 'Accounts are not switched on in this build.',
}

/**
 * Google. Sends the browser away and brings it back to `next`.
 *
 * Resolves only if starting the redirect FAILED — on success the page is
 * already navigating, so callers must not put a "signed in" state behind this.
 */
export async function signInWithGoogle(next: string): Promise<AuthResult> {
  const supabase = db()
  if (!supabase) return NO_CLIENT
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: new URL(next, window.location.origin).toString() },
  })
  return error ? { ok: false, error: readable(error.message) } : { ok: true }
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const supabase = db()
  if (!supabase) return NO_CLIENT
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  return error ? { ok: false, error: readable(error.message) } : { ok: true }
}

/**
 * Make an account.
 *
 * Whether this signs them straight in depends on a project setting we do not
 * control from here: with email confirmation ON, Supabase returns a user with
 * no session and sends a link. `checkEmail` reports which of those happened so
 * the page can say the true thing rather than a hopeful one.
 */
export async function signUpWithPassword(
  email: string,
  password: string,
  next: string,
): Promise<AuthResult> {
  const supabase = db()
  if (!supabase) return NO_CLIENT
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: new URL(next, window.location.origin).toString() },
  })
  if (error) return { ok: false, error: readable(error.message) }
  return { ok: true, checkEmail: !data.session }
}

/**
 * Sign out, and stop this browser reading as the coach who just left.
 *
 * `onAuthStateChange` would clear the owner marker a moment later anyway, but
 * both call sites follow this with `window.location.replace`, and a navigation
 * that beats the event leaves the session cache full — so the next account to
 * sign in on this machine would spend its first render inside a stranger's
 * guide state. Emptying it here makes that ordering irrelevant.
 *
 * ── THERE IS NOTHING IN THE BROWSER LEFT TO WIPE ─────────────────────────────
 *
 * This used to clear a whole namespace of localStorage keys, because the
 * departing coach's work and preferences were sitting in them on a machine they
 * had walked away from. Nothing is written to localStorage any more, so the
 * only thing to drop is memory, and memory is gone when the tab is anyway. What
 * this buys is the case where the tab is NOT closed: signing out and handing the
 * laptop over, in one window.
 *
 * The order matters and is: flush the pending preference patch, THEN drop every
 * cache. Dropping first would flush an empty one.
 */
export async function signOut(): Promise<void> {
  await db()?.auth.signOut()
  // Sends whatever was still sitting in the debounce. There is no local copy
  // for it to be recovered from on the next sign-in any more.
  stopPrefs()
  forgetVersions()
  forgetSequences()
  // The in-memory profile goes with them. It is the coach's name, club and
  // crest, and it must not survive into the next sign-in on this machine.
  forgetProfile()
  resetSession()
}
