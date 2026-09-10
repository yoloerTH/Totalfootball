/**
 * How a board is reshaped to fill an export's frame.
 *
 * Split out of ./videoRender.ts, which carries a muxer, an encoder and a second
 * copy of React's renderer and so can only ever be reached from a browser
 * through `import()`. This is arithmetic on two rectangles: no DOM, no React,
 * no bundler-only imports. scripts/check-frame.mjs runs it directly, which is
 * the whole reason it moved — the framing had been wrong on both set-piece
 * boards for want of a machine that could measure it.
 */

import { COUNTER_D, PAD, U, cropRect, toMetres, type PitchView } from './board/pitch'
import { ballsOf, type System } from './schema'


/**
 * The coach's pitch view, reshaped to fill the frame exactly.
 *
 * The old export drew a small board on a big sheet of paper and stacked the
 * words underneath it — a slide someone had filmed. A 9:16 export gave the
 * pitch about a third of the height. This is the fix, and it is a crop and not
 * a zoom:
 *
 *  · THE BOARD IS TURNED TO WHICHEVER WAY FITS, using the quarter turn that
 *    already exists (`vertical` in ./board/pitch.ts) and which turns the
 *    framing rather than the players. A full pitch upright is roughly 2:3 and
 *    nearly fills a phone, where the same pitch lying flat is a band across
 *    the middle of one.
 *
 *    Not simply "upright for a vertical frame", which is the version that was
 *    tried first and is wrong at the close crops: a penalty box seen upright
 *    is WIDE and SHALLOW — 68m across, 31m deep — so standing it up for a 9:16
 *    frame padded it out to 130m of grass with the box squashed along the top.
 *    The orientation that fits is the one whose aspect is nearest the frame's,
 *    and for `attacking-box` in a phone frame that is the one the coach was
 *    already working in. So the coach's orientation is kept unless turning it
 *    is a CLEAR improvement — a near-tie is not worth surprising them over.
 *
 *  · THE SHORT AXIS IS THEN PADDED OUT with more grass until the crop matches
 *    the frame's aspect, so the board reaches all four edges and there is no
 *    paper letterbox left to give the game away. Widening `pad` rather than
 *    scaling the board is what keeps every player on screen: percent coords
 *    are measured against `x0..x1`, which does not move.
 *
 * The board is then rendered at the FULL frame size and drawn at 0,0. There is
 * no longer any part of the picture that is not pitch.
 */
/**
 * The canvas, in pixels. Worked out once in `renderVideo` from the shape the
 * coach picked and the quality they picked, and passed down from there.
 *
 * Everything below takes this rather than the shape, and that is the whole
 * reason the export could grow a resolution setting without touching the
 * layout: the chrome is already written as fractions of the short side, so
 * 720p is the same design at a smaller number and there are no second
 * measurements to keep in step. See `layout`.
 */
export interface Frame {
  w: number
  h: number
}

/**
 * A SET-PIECE VIEW IS ANCHORED ON ITS GOAL, NOT CENTRED ON ITS GRASS.
 *
 * Upright, a set-piece board is authored at 68m × 52.5m and exported at a crop
 * no wider than the routine needs (see `frameView`), which focuses on the
 * penalty area and its approaches. At the 48m floor, against a 9:16 frame's
 * 0.5625 aspect, the length axis grows to 96m — a lot of spare grass, but far
 * less than the 131m the full 68m width forces, and the routine goes from
 * about 30% of the picture to about 55% of it.
 *
 * The goal line is anchored a fifth of the way down the frame rather than
 * centred, so the chrome (title, phase, caption) sits on grass above the goal
 * and the routine's depth runs into the middle of the picture. `focusBands`
 * fades the grass outside the routine back into the ground.
 *
 * ── WHAT IT DOES TO A CAMERA THAT IS FOLLOWING THE BALL ─────────────────
 *
 * Nothing it has to be told about. `cameraRect` clamps to `cropRect`, so a
 * followed camera travels inside the anchored grass automatically.
 */
export const SET_PIECE_GOAL_AT = 0.2


/**
 * The two boards whose framing is about a goal rather than about a pitch.
 *
 * They are the pair `frameView` refuses to turn — see the note on `turn` — and
 * the pair `focusBands` fades around, so which views they are is asked for in
 * one place rather than spelled out at each of them.
 */
export function isSetPieceView(view: PitchView): boolean {
  return view.id === 'attacking-set-piece' || view.id === 'defending-set-piece'
}

