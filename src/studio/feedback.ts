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
 * FROM THE FIRST WIN
 *
 * This used to wait for the second, on the argument that the first share is the
 * moment the studio earns somebody and a form over it is taking the win to ask
 * for a favour. That argument is still true and it has been overruled
 * deliberately: at the size this is now, waiting for a second export means
 * hearing from only the coaches who already came back, which is the one group
 * whose opinion we can guess. The people worth hearing from are the ones who
 * made one thing and had a view about it.
 *
 * AND OFTEN ENOUGH TO BE USEFUL
 *
 * A week of quiet after any ask, answered or not, and a month after an answer.
 * These were 45 and 180 days. The cost of the change is real and is the thing
 * to watch: a tool that asks a busy person the same question too often teaches
 * them to dismiss everything it ever shows them, including the guide and
 * What's New, which are trying to help. That is why the dialog stayed one
 * screen with nothing required and a Not now that means it — and why the roll
 * below exists, so "more often" does not become "every time".
 *
 * AND SOMETIMES ON THE WAY IN
 *
 * A win is still the best moment to ask, and it is not the only one. A coach
 * who opened the studio, looked at what they built last week and closed it
 * again has an opinion that no export-shaped trigger will ever collect —
 * including, especially, the opinion that they could not face building another
 * one. `shouldAskOnOpen` is that ask: same quiet periods, plus a dice roll, so
 * it stays an occasional thing rather than a toll on opening the tool.
 */

import type { GuideState } from './storage'

/** Wins before the first ask. One finished thing is enough to have a view. */
const ASK_AFTER_WINS = 1

const DAY = 24 * 60 * 60 * 1000
/** Quiet after asking, whether or not they answered. */
const QUIET_AFTER_ASK = 7 * DAY
/** Quiet after they actually told us something. */
const QUIET_AFTER_SENT = 30 * DAY

/**
 * The chance an eligible opening is the one that asks.
 *
 * A quarter, and the number matters more than it looks. Every gate above is a
 * threshold, which means that once a coach is past all of them the ask is
 * DETERMINISTIC — open the studio on day eight and it is there, every time,
 * which is how a question turns into a toll gate. A roll turns "you are due"
 * into "sometimes", so two coaches with identical histories do not get an
 * identical experience and nobody learns to expect it.
 *
 * It is only ever rolled after everything else has already passed, so it makes
 * the ask rarer and can never make it more frequent.
 */
const OPEN_ASK_CHANCE = 0.25

/**
 * What the coach had just finished when they were asked. Stored with the row.
 *
 * 'open' is the odd one out and is the reason this is worth reading in the
 * report: it is the only context where the answer is NOT about a thing that
 * just worked. A 3 from somebody who has just watched a film render and a 3
 * from somebody who opened the studio and did nothing are two different facts,
 * and the second is the one that says something is missing.
 */
export type FeedbackContext = 'share' | 'video' | 'open'

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

/**
 * Should THIS opening of the studio be the one that asks?
 *
 * Every gate `shouldAsk` applies, and then a roll. Built on top of it rather
 * than beside it, so there is one definition of "this coach is due" and the two
 * triggers cannot drift into disagreeing about the quiet periods — the whole
 * risk of a second entry point is that it quietly becomes a way around the
 * limits the first one respects.
 *
 * `roll` is injectable so the decision stays pure and testable. The caller
 * passes nothing.
 */
export function shouldAskOnOpen(
  guide: GuideState,
  now = Date.now(),
  roll: number = Math.random(),
): boolean {
  if (!shouldAsk(guide, now)) return false
  return roll < OPEN_ASK_CHANCE
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
