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
import { resolveBandStyle, arrowStyle, useSurface, type BandOverrides } from './surfaces'
import type { ArrowKind, BandKind, BandShape } from '../schema'

/**
 * What a coach has changed about one band's appearance, as the board sees it.
 *
 * The document stores these as plain strings (see `Band` in ../schema.ts) and
 * they are narrowed in `resolveBandStyle` rather than here — an unrecognised
 * value has to land somewhere, and the only sane place for it to land is the
 * one function that decides what a band draws with. A document written by a
 * newer build therefore opens in an older one and simply looks like it always
 * did.
 */
export interface BandLook extends BandOverrides {
  shape?: BandShape
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

/**
 * How a block's shading is closed off.
 *
 * 'goal' takes the goal line those players defend, as an AXIS and a position
 * rather than a bare x: upright views stand the pitch on its end and the goal
 * line becomes horizontal. 'shape' closes the shading round the players
 * themselves and needs no goal at all.
 */
export type BandClose = { axis: 'x' | 'y'; at: number } | 'shape'

interface BlockBandProps {
  idp: string
  kind: BandKind
  /** The player line, in order along the defensive line, in SVG units. */
  pts: Pt[]
  close: BandClose
  label?: string
  active?: boolean
  /** The coach's overrides, if they have set any. */
  band?: BandLook
  onPointerDown?: (e: React.PointerEvent<SVGPathElement>) => void
}

/**
 * The convex hull of a handful of points, by monotone chain.
 *
 * WHY A HULL AND NOT THE CLICK ORDER. The order a coach picked the players in
 * is the data everywhere else — it is what the string threads through, and a
 * zigzag is a real shape somebody meant. It is the wrong thing to close a
 * REGION with: three players picked left, right, middle close into a bow tie
 * that crosses itself and fills nothing. The hull is the shape a coach draws
 * round a unit on a whiteboard, and the string on top still shows the order.
 *
 * Returns fewer than three points when they are collinear, which the caller
 * handles as a capsule.
 */
function hullOf(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y)
  if (p.length < 3) return p
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const half = (src: Pt[]): Pt[] => {
    const out: Pt[] = []
    for (const q of src) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop()
      out.push(q)
    }
    out.pop()
    return out
  }
  const poly = [...half(p), ...half([...p].reverse())]
  return poly.length >= 3 ? poly : p.slice(0, 2)
}

/** Unit vector from a to b, or null when they are the same point. */
function unit(a: Pt, b: Pt): Pt | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l = Math.hypot(dx, dy)
  return l < 1e-6 ? null : { x: dx / l, y: dy / l }
}

/**
 * The outline of a block closed round its own players: the hull, grown by
 * `pad` in every direction.
 *
 * This is the Minkowski sum of the hull with a disc — every edge moves out
 * `pad` parallel to itself, and the corners are joined by arcs of radius `pad`
 * centred on the players. It is worth being precise about why, because the
 * obvious version is wrong in a way that is easy to ship:
 *
 * PUSHING EACH VERTEX ALONG ITS BISECTOR SPIKES. The distance a corner has to
 * travel to keep its two edges `pad` clear is `pad / cos(half the angle)`, and
 * that runs away as a corner sharpens. A front three is very nearly a straight
 * line, which is a corner of almost 180 degrees at the middle man and two of
 * almost nothing at the ends — and the shape fires two spars off the top and
 * bottom of the pitch. Arcs cannot do that: nothing is ever more than `pad`
 * from a player, by construction.
 *
 * It also collapses correctly. Two players, or any number of them standing in a
 * line, leave a hull of two points whose two "edges" are the segment there and
 * the segment back — and the same loop draws a capsule, which is exactly what a
 * coach rings a centre-back pair with. No special case, no second code path.
 *
 * The hull comes out clockwise in screen space (y grows downward), so the
 * outward normal of the edge a→b is (dy, -dx) and every corner arc sweeps the
 * same way, which is what the constant sweep flag below is resting on.
 */
function dilatedHull(pts: Pt[], pad: number): string {
  const h = hullOf(pts)
  const centre = h[0] ?? pts[0] ?? { x: 0, y: 0 }
  // Everybody on the same spot. Two arcs, because an SVG arc cannot close a
  // full circle on itself — the endpoints would be identical and it draws
  // nothing at all.
  if (h.length < 2) {
    return `M ${centre.x - pad} ${centre.y} A ${pad} ${pad} 0 0 1 ${centre.x + pad} ${centre.y} A ${pad} ${pad} 0 0 1 ${centre.x - pad} ${centre.y} Z`
  }

  // The edges to walk. Two points make a there-and-back pair, which is what
  // turns the same loop into a capsule.
  const edges: [Pt, Pt][] =
    h.length === 2
      ? [
          [h[0], h[1]],
          [h[1], h[0]],
        ]
      : h.map((v, i) => [v, h[(i + 1) % h.length]] as [Pt, Pt])

  const offset = (a: Pt, b: Pt, q: Pt): Pt => {
    const d = unit(a, b) ?? { x: 1, y: 0 }
    return { x: q.x + d.y * pad, y: q.y - d.x * pad }
  }

  const parts: string[] = []
  edges.forEach(([a, b], i) => {
    const from = offset(a, b, a)
    const to = offset(a, b, b)
    parts.push(`${i === 0 ? 'M' : 'L'} ${from.x} ${from.y} L ${to.x} ${to.y}`)
    // Round the corner at `b`, onto the start of the next edge.
    const [na, nb] = edges[(i + 1) % edges.length]
    const next = offset(na, nb, na)
    parts.push(`A ${pad} ${pad} 0 0 1 ${next.x} ${next.y}`)
  })
  return `${parts.join(' ')} Z`
}

