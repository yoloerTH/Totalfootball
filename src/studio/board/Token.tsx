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
import type { KitPattern, NamePlace, PhotoPlace, Side, TeamStyle } from '../schema'

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
  /** Where the name sits: over the counter, or under it. */
  namePlace?: NamePlace
  /** Where the photograph sits: over the counter, or in it. */
  photoPlace?: PhotoPlace
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
  namePlace = 'above',
  photoPlace = 'above',
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

  /*
   * ── THE TWO PLACEMENTS, AND WHAT EACH ONE MOVES ──────────────────────────
   *
   * Both are properties of the SYSTEM, not of a player: a board where some
   * names are above and some below is a board a room has to read twice. They
   * are settled here, once, and everything under them is arithmetic.
   *
   *   · A name UNDER the counter frees the air above it, so a headshot that is
   *     still above drops from 3.44r to 2.6r — it is no longer clearing type
   *     that is not there. The cue chip, which lives under the counter, moves
   *     down by the name's own height to make room.
   *
   *   · A photo IN the counter takes the middle, which is where the number
   *     was. Nothing is allowed to be lost, so the number (or the position —
   *     whatever `label` holds) goes out and rides in front of the name. That
   *     is the whole of the trade: the face is bigger and reads at a glance,
   *     the identity is still on the board, one line instead of two objects.
   *     The kit keeps a ring of itself around the face so eleven of these
   *     still sort into two teams from across a room.
   */
  const nameBelow = namePlace === 'below'
  const insidePhoto = Boolean(photoHref) && photoPlace === 'inside'
  const abovePhoto = Boolean(photoHref) && !insidePhoto
  /** Face radius when the photo is IN the counter, as a fraction of `r`. */
  const FACE_IN = 0.86
  /** The counter's own number, when the face has taken its seat. */
  const badge = insidePhoto ? label : ''
  const caption = Boolean(name) || Boolean(badge)

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
   * ── HOW BIG, AND WHY IT GREW TWICE ───────────────────────────────────────
   *
   * It was 0.72r, then 0.98r, and it is now 1.18r. The second rise came with a
   * change that is worth more than the number: the rim moved OFF the face.
   *
   * At 0.98r the white rim was a stroke CENTRED on the photo's own circle, so
   * half its width — 0.085 of the radius — was painted over the picture. The
   * face a coach actually saw was 0.897r, not 0.98r, and it was a face with its
   * ears cropped: small, and tight in its ring (user, 2026-08-27). The rim now
   * sits entirely outside the clip, so the visible face went from 0.897r to
   * 1.18r in one move — a third bigger, and none of it behind a stroke.
   *
   * What that costs is the room a headshot needs beside its neighbours: the
   * outermost pixel is now 1.357r from the centre rather than 1.063r, so two
   * faces want about 5.7m between their counters to stay clear of each other
   * instead of 4.5m. That is a real trade and it is the right way round —
   * players are laid out across a 68m pitch and are rarely within six metres of
   * each other, and a face you cannot recognise is worth nothing at any spacing.
   *
   * It is a multiple of `r`, which is a multiple of TOKEN_R, which is METRES —
   * so this is the identical picture on all five pitch views. A face does not
   * grow when a coach crops to the final third, and it does not shrink on a
   * full pitch. That is the whole reason the board is measured in grass.
   */
  const pr = r * 1.18
  /**
   * How far past the photo the rim reaches, as a multiple of `pr`.
   *
   * One constant because four things depend on it and they must agree: where
   * the face is lifted to, where the seat is drawn, and both hairlines. The rim
   * is a stroke centred on RIM_MID and RIM_W wide, so its outer edge is at
   * RIM_MID + RIM_W / 2 — and that number, not `pr`, is the real extent.
   */
  const RIM_MID = 1.075
  const RIM_W = 0.15
  const RIM_OUT = RIM_MID + RIM_W / 2
  /*
   * Lifted clear of whatever is under it.
   *
   * With a name: the name's baseline is at cy - 1.42r and Inter's caps reach
   * about 0.36r above it, so the top of the type is at cy - 1.78r. The face
   * needs its own radius, ITS WHOLE RIM (which is outside the photo now, so all
   * of it counts rather than half of it) and a hair of air above that:
   * 1.78 + 1.18 × 1.15 + 0.3 ≈ 3.44. Without a name it only has to clear the
   * counter's rim at cy - r, on the same arithmetic: 1 + 1.357 + 0.24 ≈ 2.6.
   * A name sent BELOW the counter is the second case: there is nothing over
   * the rim any more, so the face drops the 0.84r it was holding for type.
   */
  const pcy = cy - r * (name && !nameBelow ? 3.44 : 2.6)
  const pclip = `${clip}-face`
  const isPress = cue === 'PRESS'
  const cueCol = cue ? (cueColor(p)[cue] ?? p.ink) : p.ink
  // A cue chip is filled with its own colour and lettered in white — except the
  // two that are drawn in the board's ink, which on a dark surface IS white.
  const inkChip = cueCol === p.ink || cueCol === p.inkSoft

  // Estimated, because SVG cannot size a rect to its text. Inter's caps run
  // about 0.62em wide; the padding is generous enough that the estimate being
  // a little off never clips.
  /*
   * Where the chip's top edge sits, in radii. 1.24 clears the rim; with the
   * name under the counter it clears the CAPTION, whose descenders bottom out
   * at about 1.97r (baseline 1.86r plus 0.22 of a 0.5r size), plus a hair.
   * `caption` and not `name`, because a photographed player with no name still
   * has a number down there and the chip would land on it.
   */
  const cueTop = nameBelow && caption ? 2.12 : 1.24
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
        {abovePhoto && (
          <clipPath id={pclip}>
            <circle cx={cx} cy={pcy} r={pr} />
          </clipPath>
        )}
        {insidePhoto && (
          <clipPath id={`${clip}-in`}>
            <circle cx={cx} cy={cy} r={r * FACE_IN} />
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

      {/* The face, when it lives IN the counter.
          Over the dome and its bands, under the shade, the rim and the
          highlight — the same order the pattern is drawn in, and for the same
          reason: it is printed ON the object rather than laid over it. It stops
          at FACE_IN so a band of kit survives all the way round, which is what
          keeps a photographed team a team. */}
      {insidePhoto && (
        <g>
          <image
            href={photoHref}
            x={cx - r * FACE_IN}
            y={cy - r * FACE_IN}
            width={r * FACE_IN * 2}
            height={r * FACE_IN * 2}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clip}-in)`}
          />
          {/* The face's own edge, so a pale crop does not bleed into a pale
              kit. Half the width of the one the raised headshot wears, because
              here there is a whole shirt behind it doing the same job. */}
          <circle
            cx={cx}
            cy={cy}
            r={r * FACE_IN}
            fill="none"
            stroke="rgba(0,0,0,0.18)"
            strokeWidth={r * 0.045}
          />
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

      {/* the highlight, up and to the left like the light on the stage.
          Held back over a face: at full strength it stops reading as light on a
          dome and starts reading as glare on the print. */}
      <ellipse
        cx={cx - r * 0.22}
        cy={cy - r * 0.34}
        rx={r * 0.46}
        ry={r * 0.3}
        fill={`url(#${gid}-gloss)`}
        opacity={insidePhoto ? 0.42 : 1}
      />

      {!insidePhoto && (
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
      )}

      {abovePhoto && (
        <g>
          {/* The seat. Painted before the photo so it only ever shows as the
              ring of it that the photo does not cover — which now means the
              ring outside the rim, since the rim no longer covers any face. */}
          <circle cx={cx} cy={pcy} r={pr * (RIM_OUT + 0.06)} fill={`url(#${idp}-contact)`} />
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

            AND THE RIM IS NOW OUTSIDE THE PHOTO, which is the change that made
            the face feel like a face. A stroke centred on the clip's own radius
            paints half of itself over the picture — at the old width that was
            8.5% of the radius gone all the way round, which crops the ears on
            every headshot and reads as a portrait squeezed into a badge. It is
            drawn at RIM_MID instead, so its inner edge lands exactly on the
            clip and not a pixel of anybody's face is behind it.
          */}
          <circle
            cx={cx}
            cy={pcy}
            r={pr * RIM_MID}
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={pr * RIM_W}
          />
          <circle
            cx={cx}
            cy={pcy}
            r={pr * (RIM_OUT + 0.015)}
            fill="none"
            stroke="rgba(0,0,0,0.22)"
            strokeWidth={pr * 0.04}
          />
          {/* On the seam between the face and the rim, so the photo has its own
              edge rather than bleeding into the white. Thin, and half of it
              falls on the rim: this is the one line allowed to touch the face,
              and 1.75% of the radius is what it costs. */}
          <circle
            cx={cx}
            cy={pcy}
            r={pr}
            fill="none"
            stroke="rgba(0,0,0,0.16)"
            strokeWidth={pr * 0.035}
          />
        </g>
      )}

      {/*
        The caption: the name, and in front of it the number when the face has
        taken the counter.

        ONE text element, not two, and that is the point of it. Two elements
        would each be centred on cx and would have to be measured against each
        other to sit side by side — and SVG cannot measure its own type, which
        is why the cue chip further down has to estimate its width. A single
        centred line with the number as its first run needs no measurement at
        all: the browser lays it out and the pair is centred as one object,
        exactly as it would be in a sentence.

        BASELINES. Above: cy - 1.42r, clear of the rim at r and of the press
        ring at 1.2r. Below: 1.86r, which is the same 0.42r of air under the
        rim once the caps have been paid for (Inter's reach about 0.36 of the
        size, and the size is 0.5r) — so a name under a counter sits off it by
        eye the same distance as a name over one.

        The number is 900 where the name is 800. It is the same separation the
        counter's own label has from everything else on the board, and it does
        the work without a second colour that would have to survive four
        surfaces and any kit a coach picks.
      */}
      {caption && (
        <text
          x={cx}
          y={nameBelow ? cy + r * 1.86 : cy - r * 1.42}
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
          {badge && (
            <tspan fontWeight={900} letterSpacing={r * 0.008}>
              {badge}
            </tspan>
          )}
          {/* A thin space, U+2009, and not a plain one: XML collapses runs of
              ordinary whitespace between runs, and this pair wants a hair of
              air rather than a word gap anyway. */}
          {badge && name ? '\u2009\u2009' : ''}
          {name}
        </text>
      )}

      {cue && (
        <g>
          <rect
            x={cx - cueW / 2}
            y={cy + r * cueTop}
            width={cueW}
            height={cueH}
            rx={cueH * 0.28}
            fill={cueCol === p.ink ? p.inkChip : cueCol}
          />
          <text
            x={cx}
            y={cy + r * cueTop + cueH / 2}
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
  size = 1,
  angle = 0,
}: {
  idp: string
  cx: number
  cy: number
  /** Image to draw, or undefined for the drawn vector ball. */
  href?: string
  size?: number
  angle?: number
}) {
  const r = u(BALL_R * size)
  const gid = `${idp}-ball`
  return (
    <g transform={angle ? `rotate(${angle} ${cx} ${cy})` : undefined}>
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
