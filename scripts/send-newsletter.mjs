/**
 * Build a newsletter edition and hand it to Zoho Campaigns.
 *
 *   node scripts/send-newsletter.mjs content/newsletters/2026-08-16.html
 *        Builds and lints. Writes the web copy to public/newsletters/ and a
 *        preview to dist-preview/. Touches nothing remote. Safe to re-run.
 *
 *   node scripts/send-newsletter.mjs content/newsletters/2026-08-16.html --test you@example.com
 *        One real copy to one address through ZeptoMail, with a working
 *        per-recipient unsubscribe link. The list is not touched. For
 *        checking that a design and a subject line land right in a real inbox.
 *
 *   node scripts/send-newsletter.mjs content/newsletters/2026-08-16.html --campaign
 *        Creates the campaign in Zoho Campaigns as a DRAFT, pointed at the
 *        deployed web copy. It does NOT send. You press send in Campaigns.
 *
 * ── WHAT CHANGED, AND WHY THERE IS NO --send ANY MORE ───────────────────────
 *
 * This script used to read the subscriber list and blast it down Zoho Mail
 * SMTP, one message per recipient. That is gone. Zoho Mail is a MAILBOX, and
 * bulk sending through a mailbox is the thing that gets a domain's reputation
 * marked down — there is no per-campaign reputation, no bounce processing, no
 * complaint feedback loop, and a few hundred a day ceiling that the list will
 * cross. Newsletters now go through Campaigns, which is built for it.
 *
 * The consequence to understand: the unsubscribe link in a CAMPAIGN is not
 * ours. It cannot be — our link is an HMAC of the recipient's address (see
 * scripts/lib/email.mjs) and Campaigns, which does the merging, has no way to
 * compute one. So the campaign copy uses Campaigns' own `$[LI:UNSUBSCRIBE]$`
 * merge tag, and scripts/sync-campaigns.mjs pulls the resulting opt-outs back
 * into email_suppressions so both halves of the system honour them. The
 * --test path still uses our real signed link, because that one goes through
 * ZeptoMail where we do the merging ourselves.
 *
 * The content file is unchanged: INNER html only, with a `key: value` comment
 * block at the top for subject/preheader/edition/hero.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SITE,
  FROM,
  REPLY_TO,
  unsubscribeUrl,
  wrapEmail,
  htmlToText,
  sendBatch,
  transportName,
  lintEmailHtml,
} from './lib/email.mjs'
import { createCampaign, campaignsConfigured, LIST_KEY } from './lib/campaigns.mjs'
import { audience } from './lib/audience.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** Campaigns refuses to send a campaign whose content has no unsubscribe. */
const CAMPAIGNS_UNSUBSCRIBE_TAG = '$[LI:UNSUBSCRIBE]$'

const [, , contentPath, ...rest] = process.argv
const CAMPAIGN = rest.includes('--campaign')
const testIdx = rest.indexOf('--test')
const TEST_EMAIL = testIdx >= 0 ? rest[testIdx + 1] : null

if (!contentPath) {
  console.error(
    'usage: node scripts/send-newsletter.mjs <content.html> [--test <email> | --campaign]',
  )
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
const series = meta.series || 'Tactical Dispatch'
const slug = basename(contentPath).replace(/\.html?$/i, '')

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

/** Everything one recipient needs, for the ZeptoMail --test path only. */
const message = (to, subjectLine) => {
  const unsub = unsubscribeUrl(to)
  return {
    to,
    subject: subjectLine,
    html: wrapEmail({ preheader, bodyHtml, unsubscribe: unsub, edition, series, hero }),
    text: htmlToText(bodyHtml, { unsubscribe: unsub }),
    unsubscribeUrl: unsub,
  }
}

/* ── Report ──────────────────────────────────────────────────────────────── */

console.log(`\nTOTAL FOOTBALL — newsletter\n${'='.repeat(52)}`)
console.log(`Content    ${contentPath}`)
console.log(`Edition    ${edition || '(none)'}`)
console.log(`Series     ${series}`)
console.log(`Subject    ${subject}`)
console.log(`Preheader  ${preheader || '(none — the client will scrape the body)'}`)
console.log(`Hero       ${hero ? hero.src : '(none)'}`)
console.log(`From       ${FROM}`)
console.log(`Links use  ${SITE}`)
console.log(`Test via   ${transportName() ?? 'NO TRANSPORT CONFIGURED'}`)
console.log(`Broadcast  Zoho Campaigns ${campaignsConfigured() ? `(list ${LIST_KEY.slice(0, 8)}…)` : '(NOT CONFIGURED)'}`)

const warnings = lintEmailHtml(bodyHtml)
if (warnings.length) {
  console.log(`\nRenders wrong in Outlook:`)
  for (const w of warnings) console.log(`  ! ${w}`)
}

/* ── Build both copies ───────────────────────────────────────────────────── */

// The campaign copy. Its unsubscribe href is Campaigns' merge tag, which
// Campaigns replaces per recipient when it sends.
const campaignHtml = wrapEmail({
  preheader,
  bodyHtml,
  unsubscribe: CAMPAIGNS_UNSUBSCRIBE_TAG,
  edition,
  series,
  hero,
})

// Written into public/ so it deploys with the site. This is what Campaigns
// fetches — it does not accept HTML in the request body — and it doubles as
// the permanent web archive of the edition.
const webDir = join(ROOT, 'public', 'newsletters')
mkdirSync(webDir, { recursive: true })
const webPath = join(webDir, `${slug}.html`)
writeFileSync(webPath, campaignHtml)
const contentUrl = `${SITE}/newsletters/${slug}.html`

// The human preview, with a dead placeholder link so nobody clicks it and
// opts a real address out while checking a layout.
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
    series,
    hero,
  }),
)
const textPath = join(previewDir, 'newsletter.txt')
writeFileSync(textPath, htmlToText(bodyHtml, { unsubscribe: `${SITE}/api/unsubscribe?…` }))

