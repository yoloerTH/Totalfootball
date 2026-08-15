/**
 * The board: one <svg>, everything inside it.
 *
 * The single-root rule is not tidiness, it is the export strategy. Because the
 * whole board is one self-contained SVG with no external references, getting a
 * PNG out is `serialise → <img> → canvas`, with no headless browser and no
 * server. Every choice in ./Pitch.tsx, ./Token.tsx and ./Overlays.tsx defers to
 * that: no CSS filters, no webfont we cannot inline.
 *
 * There is now exactly ONE external reference, and it is deliberate: the match
 * ball is a photograph. A canvas will not fetch it out of a serialised SVG, so
 * the exporter has to pass `ballHref` as a `data:` URI — see ../balls.ts. That
 * is the whole exception. Nothing else may point outside this document, because
 * everything else would fail the same way and none of it would error.
 *
 * The component is pure. It takes a resolved RenderAct — a pose, or a blend of
 * two poses from ../tween.ts — and draws it. It owns no state, so the editor
 * and the playback view and the exporter all render through the same code and
 * cannot drift apart.
 *
 * SIZING IS THE CONTAINER'S JOB, and it must give the board a HEIGHT.
 *
 * Counters are sized in metres, which only stays visually consistent between
 * pitch views if the views are scaled by the axis they share. All five crops
 * are the full 68m width of the pitch and differ only in length, so a board
 * fitted by HEIGHT renders a counter at the same on-screen size in every view,
 * while one fitted by width blows the counters up on the narrow crops until
 * the final third looks like a game of tiddlywinks. Give the container a
 * height (or an aspect ratio) and let `meet` letterbox the width.
 */

import {
  PITCH_VIEWS,
  boardTransform,
  cropRect,
  defendedGoal,
  resolveViewId,
  toUnits,
  unitsToPercent,
  viewBox,
} from './pitch'
import type { PitchView } from './pitch'
import { Pitch } from './PitchMarkings'
import { Ball, Token } from './Token'
import { Arrow, BlockBand, Zone } from './Overlays'
import type { Pt } from './Overlays'
import { resolveBall } from '../balls'
import type { System, TeamStyle } from '../schema'
import type { RenderAct } from '../tween'

interface Props {
  system: System
  act: RenderAct
  /** Namespaces every <defs> id so two boards can share a page. */
  idp: string
  /**
   * Draw through a view other than the one on the document. Export only: the
   * video widens the crop so the grass reaches the edges of a 16:9 or 9:16
   * frame, and stands the pitch upright for the vertical one. It must be the
   * coach's view with `pad`/`vertical` changed and NOTHING else — percent
   * coords are measured against `x0..x1`, so moving those moves the players.
   */
  view?: PitchView
  /** Paper grain. Off while editing (it is a per-frame filter), on for export. */
  texture?: boolean
  /** Token currently being dragged, drawn with a marching-ants ring. */
  activeTokenId?: string | null
  /**
   * The selected arrow or shaded area, drawn with a gold halo. Marks are picked
   * on the board so a coach can delete the one they mean — the alternative was
   * "Clear arrows", which is the whole phase or nothing.
   */
  activeMarkId?: string | null
  onTokenPointerDown?: (id: string, e: React.PointerEvent<SVGGElement>) => void
  /**
   * Passing these makes arrows and bands pickable. The editor withholds them
   * while a drawing tool is armed, so a new mark can be started on top of one
   * that is already there.
   */
  onArrowPointerDown?: (id: string, e: React.PointerEvent<SVGPathElement>) => void
  onBandPointerDown?: (id: string, e: React.PointerEvent<SVGElement>) => void
  /** Passing this makes the ball draggable; without it the ball is inert. */
  onBallPointerDown?: (e: React.PointerEvent<SVGGElement>) => void
  /**
   * Override for the ball's image, as a `data:` URI. Export only: the live
   * editor draws from the public path, which a canvas cannot fetch out of a
   * serialised SVG. See ../balls.ts `inlineBall`.
   */
  ballHref?: string
  onBackgroundPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void
  className?: string
  svgRef?: React.Ref<SVGSVGElement>
}

