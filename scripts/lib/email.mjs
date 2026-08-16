/**
 * Sending, the unsubscribe token, and the HTML shell — shared by
 * scripts/send-newsletter.mjs (run by hand, holds the service role key) and
 * netlify/functions/{subscribe,unsubscribe}.mts (run by Netlify, hold the
 * env vars Netlify was given). Netlify Functions bundle each file
 * independently, so this module is imported by the scripts side only; the
 * two functions carry their own copy of the ~15 lines they need rather than
 * import across the netlify/functions boundary, matching how subscribe.mts
 * and daily-report.mts already duplicate their small helpers instead of
 * sharing a lib.
 *
 * Brand colours lifted from src/styles/global.css's default (light) theme:
 * --tf-ink 22 22 24 (#161618), --tf-surface 255 255 255, plus the gold from
 * tailwind.config.js (#E6B23A / #C9902B).
 *
 * ── WHY THIS FILE LOOKS LIKE 2005 HTML ──────────────────────────────────
 * Everything below is written for Outlook on Windows, which renders mail
 * through Microsoft Word's layout engine rather than a browser one. That
 * engine is the constraint the whole shell is shaped around:
 *
 *   · `font:` SHORTHAND IS DROPPED ENTIRELY. Word only reads font-family,
 *     font-size, font-weight and line-height as separate declarations. The
 *     shorthand this file used to be written in silently fell back to Times
 *     New Roman for every Outlook reader. Longhand only, everywhere.
 *   · rgba() IS NOT SUPPORTED, and a colour it cannot parse becomes black.
 *     The soft grey footer text was rendering as hard black. Hex only, with
 *     an opacity pre-flattened against the ground it sits on.
 *   · max-width IS IGNORED, so a `width:100%` table with `max-width:580px`
 *     goes full-bleed across a maximised window. The `<!--[if mso]>` ghost
 *     table below is the standard fix: a fixed-width table Outlook alone
 *     sees, wrapped around the fluid one everybody else uses.
 *   · display:inline-block IS IGNORED, which collapses padding on a linked
 *     button down to bare underlined text. Buttons are a <table> with the
 *     padding on the <td> instead.
 *
 * Inlined and duplicated per rule rather than shared via <style>, because
 * most inboxes strip <style> blocks or a <head> entirely — Gmail's
 * clipped-image-caching proxy in particular only reliably keeps inline
 * `style=`.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

/** process.env first (what Netlify gives a deployed function); .env as a local fallback. */
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

const PRODUCTION_SITE = 'https://totalfootball.naurra.ai'

/**
 * The origin every link and image in an email is built from.
 *
 * Deliberately NOT a plain read of PUBLIC_SITE_URL. That variable is set to
 * http://localhost:8888 during local development — correct for `netlify dev`,
 * catastrophic in an email, because the recipient's inbox is not your laptop:
 * the masthead logo 404s, every article link is dead, and the unsubscribe URL
 * (which is also the RFC 8058 One-Click endpoint Gmail POSTs to on its own)
 * points at a host that does not exist. Gmail treats a failing One-Click
 * unsubscribe as a deliverability fault against the sending domain, so this
 * is not merely cosmetic.
 *
 * A localhost origin is therefore ignored for mail and the production origin
 * used instead. EMAIL_SITE_URL overrides both, for staging on a real host.
 */
export const SITE = (() => {
  const explicit = envVar('EMAIL_SITE_URL')
  if (explicit) return explicit.replace(/\/$/, '')
  const configured = envVar('PUBLIC_SITE_URL').replace(/\/$/, '')
  if (!configured) return PRODUCTION_SITE
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(configured)) {
    return PRODUCTION_SITE
  }
  return configured
})()

export const FROM = envVar('EMAIL_FROM') || 'Total Football <totalfootball@naurra.ai>'
export const REPLY_TO = envVar('EMAIL_REPLY_TO') || 'totalfootball@naurra.ai'

/**
 * Signed, stateless unsubscribe token: HMAC-SHA256(lowercased email),
 * truncated to 32 hex chars (128 bits — plenty against forgery, short enough
 * for a clean URL). No DB lookup needed to verify one later, so the token
 * scheme survives the subscribers table being read-restricted to service_role.
 */
