/**
 * Send an HTML newsletter to every active subscriber.
 *
 *   node scripts/send-newsletter.mjs content/newsletters/2026-08-16.html
 *        preview only: writes dist-preview/newsletter.html, prints the plain
 *        text part and the recipient count. Sends nothing. Safe to re-run.
 *
 *   node scripts/send-newsletter.mjs content/newsletters/2026-08-16.html --send
 *        actually sends, to everyone with unsubscribed_at is null.
 *
 *   node scripts/send-newsletter.mjs content/newsletters/2026-08-16.html --test you@example.com
 *        sends exactly one copy to the given address, real send, real
 *        per-recipient unsubscribe link, list untouched. For checking a
 *        design or subject line lands looking right before the real send.
 *
 * The content file is the INNER html only — the <h2>/<p>/<a> body that goes
 * inside scripts/lib/email.mjs's wrapEmail() shell, not a full document. That
 * split exists so the wordmark, unsubscribe footer and postal address (legally
 * required, see supabase/007 + netlify/functions/unsubscribe.mts) can't be
 * dropped by whoever writes next week's content.
 *
 * Its subject and preheader are read from a comment block at the top of that
 * same file (see frontMatter below) rather than passed on the command line.
 * A subject is part of the edition, not part of the invocation: kept in the
 * file it is version-controlled, reviewable in the diff, and cannot end up
 * describing last week's content because somebody forgot to change the shell
 * variable.
 *
 * Uses the SERVICE ROLE key to read subscribers, same as
 * scripts/analytics-report.mjs and netlify/functions/daily-report.mts — anon
 * has no SELECT on this table (supabase/001).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SITE,
  FROM,
  unsubscribeUrl,
  wrapEmail,
  htmlToText,
  sendBatch,
  transportName,
  lintEmailHtml,
} from './lib/email.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

const [, , contentPath, ...rest] = process.argv
const SEND = rest.includes('--send')
const testIdx = rest.indexOf('--test')
const TEST_EMAIL = testIdx >= 0 ? rest[testIdx + 1] : null

if (!contentPath) {
  console.error('usage: node scripts/send-newsletter.mjs <content.html> [--send | --test <email>]')
  process.exit(1)
}
if (testIdx >= 0 && !TEST_EMAIL) {
  console.error('--test requires an email address')
  process.exit(1)
}

const raw = readFileSync(join(ROOT, contentPath), 'utf8')

/**
 * `key: value` lines inside a leading HTML comment. Stays a comment so the
 * content file is still a valid fragment that renders on its own in a browser
 * while it is being written.
 */
function frontMatter(source) {
  const m = source.match(/^\s*<!--([\s\S]*?)-->/)
  if (!m) return { meta: {}, body: source }
  const meta = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^\s*([a-z-]+)\s*:\s*(.+?)\s*$/i)
    if (kv) meta[kv[1].toLowerCase()] = kv[2]
  }
  return { meta, body: stripComments(source.slice(m[0].length)) }
}

/**
 * Drop the author's notes from what actually ships. Conditional comments are
 * left alone — `<!--[if mso]>` is not a note, it is the only way to say
 * anything to Outlook, and stripping one silently breaks the layout it exists
 * to fix.
 */
function stripComments(html) {
  return html.replace(/<!--(?!\[if)([\s\S]*?)-->/g, '').trim()
}

const { meta, body: bodyHtml } = frontMatter(raw)
const subject = process.env.SUBJECT || meta.subject
const preheader = meta.preheader || ''
const edition = meta.edition || ''

// A relative `hero:` is resolved against the live origin, so the content file
// names an asset in public/ and never has to hardcode a domain.
const hero = meta.hero
  ? {
      src: /^https?:\/\//.test(meta.hero) ? meta.hero : `${SITE}/${meta.hero.replace(/^\//, '')}`,
      alt: meta['hero-alt'] || '',
      href: meta['hero-href'] || `${SITE}/`,
    }
  : null

if (!subject) {
  console.error(
    `No subject. Add one to the top of ${contentPath}:\n\n  <!--\n  subject: ...\n  preheader: ...\n  -->\n`,
  )
  process.exit(1)
}

function supabaseCreds() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY }
  }
  const env = readFileSync(join(ROOT, '.env'), 'utf8')
  const url = env.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim()
  const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim()
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found')
  return { url, key }
}

