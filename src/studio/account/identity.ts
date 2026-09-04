/**
 * What a valid public identity looks like.
 *
 * RULES ONLY. No network, no React, no Supabase client — so this file can be
 * imported by the settings form, by the public profile page when Phase 2 builds
 * one, and by any script that ever has to check a handle, without dragging a
 * session behind it.
 *
 * ── EVERY RULE HERE IS ALSO A CONSTRAINT IN supabase/012 ─────────────────────
 *
 * That duplication is deliberate and it is not belt-and-braces: the two do
 * different jobs. The database's job is to be RIGHT — it is the last line, and a
 * client that skipped these checks still cannot write a bad row. This file's job
 * is to be KIND: to say "that one is taken" under the input while the coach is
 * still typing, instead of letting Postgres answer 23514 after they press save.
 *
 * They must not drift. If you change a rule, change it in both, and the reserved
 * list below is the one most likely to be edited in only one place.
 */

/** Roles a coach can pick. The value is stored; the label is shown. */
export const ROLES = [
  { id: 'coach', label: 'Coach' },
  { id: 'analyst', label: 'Analyst' },
  { id: 'player', label: 'Player' },
  { id: 'scout', label: 'Scout' },
  { id: 'educator', label: 'Educator' },
  { id: 'other', label: 'Something else' },
] as const

export type RoleId = (typeof ROLES)[number]['id']

export function roleLabel(id: string | null | undefined): string {
  return ROLES.find((r) => r.id === id)?.label ?? ''
}

/**
 * The shirt patterns a coach can pick, and what to call them.
 *
 * The ids match `KitPattern` in ../schema and the CHECK in supabase/013. Three
 * places, one list, and the same warning the reserved-handle list carries: if
 * you add one, add it in all three, because a value that only this file knows
 * about is a form that offers a kit the database refuses to store.
 *
 * 'solid' is in the list rather than represented by an empty string, because it
 * is a real choice a coach makes and the picker has to have something to select
 * when they make it.
 */
export const KIT_PATTERNS = [
  { id: 'solid', label: 'Plain' },
  { id: 'stripes', label: 'Stripes' },
  { id: 'hoops', label: 'Hoops' },
  { id: 'halves', label: 'Halves' },
  { id: 'sash', label: 'Sash' },
] as const

export function patternFault(pattern: string): string | null {
  if (!pattern) return null
  return KIT_PATTERNS.some((k) => k.id === pattern) ? null : 'That is not a kit pattern.'
}

/**
 * The three states a profile can be in. Matches the CHECK in supabase/024.
 *
 * 'unlisted' ARRIVED AFTER 'private' AND DID NOT REDEFINE IT. A coach who set
 * their profile private in Phase 1 meant "nobody", and they still have it. The
 * new state sits between: reachable by anybody holding the link, never in the
 * feed and never in search.
 */
export type Visibility = 'private' | 'unlisted' | 'public'

/**
 * The picker, and the sentence under each option.
 *
 * THE COPY FOR 'unlisted' SAYS "not listed" AND NEVER "secret", because a
 * handle is short and chosen and a determined stranger can type one. That is
 * the honest description of what the link-only state buys, and supabase/024
 * says the same thing in the CHECK's comment. A post id is random and is a
 * different matter; this is about the profile page.
 */
export const VISIBILITIES = [
  {
    id: 'private',
    label: 'Private',
    hint: 'Nobody but you. Your systems, your squad and your kit stay exactly where they are.',
  },
  {
    id: 'unlisted',
    label: 'Link only',
    hint: 'Anyone you send the link to can open your profile. It stays out of the feed and out of search.',
  },
  {
    id: 'public',
    label: 'Public',
    hint: 'Listed in the feed, findable by anyone. What you publish can be opened, saved and forked with credit.',
  },
] as const

export function visibilityLabel(id: string | null | undefined): string {
  return VISIBILITIES.find((v) => v.id === id)?.label ?? 'Private'
}

