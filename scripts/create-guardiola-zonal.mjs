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

function randId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

// Initial state - Adding the opposition (them) to give the drill context!
const tokens = [
  // Our Team (Blue)
  { id: 'u-lcb', label: 'LCB', side: 'us', x: 20, y: 35 },
  { id: 'u-rcb', label: 'RCB', side: 'us', x: 20, y: 65 },
  { id: 'u-lcm', label: 'LCM', side: 'us', x: 50, y: 35 },
  { id: 'u-rcm', label: 'RCM', side: 'us', x: 50, y: 65 },
  { id: 'u-lw', label: 'LW', side: 'us', x: 80, y: 20 },
  { id: 'u-rw', label: 'RW', side: 'us', x: 80, y: 80 },
  { id: 'u-cf', label: 'CF', side: 'us', x: 80, y: 50 },

  // Opposition (Red) - 4-4-2 Mid Block
  { id: 't-ls', label: '9', side: 'them', x: 35, y: 40 },
  { id: 't-rs', label: '10', side: 'them', x: 35, y: 60 },
  { id: 't-lm', label: 'LM', side: 'them', x: 45, y: 20 },
  { id: 't-lcm', label: 'CM', side: 'them', x: 45, y: 40 },
  { id: 't-rcm', label: 'CM', side: 'them', x: 45, y: 60 },
  { id: 't-rm', label: 'RM', side: 'them', x: 45, y: 80 },
  { id: 't-lcb', label: 'CB', side: 'them', x: 65, y: 40 },
  { id: 't-rcb', label: 'CB', side: 'them', x: 65, y: 60 },
]

const bands = [
  { id: 'zone-1', kind: 'zone', rect: { x: 25, y: 50, w: 30, h: 70 }, tone: 'blue', label: 'Build-Up' },
  { id: 'zone-2', kind: 'zone', rect: { x: 55, y: 50, w: 30, h: 70 }, tone: 'orange', label: 'Midfield (The Press)' },
  { id: 'zone-3', kind: 'zone', rect: { x: 85, y: 50, w: 30, h: 70 }, tone: 'red', label: 'Final Third (Exploit)' },
]

// The sequence of events now includes defensive movements (d_m) to show the tactical manipulation!
const events = [
  { 
    p: 'u-lcb', r: 'u-rcb', 
    text: "1. Switch play to shift the opposition block.",
    d_m: [
      ['t-ls', 35, 50], // shift across
      ['t-rs', 35, 70], // step up to press RCB
      ['t-lcm', 45, 50], // midfield shifts
      ['t-rcm', 45, 70]
    ]
  },
  { 
    p: 'u-rcb', r: 'u-rcm', 
    m: ['u-rcm', 35, 65], 
    d_m: [
      ['t-rcm', 40, 65] // Red CM jumps to press the dropping midfielder!
    ],
    text: "2. RCM drops deep. The Red CM jumps to press him, opening a hole in the midfield!" 
  },
  { 
    p: 'u-rcm', r: 'u-lcb', 
    m: ['u-rcm', 50, 65], 
    d_m: [
      ['t-rcm', 45, 60], // CM realizes he's been dragged out
      ['t-rs', 35, 60] // Forward resets
    ],
    text: "3. One-touch lay-off (Third Man). The bait worked!" 
  },
  { 
    p: 'u-lcb', r: 'u-cf', 
    m: ['u-cf', 55, 50], 
    d_m: [
      ['t-lcb', 55, 45], // Red CB jumps out to track the CF dropping
    ],
    text: "4. LCB fires a line-breaking pass through the opened midfield hole to the CF." 
  },
  { 
    p: 'u-cf', r: 'u-lcm', 
    m: ['u-lcm', 55, 35], 
    text: "5. CF lays it off to the advancing LCM." 
  },
  { 
    p: 'u-lcm', r: 'u-lw', 
    m: ['u-lw', 85, 20], 
    d_m: [
      ['t-lcb', 65, 40] // Red CB tries to recover
    ],
    text: "6. Because Red CB jumped out, LCM plays a through ball into the vacated space for the Winger." 
  },
  { 
    p: 'u-lw', r: 'u-cf', 
    m: ['u-cf', 85, 50], 
    d_m: [
      ['t-rcb', 75, 50] // Red RCB scrambles to cover
    ],
    text: "7. Cutback into the box for a scoring chance." 
  },
  { 
    p: 'u-cf', r: 'u-lcb', 
    m: ['u-lcm', 50, 35], // reset everyone back to starting spots
    d_m: [
      ['t-rcb', 65, 60],
      ['t-ls', 35, 40]
    ],
    text: "8. (Resetting the drill for the reel loop)" 
  }, 
  { 
    p: 'u-lcb', r: 'u-lcb', // fake pass just to reset the rest
    m: ['u-lw', 80, 20],
    d_m: [
      ['t-lcm', 45, 40]
    ],
    text: ""
  }
]

