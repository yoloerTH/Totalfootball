/**
 * Read the analytics back. There is no dashboard, so this is the dashboard.
 *
 *   node scripts/analytics-report.mjs            last 30 days
 *   node scripts/analytics-report.mjs 7          last 7 days
 *
 * Uses the SERVICE ROLE key, because anon deliberately cannot read the table.
 * Run it locally only; never expose it.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DAYS = Number(process.argv[2] || 30)

const CRED =
  '/Users/thanospangios/Downloads/YT Project/SHort Editor Specialist/football-ev-lab/Supabase Bet-ALL CREDENTIALS.txt'

function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY
  const m = readFileSync(CRED, 'utf8').match(/^Service role:\s*(\S+)/mi)
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
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return []
  }
}

const SINCE = `now() - interval '${DAYS} days'`
const ms = (v) => (v == null ? '-' : `${(Number(v) / 1000).toFixed(0)}s`)

function table(rows, cols) {
  if (!rows.length) return '  (nothing yet)'
  const w = cols.map((c) => Math.max(c.label.length, ...rows.map((r) => String(c.get(r)).length)))
  const line = (cells) => '  ' + cells.map((c, i) => String(c).padEnd(w[i])).join('   ')
  return [
    line(cols.map((c) => c.label)),
    '  ' + w.map((n) => '-'.repeat(n)).join('   '),
    ...rows.map((r) => line(cols.map((c) => c.get(r)))),
  ].join('\n')
}

console.log(`\nTOTAL FOOTBALL  ·  last ${DAYS} days\n${'='.repeat(48)}`)

/*
 * HOW FAR BACK THE RAW ROWS ACTUALLY GO.
 *
 * Every section below reads public.site_events, which now only holds the last
 * few days — everything older is folded into one row per day and the rows are
 * deleted (supabase/009_site_events_rollup.sql). Ask this script for 30 days
 * after a fold and the queries still run, still return rows, and are now
 * describing four days while the heading says thirty.
 *
 * So the horizon is read first and said plainly, and the whole history is
 * printed from the rollup underneath it. A tool that quietly narrows its own
 * window is worse than one that has no window at all.
 */
const [horizon] = await sql(`
  select
    min(created_at at time zone 'Europe/Athens')::date as oldest,
    round(extract(epoch from (now() - min(created_at))) / 86400)::int as days
  from public.site_events`)

const RAW_DAYS = Number(horizon?.days ?? 0)
const NARROWED = horizon?.oldest && RAW_DAYS + 1 < DAYS

if (NARROWED) {
  console.log(`
  NOTE  Detailed events only go back to ${horizon.oldest} (${RAW_DAYS} days).
        Everything older was folded into public.site_events_daily, so the
        sections below cover ${RAW_DAYS} days, not ${DAYS}. Whole history is at
        the foot of this report, and in that table.`)
}

const [overview] = await sql(`
  select
    count(*) filter (where type = 'pageview')            as pageviews,
    count(distinct session_id)                            as visits,
    count(*) filter (where type = 'click')                as clicks
  from public.site_events where created_at >= ${SINCE}`)

const [timing] = await sql(`
  select
    round(avg(total)) as avg_visit_ms,
    round(avg(per_page)) as avg_page_ms
  from (
    select session_id, sum(duration_ms) as total, avg(duration_ms) as per_page
    from public.site_events
    where type = 'duration' and created_at >= ${SINCE}
    group by session_id
  ) s`)

console.log(`
  Visits          ${overview?.visits ?? 0}
  Page views      ${overview?.pageviews ?? 0}
  Pages / visit   ${overview?.visits ? (overview.pageviews / overview.visits).toFixed(2) : '0'}
  Avg on a page   ${ms(timing?.avg_page_ms)}
  Avg per visit   ${ms(timing?.avg_visit_ms)}
  Clicks tracked  ${overview?.clicks ?? 0}`)

console.log('\nTOP PAGES')
console.log(
  table(
    await sql(`
      select v.path,
             count(*) as views,
             count(distinct v.session_id) as visitors,
             (select round(avg(d.duration_ms)) from public.site_events d
               where d.type = 'duration' and d.path = v.path and d.created_at >= ${SINCE}) as avg_ms
      from public.site_events v
      where v.type = 'pageview' and v.created_at >= ${SINCE}
      group by v.path order by views desc limit 15`),
    [
      { label: 'PATH', get: (r) => r.path },
      { label: 'VIEWS', get: (r) => r.views },
      { label: 'VISITORS', get: (r) => r.visitors },
      { label: 'AVG TIME', get: (r) => ms(r.avg_ms) },
    ]
  )
)

// Marketing clicks only. The studio's own events share the `click` type and get
// their own section below, because "somebody pressed Share" and "somebody
// clicked a nav link" are not the same kind of fact and should not be ranked
// against each other in one list.
console.log('\nCLICKS')
console.log(
  table(
    await sql(`select label, count(*) as n from public.site_events
               where type = 'click' and label is not null and label not like 'studio:%'
                 and created_at >= ${SINCE}
               group by label order by n desc limit 15`),
    [
      { label: 'LABEL', get: (r) => r.label },
      { label: 'COUNT', get: (r) => r.n },
    ]
  )
)

// ── The studio ──────────────────────────────────────────────────────────────
// What was actually built, as opposed to what was read about. Labels come from
// src/studio/track.ts; `/s/:id` is the normalised share path from
// netlify/functions/track.mts.
console.log('\nSTUDIO')
console.log(
  table(
    await sql(`select replace(label, 'studio:', '') as event, count(*) as n
               from public.site_events
               where type = 'click' and label like 'studio:%' and created_at >= ${SINCE}
               group by label order by n desc limit 15`),
    [
      { label: 'EVENT', get: (r) => r.event },
      { label: 'COUNT', get: (r) => r.n },
    ]
  )
)

