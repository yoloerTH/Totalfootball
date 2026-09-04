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

async function doIt() {
  const { url, headers } = creds()
  
  const targetId = '9919a53b-e7d9-411f-9d96-31be35ca6f64'
  console.log("Found UUID:", targetId)

  const doc = {
    "v": 1,
    "title": "Gegenpressing",
    "subtitle": "The best playmaker is a good counter-press",
    "pitch": "attacking-half",
    "matchBall": "brazuca",
    "teams": {
      "us": { "name": "Our team", "base": "#08C16A", "deep": "#06A659", "text": "#FFFFFF" },
      "them": { "name": "Opposition", "base": "#E2473B", "deep": "#B5392F", "text": "#FFFFFF" }
    },
    "acts": [
      {
        "id": "act-1",
        "title": "The Trap is Set",
        "caption": "We have lost the ball, but are perfectly structured to press.",
        "ball": { "x": 80, "y": 80 },
        "tokens": [
          { "id": "u-9", "x": 60, "y": 50, "label": "9", "side": "us" },
          { "id": "u-lw", "x": 65, "y": 20, "label": "LW", "side": "us" },
          { "id": "u-rw", "x": 65, "y": 80, "label": "RW", "side": "us" },
          { "id": "u-10", "x": 50, "y": 50, "label": "10", "side": "us" },
          { "id": "u-8", "x": 40, "y": 20, "label": "8", "side": "us" },
          { "id": "u-6", "x": 40, "y": 80, "label": "6", "side": "us" },
          { "id": "o-lcb", "x": 85, "y": 40, "label": "CB", "side": "them" },
          { "id": "o-rcb", "x": 85, "y": 60, "label": "CB", "side": "them" },
          { "id": "o-lb", "x": 75, "y": 10, "label": "LB", "side": "them" },
          { "id": "o-rb", "x": 80, "y": 80, "label": "RB", "side": "them", "cue": "PRESS" }
        ],
        "arrows": [],
        "bands": []
      },
      {
        "id": "act-2",
        "title": "Immediate Pressure",
        "caption": "The RB receives the ball. We swarm him immediately, closing all passing lanes.",
        "ball": { "x": 80, "y": 80 },
        "tokens": [
          { "id": "u-9", "x": 75, "y": 65, "label": "9", "side": "us" },
          { "id": "u-lw", "x": 75, "y": 30, "label": "LW", "side": "us" },
          { "id": "u-rw", "x": 75, "y": 80, "label": "RW", "side": "us", "cue": "PRESS" },
          { "id": "u-10", "x": 70, "y": 70, "label": "10", "side": "us" },
          { "id": "u-8", "x": 60, "y": 40, "label": "8", "side": "us" },
          { "id": "u-6", "x": 60, "y": 80, "label": "6", "side": "us" },
          { "id": "o-lcb", "x": 85, "y": 40, "label": "CB", "side": "them" },
          { "id": "o-rcb", "x": 85, "y": 60, "label": "CB", "side": "them" },
          { "id": "o-lb", "x": 75, "y": 10, "label": "LB", "side": "them" },
          { "id": "o-rb", "x": 80, "y": 80, "label": "RB", "side": "them" }
        ],
        "arrows": [
          { "id": "ar-1", "kind": "press", "from": { "x": 65, "y": 80 }, "to": { "x": 75, "y": 80 } },
          { "id": "ar-2", "kind": "run", "from": { "x": 60, "y": 50 }, "to": { "x": 75, "y": 65 } },
          { "id": "ar-3", "kind": "run", "from": { "x": 50, "y": 50 }, "to": { "x": 70, "y": 70 } }
        ],
        "bands": [
          { "id": "bd-1", "kind": "danger", "shape": "diamond", "rect": { "x": 65, "y": 65, "w": 25, "h": 25 }, "tone": "red" }
        ]
      },
      {
        "id": "act-3",
        "title": "Winning the Ball",
        "caption": "We win the ball high up the pitch. Their defense is unorganized.",
        "ball": { "x": 75, "y": 80 },
        "tokens": [
          { "id": "u-9", "x": 75, "y": 65, "label": "9", "side": "us" },
          { "id": "u-lw", "x": 75, "y": 30, "label": "LW", "side": "us" },
          { "id": "u-rw", "x": 75, "y": 80, "label": "RW", "side": "us" },
          { "id": "u-10", "x": 70, "y": 70, "label": "10", "side": "us" },
          { "id": "u-8", "x": 60, "y": 40, "label": "8", "side": "us" },
          { "id": "u-6", "x": 60, "y": 80, "label": "6", "side": "us" },
          { "id": "o-lcb", "x": 85, "y": 40, "label": "CB", "side": "them" },
          { "id": "o-rcb", "x": 85, "y": 60, "label": "CB", "side": "them", "cue": "PRESS" },
          { "id": "o-lb", "x": 75, "y": 10, "label": "LB", "side": "them" },
          { "id": "o-rb", "x": 80, "y": 80, "label": "RB", "side": "them", "dim": true }
        ],
        "arrows": [
          { "id": "ar-4", "kind": "pass", "from": { "x": 75, "y": 80 }, "to": { "x": 75, "y": 65 } }
        ],
        "bands": []
      },
      {
        "id": "act-4",
        "title": "The Strike",
        "caption": "A quick pass to the striker results in an immediate chance.",
        "ball": { "x": 90, "y": 50 },
        "tokens": [
          { "id": "u-9", "x": 85, "y": 55, "label": "9", "side": "us" },
          { "id": "u-lw", "x": 80, "y": 30, "label": "LW", "side": "us" },
          { "id": "u-rw", "x": 75, "y": 80, "label": "RW", "side": "us", "dim": true },
          { "id": "u-10", "x": 75, "y": 70, "label": "10", "side": "us" },
          { "id": "u-8", "x": 60, "y": 40, "label": "8", "side": "us", "dim": true },
          { "id": "u-6", "x": 60, "y": 80, "label": "6", "side": "us", "dim": true },
          { "id": "o-lcb", "x": 90, "y": 45, "label": "CB", "side": "them" },
          { "id": "o-rcb", "x": 85, "y": 60, "label": "CB", "side": "them" },
          { "id": "o-lb", "x": 80, "y": 15, "label": "LB", "side": "them" },
          { "id": "o-rb", "x": 80, "y": 80, "label": "RB", "side": "them", "dim": true }
        ],
        "arrows": [
          { "id": "ar-5", "kind": "run", "from": { "x": 75, "y": 65 }, "to": { "x": 85, "y": 55 } },
          { "id": "ar-6", "kind": "pass", "from": { "x": 75, "y": 65 }, "to": { "x": 90, "y": 50 } }
        ],
        "bands": []
      }
    ]
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
  console.log(`Successfully created system ${sysId} for ${targetId}`)
}

doIt().catch(console.error)
