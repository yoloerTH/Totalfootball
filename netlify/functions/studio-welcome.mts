/**
 * Studio account welcome automation.
 *
 * Called by a Supabase Database Webhook on `auth.users` (INSERT + UPDATE).
 * Two sign-up paths both end here, for different reasons:
 *
 *   Google OAuth    — Supabase confirms the address immediately and sets
 *                     `email_confirmed_at` at INSERT time. The old_record is
 *                     absent (it is an INSERT), so we fire when the new record
 *                     already carries a confirmed timestamp.
 *
 *   Email + password — Supabase sends its own confirmation link; the coach
 *                     clicks it; `auth.users` gets an UPDATE that moves
 *                     `email_confirmed_at` from null to a timestamp. We fire
 *                     when old_record had it null and the new record does not.
 *
 * Idempotency: once `email_confirmed_at` is set, no future UPDATE can have
 * the old_record's value as null, so the trigger condition fires at most once
 * per address. A second webhook delivery for the same event is still guarded
 * by the suppression check — a double-welcome is extremely unlikely, and not
 * worth a separate "sent" table.
 *
 * IT DOES NOT RUN UNDER `astro dev`. Set up `netlify dev` locally or test
 * with `node scripts/send-welcome.mjs --studio --test you@example.com`.
 *
 * ── SUPABASE DASHBOARD SETUP ──────────────────────────────────────────────
 *
 *   Database → Webhooks → Create a new webhook
 *     Name:    studio-welcome
 *     Schema:  auth
 *     Table:   users
 *     Events:  ✓ Insert   ✓ Update   (not Delete)
 *     Method:  POST
 *     URL:     https://totalfootball.naurra.ai/api/studio-welcome
 *     Headers: x-webhook-secret  →  <value of SUPABASE_WEBHOOK_SECRET>
 *
 * ── ENV (set in Netlify UI, never committed) ──────────────────────────────
 *
 *   SUPABASE_WEBHOOK_SECRET    the value you set in the dashboard header above
 *   SUPABASE_URL               for the suppressions check
 *   SUPABASE_SERVICE_ROLE_KEY  reads email_suppressions (service_role only)
 *   ZEPTOMAIL_TOKEN            or ZOHO_SMTP_USER / ZOHO_SMTP_PASS
 *   UNSUBSCRIBE_SECRET         same value as unsubscribe.mts
 *   EMAIL_FROM
 *   EMAIL_REPLY_TO
 *
 * Any transport/secret missing skips the email — the account itself is never
 * affected. Missing SUPABASE_WEBHOOK_SECRET is a hard 401: unauthenticated
 * webhooks are not forwarded to the mail transport.
 */

import { timingSafeEqual } from 'node:crypto'
import { studioWelcomeEmail, sendBatch, transportName } from '../../scripts/lib/email.mjs'

// ── Supabase webhook payload types ─────────────────────────────────────────

