import { readFileSync } from 'node:fs'
import { PITCH_VIEW_LIST, toMetres } from '../src/studio/board/pitch.ts'
const doc = JSON.parse(readFileSync('content/systems/sacchis-25-metres.json', 'utf8'))
const view = PITCH_VIEW_LIST.find((v) => v.id === doc.pitch)
const full = PITCH_VIEW_LIST.find((v) => v.id === 'full')
const m = (v, t) => toMetres(v, t.x, t.y)
console.log(`view: ${view.id}  (${view.x0}..${view.x1}m x ${view.y0}..${view.y1}m)\n`)
console.log('phase                          content (m)        dead grass L/R/T/B      fill')
for (const [i, act] of doc.acts.entries()) {
  const pts = [...act.tokens, act.balls[0]].map((t) => m(view, t))
  const lo = { x: Math.min(...pts.map(p=>p.x)), y: Math.min(...pts.map(p=>p.y)) }
  const hi = { x: Math.max(...pts.map(p=>p.x)), y: Math.max(...pts.map(p=>p.y)) }
  const VW = view.x1-view.x0, VH = view.y1-view.y0
  const pc = (n) => `${(n*100).toFixed(0)}%`.padStart(4)
  // what the same football would have looked like on the old `full` crop
  const fL = (lo.x - full.x0) / (full.x1 - full.x0)
  console.log(
    `${(i+1+'. '+act.title).padEnd(30)} ${lo.x.toFixed(0)}..${hi.x.toFixed(0)} x ${lo.y.toFixed(0)}..${hi.y.toFixed(0)}`.padEnd(52) +
    `${pc((lo.x-view.x0)/VW)}${pc((view.x1-hi.x)/VW)}${pc((lo.y-view.y0)/VH)}${pc((view.y1-hi.y)/VH)}` +
    `   ${pc((hi.x-lo.x)/VW)}x${pc((hi.y-lo.y)/VH)}   (on full: ${pc(fL)} dead left)`)
}
