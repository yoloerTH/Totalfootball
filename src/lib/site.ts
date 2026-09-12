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
  tagline: 'The Ultimate Football Tactics Board Tool',
  /** Used as the default meta description and the Organization description. */
  description:
    'The #1 interactive football tactics board tool for coaches and analysts. Build animated tactical presentations, design sessions, and explain football tactics with the Total Football Studio, featuring best-in-the-industry animation mechanisms and premium features.',
  locale: 'en',
  ogLocale: 'en_US',
} as const

/**
 * External profiles. These double as schema.org `sameAs`, which is the main
 * on-page lever for entity strength, the exact bottleneck the naurra.ai audit
 * identified. Keep this list complete and accurate.
 *
 * URLs are stored canonical and clean: no share tokens, no `utm_*`, no
 * `sec_uid`. A tracking-laden link in `sameAs` is worse than no link, because
 * it will not match the profile Google already has on file.
 *
 * NOTE: the YouTube handle is still @Fballvault, from the channel's old
 * "Football Vault" name. Renaming it would strengthen the entity further, since
 * every other profile now says Total Football.
 */
export const SOCIAL = {
  facebook: 'https://www.facebook.com/profile.php?id=61590673460742',
  instagram: 'https://www.instagram.com/total.fball/',
  youtube: 'https://www.youtube.com/@Fballvault',
  tiktok: 'https://www.tiktok.com/@total.fball',
  telegram: 'https://t.me/totalfootballstats',
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

/**
 * The account the official systems are published from.
 *
 * ── WHY A CONSTANT AND NOT A LOOKUP ──────────────────────────────────────────
 *
 * `/o/<slug>/` needs it to decide whether the reader is the coach who owns the
 * post, which is what draws the moderation button on a comment. That is a
 * question the page must answer at BUILD time, from a static page, with no
 * session and no database — and the answer never changes: it is the account
 * scripts/publish-official.mjs writes every official row under, and the same one
 * scripts/pull-system.mjs pulls them down from.
 *
 * It is a user id and not a secret. Every comment on the network already carries
 * its author's id in `studio_post_comments`, and RLS is what decides what an id
 * can do, so publishing this buys an attacker a uuid they could already read.
 */
export const OFFICIAL_OWNER = '04189c96-21fb-4772-9177-408856ec2c46'
