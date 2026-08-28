/**
 * How finished a coach's profile is, and when it is fair to mention it.
 *
 * ── WHY A PROFILE IS WORTH FINISHING AT ALL ─────────────────────────────────
 *
 * Not for us, and not for a completeness score. Every field on the settings
 * page does a job somewhere else in the product, and a coach who has skipped
 * them is quietly getting a worse tool:
 *
 *  · their NAME and CLUB sign every share link, every printed page and every
 *    exported film (../viewer/CreditBar.tsx) — without them a system they send
 *    to their assistant arrives anonymous;
 *  · their KIT paints every new board in their colours instead of the house
 *    ones (`withProfile` in ./cloud.ts);
 *  · their CREST goes in the corner of the board, in the link, the PDF and the
 *    video (`crestUrl` in ../schema.ts);
 *  · their HANDLE is the only way anybody can be sent their public page.
 *
 * So the prompt this file drives is not "your profile is 40% complete". It is a
 * list of things that would each change something the coach can see, with a
 * sentence saying what. That is the whole design: `why` is not decoration, it
 * is the only honest reason to interrupt anybody.
 *
 * ── AND WHY IT IS NOT SHOWN EVERY TIME ──────────────────────────────────────
 *
 * Because a prompt that appears on every visit is an advert, and coaches learn
 * to dismiss adverts without reading them — at which point the one time it
 * mattered is also dismissed. `shouldNudge` below is the whole of the restraint
 * and it is deliberately conservative.
 */

import type { Profile } from './cloud'
import { roleLabel } from './identity'
import type { GuideState } from '../storage'

/** Where on the settings page a step is finished. Anchors, not routes. */
export type StepAnchor = 'you' | 'club' | 'kit'

export interface ProfileStep {
  id: string
  /** What the settings page calls it, so the two pages agree. */
  label: string
  /** What finishing it changes, in the product, in one line. */
  why: string
  done: boolean
  anchor: StepAnchor
}

/**
 * The seven things worth having, in the order worth having them.
 *
 * CORE FIRST — name, club, kit — because those three are the ones that change
 * what a shared system LOOKS like, and a coach who does only the first three
 * has got nearly all of the value. The four after them are for a coach who
 * wants a public page and a badge on the board, which is a real want and a
 * later one.
 *
 * Bio is deliberately not here. It is the one field on the settings page with
 * no consequence anywhere else — nothing renders differently for it — so
 * chasing somebody for it would be chasing them for the score.
 */
export function profileSteps(profile: Profile): ProfileStep[] {
  const has = (s: string) => Boolean(s.trim())
  return [
    {
      id: 'name',
      label: 'Your name',
      why: 'Signs every system you share, print or export.',
      done: has(profile.presenter),
      anchor: 'you',
    },
    {
      id: 'club',
      label: 'Your club',
      why: 'Goes beside your name on the credit line.',
      done: has(profile.team),
      anchor: 'club',
    },
    {
      id: 'kit',
      label: 'Your kit colour',
      why: 'Every new board opens in your colours instead of ours.',
      done: has(profile.teamColour),
      anchor: 'kit',
    },
    {
      id: 'crest',
      label: 'Club crest',
      why: 'Sits in the corner of the board, in links, PDFs and films.',
      done: has(profile.crestPath),
      anchor: 'club',
    },
    {
      id: 'role',
      label: 'What you do',
      why: 'Says whether a system came from a first-team coach or an academy one.',
      // `roleLabel` rather than a truthiness test on the raw string: a role
      // this build does not recognise is not a role, and storing one is how a
      // step reads as done while the page shows nothing.
      done: Boolean(roleLabel(profile.role)),
      anchor: 'you',
    },
    {
      id: 'avatar',
      label: 'Your picture',
      why: 'Your face on your public page, rather than an initial.',
      done: has(profile.avatarPath),
      anchor: 'you',
    },
    {
      id: 'handle',
      label: 'Your handle',
      why: 'The link that shows everything you have made public.',
      done: has(profile.handle),
      anchor: 'you',
    },
  ]
}

export interface Completion {
  steps: ProfileStep[]
  done: number
  total: number
  /** Only the unfinished ones, still in priority order. */
  missing: ProfileStep[]
  /** 0→1, for the meter. */
  fraction: number
  complete: boolean
}

export function profileCompletion(profile: Profile): Completion {
  const steps = profileSteps(profile)
  const done = steps.filter((s) => s.done).length
  const missing = steps.filter((s) => !s.done)
  return {
    steps,
    done,
    total: steps.length,
    missing,
    fraction: steps.length ? done / steps.length : 1,
    complete: missing.length === 0,
  }
}

