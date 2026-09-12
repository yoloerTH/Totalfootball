import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const sysId = 'co1dn3gikdsdu'
const filePath = join(ROOT, 'content/systems/manipulating-the-block.json')

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
  // 1. Read local file
  const data = JSON.parse(readFileSync(filePath, 'utf8'))
  
  // 2. Fix the poles
  const firstGear = data.acts[0].gear || []
  const firstPoles = firstGear.filter(g => g.kind === 'pole')
  
  for (let i = 1; i < data.acts.length; i++) {
    const act = data.acts[i]
    act.gear = act.gear || []
    
    // Remove existing poles to prevent duplicates
    act.gear = act.gear.filter(g => g.kind !== 'pole')
    
    // Add all poles from the first scene
    act.gear.push(...JSON.parse(JSON.stringify(firstPoles)))
  }
  
  // 3. Save local file
  writeFileSync(filePath, JSON.stringify(data, null, 2))
  console.log('Fixed local file.')
  
  // 4. Update Supabase
  const { url, headers } = creds()
  const res = await fetch(`${url}/rest/v1/studio_systems?id=eq.${sysId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ doc: data })
  })
  
  if (!res.ok) {
    throw new Error(`Failed to update Supabase: ${await res.text()}`)
  }
  
  console.log('Successfully updated Supabase.')
}

doIt().catch(console.error)
