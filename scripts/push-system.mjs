import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

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
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }
}

async function push(file, owner) {
  const doc = JSON.parse(readFileSync(file, 'utf8'))
  const id = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 5)
  const { url, headers } = creds()
  
  const payload = {
    id,
    owner,
    doc
  }
  
  const res = await fetch(`${url}/rest/v1/studio_systems`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })
  
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${await res.text()}`)
  }
  
  console.log(`Pushed ${file} to account ${owner} with ID: ${id}`)
}

const file = process.argv[2]
if (!file) {
  console.error("Usage: node scripts/push-system.mjs <path-to-json>")
  process.exit(1)
}

push(file, DEFAULT_OWNER).catch(err => {
  console.error(err)
  process.exit(1)
})
