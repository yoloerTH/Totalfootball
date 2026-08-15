/**
 * Sign in, or make an account. One surface, not two pages.
 *
 * A coach who does not remember whether they have an account should not have to
 * pick a door before they can find out — and they cannot, because the answer is
 * exactly what they came here to discover. So both live here, the toggle is one
 * line of text, and the errors say which side of it they are on: "there is
 * already an account with that email, sign in instead" is worth more than any
 * amount of labelling above the fold.
 *
 * Google first, and visually heavier than the form. It is one press with
 * nothing to remember, most coaches have a Google account, and every password
 * that is never created is a password reset that never happens.
 *
 * The panel is the only thing on this page a coach can act on, so it is the
 * only thing on it carrying weight: a lifted surface with the brand's one
 * accent along its top edge, recessed fields, and headings at panel size rather
 * than page size. They were `text-title` — the site's 3.25rem hero step — which
 * is what made a 26rem card read as a page that had failed to fill its screen.
 * The page around it (../../pages/studio/login.astro) says what the account is
 * for; this says nothing that is not a control or the state of one.
 */

import { useCallback, useEffect, useState } from 'react'
import { accountsEnabled } from './client'
import { useSession, signInWithGoogle, signInWithPassword, signUpWithPassword } from './session'
import { STUDIO_EVENTS, track } from '../track'

type Mode = 'in' | 'up'

/** Panel-sized heading. Every state of this component opens with one. */
const HEADING = 'text-[1.6rem] font-black leading-[1.08] tracking-display text-ink'

/**
 * Fields are recessed rather than raised: the panel is `surface`, so a field on
 * `paper` reads as a hole cut in it on both grounds, where a second raised fill
 * would only have worked on one. The focus ring is ink at 6% rather than a
 * colour — gold and green are the board's, and a field is not the board.
 */
const FIELD =
  'mt-2 w-full rounded-xl border border-ink-hair bg-paper px-4 py-3 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-faint focus:border-ink/25 focus:shadow-[0_0_0_3px_rgb(var(--tf-ink)/0.06)]'

/**
 * Where to go afterwards, taken from `?next=` and forced to be somewhere on
 * this site.
 *
 * A login page that will redirect anywhere it is told is the classic phishing
 * handoff: a link to our real sign-in form, with `?next=https://evil.example`,
 * lands a coach on a copy of the portal asking them to sign in again. So this
 * accepts a path and only a path. A leading `//` is rejected too — the browser
 * reads `//evil.example` as protocol-relative and it is a URL, not a path.
 */
function safeNext(raw: string | null, fallback: string): string {
  if (!raw) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback
  return raw
}