export function unsubscribeToken(email) {
  const secret = envVar('UNSUBSCRIBE_SECRET')
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is not set')
  return createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('hex').slice(0, 32)
}

export function verifyUnsubscribeToken(email, token) {
  const expected = unsubscribeToken(email)
  const a = Buffer.from(expected)
  const b = Buffer.from(String(token || ''))
  return a.length === b.length && timingSafeEqual(a, b)
}

export function unsubscribeUrl(email) {
  const e = encodeURIComponent(email.trim().toLowerCase())
  const t = unsubscribeToken(email)
  return `${SITE}/api/unsubscribe?e=${e}&t=${t}`
}

/* ── Type ──────────────────────────────────────────────────────────────
 * One stack, repeated rather than shared, because there is nowhere to
 * share it to (see the header on why there is no <style> block). Arial
 * leads for Word's benefit; the system faces ahead of it are what every
 * other client picks up, so Mac and iOS still render in San Francisco.
 */
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/** Ink at opacity, pre-flattened against the surface it sits on (Word cannot do rgba). */
const INK = '#161618'
const INK_SOFT = '#5E5E60' // ~ink/.62 on white
const INK_FAINT = '#8A8A8C' // ~ink/.45 on the #EFEFEC ground
const HAIRLINE = '#E2E2DE' // ~ink/.10 on the ground
const HAIRLINE_ON_WHITE = '#E6E6E4'
const GOLD_DEEP = '#C9902B'
const PAPER = '#EFEFEC'
const SURFACE = '#FFFFFF'

/**
 * Wraps a body of HTML (already-styled <p>/<h2>/etc, written per-email) in the
 * page shell: wordmark, fixed measure, footer with the physical postal address
 * (CAN-SPAM requires it; UK/EU law does not but it costs one line) and the
 * required one-click unsubscribe link.
 *
 * `preheader` is the grey line an inbox shows after the subject. Left unset it
 * does not go blank — the client simply scrapes the first text it finds in the
 * body, which is usually the eyebrow and then half a sentence. It is worth
 * writing: it is the third and last thing that decides whether the mail is
 * opened, after the sender and the subject.
 */
