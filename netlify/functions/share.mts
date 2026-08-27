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
 * Supabase key of any kind beyond the anon key the studio already holds, and
 * the validation below is therefore load-bearing rather than decorative — it is
 * the only thing between a POST and the table.
 *
 * A SHARE IS UPDATED IN PLACE. The editor remembers the id it was given
 * (`System.shareId`) and sends it back, so sharing the same system twice
 * refreshes the link the coach has already sent rather than making a second
 * one. If the id turns out not to exist any more — unpublished, or a document
 * carried over from another machine — this quietly publishes a new one and
 * returns the new id rather than failing in the coach's face.
 *
 * ── PUBLISHING NEEDS A SESSION. READING NEVER DOES. ──────────────────────────
 *
 * IT DID NOT, AND THAT WAS A HOLE. Reproduced against production on
 * 2026-08-27: publish a board, then POST here again carrying its id, with no
 * session, no cookie and no Origin header — and the PATCH below replaced
 * somebody else's published board. The only thing guarding an update was
 * knowing the id, and the id is printed in the public URL of the very thing it
 * was guarding. The origin check is not a substitute: it is skipped entirely
 * when a caller sends no Origin header, which any script does by default.
 *
 * So a POST now carries the coach's Supabase access token, this function asks
 * Supabase who that is, and an update is scoped to `owner = <them>`. GET is
 * untouched and stays open to everybody, because a share link that needed an
 * account would not be a share link.
 *
 * ── AND WHAT HAPPENS TO THE ROWS PUBLISHED BEFORE ALL THIS ───────────────────
 *
 * They have `owner is null` and there is no way to work out who wrote them —
 * the table never recorded it. They are treated as unclaimed but NOT up for
 * grabs. A coach may adopt one only by proving the claim: their own account
 * must hold a system in `studio_systems` carrying that share id. Anybody else
 * asking gets a brand new id, so the worst case for a stranger is that they
 * publish their own board to their own link, and the worst case for the real
 * owner is one link that stops updating.
 *
 * IT DOES NOT RUN UNDER `astro dev`. Netlify Functions only exist under
 * `netlify dev` or on a deploy. A POST to /api/share on localhost:4321 is a
 * 404, and that is expected.
 *
 * Env (set in the Netlify UI, never committed):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   the only key that can see this table
 *   ALLOWED_ORIGIN              the site origin, for the cross-origin check
 *
 * The `apikey` sent to /auth/v1/user is the service-role key, which is fine for
 * that endpoint: it identifies the project, and the BEARER token is what is
 * being verified.
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

  /**
   * Who is asking, from the access token the studio sends.
   *
   * Straight to Supabase rather than decoding the JWT here: verifying a
   * signature needs the project's JWT secret, which this function does not have
   * and should not be given. `/auth/v1/user` does the verification, and an
   * expired or forged token comes back 401 — which is the answer we want.
   *
   * Null means "no usable session", never "assume it is fine".
   */
  const whoIsAsking = async (): Promise<string | null> => {
    const header = request.headers.get('authorization') ?? ''
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
    // The anon key is a valid-looking JWT and is NOT a session. Sending it here
    // would get a 401 anyway, but rejecting an empty token early saves the trip.
    if (!token) return null
    try {
      const res = await fetch(`${supabase.url}/auth/v1/user`, {
        headers: { apikey: supabase.headers.apikey, Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return null
      const user = (await res.json()) as { id?: unknown }
      return typeof user.id === 'string' ? user.id : null
    } catch {
      // A network fault talking to our own auth server. Refusing the write is
      // the only safe reading of "we could not establish who this is".
      return null
    }
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

  const owner = await whoIsAsking()
  if (!owner) return json(401, { error: 'Sign in to publish a board.' })

  const doc = body.doc
  const existing = typeof body.id === 'string' && ID_SHAPE.test(body.id) ? body.id : null

  /**
   * Does this coach's account hold a system carrying that share id?
   *
   * The proof of ownership for a row published before there was an owner
   * column. `studio_systems` IS owner-scoped and always has been, so a document
   * in this coach's account naming this share id is the strongest evidence
   * available that they are the one who published it — and it is evidence a
   * stranger cannot manufacture, because they cannot write a row into somebody
   * else's account (supabase/005).
   */
  const holdsSystemFor = async (shareId: string): Promise<boolean> => {
    const res = await fetch(
      `${supabase.url}/rest/v1/studio_systems` +
        `?owner=eq.${encodeURIComponent(owner)}` +
        `&doc->>shareId=eq.${encodeURIComponent(shareId)}` +
        `&select=id&limit=1`,
      { headers: supabase.headers },
    )
    if (!res.ok) return false
    return ((await res.json()) as unknown[]).length > 0
  }

  // Refresh the link the coach has already sent, if it is still there AND it is
  // theirs. Every path that is not "theirs" falls through to a NEW id rather
  // than failing: a coach who cannot update a link is mildly inconvenienced, and
  // a coach whose board can be rewritten by a stranger is the actual bug.
  if (existing) {
    const patch = async (query: string, extra: Record<string, unknown> = {}) => {
      const res = await fetch(`${supabase.url}/rest/v1/studio_shares?${query}`, {
        method: 'PATCH',
        headers: { ...supabase.headers, Prefer: 'return=representation' },
        body: JSON.stringify({ doc, updated_at: new Date().toISOString(), ...extra }),
      })
      if (!res.ok) {
        console.error('share: update failed', res.status, await res.text())
        return false
      }
      return ((await res.json()) as unknown[]).length > 0
    }

    const key = `id=eq.${encodeURIComponent(existing)}`

    // Theirs already: the ordinary path, every time after the first.
    if (await patch(`${key}&owner=eq.${encodeURIComponent(owner)}`)) {
      return json(200, { id: existing, url: `/s/${existing}` })
    }

    // Unowned, and they can prove it is theirs. Claimed on the way past, so
    // this costs the extra lookup once per legacy link and never again.
    if (await holdsSystemFor(existing)) {
      if (await patch(`${key}&owner=is.null`, { owner })) {
        return json(200, { id: existing, url: `/s/${existing}` })
      }
    }

    // Anything else — the row is gone, or it belongs to somebody else — falls
    // through. Note what is NOT here: a branch that writes to a row owned by
    // another account. There is no such branch, and there must never be one.
  }

  // Five attempts at an unused id. At 34 billion possibilities the second
  // attempt is already fantasy, but a PK collision must not surface as a 502.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = newId()
    const res = await fetch(`${supabase.url}/rest/v1/studio_shares`, {
      method: 'POST',
      headers: { ...supabase.headers, Prefer: 'return=minimal' },
      body: JSON.stringify([{ id: candidate, doc, owner }]),
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
