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

const acts = []

// Base tokens starting positions for FULL PITCH
// US (Blue - Brighton) - 4-2-3-1 / 4-2-4 Build Up
const T = {
  'u-gk': { x: 8, y: 50, label: 'GK', side: 'us' },
  'u-lcb': { x: 15, y: 35, label: 'CB', side: 'us' },
  'u-rcb': { x: 15, y: 65, label: 'CB', side: 'us' },
  'u-lb': { x: 25, y: 15, label: 'LB', side: 'us' },
  'u-rb': { x: 25, y: 85, label: 'RB', side: 'us' },
  'u-6': { x: 22, y: 42, label: '6', side: 'us' },
  'u-8': { x: 22, y: 58, label: '8', side: 'us' },
  'u-10': { x: 45, y: 50, label: '10', side: 'us' },
  'u-lw': { x: 50, y: 15, label: 'LW', side: 'us' },
  'u-rw': { x: 50, y: 85, label: 'RW', side: 'us' },
  'u-9': { x: 55, y: 50, label: '9', side: 'us' },

  // THEM (Red) - 4-4-2 High Press
  'o-gk': { x: 95, y: 50, label: 'GK', side: 'them' },
  'o-lcb': { x: 65, y: 35, label: 'CB', side: 'them' },
  'o-rcb': { x: 65, y: 65, label: 'CB', side: 'them' },
  'o-lb': { x: 60, y: 15, label: 'LB', side: 'them' },
  'o-rb': { x: 60, y: 85, label: 'RB', side: 'them' },
  'o-cm1': { x: 45, y: 40, label: 'CM', side: 'them' },
  'o-cm2': { x: 45, y: 60, label: 'CM', side: 'them' },
  'o-lm': { x: 40, y: 20, label: 'LM', side: 'them' },
  'o-rm': { x: 40, y: 80, label: 'RM', side: 'them' },
  'o-9': { x: 30, y: 40, label: '9', side: 'them' },
  'o-10': { x: 30, y: 60, label: '10', side: 'them' },
}

function cloneTokens(overrides) {
  return Object.keys(T).map(id => {
    const base = { id, ...T[id] }
    if (overrides[id]) {
      return { ...base, ...overrides[id] }
    }
    return base
  })
}

// 1. Setup
acts.push({
  id: 'act-1',
  title: '1. The Setup',
  caption: 'Brighton sets up in their deep 4-2-4 build up structure against a high press.',
  balls: [{ id: 'ball-1', x: 10, y: 50 }],
  tokens: cloneTokens({}),
  bands: [],
  arrows: [],
  texts: [
    { id: 'tx-1', x: 25, y: 5, text: 'De Zerbi Build-Up', size: 'l', look: 'plate', align: 'center', weight: 'bold' }
  ]
})

// 2. Studs on the Ball
acts.push({
  id: 'act-2',
  title: '2. Studs on the Ball',
  caption: 'GK puts his foot on the ball to invite the press.',
  balls: [{ id: 'ball-1', x: 10, y: 50 }],
  tokens: cloneTokens({
    'o-10': { x: 25, y: 55, cue: 'PRESS' } // 10 starts jumping
  }),
  bands: [],
  arrows: [
    { id: 'a-1', kind: 'run', from: { x: 30, y: 60 }, to: { x: 25, y: 55 }, fromId: 'o-10' }
  ],
  texts: []
})

// 3. Pass to CB
acts.push({
  id: 'act-3',
  title: '3. Pass to CB',
  caption: 'GK passes to RCB. The opponent\'s 10 continues his pressing run.',
  balls: [{ id: 'ball-1', x: 15, y: 65 }],
  tokens: cloneTokens({
    'o-10': { x: 20, y: 60, cue: 'PRESS' }
  }),
  bands: [],
  arrows: [
    { id: 'a-2', kind: 'pass', from: { x: 10, y: 50 }, to: { x: 15, y: 65 }, fromId: 'u-gk', toId: 'u-rcb' },
    { id: 'a-3', kind: 'run', from: { x: 25, y: 55 }, to: { x: 20, y: 60 }, fromId: 'o-10' }
  ],
  texts: []
})

// 4. Baiting the Winger
acts.push({
  id: 'act-4',
  title: '4. Baiting the Winger',
  caption: 'RCB holds the ball, waiting for the opponent\'s RM to jump.',
  balls: [{ id: 'ball-1', x: 15, y: 65 }],
  tokens: cloneTokens({
    'o-10': { x: 18, y: 62 },
    'o-rm': { x: 30, y: 75, cue: 'PRESS' }
  }),
  bands: [],
  arrows: [
    { id: 'a-4', kind: 'run', from: { x: 40, y: 80 }, to: { x: 30, y: 75 }, fromId: 'o-rm' }
  ],
  texts: []
})