export function wrapEmail({
  preheader = '',
  bodyHtml,
  unsubscribe,
  edition = '',
  hero = null,
  width = 580,
}) {
  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings>
  <o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings></xml></noscript>
<style>
  /* Word resolves the system-font stack to nothing and lands on Times New
     Roman. Forcing Arial here is uglier than the real stack and legible,
     which is the correct trade in the one client that needs it. */
  * { font-family: Arial, Helvetica, sans-serif !important; }
  table { border-collapse: collapse !important; }
</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;width:100%;background-color:${PAPER};-webkit-font-smoothing:antialiased;">

<!-- Preheader. The trailing entities stop Gmail padding the preview line
     with whatever text happens to come next in the body. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${'&#8199;&#65279;&#847; '.repeat(30)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAPER};">
<tr><td align="center" style="padding:40px 16px;">

<!--[if mso]><table role="presentation" width="${width}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:${width}px;margin:0 auto;">

${masthead(edition)}

<tr><td style="background-color:${SURFACE};border-top:3px solid ${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${hero ? heroRow(hero, width) : ''}
    <tr><td style="padding:${hero ? '36px' : '44px'} 40px 44px;
                   font-family:${SANS};font-size:16px;line-height:1.7;font-weight:400;color:${INK};">
${bodyHtml}
    </td></tr>
  </table>
</td></tr>

${footer(unsubscribe)}

</table>
<!--[if mso]></td></tr></table><![endif]-->

</td></tr>
</table>
</body>
</html>`
}

/**
 * The masthead: the site's own header lockup (mark + tracked uppercase
 * wordmark — src/components/Header.astro) plus the wordmark styled like a
 * publication's front page rather than a marketing banner. The mark is a
 * hosted PNG (public/logo.png) rather than the site's inline SVG, because
 * most mail clients (Outlook chief among them) strip <svg> outright; a
 * hosted raster is the one format that renders everywhere.
 *
 * The wordmark carries the alt text, not the image, so a client with images
 * blocked — the default in Outlook and for any first-time sender — still
 * shows the brand as live text rather than an empty box.
 */
const masthead = (edition) => `<tr><td style="padding:0 2px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="left" valign="middle">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:10px;" valign="middle">
          <img src="${SITE}/logo.png" width="30" height="30" alt=""
               style="display:block;width:30px;height:30px;border-radius:50%;border:0;outline:none;text-decoration:none;">
        </td>
        <td valign="middle">
          <a href="${SITE}/" style="font-family:${SANS};font-size:13px;line-height:1;font-weight:800;
                   letter-spacing:.16em;text-transform:uppercase;color:${INK};text-decoration:none;">Total&nbsp;Football</a>
        </td>
      </tr></table>
    </td>
    ${
      edition
        ? `<td align="right" valign="middle" style="font-family:${SANS};font-size:11px;line-height:1;
             font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${INK_FAINT};">${escapeHtml(edition)}</td>`
        : ''
    }
  </tr></table>
</td></tr>`

/**
 * The hero, full-bleed to the card edge. It is a link as well as a picture,
 * because a reader's first instinct on an image that large is to tap it.
 *
 * `width` is set as an ATTRIBUTE as well as in the style: Outlook reads the
 * attribute and ignores `width:100%`, while every other client scales the
 * image down to a narrow viewport off the style. Without both, the hero is
 * either full-size and clipped in Outlook or unscaled on a phone.
 *
 * The alt text is written to carry the picture's meaning on its own, because
 * images are blocked by default for any sender an inbox has not seen before —
 * which, for a newsletter, is most of the first send.
 */
const heroRow = (hero, width) => `<tr><td style="font-size:0;line-height:0;">
      <a href="${hero.href || `${SITE}/`}" style="display:block;text-decoration:none;">
        <img src="${hero.src}" width="${width}" alt="${escapeHtml(hero.alt || '')}"
             style="display:block;width:100%;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;">
      </a>
    </td></tr>`

const footer = (unsubscribe) => `<tr><td style="padding:24px 4px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="border-top:1px solid ${HAIRLINE};padding-top:20px;
               font-family:${SANS};font-size:12px;line-height:1.7;font-weight:400;
               color:${INK_FAINT};text-align:center;">
      NAURRA AI LTD &middot; 10 Kyriakou Matsi, Liliana Court, 4th Floor, Nicosia 1082, Cyprus<br>
      You are receiving this because you subscribed at totalfootball.naurra.ai.<br>
      <a href="${unsubscribe}" style="color:${INK_FAINT};text-decoration:underline;">Unsubscribe</a>
      &nbsp;&middot;&nbsp;
      <a href="${SITE}/privacy/" style="color:${INK_FAINT};text-decoration:underline;">Privacy</a>
    </td>
  </tr></table>
</td></tr>`

/* ── The welcome automation ────────────────────────────────────────────
 *
 * Lives here rather than inside netlify/functions/subscribe.mts, which is
 * where it used to be and which is where it went stale. The welcome is the
 * single most-opened message this list will ever send — it arrives seconds
 * after somebody chose to hear from you — and it was the one email nobody was
 * looking at, because it is only ever seen by people who have just signed up
 * and never by the person who wrote it. Sharing the shell with the newsletter
 * is what stops the first email a subscriber sees looking like a different
 * company from the second.
 */

const P = `margin:0 0 18px;font-family:${SANS};font-size:16px;line-height:1.7;font-weight:400;color:${INK};`
const KICKER = `margin:0 0 10px;font-family:${SANS};font-size:11px;line-height:1;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${GOLD_DEEP};`
const H1 = `margin:0 0 18px;font-family:${SANS};font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-.02em;color:${INK};`

/** A dark button. Padding on the <td>, because Outlook drops it off an <a>. */
const cta = (href, label) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;"><tr>
    <td align="center" bgcolor="${INK}" style="background-color:${INK};">
      <a href="${href}" style="display:block;padding:15px 28px;font-family:${SANS};font-size:15px;
         line-height:1;font-weight:700;color:#F4F4F2;text-decoration:none;">${label}</a>
    </td>
  </tr></table>`

/** A labelled row in the "what happens now" list. */
const row = (label, text, last = false) =>
  `<tr><td style="padding:14px 0;${last ? '' : `border-bottom:1px solid ${HAIRLINE_ON_WHITE};`}">
    <div style="font-family:${SANS};font-size:11px;line-height:1;font-weight:700;letter-spacing:.1em;
                text-transform:uppercase;color:${GOLD_DEEP};padding-bottom:7px;">${label}</div>
    <div style="font-family:${SANS};font-size:15px;line-height:1.6;font-weight:400;color:${INK};">${text}</div>
  </td></tr>`

/**
 * The message sent the moment somebody joins. `source` decides which of the
 * two it is: the course forms are a held place at a fixed price and have to
 * confirm that specifically, because it is a commitment; everything else is
 * the newsletter.
 *
 * Returns the whole message rather than just HTML, so the subject line cannot
 * drift away from the body it belongs to.
 *
 * Typed for the benefit of netlify/functions/subscribe.mts, which is
 * TypeScript and checked by `astro check` in the build. Without the
 * annotation the defaults below narrow `name` to exactly `null`, and the
 * function's one real caller fails to compile.
 *
 * @param {object} opts
 * @param {string} opts.email
 * @param {string} [opts.source]      the form the signup came from
 * @param {string | null} [opts.name] collected by the course form only
 * @param {string} [opts.unsubscribe] defaults to this address's signed link
 * @returns {{ to: string, subject: string, html: string, text: string, unsubscribeUrl: string }}
 */
export function welcomeEmail({ email, source = '', name = null, unsubscribe }) {
  const isCourse = source === 'course-early-access' || source === 'course-waitlist'
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,'
  const unsub = unsubscribe || unsubscribeUrl(email)

  const bodyHtml = isCourse
    ? `<p style="${KICKER}">Early access confirmed</p>
<h1 style="${H1}">Your place is held at &euro;39.</h1>
<p style="${P}">${greeting}</p>
<p style="${P}">
  You are on the early-access list for the course, and the price is locked. When it opens you hear
  before it is public, and &euro;39/month is what you pay for as long as you stay subscribed &mdash;
  it does not move when the public price does.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;border-top:2px solid ${INK};">
${row('What you get', 'Two skills — AI motion graphics, and the agentic automation that produces it without anybody opening a file. Then the three systems that turn either one into money.')}
${row('What happens next', 'Nothing you need to do. You get the opening date by email before anyone else, at the price above.')}
${row('In the meantime', 'The breakdowns keep coming. Same board, same method, every one of them free.', true)}
</table>
${cta(`${SITE}/library/`, 'Start with the library &nbsp;&rarr;')}
<p style="${P}margin:30px 0 0;font-size:15px;color:${INK_SOFT};">
  Reply to this if you have a question about the course. A real person reads it.<br>&mdash; Thanos
</p>`
    : `<p style="${KICKER}">You're on the list</p>
<h1 style="${H1}">Welcome to Total Football.</h1>
<p style="${P}">${greeting}</p>
<p style="${P}">
  One tactical idea at a time, drawn on the board and explained in the order a coach would actually
  teach it. It lands when there is something worth sending, not on a schedule for its own sake.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;border-top:2px solid ${INK};">
${row('What arrives', 'A breakdown of one system — what it is for, the phases it moves through, and the moment it is decided.')}
${row('How often', 'When there is one worth sending. No filler, and never twice in a day.')}
${row('Start here', `Eleven breakdowns are already on the site, phase by phase, free to read.`, true)}
</table>
${cta(`${SITE}/library/`, 'Read the library &nbsp;&rarr;')}
<p style="${P}margin:30px 0 0;font-size:15px;color:${INK_SOFT};">
  Reply any time. A real person reads it.<br>&mdash; Thanos
</p>`

  return {
    to: email,
    subject: isCourse ? 'Your early-access place is held' : 'Welcome to Total Football',
    html: wrapEmail({
      preheader: isCourse
        ? 'Locked at €39/month for life. Here is what happens next.'
        : 'One idea at a time, drawn on the board. Here is where to start.',
      bodyHtml,
      unsubscribe: unsub,
    }),
    text: htmlToText(bodyHtml, { unsubscribe: unsub }),
    unsubscribeUrl: unsub,
  }
}

/**
 * The content files are hand-written HTML, which means the Outlook rules in
 * this file's header are only as good as whoever remembers them at 11pm on a
 * Saturday. These are the three that fail SILENTLY — the mail looks perfect in
 * Gmail, in the preview, and on a phone, and is broken only for the readers
 * you cannot see. Worth a check that costs nothing.
 *
 * Warnings, not errors: a deliberate exception is legitimate, and a linter
 * that blocks a send at the moment of sending is a linter people delete.
 */
export function lintEmailHtml(html) {
  const warnings = []
  const count = (re) => (html.match(re) || []).length

  const shorthand = count(/style="[^"]*(?:^|;|\s)font:\s/g)
  if (shorthand) {
    warnings.push(
      `${shorthand}x  \`font:\` shorthand — Outlook drops it and falls back to Times New Roman.\n` +
        `      Use font-family / font-size / line-height / font-weight separately.`,
    )
  }

  const rgba = count(/rgba\(/g)
  if (rgba) {
    warnings.push(
      `${rgba}x  rgba() — Outlook cannot parse it and renders the text pure black.\n` +
        `      Use a hex colour with the opacity already flattened against its background.`,
    )
  }

  const inlineBlock = count(/<a\b[^>]*display:\s*inline-block/g)
  if (inlineBlock) {
    warnings.push(
      `${inlineBlock}x  display:inline-block on an <a> — Outlook ignores it and drops the padding,\n` +
        `      leaving underlined text with no button. Put the padding on a <td> instead.`,
    )
  }

  for (const [, url] of html.matchAll(/<img\b[^>]*src="(http:\/\/[^"]+)"/g)) {
    warnings.push(`http image will be blocked or downgraded: ${url}`)
  }

  return warnings
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}