console.log(`\nPreview    file://${previewPath}`)
console.log(`Plain text file://${textPath}`)
console.log(`Web copy   ${webPath}`)
console.log(`           → ${contentUrl}`)

/* ── Test send ───────────────────────────────────────────────────────────── */

if (TEST_EMAIL) {
  if (!transportName()) {
    console.error('\nNo mail transport. Set ZEPTOMAIL_TOKEN in .env.')
    process.exit(1)
  }
  console.log(`\nTest send → ${TEST_EMAIL} (real send, list untouched)…`)
  await sendBatch([message(TEST_EMAIL, `[TEST] ${subject}`)])
  console.log(`Done. Sent to ${TEST_EMAIL}.`)
  process.exit(0)
}

/* ── Campaign ────────────────────────────────────────────────────────────── */

if (!CAMPAIGN) {
  // Reported, never swallowed. A build step that prints "0 sendable" because
  // the query failed looks identical to one that prints it because the list
  // is empty, and those need very different responses.
  try {
    const { sendable, suppressed, invalid } = await audience()
    console.log(
      `\nAudience   ${sendable.length} sendable, ${suppressed.length} suppressed` +
        (invalid.length ? `, ${invalid.length} malformed` : ''),
    )
  } catch (err) {
    console.log(`\nAudience   could not be read — ${err.message}`)
  }
  console.log(`\nBuilt, not sent. Next:`)
  console.log(`  1. open the preview above and read it`)
  console.log(`  2. --test <you@…> for a real inbox check`)
  console.log(`  3. commit and deploy, so ${contentUrl} is live`)
  console.log(`  4. node scripts/sync-campaigns.mjs --run`)
  console.log(`  5. re-run this with --campaign to create the draft\n`)
  process.exit(0)
}

if (!campaignsConfigured()) {
  console.error(
    '\nZoho Campaigns is not configured. Needed in .env (see docs/EMAIL.md):\n' +
      '  ZOHO_CLIENT_ID\n  ZOHO_CLIENT_SECRET\n  ZOHO_REFRESH_TOKEN\n  ZOHO_CAMPAIGNS_LISTKEY\n',
  )
  process.exit(1)
}

/**
 * Campaigns fetches content_url itself and, if the URL 404s, creates the
 * campaign with EMPTY CONTENT rather than reporting a failure. That is a
 * silent way to send a blank newsletter to the whole list, so the URL is
 * checked here first and a missing one is fatal.
 */
console.log(`\nChecking ${contentUrl} is live…`)
const live = await fetch(contentUrl, { redirect: 'follow' }).catch(() => null)
if (!live?.ok) {
  console.error(
    `\n  ${contentUrl}\n  is not reachable (${live ? live.status : 'network error'}).\n\n` +
      `  Campaigns fetches this URL for the campaign body; if it 404s the campaign\n` +
      `  is created empty. Commit public/newsletters/${slug}.html, deploy, then re-run.\n`,
  )
  process.exit(1)
}

const fetched = await live.text()
if (!fetched.includes(CAMPAIGNS_UNSUBSCRIBE_TAG)) {
  console.error(
    `\n  The deployed copy at ${contentUrl} does not contain ${CAMPAIGNS_UNSUBSCRIBE_TAG}.\n` +
      `  It is probably an older deploy. Push the current public/newsletters/${slug}.html first.\n`,
  )
  process.exit(1)
}

const campaignName = `${series}${edition ? ` — ${edition}` : ''} (${slug})`
console.log(`Creating draft campaign "${campaignName}"…`)

const { key, body } = await createCampaign({
  name: campaignName,
  subject,
  fromEmail: FROM.match(/<([^>]+)>/)?.[1] ?? FROM,
  fromName: FROM.match(/^\s*"?([^"<]*?)"?\s*</)?.[1]?.trim() ?? '',
  contentUrl,
})

console.log(`\n${'='.repeat(52)}`)
console.log(`Draft created${key ? `, key ${key}` : ''}.`)
console.log(`Reply-to   ${REPLY_TO}`)
console.log(`\nIt has NOT been sent. Open Zoho Campaigns, check the preview and the`)
console.log(`recipient count, then send it there.`)
if (!key) console.log(`\n(raw response: ${JSON.stringify(body)})`)
console.log()
