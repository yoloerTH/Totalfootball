/**
 * The pitch itself: the stage, the mown turf, and every marking, drawn once in
 * metre space. The parent <svg>'s viewBox decides which part you see, so this
 * component takes no view and has no conditionals — a half-pitch is the same
 * drawing, cropped. See ./pitch.ts for why.
 *
 * The colours come from the document's surface (./surfaces.ts) through context,
 * never from a constant: this file draws the grass, and grass that ignored the
 * chosen surface would be the one part of the board that did.
 *
 * Everything here is inert: no state, no measurement, no effects. That is what
 * lets the same markup be serialised straight to a PNG at export time.
 */

import { MARK, PITCH, U, penaltyArcHalfHeight, resolveGrid, type TrainingArea } from './pitch'
import { useSurface, type BoardPalette } from './surfaces'

/** metres → SVG user units. */
const u = (m: number) => m * U

const L = PITCH.length
const W = PITCH.width
const MID = W / 2
const LINE = u(MARK.line * 3.2) // drawn a touch heavy so it reads when zoomed out

/**
 * A TRAINING AREA: the coned rectangle, and whatever is ruled inside it.
 *
 * Drawn in the same metre space and with the same stroke as the pitch, so a
 * grid on the paper surface is the same pen as a pitch on the paper surface,
 * and the quarter turn in ../Board.tsx applies to it unchanged.
 *
 * WHY THE LINES ARE THINNER THAN A PITCH'S
 *
 * A pitch's markings are the laws of the game. A grid's are four cones and a
 * decision the coach made this morning, and next week it is a different size.
 * Drawing them at a referee's line weight claims a permanence they do not have,
 * and reads as a badly proportioned pitch rather than as a marked-out area. At
 * three quarters it reads as what it is: chalk, or a line of flat markers.
 *
 * The inner rulings — the middle square, the cells — go thinner and softer
 * still, for the same reason ../PitchMarkings' ruled grid does: they are a way
 * of talking about the area, not its edge. The one line a player may not cross
 * has to be the one that looks like it.
 */
function Area({ a, p, weight }: { a: TrainingArea; p: BoardPalette; weight: number }) {
  const x = u(a.x0)
  const y = u(a.y0)
  const w = u(a.x1 - a.x0)
  const h = u(a.y1 - a.y0)
  const cx = u((a.x0 + a.x1) / 2)
  const cy = u((a.y0 + a.y1) / 2)
  const len = a.x1 - a.x0
  const wid = a.y1 - a.y0

  const inner: string[] = []
  if (a.middle) {
    const m = u(a.middle)
    inner.push(`M ${cx - m / 2} ${cy - m / 2} h ${m} v ${m} h ${-m} Z`)
  }
  if (a.cells) {
    for (let i = 1; i < a.cells.along; i++) {
      const gx = u(a.x0 + (len * i) / a.cells.along)
      inner.push(`M ${gx} ${y} V ${y + h}`)
    }
    for (let i = 1; i < a.cells.across; i++) {
      const gy = u(a.y0 + (wid * i) / a.cells.across)
      inner.push(`M ${x} ${gy} H ${x + w}`)
    }
  }

  return (
    <g fill="none" stroke={p.line} strokeWidth={weight} strokeLinecap="square">
      {/* the cones themselves: the one edge that means anything */}
      <rect x={x} y={y} width={w} height={h} />

      {a.halfway && <line x1={cx} y1={y} x2={cx} y2={y + h} />}
      {a.circle && (
        <>
          <circle cx={cx} cy={cy} r={u(a.circle)} />
          <circle cx={cx} cy={cy} r={weight * 1.6} fill={p.line} stroke="none" />
        </>
      )}

      {a.box && (
        <>
          <rect
            x={x}
            y={cy - u(a.box.width) / 2}
            width={u(a.box.depth)}
            height={u(a.box.width)}
          />
          <rect
            x={x + w - u(a.box.depth)}
            y={cy - u(a.box.width) / 2}
            width={u(a.box.depth)}
            height={u(a.box.width)}
          />
        </>
      )}

      {inner.length > 0 && (
        <path d={inner.join(' ')} stroke={p.lineSoft} strokeWidth={weight * 0.7} />
      )}
    </g>
  )
}

