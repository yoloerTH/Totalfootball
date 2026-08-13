/**
 * Sharing a system as a link.
 *
 * TWO KINDS OF LINK, AND THE SHORT ONE IS THE POINT.
 *
 *  · `/s/k7f3q9` — the document is stored (netlify/functions/share.mts, table
 *    in supabase/004_studio_shares.sql) and the link is seven characters. This
 *    is what a coach gets.
 *  · `/studio/watch/#s=<the whole system, deflated>` — the document travels
 *    inside its own URL. This is the FALLBACK, used only when publishing fails.
 *
 * The self-contained link was the original design and it was right about
 * everything except the thing that mattered: no server needed, nothing to rot,
 * and the fragment is never sent to us, so an unpublished pressing scheme stays
 * between the coach and whoever they sent it to. It also produced a
 * two-thousand-character link. Nobody can paste that into WhatsApp, so as a
 * primary mechanism it failed at the one job it had.
 *
 * It is kept, rather than deleted, because it degrades well: if the function is
 * down or the coach is offline, they still get something they can send, and it
 * still opens in the same viewer. A sharing feature that can fail closed is
 * worse than a long link.
 *
 * `CompressionStream('deflate-raw')` is native everywhere we support (Chrome
 * 80, Safari 16.4, Firefox 113); the uncompressed form is a tagged fallback so
 * the decoder never has to guess what it is holding.
 */

import type { System } from './schema'

/** `#s=<tag>.<payload>`. The tag says how the payload was packed. */
const PARAM = 's'
const TAG_DEFLATE = 'z'
const TAG_PLAIN = 'u'

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

/** The self-contained fallback link. Long, but it always works. */
export async function longUrl(system: System, origin: string): Promise<string> {
  const payload = await encodeSystem(system)
  return `${origin.replace(/\/$/, '')}/studio/watch/#${PARAM}=${payload}`
}

/** Read a system back out of a fragment. */
export async function systemFromHash(hash: string): Promise<System | null> {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  const payload = params.get(PARAM)
  return payload ? decodeSystem(payload) : null
}

// ── the short link ───────────────────────────────────────────────────────────

/** Shape of a stored share's id. Mirrors the CHECK in 004_studio_shares.sql. */
const ID_SHAPE = /^[0-9a-hjkmnp-tv-z]{6,16}$/

export interface Published {
  /** The short id. Store it on the document so the next publish updates it. */
  id: string
  /** The whole link, ready to send. */
  url: string
}

/**
 * Publish, or refresh what is already published.
 *
 * Sends the id the document is carrying, if it has one, so a coach who shares
 * the same system twice refreshes the link they already sent rather than
 * making a second one. The server may hand back a DIFFERENT id — the row can
 * have been removed, or the document copied from another machine — so the
 * caller must always store what comes back rather than assuming.
 *
 * Throws on failure, deliberately: the caller falls back to `longUrl`, and a
 * silent null would make that decision impossible to see.
 */
export async function publishSystem(system: System, origin: string): Promise<Published> {
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: system.shareId, doc: system }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Publish failed (${res.status})`)
  }
  const { id } = (await res.json()) as { id: string }
  return { id, url: `${origin.replace(/\/$/, '')}/s/${id}` }
}

/** Fetch a published system by its short id. */
export async function fetchShared(id: string): Promise<System | null> {
  if (!ID_SHAPE.test(id)) return null
  const res = await fetch(`/api/share/${id}`)
  if (!res.ok) return null
  const body = (await res.json()) as { doc?: System }
  const doc = body.doc
  return doc && Array.isArray(doc.acts) && doc.acts.length ? doc : null
}

/**
 * The short id in a URL, if there is one. `/s/k7f3q9`.
 *
 * The viewer is served at that path by a Netlify rewrite (netlify.toml), so the
 * page has to read its own address to know what it is showing.
 */
export function idFromPath(pathname: string): string | null {
  const m = pathname.replace(/\/+$/, '').match(/^\/s\/([^/]+)$/)
  return m && ID_SHAPE.test(m[1]) ? m[1] : null
}
