/**
 * Analytics collector. Writes to public.site_events.
 *
 * The client only ever calls this after the visitor has accepted analytics in
 * the cookie notice, but this endpoint does not take that on trust: it stores
 * nothing that could identify a person even if it were called directly.
 *
 *   · the IP address is never stored, only the country Netlify derives from it
 *   · the user-agent is never stored, only a mobile/tablet/desktop bucket
 *   · session_id comes from the client's sessionStorage and dies with the tab
 *
 * Requests arrive via navigator.sendBeacon on page hide, so the reply must be
 * cheap and the handler must never depend on the response being read.
 */

const TYPES = new Set(['pageview', 'duration', 'click'])
const MAX_DURATION = 21_600_000 // 6 hours, matches the CHECK constraint

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const noContent = () => new Response(null, { status: 204 })

/** Coarse bucket only. The full user-agent string is a fingerprinting vector. */
function device(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return 'tablet'
  if (/Android(?!.*Mobile)/i.test(ua)) return 'tablet'
  if (/Mobi|iPhone|iPod|Android|IEMobile|BlackBerry|Opera Mini/i.test(ua)) return 'mobile'
  return 'desktop'
}

/** Keep the referring host, drop the path and any query string it carried. */
function referrerHost(raw: unknown, selfOrigin: string | undefined): string | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const u = new URL(raw)
    if (selfOrigin && u.origin === selfOrigin) return null // internal navigation
    return u.hostname.slice(0, 128)
  } catch {
    return null
  }
}

const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

export default async (request: Request) => {
  // Beacons are fire-and-forget: answer 204 for anything malformed rather than
  // surfacing errors a visitor can neither see nor act on.
  if (request.method !== 'POST') return noContent()

  const allowed = process.env.ALLOWED_ORIGIN
  const origin = request.headers.get('origin')
  if (allowed && origin && origin !== allowed) return noContent()

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return noContent()
  }

  const sessionId = str(body.sessionId, 64)
  const type = str(body.type, 16)
  const path = str(body.path, 512)

  if (!sessionId || !UUID.test(sessionId)) return noContent()
  if (!type || !TYPES.has(type)) return noContent()
  if (!path || !path.startsWith('/')) return noContent()

  let durationMs: number | null = null
  if (type === 'duration') {
    const raw = Number(body.durationMs)
    if (!Number.isFinite(raw) || raw < 0) return noContent()
    durationMs = Math.min(Math.round(raw), MAX_DURATION)
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('track: SUPABASE_URL / SUPABASE_ANON_KEY are not set')
    return noContent()
  }

  // Netlify resolves geo server-side, so we get a country without ever handling
  // or storing the IP ourselves.
  let country: string | null = null
  const geo = request.headers.get('x-nf-geo')
  if (geo) {
    try {
      country = str(JSON.parse(atob(geo))?.country?.code, 2)
    } catch {
      country = null
    }
  }

  const row = {
    session_id: sessionId,
    type,
    path,
    referrer: referrerHost(body.referrer, allowed),
    label: str(body.label, 128),
    duration_ms: durationMs,
    country,
    device: device(request.headers.get('user-agent') ?? ''),
  }

  const res = await fetch(`${url}/rest/v1/site_events`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([row]),
  })

  if (!res.ok) console.error('track: supabase responded', res.status, await res.text())

  return noContent()
}

export const config = { path: '/api/track' }