const [shares] = await sql(`
  select
    (select count(*) from public.studio_shares where created_at >= ${SINCE})   as published,
    (select count(*) from public.studio_shares)                                as total,
    (select count(*) from public.site_events
      where type = 'pageview' and path = '/s/:id' and created_at >= ${SINCE})  as opens,
    (select count(distinct session_id) from public.site_events
      where type = 'pageview' and path = '/s/:id' and created_at >= ${SINCE})  as openers`)

console.log(`
  Systems published   ${shares?.published ?? 0}
  Published, ever     ${shares?.total ?? 0}
  Shared links opened ${shares?.opens ?? 0}  (by ${shares?.openers ?? 0})`)

console.log('\nREFERRERS')
console.log(
  table(
    await sql(`select coalesce(referrer, '(direct)') as src, count(distinct session_id) as visits
               from public.site_events where type = 'pageview' and created_at >= ${SINCE}
               group by src order by visits desc limit 10`),
    [
      { label: 'SOURCE', get: (r) => r.src },
      { label: 'VISITS', get: (r) => r.visits },
    ]
  )
)

console.log('\nDEVICE / COUNTRY')
console.log(
  table(
    await sql(`select coalesce(device,'?') as device, coalesce(country,'?') as country,
                      count(distinct session_id) as visits
               from public.site_events where type = 'pageview' and created_at >= ${SINCE}
               group by device, country order by visits desc limit 10`),
    [
      { label: 'DEVICE', get: (r) => r.device },
      { label: 'COUNTRY', get: (r) => r.country },
      { label: 'VISITS', get: (r) => r.visits },
    ]
  )
)

/*
 * What coaches said.
 *
 * Last, and printed as whole sentences rather than squeezed into the table
 * helper. Every other section here is a count you scan; this is the only one
 * you read, and a note chopped into a fixed-width column to keep the borders
 * straight is a note nobody finishes. The daily Telegram report sends each of
 * these as its own message for the same reason.
 */
const stars = (v) => {
  if (v == null) return '-'
  const full = Math.floor(Number(v))
  const half = Number(v) - full >= 0.5
  return '*'.repeat(full) + (half ? '.' : '') + ' '.repeat(Math.max(0, 5 - full - (half ? 1 : 0))) + ` ${v}/5`
}

const feedback = await sql(`select rating, recommend, note, context,
    to_char(created_at at time zone 'Europe/Athens', 'DD Mon HH24:MI') as at
  from public.studio_feedback where created_at >= ${SINCE}
  order by created_at desc, id desc limit 40`)

const [fbAll] = await sql(`select count(*) as n, round(avg(rating), 2) as avg_rating,
    round(avg(recommend), 1) as avg_rec
  from public.studio_feedback`)

console.log('\nFEEDBACK')
if (!feedback.length) {
  console.log('  (nothing in this window)')
} else {
  for (const f of feedback) {
    console.log(`  ${f.at}  ${stars(f.rating)}  tell-a-friend ${f.recommend ?? '-'}/10  (${f.context})`)
    if (f.note) {
      // Wrapped by hand at 76 so a long note stays inside a terminal without
      // depending on the terminal to break it somewhere sensible.
      const words = String(f.note).split(/\s+/)
      let line = ''
      for (const w of words) {
        if ((line + ' ' + w).trim().length > 76) {
          console.log(`      ${line.trim()}`)
          line = w
        } else line += ' ' + w
      }
      if (line.trim()) console.log(`      ${line.trim()}`)
    }
    console.log()
  }
}
if (fbAll && Number(fbAll.n) > 0) {
  console.log(`  all time: ${fbAll.n} answer${Number(fbAll.n) === 1 ? '' : 's'} · ${fbAll.avg_rating ?? '-'}/5 · would mention ${fbAll.avg_rec ?? '-'}/10`)
}

/*
 * The whole history, from the rollup.
 *
 * Reads public.site_events_history, which unions the folded days with the raw
 * tail aggregated the same way — so this is the one section that means the same
 * thing before and after a fold, and the one to read for a trend. Per day,
 * newest first, because what a month looked like is a shape rather than a
 * total.
 */
const history = await sql(`
  select to_char(day, 'DD Mon YY') as day, pageviews, visits, clicks,
         avg_duration_ms, raw
  from public.site_events_history
  where day >= (now() at time zone 'Europe/Athens')::date - ${DAYS}
  order by day desc`)

console.log(`\nBY DAY  ·  folded history + raw tail`)
console.log(
  table(history, [
    { label: 'DAY', get: (r) => r.day },
    { label: 'VISITS', get: (r) => r.visits ?? 0 },
    { label: 'VIEWS', get: (r) => r.pageviews ?? 0 },
    { label: 'CLICKS', get: (r) => r.clicks ?? 0 },
    { label: 'AVG TIME', get: (r) => ms(r.avg_duration_ms) },
    // Which half of the union a row came from. A raw day is still complete and
    // still being written to; a folded one will never change again.
    { label: '', get: (r) => (r.raw ? 'raw' : '') },
  ])
)

console.log('\nSUBSCRIBERS BY SOURCE')
console.log(
  table(
    await sql(`select source, count(*) as n from public.subscribers group by source order by n desc`),
    [
      { label: 'SOURCE', get: (r) => r.source },
      { label: 'COUNT', get: (r) => r.n },
    ]
  )
)
console.log()
