/**
 * The Total Football mark, in React.
 *
 * A port of src/components/brand/Mark.astro, which is itself a port of
 * editor/src/branding/TotalFootballMark.tsx — the same geometry the videos
 * draw, so the credit under a coach's shared system is the same mark as the one
 * on the end card of every short.
 *
 * It exists as a second copy because the Astro component cannot be rendered
 * inside a React island, and the alternative — passing it in as a slot through
 * three layers of props — costs more than forty lines of arithmetic that has
 * not changed since it was written. If the mark ever does change, grep for
 * `arrowBases`.
 */

const GOLD = '#E6B23A'
const GOLD_DEEP = '#C9902B'
const GREEN = '#08C16A'

const DEG = Math.PI / 180
const C = 50
const pt = (cx: number, cy: number, r: number, deg: number) => ({
  x: cx + r * Math.cos(deg * DEG),
  y: cy + r * Math.sin(deg * DEG),
})
const n = (v: number) => v.toFixed(2)

const pentagon = (cx: number, cy: number, r: number, apexDeg: number) =>
  Array.from({ length: 5 }, (_, k) => {
    const p = pt(cx, cy, r, apexDeg + k * 72)
    return `${k === 0 ? 'M' : 'L'}${n(p.x)},${n(p.y)}`
  }).join(' ') + ' Z'

const ballR = 27
const cR = 8.4
const oR = 6
const oDist = 16.6
const centralVerts = Array.from({ length: 5 }, (_, i) => -90 + i * 72)
const rimAngles = Array.from({ length: 5 }, (_, i) => -54 + i * 72)

const arrowR = 40
const span = 26
const arrows = [-90, 30, 150].map((base, i) => {
  const s = pt(C, C, arrowR, base - span)
  const e = pt(C, C, arrowR, base + span)
  const eDeg = base + span
  const tx = -Math.sin(eDeg * DEG)
  const ty = Math.cos(eDeg * DEG)
  const px = -ty
  const py = tx
  const hl = 5.4
  const hw = 3.4
  return {
    arc: `M${n(s.x)},${n(s.y)} A${arrowR} ${arrowR} 0 0 1 ${n(e.x)},${n(e.y)}`,
    head:
      `M${n(e.x + tx * hl)},${n(e.y + ty * hl)} ` +
      `L${n(e.x + px * hw)},${n(e.y + py * hw)} ` +
      `L${n(e.x - px * hw)},${n(e.y - py * hw)} Z`,
    color: i === 0 ? GREEN : GOLD_DEEP,
  }
})

let seq = 0

export function Mark({ size = 24, ink = 'currentColor' }: { size?: number; ink?: string }) {
  // Gradient ids have to be unique per instance: the viewer draws the mark in
  // the credit bar AND on every printed page.
  const gid = `tf-mark-${++seq}`
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={GOLD} />
          <stop offset="45%" stopColor={GOLD_DEEP} />
          <stop offset="100%" stopColor={GREEN} />
        </linearGradient>
      </defs>
      <circle cx={C} cy={C} r={45} fill="none" stroke={`url(#${gid})`} strokeWidth={3.2} />
      {arrows.map((a) => (
        <g key={a.arc}>
          <path d={a.arc} fill="none" stroke={a.color} strokeWidth={2.8} strokeLinecap="round" />
          <path d={a.head} fill={a.color} />
        </g>
      ))}
      <circle cx={C} cy={C} r={ballR} fill="none" stroke={ink} strokeWidth={1.6} opacity={0.92} />
      {centralVerts.map((deg) => {
        const a = pt(C, C, cR, deg)
        const b = pt(C, C, ballR - 0.8, deg)
        return (
          <line
            key={deg}
            x1={n(a.x)}
            y1={n(a.y)}
            x2={n(b.x)}
            y2={n(b.y)}
            stroke={ink}
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={0.9}
          />
        )
      })}
      {rimAngles.map((deg) => {
        const c = pt(C, C, oDist, deg)
        return <path key={deg} d={pentagon(c.x, c.y, oR, deg + 180)} fill={ink} />
      })}
      <path d={pentagon(C, C, cR, -90)} fill={ink} />
    </svg>
  )
}