const acts = []
let currentTokens = JSON.parse(JSON.stringify(tokens))

function getToken(id, toks) {
  return toks.find(t => t.id === id)
}

let phaseIdx = 1

for (let i = 0; i < events.length; i++) {
  const ev = events[i]
  const passer = getToken(ev.p, currentTokens)
  const receiver = getToken(ev.r, currentTokens)
  
  // Create Act 1: The pass (hold phase)
  let texts = []
  if (ev.text) {
    texts.push({ id: randId('tx'), x: 50, y: 95, text: ev.text, size: 'm', look: 'plate', align: 'center', weight: 'bold' })
  }
  
  const act1 = {
    id: randId('act'),
    title: `Phase ${phaseIdx}`,
    caption: ev.text || '',
    balls: [{ id: 'ball-1', x: passer.x, y: passer.y }],
    tokens: JSON.parse(JSON.stringify(currentTokens)),
    bands: bands,
    arrows: [],
    texts: texts
  }
  
  // Only add a pass arrow if passer != receiver (reset trick)
  if (ev.p !== ev.r) {
    act1.arrows.push({ id: randId('ar'), kind: 'pass', from: { x: passer.x, y: passer.y }, to: { x: receiver.x, y: receiver.y }, fromId: ev.p, toId: ev.r })
  }
  
  // Process movement for Act 2
  let nextTokens = JSON.parse(JSON.stringify(currentTokens))
  
  if (ev.m) {
    const moverId = ev.m[0]
    const targetX = ev.m[1]
    const targetY = ev.m[2]
    const mover = getToken(moverId, currentTokens)
    
    act1.arrows.push({ id: randId('ar'), kind: 'run', from: { x: mover.x, y: mover.y }, to: { x: targetX, y: targetY }, fromId: moverId })
    
    const nextMover = getToken(moverId, nextTokens)
    nextMover.x = targetX
    nextMover.y = targetY
  }

  // Defensive movements
  if (ev.d_m) {
    for (const dMove of ev.d_m) {
      const defId = dMove[0]
      const dX = dMove[1]
      const dY = dMove[2]
      const defender = getToken(defId, currentTokens)
      
      act1.arrows.push({ id: randId('ar'), kind: 'run', from: { x: defender.x, y: defender.y }, to: { x: dX, y: dY }, fromId: defId })
      
      const nextDef = getToken(defId, nextTokens)
      nextDef.x = dX
      nextDef.y = dY
      nextDef.cue = 'PRESS' // Give them a pressing cue
    }
  }
  
  acts.push(act1)
  phaseIdx++
  
  // Act 2: Ball arrives, players have moved
  const act2 = {
    id: randId('act'),
    title: `Phase ${phaseIdx}`,
    caption: '',
    balls: [{ id: 'ball-1', x: receiver.x, y: receiver.y }],
    tokens: nextTokens,
    bands: bands,
    arrows: [],
    texts: []
  }
  
  acts.push(act2)
  phaseIdx++
  
  currentTokens = nextTokens
}

async function doIt() {
  const { url, headers } = creds()
  const targetId = '04189c96-21fb-4772-9177-408856ec2c46' // amathelw2@gmail.com
  
  const doc = {
    v: 1,
    title: 'Tactical Drill: Manipulating the Block',
    subtitle: 'Baiting the press to open passing lanes',
    pitch: 'half',
    matchBall: 'brazuca',
    camera: 'gentle',
    hold: 0, 
    move: 1100, 
    teams: {
      us: { name: 'Academy', base: '#0057B8', deep: '#003A7A', text: '#FFFFFF', pattern: 'stripes', alt: '#FFFFFF' },
      them: { name: 'Opposition Block', base: '#E2473B', deep: '#B5392F', text: '#FFFFFF' }
    },
    acts: acts
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
  console.log(`Successfully created Tactical Drill ${sysId} for ${targetId}`)
}

doIt().catch(console.error)
