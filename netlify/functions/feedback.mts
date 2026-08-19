/**
 * What a coach thinks of the studio, on its way to the table.
 *
 * Same posture as subscribe.mts, for the same reason: the browser must never
 * hold a Supabase key that can do more than insert, and here it holds none at
 * all. The table is insert-only under RLS (supabase/008_studio_feedback.sql)
 * and this function is the only writer.
 *
 * IT DOES NOT RUN UNDER `astro dev`. Netlify Functions exist only under
 * `netlify dev` or on a deploy, so a POST to /api/feedback on localhost
 * returns 404. The dialog treats that as a failure it does not report — see
 * `sendFeedback` in src/studio/feedback.ts.
 *
 * Env (set in the Netlify UI, never committed):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY      insert-only via RLS
 *   ALLOWED_ORIGIN         the site origin, for the cross-origin check
 */

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/**
 * Half stars only, 0 through 5.
 *
 * Validated here as well as in the CHECK constraint, so a bad value comes back
 * as a 400 a caller can read rather than a 400 from PostgREST that says
 * "violates check constraint" and means nothing to anybody.
 */
function rating(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  if (v < 0 || v > 5) return null
  return v * 2 === Math.floor(v * 2) ? v : null
}

function recommend(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  const n = Math.round(v)
  return n >= 0 && n <= 10 ? n : null
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const allowed = process.env.ALLOWED_ORIGIN
  const origin = request.headers.get('origin')
  if (allowed && origin && origin !== allowed) return json(403, { error: 'Forbidden' })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json(400, { error: 'Invalid body' })
  }

  // A bot filling every field it can find writes nothing. Answered as success
  // so it learns nothing, exactly as in subscribe.mts.
  if (typeof body.company === 'string' && body.company) return json(200, { ok: true })

  const stars = rating(body.rating)
  const tell = recommend(body.recommend)
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) || null : null
  const context =
    typeof body.context === 'string' && body.context ? body.context.slice(0, 64) : 'unknown'

  // Matches `studio_feedback_not_empty`. A coach who opens the dialog, touches
  // nothing and presses send has not given feedback, and a row of three nulls
  // would quietly drag the averages toward whatever null sorts as.
  if (stars === null && tell === null && note === null) {
    return json(400, { error: 'Nothing to send.' })
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('feedback: SUPABASE_URL / SUPABASE_ANON_KEY are not set')
    return json(500, { error: 'Not configured' })
  }

  const res = await fetch(`${url}/rest/v1/studio_feedback`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([{ rating: stars, recommend: tell, note, context }]),
  })

  if (!res.ok) {
    console.error('feedback: supabase responded', res.status, await res.text())
    return json(502, { error: 'Could not save that right now.' })
  }

  return json(200, { ok: true })
}

export const config = { path: '/api/feedback' }
