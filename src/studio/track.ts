/**
 * What the studio reports back, and the one place that decides it.
 *
 * WHY THIS FILE EXISTS. Everything the studio is for happens inside a React
 * island: a system gets built, published, saved as a film, printed. None of it
 * is a link, so the site-wide click listener in Analytics.astro cannot see any
 * of it, and for months the most-used part of the site was the only part with
 * no numbers at all. The daily Telegram report could tell you that forty people
 * read the library and nothing whatsoever about whether anybody made anything.
 *
 * WHAT IS SENT. A label out of the list below and nothing else. No system id,
 * no title, no club, no phase count, no document. A coach's system is theirs;
 * the events table has no column that could hold one and this is not the place
 * to invent one. `window.tfTrack` is already silent for a visitor who has opted
 * out, sent Global Privacy Control or Do Not Track, or looks like a bot, so
 * nothing here has to ask — see src/components/Analytics.astro.
 *
 * The labels are namespaced `studio:` so one query separates the product's
 * funnel from the marketing pages' CTAs.
 */

export const STUDIO_EVENTS = {
  /** A coach asked for a blank board. The top of the funnel. */
  newSystem: 'studio:new-system',
  /**
   * A coach opened one of ours to work on, with which one.
   *
   * Counted apart from `newSystem` because the two answer different questions.
   * A blank board is somebody who knows what they want to build; a template is
   * somebody who wants to be shown. If this one is where the coaches go, the
   * five documents in content/systems/ are worth more attention than the next
   * feature, and which of the five they pick says what to author next.
   */
  templateOpened: 'studio:template-opened',
  /**
   * Somebody went off to watch the film an official system was rendered from,
   * with which system and which platform.
   *
   * The claim those two cards make is "this board IS the video", and it is the
   * only claim on the page a coach can go and check for themselves. This counts
   * how often they do. A high number is not a leak — it is the proof landing,
   * and it says the pairing is worth doing for the next video too.
   */
  officialWatched: 'studio:official-watched',
  /**
   * The link to one of ours was copied off a portal card, with which one.
   *
   * Distinct from `shareSent`, which counts a coach sending their OWN system.
   * This is a coach passing on a system of ours, and it is the cheapest
   * distribution the studio has: it costs us nothing, it arrives recommended by
   * someone the receiver knows, and it lands on a viewer with a build-your-own
   * door already on it. Worth knowing which of the seven travels.
   */
  templateShared: 'studio:template-shared',
  /** A short link was written. The moment the tool did its job. */
  sharePublished: 'studio:share-published',
  /**
   * Publishing failed and the coach got the long self-contained link instead.
   * They are not blocked, which is why this is not an error dialog — and
   * exactly why it has to be counted, because otherwise a broken /api/share
   * looks like silence rather than like a fault.
   */
  shareFallback: 'studio:share-fallback',
  /** An MP4 finished writing, with the shape it was written in. */
  videoSaved: 'studio:video-saved',
  /**
   * The print stylesheet was used, which is how the PDF export happens.
   *
   * Counted from two places now — the shared viewer's own button and the
   * studio's Export dialog — and deliberately NOT split into two labels. The
   * question it answers is "does anybody make PDFs", and one number answers it;
   * a split would only answer "which button", which nobody is asking.
   */
  printed: 'studio:printed',
  /**
   * A set of PNGs finished writing, with the shape and size they came out at.
   *
   * The cheapest export we have and the one most likely to be the ONLY thing a
   * coach uses — it needs no WebCodecs, so it works in browsers that cannot
   * make a film at all. Worth knowing separately from `videoSaved` for exactly
   * that reason: if this is where the coaches are, the film is a feature for a
   * minority and the pictures are the product.
   */
  imagesSaved: 'studio:images-saved',
  /**
   * Somebody who arrived on a shared link pressed a build-your-own button, with
   * which one they pressed.
   *
   * The most important number on this list and the only one about a person who
   * is not a coach of ours yet. Every other event here is a user doing
   * something; this is the loop closing — one coach's system reaching a second
   * coach and that coach reaching for the tool. A share link that is opened
   * hundreds of times and converts nobody is a different problem from one that
   * is never opened, and without this the two look identical.
   */
  viewerCta: 'studio:viewer-cta',
  /**
   * A link was sent from the share dialog, by which route: WhatsApp, mail, the
   * system share sheet, or the clipboard. Counted at the press, because that is
   * genuinely all we can see — what happens in WhatsApp afterwards is theirs.
   */
  shareSent: 'studio:share-sent',
  /**
   * The portal's profile prompt, and what happened to it: shown, opened (with
   * which step), dismissed, or turned off for good.
   *
   * Worth counting as one label with a suffix rather than four events, because
   * the only useful number here is a RATIO — a prompt that is shown two hundred
   * times and opened twice is a prompt to delete, and neither half of that
   * sentence means anything without the other.
   */
  profileNudge: 'studio:profile-nudge',
  /** Somebody pressed a sign-in button. The attempt, not the outcome: the
      outcome is a redirect to Google and back, on a different page load. */
  signIn: 'studio:sign-in',
  /**
   * The help panel: which topic was opened, or which group was browsed.
   *
   * The most useful counter in this file, because it is the only one that
   * reports what a coach could not find on their own. A topic at the top of
   * this list is not a popular article — it is a control that is in the wrong
   * place, or named the wrong thing, and the fix is usually in the studio
   * rather than in the copy. A SEARCH that returns nothing is worth more still,
   * which is why the miss is counted separately.
   */
  help: 'studio:help',
  /** A search with no answer, with what was typed. See `help` above. */
  helpMiss: 'studio:help-miss',
} as const

type StudioEvent = (typeof STUDIO_EVENTS)[keyof typeof STUDIO_EVENTS]

/**
 * Record one event. Never throws, never blocks, and does nothing at all when
 * analytics is not on the page — which is the case under `astro dev` with the
 * script blocked, inside a print preview, and whenever a browser extension has
 * decided to remove it. A missing tracker must never take the studio with it.
 */
export function track(event: StudioEvent, suffix?: string): void {
  try {
    window.tfTrack?.(suffix ? `${event}:${suffix}` : event)
  } catch {
    /* analytics is never allowed to break the tool */
  }
}
