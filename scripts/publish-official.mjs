/**
 * Put the official systems on the network, so they have a thread under them.
 *
 *   node scripts/publish-official.mjs --dry     what would change, writes nothing
 *   node scripts/publish-official.mjs           upsert all ten
 *   node scripts/publish-official.mjs four-zone-rondo
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * `/o/<slug>/` comments are `studio_comments` rows, and every policy on that
 * table in supabase/025 requires the thing being commented on to be a PUBLIC
 * `studio_posts` row. See the header of supabase/032 for why that is reuse
 * rather than a workaround. This script is what makes those ten rows exist, and
 * it is the only writer of `official = true` — the trigger in 032 refuses the
 * flag to anybody holding a user JWT, which is why the service role is needed.
 *
 * ── IDEMPOTENT, AND THE POST ID IS PERMANENT ─────────────────────────────────
 *
 * The ids live in content/official-posts.json, in git, because they are URLs:
 * /p/xcn58dd is a link somebody may have sent to somebody. Regenerating them on
 * each run would break every one of those and orphan every comment written
 * under the old row, so the file is the source and this script never invents an
 * id. Re-running it republishes the CONTENT of a row — the document, the title,
 * the summary — against the same id, which is exactly what you want after
 * editing a system in content/systems/.
 *
 * ── WHAT IT DELIBERATELY DOES NOT TOUCH ──────────────────────────────────────
 *
 * `published_at`. It is the feed's sort key and half of the Featured ranking, so
 * re-running this after a typo fix would otherwise shove all ten systems back to
 * the top of the network over everybody else's work. Set on insert, never on
 * update.
 *
 * Counters too — `reaction_count`, `comment_count`, `fork_count` and friends are
 * owned by the triggers in 025 and a blind upsert of the whole row would zero
 * what the triggers have been keeping. The update list below is explicit for
 * that reason, not for tidiness.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** The account the official systems are built on. Same one pull-system.mjs uses. */
const OWNER = '04189c96-21fb-4772-9177-408856ec2c46'

/** studio_posts.summary is capped at 280 by a CHECK; fail early and readably. */
const SUMMARY_MAX = 280
const TITLE_MAX = 120