// 5. Short Pass to Pivot
acts.push({
  id: 'act-5',
  title: '5. Short Pass to Pivot',
  caption: 'RCB passes to the 8 dropping slightly. This triggers the opponent\'s CM.',
  balls: [{ id: 'ball-1', x: 22, y: 58 }],
  tokens: cloneTokens({
    'o-10': { x: 18, y: 62 },
    'o-rm': { x: 30, y: 75 },
    'o-cm2': { x: 32, y: 58, cue: 'PRESS' }
  }),
  bands: [],
  arrows: [
    { id: 'a-5', kind: 'pass', from: { x: 15, y: 65 }, to: { x: 22, y: 58 }, fromId: 'u-rcb', toId: 'u-8' },
    { id: 'a-6', kind: 'run', from: { x: 45, y: 60 }, to: { x: 32, y: 58 }, fromId: 'o-cm2' }
  ],
  texts: []
})

// 6. First-Time Layoff
acts.push({
  id: 'act-6',
  title: '6. First-Time Layoff',
  caption: 'The 8 plays a first-time bounce pass to the LCB as the third man.',
  balls: [{ id: 'ball-1', x: 15, y: 35 }],
  tokens: cloneTokens({
    'o-10': { x: 18, y: 62 },
    'o-rm': { x: 30, y: 75 },
    'o-cm2': { x: 25, y: 58 }
  }),
  bands: [],
  arrows: [
    { id: 'a-7', kind: 'pass', from: { x: 22, y: 58 }, to: { x: 15, y: 35 }, fromId: 'u-8', toId: 'u-lcb' }
  ],
  texts: []
})

// 7. Shifting the Press
acts.push({
  id: 'act-7',
  title: '7. Shifting the Press',
  caption: 'The press has shifted right. LCB now has time, and the opponent\'s 9 jumps to press.',
  balls: [{ id: 'ball-1', x: 15, y: 35 }],
  tokens: cloneTokens({
    'o-10': { x: 18, y: 62 },
    'o-rm': { x: 30, y: 75 },
    'o-cm2': { x: 25, y: 58 },
    'o-9': { x: 22, y: 38, cue: 'PRESS' }
  }),
  bands: [],
  arrows: [
    { id: 'a-8', kind: 'run', from: { x: 30, y: 40 }, to: { x: 22, y: 38 }, fromId: 'o-9' }
  ],
  texts: []
})

// 8. Opening the Passing Lane
acts.push({
  id: 'act-8',
  title: '8. Opening the Passing Lane',
  caption: 'The opponent\'s CM1 steps up slightly to cover the 6, opening a lane to the 10.',
  balls: [{ id: 'ball-1', x: 15, y: 35 }],
  tokens: cloneTokens({
    'o-10': { x: 18, y: 62 },
    'o-rm': { x: 30, y: 75 },
    'o-cm2': { x: 25, y: 58 },
    'o-9': { x: 20, y: 36 },
    'o-cm1': { x: 35, y: 42, cue: 'COVER' } // moving towards 6
  }),
  bands: [],
  arrows: [
    { id: 'a-9', kind: 'run', from: { x: 45, y: 40 }, to: { x: 35, y: 42 }, fromId: 'o-cm1' }
  ],
  texts: []
})

// 9. Breaking the Lines
acts.push({
  id: 'act-9',
  title: '9. Breaking the Lines',
  caption: 'LCB drills a vertical pass straight into the dropping 10.',
  balls: [{ id: 'ball-1', x: 42, y: 50 }],
  tokens: cloneTokens({
    'o-10': { x: 18, y: 62 },
    'o-rm': { x: 30, y: 75 },
    'o-cm2': { x: 25, y: 58 },
    'o-9': { x: 20, y: 36 },
    'o-cm1': { x: 35, y: 42 },
    'u-10': { x: 42, y: 50 }, // dropped slightly
    'o-lcb': { x: 55, y: 42, cue: 'PRESS' }, // jumps with him
    'o-rcb': { x: 55, y: 58, cue: 'PRESS' }
  }),
  bands: [],
  arrows: [
    { id: 'a-10', kind: 'pass', from: { x: 15, y: 35 }, to: { x: 42, y: 50 }, fromId: 'u-lcb', toId: 'u-10' },
    { id: 'a-11', kind: 'run', from: { x: 65, y: 35 }, to: { x: 55, y: 42 }, fromId: 'o-lcb' },
    { id: 'a-11b', kind: 'run', from: { x: 65, y: 65 }, to: { x: 55, y: 58 }, fromId: 'o-rcb' }
  ],
  texts: []
})

