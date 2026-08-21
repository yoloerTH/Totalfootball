/**
 * Arrows and shaded bands — the parts of a coach's board that carry the idea.
 *
 * Arrows take an INTENT (pass, run, carry, press, switch) rather than a set of
 * drawing properties, so a coach picks what they mean and the house style
 * decides how it looks. That is the constraint the whole studio is built on:
 * every board a coach makes should look like it came off our channel, and it
 * cannot if they are choosing dash patterns.
 *
 * Bands follow their players. A block band stores the token ids it runs
 * through, not a frozen polygon, so dragging a centre-back reshapes the
 * protected zone instead of leaving it behind — the same behaviour the videos'
 * `BlockBand` gets for free from being recomputed every frame.
 */

import { U } from './pitch'
import { arrowStyle, resolveBandStyle, useSurface, type BandStrength, type BandTone } from './surfaces'
import type { ArrowKind, BandKind, BandShape } from '../schema'

/**
 * What a coach has changed about one band's appearance, as the board sees it.
 *
 * The document stores these as plain strings (see `Band` in ../schema.ts), and
 * they are narrowed HERE rather than there — an unrecognised value has to land
 * somewhere, and the only sane place for it to land is the drawing code, which
 * can shrug and use the house treatment. A document written by a newer build
 * therefore opens in an older one and simply looks like it always did.
 */
export interface BandLook {
  tone?: string
  strength?: string
  shape?: BandShape
  solid?: boolean
}

const TONES = ['gold', 'red', 'green', 'blue', 'grey']
const STRENGTHS = ['soft', 'normal', 'strong']

function look(l: BandLook | undefined) {
  return {
    tone: l && TONES.includes(l.tone ?? '') ? (l.tone as BandTone) : undefined,
    strength: l && STRENGTHS.includes(l.strength ?? '') ? (l.strength as BandStrength) : undefined,
  }
}

const u = (m: number) => m * U

export interface Pt {
  x: number
  y: number
}

/**
 * The quadratic curve behind every arrow. `bend` is -1..1; the control point is
 * pushed off the midpoint along the perpendicular, so 0 is a straight line and
 * the sign picks which way it bows.
 */
export function arrowGeometry(a: Pt, b: Pt, bend = 0) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len
  const py = dx / len
  const off = bend * len * 0.28
  const c = { x: (a.x + b.x) / 2 + px * off, y: (a.y + b.y) / 2 + py * off }
  // Point at t=0.5 on the quadratic, where a label sits without fouling the line.
  const mid = { x: 0.25 * a.x + 0.5 * c.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * c.y + 0.25 * b.y }
  return { c, mid, len }
}

/** Sample a quadratic bezier. Used for the carry's waviness. */
function qAt(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const it = 1 - t
  return {
    x: it * it * a.x + 2 * it * t * c.x + t * t * b.x,
    y: it * it * a.y + 2 * it * t * c.y + t * t * b.y,
  }
}

/**
 * A carry is drawn as a squiggle, the way a coach scribbles "he takes it
 * himself". Built by walking the curve and pushing each sample off the
 * perpendicular on a sine, so the wave follows the bend instead of being laid
 * over a straight line.
 */
function wavyPath(a: Pt, c: Pt, b: Pt, amp: number): string {
  const steps = 48
  const pts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const p = qAt(a, c, b, t)
    const n = qAt(a, c, b, Math.min(1, t + 0.01))
    const dx = n.x - p.x
    const dy = n.y - p.y
    const l = Math.hypot(dx, dy) || 1
    // taper the wave to nothing at both ends so it starts and lands cleanly
    const taper = Math.sin(t * Math.PI)
    const w = Math.sin(t * Math.PI * 9) * amp * taper
    pts.push(`${p.x + (-dy / l) * w} ${p.y + (dx / l) * w}`)
  }
  return `M ${pts.join(' L ')}`
}

interface ArrowProps {
  kind: ArrowKind
  /** Endpoints in SVG units. */
  a: Pt
  b: Pt
  bend?: number
  label?: string
  active?: boolean
  /**
   * Makes the arrow pickable, so a coach can select the one they want to
   * delete instead of clearing all of them. The hit area is a fat invisible
   * stroke over the same curve — an arrow is 4cm of ink and nobody can click
   * 4cm of ink. See ../editor/StudioEditor.tsx, which only passes this while
   * the Move tool is active: a drawing tool has to be able to start a new mark
   * on top of an old one.
   */
  onPointerDown?: (e: React.PointerEvent<SVGPathElement>) => void
}

