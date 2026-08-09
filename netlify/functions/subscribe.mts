/**
 * Email capture endpoint. Backs the newsletter forms and the course waitlist.
 *
 * Runs server-side for one reason: the browser must never hold a Supabase key
 * that can do more than insert. Even the anon key is kept out of the bundle
 * here. The table is insert-only under RLS and this function is the only writer.
 *
 * IT DOES NOT RUN UNDER `astro dev`. Netlify Functions only exist under
 * `netlify dev` or on a deploy, so a POST to /api/subscribe on localhost:4321
 * returns 404. That is expected, not a bug.
 *
 * Env (set in the Netlify UI, never committed):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY      insert-only via RLS
 *   ALLOWED_ORIGIN         the site origin, for the cross-origin check
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/**
 * The no-JS path. A plain <form> POST cannot read a JSON reply, so without this
 * a visitor with scripts disabled would be dropped on a page of raw JSON. They
 * get a real page instead.
 */
const page = (status: number, heading: string, message: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${heading} · Total Football</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F4F4F2;color:#161618;
       font:400 16px/1.6 Inter,system-ui,-apple-system,sans-serif;padding:24px}
  .c{max-width:34rem;text-align:center}
  h1{font-size:clamp(1.8rem,5vw,2.6rem);font-weight:900;letter-spacing:-.02em;margin:0 0 .6rem}
  p{color:rgba(22,22,24,.62);margin:0 0 2rem}
  a{display:inline-block;background:#161618;color:#F4F4F2;text-decoration:none;
    padding:.8rem 1.6rem;border-radius:999px;font-weight:600;font-size:.9rem}
</style></head><body><div class="c">
<h1>${heading}</h1><p>${message}</p><a href="/">Back to Total Football</a>
</div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )

export default async (request: Request) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })

  // Reject cross-origin posts outright. The forms are same-origin by design.
  const allowed = process.env.ALLOWED_ORIGIN
  const origin = request.headers.get('origin')
  if (allowed && origin && origin !== allowed) {
    return json(403, { error: 'Forbidden' })
  }

  // Scripted submits send JSON; a no-JS <form> sends url-encoded. Accept both,
  // and answer each in the format it can actually understand.
  const contentType = request.headers.get('content-type') ?? ''
  const isForm = contentType.includes('application/x-www-form-urlencoded')

  let email = ''
  let source = 'unknown'
  let honeypot = ''

  try {
    if (isForm) {
      const form = new URLSearchParams(await request.text())
      email = form.get('email') ?? ''
      source = form.get('source') ?? 'unknown'
      honeypot = form.get('company') ?? ''
    } else {
      const body = (await request.json()) as Record<string, string>
      email = body.email ?? ''
      source = body.source ?? 'unknown'
      honeypot = body.company ?? ''
    }
  } catch {
    return isForm
      ? page(400, 'Something went wrong', 'That form did not submit correctly. Please try again.')
      : json(400, { error: 'Invalid body' })
  }

  // Honeypot filled means a bot. Answer as success so it learns nothing.
  if (honeypot) {
    return isForm ? page(200, 'Thanks', 'You are on the list.') : json(200, { ok: true })
  }

  email = email.trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 254) {
    return isForm
      ? page(400, 'Check that address', 'That email address does not look right. Please try again.')
      : json(400, { error: 'Enter a valid email address.' })
  }

  source = source.slice(0, 64)

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('subscribe: SUPABASE_URL / SUPABASE_ANON_KEY are not set')
    return isForm
      ? page(500, 'Not available yet', 'Sign-ups are not switched on. Please try again later.')
      : json(500, { error: 'Not configured' })
  }

  const res = await fetch(`${url}/rest/v1/subscribers`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([{ email, source }]),
  })

  /**
   * A duplicate address is a success from the visitor's point of view: they are
   * on the list, and the reply must not reveal which case it was.
   *
   * This is a plain insert rather than an upsert on purpose. PostgREST's
   * `on_conflict` + `resolution=ignore-duplicates` path requires SELECT on the
   * table, and anon is deliberately granted INSERT only (see
   * supabase/001_subscribers.sql). Letting the unique constraint raise 409 and
   * catching it here keeps the role at least privilege, with no way to read the
   * subscriber list even if a policy were later misconfigured.
   */
  if (res.status === 409) {
    return isForm
      ? page(200, 'You are on the list', 'Thanks. The next breakdown will land in your inbox.')
      : json(200, { ok: true })
  }

  if (!res.ok) {
    console.error('subscribe: supabase responded', res.status, await res.text())
    return isForm
      ? page(502, 'Could not save that', 'Something went wrong on our side. Please try again.')
      : json(502, { error: 'Could not save that right now.' })
  }

  return isForm
    ? page(200, 'You are on the list', 'Thanks. The next breakdown will land in your inbox.')
    : json(200, { ok: true })
}

export const config = { path: '/api/subscribe' }
