/**
 * One-off studio welcome backfill.
 *
 * Sends studioWelcomeEmail() to every confirmed Studio account holder who
 * joined before the automation existed (i.e. everyone). Fires once, never
 * again: the trigger on auth.users (supabase/011) handles all future sign-ups.
 *
 *   node scripts/send-studio-welcome-all.mjs
 *        Dry run — prints the audience, sends nothing.
 *
 *   node scripts/send-studio-welcome-all.mjs --send
 *        The real send. Confirm the dry-run output first.
 *
 * ── SAFETY POSTURE ──────────────────────────────────────────────────────────
 *
 *  · Source of truth is auth.users directly (via execute_sql RPC), not
 *    email_audience: email_audience folds subscribers and studio accounts into
 *    one row per inbox, which means a coach who is ALSO a newsletter subscriber
 *    appears once with is_studio=true AND is_subscriber=true. The studio welcome
 *    should go to them regardless of their subscriber state, but we do NOT want
 *    to accidentally send the newsletter welcome. Going to auth.users directly
 *    keeps the audience definition crystal-clear and unambiguous.
 *
 *  · Suppression check is still done via email_suppressions (the authoritative
 *    opt-out table). Nobody in that table receives anything.
 *
 *  · name is read from raw_user_meta_data (full_name → name → null), the same
 *    precedence as email_audience.sql and studio-welcome.mts.
 *
 *  · ZeptoMail only — the Zoho SMTP fallback is capped at 20 per run and this
 *    list is 60+. The script fails loudly if ZeptoMail is not configured.
 *
 *  · Chunked 50 at a time with progress logging so a failure mid-run names
 *    exactly where it stopped.
 */

import { studioWelcomeEmail, sendBatch, transportName, lintEmailHtml, SITE, FROM } from './lib/email.mjs'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SEND = process.argv.includes('--send')

// ── Credentials ──────────────────────────────────────────────────────────────

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

const SUPABASE_URL = envVar('SUPABASE_URL')
const SERVICE_KEY  = envVar('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
  process.exit(1)
}

// ── Audience query ───────────────────────────────────────────────────────────

async function rpc(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) throw new Error(`execute_sql ${res.status}: ${await res.text()}`)
  return res.json()
}

const rows = await rpc(`
  SELECT
    lower(btrim(u.email))                                          AS email,
    coalesce(
      nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data->>'name'),      '')
    )                                                              AS name,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.email_suppressions sup
         ON sup.email = lower(btrim(u.email))
  WHERE u.email IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
    AND u.deleted_at IS NULL
    AND sup.email IS NULL          -- not suppressed
  ORDER BY u.created_at
`)

// ── Report ───────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const valid   = rows.filter(r => EMAIL_RE.test(r.email))
const invalid = rows.filter(r => !EMAIL_RE.test(r.email))

console.log(`\nTOTAL FOOTBALL — studio welcome backfill\n${'='.repeat(52)}`)
console.log(`From         ${FROM}`)
console.log(`Links use    ${SITE}`)
console.log(`Transport    ${transportName() ?? 'NONE CONFIGURED'}`)
console.log(`\nAudience`)
console.log(`  Will send to          ${valid.length}`)
console.log(`  Malformed (skipped)   ${invalid.length}`)
if (invalid.length) invalid.forEach(r => console.log(`    ? ${JSON.stringify(r.email)}`))

console.log(`\nRecipients:`)
for (const r of valid) {
  console.log(`  ${r.email.padEnd(42)} joined ${r.created_at.slice(0, 10)}  name=${r.name ?? '(none)'}`)
}

// ── Lint check ───────────────────────────────────────────────────────────────

const sample = studioWelcomeEmail({ email: 'lint@example.com', name: 'Test' })
const warnings = lintEmailHtml(sample.html)
if (warnings.length) {
  console.log('\nHTML warnings:')
  for (const w of warnings) console.log(`  ! ${w}`)
} else {
  console.log('\nHTML lint: clean ✓')
}

// ── Dry run gate ─────────────────────────────────────────────────────────────

if (!SEND) {
  console.log(`\nDry run. Nothing sent.`)
  console.log(`Re-run with --send once the list above is confirmed.\n`)
  process.exit(0)
}

if (!transportName()) {
  console.error('\nNo mail transport. Set ZEPTOMAIL_TOKEN in .env.\n')
  process.exit(1)
}

if (transportName() !== 'zeptomail') {
  console.error(
    `\nTransport is "${transportName()}", not zeptomail.\n` +
    `The Zoho SMTP fallback is capped at ${envVar('ZOHO_SMTP_MAX_PER_RUN') || 20} messages per run.\n` +
    `This list has ${valid.length} recipients. Set ZEPTOMAIL_TOKEN and retry.\n`
  )
  process.exit(1)
}

if (!valid.length) {
  console.log('\nNobody sendable. Nothing sent.\n')
  process.exit(0)
}

// ── Send ─────────────────────────────────────────────────────────────────────

const messages = valid.map(r => studioWelcomeEmail({ email: r.email, name: r.name ?? null }))

const CHUNK = 50
let sent = 0
for (let i = 0; i < messages.length; i += CHUNK) {
  const chunk = messages.slice(i, i + CHUNK)
  console.log(`\nSending ${i + 1}–${Math.min(i + CHUNK, messages.length)} of ${messages.length}…`)
  await sendBatch(chunk)
  sent += chunk.length
  console.log(`  ✓ ${sent} sent so far`)
}

console.log(`\nDone. ${sent} studio welcome emails sent.\n`)
