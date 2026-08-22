/**
 * Reconcile the Supabase audience with the Zoho Campaigns list.
 *
 *   node scripts/sync-campaigns.mjs
 *        read-only. Prints exactly what a --run would change, and nothing
 *        moves. Safe to run any time, and the thing to run before a send.
 *
 *   node scripts/sync-campaigns.mjs --run
 *        performs the sync.
 *
 * ── WHAT IT DOES, IN ORDER ──────────────────────────────────────────────────
 *
 *   1. PULL opt-outs down.  Everything Campaigns has marked `unsub` or
 *      `bounce` is written into email_suppressions. This runs FIRST and that
 *      ordering is deliberate: doing it after the push would mean pushing an
 *      address up in step 2 that step 1 was about to learn has opted out, and
 *      a re-added contact can be re-mailed.
 *
 *   2. PUSH contacts up.  Every sendable address in email_audience that
 *      Campaigns does not already hold is added, carrying its `source` so the
 *      list has a provenance trail.
 *
 *   3. PUSH opt-outs up.  Anybody suppressed on our side but still active in
 *      Campaigns is unsubscribed there. This is what makes OUR footer link —
 *      the HMAC one at /api/unsubscribe — actually stop a Campaigns
 *      newsletter, rather than only stopping mail we send ourselves.
 *
 * Step 3 is the one that is easy to leave out and is the reason to have this
 * file at all. Without it a person unsubscribes through the link in the email,
 * gets a page saying they are unsubscribed, and receives the next newsletter
 * regardless, because Campaigns was never told.
 */
import { audience, suppress, suppressedSet } from './lib/audience.mjs'
import {
  addContact,
  unsubscribeContact,
  listContacts,
  campaignsConfigured,
  LIST_KEY,
} from './lib/campaigns.mjs'

const RUN = process.argv.includes('--run')

if (!campaignsConfigured()) {
  console.error(
    '\nZoho Campaigns is not configured. Needed in .env (see docs/EMAIL.md):\n' +
      '  ZOHO_CLIENT_ID\n  ZOHO_CLIENT_SECRET\n  ZOHO_REFRESH_TOKEN\n  ZOHO_CAMPAIGNS_LISTKEY\n',
  )
  process.exit(1)
}

const line = '='.repeat(52)
console.log(`\nTOTAL FOOTBALL — Campaigns sync\n${line}`)
console.log(`Mode       ${RUN ? 'RUN — this will change both sides' : 'dry run — nothing will change'}`)
console.log(`List key   ${LIST_KEY.slice(0, 8)}…`)

/* ── 1. Pull opt-outs down ───────────────────────────────────────────────── */

const remoteUnsub = await listContacts('unsub')
const remoteBounce = await listContacts('bounce')
const localSuppressed = await suppressedSet()

const newOptOuts = [
  ...remoteUnsub.filter((c) => !localSuppressed.has(c.email)).map((c) => ({ ...c, reason: 'unsubscribe' })),
  ...remoteBounce.filter((c) => !localSuppressed.has(c.email)).map((c) => ({ ...c, reason: 'bounce' })),
]

console.log(`\n1 · Opt-outs in Campaigns not yet recorded here`)
console.log(`    unsubscribed  ${remoteUnsub.length} in Campaigns`)
console.log(`    bounced       ${remoteBounce.length} in Campaigns`)
console.log(`    to record     ${newOptOuts.length}`)
for (const c of newOptOuts.slice(0, 20)) console.log(`      + ${c.email} (${c.reason})`)
if (newOptOuts.length > 20) console.log(`      …and ${newOptOuts.length - 20} more`)

if (RUN && newOptOuts.length) {
  for (const reason of ['unsubscribe', 'bounce']) {
    const batch = newOptOuts.filter((c) => c.reason === reason).map((c) => c.email)
    if (batch.length) await suppress(batch, { reason, source: 'campaigns' })
  }
  console.log(`    recorded ${newOptOuts.length}`)
}

/* ── 2 & 3. Push ─────────────────────────────────────────────────────────── */

// Re-read AFTER the pull, so anybody just suppressed in step 1 is already
// excluded from `sendable` and is never pushed up in step 2.
const { sendable, suppressed, invalid } = await audience()

const remoteActive = new Set((await listContacts('active')).map((c) => c.email))
const remoteKnown = new Set([
  ...remoteActive,
  ...remoteUnsub.map((c) => c.email),
  ...remoteBounce.map((c) => c.email),
])

const toAdd = sendable.filter((r) => !remoteKnown.has(r.email))
const toUnsubscribe = suppressed.filter((r) => remoteActive.has(r.email))

console.log(`\n   Audience in Supabase`)
console.log(`    sendable      ${sendable.length}`)
console.log(`    suppressed    ${suppressed.length}`)
console.log(`    invalid       ${invalid.length}`)
for (const r of invalid.slice(0, 10)) console.log(`      ? ${JSON.stringify(r.email)}`)

console.log(`\n2 · Contacts to add to Campaigns  ${toAdd.length}`)
for (const r of toAdd.slice(0, 20)) console.log(`      + ${r.email}  [${r.sources}]`)
if (toAdd.length > 20) console.log(`      …and ${toAdd.length - 20} more`)

console.log(`\n3 · Opt-outs to push to Campaigns  ${toUnsubscribe.length}`)
for (const r of toUnsubscribe.slice(0, 20)) console.log(`      - ${r.email}`)
if (toUnsubscribe.length > 20) console.log(`      …and ${toUnsubscribe.length - 20} more`)

if (!RUN) {
  console.log(`\nDry run. Re-run with --run to apply.\n`)
  process.exit(0)
}

/**
 * Serial, with a pause between calls. Campaigns allows 500 contact calls a
 * minute and answers a breach with a THIRTY MINUTE lockout of the client, not
 * a 429 you can retry — so this stays at roughly 4 a second, far under, and
 * accepts being slow. At the current list size the whole sync is under a
 * minute regardless.
 */
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

let added = 0
let existed = 0
const failures = []

for (const r of toAdd) {
  try {
    const outcome = await addContact({ email: r.email, name: r.name, source: r.sources })
    outcome === 'added' ? added++ : existed++
  } catch (err) {
    failures.push(`add ${r.email}: ${err.message}`)
  }
  await pause(250)
}

let removed = 0
for (const r of toUnsubscribe) {
  try {
    await unsubscribeContact(r.email)
    removed++
  } catch (err) {
    failures.push(`unsubscribe ${r.email}: ${err.message}`)
  }
  await pause(250)
}

console.log(`\n${line}`)
console.log(`Recorded opt-outs   ${newOptOuts.length}`)
console.log(`Added to Campaigns  ${added} (${existed} already present)`)
console.log(`Unsubscribed there  ${removed}`)

if (failures.length) {
  console.log(`\nFailures (${failures.length}):`)
  for (const f of failures) console.log(`  ! ${f}`)
  process.exit(1)
}

console.log(`\nIn sync.\n`)
