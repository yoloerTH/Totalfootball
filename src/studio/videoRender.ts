/**
 * The video export: a real file, made entirely in the coach's browser.
 *
 * The share link is still the primary export and nothing here replaces it — a
 * link plays anywhere, updates in place, and needs no download. But a coach who
 * wants their move on a WhatsApp status or a club Instagram needs a *file*, and
 * "open this link" is not a thing you can post.
 *
 * MP4 was dropped from the plan (docs/STUDIO.md §2) because it meant Remotion
 * Lambda, a queue and a bill. That reasoning was about the *server*, not about
 * the format. WebCodecs encodes in the browser, so the file costs us nothing:
 * no render farm, no upload, no storage, and the coach's document never leaves
 * their machine.
 *
 * ── HOW IT WORKS ─────────────────────────────────────────────────────────────
 *
 * The same three pieces the viewer uses, driven by a clock instead of a rAF:
 *
 *   `timelineAt(ms)` → a pose or a blend → `Board` → an SVG string
 *      → an <img> → a canvas → `VideoEncoder` → an .mp4
 *
 * And one thing the viewer does not have: SOUND. A ball being struck, every
 * time the ball moves between two phases, mixed by ./audio.ts. That is the
 * entire soundtrack and the whole of it is derived from the document — read the
 * top of that file for why it is a rule rather than a field on Act.
 *
 * Rendering `Board` through `renderToStaticMarkup` rather than re-drawing the
 * board on a canvas is the whole reason this is safe to have: there is still
 * exactly ONE renderer, and a video cannot drift from what the coach posed.
 *
 * ── WHY THIS IS NOT REAL-TIME CAPTURE ────────────────────────────────────────
 *
 * The obvious version is `canvas.captureStream()` + `MediaRecorder`, and it is
 * wrong: MediaRecorder timestamps frames by wall clock, so a machine that
 * cannot rasterise this board in 33ms does not drop frames, it produces a video
 * in slow motion. Encoding frame-by-frame with an explicit timestamp means the
 * output is correct on a six-year-old laptop and only takes longer to make.
 *
 * ── THE TWO GOTCHAS FROM §6, BOTH PAID FOR HERE ──────────────────────────────
 *
 * 1. THE BALL, AND THE FACES. A canvas will not fetch `/studio/balls/trionda.png`
 *    out of a serialised SVG and does not error when it fails — the ball is
 *    simply gone. `inlineBall()` supplies a `data:` URI, and if that fetch fails
 *    we fall the whole document back to the drawn vector ball rather than emit a
 *    broken `<image>`. Player headshots pay the identical tax through
 *    `inlinePhotos()`, and pay it worse: they live in a PRIVATE bucket, so the
 *    signed URL a live board draws from would expire part-way through a long
 *    render. Both are resolved ONCE, up front, for all four hundred frames.
 *
 * 2. THE FONT. Webfonts do not resolve inside a serialised SVG either, so every
 *    counter would silently come out in Times. Inter is fetched once and
 *    embedded as a `data:` URI in a `<style>` on every frame. This is the thing
 *    §6 calls unsolved; it is solved for the raster path now, and PPTX can use
 *    `boardFontCss()` when it lands.
 *
 * THE GRAIN IS OFF. `texture` runs an feTurbulence over the whole stage, which
 * is a fine cost for one exported still and a ruinous one for four hundred
 * frames. Nobody has ever seen paper grain at 30fps.
 *
 * NOTHING MAY IMPORT THIS FILE EAGERLY. It carries a muxer, an encoder and a
 * second copy of React's renderer. ./video.ts holds the parts the UI needs
 * before a coach has pressed anything, and this module arrives via `import()`
 * when they do. See the note at the top of that file.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import interWoff2 from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'

import { kickTrack } from './audio'
import { Board } from './board/Board'
import { rgba, resolveSurface, type BoardPalette } from './board/surfaces'
import { PAD, viewFor, type PitchView } from './board/pitch'
import { inlineBall, resolveBall } from './balls'
import { inlinePhotos, photoPaths } from './account/squad'
import { gearKinds, inlineGear } from './gear'
import type { System } from './schema'
import { holdMs, moveMs } from './pace'
import { resolveAct, timelineAt, totalDuration, tweenActs, type Timeline } from './tween'
import {
  frameSize,
  resolveFps,
  resolveQuality,
  resolveShape,
  videoSupported,
  type VideoFile,
  type VideoOptions,
} from './video'
import {
  imageSize,
  imagesSupported,
  resolveImageShape,
  resolveImageSize,
  resolveParts,
  type ChromeParts,
  type ImageFile,
  type ImageOptions,
} from './image'
import { formatDate } from './viewer/CreditBar'
import { Mark } from './viewer/Mark'

// ── the font, fetched once ───────────────────────────────────────────────────

let fontCss: string | null = null

function base64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  // Chunked: `String.fromCharCode(...bytes)` blows the argument limit on a 48KB
  // font in Safari, and it fails as a RangeError rather than as a bad font.
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(s)
}

/**
 * `@font-face` for Inter, as a self-contained `data:` URI.
 *
 * The latin variable subset, ~48KB, which is the whole face rather than the
 * glyphs this board happens to use — a coach can type any player name they
 * like, so there is nothing safe to subset to. It goes on every frame, which
 * sounds worse than it is: it is a string concat, and the encoder is the
 * expensive part by two orders of magnitude.
 *
 * Returns '' if the fetch fails, which costs the typeface and not the export.
 */
