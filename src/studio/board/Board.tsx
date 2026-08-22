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
} from './pitch'
import type { PitchView } from './pitch'
import { cameraRect, cameraViewBox } from '../camera'
import { Pitch } from './PitchMarkings'
import { Ball, Token } from './Token'
import { Arrow, BlockBand, Zone } from './Overlays'
import type { Pt } from './Overlays'
import { SurfaceContext, resolveSurface } from './surfaces'
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
  /**
   * Draw what the camera will frame, instead of framing it.
   *
   * The editor's board must stay wide while a coach is posing — you cannot drag
   * a player you cannot see, and a board that pushed in the moment the camera
   * was switched on would put half the squad off the edge of the work surface.
   * So the editor renders the full view and outlines the shot on top of it,
   * which is also the only way to see what the film will do without playing it.
   *
   * Ignored unless the pose actually carries a shot, so it costs nothing on a
   * system with the camera off.
   */
  showFrame?: boolean
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
  /**
   * Passing this puts grips on the SELECTED drawn area: one on each corner to
   * resize it, and the outline itself to slide it about.
   *
   * Only ever the selected one, which is the difference between this and the
   * camera frame. Every zone on the board carrying eight handles would bury the
   * pitch under furniture, and the coach has already said which one they mean
   * by clicking it. Blocks get nothing: a block traces its players, and the way
   * to move one is to move a defender.
   */
  onZonePointerDown?: (id: string, part: FramePart, e: React.PointerEvent<SVGElement>) => void
  /** Passing this makes the ball draggable; without it the ball is inert. */
  onBallPointerDown?: (e: React.PointerEvent<SVGGElement>) => void
  /**
   * Override for the ball's image, as a `data:` URI. Export only: the live
   * editor draws from the public path, which a canvas cannot fetch out of a
   * serialised SVG. See ../balls.ts `inlineBall`.
   */
  ballHref?: string
  /**
   * Passing this makes the camera's frame adjustable: a grip on each corner to
   * resize it, and the outline itself to slide it about.
   *
   * The INSIDE of the frame stays inert whatever happens here, which is not an
   * oversight — on a full pitch most of the squad is inside the shot, and a box
   * that swallowed pointer events would make every player under it undraggable
   * the moment a coach switched the camera on. Only the border and the four
   * corners take a pointer, so what you can grab is exactly what is drawn.
   */
  onFramePointerDown?: (part: FramePart, e: React.PointerEvent<SVGElement>) => void
  onBackgroundPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void
  /**
   * What the pointer is FOR right now. Decides the cursor, and nothing else.
   *
   * It has to be told rather than inferred. The board can see that counters are
   * draggable, because it was handed a handler for them — it cannot see that
   * the same handler means "pick this player for a line" today, and a coach
   * armed with the Block tool was being shown a grab hand over every player and
   * an arrow over grass they were about to draw on. The cursor is the only
   * thing on the screen that says what a press will do before it is pressed,
   * and getting it wrong is worse than having none.
   */
  mode?: BoardMode
  className?: string
  svgRef?: React.Ref<SVGSVGElement>
}

/**
 * 'move'     — the Move tool: counters are grabbable, marks are pickable.
 * 'dragging' — mid-drag, anywhere on the board.
 * 'draw'     — an arrow or an area tool is armed: press the grass and pull.
 * 'pick'     — the Block tool is armed: click players, one at a time.
 */
export type BoardMode = 'move' | 'dragging' | 'draw' | 'pick'

/**
 * The cursor for the board itself, and for a counter on it.
 *
 * `undefined` on a counter means it inherits the board's, which is what a
 * drawing tool wants: an arrow dragged across a player is one gesture, and a
 * cursor that changed halfway over it would say otherwise.
 */
const CURSOR: Record<BoardMode, { board: string; token: string | undefined }> = {
  move: { board: 'default', token: 'grab' },
  dragging: { board: 'grabbing', token: 'grabbing' },
  draw: { board: 'crosshair', token: undefined },
  // Not `pointer` on the grass: pressing it there ENDS the line rather than
  // adding to it, and a hand promising something to click is the wrong promise.
  pick: { board: 'default', token: 'pointer' },
}

/** Which part of the camera frame a pointer went down on. */
export type FramePart = 'move' | 'nw' | 'ne' | 'sw' | 'se'

const FRAME_CORNERS: { part: FramePart; fx: number; fy: number; cursor: string }[] = [
  { part: 'nw', fx: 0, fy: 0, cursor: 'nwse-resize' },
  { part: 'ne', fx: 1, fy: 0, cursor: 'nesw-resize' },
  { part: 'sw', fx: 0, fy: 1, cursor: 'nesw-resize' },
  { part: 'se', fx: 1, fy: 1, cursor: 'nwse-resize' },
]

