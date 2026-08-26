/**
 * Read and reconcile `_dmarc.naurra.ai`.
 *
 *   node scripts/set-dmarc.mjs
 *        Report only. Prints the live record, every tag decoded, and what is
 *        wrong with it. Changes nothing. Safe to run any time.
 *
 *   node scripts/set-dmarc.mjs --apply
 *        Write the reconciled record. Without other flags this keeps the
 *        current policy and rua, and only strips `ruf=` and `fo=`.
 *
 *   node scripts/set-dmarc.mjs --apply --rua <address>
 *        Also repoint aggregate reports at <address>.
 *
 *   node scripts/set-dmarc.mjs --apply --policy quarantine --pct 25
 *        Also move the policy on. `--pct` applies to quarantine/reject only.
 *
 * ── WHY `ruf=` AND `fo=1` COME OUT ──────────────────────────────────────────
 *
 * `rua` is the AGGREGATE stream: one gzipped XML summary per receiving
 * provider per day, counts and IPs only, no message content. That is the
 * stream worth having, and the only one this script will ever set.
 *
 * `ruf` is the FORENSIC stream: one mail per FAILING MESSAGE, carrying that
 * message's headers and usually its body. Paired with `fo=1` — "report if ANY
 * mechanism fails", not "if DMARC fails" — a newsletter that a subscriber
 * auto-forwards still passes DMARC on DKIM, fails SPF at the forwarder, and
 * generates a forensic report anyway. So the volume tracks how often your mail
 * is FORWARDED, which is unbounded and unrelated to whether anything is wrong.
 *
 * Google and Microsoft decline to send `ruf` at all on privacy grounds, which
 * is the only reason the original record did not bury the mailbox. Smaller
 * receivers do send it, and what arrives is copies of your own subscribers'
 * mail landing in an inbox that was never meant to hold it. It diagnoses
 * nothing the aggregate reports do not, so it comes out.
 *
 * ── THE TRAP THIS SCRIPT EXISTS TO CATCH ────────────────────────────────────
 *
 * When `rua` points at a mailbox on ANOTHER domain, RFC 7489 §7.1 makes the
 * receiving domain opt in, or a conforming receiver sends nothing. For
 * `rua=mailto:x@dmarc.postmarkapp.com` on naurra.ai the receiver looks up:
 *
 *     naurra.ai._report._dmarc.dmarc.postmarkapp.com   TXT   "v=DMARC1;"
 *
 * Note the doubled label: the query is built from the FULL domain of the
 * report address (`dmarc.postmarkapp.com`), not its registrable domain
 * (`postmarkapp.com`). Getting that wrong is the whole trap — the shorter name
 * also resolves at Postmark, to an unrelated verification string that is not a
 * DMARC record, so a careless check "passes" and you then wait weeks for
 * reports that were never authorised and will never arrive.
 *
 * There is no error anywhere in this failure. Reports simply stop. So this
 * script refuses to write an off-domain `rua` it has not verified, and
 * `--force` past that refusal is deliberately not offered.
 */
import { zoneId, records, replaceRecord, resolves } from './lib/netlify-dns.mjs'
import { promises as dns } from 'node:dns'

const HOST = '_dmarc.naurra.ai'
const DOMAIN = 'naurra.ai'

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined)

const APPLY = has('--apply')

/** "a=b; c=d" → { a: 'b', c: 'd' }, order preserved. */
function parse(record) {
  const out = new Map()
  for (const part of record.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k) out.set(k.trim(), rest.join('=').trim())
  }
  return out
}

/**
 * True when `address` is authorised to receive reports for DOMAIN.
 *
 * On-domain addresses need no authorisation and short-circuit to true — that
 * is the rule, not a shortcut.
 */
async function reportingAuthorised(address) {
  const at = address.replace(/^mailto:/, '').split('@')[1]
  if (!at) return false
  if (at === DOMAIN || at.endsWith(`.${DOMAIN}`)) return true

  const probe = `${DOMAIN}._report._dmarc.${at}`
  try {
    const txt = (await dns.resolveTxt(probe)).map((c) => c.join('')).join('')
    return { ok: /^v=DMARC1\s*;?/i.test(txt), probe, txt }
  } catch (e) {
    return { ok: false, probe, txt: `<no record: ${e.code ?? e.message}>` }
  }
}