export async function boardFontCss(): Promise<string> {
  if (fontCss !== null) return fontCss
  try {
    const res = await fetch(interWoff2)
    if (!res.ok) throw new Error(String(res.status))
    fontCss = `@font-face{font-family:'Inter Variable';font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${base64(await res.arrayBuffer())}) format('woff2')}`
  } catch {
    fontCss = ''
  }
  return fontCss
}

// ── one frame of board, as a raster ──────────────────────────────────────────

/**
 * Index of the `>` that closes the root `<svg>` tag.
 *
 * Quote-aware rather than `markup.indexOf('>')`, because the board's
 * `aria-label` carries the coach's own title and a system called "3-2-5 -> box
 * midfield" would otherwise be cut in half, producing an SVG that does not
 * parse and a video that is blank. React does escape it today; this does not
 * depend on that staying true.
 */
function openTagEnd(markup: string): number {
  let quote = ''
  for (let i = 0; i < markup.length; i++) {
    const c = markup[i]
    if (quote) {
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") {
      quote = c
    } else if (c === '>') {
      return i
    }
  }
  return -1
}

/**
 * The board at one instant, as a standalone SVG document.
 *
 * The `svg{...!important}` rule is load-bearing. `Board` sets
 * `style="width:100%;height:100%"` because sizing is the container's job in the
 * app — but an `<img>` has no container, and an SVG with no intrinsic size
 * rasterises at the CSS default of 300×150 and then gets scaled up, which looks
 * exactly like a blurry export and not at all like a bug. An `!important`
 * stylesheet rule beats the inline style without `Board` needing an export mode.
 */
function frameSvg(
  system: System,
  act: ReturnType<typeof resolveAct>,
  w: number,
  h: number,
  ballHref: string | undefined,
  photoHrefs: Record<string, string>,
  gearHrefs: Record<string, string>,
  css: string,
  view: PitchView,
  crestHref?: string,
): string {
  const markup = renderToStaticMarkup(
    createElement(Board, {
      system,
      act,
      idp: 'vid',
      texture: false,
      ballHref,
      photoHrefs,
      gearHrefs,
      crestHref,
      view,
    }),
  )
  const end = openTagEnd(markup)
  const style = `<style>svg{width:${w}px!important;height:${h}px!important}${css}</style>`
  return `${markup.slice(0, end)} width="${w}" height="${h}">${style}${markup.slice(end + 1)}`
}

