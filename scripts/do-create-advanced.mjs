import { readFileSync, writeFileSync } from 'node:fs'
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

// Base tokens starting positions
const T = {
  'u-9': { x: 60, y: 50, label: '9', side: 'us' },
  'u-lw': { x: 65, y: 20, label: 'LW', side: 'us' },
  'u-rw': { x: 65, y: 80, label: 'RW', side: 'us' },
  'u-10': { x: 50, y: 50, label: '10', side: 'us' },
  'u-8': { x: 40, y: 30, label: '8', side: 'us' },
  'u-6': { x: 40, y: 70, label: '6', side: 'us' },
  'u-lb': { x: 25, y: 15, label: 'LB', side: 'us' },
  'u-lcb': { x: 25, y: 35, label: 'CB', side: 'us' },
  'u-rcb': { x: 25, y: 65, label: 'CB', side: 'us' },
  'u-rb': { x: 25, y: 85, label: 'RB', side: 'us' },

  'o-gk': { x: 98, y: 50, label: 'GK', side: 'them' },
  'o-lcb': { x: 88, y: 35, label: 'CB', side: 'them' },
  'o-rcb': { x: 88, y: 65, label: 'CB', side: 'them' },
  'o-lb': { x: 75, y: 10, label: 'LB', side: 'them' },
  'o-rb': { x: 75, y: 90, label: 'RB', side: 'them' },
  'o-cdm1': { x: 78, y: 40, label: 'DM', side: 'them' },
  'o-cdm2': { x: 78, y: 60, label: 'DM', side: 'them' },
  'o-am': { x: 60, y: 50, label: 'AM', side: 'them' },
  'o-lw': { x: 55, y: 15, label: 'LW', side: 'them' },
  'o-rw': { x: 55, y: 85, label: 'RW', side: 'them' },
  'o-9': { x: 35, y: 50, label: '9', side: 'them' },
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
  caption: 'We shape our block to control their build-up.',
  notes: '4-3-3 against 4-2-3-1. We sit in a mid-block.',
  balls: [{ id: 'ball-1', x: 88, y: 35 }], // Ball with their LCB
  tokens: cloneTokens({}),
  bands: [
    { id: 'b-block', kind: 'block', throughTokens: ['u-lb', 'u-lcb', 'u-rcb', 'u-rb', 'u-8', 'u-6'], close: 'goal', tone: 'blue', fill: 'shade', edge: 'dashed' }
  ],
  arrows: [],
  texts: [
    { id: 'tx-1', x: 50, y: 5, text: 'Mid-Block\nPatience', size: 'l', look: 'plate', align: 'center', weight: 'bold' }
  ]
})

// Act 2: The Bait
acts.push({
  id: 'act-2',
  title: '2. The Bait',
  caption: 'We deliberately leave the passing lane to their Left Back open.',
  balls: [{ id: 'ball-1', x: 88, y: 35 }],
  tokens: cloneTokens({
    'u-lw': { x: 72, y: 30 } // LW moves inside to bait the pass to LB
  }),
  bands: acts[0].bands,
  arrows: [],
  texts: [
    { id: 'tx-2', x: 70, y: 10, text: 'Leave wide lane open', size: 's', look: 'bare', align: 'center', tone: 'red' }
  ]
})

// Act 3: The Trigger
acts.push({
  id: 'act-3',
  title: '3. The Trigger',
  caption: 'The pass goes to the LB. This is our pressing trigger!',
  balls: [{ id: 'ball-1', x: 75, y: 10 }], // Ball moves to LB
  tokens: cloneTokens({
    'u-lw': { x: 72, y: 30 }
  }),
  bands: acts[0].bands,
  arrows: [
    { id: 'ar-pass-1', kind: 'pass', from: { x: 88, y: 35 }, to: { x: 75, y: 10 }, fromId: 'o-lcb', toId: 'o-lb' }
  ],
  texts: [
    { id: 'tx-3', x: 75, y: 25, text: 'PRESSING TRIGGER', size: 'm', look: 'plate', align: 'center', weight: 'bold', tone: 'red' }
  ]
})

