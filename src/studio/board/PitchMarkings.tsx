/**
 * The pitch itself: paper stage, turf checker, and every marking, drawn once in
 * metre space. The parent <svg>'s viewBox decides which part you see, so this
 * component takes no view and has no conditionals — a half-pitch is the same
 * drawing, cropped. See ./pitch.ts for why.
 *
 * Everything here is inert: no state, no measurement, no effects. That is what
 * lets the same markup be serialised straight to a PNG at export time.
 */

import { MARK, PITCH, U, penaltyArcHalfHeight } from './pitch'
import { BOARD } from './palette'

/** metres → SVG user units. */
const u = (m: number) => m * U

const L = PITCH.length
const W = PITCH.width
const MID = W / 2
const LINE = u(MARK.line * 3.2) // drawn a touch heavy so it reads when zoomed out

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
}

export function Pitch({ idp, texture = false }: Props) {
  const arcH = penaltyArcHalfHeight()

  // Both ends are mirrored from the same constants, so they cannot drift apart.
  // Only the top edge of each box is needed; the height comes from MARK.
  const penY0 = MID - MARK.penWidth / 2
  const sixY0 = MID - MARK.sixWidth / 2
  const goalY0 = MID - MARK.goalWidth / 2

  return (
    <>
      <defs>
        <pattern
          id={`${idp}-turf`}
          width={u(7)}
          height={u(7)}
          patternUnits="userSpaceOnUse"
        >
          <rect width="50%" height="50%" fill={BOARD.turf} />
          <rect x="50%" y="50%" width="50%" height="50%" fill={BOARD.turf} />
        </pattern>

        {/* The stage's soft cool fall-off, straight off the videos. */}
        <linearGradient id={`${idp}-paper`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#F2F4EF" />
          <stop offset="55%" stopColor={BOARD.paper} />
          <stop offset="100%" stopColor={BOARD.paper2} />
        </linearGradient>

        {/* Top-light: keeps the white from reading flat. */}
        <radialGradient id={`${idp}-light`} cx="0.5" cy="0.3" r="0.62">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>

        {/* Edge vignette, so the board sits in its frame rather than floating. */}
        <radialGradient id={`${idp}-vignette`} cx="0.5" cy="0.48" r="0.72">
          <stop offset="55%" stopColor="#141A16" stopOpacity="0" />
          <stop offset="100%" stopColor="#141A16" stopOpacity="0.18" />
        </radialGradient>

        {texture && (
          <filter id={`${idp}-grain`} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="2"
              stitchTiles="stitch"
            />
          </filter>
        )}
      </defs>

      {/* The stage extends well past the pitch so the padding is paper too. */}
      <rect
        x={u(-PITCH.length)}
        y={u(-PITCH.width)}
        width={u(PITCH.length * 3)}
        height={u(PITCH.width * 3)}
        fill={`url(#${idp}-paper)`}
      />
      <rect x={0} y={0} width={u(L)} height={u(W)} fill={`url(#${idp}-turf)`} />

      <g
        fill="none"
        stroke={BOARD.line}
        strokeWidth={LINE}
        strokeLinecap="square"
      >
        {/* touchlines and goal lines */}
        <rect x={0} y={0} width={u(L)} height={u(W)} />

        {/* halfway line, centre circle, centre spot */}
        <line x1={u(L / 2)} y1={0} x2={u(L / 2)} y2={u(W)} />
        <circle cx={u(L / 2)} cy={u(MID)} r={u(MARK.circle)} />
        <circle cx={u(L / 2)} cy={u(MID)} r={LINE * 1.6} fill={BOARD.line} stroke="none" />

        {/* ── left end ── */}
        <rect x={0} y={u(penY0)} width={u(MARK.penDepth)} height={u(MARK.penWidth)} />
        <rect x={0} y={u(sixY0)} width={u(MARK.sixDepth)} height={u(MARK.sixWidth)} />
        <circle cx={u(MARK.penSpot)} cy={u(MID)} r={LINE * 1.6} fill={BOARD.line} stroke="none" />
        <path
          d={`M ${u(MARK.penDepth)} ${u(MID - arcH)} A ${u(MARK.circle)} ${u(MARK.circle)} 0 0 1 ${u(MARK.penDepth)} ${u(MID + arcH)}`}
        />
        <rect
          x={u(-MARK.goalDepth)}
          y={u(goalY0)}
          width={u(MARK.goalDepth)}
          height={u(MARK.goalWidth)}
        />

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
          fill={BOARD.line}
          stroke="none"
        />
        <path
          d={`M ${u(L - MARK.penDepth)} ${u(MID - arcH)} A ${u(MARK.circle)} ${u(MARK.circle)} 0 0 0 ${u(L - MARK.penDepth)} ${u(MID + arcH)}`}
        />
        <rect x={u(L)} y={u(goalY0)} width={u(MARK.goalDepth)} height={u(MARK.goalWidth)} />

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
          opacity={0.05}
          style={{ mixBlendMode: 'multiply' }}
          pointerEvents="none"
        />
      )}
    </>
  )
}
