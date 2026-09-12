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
  
  const rawJson = readFileSync(join(ROOT, 'content/systems/advanced-continuous-passing.json'), 'utf8')
  const baseDoc = JSON.parse(rawJson)

  // Wrap it nicely for the studio
  const doc = {
    v: 1,
    title: 'Advanced Continuous Passing Drill',
    subtitle: 'Double-Diamond Transition & Third-Man Runs',
    pitch: 'half',
    matchBall: 'brazuca',
    camera: 'gentle',
    hold: 0,
    move: 1100, // 1s move as user requested
    teams: {
      us: { name: 'Academy', base: '#0057B8', deep: '#003A7A', text: '#FFFFFF', pattern: 'stripes', alt: '#FFFFFF' },
      them: { name: 'Opposition', base: '#E2473B', deep: '#B5392F', text: '#FFFFFF' }
    },
    acts: baseDoc.acts
  }

  const sysId = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 5)
  const payload = {
    id: sysId,
    owner: targetId,
    doc
  }

  const postRes = await fetch(`${url}/rest/v1/studio_systems`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })

  if (!postRes.ok) throw new Error(await postRes.text())
  console.log(`Successfully created Advanced Passing Drill ${sysId} for ${targetId}`)
}

doIt().catch(console.error)
