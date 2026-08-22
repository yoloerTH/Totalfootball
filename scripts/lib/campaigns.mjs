/**
 * Zoho Campaigns — the newsletter side of the system.
 *
 * ── THE DIVISION OF LABOUR ──────────────────────────────────────────────────
 *
 *   scripts/lib/email.mjs   ZeptoMail. Product mail: the welcome, and anything
 *                           sent to one person because of something they did.
 *   this file               Campaigns. Broadcasts to the audience.
 *
 * They are separate products with separate reputations on purpose. A
 * newsletter that collects spam complaints must not be able to stop a Studio
 * password reset from arriving, and ZeptoMail's terms forbid bulk marketing
 * through it besides.
 *
 * ── WHAT IS AUTHORITATIVE ───────────────────────────────────────────────────
 *
 * SUPABASE IS. `public.email_audience` (supabase/010) decides who exists and
 * who has opted out; Campaigns is a delivery mechanism we push a copy of that
 * list into. This matters when the two disagree, which they will:
 *
 *   · somebody unsubscribes via OUR footer link → /api/unsubscribe writes
 *     email_suppressions, and syncContacts() pushes the unsubscribe up.
 *   · somebody unsubscribes via CAMPAIGNS' own footer, or hard-bounces →
 *     pullOptOuts() reads it back down into email_suppressions.
 *
 * Both directions run in scripts/sync-campaigns.mjs. Skipping either one is
 * how a person who opted out gets mailed again by the other half.
 *
 * ── REGION ──────────────────────────────────────────────────────────────────
 *
 * Every Zoho host here is `.eu`, because naurra.ai is an EU-data-centre
 * account (mailbox on smtp.zoho.eu, SPF include zohomail.eu, verification via
 * zmverify.zoho.eu). A refresh token minted in the EU DC returns
 * `invalid_client` from accounts.zoho.com, which reads like a bad secret and
 * sends you looking in the wrong place. Override with ZOHO_DC if the account
 * is ever elsewhere.
 *
 * ── CREDENTIALS ─────────────────────────────────────────────────────────────
 *
 *   ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET   a Self Client in api-console.zoho.eu
 *   ZOHO_REFRESH_TOKEN                    minted once, never expires
 *   ZOHO_CAMPAIGNS_LISTKEY                the target list
 *
 * Scope needed when minting: ZohoCampaigns.contact.ALL
 * See docs/EMAIL.md for the click-through that produces these.
 */
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

const DC = (envVar('ZOHO_DC') || 'eu').toLowerCase()
const ACCOUNTS = `https://accounts.zoho.${DC}`
const CAMPAIGNS = `https://campaigns.zoho.${DC}`

export const LIST_KEY = envVar('ZOHO_CAMPAIGNS_LISTKEY')

/** True when there is enough configuration to talk to Campaigns at all. */
export function campaignsConfigured() {
  return Boolean(
    envVar('ZOHO_CLIENT_ID') &&
      envVar('ZOHO_CLIENT_SECRET') &&
      envVar('ZOHO_REFRESH_TOKEN') &&
      LIST_KEY,
  )
}

/**
 * Access tokens last an hour; the refresh token does not expire. Cached in
 * module scope so a sync of 80 contacts mints ONE token rather than 80 — Zoho
 * rate-limits token minting far more tightly than it rate-limits the API, and
 * hitting that limit locks the client out for 30 minutes.
 *
 * The 60-second safety margin exists because the expiry is measured from when
 * Zoho issued it, not from when we received it.
 */
let cached = { token: null, expiresAt: 0 }

async function accessToken() {
  if (cached.token && Date.now() < cached.expiresAt) return cached.token

  const params = new URLSearchParams({
    refresh_token: envVar('ZOHO_REFRESH_TOKEN'),
    client_id: envVar('ZOHO_CLIENT_ID'),
    client_secret: envVar('ZOHO_CLIENT_SECRET'),
    grant_type: 'refresh_token',
  })

  const res = await fetch(`${ACCOUNTS}/oauth/v2/token?${params}`, { method: 'POST' })
  const body = await res.json().catch(() => null)

  // Zoho answers 200 with an `error` key rather than an HTTP error status, so
  // checking res.ok alone silently caches `undefined` as the token and every
  // later call fails with a confusing 401.
  if (!res.ok || !body?.access_token) {
    throw new Error(
      `zoho oauth ${res.status}: ${JSON.stringify(body)}\n` +
        `  Check ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN, and that\n` +
        `  they were all minted in the ${DC.toUpperCase()} data centre (ZOHO_DC).`,
    )
  }

  cached = {
    token: body.access_token,
    expiresAt: Date.now() + (Number(body.expires_in ?? 3600) - 60) * 1000,
  }
  return cached.token
}

async function call(path, params, { method = 'POST' } = {}) {
  const token = await accessToken()
  const qs = new URLSearchParams({ resfmt: 'JSON', ...params })
  const res = await fetch(`${CAMPAIGNS}/api/v1.1/${path}?${qs}`, {
    method,
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })

  const text = await res.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    /* Campaigns answers HTML on some auth failures; keep the text for the error. */
  }

  if (!res.ok) throw new Error(`campaigns ${path} ${res.status}: ${text.slice(0, 400)}`)

  // Same trap as the token endpoint: a business-logic failure arrives as
  // HTTP 200 with status "error", so res.ok is not the check.
  if (body?.status === 'error') {
    const err = new Error(`campaigns ${path}: ${body.message ?? text.slice(0, 200)}`)
    err.code = body.code
    err.body = body
    throw err
  }

  return body
}

