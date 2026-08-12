/**
 * The position counter and the ball.
 *
 * A straight port of the videos' `Token` (editor/src/components/football/
 * TacticsBoard.tsx) from DOM to SVG: the same glossy dome, white rim, offset
 * top highlight and heavy Inter label. The DOM version leans on `box-shadow`
 * with an inset, which SVG has no equivalent for, so the dome is rebuilt as a
 * radial gradient plus a soft inner shade — visually the same object.
 *
 * Sizes are in METRES, like everything else on the board. Because all five
 * pitch views crop the same 68m width, a metre-sized counter is the same size
 * on screen in every view, and zooming to the final third does not turn the
 * players into beach balls.
 */

import { U } from './pitch'
import { BOARD, CUE_COLOR } from './palette'
import type { Side, TeamStyle } from '../schema'

const u = (m: number) => m * U

/** Counter radius in metres. ~1/16 of the board's height, like a magnet board. */
export const TOKEN_R = 2.1

interface TokenProps {
  idp: string
  /** Position in SVG units — resolved by the caller, which owns the view. */
  cx: number
  cy: number
  label: string
  side: Side
  style: TeamStyle
  name?: string
  cue?: string
  dim?: boolean
  /** Multiplier on TOKEN_R, for emphasis. */
  scale?: number
  /** Drawn while the coach is dragging this one. */
  active?: boolean
}

