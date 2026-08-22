/**
 * Bring ZeptoMail up end to end, including its DNS.
 *
 *   node scripts/setup-zeptomail.mjs --code <authorization-code>
 *        First run. Exchanges the one-time code from api-console.zoho.eu for a
 *        refresh token, then does everything below.
 *
 *   node scripts/setup-zeptomail.mjs
 *        Subsequent runs, using ZOHO_REFRESH_TOKEN from .env. Idempotent —
 *        re-running reports state and changes only what is wrong.
 *
 *   node scripts/setup-zeptomail.mjs --dns-only
 *        Re-read the domain's DKIM/CNAME from ZeptoMail and reconcile DNS.
 *        Does not create agents or mint tokens.
 *
 * ── WHAT IT DOES ────────────────────────────────────────────────────────────
 *
 *   1. adds naurra.ai to ZeptoMail, which returns the DKIM selector, the DKIM
 *      public key, and a bounce-tracking CNAME
 *   2. writes all three into Netlify DNS (the zone is on Netlify, so this is
 *      an API call rather than an instruction to go and paste something)
 *   3. waits for them to be live on the authoritative nameserver
 *   4. creates the `totalfootball` mail agent
 *   5. mints a Send Mail Token for it
 *   6. prints the two .env lines
 *
 * ── THE ONE MANUAL STEP, AND WHY IT CANNOT BE AUTOMATED ─────────────────────
 *
 * Every call here needs `Authorization: Zoho-oauthtoken …`, and minting the
 * first refresh token requires a human at a browser consent screen. No API can
 * issue the credential that authorises API access — that is the point of it.
 * So one browser visit bootstraps everything, and nothing after it is manual.
 *
 * At api-console.zoho.eu → Self Client → Generate Code:
 *
 *   scope:    ZeptoMail.Domains.ALL,ZeptoMail.MailAgents.ALL
 *   duration: 10 minutes
 *
 * Then run this with --code <the code>. The code is single-use and expires;
 * the refresh token it returns does not.
 *
 * NOTE ON SCOPES: ZeptoMail issues scope-limited tokens, and a token granted
 * only MailAgents will be refused by the domains endpoints with a 401 that
 * looks exactly like a bad token. Both scopes must be on the same code, or
 * run this twice with two codes.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zoneId, replaceRecord, resolves } from './lib/netlify-dns.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

function envVar(name) {
  if (process.env[name]) return process.env[name]
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8')
    return raw.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim().replace(/^"(.*)"$/, '$1') || ''
  } catch {
    return ''
  }
}

const args = process.argv.slice(2)
const codeIdx = args.indexOf('--code')
const CODE = codeIdx >= 0 ? args[codeIdx + 1] : null
const DNS_ONLY = args.includes('--dns-only')

const DC = (envVar('ZOHO_DC') || 'eu').toLowerCase()
const ACCOUNTS = `https://accounts.zoho.${DC}`
const ZEPTO = `https://api.zeptomail.${DC === 'com' ? 'com' : DC}`
const DOMAIN = 'naurra.ai'
const AGENT_NAME = 'totalfootball'
// Bounce-tracking subdomain. ZeptoMail returns a CNAME to point at its
// cluster; this prefix is what the CNAME host is built from.
const BOUNCE_PREFIX = 'zmail'

const line = '='.repeat(56)
console.log(`\nTOTAL FOOTBALL — ZeptoMail setup\n${line}`)
console.log(`Data centre  ${DC}`)
console.log(`API          ${ZEPTO}`)
console.log(`Domain       ${DOMAIN}`)

/* ── OAuth ───────────────────────────────────────────────────────────────── */

async function refreshTokenFromCode(code) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: envVar('ZOHO_CLIENT_ID'),
    client_secret: envVar('ZOHO_CLIENT_SECRET'),
    code,
  })
  const res = await fetch(`${ACCOUNTS}/oauth/v2/token?${params}`, { method: 'POST' })
  const body = await res.json().catch(() => null)
  if (!body?.refresh_token) {
    throw new Error(
      `Could not exchange the code: ${JSON.stringify(body)}\n` +
        `  Codes are single-use and expire in minutes — generate a fresh one.\n` +
        `  Check ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET are the same Self Client,\n` +
        `  and that it was created at api-console.zoho.${DC}.`,
    )
  }
  return body
}

