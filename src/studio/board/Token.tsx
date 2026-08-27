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

import { darken } from './palette'
import { U } from './pitch'
import { cueColor, useSurface } from './surfaces'
import type { KitPattern, Side, TeamStyle } from '../schema'

const u = (m: number) => m * U

/** Counter radius in metres. ~1/16 of the board's height, like a magnet board. */
export const TOKEN_R = 2.1

/**
 * The bands of a patterned shirt, in board units, clipped to the counter.
 *
 * ── WHY ODD BAND COUNTS ──────────────────────────────────────────────────────
 *
 * Seven stripes and five hoops, not six and four. An odd count puts the base
 * colour at both edges, so the counter is symmetric about its own centre and
 * reads as a shirt rather than as a circle somebody started colouring in from
 * the left. It is the difference between Sunderland and a progress bar.
 *
 * Returned as plain rects and left for the caller to clip. Nothing here knows
 * about the circle, which is what keeps the geometry testable by eye: a band is
 * a rectangle across the counter's full diameter, and the clip decides where it
 * stops.
 */
function bands(pattern: KitPattern, cx: number, cy: number, r: number): { x: number; y: number; w: number; h: number; rotate?: number }[] {
  const d = r * 2
  switch (pattern) {
    case 'stripes': {
      const w = d / 7
      // 1, 3, 5 of seven — the base colour keeps bands 0, 2, 4 and 6.
      return [1, 3, 5].map((i) => ({ x: cx - r + i * w, y: cy - r, w, h: d }))
    }
    case 'hoops': {
      const h = d / 5
      return [1, 3].map((i) => ({ x: cx - r, y: cy - r + i * h, w: d, h }))
    }
    case 'halves':
      // The RIGHT half, so the pattern colour is the one a reader's eye lands
      // on last and the number stays legible against the base on the left.
      return [{ x: cx, y: cy - r, w: r, h: d }]
    case 'sash': {
      const h = r * 0.66
      // Overlong and rotated about the centre: the clip trims the corners, and
      // a rect sized to the circle would pull away from it once turned.
      return [{ x: cx - d, y: cy - h / 2, w: d * 2, h, rotate: -38 }]
    }
    default:
      return []
  }
}

