import type { APIRoute } from 'astro'
import { SYSTEMS } from '../data/systems'
import { abs, SITE, SITE_URL } from '../lib/site'

export const prerender = true

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const GET: APIRoute = () => {
  const items = [...SYSTEMS].sort((a, b) => b.published.localeCompare(a.published))

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(SITE.name)}: new systems</title>
    <link>${SITE_URL}</link>
    <description>${escape(SITE.description)}</description>
    <language>en</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items
  .map(
    (s) => `    <item>
      <title>${escape(s.title)}</title>
      <link>${abs(`/library/${s.slug}/`)}</link>
      <guid isPermaLink="true">${abs(`/library/${s.slug}/`)}</guid>
      <description>${escape(s.answer)}</description>
      <pubDate>${new Date(s.published).toUTCString()}</pubDate>
    </item>`
  )
  .join('\n')}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