/** Rasterise one SVG string into a reusable canvas. */
async function raster(svg: string, w: number, h: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return c
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ── the frame IS the board ───────────────────────────────────────────────────

/**
 * The coach's pitch view, reshaped to fill the frame exactly.
 *
 * The old export drew a small board on a big sheet of paper and stacked the
 * words underneath it — a slide someone had filmed. A 9:16 export gave the
 * pitch about a third of the height. This is the fix, and it is a crop and not
 * a zoom:
 *
 *  · THE BOARD IS TURNED TO WHICHEVER WAY FITS, using the quarter turn that
 *    already exists (`vertical` in ../board/pitch.ts) and which turns the
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
interface Frame {
  w: number
  h: number
}

function frameView(view: PitchView, frame: Frame): PitchView {
  const lenX = view.x1 - view.x0
  const lenY = view.y1 - view.y0
  const want = frame.w / frame.h

  // Aspects are compared as ratios, not differences: 2.0 sits as far from 1.0
  // as 0.5 does, which is how an eye reads it and is not what 2−1 and 1−0.5 say.
  const gap = (a: number) => Math.abs(Math.log(a / want))
  const flat = (lenX + PAD * 2) / (lenY + PAD * 2)
  const theirs = view.vertical ? 1 / flat : flat
  const turn = gap(1 / theirs) + 0.15 < gap(theirs)
  const upright = turn ? !view.vertical : Boolean(view.vertical)

  // The crop in SCREEN terms. Upright swaps which pitch axis is which: the
  // pitch's width runs across the frame and its length runs up it.
  const wide = (upright ? lenY : lenX) + PAD * 2
  const tall = (upright ? lenX : lenY) + PAD * 2

  const growWide = wide / tall < want
  const extra = growWide ? (want * tall - wide) / 2 : (wide / want - tall) / 2

  // Screen width is the pitch's y axis when upright and its x axis when flat.
  const onY = growWide === upright
  return {
    ...view,
    vertical: upright,
    pad: { x: PAD + (onY ? 0 : extra), y: PAD + (onY ? extra : 0) },
  }
}

/**
 * The chrome's measurements. Every one is a fraction of the frame's SHORT side,
 * so the vertical export is the landscape one at a different aspect rather than
 * a second design with its own numbers to keep in step.
 */
interface Layout {
  w: number
  h: number
  /** Safe area: how far in from the edge the words start. */
  left: number
  top: number
  bottom: number
  eyebrowSize: number
  titleSize: number
  captionSize: number
  creditSize: number
  noteSize: number
  microSize: number
  markSize: number
  /** How far the words drift as one phase hands over to the next. */
  rise: number
  /** The gold accent above the eyebrow. */
  rule: { w: number; h: number }
  /** The progress hairline along the bottom edge. */
  bar: number
  /** Letter tracking on the small caps. */
  track: number
}

function layout(frame: Frame): Layout {
  const short = Math.min(frame.w, frame.h)
  const upright = frame.h > frame.w

  return {
    w: frame.w,
    h: frame.h,
    left: Math.round(short * 0.058),
    top: Math.round(frame.h * (upright ? 0.055 : 0.062)),
    // A vertical video is posted somewhere that stamps its own buttons over the
    // bottom of the picture, so the credit sits further up than it would on a
    // laptop. It cannot clear a Reels UI entirely without looking mispositioned
    // everywhere else; this clears the worst of it.
    bottom: Math.round(frame.h * (upright ? 0.075 : 0.062)),
    eyebrowSize: Math.round(short * 0.021),
    titleSize: Math.round(short * 0.052),
    captionSize: Math.round(short * 0.031),
    creditSize: Math.round(short * 0.0195),
    noteSize: Math.round(short * 0.0165),
    microSize: Math.round(short * 0.0155),
    markSize: Math.round(short * 0.05),
    rise: Math.round(short * 0.014),
    rule: { w: Math.round(short * 0.05), h: Math.max(2, Math.round(short * 0.005)) },
    bar: Math.max(2, Math.round(short * 0.0035)),
    track: Math.max(0.5, short * 0.0016),
  }
}

const FACE = `'Inter Variable', Inter, system-ui, sans-serif`

/*
 * PAPER_RGB used to live here, as the one colour the chrome's glow was thrown
 * in. It is now the surface's own `halo` — the chrome is drawn straight onto the
 * board, so the glow that separates a caption from the grass has to be the
 * colour of that grass. See ./board/surfaces.ts.
 */

/**
 * Width of `text` measured the way `drawTracked` draws it — one glyph at a
 * time. Measuring the whole string and adding the tracking afterwards is off by
 * the kerning, which is enough to make a right-aligned lockup sit crooked.
 */
function trackedWidth(ctx: CanvasRenderingContext2D, text: string, track: number): number {
  let w = 0
  for (const c of text) w += ctx.measureText(c).width + track
  return Math.max(0, w - track)
}

/** Draw letter-spaced text from `x`. `ctx.letterSpacing` is not everywhere yet. */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  track: number,
): void {
  ctx.textAlign = 'left'
  let cx = x
  for (const c of text) {
    ctx.fillText(c, cx, y)
    cx += ctx.measureText(c).width + track
  }
}

function widthOf(ctx: CanvasRenderingContext2D, text: string, track = 0): number {
  return track ? trackedWidth(ctx, text, track) : ctx.measureText(text).width
}

/** Truncate to fit, with a real ellipsis rather than a clipped word. */
function fitText(ctx: CanvasRenderingContext2D, text: string, max: number, track = 0): string {
  if (widthOf(ctx, text, track) <= max) return text
  let s = text
  while (s.length > 1 && widthOf(ctx, `${s}…`, track) > max) s = s.slice(0, -1)
  return `${s}…`
}

/**
 * Break `text` to `max` over at most `maxLines`, ellipsising what is left over.
 *
 * A title now sits ON the picture rather than on a sheet of paper below it, so
 * it has a whole frame's width to use and should use it — cutting "Third man
 * runs off the pivot" down to "Third man r…" was only ever a symptom of the
 * board having eaten all the room.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  max: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []

  const lines: string[] = []
  let line = words[0]
  for (let i = 1; i < words.length; i++) {
    const next = `${line} ${words[i]}`
    if (ctx.measureText(next).width <= max) line = next
    else {
      lines.push(line)
      line = words[i]
    }
  }
  lines.push(line)

  if (lines.length <= maxLines) return lines.map((s) => fitText(ctx, s, max))
  // Everything that did not fit is folded onto the last line and clipped there,
  // so the ellipsis lands at the end of the sentence rather than mid-way up it.
  const kept = lines.slice(0, maxLines - 1)
  kept.push(fitText(ctx, lines.slice(maxLines - 1).join(' '), max))
  return kept
}

/**
 * Words on the picture, with a soft bloom of paper behind them.
 *
 * The first version of this put a gradient scrim across the top and bottom of
 * the frame, and it was wrong for a reason worth writing down: a wash wide
 * enough to carry a title also washes the players under it, and a ghosted
 * goalkeeper reads as a bug in the export rather than as a caption treatment.
 * A halo is the same idea applied only where the ink actually is — the pitch
 * stays exactly as the coach posed it, and a title still holds up over a
 * counter, a penalty box or a gold arrow.
 *
 * Two passes with the shadow on, because one pass of a 95%-opaque blur is not
 * enough separation over a red counter, and a third is not visible.
 */
