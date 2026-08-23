/**
 * Preview or test-send the welcome automations:
 *   - Newsletter welcome (netlify/functions/subscribe.mts)
 *   - Studio account welcome (netlify/functions/studio-welcome.mts)
 *
 * Usage:
 *
 *   node scripts/send-welcome.mjs
 *        Writes all variants to dist-preview/ and sends nothing.
 *
 *   node scripts/send-welcome.mjs --test you@example.com [--course] [--studio]
 *        Sends one real copy of the chosen variant. List untouched.
 *
 *   --course    Newsletter / course early-access variant (default: list variant)
 *   --studio    Studio account welcome instead of the newsletter welcome
 *
 * It exists because welcome emails are the hardest to look at: they are only
 * ever seen by people who have just signed up, and never by the person who
 * wrote them, so they quietly rot. This makes any variant openable on demand.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  welcomeEmail,
  studioWelcomeEmail,
  sendBatch,
  transportName,
  lintEmailHtml,
  SITE,
  FROM,
} from './lib/email.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

const args = process.argv.slice(2)
const testIdx = args.indexOf('--test')
const TEST_EMAIL = testIdx >= 0 ? args[testIdx + 1] : null
const COURSE = args.includes('--course')
const STUDIO = args.includes('--studio')

if (testIdx >= 0 && !TEST_EMAIL) {
  console.error('--test requires an email address')
  process.exit(1)
}

console.log(`\nTOTAL FOOTBALL — welcome automations\n${'='.repeat(48)}`)
console.log(`From       ${FROM}`)
console.log(`Links use  ${SITE}`)
console.log(`Transport  ${transportName() ?? 'NONE CONFIGURED'}`)

const previewDir = join(ROOT, 'dist-preview')
mkdirSync(previewDir, { recursive: true })

// ── Newsletter welcome variants ────────────────────────────────────────────
for (const [label, source] of [
  ['welcome-list', ''],
  ['welcome-course', 'course-early-access'],
]) {
  const msg = welcomeEmail({
    email: TEST_EMAIL || 'preview@example.com',
    source,
    name: 'Alex',
  })
  writeFileSync(join(previewDir, `${label}.html`), msg.html)
  writeFileSync(join(previewDir, `${label}.txt`), msg.text)
  const warnings = lintEmailHtml(msg.html)
  console.log(`\n${label}`)
  console.log(`  subject  ${msg.subject}`)
  console.log(`  preview  file://${join(previewDir, `${label}.html`)}`)
  for (const w of warnings) console.log(`  ! ${w}`)
}

// ── Studio account welcome ─────────────────────────────────────────────────
{
  const label = 'welcome-studio'
  const msg = studioWelcomeEmail({
    email: TEST_EMAIL || 'preview@example.com',
    name: 'Alex',
  })
  writeFileSync(join(previewDir, `${label}.html`), msg.html)
  writeFileSync(join(previewDir, `${label}.txt`), msg.text)
  const warnings = lintEmailHtml(msg.html)
  console.log(`\n${label}`)
  console.log(`  subject  ${msg.subject}`)
  console.log(`  preview  file://${join(previewDir, `${label}.html`)}`)
  for (const w of warnings) console.log(`  ! ${w}`)
}

if (!TEST_EMAIL) {
  console.log(`\nPreview only. Re-run with --test <email> [--course | --studio] to send one.`)
  process.exit(0)
}

// ── Real send ──────────────────────────────────────────────────────────────
if (STUDIO) {
  const msg = studioWelcomeEmail({ email: TEST_EMAIL, name: null })
  console.log(`\nTest send → ${TEST_EMAIL} (studio variant)…`)
  await sendBatch([{ ...msg, subject: `[TEST] ${msg.subject}` }])
  console.log(`Done. Sent to ${TEST_EMAIL}.`)
} else {
  const msg = welcomeEmail({
    email: TEST_EMAIL,
    source: COURSE ? 'course-early-access' : '',
    name: null,
  })
  console.log(`\nTest send → ${TEST_EMAIL} (${COURSE ? 'course' : 'list'} variant)…`)
  await sendBatch([{ ...msg, subject: `[TEST] ${msg.subject}` }])
  console.log(`Done. Sent to ${TEST_EMAIL}.`)
}
