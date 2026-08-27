#!/usr/bin/env node
/**
 * The Supabase Auth emails, in the Total Football shell.
 *
 * Supabase sends five messages of its own, before any code in this repo runs:
 * the signup confirmation, the password reset, the magic link, the email-change
 * confirmation and the invite. Left alone they go out as Supabase's stock
 * templates, from `noreply@mail.app.supabase.io`, over a shared relay that is
 * rate-limited to a couple of messages an hour and is documented as being for
 * testing rather than production.
 *
 * That matters more than the branding. The signup confirmation is the GATE in
 * front of everything else here: `auth.users.email_confirmed_at` stays null
 * until it is clicked, the `studio_welcome_webhook` trigger (supabase/011)
 * never fires, our own welcome never sends, and `public.email_audience`
 * (supabase/010) reads confirmed addresses only, so the coach never reaches
 * the list either. One unbranded message on a throttled relay decides all of
 * that.
 *
 * ── WHAT THIS SCRIPT DOES ──────────────────────────────────────────────────
 *
 *   (no flags)  render every template, lint it, write previews, change nothing
 *   --apply     PATCH the templates and subjects into the Supabase project
 *   --smtp      also point Supabase's mailer at ZeptoMail, after VERIFYING the
 *               credentials over a real SMTP connection
 *   --show      GET and print the project's current auth mail config
 *   --redirects fix site_url / uri_allow_list (see the note at the call site)
 *   --otp-exp   set the link lifetime; bare = 86400, or --otp-exp=3600
 *
 * ── WHY THE SHELL IS IMPORTED RATHER THAN COPIED ───────────────────────────
 *
 * `wrapEmail` and the type scale come from scripts/lib/email.mjs, the same
 * shell the newsletter and both welcomes use. A confirmation email that looks
 * like a different company from the welcome that follows it ninety seconds
 * later is the exact failure the comment above `welcomeEmail` describes. There
 * is no second copy of the masthead here on purpose.
 *
 * ── THE ONE STRUCTURAL DIFFERENCE ──────────────────────────────────────────
 *
 * No unsubscribe link. These are transactional: there is no list to leave, and
 * a working unsubscribe on a password reset is a way to lock somebody out of
 * their own account. `wrapEmail` drops the link when `unsubscribe` is omitted.
 *
 * ── TEMPLATE VARIABLES ─────────────────────────────────────────────────────
 *
 * Supabase renders these with Go's text/template. The braces must survive into
 * the stored template verbatim, so nothing here may HTML-escape them:
 *
 *   {{ .ConfirmationURL }}  the action link, already carrying redirect_to
 *   {{ .Email }}            the recipient
 *   {{ .NewEmail }}         email-change template only
 *   {{ .SiteURL }}          the project's configured site URL
 *   {{ .Token }}            the six-digit OTP, where one applies
 *
 * We deliberately do NOT print {{ .Token }} anywhere. The Studio's sign-in
 * (src/studio/account/session.ts) passes `emailRedirectTo` and consumes the
 * link; there is no field in the UI that accepts a code, so showing one would
 * offer the reader a route that dead-ends.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { wrapEmail, lintEmailHtml, P, KICKER, H1, cta, SANS, INK_SOFT, SITE } from './lib/email.mjs'

const PROJECT_REF = 'bewvowkkikxsjcfnkeot'
const API = 'https://api.supabase.com/v1'

/* ── Pieces the auth mails need and the newsletter does not ─────────────── */

/**
 * The raw link, under the button.
 *
 * Worth the space: the button is a <td> with a background colour, and the
 * clients most likely to flatten it into unreadable text are the corporate
 * ones a coach is most likely to be reading work mail in. `word-break` is what
 * stops a 300-character signed URL from forcing a horizontal scrollbar and
 * blowing the 580px measure apart on a phone.
 */
const fallbackLink = (url) =>
  `<p style="margin:22px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;font-weight:400;color:${INK_SOFT};">
  If the button does not work, paste this into your browser:<br>
  <a href="${url}" style="color:${INK_SOFT};text-decoration:underline;word-break:break-all;">${url}</a>
</p>`

/**
 * The closing note: what happens if this was not you, and how long the link
 * lasts. Both belong in every one of these messages.
 *
 * `expiry` is passed in rather than written as "24 hours", because the real
 * value is `mailer_otp_exp` on the project and copy that contradicts it is
 * worse than copy that omits it. --show reads the live number.
 */