function glow(ctx: CanvasRenderingContext2D, p: BoardPalette, size: number, draw: () => void): void {
  ctx.save()
  ctx.shadowColor = rgba(p.halo, 0.92)
  ctx.shadowBlur = Math.max(6, size * 0.55)
  draw()
  draw()
  ctx.restore()
  draw()
}

/** Which phase's words are on screen, and how far through arriving they are. */
interface Words {
  index: number
  alpha: number
  dy: number
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a))
const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * The words leave before the new ones arrive, and they move a little as they go.
 *
 * A hard swap at the midpoint of the move is what a slide deck does. A short
 * fade with a few pixels of drift is what a video does, and it costs nothing —
 * the board is already being redrawn every frame of a move.
 *
 * Two phases that say the same thing do not flicker: there is nothing to hand
 * over, so the text simply holds.
 */
function phaseWords(tl: Timeline, system: System, rise: number): Words {
  const held: Words = { index: tl.p < 0.5 ? tl.index : tl.next, alpha: 1, dy: 0 }
  if (tl.p === 0 || tl.index === tl.next) return held

  const a = system.acts[tl.index]
  const b = system.acts[tl.next]
  if (a.title === b.title && a.caption === b.caption) return held

  if (tl.p < 0.45) {
    const out = ramp(tl.p, 0.05, 0.45)
    return { index: tl.index, alpha: 1 - out, dy: -out * rise }
  }
  const arrive = ramp(tl.p, 0.5, 0.9)
  return { index: tl.next, alpha: arrive, dy: (1 - arrive) * rise }
}

/**
 * Everything that is not the pitch, laid out as three groups rather than as a
 * list of things that happened to need drawing:
 *
 *   TOP LEFT     a gold rule, the system's name, the phase's title and caption,
 *                with the phase count opposite. What this is, and where in it
 *                you are.
 *   BOTTOM       the credit line: their name and club, their note and date, and
 *                our lockup opposite.
 *   BOTTOM EDGE  a hairline that fills as the film runs.
 *
 * The credit line is the watermark and its shape is the policy in
 * ../viewer/CreditBar.tsx — their name on the left, ours on the right, never
 * ours alone. A video is the one export that travels furthest from the person
 * who made it, so it is the one that most needs to say who that was. What has
 * changed is only the manners of it: the mark instead of a second line of bold
 * type, the coach's own words held at full strength and ours set quietly beside
 * them at small-caps weight.
 *
 * ── AND IT DRAWS AS MUCH OF THAT AS IT IS ASKED FOR ──────────────────────────
 *
 * `parts` says which of the four groups go on. It always arrives as a whole
 * `ChromeParts`: the callers run it through `resolveParts`, which fills in the
 * defaults and applies the one rule the coach does not get a vote on — ours is
 * never drawn without theirs. That argument is in ../image.ts, beside the type.
 * The film passes all four; only the stills dialog has reason to ask for fewer.
 *
 * The layout does NOT reflow around a missing part, and that is deliberate. The
 * head sits at the top and the credit at the foot; dropping either leaves the
 * board where it was rather than sliding the other into the space. So a coach
 * who turns the head off gets the picture they were already looking at with the
 * words lifted off it, and a set of exports made at different settings still
 * line up with one another.
 */
