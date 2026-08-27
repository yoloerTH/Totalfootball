/**
 * Still images of a board: the shapes, the sizes, and how a file is handed over.
 *
 * The same split as ./video.ts, and for the same reason. This module is small,
 * synchronous and safe to import at page load; ./videoRender.ts carries React's
 * server renderer and a muxer and must not be. The dialog needs the shapes to
 * draw its controls long before anybody presses anything, so the shapes live
 * here and the rendering arrives via `import()` when it is asked for.
 *
 * ── WHY IMAGES AT ALL, WHEN THERE IS ALREADY A VIDEO AND A LINK ─────────────
 *
 * Because most of what a coach actually sends is a picture. A share link is the
 * best thing we make and it needs a browser and a tap; a film needs a browser,
 * a tap and forty seconds of somebody's attention. A PNG goes into a team
 * WhatsApp, a slide, a printed session plan and a group chat that strips links,
 * and it is legible in the preview without anybody opening anything.
 *
 * It is also the cheapest export we have. One frame, no encoder, no muxer, no
 * WebCodecs — so unlike the video it works in every browser, including the ones
 * that cannot make an MP4 at all.
 */

import type { System } from './schema'

/**
 * The shape of the picture.
 *
 * Three, where the video has two, and the third one is the reason this list is
 * not just imported from ./video.ts. SQUARE is a still-image shape: it is what
 * a feed post is, it is what a slide thumbnail wants, and it is the only aspect
 * that puts a full pitch and a phone screen on speaking terms without either
 * letterboxing or cropping to a third of the grass. Nobody has ever wanted a
 * square video.
 */
export interface ImageShape {
  id: 'landscape' | 'vertical' | 'square'
  label: string
  note: string
  /** Long edge ÷ short edge. 1 for the square, which has no long edge. */
  ratio: number
  /** Which way up. Decides whether the size's number is the width or height. */
  upright: boolean
}

export const IMAGE_SHAPES: ImageShape[] = [
  {
    id: 'landscape',
    label: 'Landscape',
    note: 'A slide, a document, a laptop screen. The shape a pitch already is.',
    ratio: 16 / 9,
    upright: false,
  },
  {
    id: 'square',
    label: 'Square',
    note: 'A feed post, and the safest thing to send into a group chat.',
    ratio: 1,
    upright: false,
  },
  {
    id: 'vertical',
    label: 'Vertical',
    note: 'A story or a status. The pitch stands upright to fill the screen.',
    ratio: 16 / 9,
    upright: true,
  },
]

/**
 * How big, on the short edge.
 *
 * One frame rather than four hundred, so the reason ./video.ts offers 720p —
 * that the render runs on the coach's own laptop and a big one is a long wait —
 * does not apply here: even the largest of these is under a second. What DOES
 * apply is where the file is going. 2160 is for printing and projecting; 1080
 * is what every messenger re-encodes everything down to anyway, so sending a
 * 4K PNG into a group chat buys nothing but upload time.
 */
export interface ImageSize {
  id: '1080' | '1440' | '2160'
  label: string
  note: string
  short: number
}

export const IMAGE_SIZES: ImageSize[] = [
  { id: '1080', label: 'Standard', note: 'Full HD on the short edge. For sending.', short: 1080 },
  { id: '1440', label: 'Large', note: 'Half again as sharp. For a slide deck.', short: 1440 },
  { id: '2160', label: 'Print', note: '4K on the short edge. For projecting and printing.', short: 2160 },
]

export const DEFAULT_IMAGE_SHAPE: ImageShape['id'] = 'landscape'
export const DEFAULT_IMAGE_SIZE: ImageSize['id'] = '1440'

export function resolveImageShape(id?: string): ImageShape {
  return IMAGE_SHAPES.find((s) => s.id === id) ?? IMAGE_SHAPES[0]
}

export function resolveImageSize(id?: string): ImageSize {
  return IMAGE_SIZES.find((s) => s.id === id) ?? IMAGE_SIZES[1]
}

/**
 * The canvas, in pixels.
 *
 * Both edges forced EVEN, exactly as `frameSize` in ./video.ts does. A PNG has
 * no chroma subsampling and does not care — but these numbers are fed to the
 * same `frameView` and `layout` the film uses, and the day somebody reaches for
 * this to make a poster frame for a video is not the day to discover that one
 * of the two rounds differently.
 */
export function imageSize(shape: ImageShape, size: ImageSize): { w: number; h: number } {
  const even = (n: number) => Math.round(n / 2) * 2
  const short = even(size.short)
  const long = even(size.short * shape.ratio)
  return shape.upright ? { w: short, h: long } : { w: long, h: short }
}