const note = (text) =>
  `<p style="${P}margin:30px 0 0;font-size:14px;color:${INK_SOFT};">${text}</p>`

const hours = (seconds) => {
  const h = seconds / 3600
  if (h >= 1 && Number.isInteger(h)) return h === 1 ? '1 hour' : `${h} hours`
  const m = Math.round(seconds / 60)
  return m === 1 ? '1 minute' : `${m} minutes`
}

/* ── The five messages ──────────────────────────────────────────────────── */

const URL_VAR = '{{ .ConfirmationURL }}'

/**
 * Every template is built by this one function, so the five cannot drift into
 * five different designs. Only the words change.
 */
const authEmail = ({ kicker, headline, lead, button, closing, preheader, series }) => ({
  preheader,
  html: wrapEmail({
    preheader,
    series,
    bodyHtml:
      `<p style="${KICKER}">${kicker}</p>` +
      `<h1 style="${H1}">${headline}</h1>` +
      lead.map((p) => `<p style="${P}">${p}</p>`).join('\n') +
      cta(URL_VAR, button) +
      fallbackLink(URL_VAR) +
      note(closing),
  }),
})

export function templates({ otpExpSeconds = 86400 } = {}) {
  const life = hours(otpExpSeconds)

  return {
    confirmation: {
      field: 'confirmation',
      label: 'Confirm signup',
      subject: 'Confirm your email for Total Football Studio',
      ...authEmail({
        series: 'Studio Account',
        kicker: 'Total Football Studio',
        headline: 'Confirm your<br>email address.',
        preheader: 'One click and your Studio account is live.',
        lead: [
          'You created a Total Football Studio account with this address. Confirm it and the board is yours: every system saved to the cloud, on any machine you coach from.',
        ],
        button: 'Confirm my email&nbsp;&nbsp;&rarr;',
        closing: `This link lasts ${life} and works once. If you did not create this account, ignore this message. The address stays unconfirmed and the account cannot be used until somebody clicks the link above.`,
      }),
    },

    recovery: {
      field: 'recovery',
      label: 'Reset password',
      subject: 'Reset your Total Football Studio password',
      ...authEmail({
        series: 'Studio Account',
        kicker: 'Password reset',
        headline: 'Choose a new<br>password.',
        preheader: 'The link below lets you set a new password.',
        lead: [
          'Somebody asked to reset the password on the Total Football Studio account for this address. If it was you, set a new one here.',
        ],
        button: 'Set a new password&nbsp;&nbsp;&rarr;',
        closing: `This link lasts ${life} and works once. If you did not ask for it, ignore this message. Your current password keeps working and nothing about the account has changed.`,
      }),
    },

    magic_link: {
      field: 'magic_link',
      label: 'Magic link',
      subject: 'Your sign-in link for Total Football Studio',
      ...authEmail({
        series: 'Studio Account',
        kicker: 'Sign in',
        headline: 'Your link<br>to the board.',
        preheader: 'One tap and you are back in the Studio.',
        lead: ['Here is the sign-in link you asked for. It opens the Studio on this device with no password.'],
        button: 'Open the Studio&nbsp;&nbsp;&rarr;',
        closing: `This link lasts ${life} and works once. If you did not ask to sign in, ignore this message. Nobody can reach the account without the link.`,
      }),
    },

    email_change: {
      field: 'email_change',
      label: 'Change email address',
      subject: 'Confirm your new email for Total Football Studio',
      ...authEmail({
        series: 'Studio Account',
        kicker: 'Email change',
        headline: 'Confirm your<br>new address.',
        preheader: 'Confirm the new address on your Studio account.',
        lead: [
          'You asked to move your Total Football Studio account from {{ .Email }} to {{ .NewEmail }}. Confirm the new address to finish.',
          'Your systems, your squad and your saved boards all move with the account. Nothing is lost in the change.',
        ],
        button: 'Confirm the change&nbsp;&nbsp;&rarr;',
        closing: `This link lasts ${life} and works once. If you did not ask for this, ignore the message and the account keeps the address it has.`,
      }),
    },

    invite: {
      field: 'invite',
      label: 'Invite user',
      subject: 'You have been invited to Total Football Studio',
      ...authEmail({
        series: 'Studio Account',
        kicker: 'Invitation',
        headline: 'You have been<br>invited in.',
        preheader: 'Set a password and the Studio is yours.',
        lead: [
          'Somebody invited you to Total Football Studio: a tactics board that saves every system you build and puts any of them on any screen with one link.',
        ],
        button: 'Accept the invitation&nbsp;&nbsp;&rarr;',
        closing: `This invitation lasts ${life}. If it was not meant for you, ignore it and no account is created.`,
      }),
    },
  }
}