function drawChrome(
  ctx: CanvasRenderingContext2D,
  l: Layout,
  system: System,
  words: Words,
  progress: number,
  mark: HTMLCanvasElement | null,
  showDate: boolean,
  p: BoardPalette,
  parts: ChromeParts,
): void {
  const max = l.w - l.left * 2

  ctx.textBaseline = 'alphabetic'
  ctx.globalAlpha = 1

  // ── top left: the standing head ────────────────────────────────────────────

  let y = l.top
  if (parts.head) {
    ctx.fillStyle = p.goldDeep
    glow(ctx, p, l.rule.h * 2, () => ctx.fillRect(l.left, y, l.rule.w, l.rule.h))
  }
  // Advanced whether or not the rule was drawn, so the phase's words below sit
  // at the same height either way. See the note about not reflowing.
  y += l.rule.h + Math.round(l.eyebrowSize * 1.6)

  ctx.font = `800 ${l.eyebrowSize}px ${FACE}`
  ctx.fillStyle = p.inkSoft

  // The phase count belongs to the head, not to the phase's own words: it says
  // where you are in the system, which is the standing head's job. It also has
  // its own switch, because a film does not want it — see `counter` on
  // `ChromeParts` in ./image.ts.
  const counter = parts.head && parts.counter && system.acts.length > 1
    ? `${pad2(words.index + 1)} / ${pad2(system.acts.length)}`
    : ''
  const counterW = counter ? trackedWidth(ctx, counter, l.track) : 0

  if (parts.head) {
    const eyebrow = fitText(
      ctx,
      (system.title || 'A tactical system').toUpperCase(),
      max - (counterW ? counterW + l.left : 0),
      l.track,
    )
    glow(ctx, p, l.eyebrowSize, () => drawTracked(ctx, eyebrow, l.left, y, l.track))
  }

  // ── the phase's own words, which are the part that changes ─────────────────

  ctx.save()
  ctx.globalAlpha = words.alpha
  ctx.translate(0, words.dy)

  if (counter) {
    const cy = y
    glow(ctx, p, l.eyebrowSize, () => drawTracked(ctx, counter, l.w - l.left - counterW, cy, l.track))
  }

  // An empty phase and a phase whose words are switched off draw identically,
  // so there is one path through the wrapping below rather than two.
  const act = parts.words ? system.acts[words.index] : { title: '', caption: '' }
  ctx.textAlign = 'left'

  if (act.title) {
    ctx.font = `900 ${l.titleSize}px ${FACE}`
    ctx.fillStyle = p.ink
    for (const line of wrapText(ctx, act.title, max, 2)) {
      y += Math.round(l.titleSize * 1.06)
      const ty = y
      glow(ctx, p, l.titleSize, () => ctx.fillText(line, l.left, ty))
    }
  }

  if (act.caption) {
    ctx.font = `500 ${l.captionSize}px ${FACE}`
    ctx.fillStyle = p.inkSoft
    let first = true
    for (const line of wrapText(ctx, act.caption, max, 2)) {
      y += Math.round(l.captionSize * (first ? 1.5 : 1.32))
      first = false
      const cy = y
      glow(ctx, p, l.captionSize, () => ctx.fillText(line, l.left, cy))
    }
  }

  ctx.restore()

  // ── the foot: theirs, then ours ────────────────────────────────────────────

  const base = l.h - l.bottom

  // Ours is measured first, because it is the fixed one and the coach's line
  // gets whatever room is left rather than running underneath it.
  ctx.font = `800 ${l.microSize}px ${FACE}`
  const lockTrack = l.track * 1.8
  const madeW = trackedWidth(ctx, 'MADE WITH', lockTrack)
  const tfW = trackedWidth(ctx, 'TOTAL FOOTBALL', lockTrack)
  const textW = Math.max(madeW, tfW)
  const gap = Math.round(l.microSize * 0.85)
  const lockW = textW + (mark ? gap + l.markSize : 0)
  const lockLeft = l.w - l.left - lockW

  const lineTwo = base
  const lineOne = base - Math.round(l.microSize * 1.5)

  // Measured above unconditionally, because the coach's line is sized against
  // the room OURS would take whether or not ours is drawn — a credit that got
  // wider when the lockup came off would make two exports of the same board
  // set their title at two different sizes.
  if (parts.lockup) {
    ctx.fillStyle = p.inkSoft
    glow(ctx, p, l.microSize, () =>
      drawTracked(ctx, 'MADE WITH', lockLeft + (textW - madeW), lineOne, lockTrack))
    ctx.fillStyle = p.ink
    glow(ctx, p, l.microSize, () =>
      drawTracked(ctx, 'TOTAL FOOTBALL', lockLeft + (textW - tfW), lineTwo, lockTrack))
  }

  if (mark && parts.lockup) {
    // Centred on the two lines rather than sat on the baseline of the lower one.
    const top = lineOne - l.microSize
    const bottom = lineTwo + l.microSize * 0.12
    const at = Math.round((top + bottom) / 2 - l.markSize / 2)
    ctx.globalAlpha = 0.92
    glow(ctx, p, l.markSize * 0.5, () => ctx.drawImage(mark, l.w - l.left - l.markSize, at))
    ctx.globalAlpha = 1
  }

  const presenter = system.credit?.presenter?.trim()
  const team = system.credit?.team?.trim()
  const note = system.credit?.note?.trim()
  const date = showDate ? formatDate(system.credit?.sharedOn) : ''

  const theirs = [presenter, team].filter(Boolean).join(' · ')
  const under = [note, date].filter(Boolean).join(' · ')
  const theirMax = lockLeft - l.left - l.left * 0.8

  if (parts.credit) {
    ctx.textAlign = 'left'
    ctx.font = `800 ${l.creditSize}px ${FACE}`
    ctx.fillStyle = p.ink
    const line = fitText(ctx, theirs || system.title || 'A tactical system', theirMax)
    const lineY = under ? base - Math.round(l.noteSize * 1.55) : base
    glow(ctx, p, l.creditSize, () => ctx.fillText(line, l.left, lineY))

    if (under) {
      ctx.font = `500 ${l.noteSize}px ${FACE}`
      ctx.fillStyle = p.inkSoft
      const text = fitText(ctx, under, theirMax)
      glow(ctx, p, l.noteSize, () => ctx.fillText(text, l.left, base))
    }
  }

  // ── the film's own clock ───────────────────────────────────────────────────

  ctx.fillStyle = rgba(p.ink, 0.14)
  ctx.fillRect(0, l.h - l.bar, l.w, l.bar)
  ctx.fillStyle = p.goldDeep
  ctx.fillRect(0, l.h - l.bar, l.w * clamp01(progress), l.bar)
}

/**
 * Our mark, rasterised once and drawn on every frame.
 *
 * Rendering the real component rather than re-drawing it with canvas paths is
 * the same rule the board follows: one drawing of the mark, in ../viewer/Mark.tsx,
 * so the sign-off on a video cannot drift from the one in the viewer's credit
 * bar or on the end card of a short. Returns null on failure, which costs the
 * glyph and not the export — the words beside it still say whose this is.
 */