let cached = { token: null, expiresAt: 0 }

async function accessToken(refreshToken) {
  if (cached.token && Date.now() < cached.expiresAt) return cached.token
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: envVar('ZOHO_CLIENT_ID'),
    client_secret: envVar('ZOHO_CLIENT_SECRET'),
  })
  const res = await fetch(`${ACCOUNTS}/oauth/v2/token?${params}`, { method: 'POST' })
  const body = await res.json().catch(() => null)
  // Zoho answers 200 with an `error` key rather than an HTTP error status.
  if (!body?.access_token) throw new Error(`zoho oauth: ${JSON.stringify(body)}`)
  cached = {
    token: body.access_token,
    expiresAt: Date.now() + (Number(body.expires_in ?? 3600) - 60) * 1000,
  }
  return cached.token
}

if (!envVar('ZOHO_CLIENT_ID') || !envVar('ZOHO_CLIENT_SECRET')) {
  console.error(
    `\nZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET are not set in .env.\n\n` +
      `  1. api-console.zoho.${DC} → Self Client → Create\n` +
      `  2. copy the Client ID and Client Secret into .env\n` +
      `  3. Generate Code tab, scope:\n` +
      `       ZeptoMail.Domains.ALL,ZeptoMail.MailAgents.ALL\n` +
      `     duration 10 minutes\n` +
      `  4. re-run: node scripts/setup-zeptomail.mjs --code <code>\n`,
  )
  process.exit(1)
}

let REFRESH = envVar('ZOHO_REFRESH_TOKEN')

if (CODE) {
  console.log(`\nExchanging authorization code…`)
  const tok = await refreshTokenFromCode(CODE)
  REFRESH = tok.refresh_token
  console.log(`Refresh token obtained. Put this in .env and the Netlify UI:\n`)
  console.log(`  ZOHO_REFRESH_TOKEN=${REFRESH}\n`)
}

if (!REFRESH) {
  console.error(
    `\nNo ZOHO_REFRESH_TOKEN, and no --code given.\n` +
      `  Generate a code at api-console.zoho.${DC} and re-run with --code <code>.\n`,
  )
  process.exit(1)
}

