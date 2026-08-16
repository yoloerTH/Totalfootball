/**
 * Preview or test-send the welcome automation — the message
 * netlify/functions/subscribe.mts fires the moment somebody joins.
 *
 *   node scripts/send-welcome.mjs
 *        writes both variants to dist-preview/ and sends nothing.
 *
 *   node scripts/send-welcome.mjs --test you@example.com [--course]
 *        sends one real copy, list untouched.
 *
 * It exists because the welcome is the hardest email in the system to look
 * at: it is only ever seen by people who have just subscribed, and never by
 * the person who wrote it, so it is the one that quietly rots. This makes it
 * openable on demand without joining your own list.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { welcomeEmail, sendBatch, transportName, lintEmailHtml, SITE, FROM } from './lib/email.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

const args = process.argv.slice(2)
const testIdx = args.indexOf('--test')
const TEST_EMAIL = testIdx >= 0 ? args[testIdx + 1] : null
const COURSE = args.includes('--course')

if (testIdx >= 0 && !TEST_EMAIL) {
  console.error('--test requires an email address')
  process.exit(1)
}

console.log(`\nTOTAL FOOTBALL — welcome automation\n${'='.repeat(48)}`)
console.log(`From       ${FROM}`)
console.log(`Links use  ${SITE}`)
console.log(`Transport  ${transportName() ?? 'NONE CONFIGURED'}`)

const previewDir = join(ROOT, 'dist-preview')
mkdirSync(previewDir, { recursive: true })

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

if (!TEST_EMAIL) {
  console.log(`\nPreview only. Re-run with --test <email> to send one.`)
  process.exit(0)
}

const msg = welcomeEmail({
  email: TEST_EMAIL,
  source: COURSE ? 'course-early-access' : '',
  name: null,
})
console.log(`\nTest send → ${TEST_EMAIL} (${COURSE ? 'course' : 'list'} variant)…`)
await sendBatch([{ ...msg, subject: `[TEST] ${msg.subject}` }])
console.log(`Done. Sent to ${TEST_EMAIL}.`)