async function rasterMark(size: number, ink: string): Promise<HTMLCanvasElement | null> {
  try {
    const markup = renderToStaticMarkup(createElement(Mark, { size, ink }))
    // Mark draws for the DOM, where the SVG namespace is implied. An <img> is
    // parsing a standalone document and needs it spelled out, or it fails to
    // decode and the mark is silently absent.
    return await raster(markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'), size, size)
  } catch {
    return null
  }
}

// ── the crest ────────────────────────────────────────────────────────────────

const crests = new Map<string, string | null>()

/**
 * The club crest as a `data:` URI, or null.
 *
 * The third external reference on the board, and it pays the same tax as the
 * ball and the faces: a canvas will not fetch a URL out of a serialised SVG,
 * and it does not error when it fails — the crest is simply gone from the file
 * and nothing says so. See the header of ../board/Board.tsx.
 *
 * `crests` is a PUBLIC bucket, so unlike a player photograph this needs no
 * signing and no session; it is inlined only because of the canvas, not because
 * of access. Cached by URL for the same reason the ball is: one export writes
 * every phase, and re-fetching the same badge per picture is the difference
 * between an export that feels instant and one that feels broken.
 *
 * Null on any failure, which costs the crest and never the export.
 */
async function inlineCrest(system: System): Promise<string | null> {
  if (!system.showCrest || !system.crestUrl) return null
  const url = system.crestUrl
  const cached = crests.get(url)
  if (cached !== undefined) return cached
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    const blob = await res.blob()
    const uri = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(fr.error)
      fr.readAsDataURL(blob)
    })
    crests.set(url, uri)
    return uri
  } catch {
    crests.set(url, null)
    return null
  }
}

// ── the export ───────────────────────────────────────────────────────────────

function slug(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return s || 'system'
}

/**
 * Render the whole system to a video file.
 *
 * Resolves with the file; rejects with an `AbortError` if `signal` fires, which
 * is what the dialog's Stop button does. Progress is per frame and the loop
 * awaits on every one of them, so the UI keeps painting throughout.
 */