/**
 * ── WHAT GOES ON THE PICTURE, IN PARTS ───────────────────────────────────────
 *
 * `chrome` was one switch: the standing head, the phase's words, the credit
 * line and our lockup, all on or all off. That is two answers to a question
 * coaches keep asking a third of — a session plan wants the caption and not the
 * system's name; a slide wants the board and the coach's own credit and nothing
 * else; a picture for a group chat wants everything (user, 2026-08-27).
 *
 * So: four parts, each with a switch, and `chrome` still the master. Turning
 * `chrome` off is the same answer it always was and does not need any of these.
 *
 * ── THE ONE RULE THAT IS NOT THE COACH'S TO SET ──────────────────────────────
 *
 * `lockup` cannot be on when `credit` is off. The watermark policy in
 * ../viewer/CreditBar.tsx is that ours is never drawn without theirs — a corner
 * logo alone on somebody else's work reads as a tax, and a credit line reads as
 * authorship. Their name without our mark is fine and always has been; our mark
 * without their name is the thing the policy exists to prevent. `resolveParts`
 * enforces it so no caller has to remember, and so no future dialog can offer
 * the combination by accident.
 */
export interface ChromeParts {
  /** Top left: the gold rule, the system's name, the phase count opposite. */
  head: boolean
  /** Top left, under the head: this phase's own title and caption. */
  words: boolean
  /** Bottom left: their name, their club, their note and the date. */
  credit: boolean
  /** Bottom right: "Made with Total Football" and the mark. */
  lockup: boolean
}

export const CHROME_PARTS_ALL: ChromeParts = {
  head: true,
  words: true,
  credit: true,
  lockup: true,
}

/** Fill in what was not asked about, and apply the watermark rule. */
export function resolveParts(parts?: Partial<ChromeParts>): ChromeParts {
  const p = { ...CHROME_PARTS_ALL, ...parts }
  return { ...p, lockup: p.lockup && p.credit }
}

export interface ImageFile {
  blob: Blob
  filename: string
  /** 1-based, and 0 for a picture that is not of one phase. For the read-out. */
  phase: number
}

export interface ImageOptions {
  shape?: ImageShape['id']
  size?: ImageSize['id']
  /**
   * Draw the standing head, the credit line and the phase count over the board.
   *
   * ON by default, because those are the parts that make an exported picture
   * ours and the coach's rather than an anonymous diagram — the credit line is
   * the watermark and its policy is argued in ../viewer/CreditBar.tsx.
   *
   * Off is a real option and not a way of removing the credit: a board going
   * into a coach's own slide deck is being put UNDER their own title, next to
   * their own logo, and stamping a second head on it makes the slide look like
   * two documents. That is a legitimate errand and this is how you ask for it.
   */
  chrome?: boolean
  /**
   * Which PARTS of the chrome, for a coach who wants some of it.
   *
   * Absent means all of them, which is what `chrome: true` has always meant.
   * See `ChromeParts` below for why this is four switches and not one.
   */
  parts?: Partial<ChromeParts>
  /** Stamp the shared-on date into the credit line. See `VideoOptions.date`. */
  date?: boolean
  /**
   * Which phases. Absent means every one of them.
   *
   * Indices rather than a count, so "just this one" and "all of them" are the
   * same call with a different list and there is no second code path for the
   * common case to drift away from.
   */
  phases?: number[]
  /** 0→1, called as each picture finishes. */
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/**
 * Every browser can do this.
 *
 * Unlike the video, which needs WebCodecs. Serialise an SVG, draw it into a
 * canvas, read the canvas back as a PNG — that is 2011 technology, and it is
 * why this export exists for the coaches whose browser cannot make a film.
 * Kept as a function anyway so the dialog asks the same question of both.
 */
export function imagesSupported(): boolean {
  return typeof window !== 'undefined' && typeof HTMLCanvasElement !== 'undefined'
}

/** How many pictures a given set of options will produce. */
export function imageCount(system: System, phases?: number[]): number {
  return phases ? phases.length : system.acts.length
}

/**
 * Hand one file to the browser.
 *
 * Lifted from `saveVideo` rather than shared with it, because the ten-second
 * revoke below is a fix for a Safari behaviour that is about the DOWNLOAD and
 * not about the format, and a single helper serving both would have to be given
 * a name that pretends they are one thing. They are two exports that happen to
 * end the same way.
 */
export function saveImage(file: ImageFile): void {
  const url = URL.createObjectURL(file.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Hand SEVERAL files over, one at a time.
 *
 * ── WHY THIS IS NOT A ZIP ───────────────────────────────────────────────────
 *
 * A zip would need a zip library in the bundle, and it would land on a coach's
 * phone as one archive that iOS and Android both make genuinely awkward to open
 * and impossible to forward a single picture out of. Separate PNGs go straight
 * into the photo roll, which is where they are being sent from.
 *
 * ── AND WHY THE GAP ─────────────────────────────────────────────────────────
 *
 * Browsers rate-limit programmatic downloads: fire ten `a.click()`s in one tick
 * and Chrome asks once about "multiple files" and then silently drops most of
 * them. A short gap between them is what makes ten phases arrive as ten files.
 * 320ms is comfortably above the threshold in every browser tested and still
 * under four seconds for a ten-phase system.
 */
export async function saveImages(files: ImageFile[]): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    saveImage(files[i])
    if (i < files.length - 1) await new Promise((r) => setTimeout(r, 320))
  }
}