interface Props {
  /**
   * Namespaces the <defs> ids. Two boards on one page (the library grid, or an
   * editor beside a preview) would otherwise share a pattern id, and the second
   * one silently inherits the first one's fill.
   */
  idp: string
  /**
   * The paper grain from the videos. Costs a feTurbulence over the whole board,
   * which is fine for a still and wasteful at 60fps, so it is off while
   * dragging and on for export.
   */
  texture?: boolean
  /**
   * The ruled grid the system is coached in — thirds, channels, the eighteen
   * numbered zones. Stored loose on the document, so anything unrecognised
   * draws the plain pitch rather than nothing at all. See ./pitch.ts.
   */
  grid?: string
  /**
   * The view stands the pitch on its end.
   *
   * The markings carry that quarter turn as a real transform (see ../Board.tsx),
   * which was safe for as long as this file contained no text. The zone numbers
   * are text, so they counter-rotate — a board a coach has to tilt their head
   * to read the numbers off is not a board.
   */
  turned?: boolean
  goalHref?: string
  /**
   * Paint a coned training area instead of a pitch. See `TrainingArea`.
   *
   * When it is set, NONE of the pitch is drawn — no goals, no penalty areas, no
   * centre circle a hundred metres wide, and none of the ruled grid either. The
   * ruled grids are pitch ideas measured in pitch metres (thirds of 105m, zone
   * 14), so on a 20m square they are three lines slashing across it that mean
   * nothing. The grass, the mow, the light and the vignette are the surface's
   * and stay exactly as they are.
   */
  area?: TrainingArea
}

/**
 * How far past the pitch's own lines the grass runs on a training board, in
 * metres. Comfortably past the biggest grid `AREA_MAX` allows plus its margins.
 */
const TRAINING_TURF = 40

