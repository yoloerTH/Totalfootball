// Verifies the set-piece export framing against the real pitch, in metres.
const U = 10, PAD = 3, GOAL_AT = 0.2
const VIEWS = {
  'attacking-set-piece': { x0: 52.5, x1: 105, y0: 0, y1: 68, vertical: true, goalMx: 105, halfMx: 52.5 },
  'defending-set-piece': { x0: 0, x1: 52.5, y0: 0, y1: 68, vertical: true, flip: true, goalMx: 0, halfMx: 52.5 },
}
const SHAPES = { vertical: { w: 1080, h: 1920 }, landscape: { w: 1920, h: 1080 } }

function frameView(v, frame) {
  const lenX = v.x1 - v.x0, lenY = v.y1 - v.y0, want = frame.w / frame.h
  const upright = Boolean(v.vertical)           // set pieces never turn
  const wide = (upright ? lenY : lenX) + PAD * 2
  const tall = (upright ? lenX : lenY) + PAD * 2
  const growWide = wide / tall < want
  const extra = growWide ? (want * tall - wide) / 2 : (wide / want - tall) / 2
  const onY = growWide === upright
  const pad = { x: PAD + (onY ? 0 : extra), y: PAD + (onY ? extra : 0) }
  const screenH = (upright ? lenX + pad.x * 2 : lenY + pad.y * 2) * U
  const yShift = !onY ? screenH * (0.5 - GOAL_AT) - (lenX / 2) * U : 0
  return { ...v, pad, yShift }
}
const cropCentre = (v) => ({ cx: ((v.x0 + v.x1) / 2) * U, cy: ((v.y0 + v.y1) / 2) * U })
function cropRect(v) {
  const w = (v.x1 - v.x0 + v.pad.x * 2) * U, h = (v.y1 - v.y0 + v.pad.y * 2) * U
  const { cx, cy } = cropCentre(v)
  return { x: cx - h / 2, y: cy - w / 2 + v.yShift, w: h, h: w }
}
function toUnits(v, mx, my) {
  const { cx, cy } = cropCentre(v), dx = mx * U - cx, dy = my * U - cy
  return v.flip ? { x: cx - dy, y: cy + dx } : { x: cx + dy, y: cy - dx }
}
function focusBands(v, r, frame) {
  const { cy } = cropCentre(v), halfLen = ((v.x1 - v.x0) / 2) * U, perPx = frame.h / r.h
  const goal = (cy - halfLen - r.y) * perPx
  return { goal, halfway: goal + halfLen * 2 * perPx }
}

let bad = []
for (const [shapeName, frame] of Object.entries(SHAPES)) {
  for (const [id, base] of Object.entries(VIEWS)) {
    const v = frameView(base, frame)
    const r = cropRect(v)
    const px = (mx, my) => {
      const u = toUnits(v, mx, my)
      return { x: ((u.x - r.x) / r.w) * frame.w, y: ((u.y - r.y) / r.h) * frame.h }
    }
    const b = focusBands(v, r, frame)
    const goalPx = px(base.goalMx, 34).y
    const halfPx = px(base.halfMx, 34).y
    const farGoal = px(base.goalMx === 105 ? 0 : 105, 34).y
    const line0 = px(base.goalMx, 0).x, line68 = px(base.goalMx, 68).x
    console.log(`\n${shapeName}  ${id}  ${frame.w}x${frame.h}`)
    console.log(`  crop aspect          ${(r.w / r.h).toFixed(4)}   frame ${(frame.w / frame.h).toFixed(4)}`)
    console.log(`  grass on screen      ${(r.w / U).toFixed(1)}m across  x  ${(r.h / U).toFixed(1)}m along`)
    console.log(`  defended goal line   y = ${goalPx.toFixed(0)}px   (${(goalPx / frame.h * 100).toFixed(1)}% down)`)
    console.log(`  halfway line         y = ${halfPx.toFixed(0)}px   (${(halfPx / frame.h * 100).toFixed(1)}%)`)
    console.log(`  far goal line        y = ${farGoal.toFixed(0)}px`)
    console.log(`  touchlines           x = ${line0.toFixed(0)}px .. ${line68.toFixed(0)}px  (frame 0..${frame.w})`)
    console.log(`  corner flags on?     ${line0 >= 0 && line68 <= frame.w ? 'YES' : 'NO — CUT'}`)
    console.log(`  bands.goal/halfway   ${b.goal.toFixed(0)}px / ${b.halfway.toFixed(0)}px`)
    if (Math.abs(r.w / r.h - frame.w / frame.h) > 1e-9) bad.push(`${shapeName}/${id}: crop aspect != frame`)
    if (Math.abs(b.goal - goalPx) > 0.01) bad.push(`${shapeName}/${id}: band goal ${b.goal.toFixed(2)} != goal line ${goalPx.toFixed(2)}`)
    if (Math.abs(b.halfway - halfPx) > 0.01) bad.push(`${shapeName}/${id}: band halfway ${b.halfway.toFixed(2)} != halfway ${halfPx.toFixed(2)}`)
    if (line0 < 0 || line68 > frame.w) bad.push(`${shapeName}/${id}: touchline cut off — corner taker lost`)
    if (shapeName === 'vertical' && Math.abs(goalPx / frame.h - GOAL_AT) > 1e-6) bad.push(`${shapeName}/${id}: goal at ${(goalPx/frame.h).toFixed(4)}, wanted ${GOAL_AT}`)
  }
}
console.log(bad.length ? `\nFAULTS:\n  ${bad.join('\n  ')}` : '\nAll checks pass.')
process.exit(bad.length ? 1 : 0)