// Act 4: Closing the Net
acts.push({
  id: 'act-4',
  title: '4. Closing the Net',
  caption: 'RW sprints to press, curving his run. 8 steps up. 9 cuts off the CB.',
  balls: [{ id: 'ball-1', x: 75, y: 10 }],
  tokens: cloneTokens({
    'u-lw': { x: 72, y: 20, cue: 'PRESS' },
    'u-9': { x: 80, y: 30, cue: 'COVER' },
    'u-10': { x: 70, y: 40, cue: 'COVER' },
    'u-8': { x: 50, y: 20, cue: 'BALANCE' },
    'o-lb': { cue: 'PRESS' }
  }),
  bands: [],
  arrows: [
    { id: 'ar-press-1', kind: 'press', from: { x: 72, y: 30 }, to: { x: 75, y: 15 }, fromId: 'u-lw', toId: 'o-lb', bend: -0.2 },
    { id: 'ar-run-9', kind: 'run', from: { x: 60, y: 50 }, to: { x: 80, y: 30 }, fromId: 'u-9' },
    { id: 'ar-run-10', kind: 'run', from: { x: 50, y: 50 }, to: { x: 70, y: 40 }, fromId: 'u-10' }
  ],
  texts: []
})

// Act 5: The Trap Closes
acts.push({
  id: 'act-5',
  title: '5. The Trap Closes',
  caption: 'The LB is completely isolated with no passing options.',
  balls: [{ id: 'ball-1', x: 75, y: 10 }],
  tokens: cloneTokens({
    'u-lw': { x: 73, y: 12 },
    'u-9': { x: 83, y: 25 },
    'u-10': { x: 70, y: 35 },
    'u-8': { x: 55, y: 20 }
  }),
  bands: [
    { id: 'b-danger', kind: 'danger', shape: 'diamond', rect: { x: 65, y: 0, w: 25, h: 30 }, tone: 'red' }
  ],
  arrows: [],
  texts: [
    { id: 'tx-5', x: 85, y: 15, text: 'Suffocation', size: 'm', look: 'plate', align: 'center', tone: 'red', angle: 0 }
  ]
})

// Act 6: Winning the Ball
acts.push({
  id: 'act-6',
  title: '6. Winning the Ball',
  caption: 'LW wins the tackle high up the pitch.',
  balls: [{ id: 'ball-1', x: 73, y: 12 }],
  tokens: cloneTokens({
    'u-lw': { x: 73, y: 12 },
    'u-9': { x: 83, y: 25 },
    'u-10': { x: 70, y: 35 },
    'u-8': { x: 55, y: 20 },
    'o-lcb': { dim: true }, 'o-rcb': { dim: true }, 'o-rb': { dim: true }, 'o-cdm1': { dim: true }, 'o-cdm2': { dim: true },
    'o-am': { dim: true }, 'o-rw': { dim: true }, 'o-9': { dim: true }
  }),
  bands: [],
  arrows: [],
  texts: []
})

// Act 7: The Immediate Transition
acts.push({
  id: 'act-7',
  title: '7. The Immediate Transition',
  caption: 'LW carries the ball inside. 9 makes a darting run across the CB.',
  balls: [{ id: 'ball-1', x: 85, y: 20 }],
  tokens: cloneTokens({
    'u-lw': { x: 85, y: 20 },
    'u-9': { x: 92, y: 40 },
    'u-10': { x: 70, y: 35 },
    'u-8': { x: 55, y: 20 },
    'o-lcb': { dim: true }, 'o-rcb': { dim: true }, 'o-rb': { dim: true }, 'o-cdm1': { dim: true }, 'o-cdm2': { dim: true },
    'o-am': { dim: true }, 'o-rw': { dim: true }, 'o-9': { dim: true }, 'o-lb': { dim: true }
  }),
  bands: [],
  arrows: [
    { id: 'ar-carry', kind: 'carry', from: { x: 73, y: 12 }, to: { x: 85, y: 20 }, fromId: 'u-lw' },
    { id: 'ar-run-9-2', kind: 'run', from: { x: 83, y: 25 }, to: { x: 92, y: 40 }, fromId: 'u-9', bend: 0.2 }
  ],
  texts: []
})