export function Pitch({ idp, texture = false, grid, turned = false, goalHref, area }: Props) {
  const p = useSurface()
  const arcH = penaltyArcHalfHeight()
  const ruled = resolveGrid(grid)

  // Both ends are mirrored from the same constants, so they cannot drift apart.
  // Only the top edge of each box is needed; the height comes from MARK.
  const penY0 = MID - MARK.penWidth / 2
  const sixY0 = MID - MARK.sixWidth / 2
  const goalY0 = MID - MARK.goalWidth / 2
  
  // Goals from perspective assets need to be scaled up slightly to match the visual weight of flat lines
  const GOAL_IMG_W = MARK.goalWidth * 1.25
  const GOAL_IMG_H = GOAL_IMG_W / 2.663

  return (
    <>
      <defs>
        {/*
         * The mow.
         *
         * Two patterns behind one id, because the two looks are not variants of
         * each other: paper carries the videos' faint checker, a printed
         * texture, while the grass surfaces carry mown BANDS across the length
         * of the pitch, which is what a groundsman actually cuts and what a
         * televised pitch reads as. Both are drawn inside `boardTransform`, so
         * an upright board stands its bands up with it.
         */}
        <pattern
          id={`${idp}-turf`}
          width={p.mow.kind === 'stripe' ? u(p.mow.size * 2) : u(p.mow.size)}
          height={u(p.mow.size)}
          patternUnits="userSpaceOnUse"
        >
          {p.mow.kind === 'checker' ? (
            <>
              <rect width="50%" height="50%" fill={p.mow.color} fillOpacity={p.mow.alpha} />
              <rect x="50%" y="50%" width="50%" height="50%" fill={p.mow.color} fillOpacity={p.mow.alpha} />
            </>
          ) : p.mow.kind === 'stripe' ? (
            <rect width="50%" height="100%" fill={p.mow.color} fillOpacity={p.mow.alpha} />
          ) : null}
        </pattern>

        {/* The stage's soft fall-off, straight off the videos. */}
        <linearGradient id={`${idp}-paper`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={p.stage[0]} />
          <stop offset="55%" stopColor={p.stage[1]} />
          <stop offset="100%" stopColor={p.stage[2]} />
        </linearGradient>

        {/* The pitch's own ground, where the surface has one distinct from the stage. */}
        {p.grass && (
          <linearGradient id={`${idp}-grass`} x1="0" y1="0" x2="0.25" y2="1">
            <stop offset="0%" stopColor={p.grass[0]} />
            <stop offset="100%" stopColor={p.grass[1]} />
          </linearGradient>
        )}

        {/* Top-light: keeps the ground from reading flat, and on the night
            surfaces it is the floodlight pooling in the middle. */}
        <radialGradient id={`${idp}-light`} cx="0.5" cy="0.3" r="0.62">
          <stop offset="0%" stopColor={p.light.color} stopOpacity={p.light.opacity} />
          <stop offset="100%" stopColor={p.light.color} stopOpacity="0" />
        </radialGradient>

        {/* Edge vignette, so the board sits in its frame rather than floating. */}
        <radialGradient id={`${idp}-vignette`} cx="0.5" cy="0.48" r="0.72">
          <stop offset="55%" stopColor={p.vignette.color} stopOpacity="0" />
          <stop offset="100%" stopColor={p.vignette.color} stopOpacity={p.vignette.opacity} />
        </radialGradient>

        {texture && (
          <filter id={`${idp}-grain`} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="2"
              stitchTiles="stitch"
            />
            {/* feTurbulence makes COLOURED noise. Multiplied into paper at 5%
                that is the videos' grain and reads as grain. Screened onto a
                dark ground it reads as confetti, so the surfaces that screen
                take the saturation out of it first. */}
            {p.grain.blend === 'screen' && <feColorMatrix type="saturate" values="0" />}
          </filter>
        )}
      </defs>

      {/* The stage extends well past the pitch, so the crop's padding is ground
          too — the run-off around the grass, on the surfaces that have grass. */}
      <rect
        x={u(-PITCH.length)}
        y={u(-PITCH.width)}
        width={u(PITCH.length * 3)}
        height={u(PITCH.width * 3)}
        fill={`url(#${idp}-paper)`}
      />
      {/*
       * THE TURF, AND HOW FAR IT REACHES.
       *
       * On a pitch it stops at the touchlines, because that is where a pitch
       * stops and the run-off around it is part of the picture.
       *
       * On a TRAINING board it does not, and it must not. A coned area is laid
       * out on a training field, which is grass in every direction — and the
       * board is sized from the coach's own numbers, so a 82 x 50 small-sided
       * pitch plus its margins and its bench strip is a crop taller than the
       * 68m pitch this file draws. Stopping the grass at the touchline would
       * put a band of run-off across the bottom of a board that is nowhere near
       * a touchline. It is all clipped to the crop either way, so the larger
       * rect costs nothing on a board that does not need it.
       */}
      {p.grass && (
        <rect
          x={area ? u(-TRAINING_TURF) : 0}
          y={area ? u(-TRAINING_TURF) : 0}
          width={u(L + (area ? TRAINING_TURF * 2 : 0))}
          height={u(W + (area ? TRAINING_TURF * 2 : 0))}
          fill={`url(#${idp}-grass)`}
        />
      )}
      <rect
        x={area ? u(-TRAINING_TURF) : 0}
        y={area ? u(-TRAINING_TURF) : 0}
        width={u(L + (area ? TRAINING_TURF * 2 : 0))}
        height={u(W + (area ? TRAINING_TURF * 2 : 0))}
        fill={`url(#${idp}-turf)`}
      />

      {/*
       * THE RULED GRID, under the real markings and over the turf.
       *
       * Under, because the pitch is the pitch: a corridor line that cut across
       * the penalty spot would be the one drawing on the board that argues with
       * the laws of the game. It is also drawn softer and thinner than a real
       * line for the same reason — it is a way of talking about the pitch, not
       * part of it, and a coach must never have to work out which lines the
       * referee would recognise.
       *
       * Inert: no pointer events, no ids, nothing selectable. There is nothing
       * to edit here, because the numbers are the game's and not ours.
       */}
      {!area && (ruled.lines.length > 0 || ruled.cells.length > 0) && (
        // Named in the DOM so the smoke test can count what was ruled without
        // guessing at a stroke colour. See scripts/smoke-studio.mjs.
        <g pointerEvents="none" data-grid={ruled.id}>
          <g fill="none" stroke={p.lineSoft} strokeWidth={LINE * 0.7} strokeLinecap="butt">
            {ruled.lines.map((l, i) => (
              <line key={i} x1={u(l.x1)} y1={u(l.y1)} x2={u(l.x2)} y2={u(l.y2)} />
            ))}
          </g>
          {ruled.cells.map((c) => (
            <text
              key={c.label}
              x={u(c.x)}
              y={u(c.y)}
              transform={turned ? `rotate(90 ${u(c.x)} ${u(c.y)})` : undefined}
              textAnchor="middle"
              dominantBaseline="central"
              fill={p.lineSoft}
              fontFamily="Inter Variable, Inter, system-ui, sans-serif"
              fontSize={u(3.4)}
              fontWeight={700}
              opacity={0.55}
            >
              {c.label}
            </text>
          ))}
        </g>
      )}

      {area ? (
        <Area a={area} p={p} weight={LINE * 0.75} />
      ) : (
      <g
        fill="none"
        stroke={p.line}
        strokeWidth={LINE}
        strokeLinecap="square"
      >
        {/* touchlines and goal lines */}
        <rect x={0} y={0} width={u(L)} height={u(W)} />

        {/* halfway line, centre circle, centre spot */}
        <line x1={u(L / 2)} y1={0} x2={u(L / 2)} y2={u(W)} />
        <circle cx={u(L / 2)} cy={u(MID)} r={u(MARK.circle)} />
        <circle cx={u(L / 2)} cy={u(MID)} r={LINE * 1.6} fill={p.line} stroke="none" />

        {/* ── left end ── */}
        <rect x={0} y={u(penY0)} width={u(MARK.penDepth)} height={u(MARK.penWidth)} />
        <rect x={0} y={u(sixY0)} width={u(MARK.sixDepth)} height={u(MARK.sixWidth)} />
        <circle cx={u(MARK.penSpot)} cy={u(MID)} r={LINE * 1.6} fill={p.line} stroke="none" />
        <path
          d={`M ${u(MARK.penDepth)} ${u(MID - arcH)} A ${u(MARK.circle)} ${u(MARK.circle)} 0 0 1 ${u(MARK.penDepth)} ${u(MID + arcH)}`}
        />
        
        <g transform={`translate(0 ${u(MID)}) rotate(-90)`}>
          <image
            href={goalHref}
            x={u(-GOAL_IMG_W / 2)}
            y={u(-GOAL_IMG_H)}
            width={u(GOAL_IMG_W)}
            height={u(GOAL_IMG_H)}
          />
        </g>

        {/* ── right end (mirrored) ── */}
        <rect
          x={u(L - MARK.penDepth)}
          y={u(penY0)}
          width={u(MARK.penDepth)}
          height={u(MARK.penWidth)}
        />
        <rect
          x={u(L - MARK.sixDepth)}
          y={u(sixY0)}
          width={u(MARK.sixDepth)}
          height={u(MARK.sixWidth)}
        />
        <circle
          cx={u(L - MARK.penSpot)}
          cy={u(MID)}
          r={LINE * 1.6}
          fill={p.line}
          stroke="none"
        />
        <path
          d={`M ${u(L - MARK.penDepth)} ${u(MID - arcH)} A ${u(MARK.circle)} ${u(MARK.circle)} 0 0 0 ${u(L - MARK.penDepth)} ${u(MID + arcH)}`}
        />
        
        <g transform={`translate(${u(L)} ${u(MID)}) rotate(90)`}>
          <image
            href={goalHref}
            x={u(-GOAL_IMG_W / 2)}
            y={u(-GOAL_IMG_H)}
            width={u(GOAL_IMG_W)}
            height={u(GOAL_IMG_H)}
          />
        </g>

        {/* corner arcs, each bulging into the pitch */}
        <path d={`M ${u(MARK.corner)} 0 A ${u(MARK.corner)} ${u(MARK.corner)} 0 0 1 0 ${u(MARK.corner)}`} />
        <path
          d={`M ${u(L - MARK.corner)} 0 A ${u(MARK.corner)} ${u(MARK.corner)} 0 0 0 ${u(L)} ${u(MARK.corner)}`}
        />
        <path
          d={`M ${u(L)} ${u(W - MARK.corner)} A ${u(MARK.corner)} ${u(MARK.corner)} 0 0 0 ${u(L - MARK.corner)} ${u(W)}`}
        />
        <path
          d={`M 0 ${u(W - MARK.corner)} A ${u(MARK.corner)} ${u(MARK.corner)} 0 0 1 ${u(MARK.corner)} ${u(W)}`}
        />
      </g>
      )}

      {/* Light and vignette sit above the lines so the markings recede at the
          edges the way they do on the videos' board. */}
      <rect
        x={u(-PITCH.length)}
        y={u(-PITCH.width)}
        width={u(PITCH.length * 3)}
        height={u(PITCH.width * 3)}
        fill={`url(#${idp}-light)`}
        style={{ mixBlendMode: 'screen' }}
        pointerEvents="none"
      />
      <rect
        x={u(-PITCH.length)}
        y={u(-PITCH.width)}
        width={u(PITCH.length * 3)}
        height={u(PITCH.width * 3)}
        fill={`url(#${idp}-vignette)`}
        pointerEvents="none"
      />
      {texture && (
        <rect
          x={u(-PITCH.length)}
          y={u(-PITCH.width)}
          width={u(PITCH.length * 3)}
          height={u(PITCH.width * 3)}
          filter={`url(#${idp}-grain)`}
          opacity={p.grain.opacity}
          // Multiply darkens, which is what grain does to paper and what it
          // does to a dark ground is nothing at all. The dark surfaces screen
          // instead, so the noise lifts out of the grass as it would on film.
          style={{ mixBlendMode: p.grain.blend }}
          pointerEvents="none"
        />
      )}
    </>
  )
}