export function Arrow({ kind, a, b, bend = 0, label, active = false, onPointerDown }: ArrowProps) {
  const p = useSurface()
  const s = arrowStyle(p)[kind]
  const { c, mid, len } = arrowGeometry(a, b, bend)
  const w = u(s.width)
  const head = w * 3.1

  // Stop the shaft short of the tip so the stroke does not thicken the head.
  const tipDx = b.x - c.x
  const tipDy = b.y - c.y
  const tipLen = Math.hypot(tipDx, tipDy) || 1
  const ux = tipDx / tipLen
  const uy = tipDy / tipLen
  const end = { x: b.x - ux * head * 0.82, y: b.y - uy * head * 0.82 }

  const wavy = s.wavy
  const d = wavy
    ? wavyPath(a, c, end, w * 1.5)
    : `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${end.x} ${end.y}`

  // Head as an explicit polygon rather than a <marker>: markers inherit
  // stroke-width scaling rules that differ once the SVG is rasterised, and a
  // polygon is the same three points everywhere.
  const nx = -uy
  const ny = ux
  const headPts = [
    `${b.x} ${b.y}`,
    `${b.x - ux * head + nx * head * 0.5} ${b.y - uy * head + ny * head * 0.5}`,
    `${b.x - ux * head - nx * head * 0.5} ${b.y - uy * head - ny * head * 0.5}`,
  ].join(' L ')

  return (
    <g pointerEvents="none">
      {/* A casing in the GROUND's own colour, so an arrow crossing a counter still
          reads. Fixed off-white here would draw a halo round every arrow on a
          green pitch, which is why `halo` is part of the surface. */}
      <path
        d={d}
        fill="none"
        stroke={p.halo}
        strokeOpacity={0.85}
        strokeWidth={w * 2.5}
        strokeLinecap="round"
      />
      {active && (
        // The selected mark wears a soft gold halo rather than a dashed outline:
        // it survives being exported by accident, and it reads at thumbnail size.
        <path
          d={d}
          fill="none"
          stroke={p.gold}
          strokeOpacity={0.45}
          strokeWidth={w * 4}
          strokeLinecap="round"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={active ? p.goldDeep : s.color}
        strokeWidth={w}
        strokeLinecap="round"
        strokeDasharray={s.dash ? `${u(s.dash[0])} ${u(s.dash[1])}` : undefined}
      />
      <path d={`M ${headPts} Z`} fill={active ? p.goldDeep : s.color} />

      {onPointerDown && (
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(w * 5, u(2.2))}
          strokeLinecap="round"
          pointerEvents="stroke"
          onPointerDown={onPointerDown}
          style={{ cursor: 'pointer' }}
        />
      )}

      {label && (
        <text
          x={mid.x}
          y={mid.y - w * 1.6}
          textAnchor="middle"
          fontFamily="Inter Variable, Inter, system-ui, sans-serif"
          fontWeight={800}
          fontSize={Math.min(u(2), Math.max(u(1.1), len * 0.06))}
          fill={s.color}
          stroke={p.halo}
          strokeWidth={u(0.34)}
          paintOrder="stroke"
        >
          {label}
        </text>
      )}
    </g>
  )
}

interface BlockBandProps {
  idp: string
  kind: BandKind
  /** The player line, in order along the defensive line, in SVG units. */
  pts: Pt[]
  /**
   * The goal line being protected: which axis it runs along and where, in SVG
   * units. From `defendedGoal()` — an axis rather than a bare x because upright
   * views stand the pitch on its end and the goal line becomes horizontal.
   */
  close: { axis: 'x' | 'y'; at: number }
  label?: string
  active?: boolean
  /** The coach's overrides, if they have set any. */
  band?: BandLook
  onPointerDown?: (e: React.PointerEvent<SVGPathElement>) => void
}

/**
 * The defensive block: fills from the back line to the goal, with a thick
 * "string" threaded through the players to say they are one connected unit.
 * This is the single most recognisable visual in the library and the reason
 * `defending-in-a-back-four` reads at a glance.
 */
export function BlockBand({ idp, kind, pts, close, label, active, band, onPointerDown }: BlockBandProps) {
  if (pts.length < 2) return null
  const p = useSurface()
  const s = resolveBandStyle(p, kind, look(band))
  // Keyed by the band's OWN id upstream, so two blocks in different colours on
  // the same board do not collide on one gradient and both come out the first
  // one's colour.
  const gid = `${idp}-band-${kind}`
  const first = pts[0]
  const last = pts[pts.length - 1]
  const line = pts.map((p) => `${p.x} ${p.y}`).join(' L ')
  const across = close.axis === 'x'

  // Close the polygon onto the goal line, running back from whichever end of
  // the player line we finished on.
  const fill = across
    ? `M ${line} L ${close.at} ${last.y} L ${close.at} ${first.y} Z`
    : `M ${line} L ${last.x} ${close.at} L ${first.x} ${close.at} Z`

  // Point the gradient at the goal, whichever side of the line it is on.
  const toEnd = across ? close.at > first.x : close.at > first.y
  const grad = across
    ? { x1: toEnd ? '0' : '1', y1: '0', x2: toEnd ? '1' : '0', y2: '0' }
    : { x1: '0', y1: toEnd ? '0' : '1', x2: '0', y2: toEnd ? '1' : '0' }

  // Label: centred across the band, and always OUTSIDE it on the side away
  // from the goal, so it never sits on top of the shading or a counter.
  const midAcross = across
    ? { x: (Math.min(...pts.map((p) => p.x)) + close.at) / 2, y: Math.min(...pts.map((p) => p.y)) - u(2.2) }
    : {
        x: (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2,
        y: toEnd ? Math.min(...pts.map((p) => p.y)) - u(2.2) : Math.max(...pts.map((p) => p.y)) + u(3.4),
      }

  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id={gid} x1={grad.x1} y1={grad.y1} x2={grad.x2} y2={grad.y2}>
          <stop offset="0%" stopColor={s.tone} stopOpacity={s.fill} />
          <stop offset="100%" stopColor={s.tone} stopOpacity={s.fill * 0.27} />
        </linearGradient>
      </defs>
      <path
        d={fill}
        fill={`url(#${gid})`}
        stroke={active ? p.goldDeep : s.tone}
        strokeOpacity={active ? 0.9 : s.edge}
        strokeWidth={active ? u(0.5) : u(0.26)}
        pointerEvents={onPointerDown ? 'fill' : undefined}
        onPointerDown={onPointerDown}
        style={onPointerDown ? { cursor: 'pointer' } : undefined}
      />
      {s.string > 0 && (
        <path
          d={`M ${line}`}
          fill="none"
          stroke={s.tone}
          strokeOpacity={s.string}
          strokeWidth={u(1.15)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {label && (
        // Anchored to the band's own bounding box, not to pts[0] — the first
        // defender is rarely the highest one, and anchoring to him drops the
        // label onto a counter as soon as the line is anything but flat.
        <text
          x={midAcross.x}
          y={midAcross.y}
          textAnchor="middle"
          fontFamily="Inter Variable, Inter, system-ui, sans-serif"
          fontWeight={800}
          fontSize={u(1.7)}
          letterSpacing={u(0.08)}
          fill={s.tone}
          stroke={p.halo}
          strokeWidth={u(0.34)}
          paintOrder="stroke"
        >
          {label}
        </text>
      )}
    </g>
  )
}

interface ZoneProps {
  idp: string
  kind: BandKind
  /** Rectangle in SVG units. */
  rect: { x: number; y: number; w: number; h: number }
  label?: string
  active?: boolean
  band?: BandLook
  onPointerDown?: (e: React.PointerEvent<SVGElement>) => void
}

/**
 * A plain shaded area: the danger zone, a channel, a trap.
 *
 * Three outlines off one rectangle. The stored geometry is a box whatever the
 * shape is, and that is deliberate rather than lazy — it means changing an
 * ellipse to a box is a change of appearance and not a redraw, the resize grips
 * in the editor are the same four corners for all three, and nothing about the
 * document has to know which one is showing.
 */
export function Zone({ idp, kind, rect, label, active, band, onPointerDown }: ZoneProps) {
  const p = useSurface()
  const s = resolveBandStyle(p, kind, look(band))
  const gid = `${idp}-zone-${kind}`
  const shape: BandShape = band?.shape ?? 'box'

  // A round box's corner radius is a fraction of its SHORT side, so a long thin
  // channel comes out with the same visible softness as a square pocket rather
  // than turning into a lozenge.
  const rx =
    shape === 'round' ? Math.min(rect.w, rect.h) * 0.22 : shape === 'box' ? u(0.6) : 0

  const common = {
    fill: `url(#${gid})`,
    stroke: active ? p.goldDeep : s.tone,
    strokeOpacity: active ? 0.9 : s.edge,
    strokeWidth: active ? u(0.5) : u(0.26),
    strokeDasharray: band?.solid ? undefined : `${u(1.4)} ${u(0.9)}`,
    pointerEvents: (onPointerDown ? 'fill' : undefined) as 'fill' | undefined,
    onPointerDown,
    style: onPointerDown ? { cursor: 'pointer' } : undefined,
  }

  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={s.tone} stopOpacity={s.fill} />
          <stop offset="100%" stopColor={s.tone} stopOpacity={s.fill * 0.45} />
        </linearGradient>
      </defs>

      {shape === 'ellipse' ? (
        <ellipse
          cx={rect.x + rect.w / 2}
          cy={rect.y + rect.h / 2}
          rx={rect.w / 2}
          ry={rect.h / 2}
          {...common}
        />
      ) : (
        <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={rx} {...common} />
      )}

      {label && (
        // Inside the top edge on a box, and pushed down on an ellipse — the
        // corner of an ellipse's bounding box is empty grass, so a label set at
        // the box's top sits outside the shape it is naming.
        <text
          x={rect.x + rect.w / 2}
          y={rect.y + (shape === 'ellipse' ? rect.h * 0.5 + u(0.6) : u(2.4))}
          textAnchor="middle"
          fontFamily="Inter Variable, Inter, system-ui, sans-serif"
          fontWeight={800}
          fontSize={u(1.7)}
          letterSpacing={u(0.08)}
          fill={s.tone}
          stroke={p.halo}
          strokeWidth={u(0.34)}
          paintOrder="stroke"
        >
          {label}
        </text>
      )}
    </g>
  )
}
