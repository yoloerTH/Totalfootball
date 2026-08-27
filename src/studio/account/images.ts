/**
 * Pictures a coach uploads: the club crest, their own face, and their players'.
 *
 * This began as `crest.ts`, one bucket and one file per coach. It generalised
 * the moment a second picture arrived, because all three want the same four
 * things — a path composed from the caller's own uuid, a size cap the browser
 * checks before the network does, a downscale so a 6 MB phone photo does not
 * become a 6 MB download on every board, and a URL built at read time.
 *
 * ── TWO BUCKETS, AND THE LINE BETWEEN THEM IS THE POINT ──────────────────────
 *
 *   · `crests` is PUBLIC. A crest and an avatar are drawn on boards that get
 *     exported to files and printed, and a signed URL would expire inside a PDF
 *     a coach keeps. They are a club badge and a public profile picture; being
 *     readable is what they are for.
 *
 *   · `players` is PRIVATE, added by supabase/013, and it holds faces. A squad
 *     is very often children. `crests` has a read policy of
 *     `using (bucket_id = 'crests')` with no path predicate, which means anyone
 *     may LIST it, not merely fetch a path they were given — perfectly fine for
 *     badges and completely unacceptable for a U16 side. Player photos are read
 *     through short-lived signed URLs and never leave the owner's account
 *     unless the owner publishes them on purpose.
 *
 * That difference is why `kindOf` exists rather than one bucket and a naming
 * convention: the bucket is a security boundary, so it is chosen from a closed
 * set by a function, never assembled from a string at a call site.
 *
 * ── WHY THE PATH IS STORED AND THE URL IS COMPOSED ───────────────────────────
 *
 * A public storage URL is `<project>/storage/v1/object/public/<bucket>/<path>`.
 * Two thirds of that string belong to the deployment rather than to the picture,
 * and both have changed under projects before. Storing the path and building the
 * URL at read time means moving the project is an env change, not a data
 * migration over every profile.
 *
 * Every function here returns something harmless when there is no client or no
 * session, exactly as ./cloud.ts does. A coach must never lose work — or, here,
 * be shown a broken page — because a network call they did not make failed.
 */

import { db } from './client'

/**
 * What a picture is, which decides where it lives and what it may be called.
 *
 * `player` carries the player's id so one squad member's photo can be replaced
 * or deleted without touching anybody else's.
 */
export type ImageKind = 'crest' | 'avatar' | 'player'

interface Spec {
  bucket: string
  /** True when the bucket is world-readable and a plain URL can be composed. */
  open: boolean
  /** Longest edge after downscaling, in pixels. */
  edge: number
}

const SPEC: Record<ImageKind, Spec> = {
  // 512 rather than the source size: a crest is drawn at about 24 px on a credit
  // bar and 40 px on a profile card. Anything larger is bandwidth nobody sees.
  crest: { bucket: 'crests', open: true, edge: 512 },
  avatar: { bucket: 'crests', open: true, edge: 512 },
  // Smaller again, and it matters more: a squad is up to forty of these and the
  // board draws each one inside a circle a few millimetres across.
  player: { bucket: 'players', open: false, edge: 384 },
}

/** The bucket's own cap, mirrored so the browser can refuse before uploading. */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024

/** Mirrors `allowed_mime_types` on both buckets. */
const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export const IMAGE_ACCEPT = Object.keys(TYPES).join(',')

/**
 * The object path for a picture. The ONLY place one is composed.
 *
 * The uuid prefix is not decoration: the storage policies in 012 and 013 compare
 * it to `auth.uid()` and reject the write outright if it does not match. The
 * CHECK constraints on `crest_path` and `avatar_path` pin the same shape from
 * the other side, so a path built anywhere but here has three ways to be wrong.
 */
function pathFor(kind: ImageKind, owner: string, ext: string, id = ''): string {
  return kind === 'player' ? `${owner}/players/${id}.${ext}` : `${owner}/${kind}.${ext}`
}

/**
 * The public URL for a stored path, or `''` when there is nothing to show.
 *
 * PUBLIC BUCKETS ONLY. A player photo has no public URL by design; ask
 * `signedPlayerUrl` for one of those. `''` rather than null so the result goes
 * straight into an `<img src>` guard without a second null check at every call
 * site.
 */
export function imageUrl(path: string | null | undefined): string {
  if (!path) return ''
  const supabase = db()
  if (!supabase) return ''
  return supabase.storage.from(SPEC.crest.bucket).getPublicUrl(path).data.publicUrl
}

/**
 * A short-lived URL for a private player photo.
 *
 * ONE HOUR, which is chosen against two different failures. Too short and a
 * coach who leaves the studio open over a training session comes back to a board
 * of broken images. Too long and a URL pasted into a chat outlives the
 * conversation. An hour covers a session and expires the same day.
 *
 * The video exporter does NOT rely on this staying valid: it fetches each photo
 * once, up front, and inlines it as a `data:` URI, so a render that takes twenty
 * minutes cannot half-succeed. See `inlinePhotos` in ./squad.ts.
 */