// 10. The Wall Pass
acts.push({
  id: 'act-10',
  title: '10. The Wall Pass',
  caption: 'The 10 lays it off immediately to the 6, who has run into the vacated midfield space.',
  balls: [{ id: 'ball-1', x: 32, y: 45 }],
  tokens: cloneTokens({
    'o-10': { x: 18, y: 62 },
    'o-rm': { x: 30, y: 75 },
    'o-cm2': { x: 25, y: 58 },
    'o-9': { x: 20, y: 36 },
    'o-cm1': { x: 35, y: 42 },
    'u-10': { x: 42, y: 50 },
    'o-lcb': { x: 50, y: 45 }, 
    'o-rcb': { x: 50, y: 55 },
    'u-6': { x: 32, y: 45 } // sprinted forward
  }),
  bands: [
    { id: 'b-danger2', kind: 'danger', shape: 'ellipse', rect: { x: 28, y: 40, w: 10, h: 10 }, tone: 'gold' }
  ],
  arrows: [
    { id: 'a-12', kind: 'pass', from: { x: 42, y: 50 }, to: { x: 32, y: 45 }, fromId: 'u-10', toId: 'u-6' },
    { id: 'a-13', kind: 'run', from: { x: 22, y: 42 }, to: { x: 32, y: 45 }, fromId: 'u-6' }
  ],
  texts: []
})

// 11. Facing Forward
acts.push({
  id: 'act-11',
  title: '11. Facing Forward',
  caption: 'The 6 receives facing the opponent\'s goal. The press is broken.',
  balls: [{ id: 'ball-1', x: 32, y: 45 }],
  tokens: cloneTokens({
    'o-10': { x: 18, y: 62, dim: true },
    'o-rm': { x: 30, y: 75, dim: true },
    'o-cm2': { x: 25, y: 58, dim: true },
    'o-9': { x: 20, y: 36, dim: true },
    'o-cm1': { x: 35, y: 42, dim: true },
    'u-10': { x: 42, y: 50 },
    'o-lcb': { x: 50, y: 45 },
    'o-rcb': { x: 50, y: 55 },
    'u-6': { x: 32, y: 45 }
  }),
  bands: [],
  arrows: [],
  texts: [
    { id: 'tx-2', x: 40, y: 25, text: 'PRESS BROKEN', size: 'm', look: 'bare', align: 'center', weight: 'bold', tone: 'gold' }
  ]
})

// 12. Attacking Space
acts.push({
  id: 'act-12',
  title: '12. Attacking Space',
  caption: 'The 6 drives forward. Wingers activate and make diagonal runs.',
  balls: [{ id: 'ball-1', x: 45, y: 45 }],
  tokens: cloneTokens({
    'o-10': { x: 18, y: 62, dim: true },
    'o-rm': { x: 30, y: 75, dim: true },
    'o-cm2': { x: 25, y: 58, dim: true },
    'o-9': { x: 20, y: 36, dim: true },
    'o-cm1': { x: 35, y: 42, dim: true },
    'u-10': { x: 42, y: 50 },
    'o-lcb': { x: 50, y: 45 },
    'o-rcb': { x: 50, y: 55 },
    'u-6': { x: 45, y: 45 }, // carried the ball
    'u-lw': { x: 65, y: 25 },
    'u-rw': { x: 65, y: 75 }
  }),
  bands: [],
  arrows: [
    { id: 'a-14', kind: 'carry', from: { x: 32, y: 45 }, to: { x: 45, y: 45 }, fromId: 'u-6' },
    { id: 'a-15', kind: 'run', from: { x: 50, y: 15 }, to: { x: 65, y: 25 }, fromId: 'u-lw' },
    { id: 'a-16', kind: 'run', from: { x: 50, y: 85 }, to: { x: 65, y: 75 }, fromId: 'u-rw' }
  ],
  texts: []
})