/**
 * Coaching licences, and the exact nine UEFA sets minimum criteria for.
 *
 * Read off uefa.com/development/coaches/uefa-coaching-licences on 2026-09-04:
 * C, B, A and Pro, plus the specialist Youth B, Elite Youth A, Goalkeeper B,
 * Goalkeeper A and Futsal B. Same list as the CHECK in supabase/024 and the
 * same warning the reserved-handle list carries — change one, change both.
 *
 * WHY 'other' IS ON THE LIST. A licence is issued by a member association, and
 * a coach may hold an FA Level 1, a badge from outside UEFA, or nothing yet. A
 * picker with only UEFA badges on it invites a coach to overclaim, and this
 * product's whole credibility argument (docs/SOCIAL.md §5c) is that a claim
 * about a qualification is worth something. Leaving it blank is also fine and
 * is the default.
 *
 * NOTHING HERE IS VERIFIED and no label may suggest it is. It is a coach
 * telling you what they hold, shown as such.
 */
export const LICENCES = [
  { id: 'uefa_pro', label: 'UEFA Pro' },
  { id: 'uefa_a', label: 'UEFA A' },
  { id: 'uefa_b', label: 'UEFA B' },
  { id: 'uefa_c', label: 'UEFA C' },
  { id: 'uefa_elite_youth_a', label: 'UEFA Elite Youth A' },
  { id: 'uefa_youth_b', label: 'UEFA Youth B' },
  { id: 'uefa_gk_a', label: 'UEFA Goalkeeper A' },
  { id: 'uefa_gk_b', label: 'UEFA Goalkeeper B' },
  { id: 'uefa_futsal_b', label: 'UEFA Futsal B' },
  { id: 'other', label: 'Another qualification' },
] as const

export type LicenceId = (typeof LICENCES)[number]['id']

export function licenceLabel(id: string | null | undefined): string {
  return LICENCES.find((l) => l.id === id)?.label ?? ''
}

export function licenceFault(licence: string): string | null {
  if (!licence) return null
  return LICENCES.some((l) => l.id === licence) ? null : 'That is not one of the licences on the list.'
}

export const BIO_MAX = 280
export const HANDLE_MAX = 30
export const LINKS_MAX = 5

/**
 * Routes this site owns, plus the ones Phase 2 and 3 will want.
 *
 * KEEP IN SYNC WITH THE CHECK IN supabase/012. A name that reaches the database
 * and is rejected there is a confusing error at the end of a form; a name that
 * reaches the database and is ACCEPTED there because only this list was updated
 * is a coach who owns a route we are about to need.
 */
const RESERVED = new Set([
  'about','account','admin','api','auth','blog','c','course','dashboard',
  'faq','feed','help','home','intelligence','library','login','logout',
  'me','new','news','newsletter','o','portal','post','preview','privacy',
  'profile','register','render','root','rss','s','search','settings',
  'shoot','signin','signup','sitemap','staff','studio','support','system',
  'systems','team','terms','totalfootball','user','users','watch','www',
])

/**
 * The same shape the CHECK pins: lowercase, 3 to 30, alphanumeric with single
 * underscores inside. Anchored, because an unanchored test would pass a handle
 * that merely CONTAINS a valid one.
 */
const HANDLE_SHAPE = /^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$/

/**
 * What a coach typed, turned into what would be stored.
 *
 * Lowercasing here rather than rejecting mixed case is the whole reason the
 * database column is pinned to lowercase: a coach who types "AndreasP" means
 * `andreasp` and should not be told off for it. Spaces and dots become
 * underscores because that is what people reach for when a space is refused.
 */
export function normaliseHandle(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s.]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_{2,}/g, '_')
    .slice(0, HANDLE_MAX)
}

/**
 * `null` when the handle is fine, otherwise the sentence to put under the input.
 *
 * An empty handle is VALID — it is the ordinary state, and a coach who never
 * wants a public page never needs one. Only `visibility: 'public'` makes it
 * required, and that check lives in `profileFaults` below where both fields are
 * in scope.
 */
export function handleFault(handle: string): string | null {
  if (!handle) return null
  if (handle.length < 3) return 'A handle needs at least three characters.'
  if (handle.length > HANDLE_MAX) return `A handle can be at most ${HANDLE_MAX} characters.`
  if (!HANDLE_SHAPE.test(handle)) {
    return 'Letters and numbers, with single underscores in the middle. Nothing else.'
  }
  if (handle.includes('__')) return 'Two underscores in a row is one too many.'
  if (RESERVED.has(handle)) return 'That one is reserved. Try another.'
  return null
}

/** A hex colour, as the board and the CHECK both require. */
export function colourFault(hex: string): string | null {
  if (!hex) return null
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? null : 'A colour has to be a six-digit hex, like #08C16A.'
}