async function activeSubscribers() {
  const { url, key } = supabaseCreds()
  const res = await fetch(
    `${url}/rest/v1/subscribers?select=email&unsubscribed_at=is.null&order=created_at.asc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`)
  return res.json()
}

/** Everything one recipient needs. The unsubscribe link differs per address. */
const message = (to, subjectLine) => {
  const unsub = unsubscribeUrl(to)
  return {
    to,
    subject: subjectLine,
    html: wrapEmail({ preheader, bodyHtml, unsubscribe: unsub, edition, hero }),
    text: htmlToText(bodyHtml, { unsubscribe: unsub }),
    unsubscribeUrl: unsub,
  }
}

// A test send goes to one hand-typed address and never touches the list, so
// it does not need the service role key to be present or working.
const rows = TEST_EMAIL ? [] : await activeSubscribers()

console.log(`\nTOTAL FOOTBALL — newsletter\n${'='.repeat(48)}`)
console.log(`Content    ${contentPath}`)
console.log(`Edition    ${edition || '(none)'}`)
console.log(`Subject    ${subject}`)
console.log(`Preheader  ${preheader || '(none — the client will scrape the body)'}`)
console.log(`Hero       ${hero ? hero.src : '(none)'}`)
console.log(`From       ${FROM}`)
console.log(`Links use  ${SITE}`)
console.log(`Transport  ${transportName() ?? 'NONE CONFIGURED'}`)
if (!TEST_EMAIL) console.log(`Recipients ${rows.length} (unsubscribed_at is null)`)

const warnings = lintEmailHtml(bodyHtml)
if (warnings.length) {
  console.log(`\nRenders wrong in Outlook:`)
  for (const w of warnings) console.log(`  ! ${w}`)
}

// Render once against a placeholder link so a human can eyeball the layout —
// the real per-recipient link is swapped in per-email at send time, below.
const previewDir = join(ROOT, 'dist-preview')
mkdirSync(previewDir, { recursive: true })
const previewPath = join(previewDir, 'newsletter.html')
writeFileSync(
  previewPath,
  wrapEmail({
    preheader,
    bodyHtml,
    unsubscribe: '#preview-only-real-links-are-per-recipient',
    edition,
    hero,
  }),
)
const textPath = join(previewDir, 'newsletter.txt')
writeFileSync(textPath, htmlToText(bodyHtml, { unsubscribe: `${SITE}/api/unsubscribe?…` }))
console.log(`Preview    file://${previewPath}`)
console.log(`Plain text file://${textPath}`)

if (TEST_EMAIL) {
  console.log(`\nTest send → ${TEST_EMAIL} (real send, list untouched)…`)
  await sendBatch([message(TEST_EMAIL, `[TEST] ${subject}`)])
  console.log(`Done. Sent to ${TEST_EMAIL}.`)
  process.exit(0)
}

if (!SEND) {
  console.log(`\nDry run. Open the preview above, then re-run with --send to deliver.`)
  process.exit(0)
}

if (!rows.length) {
  console.log('\nNo active subscribers. Nothing sent.')
  process.exit(0)
}

console.log(`\nSending to ${rows.length}…`)

// Resend's batch endpoint takes up to 100 per call; the Zoho path walks the
// same array one message at a time over a pooled connection. Chunked either
// way so neither transport is ever handed an unbounded list.
const CHUNK = 100
let sent = 0
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK)
  await sendBatch(chunk.map(({ email }) => message(email, subject)))
  sent += chunk.length
  console.log(`  sent ${sent}/${rows.length}`)
}

console.log(`\nDone. ${sent} sent.`)