/**
 * The defensive block: a thick "string" threaded through the players to say
 * they are one connected unit, and a shaded area behind them.
 *
 * The shading closes ONE OF TWO WAYS, and which one is the difference between
 * this reading as a block and reading as a flood. Back to the goal is what a
 * block is and what every published video draws. Round the players themselves
 * is for every other unit a coach picks — a midfield screen, a front three
 * pressing — where the space that matters is the one they occupy, and where
 * closing to the goal shades the whole pitch back to your own keeper.
 *
 * This is the single most recognisable visual in the library and the reason
 * `defending-in-a-back-four` reads at a glance.
 */
export function BlockBand({ idp, kind, pts, close, label, active, band, onPointerDown }: BlockBandProps) {
  // Read before any early return. `useSurface` is `useContext`, which does not
  // take a slot in the hook list, so the old early-return-first order happened
  // to work — but it is one added `useMemo` away from a crash, and a component
  // that must be edited carefully is a component that will be edited wrongly.
  const p = useSurface()
  const s = resolveBandStyle(p, kind, band)
  if (pts.length < 2) return null

  // Keyed by the band's OWN id upstream, so two blocks in different colours on
  // the same board do not collide on one gradient and both come out the first
  // one's colour.
  const gid = `${idp}-band-${kind}`
  const first = pts[0]
  const last = pts[pts.length - 1]
  const line = pts.map((q) => `${q.x} ${q.y}`).join(' L ')
  const shape = close === 'shape'
  const across = shape ? false : close.axis === 'x'

  const fill = shape
    ? dilatedHull(pts, u(s.pad))
    : across
      ? `M ${line} L ${close.at} ${last.y} L ${close.at} ${first.y} Z`
      : `M ${line} L ${last.x} ${close.at} L ${first.x} ${close.at} Z`

  // Point the gradient at the goal, whichever side of the line it is on. A
  // closed shape has no goal to point at and takes the areas' top-to-bottom.
  const toEnd = shape ? true : across ? close.at > first.x : close.at > first.y
  const grad = shape
    ? { x1: '0', y1: '0', x2: '0', y2: '1' }
    : across
      ? { x1: toEnd ? '0' : '1', y1: '0', x2: toEnd ? '1' : '0', y2: '0' }
      : { x1: '0', y1: toEnd ? '0' : '1', x2: '0', y2: toEnd ? '1' : '0' }

  // Label: centred across the band, and always OUTSIDE it on the side away
  // from the goal, so it never sits on top of the shading or a counter. A
  // closed shape is cleared by its own padding instead.
  const xs = pts.map((q) => q.x)
  const ys = pts.map((q) => q.y)
  const midAcross = shape
    ? { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.min(...ys) - u(s.pad) - u(1.4) }
    : across
      ? { x: (Math.min(...xs) + close.at) / 2, y: Math.min(...ys) - u(2.2) }
      : {
          x: (Math.min(...xs) + Math.max(...xs)) / 2,
          y: toEnd ? Math.min(...ys) - u(2.2) : Math.max(...ys) + u(3.4),
        }

  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id={gid} x1={grad.x1} y1={grad.y1} x2={grad.x2} y2={grad.y2}>
          <stop offset="0%" stopColor={s.tone} stopOpacity={s.fill} />
          <stop offset="100%" stopColor={s.tone} stopOpacity={s.fill * (shape ? 0.45 : 0.27)} />
        </linearGradient>
      </defs>
      <path
        d={fill}
        fill={`url(#${gid})`}
        stroke={active ? p.goldDeep : s.tone}
        strokeOpacity={active ? 0.9 : s.edge}
        strokeWidth={active ? u(0.5) : u(0.26)}
        strokeDasharray={s.dashed && !active ? `${u(1.4)} ${u(0.9)}` : undefined}
        strokeLinejoin="round"
        /*
         * `fill` and not `all`: with the shading turned off the fill is a
         * transparent gradient, and a transparent fill still takes a pointer
         * under `pointerEvents="fill"`. That is what keeps an outline-only area
         * clickable over its whole face rather than only on the 26cm of line
         * round it, which nobody can hit.
         */
        pointerEvents={onPointerDown ? 'fill' : undefined}
        onPointerDown={onPointerDown}
        style={onPointerDown ? { cursor: 'pointer' } : undefined}
      />
      {s.string > 0 && (() => {
        // Approximate the total polyline length from consecutive point distances.
        // This is safe: we know all the coords, and `getTotalLength()` is not
        // available on a serialised SVG string (video export). The approximation
        // is exact for a straight string and very close for any real block.
        let pathLen = 0
        for (let i = 1; i < pts.length; i++) {
          const dx = pts[i].x - pts[i - 1].x
          const dy = pts[i].y - pts[i - 1].y
          pathLen += Math.hypot(dx, dy)
        }
        // Animate: dashoffset starts at the full path length (invisible) and
        // travels to 0 (fully drawn). The animation is tied to the key of the
        // string path so it replays whenever the points change meaningfully.
        // `animationFillMode: 'forwards'` leaves it fully drawn after it lands.
        return (
          <path
            d={`M ${line}`}
            fill="none"
            stroke={s.tone}
            strokeOpacity={s.string}
            strokeWidth={u(s.stringWidth)}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLen}
            strokeDashoffset={0}
            style={{
              animation: `tf-band-draw 0.4s cubic-bezier(0.16,1,0.3,1) forwards`,
              ['--tf-band-len' as string]: pathLen,
            }}
          />
        )
      })()}
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
  const s = resolveBandStyle(p, kind, band)
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
    strokeDasharray: s.dashed && !active ? `${u(1.4)} ${u(0.9)}` : undefined,
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
