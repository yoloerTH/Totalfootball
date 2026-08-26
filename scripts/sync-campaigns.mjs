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
import { FROM } from './lib/email.mjs'

const RUN = process.argv.includes('--run')
const canaryIdx = process.argv.indexOf('--canary')
const CANARY_ARG = canaryIdx >= 0 ? process.argv[canaryIdx + 1] : null
/** Run the opt-in preflight and stop, without pushing anybody. */
const PREFLIGHT_ONLY = process.argv.includes('--preflight-only')

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

/**
 * ── THE DOUBLE OPT-IN PREFLIGHT ─────────────────────────────────────────────
 *
 * A Campaigns list created in the UI is DOUBLE OPT-IN by default, and adding a
 * contact to one does not add a contact: it emails that address a "Confirm
 * your subscription" message and parks them, invisible, until they click. On
 * 2026-08-27 that turned an import of 102 already-opted-in addresses into 102
 * confirmation emails nobody asked for, and left the list holding one usable
 * contact.
 *
 * The setting cannot be read. getmailinglists returns thirty fields and the
 * opt-in type is not among them, so this cannot be a lookup — it has to be an
 * experiment: add ONE address, see whether it lands `active` on its own.
 *
 * The canary is an address at our OWN sending domain, so the single email the
 * bad case costs goes to us rather than to a coach. If the audience has no
 * such address, that is not a reason to guess — pass --canary <email>.
 *
 * WHY THIS CANNOT BE SKIPPED ONCE THE LIST IS KNOWN-GOOD: pending contacts are
 * absent from `active`, `unsub` AND `bounce`, so `remoteKnown` above cannot
 * see them and a re-run re-adds every one. On a double opt-in list that is a
 * SECOND confirmation email to everybody. The preflight is what stops the
 * second round, not just the first.
 */
async function assertSingleOptIn() {
  const ourDomain = (FROM.match(/@([^\s>]+)/)?.[1] ?? '').toLowerCase()
  const activeNow = new Set((await listContacts('active')).map((c) => c.email))

  // Zoho rejects plus-addressing outright — /json/listsubscribe answers
  // `2004 Invalid Contact Email address` for anything@with+a+tag — so a
  // throwaway probe minted on the spot is not available. The canary has to be
  // a real deliverable address that is NOT yet active, because an already
  // active one proves only that somebody once clicked a link, which is how a
  // DOUBLE opt-in list produces an active contact too.
  const unspent = (e) => e && !activeNow.has(e.toLowerCase())

  const ours = sendable.find((r) => r.email.toLowerCase().endsWith(`@${ourDomain}`) && unspent(r.email))
  const canary = (CANARY_ARG?.toLowerCase() && unspent(CANARY_ARG) ? CANARY_ARG.toLowerCase() : null) ?? ours?.email ?? toAdd[0]?.email

  if (!canary) {
    console.log(`\n   Preflight  nothing left to add; skipping.`)
    return
  }

  const isOurs = canary.endsWith(`@${ourDomain}`)
  console.log(`\n   Preflight  testing the list's opt-in type with ${canary}`)
  if (!isOurs) {
    // Said out loud, because the cost of the bad case now lands on a real
    // person. It is still the right trade — one confirmation email instead of
    // ${'$'}{toAdd.length} — but it should never be a silent one.
    console.log(`              NOTE: no unspent @${ourDomain} address available, so this is a`)
    console.log(`              real subscriber. If the list is double opt-in they get ONE`)
    console.log(`              confirmation email and the other ${toAdd.length - 1} are not touched.`)
  }

  const row = toAdd.find((r) => r.email.toLowerCase() === canary)
  await addContact({ email: canary, name: row?.name, source: row?.sources || 'preflight' })
  await pause(3000)

  const after = new Set((await listContacts('active')).map((c) => c.email))
  if (!after.has(canary)) {
    console.error(
      `\n${line}\n` +
        `  STOPPED. THIS LIST IS DOUBLE OPT-IN.\n\n` +
        `  ${canary} was added and did not become an active contact, which means\n` +
        `  Campaigns has emailed it a confirmation link instead. Exactly ONE such\n` +
        `  email was sent. The other ${toAdd.length - 1} addresses were not touched.\n\n` +
        `  FIX IT IN THE UI — the opt-in type is not exposed to the API, and the\n` +
        `  bulk-import endpoint does NOT bypass it (it answers "success" and adds\n` +
        `  nobody, which is worse). It lives on the SIGNUP FORM, not the list:\n` +
        `    campaigns.zoho.eu -> Contacts -> Lists -> the list -> the signup form\n` +
        `    -> Edit -> untick "Enable Double opt-in".\n\n` +
        `  Single is the correct setting here. Every address in email_audience\n` +
        `  opted in on the site already and carries its source as a provenance\n` +
        `  trail; asking all of them to opt in a second time loses most of them.\n\n` +
        `  Then re-run. Contacts left pending convert to active when re-added.\n${line}\n`,
    )
    process.exit(1)
  }

  console.log(`              ${canary} went active immediately — list is single opt-in.`)
}

await assertSingleOptIn()

if (PREFLIGHT_ONLY) {
  console.log(`\n--preflight-only: list is single opt-in, ${toAdd.length} would be pushed. Nothing pushed.\n`)
  process.exit(0)
}

let added = 0
let existed = 0
const failures = []

// Progress is printed as it goes, because this is the slow half — Campaigns
// answers an add in about a second and there are a hundred of them, so a run
// that prints nothing until the end looks identical to a run that has hung.
for (const [i, r] of toAdd.entries()) {
  try {
    const outcome = await addContact({ email: r.email, name: r.name, source: r.sources })
    outcome === 'added' ? added++ : existed++
  } catch (err) {
    failures.push(`add ${r.email}: ${err.message}`)
  }
  if ((i + 1) % 10 === 0 || i + 1 === toAdd.length) {
    console.log(`              ${i + 1}/${toAdd.length} (${added} added, ${existed} already there)`)
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