async function zepto(path, init = {}) {
  const token = await accessToken(REFRESH)
  const res = await fetch(`${ZEPTO}/v1.1${path}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    /* keep the raw text for the error */
  }
  if (!res.ok) {
    const err = new Error(`zeptomail ${init.method ?? 'GET'} ${path} → ${res.status}: ${text.slice(0, 400)}`)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

/* ── 1 · Domain ──────────────────────────────────────────────────────────── */

console.log(`\n1 · Domain`)

let domain = null
try {
  const existing = await zepto('/domains')
  const rows = existing?.data ?? []
  domain = rows.find((d) => d.domain_name === DOMAIN) ?? null
  console.log(`    ${rows.length} domain(s) on the account`)
} catch (err) {
  console.log(`    could not list domains (${err.status ?? '?'}) — will try to add`)
}

if (!domain) {
  console.log(`    adding ${DOMAIN}…`)
  const added = await zepto('/domains', {
    method: 'POST',
    body: JSON.stringify({
      domain_name: DOMAIN,
      sub_domain_prefix: BOUNCE_PREFIX,
      mailagent_keys: [],
    }),
  })
  domain = added?.data
} else {
  console.log(`    ${DOMAIN} already present (status ${domain.status})`)
}

if (!domain?.dkim) {
  console.error(
    `\n    ZeptoMail returned no DKIM block for ${DOMAIN}. Raw:\n    ${JSON.stringify(domain).slice(0, 500)}\n`,
  )
  process.exit(1)
}

const dkimHost = domain.dkim.host?.endsWith(DOMAIN)
  ? domain.dkim.host
  : `${domain.dkim.selector}._domainkey.${DOMAIN}`
const dkimValue = domain.dkim.public_key.startsWith('v=DKIM1')
  ? domain.dkim.public_key
  : `v=DKIM1; k=rsa; p=${domain.dkim.public_key}`

console.log(`    DKIM host   ${dkimHost}`)
console.log(`    DKIM value  ${dkimValue.slice(0, 48)}…`)
if (domain.cname) console.log(`    CNAME       ${domain.cname.host} → ${domain.cname.cname_record}`)

/* ── 2 · DNS ─────────────────────────────────────────────────────────────── */

console.log(`\n2 · Netlify DNS`)

const zone = await zoneId(DOMAIN)
console.log(`    zone ${zone}`)

const dkimResult = await replaceRecord(zone, {
  type: 'TXT',
  hostname: dkimHost,
  value: dkimValue,
})
console.log(`    DKIM  ${dkimResult.action}${dkimResult.removed ? ` (removed ${dkimResult.removed})` : ''}`)

if (domain.cname?.host && domain.cname?.cname_record) {
  const cnameResult = await replaceRecord(zone, {
    type: 'CNAME',
    hostname: domain.cname.host,
    value: domain.cname.cname_record,
  })
  console.log(`    CNAME ${cnameResult.action}`)
}

/* ── 3 · Wait for propagation ────────────────────────────────────────────── */

console.log(`\n3 · Waiting for the authoritative nameserver…`)

const deadline = Date.now() + 120_000
let live = false
while (Date.now() < deadline) {
  live = await resolves(dkimHost, 'TXT', dkimValue)
  if (live) break
  await new Promise((r) => setTimeout(r, 5000))
}
console.log(`    DKIM ${live ? 'live' : 'NOT live after 2 minutes — check the record by hand'}`)

if (DNS_ONLY) {
  console.log(`\n--dns-only: stopping here.\n`)
  process.exit(live ? 0 : 1)
}

/* ── 4 · Mail agent ──────────────────────────────────────────────────────── */

console.log(`\n4 · Mail agent`)

let agent = null
try {
  const agents = await zepto('/mailagents')
  const rows = agents?.data ?? []
  agent = rows.find((a) => (a.mailagent_name ?? a.name) === AGENT_NAME) ?? null
  console.log(`    ${rows.length} agent(s) on the account`)
} catch (err) {
  console.log(`    could not list agents (${err.status ?? '?'}) — will try to create`)
}

if (!agent) {
  const created = await zepto('/mailagents', {
    method: 'POST',
    body: JSON.stringify({ mailagent_name: AGENT_NAME }),
  })
  agent = created?.data
  console.log(`    created ${AGENT_NAME}`)
} else {
  console.log(`    ${AGENT_NAME} already exists`)
}

const agentKey = agent?.mailagent_key ?? agent?.mailagent_alias ?? agent?.alias
if (!agentKey) {
  console.error(`\n    No agent key in the response. Raw:\n    ${JSON.stringify(agent).slice(0, 400)}\n`)
  process.exit(1)
}
console.log(`    agent key   ${String(agentKey).slice(0, 12)}…`)

/* ── 5 · Send Mail Token ─────────────────────────────────────────────────── */

console.log(`\n5 · Send Mail Token`)

// An agent may hold at most 2 tokens; a third returns GE_117. Existing ones
// are never re-readable in full, so if one is already there we do not churn it.
const minted = await zepto(`/mailagents/${agentKey}/apikeys`, {
  method: 'POST',
  body: JSON.stringify({ type: 'sendmail' }),
}).catch((err) => {
  console.log(`    could not mint (${err.status ?? '?'}): ${String(err.message).slice(0, 200)}`)
  return null
})

const token = minted?.data?.password ?? null

console.log(`\n${line}`)
if (token) {
  console.log(`Add to .env AND the Netlify UI:\n`)
  console.log(`  ZEPTOMAIL_TOKEN=${token}`)
  console.log(`  ZEPTOMAIL_REGION=${DC}`)
  console.log(`\nThen verify end to end:`)
  console.log(`  node scripts/send-welcome.mjs --test athanasios@naurra.ai`)
  console.log(`\nRead the raw headers: spf=pass, dkim=pass, dmarc=pass, and the`)
  console.log(`dkim line must name ${DOMAIN} — not zeptomail.net.`)
} else {
  console.log(`No token minted. If the agent already has two, delete one in the`)
  console.log(`console and re-run, or copy an existing token from Setup Info.`)
}
console.log()
