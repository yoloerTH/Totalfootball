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
  const targetId = '04189c96-21fb-4772-9177-408856ec2c46' // amathelw2@gmail.com

  // List all systems
  const listUrl = `${url}/rest/v1/studio_systems?owner=eq.${targetId}&select=id,doc`
  console.log('Fetching from:', listUrl)
  const res = await fetch(listUrl, { headers })
  if (!res.ok) { console.error('List failed:', await res.text()); return }
  const systems = await res.json()
  
  console.log(`Found ${systems.length} total systems for amathelw2:`)
  for (const s of systems) {
    const title = s.doc?.title ?? '(no title)'
    console.log(`  ${s.id}  →  ${title}`)
  }

  // Delete all "Positional Rondo" or "Advanced" systems we created
  const toDelete = systems.filter(s => {
    const t = s.doc?.title ?? ''
    return t.includes('Positional Rondo') || t.includes('Advanced Continuous Passing') || t.includes('Advanced Passing')
  })
  
  if (toDelete.length === 0) {
    console.log('\nNo broken systems found to delete.')
    return
  }

  console.log(`\nDeleting ${toDelete.length} system(s)...`)
  for (const r of toDelete) {
    const delRes = await fetch(`${url}/rest/v1/studio_systems?id=eq.${r.id}`, {
      method: 'DELETE',
      headers
    })
    if (!delRes.ok) console.error(`  Failed to delete ${r.id}:`, await delRes.text())
    else console.log(`  Deleted ${r.id} (${r.doc?.title})`)
  }
  console.log('Done cleaning up.')
}

doIt().catch(console.error)
