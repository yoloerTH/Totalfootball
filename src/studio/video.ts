/**
 * What a video export IS. How one is made lives in ./videoRender.ts.
 *
 * The split is a bundle boundary, not a tidiness one. Making a film pulls in a
 * muxer, an encoder and a second copy of React's renderer — around 50KB gzipped
 * that every coach would otherwise download to open the studio, for a button
 * most sessions never press. Everything here is small enough to load eagerly
 * and is all the dialog needs before a coach has decided to press anything;
 * `renderVideo` is reached through a dynamic `import()` at the moment they do.
 *
 * So: no imports from ./videoRender.ts in this file, in either direction of
 * intent. If something here starts needing the renderer, it belongs over there.
 */

import type { System } from './schema'
import { holdMs, moveMs } from './pace'
import { totalDuration } from './tween'

/**
 * The two shapes a coach actually posts in.
 *
 * Landscape is the presentation and the YouTube upload; vertical is a story, a
 * reel and a WhatsApp status. There is no "custom": a size box is a question a
 * coach cannot answer, and every wrong answer is a re-render.
 *
 * The shape also decides the framing, not just the canvas: the exporter turns
 * the board to whichever way fills the frame and pads the crop with grass until
 * the pitch reaches all four edges. See `frameView` in ./videoRender.ts.
 *
 * A shape is an ASPECT and not a size. What it comes out at is `VideoQuality`
 * below, and the two are deliberately separate controls: "where is it going"
 * and "how big is the file" are different questions, and folding them into one
 * list of four options would make a coach who wants a smaller file go looking
 * under the heading that says Stories.
 */
export interface VideoShape {
  id: 'landscape' | 'vertical'
  label: string
  note: string
  /** Long edge ÷ short edge. 16/9 both ways; vertical stands it on its end. */
  ratio: number
  /** Which way up. Decides whether the quality's number is the width or height. */
  upright: boolean
}

export const VIDEO_SHAPES: VideoShape[] = [
  {
    id: 'landscape',
    label: 'Landscape',
    note: 'YouTube, a laptop, a projector.',
    ratio: 16 / 9,
    upright: false,
  },
  {
    id: 'vertical',
    label: 'Vertical',
    note: 'Stories, Reels, a WhatsApp status. A full pitch stands upright to fill the screen.',
    ratio: 16 / 9,
    upright: true,
  },
]

/**
 * How big, in the only unit anybody says out loud.
 *
 * The number is the SHORT edge, which is what "1080p" has always meant, and it
 * is applied to whichever edge is short in the chosen shape — so 1080p is
 * 1920×1080 flat and 1080×1920 upright, and a coach who picks it gets the same
 * sharpness either way rather than a vertical film that is secretly a third of
 * the pixels.
 *
 * 720 is here because the export runs on the coach's own machine. A ten-phase
 * system at 1080p60 is four times the pixels of 720p30 and takes about four
 * times as long on a laptop that is already warm — and for a clip going into a
 * WhatsApp group, which re-encodes everything it is sent anyway, the difference
 * on arrival is nothing. It is the setting for "I need this now", and saying so
 * is better than letting somebody sit through the wait to find out.
 */
export interface VideoQuality {
  id: '720' | '1080'
  label: string
  note: string
  /** Pixels on the short edge. */
  short: number
}

export const VIDEO_QUALITIES: VideoQuality[] = [
  {
    id: '1080',
    label: '1080p',
    note: 'Full HD. What to upload, and what to project.',
    short: 1080,
  },
  {
    id: '720',
    label: '720p',
    note: 'Half the pixels, roughly half the wait, and a smaller file. Fine for a group chat.',
    short: 720,
  },
]

/**
 * Frames a second.
 *
 * 30 is the house rate and what the shorts are cut at. 60 exists for one real
 * reason: the board's moves are long, slow tweens across a large frame, and a
 * slow pan is exactly the motion where 30fps judder is visible — on a phone
 * held still, a back four sliding across at 60 reads as one object moving and
 * at 30 reads as four counters stepping. It doubles the frames to raster, so it
 * roughly doubles the render, which the dialog says before they press it.
 */