/**
 * A text/plain alternative, derived from the HTML body so the two can never
 * drift apart the way a hand-written second copy would.
 *
 * Worth the ~40 lines: an HTML-only message is one of the strongest single
 * spam signals a filter looks at, because almost nothing legitimate and
 * almost everything bulk is sent that way. It is also what gets read by
 * screen readers, watch notifications and anyone on a plain-text client.
 *
 * Links are rendered as "label <url>" rather than dropped, so the call to
 * action still exists for a reader who never sees the HTML part.
 */
export function htmlToText(bodyHtml, { unsubscribe } = {}) {
  // Anchor targets are parked on sentinels first. Written straight in as
  // "<https://…>" they would be eaten by the tag-strip a few lines down, which
  // cannot tell a URL in angle brackets from an element — and a plain-text part
  // whose every link has silently vanished is worse than none at all.
  const OPEN = '\u0000'
  const CLOSE = '\u0001'

  let t = bodyHtml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    // Keep the label, append the target unless the label already is the target.
    .replace(/<a\b[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const clean = label.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      return clean && clean !== href ? `${clean} ${OPEN}${href}${CLOSE}` : `${OPEN}${href}${CLOSE}`
    })
    .replace(/<br\s*\/?>/gi, '\n')
    // A horizontal rule in this design is a table cell with a border and no
    // content. Matching only the EMPTY ones matters: the byline and the stat
    // block are also border-topped cells, and a greedier pattern swallows them
    // and everything they contain.
    .replace(/<td\b[^>]*border-top[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/td>/gi, '\n\n----------\n\n')
    .replace(/<li\b[^>]*>/gi, '  - ')
    .replace(/<\/(p|h1|h2|h3|h4|div|tr|li|table)>/gi, '\n\n')
    .replace(/<\/td>/gi, '\n')
    .replace(/<[^>]+>/g, '')

  t = decodeEntities(t)
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(new RegExp(`${OPEN}(.*?)${CLOSE}`, 'g'), '<$1>')
    .trim()

  const foot = [
    '',
    '----------',
    'NAURRA AI LTD, 10 Kyriakou Matsi, Liliana Court, 4th Floor, Nicosia 1082, Cyprus',
    'You are receiving this because you subscribed at totalfootball.naurra.ai.',
    unsubscribe ? `Unsubscribe: ${unsubscribe}` : '',
    `Privacy: ${SITE}/privacy/`,
  ]
    .filter(Boolean)
    .join('\n')

  return `${t}\n${foot}\n`
}

function decodeEntities(s) {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', bull: '•',
    mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
    rarr: '→', larr: '←', euro: '€', pound: '£', deg: '°', times: '×', copy: '©',
    eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', uuml: 'ü', ouml: 'ö', auml: 'ä',
  }
  return s
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m)
}

