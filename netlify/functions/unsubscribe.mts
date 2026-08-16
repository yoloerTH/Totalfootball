/**
 * One-click unsubscribe. The only writer of `subscribers.unsubscribed_at`.
 *
 * Reached two ways, both of which must work without a login:
 *   · a visitor clicking the link at the foot of an email
 *   · Gmail/Yahoo's own List-Unsubscribe-Post machinery (RFC 8058), which
 *     fires a POST with no page load and never renders whatever HTML comes
 *     back — see the POST branch below
 *
 * No session, no password, so the token in the link IS the authorization.
 * It is not looked up: it is recomputed from the email with
 * HMAC-SHA256(UNSUBSCRIBE_SECRET), and a request is honoured only if its
 * token matches (scripts/lib/email.mjs is where a token gets minted; this
 * file only ever verifies). Forging one requires the secret, which lives
 * only in Netlify's env and in the local .env — never in a browser bundle.
 *
 * Writes with the SERVICE ROLE key, because anon has no UPDATE grant on
 * subscribers (supabase/001) and that grant is deliberately not being
 * loosened for this. The token check upstream of the write is what is
 * standing in for a policy here — a valid token is the only thing that
 * reaches the PATCH below.
 *
 * Env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   UNSUBSCRIBE_SECRET
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

function verify(email: string, token: string): boolean {
  const secret = process.env.UNSUBSCRIBE_SECRET
  if (!secret) return false
  const expected = createHmac('sha256', secret)
    .update(email.trim().toLowerCase())
    .digest('hex')
    .slice(0, 32)
  const a = Buffer.from(expected)
  const b = Buffer.from(token || '')
  return a.length === b.length && timingSafeEqual(a, b)
}

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
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )

async function unsubscribe(email: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('unsubscribe: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set')
    return false
  }

  const res = await fetch(
    `${url}/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      // Idempotent: already-unsubscribed rows are simply overwritten with the
      // same intent, so clicking an old link twice is not an error.
      body: JSON.stringify({ unsubscribed_at: new Date().toISOString() }),
    },
  )

  if (!res.ok) {
    console.error('unsubscribe: supabase responded', res.status, await res.text())
    return false
  }
  return true
}

export default async (request: Request) => {
  const reqUrl = new URL(request.url)
  const email = (reqUrl.searchParams.get('e') || '').trim().toLowerCase()
  const token = reqUrl.searchParams.get('t') || ''

  if (!email || !verify(email, token)) {
    return page(
      400,
      'Link not valid',
      'That unsubscribe link is not valid or has expired. Email athanasios@naurra.ai and it will be handled by hand.',
    )
  }

  const ok = await unsubscribe(email)

  // One-click unsubscribe (RFC 8058): the mail client POSTs with no user
  // watching and discards whatever comes back, so this branch answers with a
  // bare status and skips building a page nobody will see.
  if (request.method === 'POST') {
    return new Response(null, { status: ok ? 200 : 502 })
  }

  if (!ok) {
    return page(
      502,
      'Something went wrong',
      'That did not go through. Please try again, or email athanasios@naurra.ai.',
    )
  }

  return page(
    200,
    'You are unsubscribed',
    `${email} will not receive any further emails from Total Football.`,
  )
}

export const config = { path: '/api/unsubscribe' }
