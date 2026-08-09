/**
 * Daily Telegram report: what the site did in the last 24 hours.
 *
 * A Netlify SCHEDULED function, not an edge function. Edge functions run per
 * request at the CDN and cannot be put on a timer; scheduled functions are the
 * primitive with a cron, which is what "once a day" needs.
 *
 * Runs at 18:00 UTC, which is 21:00 in Athens. The window is a rolling 24 hours
 * rather than a calendar day on purpose: it sidesteps every timezone and
 * daylight-saving edge case, and it means the number never depends on which
 * server happened to run the job.
 *
 * Reads with the SERVICE ROLE key because the anon role deliberately cannot
 * read site_events or subscribers back. That key lives only in Netlify's
 * environment and is never sent to a browser.
 *
 * Env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 */

const SITE = 'https://totalfootball.naurra.ai'

type Row = Record<string, any>

async function sql(query: string): Promise<Row[]> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set')

  const res = await fetch(`${url}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`)
  const text = await res.text()
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const secs = (ms: unknown) => (ms == null ? '0s' : `${Math.round(Number(ms) / 1000)}s`)

/** "+12" / "-3" / "level", so a glance tells you the direction. */
function delta(now: number, before: number): string {
  const d = now - before
  if (d === 0) return 'level'
  return `${d > 0 ? '+' : ''}${d}`
}

export default async () => {
  const WINDOW = "now() - interval '24 hours'"
  const PRIOR = "now() - interval '48 hours' and created_at < now() - interval '24 hours'"

  const [totals] = await sql(`
    select
      count(*) filter (where type = 'pageview')                       as pageviews,
      count(distinct session_id) filter (where type = 'pageview')     as visits,
      count(*) filter (where type = 'click')                          as clicks
    from public.site_events where created_at >= ${WINDOW}`)

  const [prior] = await sql(`
    select
      count(*) filter (where type = 'pageview')                       as pageviews,
      count(distinct session_id) filter (where type = 'pageview')     as visits
    from public.site_events where created_at >= ${PRIOR}`)

  const [timing] = await sql(`
    select round(avg(duration_ms)) as avg_page
    from public.site_events
    where type = 'duration' and created_at >= ${WINDOW}`)

  const pages = await sql(`
    select path, count(*) as views, count(distinct session_id) as visitors
    from public.site_events
    where type = 'pageview' and created_at >= ${WINDOW}
    group by path order by views desc, path limit 6`)

  const clicks = await sql(`
    select label, count(*) as n from public.site_events
    where type = 'click' and label is not null and created_at >= ${WINDOW}
    group by label order by n desc limit 5`)

  const refs = await sql(`
    select coalesce(referrer, 'direct') as src, count(distinct session_id) as v
    from public.site_events
    where type = 'pageview' and created_at >= ${WINDOW}
    group by src order by v desc limit 5`)

  const countries = await sql(`
    select coalesce(country, '?') as c, count(distinct session_id) as v
    from public.site_events
    where type = 'pageview' and created_at >= ${WINDOW}
    group by c order by v desc limit 4`)

  const subs = await sql(`
    select source, count(*) as n from public.subscribers
    where created_at >= ${WINDOW} group by source order by n desc`)

  const [subTotal] = await sql(`select count(*) as n from public.subscribers`)

  const visits = Number(totals?.visits ?? 0)
  const views = Number(totals?.pageviews ?? 0)
  const newSubs = subs.reduce((a, r) => a + Number(r.n), 0)

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  const L: string[] = []
  L.push(`⚽️ <b>TOTAL FOOTBALL · DAILY</b>`)
  L.push(`<i>${esc(today)} · last 24 hours</i>`)
  L.push('')

  if (visits === 0 && newSubs === 0) {
    // A quiet day is information too. Say it plainly instead of sending an
    // impressive-looking report made of zeroes.
    L.push('No visits recorded in the last 24 hours.')
    L.push('')
    L.push(`Total subscribers: <b>${Number(subTotal?.n ?? 0)}</b>`)
    L.push(`<a href="${SITE}">${SITE.replace('https://', '')}</a>`)
  } else {
    L.push(
      `👥 <b>${visits}</b> visits <i>(${delta(visits, Number(prior?.visits ?? 0))})</i>`,
      `📄 <b>${views}</b> page views <i>(${delta(views, Number(prior?.pageviews ?? 0))})</i>`,
      `⏱ <b>${secs(timing?.avg_page)}</b> average on a page`,
      `👆 <b>${Number(totals?.clicks ?? 0)}</b> tracked clicks`
    )

    if (pages.length) {
      L.push('', '<b>Most read</b>')
      for (const p of pages) L.push(`• <code>${esc(p.path)}</code> — ${p.views}`)
    }

    if (refs.length) {
      L.push('', '<b>Came from</b>')
      L.push(refs.map((r) => `${esc(r.src)} (${r.v})`).join(' · '))
    }

    if (countries.length) {
      L.push('', '<b>Where</b>')
      L.push(countries.map((c) => `${esc(c.c)} ${c.v}`).join(' · '))
    }

    if (clicks.length) {
      L.push('', '<b>Clicks</b>')
      for (const c of clicks) L.push(`• ${esc(c.label)} — ${c.n}`)
    }

    L.push('', `📬 <b>${newSubs}</b> new subscriber${newSubs === 1 ? '' : 's'}`)
    if (subs.length) L.push(subs.map((s) => `${esc(s.source)} (${s.n})`).join(' · '))
    L.push(`Total list: <b>${Number(subTotal?.n ?? 0)}</b>`)
  }

  const text = L.join('\n')

  const token = process.env.TELEGRAM_BOT_TOKEN
  const chat = process.env.TELEGRAM_CHAT_ID
  if (!token || !chat) {
    console.error('daily-report: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set')
    return new Response('not configured', { status: 500 })
  }

  const send = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chat,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })

  if (!send.ok) {
    const body = await send.text()
    console.error('daily-report: telegram', send.status, body)
    return new Response(`telegram ${send.status}`, { status: 502 })
  }

  console.log(`daily-report: sent (${visits} visits, ${newSubs} signups)`)
  return new Response('ok')
}

/** 18:00 UTC daily, which is 21:00 in Athens. Cron is always UTC on Netlify. */
export const config = { schedule: '0 18 * * *' }