/* ── Transport ─────────────────────────────────────────────────────────
 *
 * Two ways out, picked by which credential is present:
 *
 *   ZOHO — SMTP through the mailbox the domain already sends from. naurra.ai
 *   publishes `v=spf1 include:zohomail.eu` and a `zmail._domainkey` DKIM
 *   record, so mail leaving this way is SPF- and DKIM-aligned and passes
 *   DMARC on day one with no DNS work at all. The ceiling is Zoho's own
 *   sending limit (order of hundreds a day), which is above the current list
 *   and below where a newsletter eventually goes.
 *
 *   RESEND — the HTTP API. Built for bulk, reports opens and bounces, and
 *   batches up to 100 recipients per call. Needs its own DKIM records on a
 *   sending subdomain before it will send anything.
 *
 * Resend wins when both are set, because if somebody has gone to the trouble
 * of verifying a domain there, that is the one they meant to use. Neither set
 * is a hard error rather than a silent no-op: a send that quietly does
 * nothing is the worst possible outcome for a script whose entire job is to
 * have sent something.
 */
export function transportName() {
  if (envVar('RESEND_API_KEY')) return 'resend'
  if (envVar('ZOHO_SMTP_PASS')) return 'zoho'
  return null
}

/**
 * Send a batch. Each item is { to, subject, html, text, unsubscribeUrl } and
 * needs its own body, because the unsubscribe link is per-recipient.
 *
 * Every message carries List-Unsubscribe and List-Unsubscribe-Post (RFC 8058).
 * Gmail and Yahoo have required one-click unsubscribe on bulk mail since
 * February 2024 — without it, mail to those providers can be rejected outright
 * rather than merely spam-foldered. The mailto: form is listed alongside the
 * URL because a few clients only honour that one.
 */