/**
 * The handle in a URL, if there is one. `/c/andreas_p`.
 *
 * The public profile is served at that path by a Netlify rewrite
 * (netlify.toml), so the page has to read its own address to know who it is
 * showing. This is the same shape `idFromPath` in ../share.ts has, for the same
 * reason and against the same rule.
 *
 * The `?h=` spelling is a DEV AFFORDANCE, and it is precedented: the rewrite is
 * applied by `netlify dev` on :8888 but not by plain `astro dev` on :4321, so
 * without a query fallback the page cannot be opened at all in the ordinary dev
 * loop. `templateIdFromUrl` keeps its `?t=` form for a comparable reason.
 * Nothing links to it and it is not the address anybody shares.
 */
export function handleFromPath(pathname: string, search = ''): string | null {
  const m = pathname.replace(/\/+$/, '').match(/^\/c\/([^/]+)$/)
  const handle = m ? m[1] : new URLSearchParams(search).get('h')
  if (!handle) return null
  const clean = handle.toLowerCase()
  return handleFault(clean) === null && clean ? clean : null
}

export interface ProfileLink {
  label: string
  url: string
}

/**
 * Only http and https, and the URL has to parse.
 *
 * This is the one field on a profile that a stranger's browser will follow, so
 * `javascript:` and `data:` are refused here rather than sanitised later. A link
 * that cannot be trusted is not shown; it is not stored in the first place.
 */
export function linkFault(link: ProfileLink): string | null {
  const url = link.url.trim()
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'That does not look like a full address. Start it with https://'
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return 'Only web addresses, starting https://'
  }
  if (!link.label.trim()) return 'Give the link a name so people know where it goes.'
  return null
}

/**
 * Everything wrong with a profile, as `{field: sentence}`.
 *
 * COLLECTS RATHER THAN THROWING ON THE FIRST FAULT, so one press of Save shows
 * the coach every field they have to fix instead of making them find them one at
 * a time.
 */
export interface ProfileDraft {
  handle: string
  bio: string
  licence: string
  visibility: Visibility
  teamColour: string
  kitRing: string
  kitPattern: string
  kitAlt: string
  links: ProfileLink[]
}

export function profileFaults(draft: ProfileDraft): Record<string, string> {
  const faults: Record<string, string> = {}

  const handle = handleFault(draft.handle)
  if (handle) faults.handle = handle

  // The only rule that involves two fields at once, and the reason this function
  // exists rather than a bag of independent validators: a public profile is
  // reached BY its handle, so there is no such thing as a public profile without
  // one. The policy in supabase/012 agrees, and would simply serve nothing.
  //
  // 'unlisted' IS HELD TO THE SAME RULE AS 'public', which is easy to miss when
  // reading it as "the private-ish one". Link only still means there is a link,
  // and /c/<handle> is the link. Without a handle there is no address to send,
  // and `studio_profile_by_handle` in supabase/024 has nothing to match on.
  if (draft.visibility !== 'private' && !draft.handle) {
    faults.handle =
      draft.visibility === 'public'
        ? 'Choose a handle before making your profile public. It is the address people visit.'
        : 'Choose a handle first. It is the link you would be sending.'
  }

  if (draft.bio.length > BIO_MAX) faults.bio = `Keep it under ${BIO_MAX} characters.`

  const licence = licenceFault(draft.licence)
  if (licence) faults.licence = licence

  const team = colourFault(draft.teamColour)
  if (team) faults.teamColour = team
  const ring = colourFault(draft.kitRing)
  if (ring) faults.kitRing = ring

  const pattern = patternFault(draft.kitPattern)
  if (pattern) faults.kitPattern = pattern
  const alt = colourFault(draft.kitAlt)
  if (alt) faults.kitAlt = alt

  // A PATTERN WITH NO SECOND COLOUR IS NOT A FAULT, and an earlier version of
  // this function was wrong to make it one. It refused the whole save — the
  // bio, the handle, everything — over a half-picked shirt that `Token.tsx`
  // already degrades gracefully to a plain one. Nothing on a board is wrong in
  // that state, so there is nothing to refuse.
  //
  // The state is now prevented rather than punished: `KitEditor` fills in a
  // second colour when a pattern is chosen without one. See its `pick`.

  if (draft.links.length > LINKS_MAX) faults.links = `Up to ${LINKS_MAX} links.`
  draft.links.forEach((link, i) => {
    const fault = linkFault(link)
    if (fault) faults[`link${i}`] = fault
  })

  return faults
}