// Act 8: The Strike
acts.push({
  id: 'act-8',
  title: '8. The Strike',
  caption: 'LW passes to 9, creating an immediate goalscoring chance.',
  balls: [{ id: 'ball-1', x: 96, y: 48 }], // Shot on goal
  tokens: cloneTokens({
    'u-lw': { x: 85, y: 20 },
    'u-9': { x: 92, y: 40 },
    'u-10': { x: 70, y: 35 },
    'u-8': { x: 55, y: 20 },
    'o-lcb': { dim: true }, 'o-rcb': { dim: true }, 'o-rb': { dim: true }, 'o-cdm1': { dim: true }, 'o-cdm2': { dim: true },
    'o-am': { dim: true }, 'o-rw': { dim: true }, 'o-9': { dim: true }, 'o-lb': { dim: true }
  }),
  bands: [],
  arrows: [
    { id: 'ar-pass-final', kind: 'pass', from: { x: 85, y: 20 }, to: { x: 96, y: 48 }, fromId: 'u-lw' }
  ],
  texts: [
    { id: 'tx-goal', x: 96, y: 55, text: 'GOAL!', size: 'l', look: 'plate', align: 'right', weight: 'bold', tone: 'gold' }
  ]
})

// --- PART 2 ---

// Reset tokens for Part 2
const T2 = {
  ...T,
  'u-10': { x: 75, y: 50, label: '10', side: 'us' },
  'u-9': { x: 85, y: 50, label: '9', side: 'us' },
  'u-8': { x: 65, y: 35, label: '8', side: 'us' },
  'u-6': { x: 55, y: 50, label: '6', side: 'us' },
  'u-lw': { x: 80, y: 20, label: 'LW', side: 'us' },
  'u-rw': { x: 80, y: 80, label: 'RW', side: 'us' },
  'u-lb': { x: 45, y: 15, label: 'LB', side: 'us' },
  'u-lcb': { x: 45, y: 35, label: 'CB', side: 'us' },
  'u-rcb': { x: 45, y: 65, label: 'CB', side: 'us' },
  'u-rb': { x: 45, y: 85, label: 'RB', side: 'us' },

  'o-cdm1': { x: 78, y: 45, label: 'DM', side: 'them' }, // Who will intercept
}

function cloneTokens2(overrides) {
  return Object.keys(T2).map(id => {
    const base = { id, ...T2[id] }
    if (overrides[id]) {
      return { ...base, ...overrides[id] }
    }
    return base
  })
}

// Act 9: Reset & Attack
acts.push({
  id: 'act-9',
  title: '9. Reset: Attacking Phase',
  caption: 'We are now attacking deep in their half. 10 is on the ball.',
  balls: [{ id: 'ball-1', x: 75, y: 50 }],
  tokens: cloneTokens2({}),
  bands: [
    { id: 'b-zone-high', kind: 'zone', rect: { x: 50, y: 5, w: 45, h: 90 }, tone: 'green', edge: 'dashed' }
  ],
  arrows: [],
  texts: [
    { id: 'tx-9', x: 50, y: 10, text: 'High Line', size: 's', look: 'bare', align: 'center', tone: 'green' }
  ]
})

// Act 10: The Turnover
acts.push({
  id: 'act-10',
  title: '10. The Turnover',
  caption: 'Our 10 attempts a risky pass and loses the ball to their DM.',
  balls: [{ id: 'ball-1', x: 78, y: 45 }],
  tokens: cloneTokens2({}),
  bands: [],
  arrows: [
    { id: 'ar-pass-bad', kind: 'pass', from: { x: 75, y: 50 }, to: { x: 78, y: 45 }, fromId: 'u-10', toId: 'o-cdm1' }
  ],
  texts: [
    { id: 'tx-10', x: 75, y: 60, text: 'TURNOVER', size: 'l', look: 'plate', align: 'center', weight: 'bold', tone: 'red' }
  ]
})

// Act 11: The Reaction
acts.push({
  id: 'act-11',
  title: '11. The Reaction',
  caption: 'Instead of dropping back, our nearest 3 players immediately react.',
  balls: [{ id: 'ball-1', x: 78, y: 45 }],
  tokens: cloneTokens2({
    'u-10': { cue: 'PRESS' },
    'u-9': { cue: 'PRESS' },
    'u-8': { cue: 'PRESS' }
  }),
  bands: [],
  arrows: [],
  texts: [
    { id: 'tx-11', x: 70, y: 70, text: 'The 5-Second Rule', size: 'm', look: 'bare', align: 'center', tone: 'gold', weight: 'bold' }
  ]
})

