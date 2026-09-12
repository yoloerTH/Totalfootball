/**
 * What coaches said about one of ours, under the board it is about.
 *
 * ── WHY THIS SITS BELOW A FULL-HEIGHT APP ────────────────────────────────────
 *
 * `/o/<slug>/` is a locked studio at `h-[100dvh]` — the real editor, every panel,
 * board read-only (../editor/LockedStudio.tsx). The thread could have gone in
 * the right-hand rail and stayed inside that one screen. It is here instead for
 * two reasons that both turned out to be the same reason.
 *
 * A variation is a BOARD. The rail is about 320px and a column of boards in it
 * would be thumbnails of thumbnails; the whole claim of this feature is that a
 * coach can see what somebody else did to the system, and at that width they
 * cannot. And a page whose only content is a `client:only` island has nothing in
 * it for a crawler — the phase titles are injected as HowTo structured data
 * precisely because the visible page is empty — so every sentence a coach writes
 * down here is the first real prose these URLs have ever had.
 *
 * ── IT LOADS ITS OWN SESSION ─────────────────────────────────────────────────
 *
 * Rather than being handed one by the studio above it. They are two islands with
 * no common React root, and the alternative — hoisting both under one provider —
 * would mean the locked studio re-rendering every time the thread changed. The
 * hooks cache: `useSession` and `useProfile` are the same subscriptions the
 * portal uses, and the second island's cost is a cache read.
 *
 * ── THE GATE IS OPENED FROM TWO DIRECTIONS ───────────────────────────────────
 *
 * Before the fact, because a coach with no handle is shown the prompt instead of
 * a textarea they would be refused from; and after it, because `addComment`
 * reports a policy refusal and this opens the dialog with the draft still in the
 * box. The second path is not redundant — `needsIdentity` is deliberately false
 * while the profile is still loading (see ../account/Portal.tsx for why), so a
 * fast typist can reach the insert before the answer arrives.
 */

import { useCallback, useMemo, useState } from 'react'
import { Comments } from './Comments'
import { Mark } from '../viewer/Mark'
import { IdentityGate } from '../editor/IdentityGate'
import { putProfile, useProfile } from '../account/profile'
import { useSession } from '../account/session'
import { EMPTY_PROFILE, type Profile } from '../account/cloud'
import { VARY_PARAM } from './variation'

export default function OfficialThread({
  /** The `studio_posts` row this system's thread hangs on. */
  post,
  /** The template id, so "suggest a variation" opens the right copy. */
  template,
  /** The system's title, for the copy around the button. */
  title,
  /** Who owns the official post, so the moderation button is drawn for us. */
  postOwner,
}: {
  post: string
  template: string
  title: string
  postOwner: string
}) {
  const { user, status } = useSession()
  const { profile, status: profileStatus } = useProfile(user?.id)
  const [gate, setGate] = useState<null | 'comment' | 'variation'>(null)

  const owner = user?.id ?? ''

  /*
   * Same test as the portal's, and the same permissiveness while it is loading:
   * a gate that opens because an answer has not arrived yet is a gate in front
   * of a coach who filled these in months ago. The policy is the real check.
   */
  const hasIdentity =
    profileStatus === 'loading' ||
    Boolean(profile?.presenter.trim() && profile?.handle.trim())

  const varyHref = useMemo(
    () => `/studio/new/?t=${encodeURIComponent(template)}&${VARY_PARAM}=${encodeURIComponent(post)}`,
    [template, post],
  )

  /**
   * Start a variation, or collect what is missing first.
   *
   * Signed out goes to the login page with `next` set, so the coach lands back
   * here rather than on a portal they did not ask for — they were reading a
   * system, and the thing they pressed was about this system.
   */
  const startVariation = useCallback(() => {
    if (status !== 'in' || !owner) {
      const next = encodeURIComponent(window.location.pathname)
      window.location.href = `/studio/login/?next=${next}`
      return
    }
    if (!hasIdentity) {
      setGate('variation')
      return
    }
    window.location.href = varyHref
  }, [status, owner, hasIdentity, varyHref])

  return (
    <section id="thread" className="scroll-mt-4 border-t border-ink-hair bg-paper">
      <div className="mx-auto w-full max-w-[46rem] px-4 py-12 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-ink" aria-hidden="true">
            <Mark size={26} />
          </span>
          <div className="min-w-0">
            <h2 className="text-section font-black tracking-display text-ink">
              What coaches did with this one
            </h2>
            <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink-soft">
              Say what you would change, what you would keep, or what it reminded you of. Or take
              the board apart and put it back together your own way — a variation opens{' '}
              {title} as your own copy, and lands back here with your name on it.
            </p>
          </div>
        </div>

        {/*
          The call to action, above the thread rather than below it. A coach who
          has just watched eighteen phases is at their most likely to have an
          opinion about the system RIGHT NOW; making them read everybody else's
          first is how that moment gets spent.
        */}
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-hair bg-surface p-4">
          <button
            type="button"
            onClick={startVariation}
            className="w-full rounded-md bg-ink px-4 py-2 text-[13px] font-bold text-paper transition hover:opacity-90 sm:w-auto"
          >
            Suggest a variation
          </button>
          {/* `basis-full` below the breakpoint: at 420px a button sharing a row
              with three lines of explanation is a third of the width and reads
              as disabled. It stacks, then sits beside it from `sm` up. */}
          <p className="min-w-0 basis-full text-[12px] leading-relaxed text-ink-faint sm:flex-1 sm:basis-0">
            Opens your own copy in the studio. Publish it when you are happy and it appears down
            here as a board people can open, react to and fork again — with the credit staying
            yours.
          </p>
        </div>

        <Comments
          post={post}
          owner={owner}
          postOwner={postOwner}
          myName={profile?.presenter || ''}
          canWrite={hasIdentity}
          onNeedsIdentity={() => setGate('comment')}
        />
      </div>

      {gate && user && (
        <IdentityGate
          profile={(profile as Profile) ?? EMPTY_PROFILE}
          owner={user.id}
          intent="comment"
          onClose={() => setGate(null)}
          onDone={(next) => {
            putProfile(next)
            const resume = gate
            setGate(null)
            // Resume what they pressed. A coach who filled in two fields and
            // was then dropped back on the page with nothing happening has been
            // charged for something they did not receive.
            if (resume === 'variation') window.location.href = varyHref
          }}
        />
      )}
    </section>
  )
}
