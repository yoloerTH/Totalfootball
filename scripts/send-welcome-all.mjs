/**
 * Send the welcome introduction to the whole existing audience — the one-off
 * backfill for everybody who joined before the welcome automation existed.
 *
 *   node scripts/send-welcome-all.mjs
 *        read-only audience report; sends nothing
 *
 *   node scripts/send-welcome-all.mjs --send
 *        sends the appropriate welcome variant to the reported audience
 *
 * ── THIS IS PRODUCT MAIL, NOT A NEWSLETTER ──────────────────────────────────
 *
 * It goes through ZeptoMail rather than Campaigns, and that is the right way
 * round: each message carries its own HMAC-signed unsubscribe link, it is a
 * one-time introduction rather than a recurring broadcast, and it is a few
 * dozen messages. Recurring editions go through scripts/send-newsletter.mjs.
 *
 * ── THE AUDIENCE IS NOT DEFINED HERE ANY MORE ───────────────────────────────
 *
 * It used to be: this file carried a hand-written SQL union of `subscribers`
 * and `auth.users`, which is exactly the sort of thing that drifts from what
 * every other sender believes. Worse, it could not honour an opt-out from a
 * Studio account holder, because that person has no `subscribers` row for
 * `unsubscribed_at` to live on — so an unsubscribed Studio user was still in
 * the audience it printed.
 *
 * `public.email_audience` (supabase/010) is the definition now, and
 * `suppressed` there is true if the address opted out through EITHER
 * mechanism. Read it via scripts/lib/audience.mjs; never rebuild the union.
 */
import { audience } from './lib/audience.mjs'
import { welcomeEmail, sendBatch, transportName, lintEmailHtml, SITE, FROM } from './lib/email.mjs'

const SEND = process.argv.includes('--send')

const { sendable, suppressed, invalid } = await audience()

const course = sendable.filter((r) => r.is_course === true)
const studioOnly = sendable.filter((r) => r.is_studio === true && r.is_subscriber !== true)
const overlap = sendable.filter((r) => r.is_studio === true && r.is_subscriber === true)

console.log(`\nTOTAL FOOTBALL — welcome backfill\n${'='.repeat(52)}`)
console.log(`From       ${FROM}`)
console.log(`Links use  ${SITE}`)
console.log(`Transport  ${transportName() || 'NONE CONFIGURED'}`)
console.log(`\nAudience (public.email_audience)`)
console.log(`  Sendable                    ${sendable.length}`)
console.log(`  Suppressed (opted out)      ${suppressed.length}`)
console.log(`  Invalid / malformed         ${invalid.length}`)
console.log(`  Early-access variant        ${course.length}`)
console.log(`  Studio-only recipients      ${studioOnly.length}`)
console.log(`  In both audiences           ${overlap.length}`)

for (const r of invalid.slice(0, 10)) console.log(`  ? malformed: ${JSON.stringify(r.email)}`)

/**
 * Somebody who only ever created a Studio account did not sign up to a
 * newsletter, and telling them so in the footer is both honest and the thing
 * that stops a "why am I getting this" reply becoming a spam complaint.
 */
const messages = sendable.map((r) =>
  welcomeEmail({
    email: r.email,
    source: r.is_course === true ? 'course-early-access' : '',
    name: r.name || null,
    reason:
      r.is_studio === true && r.is_subscriber !== true
        ? 'You are receiving this because you created a Total Football Studio account.'
        : undefined,
  }),
)

const lintWarnings = [...new Set(messages.flatMap((m) => lintEmailHtml(m.html)))]
for (const w of lintWarnings) console.log(`  ! ${w}`)

if (!SEND) {
  console.log(`\nDry run. Nothing sent.`)
  console.log(`Re-run with --send once the audience and the copy are confirmed.\n`)
  process.exit(0)
}

if (!transportName()) {
  console.error('\nNo mail transport. Set ZEPTOMAIL_TOKEN in .env.\n')
  process.exit(1)
}

if (!messages.length) {
  console.log('\nNobody sendable. Nothing sent.\n')
  process.exit(0)
}

// sendBatch does one HTTP call per recipient with a small concurrency window
// (the unsubscribe link is per-address, so a true batch cannot carry it).
// Chunked anyway so progress is visible and a failure names where it stopped.
const CHUNK = 50
let sent = 0
for (let i = 0; i < messages.length; i += CHUNK) {
  const chunk = messages.slice(i, i + CHUNK)
  console.log(`Sending ${i + 1}–${i + chunk.length} of ${messages.length}…`)
  await sendBatch(chunk)
  sent += chunk.length
}

console.log(`\nDone. ${sent} welcome emails sent.\n`)
