import type { APIRoute } from 'astro'
import { POSTS } from '../data/posts'
import { SYSTEMS, THEMES, systemsByTheme } from '../data/systems'
import { abs } from '../lib/site'

export const prerender = true

type Entry = {
  loc: string
  lastmod: string
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly'
  priority: string
}

/**
 * The newest date any real content carries. Used for the hubs — `/`, `/library/`,
 * `/blog/` and the theme pages — because those genuinely do change on the day a
 * system or a post lands, and they change on no other day.
 *
 * This replaced `new Date()`. Stamping today on every URL at every build is the
 * same lie the note on `postPages` below already refused to tell: it says ten
 * pages changed this morning, every morning, and a sitemap that cries wolf about
 * freshness is a sitemap a crawler learns to stop believing.
 */
const CONTENT_LASTMOD = [...SYSTEMS.map((s) => s.updated), ...POSTS.map((p) => p.updated)].sort().pop()!

/**
 * Pages whose content is authored in the template rather than in a data file, so
 * nothing can derive their date. BUMP THE ONE YOU EDIT — a wrong date here is
 * cheap, but a date that says "today" forever is worse than no date at all.
 */
const PAGE_LASTMOD = {
  home: '2026-08-22',
  studio: '2026-08-22',
  intelligence: '2026-08-16',
  course: '2026-08-16',
  faq: '2026-08-16',
  about: '2026-08-22',
  privacy: '2026-08-16',
  terms: '2026-08-16',
} as const

/**
 * A sitemap must never advertise a URL that is noindex, redirected or missing.
 * That was one of the fixes on the naurra.ai audit. Everything here is
 * generated from the same data that generates the pages, so the two cannot
 * drift apart.
 */
const staticPages: Entry[] = [
  { loc: abs('/'), lastmod: PAGE_LASTMOD.home, changefreq: 'weekly', priority: '1.0' },
  { loc: abs('/library/'), lastmod: CONTENT_LASTMOD, changefreq: 'weekly', priority: '0.9' },
  { loc: abs('/blog/'), lastmod: CONTENT_LASTMOD, changefreq: 'weekly', priority: '0.8' },
  // The Studio's landing page, and the ONLY /studio/ URL that belongs here. The
  // editor, portal, settings, sign-in and viewer are all noindex — the rule at
  // the top of this file is that a sitemap never advertises a noindex URL.
  { loc: abs('/studio/'), lastmod: PAGE_LASTMOD.studio, changefreq: 'monthly', priority: '0.9' },
  { loc: abs('/intelligence/'), lastmod: PAGE_LASTMOD.intelligence, changefreq: 'weekly', priority: '0.8' },
  { loc: abs('/course/'), lastmod: PAGE_LASTMOD.course, changefreq: 'monthly', priority: '0.7' },
  { loc: abs('/faq/'), lastmod: PAGE_LASTMOD.faq, changefreq: 'monthly', priority: '0.7' },
  { loc: abs('/about/'), lastmod: PAGE_LASTMOD.about, changefreq: 'monthly', priority: '0.6' },
  { loc: abs('/privacy/'), lastmod: PAGE_LASTMOD.privacy, changefreq: 'yearly', priority: '0.2' },
  { loc: abs('/terms/'), lastmod: PAGE_LASTMOD.terms, changefreq: 'yearly', priority: '0.2' },
]

const themePages: Entry[] = THEMES.filter((t) => systemsByTheme(t.slug).length > 0).map((t) => ({
  loc: abs(`/library/theme/${t.slug}/`),
  lastmod: CONTENT_LASTMOD,
  changefreq: 'weekly',
  priority: '0.8',
}))

const systemPages: Entry[] = SYSTEMS.map((s) => ({
  loc: abs(`/library/${s.slug}/`),
  lastmod: s.updated,
  changefreq: 'monthly',
  priority: '0.9',
}))

/**
 * Posts carry their own `updated`, same as systems. A blog that reports today
 * as every post's lastmod is telling a crawler that five articles changed this
 * morning, which is false and is the kind of thing that gets a sitemap ignored.
 */
const postPages: Entry[] = POSTS.map((post) => ({
  loc: abs(`/blog/${post.slug}/`),
  lastmod: post.updated,
  changefreq: 'monthly',
  priority: '0.7',
}))

export const GET: APIRoute = () => {
  const entries = [...staticPages, ...themePages, ...systemPages, ...postPages]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
