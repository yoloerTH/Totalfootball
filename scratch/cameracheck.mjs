// Does a followed camera still behave on the anchored set-piece crop?
const U = 10, PAD = 3, GOAL_AT = 0.2
const PUSHES = { gentle: [0.8, 0.97], standard: [0.68, 0.81], close: [0.56, 0.63] }
const MARGIN = { gentle: 15, standard: 12, close: 10 }
const frame = { w: 1080, h: 1920 }
const VIEWS = {
  'attacking-set-piece': { x0: 52.5, x1: 105, y0: 0, y1: 68, vertical: true, goalMx: 105 },
  'defending-set-piece': { x0: 0, x1: 52.5, y0: 0, y1: 68, vertical: true, flip: true, goalMx: 0 },
}
function frameView(v) {
  const lenX = v.x1 - v.x0, lenY = v.y1 - v.y0, want = frame.w / frame.h
  const wide = lenY + PAD * 2, tall = lenX + PAD * 2
  const growWide = wide / tall < want
  const extra = growWide ? (want * tall - wide) / 2 : (wide / want - tall) / 2
  const onY = growWide === true
  const pad = { x: PAD + (onY ? 0 : extra), y: PAD + (onY ? extra : 0) }
  const screenH = (lenX + pad.x * 2) * U
  return { ...v, pad, yShift: !onY ? screenH * (0.5 - GOAL_AT) - (lenX / 2) * U : 0 }
}
const cc = (v) => ({ cx: ((v.x0 + v.x1) / 2) * U, cy: ((v.y0 + v.y1) / 2) * U })
function cropRect(v) {
  const w = (v.x1 - v.x0 + v.pad.x * 2) * U, h = (v.y1 - v.y0 + v.pad.y * 2) * U
  const { cx, cy } = cc(v)
  return { x: cx - h / 2, y: cy - w / 2 + v.yShift, w: h, h: w }
}
function mToU(v, mx, my) {
  const { cx, cy } = cc(v), dx = mx * U - cx, dy = my * U - cy
  return v.flip ? { x: cx - dy, y: cy + dx } : { x: cx + dy, y: cy - dx }
}
const toUnits = (v, px, py) => mToU(v, v.x0 + (px / 100) * (v.x1 - v.x0), v.y0 + (py / 100) * (v.y1 - v.y0))
function cameraRect(v, shot, [tightest, widest]) {
  const crop = cropRect(v)
  if (!shot) return crop
  const hw = shot.w / 2, hh = shot.h / 2
  const cs = [toUnits(v, shot.x - hw, shot.y - hh), toUnits(v, shot.x + hw, shot.y - hh),
              toUnits(v, shot.x - hw, shot.y + hh), toUnits(v, shot.x + hw, shot.y + hh)]
  const bx0 = Math.min(...cs.map(c => c.x)), bx1 = Math.max(...cs.map(c => c.x))
  const by0 = Math.min(...cs.map(c => c.y)), by1 = Math.max(...cs.map(c => c.y))
  const a = crop.w / crop.h
  let w = Math.max(bx1 - bx0, (by1 - by0) * a)
  w = Math.min(Math.max(w, crop.w * tightest), crop.w * widest, crop.w)
  const h = w / a
  const cx = (bx0 + bx1) / 2, cy2 = (by0 + by1) / 2
  const cl = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
  return { x: cl(cx - w / 2, crop.x, crop.x + crop.w - w), y: cl(cy2 - h / 2, crop.y, crop.y + crop.h - h), w, h }
}
function bands(v, r) { const { cy } = cc(v), hl = ((v.x1 - v.x0) / 2) * U, k = frame.h / r.h
  const goal = (cy - hl - r.y) * k; return { goal, halfway: goal + hl * 2 * k } }

// Ball positions a real set piece uses, in METRES, per board.
const BALLS = {
  'attacking-set-piece': [['corner flag', 105, 0], ['near post', 99.5, 25.7], ['penalty spot', 94, 34], ['wide free kick', 88, 8]],
  'defending-set-piece': [['corner flag', 0, 0], ['near post', 5.5, 25.7], ['penalty spot', 11, 34], ['wide free kick', 17, 60]],
}
const faults = []
for (const [id, base] of Object.entries(VIEWS)) {
  const v = frameView(base)
  const crop = cropRect(v)
  console.log(`\n== ${id} ==`)
  for (const push of ['gentle', 'standard', 'close']) {
    for (const [label, mx, my] of BALLS[id]) {
      // The shot camera.ts derives: the ball, plus margin metres each way.
      const px = ((mx - v.x0) / (v.x1 - v.x0)) * 100, py = ((my - v.y0) / (v.y1 - v.y0)) * 100
      const m = MARGIN[push]
      const shot = { x: px, y: py, w: (m / (v.x1 - v.x0)) * 200, h: (m / (v.y1 - v.y0)) * 200 }
      const r = cameraRect(v, shot, PUSHES[push])
      const b = bands(v, r)
      const at = (ax, ay) => { const u = mToU(v, ax, ay); return { x: ((u.x - r.x) / r.w) * frame.w, y: ((u.y - r.y) / r.h) * frame.h } }
      const ball = at(mx, my)
      const goalLine = at(base.goalMx, 34).y
      const inFrame = ball.x >= 0 && ball.x <= frame.w && ball.y >= 0 && ball.y <= frame.h
      console.log(`  ${push.padEnd(9)} ${label.padEnd(15)} ball@(${ball.x.toFixed(0)},${ball.y.toFixed(0)})  frame ${(r.w/U).toFixed(1)}m x ${(r.h/U).toFixed(1)}m  goal y=${goalLine.toFixed(0)}  bands ${b.goal.toFixed(0)}/${b.halfway.toFixed(0)}`)
      if (!inFrame) faults.push(`${id}/${push}/${label}: BALL OFF SCREEN at (${ball.x.toFixed(0)},${ball.y.toFixed(0)})`)
      if (r.x < crop.x - 1e-6 || r.y < crop.y - 1e-6 || r.x + r.w > crop.x + crop.w + 1e-6 || r.y + r.h > crop.y + crop.h + 1e-6)
        faults.push(`${id}/${push}/${label}: camera escaped the crop — void grass on an edge`)
      if (Math.abs(r.w / r.h - frame.w / frame.h) > 1e-9) faults.push(`${id}/${push}/${label}: camera aspect ${(r.w/r.h).toFixed(4)} != frame`)
      if (Math.abs(b.goal - goalLine) > 0.01) faults.push(`${id}/${push}/${label}: band goal ${b.goal.toFixed(2)} != goal line ${goalLine.toFixed(2)} — fade would sit on the wrong grass`)
    }
  }
}
console.log(faults.length ? `\nFAULTS:\n  ${faults.join('\n  ')}` : '\nAll checks pass.')
process.exit(faults.length ? 1 : 0)