// Act 12: Swarming the Ball
acts.push({
  id: 'act-12',
  title: '12. Swarming the Ball',
  caption: '10, 8, and 9 swarm the DM from different angles, blocking passing lanes.',
  balls: [{ id: 'ball-1', x: 78, y: 45 }],
  tokens: cloneTokens2({
    'u-10': { x: 76, y: 47, cue: 'PRESS' },
    'u-9': { x: 80, y: 45, cue: 'PRESS' },
    'u-8': { x: 75, y: 40, cue: 'PRESS' }
  }),
  bands: [],
  arrows: [
    { id: 'ar-p1', kind: 'press', from: { x: 75, y: 50 }, to: { x: 76, y: 47 }, fromId: 'u-10' },
    { id: 'ar-p2', kind: 'press', from: { x: 85, y: 50 }, to: { x: 80, y: 45 }, fromId: 'u-9' },
    { id: 'ar-p3', kind: 'press', from: { x: 65, y: 35 }, to: { x: 75, y: 40 }, fromId: 'u-8' }
  ],
  texts: []
})

// Act 13: Suffocation
acts.push({
  id: 'act-13',
  title: '13. Suffocation',
  caption: 'The DM has zero time to look up or pick a pass.',
  balls: [{ id: 'ball-1', x: 78, y: 45 }],
  tokens: cloneTokens2({
    'u-10': { x: 76, y: 47 },
    'u-9': { x: 80, y: 45 },
    'u-8': { x: 75, y: 40 }
  }),
  bands: [
    { id: 'b-danger2', kind: 'danger', shape: 'ellipse', rect: { x: 72, y: 35, w: 12, h: 20 }, tone: 'red' }
  ],
  arrows: [],
  texts: []
})

// Act 14: The Recovery
acts.push({
  id: 'act-14',
  title: '14. The Recovery',
  caption: 'Our 8 wins the ball back before the opposition can transition.',
  balls: [{ id: 'ball-1', x: 75, y: 40 }], // 8 has the ball
  tokens: cloneTokens2({
    'u-10': { x: 76, y: 47 },
    'u-9': { x: 80, y: 45 },
    'u-8': { x: 75, y: 40 },
    'o-lcb': { dim: true }, 'o-rcb': { dim: true }, 'o-rb': { dim: true }, 'o-cdm2': { dim: true },
    'o-am': { dim: true }, 'o-rw': { dim: true }, 'o-9': { dim: true }, 'o-lb': { dim: true }, 'o-cdm1': { dim: true }
  }),
  bands: [],
  arrows: [],
  texts: [
    { id: 'tx-14', x: 75, y: 30, text: 'BALL RECOVERED', size: 's', look: 'plate', align: 'center', tone: 'gold' }
  ]
})

// Act 15: The Second Wave Attack
acts.push({
  id: 'act-15',
  title: '15. The Second Wave Attack',
  caption: '8 instantly finds the Left Winger in space, capitalizing on the disorganized defense.',
  balls: [{ id: 'ball-1', x: 85, y: 25 }],
  tokens: cloneTokens2({
    'u-10': { x: 76, y: 47 },
    'u-9': { x: 80, y: 45 },
    'u-8': { x: 75, y: 40 },
    'u-lw': { x: 85, y: 25 },
    'o-lcb': { dim: true }, 'o-rcb': { dim: true }, 'o-rb': { dim: true }, 'o-cdm2': { dim: true },
    'o-am': { dim: true }, 'o-rw': { dim: true }, 'o-9': { dim: true }, 'o-lb': { dim: true }, 'o-cdm1': { dim: true }
  }),
  bands: [],
  arrows: [
    { id: 'ar-pass-lw', kind: 'pass', from: { x: 75, y: 40 }, to: { x: 85, y: 25 }, fromId: 'u-8', toId: 'u-lw' }
  ],
  texts: []
})


async function doIt() {
  const { url, headers } = creds()
  const targetId = '9919a53b-e7d9-411f-9d96-31be35ca6f64'
  
  const doc = {
    v: 1,
    title: 'Gegenpressing Masterclass',
    subtitle: 'The 15-Phase Tactical Breakdown',
    pitch: 'attacking-half',
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
  console.log(`Successfully created advanced system ${sysId} for ${targetId}`)
}

doIt().catch(console.error)
