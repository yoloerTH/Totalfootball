/**
 * Asking a coach how it is going, without becoming the thing they remember.
 *
 * WHEN, AND WHY NOT ON A TIMER
 *
 * "Every now and then" implemented as a clock asks whoever happens to be at the
 * board when it goes off — which is, disproportionately, somebody in the middle
 * of trying to get something finished. This asks after a WIN instead: the two
 * moments the tool has just visibly done its job, which are a share link being
 * published and a film finishing. Somebody who has just watched their system
 * render has an opinion, has it right now, and is in a position to give it in
 * twenty seconds.
 *
 * It is the same argument made against triggering What's New on a login count,
 * and it lands the same way. A count of visits measures attendance. A count of
 * finished exports measures whether the thing worked.
 *
 * NEVER ON THE FIRST ONE
 *
 * The first share and the first film are the moments the studio earns somebody,
 * and putting a form over that is taking the win to ask for a favour. From the
 * second onward they have enough of a view to be worth asking for.
 *
 * AND THEN RARELY
 *
 * Forty-five days of quiet after any ask, answered or not, and half a year after
 * an answer. A coach builds systems in bursts around a season, so these are
 * deliberately long: the failure mode to avoid is not "we did not collect
 * enough", it is a tool that asks a busy person the same question twice in a
 * fortnight and teaches them to dismiss everything it ever shows them —
 * including the guide and What's New, which are trying to help.
 */

import type { GuideState } from './storage'

/** Wins before the first ask. The first one is theirs. */
const ASK_AFTER_WINS = 2

const DAY = 24 * 60 * 60 * 1000
/** Quiet after asking, whether or not they answered. */
const QUIET_AFTER_ASK = 45 * DAY
/** Quiet after they actually told us something. */
const QUIET_AFTER_SENT = 180 * DAY

/** What the coach had just finished when they were asked. Stored with the row. */
export type FeedbackContext = 'share' | 'video'

/**
 * Should this win be the one that asks?
 *
 * Pure, and takes the guide state rather than reading it, so the decision can
 * be tested and so the caller can pass the state it has already latched — the
 * editor holds a ref to it inside its pointer handlers.
 */
export function shouldAsk(guide: GuideState, now = Date.now()): boolean {
  // Somebody still being taught the tool is not being asked to review it.
  if (!guide.seen) return false
  if (guide.wins < ASK_AFTER_WINS) return false
  if (guide.feedbackSentAt && now - guide.feedbackSentAt < QUIET_AFTER_SENT) return false
  if (guide.feedbackAskedAt && now - guide.feedbackAskedAt < QUIET_AFTER_ASK) return false
  return true
}

export interface Feedback {
  /** 0–5 in half steps, or null if they only wanted to write something. */
  rating: number | null
  /** 0–10, how likely they are to tell another coach. */
  recommend: number | null
  note: string
  context: FeedbackContext
}

/**
 * Send it, and never make a coach's problem out of the result.
 *
 * Resolves false on anything that went wrong, including the 404 you get under
 * `astro dev` where Netlify Functions do not exist. The dialog thanks them
 * either way, and that is a deliberate choice rather than laziness: a coach who
 * has just done us a favour cannot act on "could not reach the server", has
 * nothing to retry that is worth their time, and telling them their opinion was
 * lost is a worse ending than the one where they think it landed. The failure
 * is ours to see in the function logs.
 */
export async function sendFeedback(f: Feedback): Promise<boolean> {
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating: f.rating,
        recommend: f.recommend,
        note: f.note.trim() || null,
        context: f.context,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