export function Board({
  system,
  act,
  idp,
  texture = false,
  activeTokenId = null,
  activeMarkId = null,
  onTokenPointerDown,
  onArrowPointerDown,
  onBandPointerDown,
  onBallPointerDown,
  onBackgroundPointerDown,
  ballHref,
  className,
  svgRef,
  view: viewOverride,
}: Props) {
  const view: PitchView = viewOverride ?? PITCH_VIEWS[resolveViewId(system.pitch)]
  const pos = (x: number, y: number) => toUnits(view, x, y)
  const crop = cropRect(view)

  const styleFor = (side: 'us' | 'them'): TeamStyle =>
    side === 'us' ? system.teams.us : (system.teams.them ?? system.teams.us)

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox(view)}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${system.title}: tactical board`}
      onPointerDown={onBackgroundPointerDown}
      preserveAspectRatio="xMidYMid meet"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        touchAction: 'none',
        // A board is a picture, not prose. Without this, dragging a counter
        // also drags a text selection, which Chrome then paints in blue across
        // the pitch until the next click; on a touchscreen the same press
        // raises the selection callout instead of moving the player.
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/*
       * The crop has to be enforced with a clipPath, because an <svg> clips to
       * its VIEWPORT, not its viewBox. Whenever the container's aspect ratio
       * differs from the view's, `meet` letterboxes the viewBox inside a larger
       * viewport — and the pitch, which is always drawn full-length in metre
       * space, then renders straight through the letterbox. A "defending half"
       * board would quietly show the far penalty area and a whole centre
       * circle. Give the container `aspect(view)` and this never engages; keep
       * it anyway, so a wrong container cannot produce a wrong diagram.
       */}
      <defs>
        <clipPath id={`${idp}-crop`}>
          <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${idp}-crop)`}>
        {/*
         * The markings are the ONLY thing carrying the upright view's quarter
         * turn as a real transform, because they are drawn in metre space in one
         * pass and contain no text. Everything below is positioned through
         * `pos()`, which bakes the turn into the coordinates, so counter labels,
         * cue chips and arrow captions stand upright on an upright board.
         */}
        <g transform={boardTransform(view)}>
          <Pitch idp={idp} texture={texture} />
        </g>

      {/* bands first: they are the ground the idea sits on */}
      {act.bands.map((b) => {
        if (b.kind === 'block' && b.throughTokens?.length) {
          const through = b.throughTokens
            .map((id) => act.tokens.find((t) => t.id === id))
            .filter((t): t is (typeof act.tokens)[number] => Boolean(t))
          const pts: Pt[] = through.map((t) => pos(t.x, t.y))
          // The band closes to the goal ITS OWN players defend.
          return (
            <BlockBand
              key={b.id}
              idp={`${idp}-${b.id}`}
              kind={b.kind}
              pts={pts}
              close={defendedGoal(through[0]?.side ?? 'us', view)}
              label={b.label}
              active={activeMarkId === b.id}
              onPointerDown={onBandPointerDown ? (e) => onBandPointerDown(b.id, e) : undefined}
            />
          )
        }
        if (b.rect) {
          // Normalised, because a quarter turn sends the stored top-left corner
          // to the bottom-left and a <rect> with a negative width draws nothing.
          const a = pos(b.rect.x, b.rect.y)
          const c = pos(b.rect.x + b.rect.w, b.rect.y + b.rect.h)
          return (
            <Zone
              key={b.id}
              idp={`${idp}-${b.id}`}
              kind={b.kind}
              rect={{
                x: Math.min(a.x, c.x),
                y: Math.min(a.y, c.y),
                w: Math.abs(c.x - a.x),
                h: Math.abs(c.y - a.y),
              }}
              label={b.label}
              active={activeMarkId === b.id}
              onPointerDown={onBandPointerDown ? (e) => onBandPointerDown(b.id, e) : undefined}
            />
          )
        }
        return null
      })}

      {act.arrows.map((a) => (
        <g key={a.id} opacity={a.opacity}>
          <Arrow
            kind={a.kind}
            a={pos(a.from.x, a.from.y)}
            b={pos(a.to.x, a.to.y)}
            bend={a.bend}
            label={a.label}
            active={activeMarkId === a.id}
            onPointerDown={onArrowPointerDown ? (e) => onArrowPointerDown(a.id, e) : undefined}
          />
        </g>
      ))}

      {/* Opposition under our own players: when counters overlap, the lesson is
          always about our shape, so ours stays readable. */}
      {[...act.tokens]
        .sort((a, b) => (a.side === b.side ? 0 : a.side === 'them' ? -1 : 1))
        .map((t) => {
          const p = pos(t.x, t.y)
          return (
            <g
              key={t.id}
              opacity={t.opacity}
              onPointerDown={onTokenPointerDown ? (e) => onTokenPointerDown(t.id, e) : undefined}
              style={{ cursor: onTokenPointerDown ? 'grab' : undefined }}
            >
              <Token
                idp={idp}
                cx={p.x}
                cy={p.y}
                label={t.label}
                side={t.side}
                style={styleFor(t.side)}
                name={t.name}
                cue={t.cue}
                dim={t.dim}
                scale={t.scale}
                active={activeTokenId === t.id}
              />
            </g>
          )
        })}

        {act.ball && (
          <g
            opacity={act.ball.opacity}
            pointerEvents={onBallPointerDown ? undefined : 'none'}
            onPointerDown={onBallPointerDown}
            style={{ cursor: onBallPointerDown ? 'grab' : undefined }}
          >
            <Ball
              idp={idp}
              cx={pos(act.ball.x, act.ball.y).x}
              cy={pos(act.ball.x, act.ball.y).y}
              href={ballHref ?? resolveBall(system.matchBall).src ?? undefined}
            />
          </g>
        )}
      </g>
    </svg>
  )
}

/**
 * Screen coordinates → percent-of-crop, for drags.
 *
 * Uses the SVG's own CTM rather than getBoundingClientRect maths, so it stays
 * correct when the board is scaled by its container, sitting inside a
 * transformed panel, or on a zoomed mobile viewport. The CTM lands us in FINAL
 * units — the same space `pos()` writes into — so `unitsToPercent` is what
 * takes the quarter turn back out on an upright board.
 */
export function clientToPercent(
  svg: SVGSVGElement,
  view: PitchView,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 50, y: 50 }
  const local = pt.matrixTransform(ctm.inverse())
  return unitsToPercent(view, local.x, local.y)
}

/**
 * Keep a dragged counter on the board. Players are allowed a little way past
 * the touchline — a full-back stepping off to receive a throw is a real
 * position — but not off into the margin.
 */
export function clampToBoard(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(103, Math.max(-3, x)),
    y: Math.min(103, Math.max(-3, y)),
  }
}