export function Board({
  system,
  act,
  idp,
  texture = false,
  showFrame = false,
  activeTokenId = null,
  activeMarkId = null,
  onTokenPointerDown,
  onArrowPointerDown,
  onBandPointerDown,
  onZonePointerDown,
  onBallPointerDown,
  onBackgroundPointerDown,
  onFramePointerDown,
  ballHref,
  mode = 'move',
  className,
  svgRef,
  view: viewOverride,
}: Props) {
  const view: PitchView = viewOverride ?? PITCH_VIEWS[resolveViewId(system.pitch)]
  const pos = (x: number, y: number) => toUnits(view, x, y)
  const crop = cropRect(view)
  // The camera. `showFrame` inverts it: outline the shot rather than move to it.
  const shot = showFrame ? null : act.shot
  const frame = showFrame && act.shot ? cameraRect(view, act.shot) : null
  // A grip, in board units. Proportional to the crop so it is the same size on
  // screen whether the system is a full pitch or a penalty box.
  const grip = crop.w * 0.021
  /** The grab band along the outline, and how far the corners sit inside it. */
  const hit = grip * 1.5
  const inset = grip * 0.34
  // The surface is read here and nowhere else. Everything under this <svg> takes
  // it from context, so there is no component that can be left drawing in
  // paper's ink on a night pitch — see ./surfaces.ts.
  const surface = resolveSurface(system.surface)
  const cursor = CURSOR[mode]

  const styleFor = (side: 'us' | 'them'): TeamStyle =>
    side === 'us' ? system.teams.us : (system.teams.them ?? system.teams.us)

  return (
    <SurfaceContext.Provider value={surface.palette}>
    <svg
      ref={svgRef}
      viewBox={cameraViewBox(view, shot)}
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
        // Only where the board is interactive at all: the shared viewer, the
        // print sheet and the exporter render a picture, and a picture does not
        // get a crosshair.
        cursor: onBackgroundPointerDown || onTokenPointerDown ? cursor.board : undefined,
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
          // Back to the goal ITS OWN players defend, or closed round the
          // players themselves. See `close` on Band in ../schema.ts: absent
          // means the goal, which is what every block drawn before the choice
          // existed was given.
          return (
            <BlockBand
              key={b.id}
              idp={`${idp}-${b.id}`}
              kind={b.kind}
              pts={pts}
              close={b.close === 'shape' ? 'shape' : defendedGoal(through[0]?.side ?? 'us', view)}
              label={b.label}
              active={activeMarkId === b.id}
              band={b}
              onPointerDown={onBandPointerDown ? (e) => onBandPointerDown(b.id, e) : undefined}
            />
          )
        }
        if (b.rect) {
          // Normalised, because a quarter turn sends the stored top-left corner
          // to the bottom-left and a <rect> with a negative width draws nothing.
          const a = pos(b.rect.x, b.rect.y)
          const c = pos(b.rect.x + b.rect.w, b.rect.y + b.rect.h)
          const box = {
            x: Math.min(a.x, c.x),
            y: Math.min(a.y, c.y),
            w: Math.abs(c.x - a.x),
            h: Math.abs(c.y - a.y),
          }
          const grabbable = Boolean(onZonePointerDown) && activeMarkId === b.id
          return (
            <g key={b.id}>
              <Zone
                idp={`${idp}-${b.id}`}
                kind={b.kind}
                rect={box}
                label={b.label}
                active={activeMarkId === b.id}
                band={b}
                onPointerDown={onBandPointerDown ? (e) => onBandPointerDown(b.id, e) : undefined}
              />
              {grabbable && (
                <ZoneGrips
                  rect={box}
                  grip={grip}
                  gold={surface.palette.gold}
                  halo={surface.palette.halo}
                  onDown={(part, e) => onZonePointerDown!(b.id, part, e)}
                />
              )}
            </g>
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
              style={{ cursor: onTokenPointerDown ? cursor.token : undefined }}
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
            style={{ cursor: onBallPointerDown ? cursor.token : undefined }}
          >
            <Ball
              idp={idp}
              cx={pos(act.ball.x, act.ball.y).x}
              cy={pos(act.ball.x, act.ball.y).y}
              href={ballHref ?? resolveBall(system.matchBall).src ?? undefined}
            />
          </g>
        )}

        {/*
         * The camera's frame, while posing. Everything outside it is knocked
         * back rather than hidden: a coach needs to see that the full-back they
         * just dragged is OUT of shot, which a hard mask would not tell them —
         * it would simply look like the player had gone.
         *
         * Drawn last so it sits over the counters, and inert to the pointer so
         * it never eats a drag that starts on a player underneath it.
         */}
        {frame && (
          <g>
            <path
              pointerEvents="none"
              d={`M${crop.x} ${crop.y} h${crop.w} v${crop.h} h${-crop.w} Z M${frame.x} ${frame.y} h${frame.w} v${frame.h} h${-frame.w} Z`}
              fillRule="evenodd"
              fill={surface.palette.ink}
              /* Light. On a full pitch most of the board is outside the shot,
                 and a coach has to keep working on it — this marks what is out
                 of frame, it does not put it behind frosted glass. */
              opacity={0.15}
            />
            <rect
              pointerEvents="none"
              x={frame.x}
              y={frame.y}
              width={frame.w}
              height={frame.h}
              fill="none"
              stroke={surface.palette.gold}
              strokeWidth={2.6}
              strokeDasharray="16 10"
            />

            {/*
             * The grips. Drawn only when somebody is listening for them, so the
             * shared viewer, the print sheet and the exporter — none of which
             * can adjust anything — get the plain outline they had before.
             */}
            {onFramePointerDown && (
              <g>
                {/*
                 * Everything grabbable is drawn INSIDE the frame, and that is a
                 * fix rather than a preference. `cameraRect` clamps the shot to
                 * the grass, so a frame very often sits flush against an edge of
                 * the crop — and a grip centred on that edge has half of itself
                 * outside the board, where it is clipped and cannot be hit at
                 * all. Two of the four corners were unclickable on an upright
                 * pitch for exactly this reason.
                 *
                 * The outline again, fat and invisible: a dashed 2.6-unit line
                 * is a hard thing to hit with a finger, and the gaps in it are
                 * not targets at all. Inset by half its own width so the band
                 * lies just inside the line the coach can see.
                 */}
                <rect
                  x={frame.x + hit / 2}
                  y={frame.y + hit / 2}
                  width={Math.max(0, frame.w - hit)}
                  height={Math.max(0, frame.h - hit)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={hit}
                  style={{ cursor: 'move' }}
                  onPointerDown={(e) => onFramePointerDown('move', e)}
                />
                {FRAME_CORNERS.map(({ part, fx, fy, cursor }) => (
                  <rect
                    key={part}
                    x={frame.x + inset + fx * Math.max(0, frame.w - grip - inset * 2)}
                    y={frame.y + inset + fy * Math.max(0, frame.h - grip - inset * 2)}
                    width={grip}
                    height={grip}
                    rx={grip * 0.22}
                    fill={surface.palette.gold}
                    stroke={surface.palette.halo}
                    strokeWidth={grip * 0.14}
                    style={{ cursor }}
                    onPointerDown={(e) => onFramePointerDown(part, e)}
                  />
                ))}
              </g>
            )}
          </g>
        )}
      </g>
    </svg>
    </SurfaceContext.Provider>
  )
}

