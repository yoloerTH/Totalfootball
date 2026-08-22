import type { APIRoute } from 'astro'
import { POSTS } from '../data/posts'
import { SYSTEMS } from '../data/systems'
import { abs, SITE, SITE_URL } from '../lib/site'

export const prerender = true

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * One feed, two kinds of item. A separate /blog/rss.xml would mean a reader who
 * subscribed at launch silently misses half of what we publish, and the
 * `<link rel="alternate">` in BaseLayout can only point at one of them anyway.
 * Items are normalised to the same shape here so the template below does not
 * have to know which is which.
 */
type Item = { title: string; url: string; summary: string; published: string }

export const GET: APIRoute = () => {
  const items: Item[] = [
    ...SYSTEMS.map((s) => ({
      title: s.title,
      url: abs(`/library/${s.slug}/`),
      summary: s.answer,
      published: s.published,
    })),
    ...POSTS.map((p) => ({
      title: p.title,
      url: abs(`/blog/${p.slug}/`),
      summary: p.dek,
      published: p.published,
    })),
  ].sort((a, b) => b.published.localeCompare(a.published))

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(SITE.name)}: new systems and writing</title>
    <link>${SITE_URL}</link>
    <description>${escape(SITE.description)}</description>
    <language>en</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items
  .map(
    (item) => `    <item>
      <title>${escape(item.title)}</title>
      <link>${item.url}</link>
      <guid isPermaLink="true">${item.url}</guid>
      <description>${escape(item.summary)}</description>
      <pubDate>${new Date(item.published).toUTCString()}</pubDate>
    </item>`
  )
  .join('\n')}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