export default function SignIn({ fallback = '/studio/portal/' }: { fallback?: string }) {
  const { status } = useSession()
  const [next] = useState(() =>
    typeof window === 'undefined'
      ? fallback
      : safeNext(new URLSearchParams(window.location.search).get('next'), fallback),
  )
  const [mode, setMode] = useState<Mode>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'google' | 'form' | null>(null)
  const [error, setError] = useState('')
  const [checkEmail, setCheckEmail] = useState(false)

  /*
   * Already signed in — including the moment the OAuth redirect lands back here
   * with a session in the URL. Sending them on is the whole job of this page at
   * that point, and `replace` keeps the login page out of the back button, so
   * "back" from the portal goes to wherever they actually came from.
   */
  useEffect(() => {
    if (status === 'in') window.location.replace(next)
  }, [status, next])

  const google = useCallback(async () => {
    setBusy('google')
    setError('')
    // The attempt, not the outcome. Google's redirect leaves this page and
    // comes back to another one, so the only thing measurable from here is
    // that somebody set off — which is still the number that says whether the
    // sign-in wall is costing us coaches.
    track(STUDIO_EVENTS.signIn, 'google')
    const res = await signInWithGoogle(next)
    // Only reached if the redirect failed to start; on success we are already
    // navigating away and this component is gone.
    if (!res.ok) {
      setError(res.error ?? 'Google would not open.')
      setBusy(null)
    }
  }, [next])

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setBusy('form')
      setError('')
      setCheckEmail(false)
      track(STUDIO_EVENTS.signIn, mode === 'in' ? 'password' : 'sign-up')
      const res =
        mode === 'in'
          ? await signInWithPassword(email, password)
          : await signUpWithPassword(email, password, next)
      setBusy(null)
      if (!res.ok) {
        setError(res.error ?? 'That did not work.')
        return
      }
      // A sign-up on a project with email confirmation on has no session yet,
      // so there is nothing to redirect to and saying "welcome" would be a lie.
      if (res.checkEmail) setCheckEmail(true)
      // Otherwise the session lands through onAuthStateChange and the effect
      // above does the navigating.
    },
    [mode, email, password, next],
  )

  if (!accountsEnabled) {
    return (
      <Shell>
        <h1 className={HEADING}>Accounts are not on yet</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          This build has no account server behind it, so there is nothing to sign in to yet. Nothing
          is broken: the deploy is just missing its keys.
        </p>
        {/* NOT a link to /studio/new/. The studio redirects here when nobody is
            signed in, and with accounts off nobody ever can be, so that link
            would bounce the visitor between two pages forever. */}
        <a
          href="/library/"
          className="mt-7 inline-flex rounded-xl bg-ink px-5 py-3 text-sm font-bold text-paper no-underline transition hover:-translate-y-px hover:shadow-lift"
        >
          Look at the library
        </a>
      </Shell>
    )
  }

  if (checkEmail) {
    return (
      <Shell>
        <h1 className={HEADING}>Check your email</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          We sent a link to <span className="font-bold text-ink">{email}</span>. Open it and you are in.
          You can close this tab.
        </p>
        <button
          type="button"
          onClick={() => {
            setCheckEmail(false)
            setMode('in')
          }}
          className="mt-7 text-sm font-bold text-ink-soft underline underline-offset-4 transition-colors hover:text-ink"
        >
          Back to signing in
        </button>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className={HEADING}>{mode === 'in' ? 'Sign in' : 'Make an account'}</h1>
      <p className="mt-2.5 text-[14px] leading-relaxed text-ink-soft">
        {mode === 'in'
          ? 'Your systems, on every machine you coach from.'
          : 'It takes a moment, and anything you have already built in this browser comes with you.'}
      </p>

      <button
        type="button"
        onClick={google}
        disabled={busy !== null}
        className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl border border-ink-hair bg-paper px-5 py-3.5 text-sm font-bold text-ink transition hover:-translate-y-px hover:border-ink/20 hover:shadow-paper disabled:pointer-events-none disabled:opacity-50"
      >
        <GoogleMark />
        {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
      </button>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-ink-hair" />
        <span className="text-micro uppercase text-ink-faint">or</span>
        <span className="h-px flex-1 bg-ink-hair" />
      </div>

      <form onSubmit={submit} noValidate>
        <label className="block">
          <span className="text-micro uppercase text-ink-faint">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@club.com"
            className={FIELD}
          />
        </label>

        <label className="mt-4 block">
          <span className="text-micro uppercase text-ink-faint">Password</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'in' ? 'Your password' : 'At least six characters'}
            className={FIELD}
          />
        </label>

        {/* The stripe carries the alarm so the fill can stay quiet. A panel-wide
            red wash for a mistyped password is a fire alarm for a typo. */}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border-l-[3px] border-[#E2473B] bg-[#E2473B]/[0.07] px-4 py-3 text-[13px] leading-relaxed text-ink"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy !== null}
          className="mt-5 w-full rounded-xl bg-ink px-5 py-3.5 text-sm font-bold text-paper transition hover:-translate-y-px hover:shadow-lift disabled:pointer-events-none disabled:opacity-50"
        >
          {busy === 'form' ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create the account'}
        </button>
      </form>

      <p className="mt-6 border-t border-ink-hair pt-5 text-center text-[13px] text-ink-soft">
        {mode === 'in' ? 'No account yet?' : 'Already have one?'}{' '}
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in')
            setError('')
          }}
          className="font-bold text-ink underline underline-offset-4"
        >
          {mode === 'in' ? 'Make one' : 'Sign in'}
        </button>
      </p>
    </Shell>
  )
}

/**
 * The panel.
 *
 * `overflow-hidden` is what lets the gradient sit flush in the rounded corners
 * rather than as a bar with square ends poking out of them. It is the only
 * brand colour on the page: gold→green is an accent everywhere on this site and
 * a login form is not the place to promote it to a fill.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[26rem] overflow-hidden rounded-2xl border border-ink-hair bg-surface shadow-lift">
      <div className="h-[3px] w-full bg-tf-gradient" aria-hidden="true" />
      <div className="p-7 sm:p-8">{children}</div>
    </div>
  )
}

/**
 * Google's mark, at the size their brand guidelines ask for next to the words
 * "Continue with Google". The four colours are theirs and are fixed values on
 * purpose: they must not follow our theme tokens.
 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}
