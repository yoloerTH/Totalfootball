/**
 * The audience, read from the one place that defines it.
 *
 * Every sender in this project goes through this module. That is the whole
 * point of it: before supabase/010 the union of "subscribers plus Studio
 * accounts minus opt-outs" was written out longhand inside
 * scripts/send-welcome-all.mjs, which meant the definition of who gets mailed
 * lived in a script that nobody reads before sending. It had already drifted
 * — that copy honoured `subscribers.unsubscribed_at` but could not honour an
 * opt-out from a Studio account holder, because such a person has no
 * subscribers row to carry the flag.
 *
 * Reads use the SERVICE ROLE key. `email_audience` joins `auth.users`, so it
 * is granted to service_role and nothing else (see 010) — the anon key cannot
 * read a single row of it, and no browser code may import this file.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

function envVar(name) {
  if (process.env[name]) return process.env[name]
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8')
    const m = raw.match(new RegExp(`^${name}=(.*)$`, 'm'))
    if (!m) return ''
    return m[1].trim().replace(/^"(.*)"$/, '$1')
  } catch {
    return ''
  }
}

function creds() {
  const url = envVar('SUPABASE_URL')
  const key = envVar('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in env or .env')
  }
  return { url, key }
}

async function rest(path, init = {}) {
  const { url, key } = creds()
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`supabase ${path} ${res.status}: ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

/**
 * Everybody, with their opt-out state attached.
 *
 * Returns { sendable, suppressed, invalid } rather than one filtered list, so
 * a caller can PRINT the counts it is about to act on. A send that reports
 * only "sending to 74" hides whether the other six were opt-outs (correct) or
 * malformed addresses (a bug in a form somewhere), and those need different
 * responses.
 */
export async function audience() {
  const rows = await rest(
    'email_audience?select=email,name,sources,is_subscriber,is_studio,is_course,suppressed,suppressed_reason&order=email.asc',
  )

  const suppressed = rows.filter((r) => r.suppressed === true)
  const rest_ = rows.filter((r) => r.suppressed !== true)
  const invalid = rest_.filter((r) => !EMAIL.test(String(r.email ?? '')))
  const sendable = rest_.filter((r) => EMAIL.test(String(r.email ?? '')))

  return { all: rows, sendable, suppressed, invalid }
}

/**
 * Record an opt-out. The ONE writer of email_suppressions outside the
 * unsubscribe endpoint.
 *
 * Upserts, because being told twice that somebody unsubscribed is not an
 * error and must not be one — the Campaigns sync re-reports every existing
 * opt-out on every run by design, since that is how it detects the ones it
 * has not seen yet.
 *
 * `reason` is checked by the database against ('unsubscribe','bounce',
 * 'complaint','manual'); passing anything else fails loudly here rather than
 * writing a row that no reader knows how to interpret.
 */
export async function suppress(emails, { reason = 'unsubscribe', source = 'manual' } = {}) {
  const rows = [...new Set(emails.map((e) => String(e).trim().toLowerCase()))]
    .filter((e) => EMAIL.test(e))
    .map((email) => ({ email, reason, source }))

  if (!rows.length) return 0

  await rest('email_suppressions?on_conflict=email', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  })

  return rows.length
}

/** Addresses already suppressed, as a lower-cased Set. */
export async function suppressedSet() {
  const rows = await rest('email_suppressions?select=email')
  return new Set(rows.map((r) => r.email))
}
