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

const TODAY = new Date().toISOString().slice(0, 10)

/**
 * A sitemap must never advertise a URL that is noindex, redirected or missing.
 * That was one of the fixes on the naurra.ai audit. Everything here is
 * generated from the same data that generates the pages, so the two cannot
 * drift apart.
 */
const staticPages: Entry[] = [
  { loc: abs('/'), lastmod: TODAY, changefreq: 'weekly', priority: '1.0' },
  { loc: abs('/library/'), lastmod: TODAY, changefreq: 'weekly', priority: '0.9' },
  { loc: abs('/blog/'), lastmod: TODAY, changefreq: 'weekly', priority: '0.8' },
  // The Studio's landing page, and the ONLY /studio/ URL that belongs here. The
  // editor, portal, settings, sign-in and viewer are all noindex — the rule at
  // the top of this file is that a sitemap never advertises a noindex URL.
  { loc: abs('/studio/'), lastmod: TODAY, changefreq: 'monthly', priority: '0.9' },
  { loc: abs('/intelligence/'), lastmod: TODAY, changefreq: 'weekly', priority: '0.8' },
  { loc: abs('/course/'), lastmod: TODAY, changefreq: 'monthly', priority: '0.7' },
  { loc: abs('/faq/'), lastmod: TODAY, changefreq: 'monthly', priority: '0.7' },
  { loc: abs('/about/'), lastmod: TODAY, changefreq: 'monthly', priority: '0.6' },
  { loc: abs('/privacy/'), lastmod: TODAY, changefreq: 'yearly', priority: '0.2' },
  { loc: abs('/terms/'), lastmod: TODAY, changefreq: 'yearly', priority: '0.2' },
]

const themePages: Entry[] = THEMES.filter((t) => systemsByTheme(t.slug).length > 0).map((t) => ({
  loc: abs(`/library/theme/${t.slug}/`),
  lastmod: TODAY,
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
