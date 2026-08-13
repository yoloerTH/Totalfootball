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

/**
 * Keep the referring host, drop the path and any query string it carried.
 *
 * Self-referrals are dropped, because "came from" is a question about the rest
 * of the internet and a visit that came from this site came from nowhere.
 *
 * COMPARED BY HOSTNAME, AND AGAINST MORE THAN ONE. The first version compared
 * `u.origin` against ALLOWED_ORIGIN alone, and the traffic log still collected
 * a slow trickle of visits "referred by" totalfootball.naurra.ai — every one of
 * them mobile, every one of them on `/`, which is what an in-app browser
 * bouncing through its own redirect looks like. Any of a mismatched scheme, a
 * port, a preview deploy where the env var does not apply, or an origin string
 * this code never saw would do it. Hostnames, checked against both the
 * configured origin and the host the request actually arrived on, cannot.
 */
function referrerHost(raw: unknown, ours: (string | undefined)[]): string | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const host = new URL(raw).hostname
    for (const o of ours) {
      if (!o) continue
      try {
        if (new URL(o).hostname === host) return null // internal navigation
      } catch {
        if (o === host) return null // already a bare hostname
      }
    }
    return host.slice(0, 128)
  } catch {
    return null
  }
}

const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

/**
 * Collapse a shared system's link to one path.
 *
 * `/s/k7f3q9` is a route, not a page: every coach who publishes gets their own
 * id, so left alone the traffic log fills with hundreds of paths that were each
 * read twice, and "most read" — the line of the daily report that is supposed
 * to say what people are reading — degrades into a list of strangers' share
 * ids. They are collapsed to `/s/:id` so the row means "shared systems were
 * opened this many times", which is the number worth having.
 *
 * The id is not thrown away, it moves to `label` (where a pageview has nothing
 * else to say), so "which share is being passed around" stays answerable
 * without a table scan and without the path column carrying it.
 *
 * Must stay in step with the id shape in supabase/004_studio_shares.sql and
 * src/studio/share.ts.
 */
const SHARE_PATH = /^\/s\/([0-9a-hjkmnp-tv-z]{6,16})\/?$/

function normalisePath(path: string): { path: string; shareId: string | null } {
  const m = SHARE_PATH.exec(path)
  return m ? { path: '/s/:id', shareId: m[1] } : { path, shareId: null }
}

export default async (request: Request) => {
  // Beacons are fire-and-forget: answer 204 for anything malformed rather than
  // surfacing errors a visitor can neither see nor act on.
  if (request.method !== 'POST') return noContent()

  /**
   * The origin this request actually arrived on. Used as a fallback for the
   * cross-origin check and, below, to recognise an internal referrer — so both
   * keep working on a preview deploy, on the .netlify.app alias, and on the day
   * somebody forgets to set ALLOWED_ORIGIN in a new context.
   */
  const selfOrigin = new URL(request.url).origin
  const allowed = process.env.ALLOWED_ORIGIN
  const origin = request.headers.get('origin')
  if (origin && origin !== (allowed ?? selfOrigin)) return noContent()

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

  const seen = normalisePath(path)

  const row = {
    session_id: sessionId,
    type,
    path: seen.path,
    referrer: referrerHost(body.referrer, [allowed, selfOrigin]),
    // A share's id only ever labels the pageview of the share itself; it must
    // not overwrite a click's own label.
    label: str(body.label, 128) ?? (seen.shareId ? `share:${seen.shareId}` : null),
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