export function frameView(view: PitchView, frame: Frame, system?: System): PitchView {
  const lenX = view.x1 - view.x0
  const lenY = view.y1 - view.y0
  const want = frame.w / frame.h

  // Aspects are compared as ratios, not differences: 2.0 sits as far from 1.0
  // as 0.5 does, which is how an eye reads it and is not what 2−1 and 1−0.5 say.
  const gap = (a: number) => Math.abs(Math.log(a / want))
  const flat = (lenX + PAD * 2) / (lenY + PAD * 2)
  const theirs = view.vertical ? 1 / flat : flat
  const isSetPiece = isSetPieceView(view)
  // Allow turning training grids when exporting vertical to prevent huge dead spaces.
  const turn = !isSetPiece && gap(1 / theirs) + 0.15 < gap(theirs)
  const upright = turn ? !view.vertical : Boolean(view.vertical)

  /*
   * ── VERTICAL SET PIECES: NARROW THE WIDTH, BUT NEVER PAST THE ROUTINE ──
   *
   * A set-piece half-pitch is 68m wide × 52.5m deep. Upright, the 68m runs
   * across the frame and the 52.5m runs up it — aspect 1.27 against a 9:16
   * frame's 0.5625. That 2.25x mismatch forces ~73m of extra grass on the
   * length axis, showing 131m total — more than a full pitch — and the routine
   * (box, runners, delivery) sits in about 30% of the picture. So the width is
   * narrowed towards the zone that is actually being coached.
   *
   * HOW WIDE IS READ OFF THE BOARD, NOT ASSUMED. It used to be a flat 48m,
   * on the reasoning that a 48m window plus `PAD` reaches y 7–61 and "keeps
   * the corner taker visible". It does not: a corner is taken from y ≈ 1.5 or
   * 66.5, which is five and a half metres outside that. The shipped defending
   * corner put its taker at y = 5.0 and the export cut them off; a passing
   * drill laid out down one touchline lost its whole outside column, on a
   * board that had shown every counter in the studio (user, 2026-09-10). An
   * export that silently throws away part of the coach's board is not a crop,
   * it is a fault.
   *
   * So the floor is the box — `SET_PIECE_WIDTH`, the penalty area's 40.32m
   * plus room each side — and the crop opens out from there to whatever the
   * furthest mark on any phase needs, up to the full width of the board. A
   * corner routine keeps the tight picture the narrowing was written for; a
   * drill that uses the touchline gets the touchline.
   *
   * The crop stays centred on y = 34 (the middle of the pitch width) so it is
   * symmetric about the goal, and the narrowing is done by widening the pad
   * with NEGATIVE extra (which `pad` already supports as the difference
   * between the frame's demand and the board's natural size). `x0..x1` and
   * `y0..y1` never move, so percent coordinates still measure against the full
   * half-pitch and every player stays on the grass they were placed on.
   */
  let cropLenY = lenY
  if (isSetPiece && upright && want < 1) {
    // The visible band is the crop plus `PAD` on each side, so a routine that
    // reaches `reach` metres from the centre needs a crop of 2·reach − 2·PAD.
    const needed = markReach(view, system) * 2 - PAD * 2
    cropLenY = Math.min(lenY, Math.max(SET_PIECE_WIDTH, needed))
  }

  // The crop in SCREEN terms. Upright swaps which pitch axis is which: the
  // pitch's width runs across the frame and its length runs up it.
  const wide = (upright ? cropLenY : lenX) + PAD * 2
  const tall = (upright ? lenX : cropLenY) + PAD * 2

  const growWide = wide / tall < want
  const extra = growWide ? (want * tall - wide) / 2 : (wide / want - tall) / 2

  // Screen width is the pitch's y axis when upright and its x axis when flat.
  const onY = growWide === upright
  const padX = PAD + (onY ? 0 : extra)
  const padY = PAD + (onY ? extra : 0)

  // When we narrowed the width for a vertical set piece, shift the y-padding
  // to account for the narrower crop. The narrowing is symmetric about
  // the centre of the original crop (y = 34), so we reduce the y-padding by
  // half the difference to keep the view centred on the penalty area.
  const narrowedBy = (lenY - cropLenY) / 2
  const pad = { x: padX, y: padY - narrowedBy }

  /*
   * The shift that puts the goal at `SET_PIECE_GOAL_AT` instead of at the
   * middle, and only on the export that actually grew the LENGTH axis.
   *
   * `onY` means the grass went on the pitch's y axis, which is a landscape
   * export: there the half already fills the frame's height and there is
   * nothing to anchor. Everything else keeps a centred crop, which is what
   * every view but these two has always had.
   *
   * The goal line is at `cy - halfLen` in final units on BOTH boards — the
   * attacking one turns -90 and the defending one +90 (see `flip` in
   * ./board/pitch.ts), and a quarter turn either way puts the near end of the
   * crop at the same place above the crop's centre. So one expression covers
   * the pair, and `focusBands` reads the goal back the same way.
   */
  const screenH = (upright ? lenX + pad.x * 2 : cropLenY + pad.y * 2) * U
  const anchor =
    isSetPiece && !onY ? screenH * (0.5 - SET_PIECE_GOAL_AT) - (lenX / 2) * U : 0

  /*
   * ── THE CAMERA'S BOUNDS ARE THE COACH'S, NOT THE EXPORT'S ──────────────
   *
   * `cameraRect` reads `push.tightest` and `push.widest` as fractions of the
   * crop it is given. The crop it is given HERE is not the one the studio drew
   * the coach's dashed outline against: this function has just moved the pad,
   * sometimes to a negative number. On an upright set piece that took the
   * reference from 74m to 54m, so a Standard push whose ceiling framed 57m of
   * grass in the editor framed 44m in the video — a quarter of the picture
   * gone, with no way to see it coming from the board.
   *
   * `pushBase` carries the editor's own crop width across, so the two agree.
   * It is set ONLY when the orientation is unchanged, which is the only case
   * where the editor's screen-x axis is still the export's: a turned board has
   * no outline in the editor to match, and gets today's behaviour untouched.
   */
  const kept = upright === Boolean(view.vertical)
  const pushBase = kept ? cropRect(view).w : undefined

  return { ...view, vertical: upright, pad, yShift: anchor, pushBase }
}