/**
 * How long to leave it between asks, in days, by how many times we have asked.
 *
 * TWO SCHEDULES, PICKED BY HOW MUCH IS DONE, and that is the whole of the
 * restraint. A single schedule has to be either kind to the coach who has
 * nearly finished or useful to the coach who has not started, and it cannot be
 * both — the first one is being chased over a bio, and the second is the one
 * whose shared boards are going out anonymous.
 *
 *  · A coach who has not made a couple of changes yet gets `EMPTY`: asked back
 *    the next day, then every few days, because nothing they have shared so far
 *    carries their name, their club or their colours, and that is a real cost
 *    landing on them every time they send a board to somebody.
 *  · A coach who is underway gets `UNDERWAY`: they have understood the offer
 *    and chosen what to fill in. What is left is a crest, a handle, a
 *    photograph — worth having, not worth a fortnightly reminder.
 *
 * BOTH ESCALATE, which is the part that has to survive any retuning. Somebody
 * who has ignored this four times has told us something, and the honest reading
 * of it is "not now" rather than "you have not seen it yet". Each list runs out
 * on its own, so it stops without the coach ever having to find the button that
 * turns it off.
 *
 * A day before the first one, not zero: a coach who has just signed up is
 * looking at an empty shelf and wants to build something, not fill in a form.
 * The prompt is for their second visit, when they have a system worth signing.
 *
 * ── WHY IT IS NOT THE ONLY WAY THIS GETS MENTIONED ───────────────────────────
 *
 * The first version of these gaps was [2, 6, 18, 40], on the reasoning that a
 * prompt which appears often becomes an advert. That is true, and it is still
 * why this escalates. What it got wrong is that in practice most coaches met
 * the panel once, in their first fortnight, and never again — so a profile left
 * empty on day three stayed empty, and the restraint was costing exactly the
 * people it was written for (user, 2026-08-28).
 *
 * The answer is not to ask harder here. It is that this is no longer the only
 * place the studio mentions it: the portal header carries a permanent, silent
 * count of what is left (./Portal.tsx), and the export dialogs say so at the
 * one moment it actually costs something (../editor/IdentityToggle.tsx). Those
 * interrupt nobody, which is what lets THIS stay a prompt rather than becoming
 * the product's main way of asking.
 */
const GAPS_EMPTY = [1, 2, 4, 8, 16, 30]
const GAPS_UNDERWAY = [3, 8, 21, 45]

/**
 * How many finished steps count as "underway".
 *
 * TWO, because two is the point at which a coach has demonstrably found the
 * settings page and decided what they wanted off it — one could be the name
 * that ../editor/ShareDialog.tsx asks for in passing, which says nothing about
 * whether they ever opened the page at all.
 */
const UNDERWAY = 2

function gapsFor(completion: Completion): number[] {
  return completion.done >= UNDERWAY ? GAPS_UNDERWAY : GAPS_EMPTY
}

/**
 * Should the portal offer to help finish the profile right now?
 *
 * PURE, and takes the state rather than reading it, so the cadence can be
 * reasoned about and tested without a browser — the same posture as
 * `shouldAsk` in ../feedback.ts, and for the same reason.
 *
 * `firstSeenAt` is when this browser first knew about the account. It is passed
 * rather than stored because the portal already has one: the oldest system on
 * the shelf. A coach with no systems at all has never used the tool, and the
 * `complete` guard aside, that is exactly who should be left alone.
 */
export function shouldNudge(
  completion: Completion,
  guide: GuideState,
  firstSeenAt: number,
  now = Date.now(),
): boolean {
  if (completion.complete) return false
  if (guide.profileNudgeOff) return false
  const gaps = gapsFor(completion)
  /*
   * Asked as often as it is going to be. It stops rather than looping back.
   *
   * Against the schedule the coach is on TODAY, which means somebody who fills
   * two things in and moves to the longer list can find themselves already past
   * its end — four asks spent, four allowed — and is then left alone for good.
   * That is the right outcome: they have been asked four times and they have
   * acted on it twice, and there is nothing left worth interrupting them for.
   */
  if (guide.profileNudges >= gaps.length) return false
  // Somebody with nothing on the shelf has not used the tool yet, and a prompt
  // about signing your work is meaningless before there is any work.
  if (!firstSeenAt) return false

  const day = 86_400_000
  const gap = gaps[guide.profileNudges] * day
  // Before the FIRST ask the clock runs from when they started, not from a
  // nudge that has never happened — `profileNudgedAt` is 0 there, and treating
  // that as "1970" would show it to every new coach on their first minute.
  const since = guide.profileNudges === 0 ? firstSeenAt : guide.profileNudgedAt
  return now - since >= gap
}