export const VIDEO_FRAME_RATES = [30, 60] as const
export type VideoFps = (typeof VIDEO_FRAME_RATES)[number]

/** The default, and what every film made before these settings existed used. */
export const VIDEO_FPS: VideoFps = 30
export const DEFAULT_QUALITY: VideoQuality['id'] = '1080'

/**
 * The canvas, in pixels.
 *
 * Both edges are forced EVEN. H.264 in 4:2:0 stores chroma at half resolution
 * in each direction, and an odd dimension is not representable — encoders
 * either refuse the configuration outright or silently round, and a silent
 * round is a one-pixel green seam down the edge of the film. 720 × 16/9 is
 * 1280 exactly, so nothing here is odd today; the rounding is what keeps that
 * true the first time somebody adds a size that is not a multiple of 16.
 */
export function frameSize(shape: VideoShape, quality: VideoQuality): { w: number; h: number } {
  const even = (n: number) => Math.round(n / 2) * 2
  const short = even(quality.short)
  const long = even(quality.short * shape.ratio)
  return shape.upright ? { w: short, h: long } : { w: long, h: short }
}

/** Resolve whatever the caller passed into the two objects the renderer needs. */
export function resolveShape(id?: VideoShape['id']): VideoShape {
  return VIDEO_SHAPES.find((s) => s.id === id) ?? VIDEO_SHAPES[0]
}

export function resolveQuality(id?: VideoQuality['id']): VideoQuality {
  return VIDEO_QUALITIES.find((q) => q.id === id) ?? VIDEO_QUALITIES[0]
}

export function resolveFps(fps?: number): VideoFps {
  return VIDEO_FRAME_RATES.includes(fps as VideoFps) ? (fps as VideoFps) : VIDEO_FPS
}

export interface VideoFile {
  blob: Blob
  filename: string
  /** 'mp4' on everything that can encode H.264; 'webm' is the Firefox path. */
  ext: 'mp4' | 'webm'
  /** Seconds, for the line that says what they just got. */
  seconds: number
}

export interface VideoOptions {
  shape?: VideoShape['id']
  /** Pixels on the short edge: '720' or '1080'. Defaults to 1080. */
  quality?: VideoQuality['id']
  /** 30 or 60. Anything else falls back to 30 rather than being trusted. */
  fps?: number
  /**
   * Stamp the shared-on date into the credit line. Off unless asked for.
   *
   * The date is stamped on the document when a link is made, which is the right
   * default for a link — it says how current the thing you are reading is. A
   * file is different: it is posted once and then lives in a group chat or on a
   * profile for a season, where a date only makes a system that is still true
   * look out of date. Their name and club is the part that has to be there.
   */
  date?: boolean
  /** 0→1, called every frame. */
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/**
 * Whether this browser can encode at all.
 *
 * WebCodecs is the one hard requirement — Chrome 94+, Edge, Safari 16.4+,
 * Firefox 130+, which is everyone who is not on an iPad from 2019. When it is
 * missing the answer is not a worse video, it is the share link, so the dialog
 * says that instead of offering a button that cannot work.
 */
export function videoSupported(): boolean {
  return typeof window !== 'undefined' && 'VideoEncoder' in window
}

/** How long the finished film will run, in seconds. Shown before committing. */
export function videoSeconds(system: System): number {
  return totalDuration(system.acts.length, holdMs(system), moveMs(system)) / 1000
}

/** Hand the file to the browser. Separate from the render so a retry is free. */
export function saveVideo(file: VideoFile): void {
  const url = URL.createObjectURL(file.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.filename
  a.click()
  // Revoking immediately cancels the download in Safari; one tick is not enough
  // either, because the browser reads the blob lazily. Ten seconds is free.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
