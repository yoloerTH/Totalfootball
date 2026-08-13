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

/**
 * Runs through `public.execute_sql`, a SECURITY DEFINER function that belongs
 * to postgres and is granted to service_role ONLY — anon cannot reach it and a
 * request carrying the anon key gets a 401. It is not in the numbered
 * migrations because it was created by hand in the SQL editor; see
 * supabase/006_reporting.sql, which now captures it so a restored database
 * still has a working report.
 */
async function query(sqlText: string): Promise<Row[]> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set')

  const res = await fetch(`${url}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sqlText }),
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

/** Sections whose query failed, named in the message rather than swallowed. */
const failed: string[] = []

/**
 * ONE BAD QUERY MUST NOT COST THE WHOLE REPORT.
 *
 * Every figure below used to be awaited straight off `sql()`, so a single
 * failure — a renamed column, a table that has not been migrated yet, a
 * statement timeout on a slow night — threw out of the handler and nothing was
 * sent at all. The failure mode was total silence, which reads exactly like a
 * quiet day, which is the one thing a daily report must never be ambiguous
 * about.
 *
 * So each section is asked for by name, and a section that cannot be answered
 * is left out and listed at the foot of the message. A report with five of six
 * sections and a line saying which one is missing beats no report.
 */
async function sql(section: string, sqlText: string): Promise<Row[]> {
  try {
    return await query(sqlText)
  } catch (err) {
    console.error(`daily-report: ${section} failed —`, err)
    if (!failed.includes(section)) failed.push(section)
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
  // Module scope survives between invocations on a warm container, so yesterday's
  // failures must not be reported as today's.
  failed.length = 0

  const WINDOW = "now() - interval '24 hours'"
  const PRIOR = "now() - interval '48 hours' and created_at < now() - interval '24 hours'"

  const [totals] = await sql(
    'traffic',
    `select
      count(*) filter (where type = 'pageview')                       as pageviews,
      count(distinct session_id) filter (where type = 'pageview')     as visits,
      count(*) filter (where type = 'click')                          as clicks
    from public.site_events where created_at >= ${WINDOW}`
  )

  const [prior] = await sql(
    'yesterday',
    `select
      count(*) filter (where type = 'pageview')                       as pageviews,
      count(distinct session_id) filter (where type = 'pageview')     as visits
    from public.site_events where created_at >= ${PRIOR}`
  )

  const [timing] = await sql(
    'time on page',
    `select round(avg(duration_ms)) as avg_page
    from public.site_events
    where type = 'duration' and created_at >= ${WINDOW}`
  )

  const pages = await sql(
    'most read',
    `select path, count(*) as views, count(distinct session_id) as visitors
    from public.site_events
    where type = 'pageview' and created_at >= ${WINDOW}
    group by path order by views desc, path limit 6`
  )

  /**
   * Marketing clicks only. Studio events share the same `click` type — there is
   * no other event type and no reason to invent one — so they are split out
   * here and reported under the studio, where they mean something. Without the
   * split, "Clicks" would be a mixed list in which pressing Share and pressing
   * a nav link sit side by side as if they were the same kind of thing.
   */
  const clicks = await sql(
    'clicks',
    `select label, count(*) as n from public.site_events
    where type = 'click' and label is not null and label not like 'studio:%'
      and created_at >= ${WINDOW}
    group by label order by n desc limit 5`
  )

  const refs = await sql(
    'referrers',
    `select coalesce(referrer, 'direct') as src, count(distinct session_id) as v
    from public.site_events
    where type = 'pageview' and created_at >= ${WINDOW}
    group by src order by v desc limit 5`
  )

  const countries = await sql(
    'countries',
    `select coalesce(country, '?') as c, count(distinct session_id) as v
    from public.site_events
    where type = 'pageview' and created_at >= ${WINDOW}
    group by c order by v desc limit 4`
  )

  const subs = await sql(
    'signups',
    `select source, count(*) as n from public.subscribers
    where created_at >= ${WINDOW} group by source order by n desc`
  )

  const [subTotal] = await sql('list size', `select count(*) as n from public.subscribers`)

  // Early-access places taken. Not shown anywhere public, on purpose: a visible
  // counter reading a small number undercuts a limited-places offer. Here it is
  // exactly the number worth watching.
  const [spots] = await sql('early access', `select public.course_spots_taken() as taken`)

  // ── the studio ────────────────────────────────────────────────────────────
  // The product half of the site, which this report was blind to until now: it
  // could say how many people read about the studio and nothing about whether
  // any of them built anything.

  /** What coaches did in the tool. `studio:` labels come from src/studio/track.ts. */
  const studioEvents = await sql(
    'studio events',
    `select label, count(*) as n from public.site_events
    where type = 'click' and label like 'studio:%' and created_at >= ${WINDOW}
    group by label order by n desc limit 8`
  )

  /**
   * Systems published, and links opened. `created_at = updated_at` is a first
   * publish; anything else is a coach refreshing a link they had already sent,
   * which is a different and quieter kind of good.
   */
  const [shares] = await sql(
    'shares',
    `select
      count(*) filter (where created_at >= ${WINDOW})                 as published,
      count(*) filter (where updated_at >= ${WINDOW}
                         and created_at < ${WINDOW})                  as updated,
      count(*)                                                        as total
    from public.studio_shares`
  )

  const [opened] = await sql(
    'shares opened',
    `select
      count(*)                    as views,
      count(distinct session_id)  as people
    from public.site_events
    where type = 'pageview' and path = '/s/:id' and created_at >= ${WINDOW}`
  )

  /**
   * Accounts. Queried last and separately because supabase/005 may not be
   * applied yet — if the tables are not there this section simply does not
   * appear, which is the whole reason every query above is named.
   */
  const [accounts] = await sql(
    'accounts',
    `select
      (select count(*) from public.studio_profiles)                              as coaches,
      (select count(*) from public.studio_profiles where created_at >= ${WINDOW}) as new_coaches,
      (select count(*) from public.studio_systems)                              as systems,
      (select count(*) from public.studio_systems where created_at >= ${WINDOW})  as new_systems`
  )

  const visits = Number(totals?.visits ?? 0)
  const views = Number(totals?.pageviews ?? 0)
  const newSubs = subs.reduce((a, r) => a + Number(r.n), 0)

  const published = Number(shares?.published ?? 0)
  const refreshed = Number(shares?.updated ?? 0)
  const opens = Number(opened?.views ?? 0)
  const newSystems = Number(accounts?.new_systems ?? 0)
  /** Did anything happen in the product today? Decides whether it gets a section. */
  const studioMoved =
    published + refreshed + opens + newSystems + studioEvents.length > 0

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  const L: string[] = []
  L.push(`⚽️ <b>TOTAL FOOTBALL · DAILY</b>`)
  L.push(`<i>${esc(today)} · last 24 hours</i>`)
  L.push('')

  if (visits === 0 && newSubs === 0 && !studioMoved) {
    // A quiet day is information too. Say it plainly instead of sending an
    // impressive-looking report made of zeroes.
    L.push('No visits recorded in the last 24 hours.')
    L.push('')
    L.push(`Total subscribers: <b>${Number(subTotal?.n ?? 0)}</b>`)
    L.push(`Early access claimed: <b>${Number(spots?.taken ?? 0)}</b>/100`)
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

    // ── the studio ────────────────────────────────────────────────────────
    // Below the traffic, above the list: reading is the top of the funnel,
    // building is the middle, and joining the list is what a reader does when
    // they are not ready to build yet.
    if (studioMoved) {
      L.push('', '🎛 <b>The studio</b>')

      const made: string[] = []
      if (published) made.push(`<b>${published}</b> published`)
      if (refreshed) made.push(`<b>${refreshed}</b> refreshed`)
      if (newSystems) made.push(`<b>${newSystems}</b> new system${newSystems === 1 ? '' : 's'}`)
      if (made.length) L.push(made.join(' · '))

      if (opens) {
        L.push(
          `🔗 <b>${opens}</b> shared link open${opens === 1 ? '' : 's'} by ` +
            `<b>${Number(opened?.people ?? 0)}</b>`
        )
      }

      if (studioEvents.length) {
        for (const e of studioEvents) {
          L.push(`• ${esc(String(e.label).replace(/^studio:/, ''))} — ${e.n}`)
        }
      }

      if (accounts) {
        const newCoaches = Number(accounts.new_coaches ?? 0)
        L.push(
          `👤 <b>${Number(accounts.coaches ?? 0)}</b> coaches` +
            (newCoaches ? ` <i>(+${newCoaches})</i>` : '') +
            ` · <b>${Number(accounts.systems ?? 0)}</b> systems saved`
        )
      }
      if (shares) L.push(`Shares in total: <b>${Number(shares.total ?? 0)}</b>`)
    }

    L.push('', `📬 <b>${newSubs}</b> new subscriber${newSubs === 1 ? '' : 's'}`)
    if (subs.length) L.push(subs.map((s) => `${esc(s.source)} (${s.n})`).join(' · '))
    L.push(`Total list: <b>${Number(subTotal?.n ?? 0)}</b>`)
    L.push(`🎟 Early access claimed: <b>${Number(spots?.taken ?? 0)}</b>/100`)
  }

  /**
   * Anything that could not be answered, named. A missing section is a fault to
   * be fixed, and a report that hides its own gaps is worse than one that owns
   * them — a zero and a broken query look identical otherwise.
   */
  if (failed.length) {
    L.push('', `⚠️ <i>No data for: ${esc(failed.join(', '))}</i>`)
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

  console.log(
    `daily-report: sent (${visits} visits, ${newSubs} signups, ${published} published` +
      `${failed.length ? `, ${failed.length} section(s) missing: ${failed.join(', ')}` : ''})`
  )
  return new Response('ok')
}

/** 18:00 UTC daily, which is 21:00 in Athens. Cron is always UTC on Netlify. */
export const config = { schedule: '0 18 * * *' }
