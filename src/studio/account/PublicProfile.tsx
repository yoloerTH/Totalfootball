/**
 * A coach's public profile, as anyone who receives the link sees it.
 *
 * Served at `/c/<handle>` by a Netlify rewrite onto one static page, exactly the
 * way `/s/<id>` serves the shared viewer (netlify.toml). The page is identical
 * for everybody and knows nothing about who it is about to show until it reads
 * its own address — which is why it is `noindex` for now, like the viewer: there
 * is no page here to index, only a shell.
 *
 * ── WHAT THIS DELIBERATELY IS NOT, YET ───────────────────────────────────────
 *
 * Phase 2 of docs/SOCIAL.md upgrades this same route to server rendering, which
 * is what buys the OG preview card and real indexing. Nothing here needs to be
 * thrown away for that: the query, the empty state and the layout all survive,
 * and only where the data is fetched changes. It was built this way first
 * because a share button whose link does not resolve is not a share button.
 *
 * ── EVERY ANSWER IS THE SAME ANSWER ──────────────────────────────────────────
 *
 * A private profile, an unclaimed handle and a typo all render the same "no
 * profile here". See `loadPublicProfile` — distinguishing them would confirm the
 * existence of accounts that have chosen not to be seen.
 */

import { useEffect, useState } from 'react'
import { imageUrl } from './images'
import { handleFromPath, roleLabel } from './identity'
import { loadPublicProfile, type PublicProfile as Profile } from './cloud'
import { darken, readableText } from '../board/palette'
import { Token, TOKEN_R } from '../board/Token'
import { U } from '../board/pitch'
import { DEFAULT_US, type KitPattern } from '../schema'

/** Board metres → SVG units, the same conversion `Token` makes internally. */
const TOKEN_BOX = TOKEN_R * U * 2.6

type State = 'loading' | 'found' | 'missing'

export default function PublicProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    let live = true
    const handle = handleFromPath(window.location.pathname, window.location.search)
    if (!handle) {
      setState('missing')
      return
    }
    void loadPublicProfile(handle).then((p) => {
      if (!live) return
      setProfile(p)
      setState(p ? 'found' : 'missing')
    })
    return () => {
      live = false
    }
  }, [])

  if (state === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-micro uppercase text-ink-faint">Opening…</p>
      </div>
    )
  }

  if (state === 'missing' || !profile) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-5 text-center">
        <p className="text-micro uppercase text-ink-faint">Nothing here</p>
        <h1 className="mt-4 text-title font-black tracking-display text-ink">
          There is no profile at this address.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          The link may be wrong, or whoever it belongs to has made their profile private again.
        </p>
        <a
          href="/studio/"
          className="mt-7 rounded-lg bg-ink px-5 py-3 text-sm font-bold text-paper no-underline transition-opacity hover:opacity-90"
        >
          See what the studio is
        </a>
      </div>
    )
  }

  const colour = profile.teamColour || DEFAULT_US.base
  const crest = imageUrl(profile.crestPath)
  const avatar = imageUrl(profile.avatarPath)
  const role = roleLabel(profile.role)
  const name = profile.presenter || `@${profile.handle}`

  /**
   * The kit, drawn with the board's OWN counter rather than a coloured square.
   *
   * It is the fallback when a coach has uploaded neither a face nor a badge, and
   * it is the better fallback: a square of hex says nothing, whereas the counter
   * says "this is what their boards look like" in the one mark this whole site
   * is built around. Same rule KitEditor follows — there is exactly one
   * renderer, so what is shown here cannot drift from what the board draws.
   */
  const patterned = profile.kitPattern !== 'solid' && Boolean(profile.kitAlt)
  const kit = {
    name: profile.team || DEFAULT_US.name,
    base: colour,
    deep: darken(colour),
    text: readableText(colour),
    ring: profile.kitRing || undefined,
    pattern: patterned ? (profile.kitPattern as KitPattern) : undefined,
    alt: patterned ? profile.kitAlt : undefined,
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
      <header className="flex flex-wrap items-start gap-5">
        {/* The person first, the club second, the kit last. A coach who set
            none of the three still gets a mark rather than a gap. */}
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="h-20 w-20 shrink-0 rounded-full border border-ink-hair bg-surface object-cover"
          />
        ) : crest ? (
          <img
            src={crest}
            alt={profile.team ? `${profile.team} crest` : 'Club crest'}
            className="h-20 w-20 shrink-0 rounded-xl border border-ink-hair bg-surface object-contain p-1.5"
          />
        ) : (
          <svg
            viewBox={`0 0 ${TOKEN_BOX} ${TOKEN_BOX}`}
            className="h-20 w-20 shrink-0"
            role="img"
            aria-label={`${name}'s kit`}
          >
            <Token
              idp="profile-kit"
              cx={TOKEN_BOX / 2}
              cy={TOKEN_BOX / 2}
              label={profile.presenter.slice(0, 1).toUpperCase() || '6'}
              side="us"
              style={kit}
            />
          </svg>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-section font-black tracking-display text-ink">{name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[15px] text-ink-soft">
            {/* Only once the face has taken the large slot; otherwise the badge
                is already the picture above and this would be it twice. */}
            {avatar && crest && (
              <img src={crest} alt="" className="h-4 w-4 shrink-0 object-contain" />
            )}
            {[role, profile.team].filter(Boolean).join(' · ') || 'On Total Football'}
          </p>
          <p className="mt-1 font-mono text-[13px] text-ink-faint">@{profile.handle}</p>
        </div>
      </header>

      {profile.bio && (
        <p className="mt-7 max-w-prose whitespace-pre-line text-[16px] leading-relaxed text-ink">
          {profile.bio}
        </p>
      )}

      {profile.links.length > 0 && (
        <ul className="mt-7 flex flex-wrap gap-2.5 p-0">
          {profile.links.map((link, i) => (
            <li key={i} className="list-none">
              <a
                href={link.url}
                target="_blank"
                // `noopener` is the security half and `noreferrer` the privacy
                // half. These are addresses a stranger typed into a form.
                rel="noopener noreferrer nofollow"
                className="inline-block rounded-lg border border-ink-hair px-4 py-2.5 text-[13px] font-bold text-ink no-underline transition-colors hover:bg-ink-hair"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* Phase 2 puts this coach's published systems here. Saying so is better
          than an empty space that reads as a page that failed to load. */}
      <section className="mt-12 rounded-xl border border-dashed border-ink-hair p-6 text-center">
        <p className="text-micro uppercase text-ink-faint">Systems</p>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
          Published systems will appear here.
        </p>
      </section>

      <footer className="mt-12 border-t border-ink-hair pt-6">
        <p className="text-[13px] leading-relaxed text-ink-soft">
          {name} builds tactical systems on Total Football.{' '}
          <a href="/studio/" className="font-bold text-ink underline underline-offset-4">
            Build one yourself
          </a>
          .
        </p>
      </footer>
    </div>
  )
}
