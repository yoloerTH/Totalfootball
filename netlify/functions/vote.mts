import type { Config } from '@netlify/functions'

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

async function recordVote(option: string, email: string | null): Promise<boolean> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('vote: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set')
    return false
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }

  const vote = await fetch(`${url}/rest/v1/social_votes`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ vote_option: option, subscriber_email: email || null }),
  })

  if (!vote.ok) {
    console.error('vote: insert failed', vote.status, await vote.text())
    return false
  }

  return true
}

export default async (request: Request) => {
  const reqUrl = new URL(request.url)
  const option = reqUrl.searchParams.get('option') || ''
  const email = (reqUrl.searchParams.get('e') || '').trim().toLowerCase() || null

  if (!option) {
    return page(400, 'Invalid link', 'The voting link seems to be broken.')
  }

  const ok = await recordVote(option, email)

  if (!ok) {
    return page(502, 'Vote not recorded', 'There was an issue saving your vote. Please try again.')
  }

  return page(
    200,
    'Vote registered!',
    'Thank you for helping us shape the future of Total Football. We have recorded your choice.',
  )
}

export const config: Config = { path: '/api/vote' }
