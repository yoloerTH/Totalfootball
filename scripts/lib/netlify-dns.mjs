/**
 * naurra.ai DNS, over the Netlify API.
 *
 * The zone is on Netlify DNS (`dns{1..4}.p04.nsone.net`), so records are
 * managed here rather than by hand in a dashboard. There is no `netlify dns`
 * CLI command; the CLI exposes the endpoints through `netlify api`, and this
 * module talks to the same REST API directly so a change can be made as one
 * transaction-ish sequence rather than several seconds-apart invocations.
 *
 * ── THE ONE THING TO UNDERSTAND ─────────────────────────────────────────────
 *
 * The Netlify DNS API has CREATE and DELETE but **no UPDATE**. Changing a
 * record means deleting it and creating a new one, and for SPF that ordering
 * is load-bearing:
 *
 *   · a domain may publish exactly ONE `v=spf1` record
 *   · two of them is `PermError` — a hard failure at every receiver
 *   · zero of them is `none` — a soft result nothing rejects on
 *
 * So `replaceRecord` deletes first and creates second, accepting a sub-second
 * window with no record rather than a sub-second window with two. Doing it the
 * other way round is the intuitive order and it is the wrong one.
 *
 * Auth comes from the Netlify CLI's own stored token, so there is no separate
 * credential to manage and nothing new in .env.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const API = 'https://api.netlify.com/api/v1'

/** The CLI's token, wherever this platform keeps it. */
function netlifyToken() {
  if (process.env.NETLIFY_AUTH_TOKEN) return process.env.NETLIFY_AUTH_TOKEN

  const candidates = [
    `${homedir()}/Library/Preferences/netlify/config.json`,
    `${homedir()}/.config/netlify/config.json`,
    `${homedir()}/.netlify/config.json`,
  ]

  for (const path of candidates) {
    try {
      const cfg = JSON.parse(readFileSync(path, 'utf8'))
      for (const user of Object.values(cfg.users ?? {})) {
        if (user?.auth?.token) return user.auth.token
      }
    } catch {
      /* next candidate */
    }
  }

  throw new Error(
    'No Netlify token. Run `npx netlify login`, or set NETLIFY_AUTH_TOKEN in the environment.',
  )
}

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${netlifyToken()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`netlify ${init.method ?? 'GET'} ${path} → ${res.status}: ${text.slice(0, 300)}`)
  }
  return text ? JSON.parse(text) : null
}

/** The zone id for a domain, by name. */
export async function zoneId(domain = 'naurra.ai') {
  const zones = await api('/dns_zones')
  const zone = zones.find((z) => z.name === domain)
  if (!zone) {
    throw new Error(
      `No Netlify DNS zone for ${domain}. Zones on this account: ${zones.map((z) => z.name).join(', ')}`,
    )
  }
  return zone.id
}

export async function records(zone) {
  return api(`/dns_zones/${zone}/dns_records`)
}

export async function createRecord(zone, { type, hostname, value, ttl = 3600 }) {
  return api(`/dns_zones/${zone}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({ type, hostname, value, ttl }),
  })
}

export async function deleteRecord(zone, id) {
  return api(`/dns_zones/${zone}/dns_records/${id}`, { method: 'DELETE' })
}

/**
 * Put exactly one record of `type` at `hostname` holding `value`.
 *
 * `match` narrows which existing records count as "the same record" when a
 * hostname legitimately holds several of a type — naurra.ai's apex TXT holds
 * the SPF record AND a Zoho verification string, and replacing SPF must not
 * delete the verification. Default is an exact hostname+type match, which is
 * right for a DKIM host that holds one record and wrong for the apex.
 *
 * Returns { action, id, removed } so a caller can report what actually
 * happened rather than assuming.
 */
export async function replaceRecord(zone, { type, hostname, value, ttl = 3600, match }) {
  const all = await records(zone)
  const isSame = match ?? ((r) => r.type === type && r.hostname === hostname)
  const existing = all.filter(isSame)

  // Already correct: do nothing, so re-running a setup script is free and does
  // not churn the record's id or reset its propagation.
  if (existing.length === 1 && existing[0].value === value) {
    return { action: 'unchanged', id: existing[0].id, removed: 0 }
  }

  for (const r of existing) await deleteRecord(zone, r.id)
  const created = await createRecord(zone, { type, hostname, value, ttl })

  return {
    action: existing.length ? 'replaced' : 'created',
    id: created.id,
    removed: existing.length,
  }
}

/**
 * True when `value` is live on the AUTHORITATIVE nameservers.
 *
 * Deliberately not the system resolver: a record created seconds ago is
 * usually already authoritative while every cache still holds the old answer
 * (or a negative answer, which is worse — those are cached too). Asking the
 * zone's own nameserver is the difference between "the change is live" and
 * "my laptop has not noticed yet", and only the first is worth reporting.
 *
 * Node's Resolver.setServers takes IP ADDRESSES, not hostnames, so the
 * nameserver is resolved first. Missing that yields an opaque EBADNAME.
 */
export async function resolves(hostname, type, value, nameserver = 'dns1.p04.nsone.net') {
  const dns = await import('node:dns')

  let servers
  try {
    servers = await dns.promises.resolve4(nameserver)
  } catch {
    return false
  }

  const resolver = new dns.promises.Resolver()
  resolver.setServers(servers)

  try {
    if (type === 'TXT') {
      // A long TXT value is split into 255-char chunks on the wire; joining
      // them is what reconstructs a DKIM public key.
      const answers = await resolver.resolveTxt(hostname)
      return answers.some((chunks) => chunks.join('') === value)
    }
    if (type === 'CNAME') {
      const answers = await resolver.resolveCname(hostname)
      const want = value.replace(/\.$/, '').toLowerCase()
      return answers.some((a) => a.replace(/\.$/, '').toLowerCase() === want)
    }
  } catch {
    return false
  }
  return false
}