export async function signedPlayerUrl(path: string, seconds = 3600): Promise<string> {
  const supabase = db()
  if (!supabase || !path) return ''
  const { data, error } = await supabase.storage
    .from(SPEC.player.bucket)
    .createSignedUrl(path, seconds)
  return error || !data ? '' : data.signedUrl
}

export interface ImageResult {
  /** The stored path on success, `''` on failure. */
  path: string
  /** The sentence to show the coach, or `''` when it worked. */
  fault: string
}

/**
 * Shrink a picture to `edge` on its longest side, in the browser, before upload.
 *
 * A phone camera produces 4000 px JPEGs. Forty of those is 200 MB in a bucket
 * and a board that takes a minute to draw, for pictures rendered at forty
 * pixels. This is the single cheapest thing in the file and the one most likely
 * to be deleted by someone who thinks it is a nicety.
 *
 * PNG STAYS PNG. Everything else becomes WebP. Re-encoding a PNG as WebP would
 * usually be smaller, but a crest is the one picture here that genuinely needs
 * its alpha channel and its hard edges, and PNG is the format that will not
 * argue about either. JPEGs have no alpha to lose, so they get the better codec.
 *
 * RETURNS THE ORIGINAL ON ANY FAILURE rather than throwing. A browser without
 * `createImageBitmap`, a canvas that refuses to encode, an image that will not
 * decode — none of those are worth failing an upload over. The bucket's own
 * limits are still there, and a large file that uploads beats a small one that
 * does not.
 */
async function downscale(file: File, edge: number): Promise<File> {
  try {
    if (typeof createImageBitmap !== 'function') return file
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height))
    // Already small enough. Re-encoding would cost quality and buy nothing.
    if (scale === 1) {
      bitmap.close()
      return file
    }

    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    const png = file.type === 'image/png'
    const type = png ? 'image/png' : 'image/webp'
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.9))
    if (!blob) return file

    const name = file.name.replace(/\.[^.]+$/, '') + (png ? '.png' : '.webp')
    return new File([blob], name, { type })
  } catch {
    return file
  }
}

/**
 * Put a picture in the coach's own folder and return the path to store.
 *
 * ONE OBJECT PER PICTURE, overwritten in place (`upsert: true`) rather than a
 * new object per upload. A crest is a single current fact, not a history, and
 * uniquely-named uploads would leave every superseded picture in the bucket
 * forever with nothing pointing at it and nothing to clean it up.
 *
 * The consequence to know about: the URL does not change when the image does, so
 * a browser that has cached the old one will keep showing it. `cacheControl` is
 * set low for that reason, and callers that have just uploaded should bust it
 * themselves — see `bust()`.
 */
export async function uploadImage(
  file: File,
  owner: string,
  kind: ImageKind,
  id = '',
): Promise<ImageResult> {
  const supabase = db()
  if (!supabase) return { path: '', fault: 'Not signed in.' }
  if (kind === 'player' && !id) return { path: '', fault: 'That player has not been saved yet.' }

  if (!TYPES[file.type]) {
    return { path: '', fault: 'A picture has to be a PNG, a JPG or a WebP.' }
  }
  // Checked against the ORIGINAL, before downscaling, and deliberately so. The
  // cap is there to stop a coach waiting on a 40 MB read from their own disk,
  // and shrinking it afterwards would not give them that time back.
  if (file.size > IMAGE_MAX_BYTES) {
    return { path: '', fault: 'That file is over 5 MB. Try a smaller one.' }
  }

  const spec = SPEC[kind]
  const small = await downscale(file, spec.edge)
  const ext = TYPES[small.type] ?? 'png'
  const path = pathFor(kind, owner, ext, id)

  const { error } = await supabase.storage
    .from(spec.bucket)
    .upload(path, small, { upsert: true, contentType: small.type, cacheControl: '60' })

  if (error) return { path: '', fault: 'That did not upload. Check your connection and try again.' }
  return { path, fault: '' }
}

/**
 * Remove the object. The caller still has to clear the column that points at it.
 *
 * Deliberately two steps rather than one, because they fail differently: a row
 * still pointing at a deleted object shows a broken image, while a cleared row
 * pointing at a surviving object is merely a stray 40 KB. Do the storage delete
 * first and the column second, so the worse of the two is the one that cannot
 * happen.
 *
 * The bucket is taken from the PATH rather than passed in, because a caller that
 * guesses wrong here deletes nothing and reports success.
 */
export async function removeImage(path: string): Promise<boolean> {
  const supabase = db()
  if (!supabase || !path) return false
  const bucket = path.includes('/players/') ? SPEC.player.bucket : SPEC.crest.bucket
  const { error } = await supabase.storage.from(bucket).remove([path])
  return !error
}

/**
 * A cache-busted copy of a URL, for the moment right after an upload.
 *
 * Stored on the component's state and never in the database: the query string is
 * about one browser at one moment, and persisting it would put a stale
 * timestamp in front of every future visitor.
 */
export function bust(url: string): string {
  return url ? `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}` : ''
}
