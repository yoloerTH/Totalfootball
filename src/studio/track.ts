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
  /** The print stylesheet was used, which is how the PDF export happens. */
  printed: 'studio:printed',
  /** Somebody pressed a sign-in button. The attempt, not the outcome: the
      outcome is a redirect to Google and back, on a different page load. */
  signIn: 'studio:sign-in',
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
