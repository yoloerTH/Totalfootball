/**
 * "I am reworking one of theirs" — carried from /o/<slug>/ to the publish dialog.
 *
 * ── THE PROBLEM THIS SOLVES ──────────────────────────────────────────────────
 *
 * The two ends of a variation are a long way apart. A coach presses "Suggest a
 * variation" under an official system, which opens a COPY of it in the studio
 * (../editor/StudioMount.tsx, the `?t=` branch). They then edit it — for ten
 * minutes or for a week — and publishing does not happen in the editor at all:
 * it happens later, from the shelf on the portal, through
 * ../editor/PublishDialog.tsx. Nothing on that journey carries the fact that
 * this document started as a rework of ours.
 *
 * ── WHY NOT ON THE DOCUMENT ──────────────────────────────────────────────────
 *
 * The obvious place is a field on the `System`. It is wrong: the document is
 * what gets PUBLISHED, exported to mp4, shared by link and forked again, and a
 * private breadcrumb about our post would travel into all four. `scrubForPublishing`
 * would then need to know about it, which is one more thing that can be
 * forgotten.
 *
 * ── WHY NOT A COLUMN ON `studio_systems` ─────────────────────────────────────
 *
 * Considered, and it is the more durable answer — a coach who starts on a laptop
 * and publishes from a phone would keep the link. It was not worth a migration:
 * the intent is a PRE-FILL, not a permission. Everything that matters about a
 * variation is enforced server-side in supabase/032 — the comment's variation
 * must be the commenter's own public non-official post, checked by a trigger —
 * so the worst case when this is lost is that the coach publishes normally and
 * attaches nothing. Which is exactly what a coach who never pressed the button
 * gets, and is recoverable by pressing it again.
 *
 * ── WHY KEYED BY SYSTEM ID ───────────────────────────────────────────────────
 *
 * A single "pending variation" slot would be simpler and would mis-attribute:
 * start a variation, abandon it, publish something unrelated a day later, and
 * that unrelated system is announced under our thread as a rework of ours. The
 * id is the only thing that ties the intent to the document it is about.
 *
 * `sessionStorage`, not `localStorage`: a tab is roughly the span of an
 * intention, and a stale note in a shared browser is worth less than nothing.
 */

/** The query parameter `/studio/new/` reads. `?t=<template>&vary=<post>`. */
export const VARY_PARAM = 'vary'

/** What the publish dialog needs to say and to write. */
export interface VariationIntent {
  /** The official post being reworked — `studio_comments.variation` points back. */
  post: string
  /** Its title, so the dialog can name it without a round trip. */
  title: string
}

const KEY = 'tf.vary.'

function store(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    // Private windows, blocked site data, embedded webviews. A coach who cannot
    // store this can still publish; they just publish an ordinary post.
    return null
  }
}

export function rememberVariation(systemId: string, intent: VariationIntent): void {
  if (!systemId || !intent.post) return
  try {
    store()?.setItem(KEY + systemId, JSON.stringify(intent))
  } catch {
    /* quota, or a storage that throws on write. Not worth a message. */
  }
}

export function recallVariation(systemId: string): VariationIntent | null {
  if (!systemId) return null
  try {
    const raw = store()?.getItem(KEY + systemId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<VariationIntent>
    // Shape-checked rather than trusted: this is user-writable storage, and a
    // malformed note would otherwise reach the publish dialog as `undefined`
    // and be sent to PostgREST as a null foreign key.
    if (typeof parsed?.post !== 'string' || !parsed.post) return null
    return { post: parsed.post, title: typeof parsed.title === 'string' ? parsed.title : '' }
  } catch {
    return null
  }
}

/**
 * Forget it, once the variation has actually been offered.
 *
 * Called on a SUCCESSFUL publish only. Clearing it when the dialog closes would
 * punish a coach who opened it to look at the options and thought better of it.
 */
export function forgetVariation(systemId: string): void {
  if (!systemId) return
  try {
    store()?.removeItem(KEY + systemId)
  } catch {
    /* nothing to do about it, and nothing depends on it. */
  }
}