export async function renderVideo(system: System, opts: VideoOptions = {}): Promise<VideoFile> {
  if (!videoSupported()) throw new Error('This browser cannot make video files.')

  const shape = resolveShape(opts.shape)
  const quality = resolveQuality(opts.quality)
  // 30 or 60, and never whatever came in. This is reachable from the render
  // harness and from a script, so an unrecognised number becomes the house rate
  // rather than a frameRate the muxer will reject after a minute of encoding.
  const fps = resolveFps(opts.fps)
  /*
   * Absent means all of it, and the watermark tie is applied here rather than
   * trusted to the dialog. See `resolveParts` in ./image.ts.
   *
   * `counter` IS FORCED OFF, after `resolveParts` rather than through it: a
   * film has a progress bar along the bottom of every frame and does not need
   * "05 / 36" in the corner saying the same thing in a form that reads as how
   * much is left to sit through (user, 2026-08-28). Forced here and not in
   * `resolveParts` because that function serves the stills as well, and a
   * still — handed round on its own, out of order, printed into a pack — is
   * the one thing that genuinely cannot say which phase it is any other way.
   */
  const parts: ChromeParts = { ...resolveParts(opts.parts), counter: false }
  const frame = frameSize(shape, quality)
  const view = frameView(viewFor(system), frame)
  const l = layout(frame)

  // Everything that is fetched rather than computed, up front: a failure here
  // should happen before the coach has watched a progress bar for a minute.
  const [css, ball, photos, gear, crest] = await Promise.all([
    boardFontCss(),
    inlineBall(resolveBall(system.matchBall).id),
    // `[]` when nobody on the board has a photograph, which resolves to `{}`
    // without a single request. The common case costs nothing.
    inlinePhotos(photoPaths(system)),
    // Keyed by PIECE, so a drill with eight cones fetches one picture. Empty
    // on every system with no gear on it, which is most of them.
    inlineGear(gearKinds(system)),
    inlineCrest(system),
  ])
  await document.fonts.ready
  // Once, up front: it is the same picture on all four hundred frames.
  // The chrome is drawn on top of the board, so it takes the board's palette:
  // ink on paper, bone on a floodlit pitch.
  const p = resolveSurface(system.surface).palette
  // Not rasterised at all when our half is not going on, which matches
  // `renderStills` below and saves a canvas nobody draws.
  const mark = parts.lockup ? await rasterMark(l.markSize, p.ink) : null

  // If the photograph could not be inlined, the document draws the vector ball
  // instead. The alternative is an <image> pointing at a path the canvas will
  // not follow, which exports a board with no ball on it and says nothing.
  const drawSystem: System = ball ? system : { ...system, matchBall: 'classic' }
  const ballHref = ball ?? undefined

  const canvas = document.createElement('canvas')
  canvas.width = l.w
  canvas.height = l.h
  const ctx = canvas.getContext('2d', { alpha: false })!

  const {
    Output,
    Mp4OutputFormat,
    WebMOutputFormat,
    BufferTarget,
    AudioBufferSource,
    CanvasSource,
    getFirstEncodableAudioCodec,
    getFirstEncodableVideoCodec,
    QUALITY_HIGH,
  } = await import('mediabunny')

  const hold = holdMs(system)
  const move = moveMs(system)
  const totalMs = totalDuration(system.acts.length, hold, move)
  const frames = Math.max(1, Math.round((totalMs / 1000) * fps))

  // H.264 in MP4 is the only combination every phone, every messenger and every
  // social upload accepts. VP9/WebM is the fallback for browsers that cannot
  // encode H.264 — it plays on the desktop, and it beats no file at all.
  const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'vp8'], {
    width: l.w,
    height: l.h,
  })
  if (!codec) throw new Error('This browser has no video encoder we can use.')

  const mp4 = codec === 'avc'
  const target = new BufferTarget()
  const output = new Output({
    format: mp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
    target,
  })
  const source = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH, keyFrameInterval: 2 })
  output.addVideoTrack(source, { frameRate: fps })

  /*
   * THE BALL BEING KICKED, every time the ball moves. ./audio.ts derives the
   * whole score from the document; there is nothing to author and nothing to
   * switch on.
   *
   * Every step of it is allowed to come back empty — a system where the ball
   * never moves has no kicks, the sample can fail to fetch, and a browser can
   * have a video encoder but no audio one. None of those is worth failing an
   * export over, so each just leaves the film silent, which is exactly what the
   * export did until this paragraph existed. It is the same policy the match
   * ball and the mark follow: cost the feature, never the video.
   *
   * AAC in MP4, Opus in WebM. Neither container takes the other's codec.
   */
  const track = await kickTrack(system, totalMs)
  let audio: InstanceType<typeof AudioBufferSource> | null = null
  if (track) {
    const audioCodec = await getFirstEncodableAudioCodec(mp4 ? ['aac'] : ['opus'], {
      numberOfChannels: track.numberOfChannels,
      sampleRate: track.sampleRate,
    })
    if (audioCodec) {
      audio = new AudioBufferSource({ codec: audioCodec, quality: QUALITY_HIGH })
      output.addAudioTrack(audio)
    }
  }

  await output.start()

  // Fed whole and up front. It is one `add` of a few seconds of PCM against
  // four hundred rasters, so it is done before the progress bar has moved, and
  // doing it here means a muxer that is going to refuse the track says so
  // before the coach watches a minute of encoding.
  if (audio && track) await audio.add(track)

  // The board only changes during a move. A four-phase system holds still for
  // 78 of every 111 frames, so caching the last raster is not a micro-optimisation
  // — it is most of the render time.
  let lastKey = ''
  let lastBoard: HTMLCanvasElement | null = null

  try {
    for (let i = 0; i < frames; i++) {
      if (opts.signal?.aborted) throw new DOMException('Export stopped', 'AbortError')

      const tl = timelineAt((i / fps) * 1000, system.acts.length, hold, move)
      const key = tl.p === 0 ? `hold:${tl.index}` : `${tl.index}:${tl.p.toFixed(4)}`

      if (key !== lastKey) {
        const act =
          tl.p === 0
            ? resolveAct(system.acts[tl.index], drawSystem)
            : tweenActs(system.acts[tl.index], system.acts[tl.next], tl.p, drawSystem)
        lastBoard = await raster(
          frameSvg(drawSystem, act, l.w, l.h, ballHref, photos, gear, css, view, crest ?? undefined),
          l.w,
          l.h,
        )
        lastKey = key
      }

      // No background to paint: the board is the whole frame now.
      ctx.drawImage(lastBoard!, 0, 0)
      // Words follow the pose, so they hand over with the cues around the
      // midpoint rather than at the top of the beat.
      drawChrome(
        ctx,
        l,
        system,
        phaseWords(tl, system, l.rise),
        (i + 1) / frames,
        mark,
        Boolean(opts.date),
        p,
        // ALL OF IT BY DEFAULT, and `resolveParts` is what supplies that when
        // the caller says nothing. It used to be `CHROME_PARTS_ALL` outright,
        // on the argument that a film travels furthest from its author and so
        // most needs to say whose it is. Right about the default; wrong as an
        // absolute, because the one export a coach cannot sign their own way is
        // the one they crop. See `VideoOptions.parts`.
        parts,
      )

      await source.add(i / fps, 1 / fps)
      opts.onProgress?.((i + 1) / frames)
    }

    await output.finalize()
  } catch (err) {
    // cancel() releases the encoder; without it a stopped export leaks one
    // hardware encode session per press, and the fourth press fails to start.
    if (output.state === 'started' || output.state === 'pending') await output.cancel().catch(() => {})
    throw err
  }

  const ext = mp4 ? 'mp4' : 'webm'
  return {
    blob: new Blob([target.buffer!], { type: mp4 ? 'video/mp4' : 'video/webm' }),
    filename: `${slug(system.title)}.${ext}`,
    ext,
    seconds: totalMs / 1000,
  }
}

// ── stills ───────────────────────────────────────────────────────────────────

