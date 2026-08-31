/**
 * Sending, the unsubscribe token, the message templates and the HTML shell.
 *
 * Imported by scripts/send-{newsletter,welcome}.mjs, which run by hand and
 * hold the service role key, AND by netlify/functions/subscribe.mts, which
 * runs on Netlify with whatever env vars Netlify was given. That second one
 * crosses the netlify/functions boundary on purpose, against the convention
 * elsewhere in that directory of duplicating small helpers rather than
 * sharing a lib. The convention is right for fifteen lines of HMAC and wrong
 * for an entire email: the welcome used to be built inside subscribe.mts, and
 * because it is seen only by people who have just subscribed and never by the
 * person who wrote it, the copy quietly drifted until the first mail a
 * subscriber received looked like a different company from the second.
 * Netlify's bundler follows relative imports anywhere in the repo, so the
 * only cost is that this file must stay safe to import in a Lambda — hence
 * the .env read below being wrapped in a try/catch that falls back to
 * process.env rather than assuming a filesystem.
 *
 * netlify/functions/unsubscribe.mts still carries its own copy of the token
 * check, because it only VERIFIES and must keep working even if this module
 * is broken or absent.
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
export const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/** Ink at opacity, pre-flattened against the surface it sits on (Word cannot do rgba). */
const INK = '#F5F9F3'
export const INK_SOFT = '#B9D0C0' // broadcast ink at paragraph opacity, flattened
const INK_FAINT = '#8FB39A' // broadcast ink at footer opacity, flattened
const HAIRLINE_ON_WHITE = '#4D8C62'
const PAPER = '#15512D' // broadcast run-off green
const SURFACE = '#20683C' // broadcast turf panel
const PITCH_LINE = '#F5F9F3'
const GOLD = '#F2C55E'
const ON_INK = '#14472A'

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
  reason = 'You are receiving this because you subscribed at totalfootball.naurra.ai.',
  edition = '',
  series = 'Tactical Dispatch',
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
<body style="margin:0;padding:0;width:100%;background-color:${PAPER};background-image:repeating-linear-gradient(90deg,${PAPER} 0 108px,#104324 108px 216px);-webkit-font-smoothing:antialiased;">

