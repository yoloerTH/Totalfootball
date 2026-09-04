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
const T = {
  // US (Green) - 4-3-3 High Press
  'u-gk': { x: 15, y: 50, label: 'GK', side: 'us' },
  'u-lcb': { x: 40, y: 35, label: 'CB', side: 'us' },
  'u-rcb': { x: 40, y: 65, label: 'CB', side: 'us' },
  'u-lb': { x: 45, y: 15, label: 'LB', side: 'us' },
  'u-rb': { x: 45, y: 85, label: 'RB', side: 'us' },
  'u-6': { x: 50, y: 50, label: '6', side: 'us' },
  'u-8': { x: 55, y: 30, label: '8', side: 'us' },
  'u-10': { x: 55, y: 70, label: '10', side: 'us' },
  'u-lw': { x: 70, y: 20, label: 'LW', side: 'us' },
  'u-rw': { x: 70, y: 80, label: 'RW', side: 'us' },
  'u-9': { x: 75, y: 50, label: '9', side: 'us' },

  // THEM (Red) - 4-2-3-1 Build Up
  'o-gk': { x: 98, y: 50, label: 'GK', side: 'them' },
  'o-lcb': { x: 88, y: 35, label: 'CB', side: 'them' },
  'o-rcb': { x: 88, y: 65, label: 'CB', side: 'them' },
  'o-lb': { x: 75, y: 10, label: 'LB', side: 'them' },
  'o-rb': { x: 75, y: 90, label: 'RB', side: 'them' },
  'o-cdm1': { x: 78, y: 40, label: 'DM', side: 'them' },
  'o-cdm2': { x: 78, y: 60, label: 'DM', side: 'them' },
  'o-am': { x: 65, y: 50, label: 'AM', side: 'them' },
  'o-lw': { x: 60, y: 15, label: 'LW', side: 'them' },
  'o-rw': { x: 60, y: 85, label: 'RW', side: 'them' },
  'o-9': { x: 50, y: 50, label: '9', side: 'them' },
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

// Act 1: The Setup
acts.push({
  id: 'act-1',
  title: '1. The Setup',
  caption: 'Both teams in shape. Red attempts to build from the back against our high press.',
  balls: [{ id: 'ball-1', x: 96, y: 50 }],
  tokens: cloneTokens({}),
  bands: [
    { id: 'b-block', kind: 'block', throughTokens: ['u-lw', 'u-9', 'u-rw'], close: 'shape', tone: 'green', edge: 'dashed' },
    { id: 'b-mid', kind: 'block', throughTokens: ['u-8', 'u-10', 'u-6'], close: 'shape', tone: 'green', edge: 'dashed' }
  ],
  arrows: [],
  texts: [
    { id: 'tx-1', x: 50, y: 8, text: 'High Press Structure', size: 'l', look: 'plate', align: 'center', weight: 'bold' }
  ]
})

// Act 2: The Bait
acts.push({
  id: 'act-2',
  title: '2. The Bait',
  caption: 'GK passes to RCB. Our LW shifts to cut off the RB, baiting a pass to the other side.',
  balls: [{ id: 'ball-1', x: 88, y: 65 }],
  tokens: cloneTokens({
    'u-lw': { x: 75, y: 75 } // moving towards RB side
  }),
  bands: [],
  arrows: [
    { id: 'a-1', kind: 'pass', from: { x: 96, y: 50 }, to: { x: 88, y: 65 }, fromId: 'o-gk', toId: 'o-rcb' },
    { id: 'a-2', kind: 'run', from: { x: 70, y: 80 }, to: { x: 75, y: 75 }, fromId: 'u-rw' } // RW actually presses the RCB side
  ],
  texts: [
    { id: 'tx-2', x: 75, y: 92, text: 'Block passing lane', size: 's', look: 'bare', align: 'center', tone: 'green' }
  ]
})

// Act 3: The Trap
acts.push({
  id: 'act-3',
  title: '3. The Trap',
  caption: 'RCB is forced to play to LCB. Our 9 begins a curved run to split the CBs.',
  balls: [{ id: 'ball-1', x: 88, y: 35 }],
  tokens: cloneTokens({
    'u-rw': { x: 75, y: 75 },
    'u-9': { x: 82, y: 45, cue: 'PRESS' }
  }),
  bands: [],
  arrows: [
    { id: 'a-3', kind: 'pass', from: { x: 88, y: 65 }, to: { x: 88, y: 35 }, fromId: 'o-rcb', toId: 'o-lcb' },
    { id: 'a-4', kind: 'press', from: { x: 75, y: 50 }, to: { x: 82, y: 45 }, fromId: 'u-9', bend: 0.2 }
  ],
  texts: []
})

// Act 4: The Trigger
acts.push({
  id: 'act-4',
  title: '4. The Trigger',
  caption: 'LCB plays wide to LB. This is the trigger. LW sprints to close him down.',
  balls: [{ id: 'ball-1', x: 75, y: 10 }],
  tokens: cloneTokens({
    'u-rw': { x: 75, y: 75 },
    'u-9': { x: 85, y: 42, cue: 'COVER' },
    'u-lw': { x: 73, y: 15, cue: 'PRESS' },
    'u-8': { x: 65, y: 25, cue: 'BALANCE' }
  }),
  bands: [],
  arrows: [
    { id: 'a-5', kind: 'pass', from: { x: 88, y: 35 }, to: { x: 75, y: 10 }, fromId: 'o-lcb', toId: 'o-lb' },
    { id: 'a-6', kind: 'press', from: { x: 70, y: 20 }, to: { x: 73, y: 15 }, fromId: 'u-lw' }
  ],
  texts: [
    { id: 'tx-4', x: 75, y: 25, text: 'PRESSING TRIGGER', size: 'm', look: 'plate', align: 'center', weight: 'bold', tone: 'red' }
  ]
})

// Act 5: Suffocation
acts.push({
  id: 'act-5',
  title: '5. Suffocation',
  caption: 'LB is isolated on the touchline. All nearby passing lanes are man-marked.',
  balls: [{ id: 'ball-1', x: 75, y: 10 }],
  tokens: cloneTokens({
    'u-rw': { x: 75, y: 75 },
    'u-9': { x: 85, y: 42 },
    'u-lw': { x: 73, y: 12 },
    'u-8': { x: 70, y: 35 }, // 8 marks DM
    'u-10': { x: 70, y: 55 }, // 10 marks other DM
    'u-lb': { x: 55, y: 15 }, // LB steps up to their LW
    'o-lb': { cue: 'PRESS' }
  }),
  bands: [
    { id: 'b-danger', kind: 'danger', shape: 'diamond', rect: { x: 68, y: 0, w: 20, h: 25 }, tone: 'red' }
  ],
  arrows: [],
  texts: []
})

// Act 6: The Turnover
acts.push({
  id: 'act-6',
  title: '6. The Turnover',
  caption: 'LW wins the tackle. The trap has worked perfectly.',
  balls: [{ id: 'ball-1', x: 72, y: 12 }],
  tokens: cloneTokens({
    'u-rw': { x: 75, y: 75 },
    'u-9': { x: 85, y: 42 },
    'u-lw': { x: 72, y: 12 },
    'u-8': { x: 70, y: 35 },
    'u-10': { x: 70, y: 55 },
    'u-lb': { x: 55, y: 15 },
    'o-lcb': { dim: true }, 'o-rcb': { dim: true }, 'o-rb': { dim: true }, 'o-cdm1': { dim: true }, 'o-cdm2': { dim: true },
    'o-am': { dim: true }, 'o-rw': { dim: true }, 'o-9': { dim: true }, 'o-lw': { dim: true }
  }),
  bands: [],
  arrows: [],
  texts: [
    { id: 'tx-6', x: 65, y: 12, text: 'TURNOVER', size: 'm', look: 'bare', align: 'center', weight: 'bold', tone: 'gold' }
  ]
})

// Act 7: Immediate Transition
acts.push({
  id: 'act-7',
  title: '7. Immediate Transition',
  caption: 'LW drives inside. 9 makes a diagonal run behind the disorganized defense.',
  balls: [{ id: 'ball-1', x: 80, y: 25 }],
  tokens: cloneTokens({
    'u-rw': { x: 75, y: 75 },
    'u-9': { x: 92, y: 30 }, // run into box
    'u-lw': { x: 80, y: 25 }, // carries ball
    'u-8': { x: 70, y: 35 },
    'u-10': { x: 70, y: 55 },
    'u-lb': { x: 55, y: 15 },
    'o-lb': { dim: true }, 'o-lcb': { dim: true }, 'o-rcb': { dim: true }, 'o-rb': { dim: true }, 'o-cdm1': { dim: true }, 'o-cdm2': { dim: true },
    'o-am': { dim: true }, 'o-rw': { dim: true }, 'o-9': { dim: true }, 'o-lw': { dim: true }
  }),
  bands: [],
  arrows: [
    { id: 'a-7', kind: 'carry', from: { x: 72, y: 12 }, to: { x: 80, y: 25 }, fromId: 'u-lw' },
    { id: 'a-8', kind: 'run', from: { x: 85, y: 42 }, to: { x: 92, y: 30 }, fromId: 'u-9', bend: 0.1 }
  ],
  texts: []
})

// Act 8: The Finish
acts.push({
  id: 'act-8',
  title: '8. The Finish',
  caption: 'LW slips the ball to 9, resulting in a 1-on-1 with the keeper.',
  balls: [{ id: 'ball-1', x: 98, y: 45 }], // goal
  tokens: cloneTokens({
    'u-rw': { x: 75, y: 75, dim: true },
    'u-9': { x: 92, y: 30 }, 
    'u-lw': { x: 80, y: 25 },
    'u-8': { x: 70, y: 35, dim: true },
    'u-10': { x: 70, y: 55, dim: true },
    'u-lb': { x: 55, y: 15, dim: true },
    'u-rcb': { dim: true }, 'u-lcb': { dim: true }, 'u-6': { dim: true }, 'u-gk': { dim: true }, 'u-rb': { dim: true },
    'o-lb': { dim: true }, 'o-lcb': { dim: true }, 'o-rcb': { dim: true }, 'o-rb': { dim: true }, 'o-cdm1': { dim: true }, 'o-cdm2': { dim: true },
    'o-am': { dim: true }, 'o-rw': { dim: true }, 'o-9': { dim: true }, 'o-lw': { dim: true }
  }),
  bands: [],
  arrows: [
    { id: 'a-9', kind: 'pass', from: { x: 80, y: 25 }, to: { x: 92, y: 30 }, fromId: 'u-lw', toId: 'u-9' },
    { id: 'a-10', kind: 'pass', from: { x: 92, y: 30 }, to: { x: 98, y: 45 }, fromId: 'u-9' }
  ],
  texts: [
    { id: 'tx-8', x: 95, y: 60, text: 'GOAL!', size: 'l', look: 'plate', align: 'right', weight: 'bold', tone: 'gold' }
  ]
})


async function doIt() {
  const { url, headers } = creds()
  const targetId = '9919a53b-e7d9-411f-9d96-31be35ca6f64'
  
  const doc = {
    v: 1,
    title: 'High Press Masterclass',
    subtitle: 'Full Pitch View: The Trap & Turnover',
    pitch: 'full',
    matchBall: 'brazuca',
    camera: 'gentle',
    teams: {
      us: { name: 'Pressing Team', base: '#08C16A', deep: '#06A659', text: '#FFFFFF' },
      them: { name: 'Opposition', base: '#E2473B', deep: '#B5392F', text: '#FFFFFF' }
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
  console.log(`Successfully created full pitch system ${sysId} for ${targetId}`)
}

doIt().catch(console.error)
