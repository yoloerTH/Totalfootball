/**
 * Publishing a studio system, and reading one back.
 *
 * POST /api/share        { id?, doc }  → { id, url }   publish or refresh
 * GET  /api/share/:id                  → { doc }       what the viewer loads
 *
 * WHY THIS EXISTS. A shared system used to travel inside its own URL fragment,
 * compressed — no server, nothing to store, nothing to rot. It also produced a
 * two-thousand-character link, which is not a link, it is a paragraph. Nobody
 * can send that. So the document lives in Postgres and the link is
 * `/s/k7f3q9`.
 *
 * IT USES THE SERVICE-ROLE KEY, which is a stronger key than subscribe.mts
 * needs and deserves saying why: `studio_shares` has RLS on and no policies at
 * all (supabase/004_studio_shares.sql), so no anon-reachable role can touch it.
 * This function is the entire surface. The browser continues to hold no
 * Supabase key of any kind, which is the posture in .env.example, and the
 * validation below is therefore load-bearing rather than decorative — it is the
 * only thing between a POST and the table.
 *
 * A SHARE IS UPDATED IN PLACE. The editor remembers the id it was given
 * (`System.shareId`) and sends it back, so sharing the same system twice
 * refreshes the link the coach has already sent rather than making a second
 * one. If the id turns out not to exist any more — unpublished, or a document
 * carried over from another machine — this quietly publishes a new one and
 * returns the new id rather than failing in the coach's face.
 *
 * IT DOES NOT RUN UNDER `astro dev`. Netlify Functions only exist under
 * `netlify dev` or on a deploy. A POST to /api/share on localhost:4321 is a
 * 404, and that is expected.
 *
 * Env (set in the Netlify UI, never committed):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   the only key that can see this table
 *   ALLOWED_ORIGIN              the site origin, for the cross-origin check
 */

/**
 * Crockford base32, lowercased, with i/l/o/u removed so nothing is ambiguous
 * read down a phone or copied off a whiteboard. Must match the CHECK
 * constraint in supabase/004_studio_shares.sql.
 */
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'
const ID_LENGTH = 7
const ID_SHAPE = /^[0-9a-hjkmnp-tv-z]{6,16}$/

/**
 * The document cap. A big system with two full teams over ten phases is around
 * 40KB of JSON; this is roomy enough that no real system hits it and tight
 * enough that the table cannot be used as free file storage.
 */
const MAX_DOC_BYTES = 400_000

/** 32^7 ≈ 34 billion. Collisions are handled anyway; see `publish`. */
function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

const json = (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

function env() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return {
    url,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  }
}

/**
 * Is this a System we are willing to store?
 *
 * Deliberately shallow. The shape is owned by src/studio/schema.ts and will
 * keep moving; re-implementing it here would mean a schema change silently
 * starting to reject valid systems. What this actually defends is the table:
 * that the body is one JSON object, that it is a studio document rather than
 * something else entirely, and that it is not enormous.
 */
function invalidReason(doc: unknown, bytes: number): string | null {
  if (bytes > MAX_DOC_BYTES) return 'That system is too big to publish.'
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return 'Invalid system.'
  const acts = (doc as { acts?: unknown }).acts
  if (!Array.isArray(acts) || acts.length === 0) return 'That system has no phases in it.'
  if (acts.length > 200) return 'That system has too many phases.'
  return null
}

export default async (request: Request) => {
  const supabase = env()
  if (!supabase) {
    console.error('share: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set')
    return json(500, { error: 'Sharing is not switched on.' })
  }

  const url = new URL(request.url)
  // Parsed off the path rather than taken from the router, so the two declared
  // routes cannot disagree about which one matched.
  const id = url.pathname.replace(/\/+$/, '').split('/').pop() ?? ''

  // ── read ──────────────────────────────────────────────────────────────────
  if (request.method === 'GET') {
    if (!ID_SHAPE.test(id)) return json(404, { error: 'Not found' })

    const res = await fetch(
      `${supabase.url}/rest/v1/studio_shares?id=eq.${encodeURIComponent(id)}&select=doc,updated_at`,
      { headers: supabase.headers },
    )
    if (!res.ok) {
      console.error('share: read failed', res.status, await res.text())
      return json(502, { error: 'Could not open that link right now.' })
    }
    const rows = (await res.json()) as { doc: unknown; updated_at: string }[]
    if (!rows.length) return json(404, { error: 'Not found' })

    return json(
      200,
      { doc: rows[0].doc, updatedAt: rows[0].updated_at },
      /*
       * NOT CACHED, AND THIS WAS A REAL BUG. The first version sent
       * `max-age=30, stale-while-revalidate=120`, reasoning that a share is
       * read far more often than it is written. Netlify's edge then served a
       * 49-second-old copy of a system that had just been republished — and
       * "change a phase, press Share, show it to someone" is the exact minute
       * a coach is most likely to be standing in front of the person they sent
       * it to. A share is mutable by design (it updates in place), so the read
       * has to be honest. It is one primary-key lookup.
       */
      { 'Cache-Control': 'no-store' },
    )
  }

  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })

  // Same-origin only, as with subscribe.mts. The studio is the only caller.
  const allowed = process.env.ALLOWED_ORIGIN
  const origin = request.headers.get('origin')
  if (allowed && origin && origin !== allowed) return json(403, { error: 'Forbidden' })

  // ── publish ───────────────────────────────────────────────────────────────
  let body: { id?: unknown; doc?: unknown }
  let bytes = 0
  try {
    const text = await request.text()
    bytes = text.length
    body = JSON.parse(text)
  } catch {
    return json(400, { error: 'Invalid body' })
  }

  const reason = invalidReason(body.doc, bytes)
  if (reason) return json(400, { error: reason })

  const doc = body.doc
  const existing = typeof body.id === 'string' && ID_SHAPE.test(body.id) ? body.id : null

  // Refresh the link the coach has already sent, if it is still there.
  if (existing) {
    const res = await fetch(
      `${supabase.url}/rest/v1/studio_shares?id=eq.${encodeURIComponent(existing)}`,
      {
        method: 'PATCH',
        headers: { ...supabase.headers, Prefer: 'return=representation' },
        body: JSON.stringify({ doc, updated_at: new Date().toISOString() }),
      },
    )
    if (res.ok) {
      const rows = (await res.json()) as unknown[]
      // An empty array means the id is gone. Fall through and make a new one
      // rather than telling a coach their own link no longer works.
      if (rows.length) return json(200, { id: existing, url: `/s/${existing}` })
    } else {
      console.error('share: update failed', res.status, await res.text())
    }
  }

  // Five attempts at an unused id. At 34 billion possibilities the second
  // attempt is already fantasy, but a PK collision must not surface as a 502.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = newId()
    const res = await fetch(`${supabase.url}/rest/v1/studio_shares`, {
      method: 'POST',
      headers: { ...supabase.headers, Prefer: 'return=minimal' },
      body: JSON.stringify([{ id: candidate, doc }]),
    })
    if (res.ok) return json(200, { id: candidate, url: `/s/${candidate}` })
    if (res.status === 409) continue
    console.error('share: insert failed', res.status, await res.text())
    return json(502, { error: 'Could not publish that right now.' })
  }

  console.error('share: could not find a free id in five attempts')
  return json(502, { error: 'Could not publish that right now.' })
}

export const config = { path: ['/api/share', '/api/share/:id'] }
