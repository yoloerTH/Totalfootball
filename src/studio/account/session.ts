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
import { setOwner } from '../scope'
import { stopPrefs } from './prefs'

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
       * This is the line that tells ../storage.ts whose keys to read. Every
       * consumer of those keys is gated behind `status === 'in'`, so setting the
       * owner first means no component can ever render against the previous
       * account's namespace — which is what a new coach signing in on a browser
       * that had already been used got instead of a welcome walkthrough
       * (user, 2026-08-27). See ../scope.ts.
       */
      setOwner(session?.user.id ?? null)
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
 * that beats the event leaves the marker set — so the next account to sign in
 * on this machine would spend its first render inside a stranger's namespace.
 * Clearing it here makes that ordering irrelevant.
 *
 * The departing coach's namespaced keys are LEFT ALONE. They are unreachable
 * from any other account now, and signing back in should find your work where
 * you left it rather than an empty studio. See ../scope.ts.
 */
export async function signOut(): Promise<void> {
  await db()?.auth.signOut()
  stopPrefs()
  setOwner(null)
}