interface TokenProps {
  idp: string
  /** Position in SVG units — resolved by the caller, which owns the view. */
  cx: number
  cy: number
  label: string
  side: Side
  style: TeamStyle
  name?: string
  /**
   * A drawable URL for the player's photograph — signed on a live board, a
   * `data:` URI in an export. Resolved by the CALLER from `Token.photo`,
   * because this component may not do i/o and the exporter must do it once for
   * the whole render rather than once per frame. Same contract as `ballHref`.
   */
  photoHref?: string
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
  photoHref,
  cue,
  dim = false,
  scale = 1,
  active = false,
}: TokenProps) {
  const p = useSurface()
  const r = u(TOKEN_R * scale)
  const gid = `${idp}-dome-${side}-${style.base.replace('#', '')}`

  // A plain shirt unless the kit says otherwise, which is every system built
  // before patterns existed. `alt` with no pattern draws nothing, on purpose:
  // a half-set kit is a plain kit, never a guess at which pattern was meant.
  const pattern: KitPattern = style.pattern ?? 'solid'
  const alt = style.alt ?? ''
  const patterned = pattern !== 'solid' && Boolean(alt)
  const aid = `${gid}-alt-${alt.replace('#', '')}`

  /**
   * The clip is keyed by POSITION, not by token id, and that is deliberate.
   *
   * `idp` is one prefix for the whole board — `Board.tsx` hands the same string
   * to all twenty-two counters — so a clip id built from it alone would have
   * every token clipped to whichever circle was defined last. A key built from
   * the centre and the radius is unique to the geometry it describes, and two
   * tokens that somehow collided on it would be asking for the identical clip
   * anyway. It survives serialisation into the exporter's SVG for the same
   * reason: it depends on nothing outside this element.
   */
  const clip = `${idp}-clip-${Math.round(cx)}-${Math.round(cy)}-${Math.round(r)}`

  /**
   * The headshot: above the name, above the counter.
   *
   * ── WHY IT SITS ABOVE RATHER THAN FILLING THE COUNTER ────────────────────
   *
   * A photograph inside the counter would be the stronger picture of one
   * player and the worse picture of a team. It costs the kit colour, the
   * stripes and the number — everything that lets a coach read eleven of these
   * at a glance — and a board where some players have faces and some do not
   * would be drawn in two different visual languages at once. Above the
   * counter, the photo is an addition to a token that still says what it
   * always said.
   *
   * `slice` crops to fill rather than letterboxing, so a portrait phone photo
   * and a square crop both come out as a face in a circle instead of a face
   * with bars beside it.
   */
  /*
   * ── HOW BIG, AND WHY IT GREW ─────────────────────────────────────────────
   *
   * It was 0.72r, and at that size a face on a floodlit pitch was a thumbnail
   * of a thumbnail — a coach could tell somebody was there and not who (user,
   * 2026-08-27). 0.98r is the largest it can be before two headshots on
   * adjacent counters touch at the 4.5m spacing the board is laid out at, so
   * this is the size, not a step towards one.
   *
   * It is a multiple of `r`, which is a multiple of TOKEN_R, which is METRES —
   * so this is the identical picture on all five pitch views. A face does not
   * grow when a coach crops to the final third, and it does not shrink on a
   * full pitch. That is the whole reason the board is measured in grass.
   */
  const pr = r * 0.98
  /*
   * Lifted clear of whatever is under it.
   *
   * With a name: the name's baseline is at cy - 1.42r and Inter's caps reach
   * about 0.36r above it, so the top of the type is at cy - 1.78r. The face
   * needs its own radius, HALF ITS OWN RIM (the stroke is centred on the
   * circle, so it reaches 0.085r past it) and a hair of air above that:
   * 1.78 + 0.98 + 0.085 + 0.3. Without a name it only has to clear the
   * counter's rim at cy - r, on the same arithmetic: 1 + 0.98 + 0.085 + 0.24.
   */
  const pcy = cy - r * (name ? 3.15 : 2.3)
  const pclip = `${clip}-face`
  const isPress = cue === 'PRESS'
  const cueCol = cue ? (cueColor(p)[cue] ?? p.ink) : p.ink
  // A cue chip is filled with its own colour and lettered in white — except the
  // two that are drawn in the board's ink, which on a dark surface IS white.
  const inkChip = cueCol === p.ink || cueCol === p.inkSoft

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
        {patterned && (
          <>
            {/* The bands take the dome's own lighting rather than sitting flat
                on top of it: same gradient geometry, second colour. Without
                this a striped counter stops looking like an object. */}
            <radialGradient id={aid} cx="0.36" cy="0.28" r="0.82">
              <stop offset="0%" stopColor={alt} />
              <stop offset="76%" stopColor={darken(alt)} />
              <stop offset="100%" stopColor={darken(alt)} />
            </radialGradient>
            <clipPath id={clip}>
              <circle cx={cx} cy={cy} r={r} />
            </clipPath>
          </>
        )}
        {photoHref && (
          <clipPath id={pclip}>
            <circle cx={cx} cy={pcy} r={pr} />
          </clipPath>
        )}
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
          stroke={p.goldDeep}
          strokeWidth={r * 0.14}
        />
      )}

      {active && (
        <circle
          cx={cx}
          cy={cy}
          r={r * 1.34}
          fill="none"
          stroke={p.gold}
          strokeWidth={r * 0.09}
          strokeDasharray={`${r * 0.34} ${r * 0.26}`}
        />
      )}

      <circle cx={cx} cy={cy} r={r} fill={`url(#${gid})`} />

      {/* The shirt. Drawn over the dome and UNDER the shade, the rim and the
          highlight, so a striped counter is the same glossy object as a plain
          one with a pattern printed on it — which is what a shirt is. */}
      {patterned && (
        <g clipPath={`url(#${clip})`}>
          {bands(pattern, cx, cy, r).map((b, i) => (
            <rect
              key={i}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill={`url(#${aid})`}
              transform={b.rotate ? `rotate(${b.rotate} ${cx} ${cy})` : undefined}
            />
          ))}
        </g>
      )}

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

      {photoHref && (
        <g>
          {/* The seat. Painted before the photo so it only ever shows as the
              ring of it that the photo does not cover. */}
          <circle cx={cx} cy={pcy} r={pr * 1.1} fill={`url(#${idp}-contact)`} />
          <image
            href={photoHref}
            x={cx - pr}
            y={pcy - pr}
            width={pr * 2}
            height={pr * 2}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${pclip})`}
          />
          {/*
            The rim, in three passes, and each one is doing a different job.

            A photograph is the only thing on this board we did not draw, so it
            is the only thing whose edge colour we cannot predict — a dark
            training top against a night pitch has no edge at all, and a pale
            kit against paper has none either. The counter has the same problem
            and solves it with a white rim; a face needs one pass more because
            it has no rim colour of its own underneath.

              · a SEAT, drawn under the photo, slightly proud of it. It is the
                contact shadow the counter already has, and it is what stops a
                light face dissolving into a light surface.
              · the RIM, white, exactly what the counter wears three lines
                further down — `rgba(255,255,255,0.85)` and NOT `p.halo`. The
                halo is the surface's own GROUND colour, which is what you
                outline type in so it separates from the board; on a floodlit
                pitch it is dark green, so a face rimmed in it had no bright
                edge at all and disappeared into the grass. That was half of
                why headshots were hard to see (user, 2026-08-27) — the other
                half was the size.
              · a HAIRLINE of ink over the rim, which gives the white its own
                edge on a paper board where white-on-white would vanish.
          */}
          <circle
            cx={cx}
            cy={pcy}
            r={pr}
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={pr * 0.17}
          />
          <circle
            cx={cx}
            cy={pcy}
            r={pr * 1.085}
            fill="none"
            stroke="rgba(0,0,0,0.22)"
            strokeWidth={pr * 0.045}
          />
          <circle
            cx={cx}
            cy={pcy}
            r={pr}
            fill="none"
            stroke="rgba(0,0,0,0.16)"
            strokeWidth={pr * 0.045}
          />
        </g>
      )}

      {name && (
        <text
          x={cx}
          y={cy - r * 1.42}
          textAnchor="middle"
          fontFamily="Inter Variable, Inter, system-ui, sans-serif"
          fontWeight={800}
          fontSize={r * 0.5}
          fill={p.ink}
          stroke={p.halo}
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
            fill={cueCol === p.ink ? p.inkChip : cueCol}
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
            fill={inkChip ? p.onInk : '#FFFFFF'}
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
 *
 * Nudged up from 1.05. On a full-pitch view at the size a phone renders a
 * shared link, the old ball was the smallest thing on the board and the eye
 * lost it against the markings — which is a problem, because on most phases the
 * ball is the thing the whole picture is about. This is still under a seventh
 * of a counter, so it reads as a ball at a player's feet rather than as
 * something being carried.
 */
export const BALL_R = 1.2

/** The drawn ball's own markings. See the note where they are used. */
const BALL_INK = '#161618'

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
        // BALL_INK, not the surface's ink. The pentagons are markings on a white
        // ball — a physical object that looks the same on every pitch — where
        // the surface's ink is the colour we WRITE in, and on a dark surface that
        // is nearly white. Following it would draw a white ball with white spots.
        <>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill={`url(#${gid})`}
            stroke={BALL_INK}
            strokeWidth={r * 0.14}
          />
          <circle cx={cx} cy={cy} r={r * 0.3} fill={BALL_INK} />
          {[0, 72, 144, 216, 288].map((deg) => {
            const rad = ((deg - 90) * Math.PI) / 180
            return (
              <circle
                key={deg}
                cx={cx + Math.cos(rad) * r * 0.62}
                cy={cy + Math.sin(rad) * r * 0.62}
                r={r * 0.17}
                fill={BALL_INK}
              />
            )
          })}
        </>
      )}
    </g>
  )
}
