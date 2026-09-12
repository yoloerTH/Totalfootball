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

function randId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

async function doIt() {
  // Read local file
  const data = JSON.parse(readFileSync(filePath, 'utf8'))
  
  // ==========================================
  // 1. Highlight the "Free Man" Space
  // ==========================================
  // The line-breaking pass happens in Act 6 (Index 6 is Phase 4).
  // In Act 6, u-lcb passes to u-cf. The hole was left by t-rcm at around x=45, y=60.
  
  const freeSpaceBand = {
    id: randId('bd'),
    kind: 'danger',
    rect: { x: 40, y: 55, w: 15, h: 15 },
    tone: 'gold',
    label: 'VACATED SPACE'
  }
  
  // Add it to Act 6 (preparing the pass)
  if (data.acts[6]) {
    data.acts[6].bands.push(freeSpaceBand)
    // Update caption to explicitly mention the space
    data.acts[6].caption = "4. LCB fires a line-breaking pass through the EXACT space vacated by the pressing midfielder!"
  }
  // Add it to Act 7 (ball traveling)
  if (data.acts[7]) {
    data.acts[7].bands.push(freeSpaceBand)
  }
  
  // ==========================================
  // 2. Add the Counter-Press Phase
  // ==========================================
  // We will replace Acts 14, 15, 16, 17, 18 with the counter press.
  // Currently, Act 12 is "Cutback into the box for a scoring chance."
  // Let's modify Act 12 to be an interception!
  
  // Act 12: u-lw passes, but we route it to t-rcb (Red RCB)
  let act12 = data.acts[12]
  if (act12) {
    act12.caption = "7. The cutback is intercepted by the recovering Red CB!"
    if (act12.texts && act12.texts.length > 0) {
      act12.texts[0].text = "7. INTERCEPTION!"
      act12.texts[0].tone = "red"
    }
    
    // Change the pass arrow to go to t-rcb
    const passArrow = act12.arrows.find(a => a.kind === 'pass')
    const tRcb = act12.tokens.find(t => t.id === 't-rcb')
    if (passArrow && tRcb) {
      passArrow.to = { x: tRcb.x, y: tRcb.y }
      passArrow.toId = 't-rcb'
    }
  }
  
  // Act 13: Ball arrives at t-rcb
  let act13 = data.acts[13]
  if (act13) {
    const tRcb = act13.tokens.find(t => t.id === 't-rcb')
    if (tRcb) {
      act13.balls[0].x = tRcb.x
      act13.balls[0].y = tRcb.y
    }
  }
  
  // Now we create New Act 14: The Counter-Press Trap (Hold)
  const act14 = JSON.parse(JSON.stringify(act13))
  act14.id = randId('act')
  act14.title = "Phase 15"
  act14.caption = "8. GUARDIOLA'S 5-SECOND RULE: Immediate counter-press. The team swarms the ball carrier!"
  act14.arrows = []
  act14.texts = [{
    id: randId('tx'), x: 50, y: 95, text: "8. THE COUNTER-PRESS", size: 'm', look: 'plate', align: 'center', weight: 'bold', tone: 'gold'
  }]
  
  const tRcb = act14.tokens.find(t => t.id === 't-rcb')
  
  // Create a danger zone around the ball carrier
  act14.bands.push({
    id: randId('bd'),
    kind: 'danger',
    rect: { x: tRcb.x - 10, y: tRcb.y - 10, w: 20, h: 20 },
    tone: 'red',
    label: 'TRAP'
  })
  
  // Blue players swarm (u-cf, u-lw, u-lcm)
  const swarmers = ['u-cf', 'u-lw', 'u-lcm']
  swarmers.forEach(id => {
    const tok = act14.tokens.find(t => t.id === id)
    if (tok) {
      // Calculate slightly offset positions so they surround him
      let targetX = tRcb.x + (Math.random() * 6 - 3)
      let targetY = tRcb.y + (Math.random() * 6 - 3)
      act14.arrows.push({
        id: randId('ar'), kind: 'run', from: { x: tok.x, y: tok.y }, to: { x: targetX, y: targetY }, fromId: id
      })
    }
  })
  
  // Act 15: The swarm arrives (Move)
  const act15 = JSON.parse(JSON.stringify(act14))
  act15.id = randId('act')
  act15.title = "Phase 16"
  act15.caption = ""
  act15.arrows = []
  act15.texts = []
  // Actually move the tokens
  swarmers.forEach(id => {
    const tokAct14 = act14.tokens.find(t => t.id === id)
    const tokAct15 = act15.tokens.find(t => t.id === id)
    const runArrow = act14.arrows.find(a => a.fromId === id)
    if (tokAct15 && runArrow) {
      tokAct15.x = runArrow.to.x
      tokAct15.y = runArrow.to.y
    }
  })
  
  // Act 16: Ball Won Back (Hold)
  const act16 = JSON.parse(JSON.stringify(act15))
  act16.id = randId('act')
  act16.title = "Phase 17"
  act16.caption = "9. Ball recovered in the dangerous area!"
  act16.texts = [{
    id: randId('tx'), x: 50, y: 95, text: "9. RECOVERY!", size: 'm', look: 'plate', align: 'center', weight: 'bold', tone: 'gold'
  }]
  
  // Give ball back to u-cf
  const uCf = act16.tokens.find(t => t.id === 'u-cf')
  if (uCf) {
    act16.balls[0].x = uCf.x
    act16.balls[0].y = uCf.y
  }
  
  // Act 17: (Move) - just a static frame to let the viewer see it
  const act17 = JSON.parse(JSON.stringify(act16))
  act17.id = randId('act')
  act17.title = "Phase 18"
  act17.caption = ""
  act17.texts = []
  
  // Replace the old acts 14+ with our new counter-press acts
  data.acts = data.acts.slice(0, 14) // keep 0 to 13
  data.acts.push(act14, act15, act16, act17)
  
  // Re-index titles to ensure they are sequential
  data.acts.forEach((act, idx) => {
    act.title = `Phase ${idx + 1}`
  })
  
  // Save local file
  writeFileSync(filePath, JSON.stringify(data, null, 2))
  console.log('Fixed local file.')
  
  // Update Supabase
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
