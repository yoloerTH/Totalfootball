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
 * 1. THE BALL. A canvas will not fetch `/studio/balls/trionda.png` out of a
 *    serialised SVG and does not error when it fails — the ball is simply gone.
 *    `inlineBall()` supplies a `data:` URI, and if that fetch fails we fall the
 *    whole document back to the drawn vector ball rather than emit a broken
 *    `<image>`.
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

import { Board } from './board/Board'
import { BOARD } from './board/palette'
import { PITCH_VIEWS, aspect, resolveViewId } from './board/pitch'
import { inlineBall, resolveBall } from './balls'
import type { System } from './schema'
import { resolveAct, timelineAt, totalDuration, tweenActs } from './tween'
import { VIDEO_FPS, VIDEO_SHAPES, videoSupported, type VideoFile, type VideoOptions, type VideoShape } from './video'
import { formatDate } from './viewer/CreditBar'

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
  css: string,
): string {
  const markup = renderToStaticMarkup(
    createElement(Board, { system, act, idp: 'vid', texture: false, ballHref }),
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

// ── the frame around the board ───────────────────────────────────────────────

interface Layout {
  w: number
  h: number
  pad: number
  board: { x: number; y: number; w: number; h: number }
  /** Baseline of the phase title, and of the caption under it. */
  titleY: number
  captionY: number
  creditY: number
  titleSize: number
  captionSize: number
  creditSize: number
}

/**
 * Where everything sits in the frame.
 *
 * Every size is derived from the frame's SHORT side, so the vertical export is
 * the landscape one at a different aspect rather than a second design with its
 * own numbers to keep in step.
 */
function layout(shape: VideoShape, boardAspect: number): Layout {
  const short = Math.min(shape.w, shape.h)
  const pad = Math.round(short * 0.05)
  const titleSize = Math.round(short * 0.038)
  const captionSize = Math.round(short * 0.03)
  const creditSize = Math.round(short * 0.022)

  const textBlock = Math.round(titleSize * 1.5 + captionSize * 1.6)
  const creditBlock = Math.round(creditSize * 2.6)

  const availW = shape.w - pad * 2
  const availH = shape.h - pad * 2 - textBlock - creditBlock

  const bw = Math.min(availW, availH * boardAspect)
  const bh = bw / boardAspect

  const boardX = Math.round((shape.w - bw) / 2)
  const boardY = Math.round(pad + (availH - bh) / 2)

  return {
    w: shape.w,
    h: shape.h,
    pad,
    board: { x: boardX, y: boardY, w: Math.round(bw), h: Math.round(bh) },
    titleY: Math.round(boardY + bh + titleSize * 1.5),
    captionY: Math.round(boardY + bh + titleSize * 1.5 + captionSize * 1.5),
    creditY: Math.round(shape.h - pad * 0.6),
    titleSize,
    captionSize,
    creditSize,
  }
}

const FACE = `'Inter Variable', Inter, system-ui, sans-serif`

/** Truncate to fit, with a real ellipsis rather than a clipped word. */
function fitText(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let s = text
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1)
  return `${s}…`
}

/**
 * Everything that is not the board: the phase's own words, and the credit line.
 *
 * The credit line is the watermark and its shape is the policy in
 * ../viewer/CreditBar.tsx — their name on the left, ours on the right. A video
 * is the one export that travels furthest from the person who made it, so it is
 * the one that most needs to say who that was.
 */
function drawChrome(
  ctx: CanvasRenderingContext2D,
  l: Layout,
  system: System,
  actIndex: number,
): void {
  const act = system.acts[actIndex]
  const inner = l.w - l.pad * 2

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'

  if (act.title) {
    ctx.font = `800 ${l.titleSize}px ${FACE}`
    ctx.fillStyle = BOARD.ink
    ctx.fillText(fitText(ctx, act.title, inner), l.w / 2, l.titleY)
  }

  if (act.caption) {
    ctx.font = `500 ${l.captionSize}px ${FACE}`
    ctx.fillStyle = BOARD.inkSoft
    ctx.fillText(fitText(ctx, act.caption, inner), l.w / 2, l.captionY)
  }

  const presenter = system.credit?.presenter?.trim()
  const team = system.credit?.team?.trim()
  const date = formatDate(system.credit?.sharedOn)
  const theirs = [presenter, team, date].filter(Boolean).join(' · ')

  ctx.font = `700 ${l.creditSize}px ${FACE}`
  ctx.fillStyle = BOARD.inkSoft
  ctx.textAlign = 'left'
  ctx.fillText(fitText(ctx, theirs || system.title || 'A tactical system', inner * 0.6), l.pad, l.creditY)

  ctx.textAlign = 'right'
  ctx.fillText('Made with Total Football', l.w - l.pad, l.creditY)
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

  const shape = VIDEO_SHAPES.find((s) => s.id === opts.shape) ?? VIDEO_SHAPES[0]
  const view = PITCH_VIEWS[resolveViewId(system.pitch)]
  const l = layout(shape, aspect(view))

  // Everything that is fetched rather than computed, up front: a failure here
  // should happen before the coach has watched a progress bar for a minute.
  const [css, ball] = await Promise.all([boardFontCss(), inlineBall(resolveBall(system.matchBall).id)])
  await document.fonts.ready

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
    CanvasSource,
    getFirstEncodableVideoCodec,
    QUALITY_HIGH,
  } = await import('mediabunny')

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
  output.addVideoTrack(source, { frameRate: VIDEO_FPS })
  await output.start()

  const totalMs = totalDuration(system.acts.length)
  const frames = Math.max(1, Math.round((totalMs / 1000) * VIDEO_FPS))

  // The board only changes during a move. A four-phase system holds still for
  // 78 of every 111 frames, so caching the last raster is not a micro-optimisation
  // — it is most of the render time.
  let lastKey = ''
  let lastBoard: HTMLCanvasElement | null = null

  try {
    for (let i = 0; i < frames; i++) {
      if (opts.signal?.aborted) throw new DOMException('Export stopped', 'AbortError')

      const tl = timelineAt((i / VIDEO_FPS) * 1000, system.acts.length)
      const key = tl.p === 0 ? `hold:${tl.index}` : `${tl.index}:${tl.p.toFixed(4)}`

      if (key !== lastKey) {
        const act =
          tl.p === 0
            ? resolveAct(system.acts[tl.index])
            : tweenActs(system.acts[tl.index], system.acts[tl.next], tl.p)
        lastBoard = await raster(
          frameSvg(drawSystem, act, l.board.w, l.board.h, ballHref, css),
          l.board.w,
          l.board.h,
        )
        lastKey = key
      }

      ctx.fillStyle = BOARD.paper2
      ctx.fillRect(0, 0, l.w, l.h)
      ctx.drawImage(lastBoard!, l.board.x, l.board.y)
      // Words follow the pose, so they change with the cues at the midpoint
      // rather than at the top of the beat.
      drawChrome(ctx, l, system, tl.p < 0.5 ? tl.index : tl.next)

      await source.add(i / VIDEO_FPS, 1 / VIDEO_FPS)
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