export function Token({
  idp,
  cx,
  cy,
  label,
  side,
  style,
  name,
  cue,
  dim = false,
  scale = 1,
  active = false,
}: TokenProps) {
  const r = u(TOKEN_R * scale)
  const gid = `${idp}-dome-${side}-${style.base.replace('#', '')}`
  const isPress = cue === 'PRESS'
  const cueCol = cue ? (CUE_COLOR[cue] ?? BOARD.ink) : BOARD.ink

  // Estimated, because SVG cannot size a rect to its text. Inter's caps run
  // about 0.62em wide; the padding is generous enough that the estimate being
  // a little off never clips.
  const cueSize = r * 0.62
  const cueW = (cue?.length ?? 0) * cueSize * 0.66 + cueSize * 1.4
  const cueH = cueSize * 1.85

  return (
    <g opacity={dim ? 0.45 : 1} style={{ transition: 'opacity 140ms ease' }}>
      <defs>
        <radialGradient id={gid} cx="0.36" cy="0.28" r="0.82">
          <stop offset="0%" stopColor={style.base} />
          <stop offset="76%" stopColor={style.deep} />
          <stop offset="100%" stopColor={style.deep} />
        </radialGradient>
        <radialGradient id={`${gid}-gloss`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
          <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        {/* A gradient rather than a blur filter: feGaussianBlur and CSS
            `filter: blur()` both resolve against the renderer's device space,
            so the same markup can land softer or harder once it is serialised
            and rasterised for a PNG. A gradient is exact everywhere. */}
        <radialGradient id={`${idp}-contact`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#141A16" stopOpacity="0.34" />
          <stop offset="60%" stopColor="#141A16" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#141A16" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* contact shadow — the counter sits ON the board, it does not float */}
      <ellipse
        cx={cx}
        cy={cy + r * 0.36}
        rx={r * 1.18}
        ry={r * 0.86}
        fill={`url(#${idp}-contact)`}
      />

      {/* the press ring: gold, outside the rim, exactly as the videos draw it */}
      {isPress && (
        <circle
          cx={cx}
          cy={cy}
          r={r * 1.2}
          fill="none"
          stroke={BOARD.goldDeep}
          strokeWidth={r * 0.14}
        />
      )}

      {active && (
        <circle
          cx={cx}
          cy={cy}
          r={r * 1.34}
          fill="none"
          stroke={BOARD.gold}
          strokeWidth={r * 0.09}
          strokeDasharray={`${r * 0.34} ${r * 0.26}`}
        />
      )}

      <circle cx={cx} cy={cy} r={r} fill={`url(#${gid})`} />
      {/* inner shade, standing in for the DOM version's inset shadow */}
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.98}
        fill="none"
        stroke="rgba(0,0,0,0.26)"
        strokeWidth={r * 0.13}
        opacity={0.7}
      />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={r * 0.1} />
      {style.ring && (
        <circle cx={cx} cy={cy} r={r * 1.08} fill="none" stroke={style.ring} strokeWidth={r * 0.1} />
      )}

      {/* the highlight, up and to the left like the light on the stage */}
      <ellipse
        cx={cx - r * 0.22}
        cy={cy - r * 0.34}
        rx={r * 0.46}
        ry={r * 0.3}
        fill={`url(#${gid}-gloss)`}
      />

      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Inter Variable, Inter, system-ui, sans-serif"
        fontWeight={900}
        fontSize={r * 0.82}
        letterSpacing={r * -0.016}
        fill={style.text}
        style={{ userSelect: 'none' }}
      >
        {label}
      </text>

      {name && (
        <text
          x={cx}
          y={cy - r * 1.42}
          textAnchor="middle"
          fontFamily="Inter Variable, Inter, system-ui, sans-serif"
          fontWeight={800}
          fontSize={r * 0.5}
          fill={BOARD.ink}
          stroke={BOARD.paper}
          strokeWidth={r * 0.12}
          paintOrder="stroke"
          style={{ userSelect: 'none' }}
        >
          {name}
        </text>
      )}

      {cue && (
        <g>
          <rect
            x={cx - cueW / 2}
            y={cy + r * 1.24}
            width={cueW}
            height={cueH}
            rx={cueH * 0.28}
            fill={cueCol === BOARD.ink ? 'rgba(22,22,24,0.92)' : cueCol}
          />
          <text
            x={cx}
            y={cy + r * 1.24 + cueH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Inter Variable, Inter, system-ui, sans-serif"
            fontWeight={900}
            fontSize={cueSize}
            letterSpacing={cueSize * 0.04}
            fill="#FFFFFF"
            style={{ userSelect: 'none' }}
          >
            {cue}
          </text>
        </g>
      )}
    </g>
  )
}

/**
 * Ball radius in metres. Not life size — a real ball is 11cm across and would
 * be a speck next to a 4.2m counter. This is the size it reads at, the same
 * proportion the videos composite theirs at.
 */
export const BALL_R = 1.05

/**
 * The ball.
 *
 * Two drawings behind one component. A chosen match ball is the photograph the
 * videos use, placed as an `<image>`; `classic` (and any ball whose asset fails
 * to resolve) is the drawn truncated-icosahedron suggestion — a white sphere
 * with a ring of dark pentagons, which reads as "ball" instantly at board scale
 * and needs no asset at all.
 *
 * The contact shadow is shared, because whichever one is showing has to sit ON
 * the board rather than float above it.
 *
 * EXPORT: an `<image>` pointing at a path does not survive being serialised and
 * drawn into a canvas — the browser will not fetch it from inside a data URL,
 * and the ball disappears from the PNG without erroring. The exporter must swap
 * `href` for a `data:` URI first; see `inlineBall()` in ../balls.ts. That is the
 * one place Board.tsx's "no external references" rule is bent, and it is bent
 * knowingly rather than forgotten.
 */
export function Ball({
  idp,
  cx,
  cy,
  href,
}: {
  idp: string
  cx: number
  cy: number
  /** Image to draw, or undefined for the drawn vector ball. */
  href?: string
}) {
  const r = u(BALL_R)
  const gid = `${idp}-ball`
  return (
    <g>
      <defs>
        <radialGradient id={gid} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="72%" stopColor="#F0F0EC" />
          <stop offset="100%" stopColor="#CFCFC8" />
        </radialGradient>
        <radialGradient id={`${gid}-contact`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#141A16" stopOpacity="0.36" />
          <stop offset="60%" stopColor="#141A16" stopOpacity="0.17" />
          <stop offset="100%" stopColor="#141A16" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        cx={cx}
        cy={cy + r * 0.44}
        rx={r * 1.2}
        ry={r * 0.82}
        fill={`url(#${gid}-contact)`}
      />
      {href ? (
        // The asset is square and centred on the ball (see ../balls.ts), so the
        // bounding box IS the ball and no preserveAspectRatio fudge is needed.
        <image href={href} x={cx - r} y={cy - r} width={r * 2} height={r * 2} />
      ) : (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill={`url(#${gid})`}
            stroke={BOARD.ink}
            strokeWidth={r * 0.14}
          />
          <circle cx={cx} cy={cy} r={r * 0.3} fill={BOARD.ink} />
          {[0, 72, 144, 216, 288].map((deg) => {
            const rad = ((deg - 90) * Math.PI) / 180
            return (
              <circle
                key={deg}
                cx={cx + Math.cos(rad) * r * 0.62}
                cy={cy + Math.sin(rad) * r * 0.62}
                r={r * 0.17}
                fill={BOARD.ink}
              />
            )
          })}
        </>
      )}
    </g>
  )
}
