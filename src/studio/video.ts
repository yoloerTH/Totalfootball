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
import { totalDuration } from './tween'

/**
 * The two shapes a coach actually posts in.
 *
 * Landscape is the presentation and the YouTube upload; vertical is a story, a
 * reel and a WhatsApp status. There is no "custom": a size box is a question a
 * coach cannot answer, and every wrong answer is a re-render.
 */
export interface VideoShape {
  id: 'landscape' | 'vertical'
  label: string
  note: string
  w: number
  h: number
}

export const VIDEO_SHAPES: VideoShape[] = [
  { id: 'landscape', label: 'Landscape', note: 'YouTube, a laptop, a projector.', w: 1920, h: 1080 },
  { id: 'vertical', label: 'Vertical', note: 'Stories, Reels, a WhatsApp status.', w: 1080, h: 1920 },
]

export const VIDEO_FPS = 30

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
  return totalDuration(system.acts.length) / 1000
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
