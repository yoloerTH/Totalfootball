import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

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
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }
}

async function findUser() {
  const { url, headers } = creds()
  const res = await fetch(`${url}/auth/v1/admin/users`, { headers })
  if (!res.ok) throw new Error(await res.text())
  const accounts = await res.json()
  console.log(JSON.stringify(accounts, null, 2))
}

findUser().catch(console.error)