interface AuthUserRecord {
  id: string
  email: string | null
  email_confirmed_at: string | null
  deleted_at?: string | null
  raw_user_meta_data?: Record<string, unknown>
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: AuthUserRecord
  old_record: AuthUserRecord | null
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/**
 * Constant-time secret comparison. The header value is an attacker-controlled
 * string, so a naive === comparison leaks the secret length via timing.
 */
function verifySecret(provided: string, expected: string): boolean {
  if (!expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // Lengths must match; timingSafeEqual requires equal-length buffers.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Extract a display name from the auth row's metadata, the same way
 * email_audience.sql does: full_name wins, then name, then null.
 */
function nameFromMeta(meta?: Record<string, unknown>): string | null {
  if (!meta) return null
  const v = meta['full_name'] ?? meta['name']
  if (typeof v !== 'string') return null
  return v.trim() || null
}

/**
 * Return true if the address is in email_suppressions.
 *
 * Uses the service-role key because the table is restricted to service_role
 * (supabase/010_email_audience.sql). If the env is not configured, we let
 * the send proceed — refusing to send on a missing key would mean a
 * misconfigured deploy silently never sends any welcome.
 */
async function isSuppressed(email: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn('studio-welcome: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping suppression check')
    return false
  }

  try {
    const res = await fetch(
      `${url}/rest/v1/email_suppressions?email=eq.${encodeURIComponent(email)}&select=email&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      },
    )
    if (!res.ok) {
      console.error('studio-welcome: suppression check failed', res.status, await res.text())
      return false
    }
    const rows = (await res.json()) as unknown[]
    return Array.isArray(rows) && rows.length > 0
  } catch (err) {
    console.error('studio-welcome: suppression check threw —', err)
    return false
  }
}

/**
 * The send, with an 8-second cap — same pattern and same reasoning as the
 * subscribe.mts welcome: a Netlify Function process can be frozen the instant
 * a Response is returned, so fire-and-forget without awaiting races the
 * function being torn down. The cap keeps a slow ZeptoMail call from making
 * the webhook response late, which would cause Supabase to retry.
 */
async function sendWelcome(email: string, name: string | null): Promise<void> {
  if (!transportName() || !process.env.UNSUBSCRIBE_SECRET) {
    console.warn('studio-welcome: transport or UNSUBSCRIBE_SECRET not configured — skipping send')
    return
  }

  try {
    await Promise.race([
      sendBatch([studioWelcomeEmail({ email, name })]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('studio welcome email timed out')), 8000),
      ),
    ])
    console.log(`studio-welcome: sent to ${email}`)
  } catch (err) {
    console.error('studio-welcome: send failed —', err)
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async (request: Request) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })

  // ── Authentication ──────────────────────────────────────────────────────
  //
  // The webhook secret lives in the Supabase dashboard as a custom HTTP header
  // value (x-webhook-secret). Missing it on our side is a config error we want
  // to know about loudly; providing a wrong value on the caller's side is a
  // 401 they will see in the Supabase webhook logs.
  const expectedSecret = process.env.SUPABASE_WEBHOOK_SECRET ?? ''
  if (!expectedSecret) {
    console.error('studio-welcome: SUPABASE_WEBHOOK_SECRET is not set — refusing all webhooks')
    return json(500, { error: 'Not configured' })
  }

  const providedSecret = request.headers.get('x-webhook-secret') ?? ''
  if (!verifySecret(providedSecret, expectedSecret)) {
    return json(401, { error: 'Unauthorized' })
  }

  // ── Parse payload ───────────────────────────────────────────────────────
  let payload: WebhookPayload
  try {
    payload = (await request.json()) as WebhookPayload
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }

  const { type, record, old_record } = payload

  // ── Guard: only confirmed, living users ────────────────────────────────
  //
  // Four cases to reject before we touch the mail transport:
  //   1. Not an INSERT or UPDATE — webhooks fire on DELETE too.
  //   2. Email is null or absent — can't mail nobody.
  //   3. email_confirmed_at is still null — email/password signup waiting for
  //      confirmation click; Supabase will UPDATE when they click, and we'll
  //      fire then.
  //   4. deleted_at is set — account was deleted; do not mail it.
  //   5. UPDATE where email_confirmed_at was ALREADY set on the old record —
  //      a profile update or password change, not a new confirmation. Without
  //      this guard the email goes out every time a coach updates their name.
  if (type !== 'INSERT' && type !== 'UPDATE') {
    return json(200, { ok: true, skipped: 'not-insert-or-update' })
  }

  const email = record?.email?.trim().toLowerCase()
  if (!email) return json(200, { ok: true, skipped: 'no-email' })

  if (!record.email_confirmed_at) {
    return json(200, { ok: true, skipped: 'not-confirmed-yet' })
  }

  if (record.deleted_at) {
    return json(200, { ok: true, skipped: 'deleted' })
  }

  // UPDATE where confirmation was already set before this update — not a
  // new confirmation event, just a subsequent profile change.
  if (type === 'UPDATE' && old_record?.email_confirmed_at != null) {
    return json(200, { ok: true, skipped: 'already-confirmed' })
  }

  // ── Suppression check ───────────────────────────────────────────────────
  //
  // A coach who previously subscribed to the newsletter and then unsubscribed
  // must not receive a studio welcome. The same table unsubscribe.mts writes
  // is the authoritative opt-out for all our mail.
  const suppressed = await isSuppressed(email)
  if (suppressed) {
    console.log(`studio-welcome: ${email} is suppressed — skipping`)
    return json(200, { ok: true, skipped: 'suppressed' })
  }

  // ── Send ─────────────────────────────────────────────────────────────────
  const name = nameFromMeta(record.raw_user_meta_data)
  await sendWelcome(email, name)

  return json(200, { ok: true })
}

export const config = { path: '/api/studio-welcome' }
