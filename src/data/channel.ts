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
  /** TODO(thanos): confirm before launch: 17,042 at the 2026-07-24 pull, you said 25k+. */
  followers: 25000,
  followersLabel: '25,000+',
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
  asOf: '2026-08-09',
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
