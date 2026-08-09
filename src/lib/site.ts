/**
 * Single source of truth for the origin and the brand's public identity.
 *
 * `SITE_URL` is env-driven for the reason in docs/SPEC.md §1: the launch address
 * is a subdomain, but the brand is expected to outgrow it. Nothing in the
 * codebase may hardcode the origin.
 */
export const SITE_URL = (
  import.meta.env.PUBLIC_SITE_URL || 'https://totalfootball.naurra.ai'
).replace(/\/$/, '')

/** The operating company, mirrored from naurra.ai's Organization schema. */
export const ENTITY = {
  legalName: 'NAURRA AI LTD',
  registration: 'HE 493756',
  street: '10 Kyriakou Matsi, LILIANA COURT, 4th Floor',
  locality: 'Nicosia',
  postalCode: '1082',
  country: 'CY',
  email: 'athanasios@naurra.ai',
} as const

export const SITE = {
  name: 'Total Football',
  tagline: 'The beautiful game, in full',
  /** Used as the default meta description and the Organization description. */
  description:
    'Football tactics explained through hand-drawn motion graphics. Every system on the board, phase by phase. No broadcast clips, no noise, just the game as a diagram.',
  locale: 'en',
  ogLocale: 'en_US',
} as const

/**
 * External profiles. These double as schema.org `sameAs`, which is the main
 * on-page lever for entity strength, the exact bottleneck the naurra.ai audit
 * identified. Keep this list complete and accurate.
 *
 * TODO(thanos): confirm the Facebook page URL and whether the YouTube channel
 * is live before launch. Placeholders are filtered out of `sameAs` below.
 */
export const SOCIAL = {
  facebook: '',
  youtube: '',
  telegram: 'https://t.me/totalfootballstats',
  tiktok: '',
  instagram: '',
} as const

export const sameAs = Object.values(SOCIAL).filter(Boolean)

/** Astro is configured with `trailingSlash: 'always'`, so respect it everywhere. */
export function withTrailingSlash(path: string): string {
  if (!path.startsWith('/')) path = `/${path}`
  if (path.endsWith('/')) return path
  // Don't append to file-like paths (/rss.xml, /llms.txt).
  const last = path.split('/').pop() ?? ''
  return last.includes('.') ? path : `${path}/`
}

/** Absolute URL for canonicals, OG tags and structured data. */
export function abs(path: string): string {
  if (path.startsWith('http')) return path
  return `${SITE_URL}${withTrailingSlash(path)}`
}
