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
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }
}

async function doIt() {
  const { url, headers } = creds()
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers })
  const data = await res.json()
  const users = data.users || data
  for (const u of users) {
    if (u.email && u.email.toLowerCase().includes('athanasios')) {
      console.log('Found:', u.email, u.id)
    }
    if (u.email && u.email.toLowerCase().includes('naurra')) {
      console.log('Found naurra:', u.email, u.id)
    }
  }
}
doIt().catch(console.error)