/* ── Management API ─────────────────────────────────────────────────────── */

function token() {
  const t = process.env.SUPABASE_ACCESS_TOKEN
  if (!t) {
    console.error(
      'SUPABASE_ACCESS_TOKEN is not set.\n' +
        'This is the MANAGEMENT API token (sbp_...), not the service-role key:\n' +
        '  https://supabase.com/dashboard/account/tokens\n' +
        'The service-role key cannot read or write project config and returns 401 here.',
    )
    process.exit(1)
  }
  return t
}

async function getConfig() {
  const res = await fetch(`${API}/projects/${PROJECT_REF}/config/auth`, {
    headers: { Authorization: `Bearer ${token()}` },
  })
  if (!res.ok) throw new Error(`GET config/auth ${res.status}: ${await res.text()}`)
  return res.json()
}

async function patchConfig(body) {
  const res = await fetch(`${API}/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH config/auth ${res.status}: ${await res.text()}`)
  return res.json()
}

/**
 * Prove the SMTP credentials before writing them into the project.
 *
 * Supabase accepts whatever it is given and only finds out at the first send,
 * which is a signup, which is a coach sitting in front of a "check your email"
 * screen that never resolves. nodemailer's verify() does the AUTH handshake
 * without sending anything, so a wrong token fails here instead of there.
 */
async function verifySmtp({ host, port, user, pass }) {
  const { createTransport } = await import('nodemailer')
  const t = createTransport({ host, port, secure: port === 465, auth: { user, pass } })
  await t.verify()
}