/**
 * `contactinfo` is a JSON object of Campaigns FIELD LABELS, not field names —
 * "Contact Email" and "First Name", spaces and capitals included. A key that
 * does not match a label is dropped silently, so a typo here does not error,
 * it just quietly stops carrying the name.
 */
const contactInfo = ({ email, name }) => {
  const info = { 'Contact Email': email }
  if (name) {
    const parts = name.trim().split(/\s+/)
    info['First Name'] = parts[0]
    if (parts.length > 1) info['Last Name'] = parts.slice(1).join(' ')
  }
  return JSON.stringify(info)
}

/**
 * Add or update one contact on the list.
 *
 * `source` is the provenance string from email_audience — 'footer',
 * 'course-early-access', 'studio-account'. Campaigns stores and displays it,
 * which is the answer to "where did this address come from" if the list is
 * ever audited. That is not a hypothetical: Campaigns does review imports,
 * and an import of addresses with no recorded origin is the one that gets
 * held.
 *
 * Returns 'added' | 'exists'. An address already on the list is not an error
 * — a sync is expected to be re-run, and re-running must be free.
 */
export async function addContact({ email, name, source }) {
  try {
    await call('json/listsubscribe', {
      listkey: LIST_KEY,
      contactinfo: contactInfo({ email, name }),
      source: (source || 'website').slice(0, 100),
    })
    return 'added'
  } catch (err) {
    // Campaigns has no "already subscribed" status code that is stable across
    // versions, so this matches the message. Anything else is a real failure
    // and is rethrown.
    if (/already/i.test(err.message)) return 'exists'
    throw err
  }
}

/** Mark one contact unsubscribed in Campaigns. Idempotent, same as above. */
export async function unsubscribeContact(email) {
  try {
    await call('json/listunsubscribe', {
      listkey: LIST_KEY,
      contactinfo: contactInfo({ email }),
    })
    return 'unsubscribed'
  } catch (err) {
    if (/already|not.*(exist|found)/i.test(err.message)) return 'noop'
    throw err
  }
}

/**
 * Create a campaign as a DRAFT. It is not sent by this call and there is no
 * `--send` anywhere in this codebase that sends one: the last step is a human
 * pressing send in the Campaigns UI, after looking at the preview and the
 * recipient count. A broadcast to the whole audience is not something a
 * script should be able to do by itself at 2am on a typo.
 *
 * ── content_url, AND WHY THE HTML HAS TO BE ON THE WEB FIRST ────────────────
 *
 * Campaigns does not accept campaign HTML in the request body. It accepts a
 * URL and fetches it. So the edition must be deployed and publicly reachable
 * BEFORE this is called — scripts/send-newsletter.mjs writes it into
 * public/newsletters/ for exactly that reason, which also leaves a permanent
 * web archive of every edition as a side effect worth having.
 *
 * If the URL 404s, Campaigns creates the campaign with empty content rather
 * than failing, which is why send-newsletter.mjs fetches it once itself and
 * refuses to proceed if it is not live.
 */
export async function createCampaign({ name, subject, fromEmail, fromName, contentUrl }) {
  const body = await call('createCampaign', {
    campaignname: name,
    from_email: fromEmail,
    from_name: fromName || '',
    subject,
    content_url: contentUrl,
    list_details: JSON.stringify({ [LIST_KEY]: [] }),
  })
  return { key: body?.campaign_key ?? body?.campaignkey ?? null, body }
}

/**
 * Every address on the list with the given status, paged out in full.
 *
 * Status vocabulary is Campaigns': 'active', 'unsub', 'bounce'. The two that
 * matter to the sync are 'unsub' and 'bounce', because both mean "stop
 * sending" and both originate inside Campaigns where our database cannot see
 * them.
 *
 * `range` is capped at 200 by the API; asking for more returns 200 anyway, so
 * the loop below would spin forever on a fixed page size that was never
 * actually honoured. It advances by what it RECEIVED, not by what it asked
 * for, which is what makes that safe.
 */
export async function listContacts(status = 'active') {
  const PAGE = 200
  const out = []
  let fromIndex = 1

  for (;;) {
    const body = await call(
      'getlistsubscribers',
      { listkey: LIST_KEY, status, fromindex: String(fromIndex), range: String(PAGE) },
      { method: 'GET' },
    )

    // Campaigns has shipped this payload under more than one key across
    // versions. Take the documented one, and otherwise find the single array
    // of objects in the response rather than returning an empty page — an
    // empty page here reads as "nobody has unsubscribed", which would silently
    // skip recording real opt-outs.
    const rows = Array.isArray(body?.list_of_details)
      ? body.list_of_details
      : (Object.values(body ?? {}).find(
          (v) => Array.isArray(v) && (v.length === 0 || typeof v[0] === 'object'),
        ) ?? [])

    if (!Array.isArray(rows) || rows.length === 0) break

    let found = 0
    for (const row of rows) {
      // Field label, field name, and the snake_case form have all appeared.
      const email = String(
        row?.contact_email ?? row?.['Contact Email'] ?? row?.contactEmail ?? row?.email ?? '',
      )
        .trim()
        .toLowerCase()
      if (email) {
        out.push({ email, status })
        found++
      }
    }

    // A page of rows in which not one address could be read means the shape
    // changed. Failing loudly beats a sync that reports "0 opt-outs to record"
    // every night while Campaigns quietly accumulates them.
    if (found === 0) {
      throw new Error(
        `campaigns getlistsubscribers(${status}): got ${rows.length} rows but no readable ` +
          `email field. First row: ${JSON.stringify(rows[0]).slice(0, 300)}`,
      )
    }

    if (rows.length < PAGE) break
    fromIndex += rows.length
  }

  return out
}