<!-- Preheader. The trailing entities stop Gmail padding the preview line
     with whatever text happens to come next in the body. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${'&nbsp;&zwnj;'.repeat(100)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAPER};background-image:repeating-linear-gradient(90deg,${PAPER} 0 108px,#104324 108px 216px);">
<tr><td align="center" style="padding:32px 16px 44px;">

<!--[if mso]><table role="presentation" width="${width}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:${width}px;margin:0 auto;">

${masthead(edition, series)}

<tr><td style="background-color:${SURFACE};border-top:6px solid ${PITCH_LINE};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${hero ? heroRow(hero, width) : ''}
    <tr><td style="padding:${hero ? '38px' : '44px'} 40px 46px;
                   font-family:${SANS};font-size:16px;line-height:1.7;font-weight:400;color:${INK};">
${bodyHtml}
    </td></tr>
  </table>
</td></tr>

${footer(unsubscribe, reason)}

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
const masthead = (edition, series) => `<tr><td style="padding:0 2px 18px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="left" valign="middle">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:10px;" valign="middle">
          <img src="${SITE}/logo.png" width="30" height="30" alt=""
               style="display:block;width:30px;height:30px;border-radius:50%;border:0;outline:none;text-decoration:none;">
        </td>
        <td valign="middle">
          <a href="${SITE}/" style="font-family:${SANS};font-size:12px;line-height:1;font-weight:800;
                   letter-spacing:.17em;text-transform:uppercase;color:${INK};text-decoration:none;">Total&nbsp;Football</a>
        </td>
      </tr></table>
    </td>
    <td align="right" valign="middle" style="font-family:${SANS};font-size:10px;line-height:1.2;
         font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:${INK_FAINT};">${escapeHtml(series)}${edition ? `<br><span style="color:${GOLD};">${escapeHtml(edition)}</span>` : ''}</td>
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

/**
 * The footer. `unsubscribe` is OPTIONAL and omitting it drops the link, which
 * is required rather than tidy: a signup confirmation or a password reset is
 * mail the recipient asked for by acting, it has no list to leave, and an
 * unsubscribe link on one is either a dead end or a way to lock somebody out
 * of their own account. Every BULK message must still pass one.
 */
const footer = (unsubscribe, reason) => `<tr><td style="padding:22px 4px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="border-top:1px solid ${HAIRLINE_ON_WHITE};padding-top:20px;
               font-family:${SANS};font-size:12px;line-height:1.7;font-weight:400;
               color:${INK_FAINT};text-align:center;">
      NAURRA AI LTD &middot; 10 Kyriakou Matsi, Liliana Court, 4th Floor, Nicosia 1082, Cyprus<br>
      ${escapeHtml(reason)}<br>
      ${unsubscribe ? `<a href="${unsubscribe}" style="color:${INK_FAINT};text-decoration:underline;">Unsubscribe</a>
      &nbsp;&middot;&nbsp;` : ''}<a href="${SITE}/privacy/" style="color:${INK_FAINT};text-decoration:underline;">Privacy</a>
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

export const P = `margin:0 0 19px;font-family:${SANS};font-size:16px;line-height:1.7;font-weight:400;color:${INK};`
export const KICKER = `margin:0 0 12px;font-family:${SANS};font-size:11px;line-height:1;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7CF2B0;`
export const H1 = `margin:0 0 18px;font-family:${SANS};font-size:31px;line-height:1.12;font-weight:800;letter-spacing:-.025em;color:${INK};`

/** A dark button. Padding on the <td>, because Outlook drops it off an <a>. */
export const cta = (href, label) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;"><tr>
    <td align="center" bgcolor="${INK}" style="background-color:${INK};">
      <a href="${href}" style="display:block;padding:15px 28px;font-family:${SANS};font-size:15px;
         line-height:1;font-weight:700;color:${ON_INK};text-decoration:none;">${label}</a>
    </td>
  </tr></table>`

/** A numbered, left-aligned rule: the email equivalent of a board annotation. */
const rule = (number, title, text, last = false) =>
  `<tr><td width="38" valign="top" style="width:38px;padding:15px 0;${last ? '' : `border-bottom:1px solid ${HAIRLINE_ON_WHITE};`}
          font-family:${SANS};font-size:12px;line-height:1;font-weight:800;letter-spacing:.05em;color:#7CF2B0;">${number}</td>
    <td valign="top" style="padding:13px 0 15px;${last ? '' : `border-bottom:1px solid ${HAIRLINE_ON_WHITE};`}">
      <div style="margin:0 0 4px;font-family:${SANS};font-size:16px;line-height:1.3;font-weight:800;color:${INK};">${title}</div>
      <div style="font-family:${SANS};font-size:15px;line-height:1.55;font-weight:400;color:${INK_SOFT};">${text}</div>
    </td></tr>`

const ruledList = (rows) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:25px 0 6px;border-top:2px solid ${PITCH_LINE};">${rows}</table>`

/** A compact set of doors into the site, written as links rather than marketing cards. */
const linkRow = (number, title, text, href, last = false) =>
  '<tr>' +
  '<td width="38" valign="top" style="width:38px;padding:15px 0;' +
  (last ? '' : 'border-bottom:1px solid ' + HAIRLINE_ON_WHITE + ';') +
  'font-family:' + SANS + ';font-size:12px;line-height:1;font-weight:800;letter-spacing:.05em;color:#7CF2B0;">' +
  number +
  '</td>' +
  '<td valign="top" style="padding:13px 0 15px;' +
  (last ? '' : 'border-bottom:1px solid ' + HAIRLINE_ON_WHITE + ';') +
  '">' +
  '<a href="' + href + '" style="font-family:' + SANS + ';font-size:16px;line-height:1.3;font-weight:800;color:' +
  INK +
  ';text-decoration:underline;text-underline-offset:3px;">' +
  title +
  ' &nbsp;&rarr;</a>' +
  '<div style="margin-top:4px;font-family:' +
  SANS +
  ';font-size:15px;line-height:1.55;font-weight:400;color:' +
  INK_SOFT +
  ';">' +
  text +
  '</div></td></tr>'

const linkList = (rows, label = 'Start here') =>
  '<p style="' +
  KICKER +
  '">' +
  label +
  '</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:19px 0 6px;border-top:2px solid ' +
  PITCH_LINE +
  ';">' +
  rows +
  '</table>'

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
 * @param {string} [opts.reason]      plain-language reason shown in the footer
 * @returns {{ to: string, subject: string, html: string, text: string, unsubscribeUrl: string }}
 */
export function welcomeEmail({
  email,
  source = '',
  name = null,
  unsubscribe,
  reason = 'You are receiving this because you subscribed at totalfootball.naurra.ai.',
}) {
  const isCourse = source === 'course-early-access' || source === 'course-waitlist'
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,'
  const unsub = unsubscribe || unsubscribeUrl(email)

  const bodyHtml = isCourse
    ? `<p style="${KICKER}">Course / early access</p>
<h1 style="${H1}">Your price is held.<br>The work starts here.</h1>
<p style="${P}">${greeting}</p>
<p style="${P}">
  You are on the early-access list. When the course opens, the team will write to you before it is public.
  Your place stays at <strong style="font-weight:700;">&euro;39/month</strong> for as long as you remain subscribed.
</p>
${ruledList(
  rule('01', 'Make the picture move.', 'Build the kind of football motion graphics Total Football is made from.') +
    rule('02', 'Build the system behind it.', 'Use agents and automations to turn the repeatable work into a workflow.') +
    rule('03', 'Turn the skill into an offer.', 'Package the work for an audience, clients, or products of your own.', true),
)}
${linkList(
  linkRow('01', 'Read the library', 'See the kind of tactical systems the board is built to explain.', SITE + '/library/') +
    linkRow('02', 'Open the Studio', 'Build your own pitch, phases, and shareable presentation.', SITE + '/studio/') +
    linkRow('03', 'See the method', 'Understand why every frame is drawn and what stays outside a camera view.', SITE + '/about/') +
    linkRow('04', 'Read the course outline', 'The full path from motion graphics to automation and the systems around it.', SITE + '/course/', true),
  'While the course is being built',
)}
${cta(SITE + '/course/', 'See the course &nbsp;&rarr;')}
<p style="${P}margin:30px 0 0;font-size:15px;color:${INK_SOFT};">
  Questions are welcome. The Total Football team reads every reply.
</p>`
    : `<p style="${KICKER}">Welcome to Total Football</p>
<h1 style="${H1}">See the whole<br>shape.</h1>
<p style="${P}">${greeting}</p>
<p style="${P}">
  Total Football is a board for seeing what the camera leaves out: the shape, the trigger, and the
  decision that changes the phase. Every system is drawn from scratch, so the whole pitch stays in view.
</p>
${linkList(
  linkRow('01', 'Read the library', 'Tactical systems, broken down phase by phase.', SITE + '/library/') +
    linkRow('02', 'Build in the Studio', 'Set a pitch, move the players, and share the board you made.', SITE + '/studio/') +
    linkRow('03', 'See the method', 'Why it is drawn rather than filmed, and what that makes visible.', SITE + '/about/') +
    linkRow('04', 'Follow the intelligence', 'A separate daily model for the match and the market.', SITE + '/intelligence/', true),
)}
${cta(SITE + '/library/', 'Start with the library &nbsp;&rarr;')}
<p style="${P}margin:30px 0 0;font-size:15px;color:${INK_SOFT};">
  The board is the product. The library is where you start.
</p>`

  return {
    to: email,
    subject: isCourse ? 'Your early-access place is held' : 'Welcome to Total Football — see the whole shape',
    html: wrapEmail({
      preheader: isCourse
        ? 'Your €39/month founding rate is held. Here is where Total Football begins.'
        : 'A drawn board, a library of systems, and a studio to build your own.',
      bodyHtml,
      unsubscribe: unsub,
      reason,
      series: isCourse ? 'Course / Early Access' : 'Welcome to the Board',
    }),
    text: htmlToText(bodyHtml, { unsubscribe: unsub }),
    unsubscribeUrl: unsub,
  }
}

/**
 * The message sent the moment a Studio account is confirmed.
 *
 * Deliberately separate from welcomeEmail(): the audience is different (a
 * coach who already knows about the Studio, not a first-time subscriber), the
 * tone is different (confirmation and orientation, not discovery), and the
 * call to action is different (the portal, not the library). Sharing the
 * function would force whichever copy was first to pretend to be both.
 *
 * Fired by netlify/functions/studio-welcome.mts via a Supabase Database
 * Webhook, never by the client.
 *
 * @param {object} opts
 * @param {string} opts.email
 * @param {string | null} [opts.name]        from raw_user_meta_data on the auth row
 * @param {string} [opts.unsubscribe]        defaults to this address's signed link
 * @param {string} [opts.reason]             plain-language reason in the footer
 * @returns {{ to: string, subject: string, html: string, text: string, unsubscribeUrl: string }}
 */
export function studioWelcomeEmail({
  email,
  name = null,
  unsubscribe,
  reason = 'You are receiving this because you created a Total Football Studio account.',
}) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,'
  const unsub = unsubscribe || unsubscribeUrl(email)

  const bodyHtml =
    `<p style="${KICKER}">Total Football Studio</p>` +
    `<h1 style="${H1}">Your account<br>is live.</h1>` +
    `<p style="${P}">${greeting}</p>` +
    `<p style="${P}">` +
    `You are in. Your systems are saved to the cloud, and the Studio is waiting on any machine you coach from.` +
    `</p>` +
    ruledList(
      rule(
        '01',
        'Every session saved.',
        'Build a system, close the tab. It is there the next time you open the Studio, on any device.',
      ) +
        rule(
          '02',
          'Share any board.',
          'One link puts the full system on any screen \u2014 no login, no app, no friction for whoever you share it with.',
        ) +
        rule(
          '03',
          'The board, wherever you coach.',
          'Your portal lives at totalfootball.naurra.ai/studio/portal/ \u2014 bookmark it on every machine.',
          true,
        ),
    ) +
    linkList(
      linkRow('01', 'Open the Studio portal', 'All your saved systems, in one place.', SITE + '/studio/portal/') +
        linkRow(
          '02',
          'Read the library',
          'The kind of tactical systems the board is built to explain.',
          SITE + '/library/',
        ) +
        linkRow(
          '03',
          'See the method',
          'Why it is drawn rather than filmed, and what that makes visible.',
          SITE + '/about/',
          true,
        ),
      'Start here',
    ) +
    cta(SITE + '/studio/portal/', 'Open the Studio\u00a0\u00a0\u2192') +
    `<p style="${P}margin:30px 0 0;font-size:14px;color:${INK_SOFT};">` +
    `You will also receive the Tactical Dispatch \u2014 our breakdown of football systems, ` +
    `sent when there is something worth saying. Unsubscribe at any time using the link below.` +
    `</p>`

  return {
    to: email,
    subject: 'Your Total Football Studio is ready',
    html: wrapEmail({
      preheader: 'Save your systems, build from any device, share the board.',
      bodyHtml,
      unsubscribe: unsub,
      reason,
      series: 'Studio Account',
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
 * THIS MODULE SENDS PRODUCT MAIL ONLY — the welcome, and anything else that
 * goes to one person because of something they just did. Newsletters do NOT
 * come through here any more; they are broadcast by Zoho Campaigns, which
 * owns its own sending infrastructure, its own throttling and its own
 * open/click reporting. See scripts/lib/campaigns.mjs and docs/EMAIL.md.
 *
 * That division is not a preference, it is ZeptoMail's terms of service:
 * ZeptoMail is a transactional-only relay and bulk newsletters through it are
 * grounds for the account being closed. Keeping the two apart is also what
 * keeps a newsletter complaint from poisoning the reputation of the pipe that
 * carries password resets.
 *
 * Two ways out, picked by which credential is present:
 *
 *   ZEPTOMAIL — Zoho's transactional HTTP API. Batches up to 500 recipients
 *   per call, reports bounces, and is the intended destination for everything
 *   in this file. Needs its own DKIM record (`zeptomail._domainkey`) and a
 *   verified sender before it will accept anything.
 *
 *   ZOHO SMTP — the mailbox the domain already sends from, kept as a
 *   fallback so a ZeptoMail outage or an unconfigured laptop does not mean no
 *   mail at all. naurra.ai already publishes `v=spf1 include:zohomail.eu` and
 *   a `zmail._domainkey` DKIM record, so this path is SPF- and DKIM-aligned
 *   with no DNS work. Its ceiling is Zoho Mail's own limit, on the order of
 *   hundreds a day, and it is rate-limited by hand below.
 *
 * ZeptoMail wins when both are set. Neither set is a hard error rather than a
 * silent no-op: a send that quietly does nothing is the worst possible
 * outcome for a script whose entire job is to have sent something.
 */
export function transportName() {
  if (envVar('ZEPTOMAIL_TOKEN')) return 'zeptomail'
  if (envVar('ZOHO_SMTP_PASS')) return 'zoho'
  return null
}

/**
 * ZeptoMail's regional API hosts. The account decides which one answers: a
 * token minted in the EU data centre is rejected by the .com host with a
 * misleading 401, which reads as a bad key and sends you looking in the wrong
 * place for an hour.
 *
 * naurra.ai is an EU-data-centre Zoho account throughout — the mailbox is on
 * smtp.zoho.eu, SPF includes zohomail.eu, and domain verification came back
 * as zmverify.zoho.eu — so `eu` is the default here rather than `com`.
 */
const ZEPTO_HOSTS = {
  eu: 'https://api.zeptomail.eu',
  com: 'https://api.zeptomail.com',
  in: 'https://api.zeptomail.in',
  au: 'https://api.zeptomail.com.au',
  ca: 'https://api.zeptomail.ca',
  jp: 'https://api.zeptomail.jp',
  sa: 'https://api.zeptomail.sa',
}

function zeptoBase() {
  const explicit = envVar('ZEPTOMAIL_API_URL')
  if (explicit) return explicit.replace(/\/$/, '')
  const region = (envVar('ZEPTOMAIL_REGION') || 'eu').toLowerCase()
  return ZEPTO_HOSTS[region] || ZEPTO_HOSTS.eu
}

/**
 * The send token, with the scheme prefix stripped if it came along for the
 * ride.
 *
 * ZeptoMail's console displays the credential as `Zoho-enczapikey xxxxx` and
 * its copy button hands you that whole string, prefix included. The
 * Authorization header this code builds adds the prefix itself, so pasting
 * what the console gives you produces
 * `Zoho-enczapikey Zoho-enczapikey xxxxx` and a 401 — which reads as a bad
 * token and sends you to regenerate a perfectly good one.
 *
 * Accepting both forms costs one regex and removes an entire category of
 * wasted evening. Surrounding quotes go too, since .env files attract them.
 */
function zeptoToken() {
  return envVar('ZEPTOMAIL_TOKEN')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^Zoho-enczapikey\s+/i, '')
    .trim()
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
/**
 * How many messages the SMTP FALLBACK may send in one process before it
 * refuses. ZeptoMail is not subject to this — it is a bulk relay and that is
 * its job.
 *
 * This exists because it already happened. On 2026-08-22 Zoho blocked
 * outgoing mail on athanasios@naurra.ai for exceeding the allowed rate, and
 * the block notice itself said: "If you're sending transactional/notification
 * emails like welcome emails... please use ZeptoMail." A mailbox is not a
 * sender, and the failure mode is not a clean rejection of message 251 — it
 * is the whole account being suspended, which takes normal correspondence
 * down with it.
 *
 * 20 is chosen to be comfortably below any plausible per-hour ceiling while
 * still allowing a handful of real test sends. Raise it only by setting the
 * transport to ZeptoMail, which is the actual fix.
 */
const SMTP_FALLBACK_CAP = Number(envVar('ZOHO_SMTP_MAX_PER_RUN') || 20)

/** Cumulative for the life of the process, because callers chunk their sends. */
let smtpSentThisRun = 0

export async function sendBatch(items) {
  const via = transportName()
  if (!via) {
    throw new Error(
      'No mail transport configured. Set ZEPTOMAIL_TOKEN (preferred) or ZOHO_SMTP_PASS in .env.',
    )
  }

  if (via === 'zeptomail') return sendViaZeptoMail(items)

  // Counted across calls, not per call: send-welcome-all chunks by 50, so a
  // per-call check would wave through an unbounded total.
  if (smtpSentThisRun + items.length > SMTP_FALLBACK_CAP) {
    throw new Error(
      `Refusing to send ${items.length} message(s) over the Zoho Mail SMTP fallback ` +
        `(${smtpSentThisRun} already sent this run, cap ${SMTP_FALLBACK_CAP}).\n\n` +
        `  Zoho Mail is a MAILBOX, not a sender. Exceeding its rate does not bounce\n` +
        `  one message — it suspends outgoing mail on the whole account, which is\n` +
        `  what happened on 2026-08-22.\n\n` +
        `  Set ZEPTOMAIL_TOKEN in .env and re-run. See docs/EMAIL.md §3.`,
    )
  }

  const result = await sendViaZoho(items)
  smtpSentThisRun += items.length
  return result
}

const listHeaders = (unsubscribeUrl) => ({
  'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:${REPLY_TO}?subject=unsubscribe>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
})

/**
 * ZeptoMail, one HTTP call per recipient.
 *
 * NOT the /v1.1/email/batch endpoint, though it exists and takes 500
 * addresses, and the reason is worth stating because "just use batch, it is
 * faster" is the obvious review comment:
 *
 * A batch call carries ONE `mime_headers` object for the whole batch, and
 * every message here has to carry its own `List-Unsubscribe` — the URL is
 * HMAC-signed per address (see unsubscribeUrl above). Batching would mean
 * every recipient getting the first recipient's unsubscribe link, so clicking
 * it would opt out a stranger and leave the clicker still subscribed. The
 * body has the same problem: the footer link is per-address too, and
 * `merge_info` cannot reach into a header.
 *
 * This module sends product mail, where a "batch" is usually one message, so
 * the cost of being correct here is nil. Bulk goes through Campaigns.
 *
 * Sent with a small concurrency window rather than a flat loop, so a
 * re-welcome run of a few hundred is not a few hundred serial round trips,
 * and rejections are collected instead of aborting on the first one — a
 * single bad address must not stop the other 79 from being sent.
 */
async function sendViaZeptoMail(items) {
  const token = zeptoToken()
  const url = `${zeptoBase()}/v1.1/email`
  const from = { address: addressOf(FROM), name: nameOf(FROM) }

  const CONCURRENCY = 5
  const results = new Array(items.length)
  const failures = []
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      const { to, subject, html, text, unsubscribeUrl } = items[i]
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            // The literal prefix is part of the credential format, not a
            // scheme name we chose — ZeptoMail rejects `Bearer`.
            Authorization: `Zoho-enczapikey ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [{ email_address: { address: to } }],
            reply_to: [{ address: REPLY_TO, name: nameOf(FROM) }],
            subject,
            htmlbody: html,
            textbody: text,
            // Product mail is not marketed at anybody, so there is nothing to
            // learn from tracking a pixel in it, and an open tracker is one
            // more reason for a filter to distrust a password reset.
            track_opens: false,
            track_clicks: false,
            mime_headers: listHeaders(unsubscribeUrl),
          }),
        })
        const body = await res.json().catch(() => null)
        if (!res.ok) {
          failures.push({ to, status: res.status, body })
          continue
        }
        results[i] = { id: body?.request_id ?? body?.data?.[0]?.message_id ?? null, to }
      } catch (err) {
        failures.push({ to, status: 0, body: String(err) })
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker()),
  )

  if (failures.length) {
    const detail = failures
      .slice(0, 10)
      .map((f) => `  ${f.to} → ${f.status} ${JSON.stringify(f.body)}`)
      .join('\n')
    const more = failures.length > 10 ? `\n  …and ${failures.length - 10} more` : ''
    // Thrown only after everything sendable has been sent, so the caller's
    // count of successes is real and the failures are named, not summarised.
    throw new Error(
      `zeptomail: ${failures.length}/${items.length} rejected, ${items.length - failures.length} delivered:\n${detail}${more}`,
    )
  }

  return { data: results.filter(Boolean) }
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

/**
 * "Total Football <x@y.z>" -> "Total Football"; a bare address yields ''.
 * ZeptoMail wants the display name as its own field rather than folded into
 * the address the way an SMTP From: header takes it.
 */
function nameOf(from) {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*</)
  return m?.[1]?.trim() ?? ''
}
