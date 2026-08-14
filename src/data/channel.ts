/**
 * The channel's public numbers.
 *
 * Every figure on the site reads from here so nothing can go stale silently in
 * a component somewhere. `asOf` is rendered next to the proof strip, and a number
 * without a date is a number nobody can check.
 *
 * Sources: Motion Graphics/fb-insights/ANALYSIS-2026-07-24.md and the raw pulls
 * in fb-insights/data/.
 */
export const CHANNEL = {
  /** Combined across Facebook, Instagram, TikTok and YouTube. Confirmed 2026-08-14. */
  followers: 35000,
  followersLabel: '35,000+',
  /** Compositions registered in editor/src/Root.tsx that shipped as shorts. */
  shortsPublished: 88,
  /** Across everything published. User-reported 2026-08-09. */
  totalPlays: 5000000,
  totalPlaysLabel: '5M+',
  /**
   * Best single short: BackFour. Was 870k in the 2026-07-24 insights pull;
   * user reported 2M+ on 2026-08-09, so it has roughly doubled since.
   */
  bestShortPlays: 2000000,
  bestShortPlaysLabel: '2M+',
  /**
   * Provenance only. It used to print under the proof strip and was removed
   * (user, 2026-08-09) because a dated caption made living numbers look stale.
   * Keep it updated when the figures change so we know how old they are.
   */
  asOf: '2026-08-14',
} as const

/**
 * The measured facts that justify the site's editorial choices. Used on /about/
 * They are the honest version of "why this channel works", and they are far
 * more persuasive than adjectives.
 */
export const EVIDENCE = [
  {
    stat: '7 of 23',
    label: 'whole-team system clinics broke 20,000 plays',
    note: 'against 1 of 36 individual-technique shorts',
  },
  {
    stat: '65%',
    label: 'best watch-through rate on the channel',
    note: 'The Underlap, the ceiling for a 20-second explainer',
  },
  {
    stat: '0 clips',
    label: 'of broadcast footage used, ever',
    note: 'every frame is drawn, which is also why nothing gets claimed',
  },
] as const
