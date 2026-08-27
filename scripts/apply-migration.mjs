/**
 * Apply a numbered migration to the remote database, and say what happened.
 *
 *   node scripts/apply-migration.mjs supabase/012_studio_identity.sql
 *   node scripts/apply-migration.mjs supabase/012_studio_identity.sql --dry
 *
 * Until now every file in supabase/ was pasted into the dashboard by hand, and
 * docs/STUDIO.md §7 lists three ways to do it, two of which need a personal
 * access token nobody has to hand. This is the fourth: the same
 * `public.execute_sql` route the reporting scripts already use, with the same
 * service-role key already in .env.
 *
 * ── ONE STATEMENT AT A TIME, AND IT COLLECTS ─────────────────────────────────
 *
 * `execute_sql` (supabase/006) tries the text as a SELECT first and only runs it
 * as-is from its exception handler. Hand it a whole file and you get one opaque
 * answer for forty statements. Split it, run them in order, and a failure names
 * the statement that caused it — and the run CONTINUES, so one pass gives the
 * whole punch list rather than the first thing that went wrong.
 *
 * Every file in supabase/ is written to be idempotent, so re-running after a fix
 * is safe and is the intended way to use this.
 *
 * Uses the SERVICE ROLE key. Run it locally only; never expose it.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

function fromEnv(name) {
  if (process.env[name]) return process.env[name]
  const m = readFileSync(join(ROOT, '.env'), 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'))
  if (!m) throw new Error(`${name} not found in the environment or .env`)
  return m[1].trim()
}

const URL_BASE = fromEnv('SUPABASE_URL')
const KEY = fromEnv('SUPABASE_SERVICE_ROLE_KEY')

export async function sql(query) {
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text}`)
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Split a migration into statements, honestly.
 *
 * ── IT USED TO REFUSE, AND REFUSING WAS COSTING MORE THAN IT SAVED ───────────
 *
 * The first version stripped `--` lines and split on `;`, and threw if it saw a
 * dollar sign, because the semicolons inside a `$$ … $$` function body are not
 * statement separators and splitting on them produces garbage. That was the
 * right instinct and the wrong remedy: every migration that defines a trigger
 * function — 005, 013 — fell into the hole, and "paste it into the dashboard"
 * is exactly the manual step this script exists to remove.
 *
 * So it scans instead of guessing. One pass over the text, tracking the four
 * things that make a semicolon not a separator:
 *
 *   · a single-quoted string, `''` being an escaped quote rather than an end,
 *   · a double-quoted identifier,
 *   · a `--` line comment, and `/* *' + '/` block comments, which nest in Postgres,
 *   · a dollar-quoted body, which ends only on its OWN tag — `$$`, `$fn$` —
 *     so a `$$` inside a `$body$` block is just text.
 *
 * Comments are dropped as it goes, which is what makes the progress lines below
 * read as SQL rather than as prose.
 */
export function statements(text) {
  const out = []
  let buf = ''
  let i = 0

  while (i < text.length) {
    const rest = text.slice(i)

    // A dollar-quoted body: copied through whole, semicolons and all.
    const open = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rest)
    if (open) {
      const tag = open[0]
      const end = text.indexOf(tag, i + tag.length)
      if (end === -1) throw new Error(`Unterminated ${tag} body in the migration.`)
      buf += text.slice(i, end + tag.length)
      i = end + tag.length
      continue
    }

    const c = text[i]

    if (c === "'" || c === '"') {
      const quote = c
      let j = i + 1
      while (j < text.length) {
        if (text[j] === quote) {
          // A doubled quote is an escaped one, not the end of the literal.
          if (text[j + 1] === quote) j += 2
          else break
        } else j += 1
      }
      buf += text.slice(i, j + 1)
      i = j + 1
      continue
    }

    if (c === '-' && text[i + 1] === '-') {
      const nl = text.indexOf('\n', i)
      i = nl === -1 ? text.length : nl
      continue
    }

    if (c === '/' && text[i + 1] === '*') {
      // Postgres block comments nest, so this counts rather than searching for
      // the first close.
      let depth = 1
      let j = i + 2
      while (j < text.length && depth > 0) {
        if (text[j] === '/' && text[j + 1] === '*') { depth += 1; j += 2 }
        else if (text[j] === '*' && text[j + 1] === '/') { depth -= 1; j += 2 }
        else j += 1
      }
      i = j
      continue
    }

    if (c === ';') {
      if (buf.trim()) out.push(buf.trim())
      buf = ''
      i += 1
      continue
    }

    buf += c
    i += 1
  }

  // A trailing statement with no semicolon is still a statement.
  if (buf.trim()) out.push(buf.trim())
  return out
}

// Only drive the CLI when this file IS the command. `sql` and `statements` are
// exported so a verification script can reach the database through exactly the
// same path the migration took, rather than a second copy of the same fetch.
const isEntry = process.argv[1] && process.argv[1].endsWith('apply-migration.mjs')
const file = process.argv[2]
const dry = process.argv.includes('--dry')

if (!isEntry) {
  // imported for `sql` / `statements`
} else if (!file) {
  console.error('usage: node scripts/apply-migration.mjs <file.sql> [--dry]')
  process.exit(2)
} else {
  await run()
}

async function run() {

  const list = statements(readFileSync(join(ROOT, file), 'utf8'))
  console.log(`${file}: ${list.length} statements${dry ? ' (dry run, nothing sent)' : ''}\n`)

  const failed = []
  for (const [i, statement] of list.entries()) {
    const n = String(i + 1).padStart(2)
    const label = statement.replace(/\s+/g, ' ').slice(0, 74)
    if (dry) {
      console.log(`  ..   ${n}  ${label}`)
      continue
    }
    try {
      await sql(statement)
      console.log(`  ok   ${n}  ${label}`)
    } catch (e) {
      console.log(`  FAIL ${n}  ${label}`)
      console.log(`         ${String(e.message).replace(/\s+/g, ' ').slice(0, 400)}`)
      failed.push(i + 1)
    }
  }

  if (dry) process.exit(0)
  console.log(
    failed.length ? `\n${failed.length} failed: ${failed.join(', ')}` : '\nAll statements applied.',
  )
  process.exit(failed.length ? 1 : 0)
}
