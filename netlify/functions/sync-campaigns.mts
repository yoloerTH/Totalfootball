/**
 * Nightly reconciliation of the Supabase audience with the Zoho Campaigns list.
 *
 * The same three phases as `scripts/sync-campaigns.mjs`, on a schedule, because
 * the phase that matters most is the one a human is least likely to remember:
 * pushing OUR opt-outs up to Campaigns. Somebody clicks the unsubscribe link in
 * an email, the site records it correctly and tells them they are unsubscribed
 * — and Campaigns, which sends the newsletters, has not been told. Left to a
 * manual script, the window between those two facts is however long it is until
 * somebody next runs it. On a schedule it is at most a day.
 *
 * It is also the cheapest possible guard against the reverse: an unsubscribe
 * made through Campaigns' own footer, or a hard bounce, which our database
 * cannot see at all until something reads it back down.
 *
 * ── SAFETY ──────────────────────────────────────────────────────────────────
 *
 * This function never sends anything. It moves list membership and opt-out
 * state only. The worst outcome of a bug here is a contact that fails to sync,
 * which the next run retries.
 *
 * If Campaigns is not configured it logs and exits 'ok' rather than failing —
 * a scheduled function that errors every night until someone finishes a
 * dashboard setup trains you to ignore its alerts.
 *
 * Env (Netlify UI):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
 *   ZOHO_CAMPAIGNS_LISTKEY, ZOHO_DC
 */
import { audience, suppress, suppressedSet } from '../../scripts/lib/audience.mjs'
import {
  addContact,
  unsubscribeContact,
  listContacts,
  campaignsConfigured,
} from '../../scripts/lib/campaigns.mjs'

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default async () => {
  if (!campaignsConfigured()) {
    console.log('sync-campaigns: Campaigns not configured, nothing to do')
    return new Response('skipped')
  }

  const failures: string[] = []

  try {
    /* 1 · Pull Campaigns' opt-outs down. First, so phase 2 cannot push up an
       address it is about to learn has opted out. */
    const remoteUnsub = await listContacts('unsub')
    const remoteBounce = await listContacts('bounce')
    const known = await suppressedSet()

    const newUnsub = remoteUnsub.filter((c) => !known.has(c.email)).map((c) => c.email)
    const newBounce = remoteBounce.filter((c) => !known.has(c.email)).map((c) => c.email)

    if (newUnsub.length) await suppress(newUnsub, { reason: 'unsubscribe', source: 'campaigns' })
    if (newBounce.length) await suppress(newBounce, { reason: 'bounce', source: 'campaigns' })

    /* 2 & 3 · Read the audience AFTER the pull, so anybody just suppressed is
       already excluded from `sendable`. */
    const { sendable, suppressed } = await audience()
    const remoteActive = new Set((await listContacts('active')).map((c) => c.email))
    const remoteKnown = new Set([
      ...remoteActive,
      ...remoteUnsub.map((c) => c.email),
      ...remoteBounce.map((c) => c.email),
    ])

    const toAdd = sendable.filter((r: { email: string }) => !remoteKnown.has(r.email))
    const toUnsubscribe = suppressed.filter((r: { email: string }) => remoteActive.has(r.email))

    // Paced well under Campaigns' 500-calls-a-minute contact limit, which it
    // enforces with a thirty-minute lockout rather than a retryable 429.
    let added = 0
    for (const r of toAdd) {
      try {
        await addContact({ email: r.email, name: r.name, source: r.sources })
        added++
      } catch (err) {
        failures.push(`add ${r.email}: ${err}`)
      }
      await pause(250)
    }

    let removed = 0
    for (const r of toUnsubscribe) {
      try {
        await unsubscribeContact(r.email)
        removed++
      } catch (err) {
        failures.push(`unsubscribe ${r.email}: ${err}`)
      }
      await pause(250)
    }

    console.log(
      `sync-campaigns: recorded ${newUnsub.length} unsubscribes and ${newBounce.length} bounces ` +
        `from Campaigns, added ${added} contacts, unsubscribed ${removed} there` +
        (failures.length ? `, ${failures.length} failure(s)` : ''),
    )
    for (const f of failures.slice(0, 20)) console.error('sync-campaigns:', f)
  } catch (err) {
    console.error('sync-campaigns: failed —', err)
    return new Response('error', { status: 500 })
  }

  return new Response('ok')
}

/**
 * 03:00 UTC daily. Deliberately not near the 18:00 daily-report: the two share
 * a Supabase project and there is no reason to have them contend, and an
 * overnight run means the day's sends read a list that was reconciled hours
 * earlier rather than minutes.
 */
export const config = { schedule: '0 3 * * *' }