// 13. The Through Ball
acts.push({
  id: 'act-13',
  title: '13. The Through Ball',
  caption: '6 slides a through ball between the LB and LCB for the LW.',
  balls: [{ id: 'ball-1', x: 75, y: 30 }],
  tokens: cloneTokens({
    'o-10': { x: 18, y: 62, dim: true },
    'o-rm': { x: 30, y: 75, dim: true },
    'o-cm2': { x: 25, y: 58, dim: true },
    'o-9': { x: 20, y: 36, dim: true },
    'o-cm1': { x: 35, y: 42, dim: true },
    'u-10': { x: 42, y: 50 },
    'o-lcb': { x: 50, y: 45 },
    'o-rcb': { x: 50, y: 55 },
    'o-lb': { x: 55, y: 20 }, // trying to cover
    'u-6': { x: 45, y: 45 },
    'u-lw': { x: 70, y: 28 }, // receives
    'u-rw': { x: 65, y: 75 }
  }),
  bands: [],
  arrows: [
    { id: 'a-17', kind: 'pass', from: { x: 45, y: 45 }, to: { x: 75, y: 30 }, fromId: 'u-6' },
    { id: 'a-18', kind: 'run', from: { x: 65, y: 25 }, to: { x: 70, y: 28 }, fromId: 'u-lw' }
  ],
  texts: []
})

// 14. Creating the Chance
acts.push({
  id: 'act-14',
  title: '14. Creating the Chance',
  caption: 'LW receives the ball in stride inside the box.',
  balls: [{ id: 'ball-1', x: 80, y: 35 }],
  tokens: cloneTokens({
    'o-10': { x: 18, y: 62, dim: true },
    'o-rm': { x: 30, y: 75, dim: true },
    'o-cm2': { x: 25, y: 58, dim: true },
    'o-9': { x: 20, y: 36, dim: true },
    'o-cm1': { x: 35, y: 42, dim: true },
    'u-10': { x: 50, y: 50 }, // joining attack
    'u-9': { x: 75, y: 50 }, // getting into box
    'o-lcb': { x: 65, y: 45 },
    'o-rcb': { x: 65, y: 55 },
    'o-lb': { x: 60, y: 30 },
    'u-6': { x: 45, y: 45 },
    'u-lw': { x: 80, y: 35 },
    'u-rw': { x: 75, y: 70 } // getting into box
  }),
  bands: [],
  arrows: [
    { id: 'a-19', kind: 'carry', from: { x: 70, y: 28 }, to: { x: 80, y: 35 }, fromId: 'u-lw' }
  ],
  texts: []
})

// 15. The Finish
acts.push({
  id: 'act-15',
  title: '15. The Finish',
  caption: 'LW shoots past the keeper.',
  balls: [{ id: 'ball-1', x: 95, y: 45 }], // Goal
  tokens: cloneTokens({
    'o-10': { x: 18, y: 62, dim: true },
    'o-rm': { x: 30, y: 75, dim: true },
    'o-cm2': { x: 25, y: 58, dim: true },
    'o-9': { x: 20, y: 36, dim: true },
    'o-cm1': { x: 35, y: 42, dim: true },
    'u-10': { x: 50, y: 50, dim: true },
    'u-9': { x: 75, y: 50, dim: true },
    'o-lcb': { x: 65, y: 45, dim: true },
    'o-rcb': { x: 65, y: 55, dim: true },
    'o-lb': { x: 60, y: 30, dim: true },
    'u-6': { x: 45, y: 45, dim: true },
    'u-lw': { x: 80, y: 35 },
    'u-rw': { x: 75, y: 70, dim: true },
    'o-gk': { x: 90, y: 45, cue: 'PRESS' } // diving
  }),
  bands: [],
  arrows: [
    { id: 'a-20', kind: 'pass', from: { x: 80, y: 35 }, to: { x: 95, y: 45 }, fromId: 'u-lw' }
  ],
  texts: [
    { id: 'tx-15', x: 95, y: 55, text: 'GOAL', size: 'l', look: 'plate', align: 'center', weight: 'bold', tone: 'gold' }
  ]
})


async function doIt() {
  const { url, headers } = creds()
  const targetId = '04189c96-21fb-4772-9177-408856ec2c46' // amathelw2@gmail.com
  
  const doc = {
    v: 1,
    title: 'De Zerbi Build-Up',
    subtitle: 'Baiting the press to create space',
    pitch: 'full',
    matchBall: 'brazuca',
    camera: 'gentle',
    hold: 0,
    move: 1100, // Roughly 1s move as user requested
    teams: {
      us: { name: 'Brighton', base: '#0057B8', deep: '#003A7A', text: '#FFFFFF', pattern: 'stripes', alt: '#FFFFFF' },
      them: { name: 'High Press', base: '#E2473B', deep: '#B5392F', text: '#FFFFFF' }
    },
    acts
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
  console.log(`Successfully created De Zerbi system ${sysId} for ${targetId}`)
}

doIt().catch(console.error)