/**
 * The floor the set-piece crop narrows to, in metres.
 *
 * The penalty area is 40.32m wide, centred on the goal at y 13.84–54.16. This
 * keeps all of it plus ~4m each side for a wide runner, and with `PAD` on top
 * the picture reaches y 7–61.
 */
const SET_PIECE_WIDTH = 48

/**
 * How far the furthest mark on the whole film sits from the middle of the
 * pitch's width, in metres, with a counter's width of grass beyond it.
 *
 * EVERY MARK, EVERY PHASE — not the phase being drawn. The crop is one shape
 * for the whole film, so a counter that only appears on phase 30 has to be
 * inside it on phase 1 as well, or the crop would have to move mid-export and
 * the board would swim.
 *
 * The margin is `COUNTER_D`: half of it is the counter's own radius, so the
 * mark is whole rather than sliced, and the rest is air, so it is not pressed
 * flush against the edge. Text and gear count by their anchor only, for the
 * same reason `interest` in ./camera.ts does — this file cannot measure a
 * block of words and must not guess at it.
 */
function markReach(view: PitchView, system: System | undefined): number {
  const mid = (view.y0 + view.y1) / 2
  // No document to read means no evidence to narrow on, so nothing is
  // narrowed. The stills and the film both pass one; this is for a caller
  // that has only a view.
  if (!system) return (view.y1 - view.y0) / 2
  let reach = 0
  const at = (x: number, y: number) => {
    reach = Math.max(reach, Math.abs(toMetres(view, x, y).y - mid))
  }
  for (const act of system.acts) {
    for (const t of act.tokens) if (!t.benched) at(t.x, t.y)
    for (const b of ballsOf(act)) at(b.x, b.y)
    for (const g of act.gear ?? []) at(g.x, g.y)
    for (const t of act.texts ?? []) if (t.text.trim()) at(t.x, t.y)
    for (const a of act.arrows) {
      at(a.from.x, a.from.y)
      at(a.to.x, a.to.y)
    }
    for (const b of act.bands) {
      if (!b.rect) continue
      at(b.rect.x, b.rect.y)
      at(b.rect.x + b.rect.w, b.rect.y + b.rect.h)
    }
    if (act.shot) {
      const hw = act.shot.w / 2
      const hh = act.shot.h / 2
      at(act.shot.x - hw, act.shot.y - hh)
      at(act.shot.x + hw, act.shot.y - hh)
      at(act.shot.x - hw, act.shot.y + hh)
      at(act.shot.x + hw, act.shot.y + hh)
    }
  }
  return reach + COUNTER_D
}
