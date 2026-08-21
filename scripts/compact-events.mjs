/**
 * Fold the traffic log down by hand.
 *
 *   node scripts/compact-events.mjs --dry        what it would do, changing nothing
 *   node scripts/compact-events.mjs              fold everything older than 4 days
 *   node scripts/compact-events.mjs --keep 10    keep ten days of raw instead
 *
 * The daily report does this every night (netlify/functions/daily-report.mts),
 * so this exists for two moments: the FIRST fold, which should be looked at
 * before it happens rather than discovered afterwards, and the one after a
 * stretch where the scheduled function was not running.
 *
 * --dry is a real query and not a guess. It counts the rows the function would
 * delete, using the same day boundary the function uses, so the number it
 * prints is the number that will go.
 *
 * Uses the SERVICE ROLE key, like every other script here. Run it locally only.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const keepAt = args.indexOf('--keep')
const KEEP = keepAt === -1 ? 4 : Number(args[keepAt + 1])

if (!Number.isFinite(KEEP) || KEEP < 3) {
  console.error(
    `--keep must be at least 3. The daily report reads a 96-hour window, and folding into it\n` +
      `would change the numbers it has already printed.`,
  )
  process.exit(1)
}

const CRED =
  '/Users/thanospangios/Downloads/YT Project/SHort Editor Specialist/football-ev-lab/Supabase Bet-ALL CREDENTIALS.txt'

function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY
  const m = readFileSync(CRED, 'utf8').match(/^Service role:\s*(\S+)/im)
  if (!m) throw new Error('service role key not found')
  return m[1]
}

function supabaseUrl() {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL
  const env = readFileSync(join(ROOT, '.env'), 'utf8').match(/^SUPABASE_URL=(.*)$/m)
  if (!env) throw new Error('SUPABASE_URL not found')
  return env[1].trim()
}

const URL_BASE = supabaseUrl()
const KEY = serviceKey()

async function sql(query) {
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  try {
    return JSON.parse(await res.text())
  } catch {
    return []
  }
}

/** The same boundary compact_site_events() computes. Kept identical on purpose. */
const CUTOFF = `(date_trunc('day', (now() at time zone 'Europe/Athens')) - make_interval(days => ${KEEP})) at time zone 'Europe/Athens'`

const n = (v) => Number(v ?? 0).toLocaleString('en-GB')

console.log(`\nTOTAL FOOTBALL  ·  folding site_events\n${'='.repeat(48)}`)

const [before] = await sql(`
  select
    count(*)                                            as rows,
    count(*) filter (where created_at < ${CUTOFF})      as doomed,
    count(distinct (created_at at time zone 'Europe/Athens')::date)
      filter (where created_at < ${CUTOFF})             as days,
    min(created_at at time zone 'Europe/Athens')::date  as oldest
  from public.site_events`)

const [folded] = await sql(`select count(*) as days, coalesce(sum(events_folded), 0) as events
                            from public.site_events_daily`)

console.log(`\n  raw rows now        ${n(before?.rows)}`)
console.log(`  oldest raw day      ${before?.oldest ?? '-'}`)
console.log(`  already folded      ${n(folded?.days)} days (${n(folded?.events)} events)`)
console.log(`\n  keeping             ${KEEP} days of raw`)
console.log(`  would fold          ${n(before?.doomed)} rows across ${n(before?.days)} days`)

if (!Number(before?.doomed ?? 0)) {
  console.log(`\n  Nothing old enough to fold. Done.\n`)
  process.exit(0)
}

if (DRY) {
  console.log(`\n  --dry: nothing was changed.\n`)
  process.exit(0)
}

const [result] = await sql(`select public.compact_site_events(${KEEP}) as r`)
const r = result?.r ?? {}

console.log(`\n  folded              ${n(r.events)} events into ${n(r.days)} rows`)
if (r.from) console.log(`  covering            ${r.from} → ${r.to}`)

const [after] = await sql(`select count(*) as rows from public.site_events`)
console.log(`  raw rows left       ${n(after?.rows)}`)
console.log(`\n  The folded days are in public.site_events_daily, and`)
console.log(`  public.site_events_history reads both halves as one.\n`)
