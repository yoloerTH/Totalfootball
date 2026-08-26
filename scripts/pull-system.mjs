/**
 * Take a system out of a studio account and put it in content/systems/.
 *
 * Usage:
 *
 *   node scripts/pull-system.mjs smt63tcvi44vo
 *        Writes content/systems/the-4-1-4-1-press.json, slug from the title.
 *
 *   node scripts/pull-system.mjs smt63tcvi44vo --as the-trap-springs
 *        Same, under a slug you choose. The slug is the FILENAME only; the
 *        template id in src/studio/templates.ts is separate and permanent.
 *
 *   node scripts/pull-system.mjs --list [--owner <uuid>]
 *        What is on the account, so you can find the id you want.
 *
 * WHY THIS EXISTS
 *
 * The five systems in content/systems/ were authored as files. The official
 * ones are not: they are built in the studio, on the account, because that is
 * where the films get made. So there has to be a way down from the account to
 * the repo, and it has to be a script rather than a copy-paste, because the
 * thing being moved is 35KB of JSON that nobody can eyeball for damage.
 *
 * WHAT IT STRIPS, AND WHY
 *
 * `shareId` and `credit` come off on the way out. `fromTemplate()` already
 * strips both at runtime, so this is belt and braces — but it is the half that
 * matters in git. A committed document carrying our share id is a live link to
 * our published system sitting in the repo, and the day someone adds a code
 * path that publishes a template without going through `fromTemplate`, it
 * publishes over the link we sent. Better that the value is simply not there.
 *
 * It uses the SERVICE ROLE key. `studio_systems` is RLS-scoped to its owner
 * (supabase/005_studio_accounts.sql), so the anon key cannot read a row of
 * somebody else's shelf and this script has no user to be.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT_DIR = join(ROOT, 'content', 'systems')

/** The account the official systems are built on. Override with --owner. */
const DEFAULT_OWNER = '04189c96-21fb-4772-9177-408856ec2c46'

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
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}` } }
}

async function query(path) {
  const { url, headers } = creds()
  const res = await fetch(`${url}/rest/v1/${path}`, { headers })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
  return res.json()
}

/**
 * "The 4-1-4-1 Press" → "the-4-1-4-1-press".
 *
 * Digits and hyphens survive, which matters more here than it looks: a
 * formation IS the name of half of these systems, and a slugger that ate the
 * digits would turn two different shapes into the same filename.
 */
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? null : (process.argv[i + 1] ?? null)
}

async function list(owner) {
  const rows = await query(
    `studio_systems?owner=eq.${owner}&select=id,doc,updated_at&order=updated_at.desc`,
  )
  if (!rows.length) {
    console.log(`No systems on ${owner}.`)
    return
  }
  console.log(`${rows.length} system${rows.length === 1 ? '' : 's'} on ${owner}:\n`)
  for (const row of rows) {
    const title = row.doc?.title?.trim() || '(untitled)'
    const phases = row.doc?.acts?.length ?? 0
    const kb = (JSON.stringify(row.doc).length / 1024).toFixed(1)
    const when = row.updated_at.slice(0, 10)
    console.log(
      `  ${row.id.padEnd(15)} ${title.padEnd(28)} ${String(phases).padStart(2)} phases  ${kb.padStart(5)}KB  ${when}`,
    )
  }
  console.log('\nPull one with:  node scripts/pull-system.mjs <id>')
}

async function pull(id, as) {
  const rows = await query(`studio_systems?id=eq.${encodeURIComponent(id)}&select=doc`)
  if (!rows.length) throw new Error(`No system with id ${id}. Try --list.`)

  const doc = rows[0].doc
  if (!doc || !Array.isArray(doc.acts) || doc.acts.length === 0) {
    throw new Error(`System ${id} has no phases in it.`)
  }

  const title = (doc.title ?? '').trim()
  if (!title && !as) {
    throw new Error(`System ${id} has no title, so there is no slug to make. Pass --as <slug>.`)
  }

  // See the header: these two never reach the repo.
  const { shareId: _shareId, credit: _credit, ...clean } = doc

  const slug = as ?? slugify(title)
  const file = join(OUT_DIR, `${slug}.json`)
  writeFileSync(file, `${JSON.stringify(clean, null, 2)}\n`, 'utf8')

  const kb = (JSON.stringify(clean).length / 1024).toFixed(1)
  console.log(`Wrote content/systems/${slug}.json`)
  console.log(`  ${title || '(untitled)'} — ${clean.acts.length} phases, ${clean.pitch}, ${kb}KB`)
  console.log('\nNow register it in src/studio/templates.ts to put it on the portal.')
}

const owner = arg('owner') ?? DEFAULT_OWNER
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--') && a !== owner && a !== arg('as'))

try {
  if (process.argv.includes('--list')) {
    await list(owner)
  } else if (ids.length === 0) {
    console.log('Usage: node scripts/pull-system.mjs <system-id> [--as <slug>]')
    console.log('       node scripts/pull-system.mjs --list')
    process.exit(1)
  } else {
    // --as only makes sense for one, so it is refused rather than applied twice.
    const as = arg('as')
    if (as && ids.length > 1) throw new Error('--as takes one system at a time.')
    for (const id of ids) await pull(id, as)
  }
} catch (err) {
  console.error(`\n${err.message}\n`)
  process.exit(1)
}