function envVar(name) {
  if (process.env[name]) return process.env[name]
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8')
    const m = raw.match(new RegExp(`^${name}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^"(.*)"$/, '$1') : ''
  } catch {
    return ''
  }
}

function creds() {
  const url = envVar('SUPABASE_URL')
  const key = envVar('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in env or .env')
  }
  return {
    url,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  }
}

async function rest(path, init = {}) {
  const { url, headers } = creds()
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...init.headers } })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status} on ${path}: ${text}`)
  return text ? JSON.parse(text) : null
}

/**
 * The feed's one-line description of a system, taken FROM THE DOCUMENT.
 *
 * Not from `teaches` in src/studio/templates.ts, and that is a decision rather
 * than an omission. `teaches` answers "is this worth my next ten minutes" to
 * somebody looking at a grid of cards they can open; a feed summary sits under a
 * board that is already playing and says what the board is. They are different
 * sentences for different moments, and more to the point `teaches` lives in a
 * TypeScript module this script would have to parse to read.
 *
 * The subtitle first, because that is the line the coach wrote for exactly this
 * job. Then the first phase that has a caption, because a caption is also a
 * sentence written about this system by the person who built it. The title is
 * the last resort and is never wrong, only redundant.
 */
function summaryFor(doc) {
  const subtitle = (doc.subtitle ?? '').trim()
  if (subtitle) return subtitle.slice(0, SUMMARY_MAX)
  for (const act of doc.acts ?? []) {
    const caption = (act.caption ?? '').trim()
    if (caption) return caption.slice(0, SUMMARY_MAX)
  }
  return (doc.title ?? '').trim().slice(0, SUMMARY_MAX)
}

function load(entry) {
  const file = join(ROOT, 'content', 'systems', `${entry.system}.json`)
  const doc = JSON.parse(readFileSync(file, 'utf8'))

  const faults = []
  const title = (doc.title ?? '').trim()
  if (!title) faults.push('no title')
  if (title.length > TITLE_MAX) faults.push(`title is ${title.length} chars, max ${TITLE_MAX}`)
  if (!Array.isArray(doc.acts) || doc.acts.length === 0) faults.push('no phases')

  // The share id and our credit line never reach a published row, for the same
  // reason pull-system.mjs strips them out of the repo: a document carrying our
  // share id is a live link to a system we published, sitting inside a row a
  // stranger can fork.
  const { shareId: _shareId, credit: _credit, ...clean } = doc

  // `cover_act` is checked `between 0 and 199` in 025 and must also be a phase
  // this system actually has, or the feed opens on a frame that is not there.
  const cover = Number.isInteger(entry.coverAct) ? entry.coverAct : 0
  const coverAct = Math.max(0, Math.min(cover, (clean.acts?.length ?? 1) - 1))
  if (cover !== coverAct) {
    faults.push(`coverAct ${cover} is past the last phase (${clean.acts.length}); clamped to ${coverAct}`)
  }

  return { doc: clean, title, summary: summaryFor(clean), coverAct, faults }
}

async function main() {
  const args = process.argv.slice(2)
  const dry = args.includes('--dry')
  const only = args.filter((a) => !a.startsWith('--'))

  const map = JSON.parse(readFileSync(join(ROOT, 'content', 'official-posts.json'), 'utf8'))
  const wanted = only.length ? map.filter((m) => only.includes(m.template)) : map
  if (!wanted.length) {
    throw new Error(`No official system named ${only.join(', ')}. See content/official-posts.json.`)
  }

  // Every fault from every system before anything is written, rather than
  // throwing on the first: one run should produce the whole punch list.
  const rows = wanted.map((entry) => ({ entry, ...load(entry) }))
  const broken = rows.filter((r) => r.faults.length)
  if (broken.length) {
    console.error('\nProblems:\n')
    for (const r of broken) {
      for (const f of r.faults) console.error(`  ${r.entry.template.padEnd(24)} ${f}`)
    }
    console.error('')
  }

  const ids = wanted.map((m) => m.post)
  const existing = await rest(
    `studio_posts?id=in.(${ids.join(',')})&select=id,title,official,visibility,comment_count`,
  )
  const have = new Map(existing.map((r) => [r.id, r]))

  for (const { entry, doc, title, summary, coverAct } of rows) {
    const prior = have.get(entry.post)
    const verb = prior ? 'update' : 'insert'
    const kb = (JSON.stringify(doc).length / 1024).toFixed(1)

    if (dry) {
      console.log(
        `  ${verb.padEnd(6)} ${entry.post}  ${title.padEnd(38)} ${String(doc.acts.length).padStart(2)} phases  ${kb.padStart(5)}KB` +
          (prior ? `  (${prior.comment_count} comments kept)` : ''),
      )
      continue
    }

    if (prior) {
      // Named columns only. See the header: published_at and every counter are
      // not ours to rewrite.
      await rest(`studio_posts?id=eq.${entry.post}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          doc,
          title,
          summary,
          media: 'video',
          cover_act: coverAct,
          visibility: 'public',
          official: true,
        }),
      })
    } else {
      await rest('studio_posts', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          id: entry.post,
          owner: OWNER,
          doc,
          title,
          summary,
          // 'video': the document plays in the reader's browser through the same
          // tween engine the studio uses. A ten-phase system shown as one still
          // is a system with its idea hidden.
          media: 'video',
          cover_act: coverAct,
          visibility: 'public',
          official: true,
        }),
      })
    }
    console.log(`  ${verb.padEnd(6)} ${entry.post}  ${title} — ${doc.acts.length} phases, ${kb}KB`)
  }

  if (dry) console.log('\n--dry: nothing was written.')
  else console.log(`\n${rows.length} official system${rows.length === 1 ? '' : 's'} on the network.`)

  if (broken.length) process.exitCode = 1
}

main().catch((err) => {
  console.error(`\n${err.message}\n`)
  process.exit(1)
})