/**
 * The four corners and the edge of a selected zone.
 *
 * Deliberately the same vocabulary as the camera frame's grips — gold squares
 * on the corners, a fat invisible band along the outline for the move — because
 * they do the same job and a coach who has learned one has learned the other.
 * `FramePart` is reused rather than a second near-identical union being
 * invented for the same five values.
 *
 * The corners are drawn INSIDE the box for the reason the frame's are: a zone
 * dragged out to the touchline sits flush against the edge of the crop, and a
 * grip centred on that edge is half clipped and cannot be hit.
 */
function ZoneGrips({
  rect,
  grip,
  gold,
  halo,
  onDown,
}: {
  rect: { x: number; y: number; w: number; h: number }
  grip: number
  /** From the surface, so a grip on a floodlit pitch is that surface's gold. */
  gold: string
  halo: string
  onDown: (part: FramePart, e: React.PointerEvent<SVGElement>) => void
}) {
  const hit = grip * 1.4
  const inset = grip * 0.28
  return (
    <g>
      <rect
        x={rect.x + hit / 2}
        y={rect.y + hit / 2}
        width={Math.max(0, rect.w - hit)}
        height={Math.max(0, rect.h - hit)}
        fill="none"
        stroke="transparent"
        strokeWidth={hit}
        style={{ cursor: 'move' }}
        onPointerDown={(e) => onDown('move', e)}
      />
      {FRAME_CORNERS.map(({ part, fx, fy, cursor }) => (
        <rect
          key={part}
          x={rect.x + inset + fx * Math.max(0, rect.w - grip - inset * 2)}
          y={rect.y + inset + fy * Math.max(0, rect.h - grip - inset * 2)}
          width={grip}
          height={grip}
          rx={grip * 0.22}
          fill={gold}
          stroke={halo}
          strokeWidth={grip * 0.14}
          style={{ cursor }}
          onPointerDown={(e) => onDown(part, e)}
        />
      ))}
    </g>
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