const zone = await zoneId(DOMAIN)
const live = (await records(zone)).find((r) => r.type === 'TXT' && r.hostname === HOST)

if (!live) {
  console.error(`No TXT at ${HOST}. Refusing to invent one — check the zone.`)
  process.exit(1)
}

const tags = parse(live.value)
console.log(`\nlive   ${live.value}\n`)
for (const [k, v] of tags) {
  const note =
    k === 'ruf' ? '  ← forensic stream: one mail per failing message, with content'
    : k === 'fo' ? '  ← "report on ANY mechanism failure", not just DMARC failure'
    : k === 'p' && v === 'none' ? '  ← monitor only; nothing is being enforced'
    : ''
  console.log(`  ${k.padEnd(5)} ${(v || '(empty)').padEnd(34)}${note}`)
}

// Build the reconciled record. Tag order follows the RFC's own examples: v and
// p first, reporting next, alignment last.
const policy = val('--policy') ?? tags.get('p')
if (!['none', 'quarantine', 'reject'].includes(policy)) {
  console.error(`\n--policy must be none | quarantine | reject (got ${policy})`)
  process.exit(1)
}

const rua = val('--rua') ?? tags.get('rua')?.replace(/^mailto:/, '')
if (!rua) {
  console.error('\nNo rua to write. Pass --rua <address>.')
  process.exit(1)
}

const auth = await reportingAuthorised(rua)
if (auth !== true) {
  console.log(`\nexternal rua check`)
  console.log(`  query  ${auth.probe}`)
  console.log(`  answer ${auth.txt}`)
  console.log(`  ${auth.ok ? 'AUTHORISED' : 'NOT AUTHORISED'}`)
  if (!auth.ok) {
    console.error(
      `\n${rua} is not authorised to receive reports for ${DOMAIN}.\n` +
        `Writing it would silently produce ZERO reports. Not writing it.`,
    )
    process.exit(1)
  }
}

// pct is meaningful only when something is actually being enforced; carrying
// pct=100 under p=none is noise that reads like a setting someone chose.
const pct = val('--pct') ?? (policy === 'none' ? null : (tags.get('pct') ?? '100'))

const next =
  [
    'v=DMARC1',
    `p=${policy}`,
    `rua=mailto:${rua}`,
    pct && pct !== '100' ? `pct=${pct}` : null,
    'adkim=r',
    'aspf=r',
  ]
    .filter(Boolean)
    .join('; ') + ';'

console.log(`\nnext   ${next}`)

if (next === live.value) {
  console.log('\nAlready correct. Nothing to do.')
  process.exit(0)
}

const diff = []
if (tags.has('ruf')) diff.push('drops ruf= (forensic stream off)')
if (tags.has('fo')) diff.push('drops fo=')
if (rua !== tags.get('rua')?.replace(/^mailto:/, '')) diff.push(`rua → ${rua}`)
if (policy !== tags.get('p')) diff.push(`p: ${tags.get('p')} → ${policy}`)
console.log(diff.map((d) => `       · ${d}`).join('\n'))

if (!APPLY) {
  console.log('\nReport only. Re-run with --apply to write it.')
  process.exit(0)
}

const res = await replaceRecord(zone, { type: 'TXT', hostname: HOST, value: next })
console.log(`\n${res.action} (removed ${res.removed})`)

process.stdout.write('waiting for the authoritative nameserver')
for (let i = 0; i < 20; i++) {
  if (await resolves(HOST, 'TXT', next)) {
    console.log('\nlive.')
    process.exit(0)
  }
  process.stdout.write('.')
  await new Promise((r) => setTimeout(r, 3000))
}
console.log(`\nWritten, but not authoritative yet. Check: dig +short TXT ${HOST}`)