/* ── Entry ──────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2)
const has = (f) => argv.some((a) => a === f || a.startsWith(f + '='))

const OUT = 'content/auth-emails'

async function main() {
  if (has('--show')) {
    const c = await getConfig()
    const rows = [
      ['smtp_host', c.smtp_host || '(none: Supabase shared relay)'],
      ['smtp_user', c.smtp_user || '-'],
      ['smtp_admin_email', c.smtp_admin_email || '-'],
      ['smtp_sender_name', c.smtp_sender_name || '-'],
      ['mailer_autoconfirm', String(c.mailer_autoconfirm)],
      ['mailer_otp_exp', `${c.mailer_otp_exp}s (${hours(c.mailer_otp_exp)})`],
      ['rate_limit_email_sent', `${c.rate_limit_email_sent}/hour`],
      ['site_url', c.site_url || '-'],
    ]
    for (const [k, v] of rows) console.log(`  ${k.padEnd(24)} ${v}`)
    for (const t of Object.keys(templates())) {
      const custom = Boolean(c[`mailer_templates_${t}_content`])
      console.log(`  ${`template:${t}`.padEnd(24)} ${custom ? 'custom' : 'SUPABASE DEFAULT'}`)
    }
    return
  }

  // Build against the project's real expiry when we can reach it, so the copy
  // cannot claim a lifetime the project does not give the link.
  //
  // When --otp-exp is setting a NEW lifetime in this same run, the copy must be
  // built from that, not from the value being replaced. Otherwise the templates
  // go out claiming the expiry they are in the act of changing.
  const otpArg = argv.find((a) => a.startsWith('--otp-exp'))
  let otpExpSeconds = otpArg ? Number(otpArg.split('=')[1] || 86400) : 86400
  if (!otpArg && process.env.SUPABASE_ACCESS_TOKEN) {
    try {
      otpExpSeconds = (await getConfig()).mailer_otp_exp || otpExpSeconds
    } catch (err) {
      console.error(`  ! could not read live config (${err.message}); using ${hours(otpExpSeconds)}`)
    }
  }

  const built = templates({ otpExpSeconds })
  mkdirSync(OUT, { recursive: true })

  let warned = 0
  for (const [key, t] of Object.entries(built)) {
    const warnings = lintEmailHtml(t.html)
    warned += warnings.length
    writeFileSync(`${OUT}/${key}.html`, t.html)
    // A preview with the Go variables filled in, so the rendering can be read.
    writeFileSync(
      `${OUT}/${key}.preview.html`,
      t.html
        .replaceAll('{{ .ConfirmationURL }}', `${SITE}/studio/portal/#example-confirmation-link`)
        .replaceAll('{{ .Email }}', 'coach@example.com')
        .replaceAll('{{ .NewEmail }}', 'newcoach@example.com'),
    )
    console.log(`  ${t.label.padEnd(24)} ${String(t.html.length).padStart(6)} bytes  "${t.subject}"`)
    for (const w of warnings) console.log(`      ! ${w}`)
  }
  console.log(`\n  written to ${OUT}/  (*.preview.html has the variables filled in)`)
  if (warned) console.log(`  ${warned} lint warning(s) above`)

  if (!has('--apply')) {
    console.log('\n  dry run. --apply writes these to the project, --smtp also points the mailer at ZeptoMail.')
    return
  }

  const body = {}
  for (const [key, t] of Object.entries(built)) {
    body[`mailer_subjects_${key}`] = t.subject
    body[`mailer_templates_${key}_content`] = t.html
  }

  if (has('--redirects')) {
    // site_url takes ONE url and is the fallback when a link carries no
    // redirect_to. A glob here is not a wildcard, it is a 404: it was set to
    // `https://totalfootball.naurra.ai/**` and that is where every confirmed
    // signup landed. The glob belongs in uri_allow_list, which is matched
    // per-entry, so an entry without one matches that exact url and nothing
    // else. session.ts sends `.../studio/portal/`, which the bare origin did
    // not match, so every link fell through to the broken site_url.
    Object.assign(body, {
      site_url: SITE,
      uri_allow_list: [SITE, `${SITE}/**`, 'http://localhost:4321/**'].join(','),
    })
  }

  if (has('--otp-exp')) {
    // 3600 is short for a link somebody reads on their phone hours later, and
    // an expired confirmation is a dead end: the account exists, so signing up
    // again fails, and there is no "resend" in the UI. 86400 is Supabase's own
    // default. Revert with --otp-exp=3600.
    body.mailer_otp_exp = otpExpSeconds
  }

  if (has('--smtp')) {
    const host = process.env.ZEPTOMAIL_SMTP_HOST || 'smtp.zeptomail.eu'
    const port = Number(process.env.ZEPTOMAIL_SMTP_PORT || 587)
    const user = process.env.ZEPTOMAIL_SMTP_USER || 'emailapikey'
    const pass = (process.env.ZEPTOMAIL_SMTP_PASS || process.env.ZEPTOMAIL_TOKEN || '').replace(
      /^Zoho-enczapikey\s+/i,
      '',
    )
    if (!pass) throw new Error('ZEPTOMAIL_SMTP_PASS (or ZEPTOMAIL_TOKEN) is not set')

    process.stdout.write(`  verifying ${user}@${host}:${port} ... `)
    await verifySmtp({ host, port, user, pass })
    console.log('ok')

    const from = process.env.EMAIL_FROM || 'Total Football <totalfootball@naurra.ai>'
    const address = (from.match(/<([^>]+)>/) || [null, from])[1].trim()
    const name = (from.split('<')[0] || '').trim().replace(/^"|"$/g, '') || 'Total Football'

    Object.assign(body, {
      smtp_host: host,
      // A STRING. The API rejects a number here with
      // `smtp_port: Invalid input: expected string, received number`, and it
      // validates before it writes, so the whole PATCH is refused. Ports are
      // numbers everywhere else in this script, including nodemailer's config.
      smtp_port: String(port),
      smtp_user: user,
      smtp_pass: pass,
      smtp_admin_email: address,
      smtp_sender_name: name,
      // With a real relay behind it there is no reason to keep Supabase's
      // shared-service throttle. ZeptoMail is built for this volume.
      rate_limit_email_sent: Number(process.env.SUPABASE_EMAIL_RATE || 300),
    })
  }

  await patchConfig(body)
  console.log(`\n  applied ${Object.keys(body).length} field(s) to project ${PROJECT_REF}`)
  console.log('  verify with: node --env-file=.env scripts/auth-emails.mjs --show')
}

main().catch((err) => {
  console.error(`\n  ${err.message}`)
  process.exit(1)
})