export async function sendBatch(items) {
  const via = transportName()
  if (!via) {
    throw new Error(
      'No mail transport configured. Set ZOHO_SMTP_PASS (Zoho app password) or RESEND_API_KEY in .env.',
    )
  }
  return via === 'resend' ? sendViaResend(items) : sendViaZoho(items)
}

const listHeaders = (unsubscribeUrl) => ({
  'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:${REPLY_TO}?subject=unsubscribe>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
})

async function sendViaResend(items) {
  const key = envVar('RESEND_API_KEY')
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(
      items.map(({ to, subject, html, text, unsubscribeUrl }) => ({
        from: FROM,
        reply_to: REPLY_TO,
        to,
        subject,
        html,
        text,
        headers: listHeaders(unsubscribeUrl),
      })),
    ),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`resend ${res.status}: ${JSON.stringify(body)}`)
  return body
}

/**
 * Zoho SMTP. One connection is opened and reused for the whole batch (the
 * `pool` option) rather than reconnecting per recipient, because Zoho counts
 * connections as well as messages and will start refusing them.
 *
 * `rateDelta`/`rateLimit` throttle to ~10 messages a second. Zoho does not
 * publish an exact per-second ceiling and disconnects rather than queueing
 * when it is crossed, so this sits well under any plausible one.
 */
async function sendViaZoho(items) {
  const { default: nodemailer } = await import('nodemailer')

  const host = envVar('ZOHO_SMTP_HOST') || 'smtp.zoho.eu'
  const user = envVar('ZOHO_SMTP_USER') || addressOf(FROM)
  const pass = envVar('ZOHO_SMTP_PASS')

  const transporter = nodemailer.createTransport({
    host,
    port: 465,
    secure: true,
    auth: { user, pass },
    pool: true,
    maxConnections: 1,
    rateDelta: 1000,
    rateLimit: 10,
  })

  try {
    const results = []
    for (const { to, subject, html, text, unsubscribeUrl } of items) {
      results.push(
        await transporter.sendMail({
          from: FROM,
          sender: user, // envelope-from; must be the authenticated mailbox
          replyTo: REPLY_TO,
          to,
          subject,
          html,
          text,
          headers: listHeaders(unsubscribeUrl),
        }),
      )
    }
    return { data: results.map((r) => ({ id: r.messageId })) }
  } finally {
    transporter.close()
  }
}

/** "Total Football <x@y.z>" -> "x@y.z"; a bare address passes through. */
function addressOf(from) {
  return from.match(/<([^>]+)>/)?.[1] ?? from.trim()
}
