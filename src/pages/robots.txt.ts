import type { APIRoute } from 'astro'
import { SITE_URL } from '../lib/site'

export const prerender = true

/**
 * Generated rather than static so the sitemap line always matches the origin
 * the site was actually built for (PUBLIC_SITE_URL). A robots.txt pointing at
 * the wrong host is a silent, total failure.
 */
export const GET: APIRoute = () => {
  const body = `# Total Football
User-agent: *
Allow: /

# The subscribe endpoint is not content.
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