/**
 * Every phase, as a PNG.
 *
 * ── WHY IT IS IN THIS FILE ──────────────────────────────────────────────────
 *
 * Because it is the film's own pipeline with the loop taken out. `frameView`,
 * `layout`, `frameSvg`, `raster` and `drawChrome` are the five things that
 * decide what an exported picture of this board looks like, and a still that
 * built its own version of any of them would drift from the video the first
 * time either was touched. A PNG out of here is bit-for-bit a frame of the
 * film, which is the property worth having: what a coach approves in the
 * preview is what lands in all three exports.
 *
 * The parts that genuinely differ are few and all of them are about it being a
 * PICTURE rather than a strip of time:
 *
 *  · A SQUARE shape exists here and not there (see ../image.ts).
 *  · The chrome can be turned off, because a board going into a coach's own
 *    slide deck is already under their own title.
 *  · The progress bar along the bottom edge would be a lie on a still — it
 *    measures how far through the film you are, and a photograph is not
 *    anywhere through anything. `drawChrome` takes the phase's own position in
 *    the system instead, so the hairline reads as "3 of 5" rather than as a
 *    video that has stopped.
 *
 * ── AND WHY IT RASTERISES RATHER THAN SAVING THE SVG ────────────────────────
 *
 * An SVG would be smaller, sharper at every size, and useless: it cannot be
 * pasted into WhatsApp, most slide tools import it badly or not at all, and a
 * phone will not put it in the photo roll. The whole errand this export serves
 * is "send a picture of this to somebody", and PNG is the only format that
 * always survives that trip.
 */
export async function renderStills(
  system: System,
  opts: ImageOptions = {},
): Promise<ImageFile[]> {
  if (!imagesSupported()) throw new Error('This browser cannot make image files.')

  const shape = resolveImageShape(opts.shape)
  const size = resolveImageSize(opts.size)
  const frame = imageSize(shape, size)
  const view = frameView(viewFor(system), frame)
  const l = layout(frame)
  const chrome = opts.chrome !== false
  const parts = resolveParts(opts.parts)

  /*
   * Which phases, sanitised rather than trusted. This is reachable from a
   * script and from the dialog, and an index that is off the end would throw
   * inside the loop after some of the pictures had already been written —
   * which is the worst possible place to fail, because the coach has files.
   */
  const wanted = (opts.phases ?? system.acts.map((_, i) => i)).filter(
    (i) => Number.isInteger(i) && i >= 0 && i < system.acts.length,
  )
  if (wanted.length === 0) throw new Error('There is no phase to export.')

  // Everything fetched rather than computed, up front — the same order and the
  // same reasoning as `renderVideo`.
  const [css, ball, photos, gear, crest] = await Promise.all([
    boardFontCss(),
    inlineBall(resolveBall(system.matchBall).id),
    inlinePhotos(photoPaths(system)),
    inlineGear(gearKinds(system)),
    inlineCrest(system),
  ])
  await document.fonts.ready

  const p = resolveSurface(system.surface).palette
  const mark = chrome && parts.lockup ? await rasterMark(l.markSize, p.ink) : null

  // A ball that could not be inlined becomes the drawn vector ball, rather than
  // an <image> pointing at a path the canvas will not follow. Same call as the
  // film makes, for the same reason.
  const drawSystem: System = ball ? system : { ...system, matchBall: 'classic' }
  const ballHref = ball ?? undefined

  const canvas = document.createElement('canvas')
  canvas.width = l.w
  canvas.height = l.h
  const ctx = canvas.getContext('2d', { alpha: false })!

  const name = slug(system.title)
  const files: ImageFile[] = []

  for (let n = 0; n < wanted.length; n++) {
    if (opts.signal?.aborted) throw new DOMException('Export stopped', 'AbortError')
    const i = wanted[n]

    const act = resolveAct(system.acts[i], drawSystem)
    const board = await raster(
      frameSvg(drawSystem, act, l.w, l.h, ballHref, photos, gear, css, view, crest ?? undefined),
      l.w,
      l.h,
    )
    ctx.drawImage(board, 0, 0)

    if (chrome) {
      drawChrome(
        ctx,
        l,
        system,
        // A still is not mid-transition, so the words are this phase's own at
        // full strength with no drift. That is what `{alpha: 1, dy: 0}` says.
        { index: i, alpha: 1, dy: 0 },
        // Where this phase sits in the system, NOT how far through a render we
        // are. See the header.
        (i + 1) / system.acts.length,
        mark,
        Boolean(opts.date),
        p,
        parts,
      )
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('This browser would not write the picture.')

    files.push({
      blob,
      /*
       * Numbered, zero-padded, one-based.
       *
       * Padded because ten phases sort as 1, 10, 2 in every file manager and
       * photo roll on earth, and a coach who exports a ten-phase system and
       * finds it out of order will not blame their file manager. One-based
       * because it matches what the panel, the board and the printed page all
       * call this phase.
       */
      filename: `${name}-${String(i + 1).padStart(2, '0')}.png`,
      phase: i + 1,
    })

    opts.onProgress?.((n + 1) / wanted.length)
  }

  return files
}
