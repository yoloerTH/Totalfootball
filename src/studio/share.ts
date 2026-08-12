/**
 * Sharing a system as a link.
 *
 * THE WHOLE SYSTEM TRAVELS IN THE LINK. There is no share table, no upload and
 * no id to look up: the document is compressed and written into the URL's
 * FRAGMENT, and the viewer at /studio/watch/ unpacks it in the browser. Three
 * reasons, in the order they mattered:
 *
 *  · There is no server. The site builds static (astro.config.mjs), auth is not
 *    written yet, and a sharing feature that has to wait for Supabase is a
 *    sharing feature that misses the alpha.
 *  · A link that carries its own contents cannot rot. No row to delete, no
 *    bucket to migrate, no coach opening a dead link a season later.
 *  · The fragment is never sent to the server — not in the request, not in the
 *    logs, not to the CDN. A coach's unpublished pressing scheme stays between
 *    them and whoever they sent it to, which is a promise worth being able to
 *    make.
 *
 * The cost is length, and the trade is only survivable because it is
 * compressed: a five-phase system with two full teams is ~14KB of JSON and
 * about 1.5KB once deflated and base64'd. `CompressionStream` is native
 * everywhere we support (Chrome 80, Safari 16.4, Firefox 113) and the
 * uncompressed form is kept as a fallback rather than a failure, tagged so the
 * decoder never has to guess which it is holding.
 *
 * WHEN ACCOUNTS LAND this stays exactly as it is. A stored share becomes a
 * short link that resolves to the same viewer; the self-contained link remains
 * the one you can send to somebody who will never sign up, which is most
 * coaches most of the time.
 */

import type { System } from './schema'

/** `#s=<tag>.<payload>`. The tag says how the payload was packed. */
const PARAM = 's'
const TAG_DEFLATE = 'z'
const TAG_PLAIN = 'u'

/** Anything past this is likely to be mangled by a messaging app. */
export const LINK_WARN_LENGTH = 8000

// ── base64url, over bytes ────────────────────────────────────────────────────

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  // Chunked: String.fromCharCode(...bytes) blows the argument limit somewhere
  // around 100KB of board, which is exactly the size a share link gets to.
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw')
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(cs)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw')
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// ── the two directions ───────────────────────────────────────────────────────

/** Pack a system into a fragment payload. */
export async function encodeSystem(system: System): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(system))
  try {
    if (typeof CompressionStream !== 'undefined') {
      return `${TAG_DEFLATE}.${bytesToBase64Url(await deflate(json))}`
    }
  } catch {
    // Fall through. A long link beats no link.
  }
  return `${TAG_PLAIN}.${bytesToBase64Url(json)}`
}

/** Unpack one. Returns null for anything that is not a system we can read. */
export async function decodeSystem(payload: string): Promise<System | null> {
  try {
    const dot = payload.indexOf('.')
    const tag = dot === -1 ? TAG_PLAIN : payload.slice(0, dot)
    const body = dot === -1 ? payload : payload.slice(dot + 1)
    const bytes = base64UrlToBytes(body)
    const json = new TextDecoder().decode(tag === TAG_DEFLATE ? await inflate(bytes) : bytes)
    const parsed = JSON.parse(json) as System
    // A truncated link — one a mail client wrapped, say — parses as nothing or
    // as an object with no acts. Either way the viewer must say "broken link"
    // rather than render an empty pitch and look like the coach sent nothing.
    if (!parsed || !Array.isArray(parsed.acts) || parsed.acts.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

/** The full URL to hand somebody. */
export async function shareUrl(system: System, origin: string): Promise<string> {
  const payload = await encodeSystem(system)
  return `${origin.replace(/\/$/, '')}/studio/watch/#${PARAM}=${payload}`
}

/** Read a system back out of the current location. */
export async function systemFromHash(hash: string): Promise<System | null> {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  const payload = params.get(PARAM)
  return payload ? decodeSystem(payload) : null
}
