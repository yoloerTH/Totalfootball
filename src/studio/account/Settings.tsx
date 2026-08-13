/**
 * Settings: how a coach's work is signed.
 *
 * Three fields, and they are the three the share dialog already asks for. That
 * is the point of this page — the dialog asks every single time because it has
 * nowhere to remember the answer, and this is the somewhere. `System.credit`
 * still lives on each document (see ../schema.ts), so a system shared last
 * season keeps the club the coach was at last season; this only supplies the
 * DEFAULT a new system starts with.
 *
 * There is no avatar, no display name, no notification preferences and no
 * account deletion. Every one of those is a settings page a coach has to read
 * before they can find the thing they came for, and none of them do anything in
 * this product yet.
 */

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_US } from '../schema'
import { useSession, signOut } from './session'
import { EMPTY_PROFILE, loadProfile, saveProfile, type Profile } from './cloud'

type State = 'loading' | 'ready' | 'saving' | 'saved' | 'failed'

export default function Settings() {
  const { status, user } = useSession()
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE)
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    if (status !== 'out') return
    window.location.replace('/studio/login/?next=%2Fstudio%2Fsettings%2F')
  }, [status])

  useEffect(() => {
    if (status !== 'in') return
    let live = true
    void loadProfile().then((p) => {
      if (!live) return
      setProfile(p ?? EMPTY_PROFILE)
      setState('ready')
    })
    return () => {
      live = false
    }
  }, [status])

  const save = useCallback(async () => {
    if (!user) return
    setState('saving')
    const ok = await saveProfile(profile, user.id)
    setState(ok ? 'saved' : 'failed')
  }, [profile, user])

  const set = (patch: Partial<Profile>) => {
    setProfile((p) => ({ ...p, ...patch }))
    setState('ready')
  }

  if (status !== 'in' || state === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-micro uppercase text-ink-faint">
          {status === 'out' ? 'Taking you to sign in…' : 'Opening your settings…'}
        </p>
      </div>
    )
  }

  const colour = profile.teamColour || DEFAULT_US.base

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <header className="border-b border-ink-hair pb-6">
        <a
          href="/studio/portal/"
          className="text-[13px] font-bold text-ink-soft no-underline hover:text-ink"
        >
          ‹ Your systems
        </a>
        <h1 className="mt-3 text-title font-black tracking-display text-ink">Settings</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          What goes at the foot of every board you share, so you sign your work once instead of every
          time.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-micro uppercase text-ink-faint">How your work is signed</h2>

        <label className="mt-5 block">
          <span className="text-[13px] font-bold text-ink">Your name</span>
          <input
            value={profile.presenter}
            onChange={(e) => set({ presenter: e.target.value })}
            placeholder="Who is presenting"
            maxLength={48}
            className="mt-1.5 w-full rounded-lg border border-ink-hair bg-surface px-4 py-3 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-ink/30"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-[13px] font-bold text-ink">Club or team</span>
          <input
            value={profile.team}
            onChange={(e) => set({ team: e.target.value })}
            placeholder="AEL Limassol U16"
            maxLength={48}
            className="mt-1.5 w-full rounded-lg border border-ink-hair bg-surface px-4 py-3 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-ink/30"
          />
        </label>

        <div className="mt-4">
          <span className="text-[13px] font-bold text-ink">Your colour</span>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-faint">
            The counter fill for your team. The labels switch between white and black on their own so
            they stay readable.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="color"
              value={colour}
              onChange={(e) => set({ teamColour: e.target.value.toUpperCase() })}
              aria-label="Your colour"
              className="h-11 w-16 cursor-pointer rounded-lg border border-ink-hair bg-surface p-1"
            />
            <span className="font-mono text-[13px] text-ink-soft">{colour}</span>
            {profile.teamColour && (
              <button
                type="button"
                onClick={() => set({ teamColour: '' })}
                className="text-[12px] font-bold text-ink-faint underline underline-offset-4 hover:text-ink"
              >
                Back to the house green
              </button>
            )}
          </div>
        </div>

        {/* The credit bar, as it will actually read. Showing it beats describing
            it, and it is the only thing on this page a coach can check. */}
        <div className="mt-7 rounded-xl border border-ink-hair bg-paper p-4">
          <p className="text-micro uppercase text-ink-faint">On every board you share</p>
          <div className="mt-3 flex items-center justify-between gap-4 border-t border-ink-hair pt-3">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-bold leading-tight text-ink">
                {[profile.presenter.trim(), profile.team.trim()].filter(Boolean).join(' · ') ||
                  'A tactical system'}
              </p>
            </div>
            <span className="shrink-0 text-right text-[10px] font-bold uppercase leading-tight tracking-micro text-ink-soft">
              Made with
              <br />
              Total Football
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={state === 'saving'}
            className="rounded-lg bg-ink px-5 py-3 text-sm font-bold text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save'}
          </button>
          {state === 'failed' && (
            <p className="text-[13px] text-ink-soft">
              That did not save. Check your connection and press it again.
            </p>
          )}
        </div>
      </section>

      <section className="mt-12 border-t border-ink-hair pt-6">
        <h2 className="text-micro uppercase text-ink-faint">Account</h2>
        <p className="mt-3 text-[14px] text-ink-soft">
          Signed in as <span className="font-bold text-ink">{user?.email ?? 'your account'}</span>.
        </p>
        <button
          type="button"
          onClick={() => void signOut().then(() => window.location.replace('/studio/'))}
          className="mt-4 rounded-lg border border-ink-hair px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-ink-hair"
        >
          Sign out
        </button>
      </section>
    </div>
  )
}
