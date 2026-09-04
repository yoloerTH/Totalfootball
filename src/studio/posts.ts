/**
 * Publishing a system, and reading a published one back.
 *
 * Phase 2 of docs/SOCIAL.md. `studio_posts` is the table (supabase/024) and
 * this file is the whole of the client's side of it.
 *
 * ── A POST IS NOT A SHARE, AND THIS IS NOT ../share.ts ───────────────────────
 *
 * They look alike from a distance — both take a document and give back a short
 * link — and they are different things, which is why 024 made a new table
 * rather than growing `studio_shares`:
 *
 *   A SHARE is a link you SEND. It is anonymous by design, has no owner it can
 *   prove, lives behind a service-role function, and is updated in place so the
 *   link a coach already sent stays current.
 *
 *   A POST is a thing you PUBLISH. It has an owner, a title, a visibility, a
 *   place in a feed, and it is a SNAPSHOT — editing the system afterwards must
 *   not rewrite what somebody read last week.
 *
 * The two coexist and the studio offers both. A coach sending Tuesday's session
 * to their assistant wants a share; a coach putting a pressing system in front
 * of strangers wants a post.
 *
 * ── IT RUNS ON THE ANON KEY AND RLS, NOT THROUGH A NETLIFY FUNCTION ──────────
 *
 * `share.mts` exists because `studio_shares` has no owner column and no
 * policies, so something holding the service-role key had to be the only door.
 * This table HAS an owner and `studio_posts_own` (024) is the door. Writing it
 * from the browser under the coach's own session is therefore both simpler and
 * stricter — the database checks the owner on every row, rather than a function
 * checking a token and then writing as root.
 *
 * It also means PUBLISHING WORKS ON `astro dev` AT :4321, where no Netlify
 * function runs at all. That is the ordinary local loop for this project and a
 * feature that only works on :8888 is a feature nobody tests.
 */

import { db } from './account/client'
import { signedPlayerUrl } from './account/images'
import { photoPaths } from './account/squad'
import {
  IDENTITY_ALL,
  stripIdentity,
  type IdentityParts,
  type System,
} from './schema'

export const POST_TITLE_MAX = 120
export const POST_SUMMARY_MAX = 280

/** A post is one of two things. There is no private post — see supabase/024. */
export type PostVisibility = 'unlisted' | 'public'

/**
 * The bucket published pictures live in, and the ONLY world-readable place a
 * player's face may ever be. See supabase/024 §5 for why it is its own bucket
 * and not a folder inside `crests`.
 */
const PUBLISHED_BUCKET = 'published'

/** Crockford base32, minus i, l, o and u. Same alphabet as `share.mts`. */
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'
const ID_LENGTH = 7

function newPostId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export interface Post {
  id: string
  owner: string
  title: string
  summary: string
  visibility: PostVisibility
  forkedFrom: string
  doc: System
  publishedAt: string
  viewCount: number
  forkCount: number
  saveCount: number
}

/** What the portal lists. The document is the expensive part and is left out. */
export interface PostCard {
  id: string
  title: string
  summary: string
  visibility: PostVisibility
  publishedAt: string
  viewCount: number
  forkCount: number
}

export interface PublishOptions {
  title: string
  summary: string
  visibility: PostVisibility
  /**
   * Which parts of the coach's identity travel with the document.
   *
   * NO DEFAULT IS SUPPLIED FOR THIS ANYWHERE IN THIS FILE, deliberately. The
   * dialog decides it and the coach sees what they decided; a default buried in
   * a module is how a face ends up published by a caller that did not know the
   * parameter existed.
   */
  identity: IdentityParts
  /** The post this was forked from, if any. Permanent attribution (§5b). */
  forkedFrom?: string
}

export interface PublishResult {
  id: string
  url: string
  /**
   * How many photographs were asked for and could not be copied.
   *
   * NOT AN ERROR, AND NOT SILENT EITHER. A player whose photo has since been
   * deleted, or a signed URL that would not fetch, must not take the whole
   * publish down — the board simply draws that counter without a face, which is
   * what it does everywhere else in the studio. But the coach ticked a box
   * asking for faces, so the dialog says how many did not make it rather than
   * letting them find out from a stranger.
   */
  facesMissed: number
}

export interface PublishFault {
  fault: string
}

function isFault<T extends object>(r: T | PublishFault): r is PublishFault {
  return 'fault' in r
}

export { isFault }

/**
 * Publish a system. The document is stripped BEFORE it is sent, never after.
 *
 * ── THE ORDER OF THE THREE WRITES IS THE SAFETY, NOT AN IMPLEMENTATION NOTE ──
 *
 *   1. Reserve the row at the QUIETER visibility, carrying the stripped
 *      document with no photographs in it.
 *   2. Copy any photographs the coach asked for into the public bucket and
 *      patch them onto the row.
 *   3. Only then set the visibility they actually chose.
 *
 * Written in that order because every way it can fail leaves a post that is
 * less exposed than the coach asked for, never more. A crash between 1 and 2 is
 * an unlisted post with no faces; between 2 and 3, an unlisted post that is
 * complete. The reverse order would put a public row on the feed and then try
 * to finish it, and the failure mode there is a published board of children's
 * faces that nobody chose to publish.
 *
 * It also gives the photographs somewhere to go: the storage path contains the
 * post id, so the id has to exist before the first upload.
 */
export async function publishPost(
  system: System,
  opts: PublishOptions,
  owner: string,
): Promise<PublishResult | PublishFault> {
  const supabase = db()
  if (!supabase || !owner) return { fault: 'You need to be signed in to publish.' }

  const title = opts.title.trim().slice(0, POST_TITLE_MAX)
  if (!title) return { fault: 'Give it a title. It is what people read first.' }

  // The document as it will be READ, computed here and not trusted to the
  // caller. `stripIdentity` keeps `playerId` when a whole player travels, which
  // is right for a board handed back to the studio and wrong for a snapshot: it
  // is a key into `studio_squad`, which is own-row, so no reader of a published
  // post could ever follow it. It goes, always.
  const stripped = scrubForPublishing(stripIdentity(system, opts.identity))

  // Step 1, minus the faces. `photoPaths` reads the STRIPPED document, so a
  // publish without faces has nothing here to begin with.
  const wanted = opts.identity.faces ? photoPaths(stripped) : []
  const reserved = await reserve(withoutPhotos(stripped), title, opts, owner)
  if (isFault(reserved)) return reserved
  const id = reserved.id

  // Step 2.
  let facesMissed = 0
  if (wanted.length) {
    const moved = await republishPhotos(wanted, owner, id)
    facesMissed = wanted.length - Object.keys(moved).length
    const withFaces = repointPhotos(stripped, moved)
    const { error } = await supabase
      .from('studio_posts')
      .update({ doc: withFaces })
      .eq('id', id)
      .eq('owner', owner)
    // A failed patch leaves the faceless document from step 1 in place, which
    // is a complete and correct post. Say nothing rather than fail; the count
    // below already tells the coach the faces are not there.
    if (error) facesMissed = wanted.length
  }

  // Step 3.
  if (opts.visibility === 'public') {
    const { error } = await supabase
      .from('studio_posts')
      .update({ visibility: 'public' })
      .eq('id', id)
      .eq('owner', owner)
    if (error) {
      return {
        fault: 'It saved, but it could not be made public. It is on your shelf as a link-only post.',
      }
    }
  }

  return { id, url: postUrl(id, window.location.origin), facesMissed }
}

/**
 * Take the id, with one retry for the astronomically unlikely collision.
 *
 * Seven Crockford characters is 32^7, and the check that matters is the primary
 * key rather than the arithmetic: a duplicate comes back as 23505 and the
 * second attempt is a different id. `share.mts` does the same and for the same
 * reason.
 */
async function reserve(
  doc: System,
  title: string,
  opts: PublishOptions,
  owner: string,
): Promise<{ id: string } | PublishFault> {
  const supabase = db()
  if (!supabase) return { fault: 'You need to be signed in to publish.' }

  for (let attempt = 0; attempt < 4; attempt++) {
    const id = newPostId()
    const { error } = await supabase.from('studio_posts').insert({
      id,
      owner,
      doc,
      title,
      summary: opts.summary.trim().slice(0, POST_SUMMARY_MAX) || null,
      // ALWAYS the quieter one here, whatever was asked for. Step 3 raises it.
      visibility: 'unlisted',
      forked_from: opts.forkedFrom || null,
    })
    if (!error) return { id }
    if (error.code !== '23505') {
      return { fault: 'That did not save. Check your connection and try again.' }
    }
  }
  return { fault: 'That did not save. Try again.' }
}

/**
 * Everything a published snapshot has no business carrying.
 *
 * `playerId` — a key into an own-row table, useless to every reader of a post.
 * `shareId` — the address of a DIFFERENT published thing, and a post that
 * carried it would hand a stranger the coach's share link along with the board.
 */
function scrubForPublishing(system: System): System {
  const { shareId: _shareId, ...rest } = system as System & { shareId?: string }
  return {
    ...rest,
    acts: rest.acts.map((act) => ({
      ...act,
      tokens: act.tokens.map((t) => (t.playerId ? { ...t, playerId: undefined } : t)),
    })),
  } as System
}

function withoutPhotos(system: System): System {
  return {
    ...system,
    acts: system.acts.map((act) => ({
      ...act,
      tokens: act.tokens.map((t) => (t.photo ? { ...t, photo: undefined } : t)),
    })),
  }
}

function repointPhotos(system: System, moved: Record<string, string>): System {
  return {
    ...system,
    acts: system.acts.map((act) => ({
      ...act,
      tokens: act.tokens.map((t) =>
        t.photo ? { ...t, photo: moved[t.photo] || undefined } : t,
      ),
    })),
  }
}

/**
 * Copy chosen photographs out of the private bucket into the public one.
 *
 * ── THIS IS THE ONE PLACE A PRIVATE FACE BECOMES A PUBLIC ONE ────────────────
 *
 * supabase/013 put player photographs in a bucket with no anon read for a
 * stated reason: a squad is very often children, and a world-readable bucket is
 * a directory of them. Nothing about that has changed. What 024 added is a
 * SECOND bucket, for files a coach has deliberately published, and this
 * function is the only crossing between them.
 *
 * A copy rather than a re-point, and it has to be:
 *
 *   · The private object stays where it is, so the coach's own squad list is
 *     untouched and taking the post down does not blank a face on their board.
 *   · A signed URL expires within the hour, so a published document that merely
 *     referenced one would be a board of broken images by teatime.
 *   · The published copy is addressed under the POST id, so a takedown is one
 *     prefix and cannot reach anything else the coach owns.
 *
 * A photograph that will not fetch is left out of the result. The caller counts
 * the difference and tells the coach; the board draws that counter without a
 * face, exactly as it does for a signed URL that has expired.
 */
async function republishPhotos(
  paths: string[],
  owner: string,
  postId: string,
): Promise<Record<string, string>> {
  const supabase = db()
  const out: Record<string, string> = {}
  if (!supabase) return out

  await Promise.all(
    paths.map(async (path, i) => {
      try {
        const signed = await signedPlayerUrl(path, 300)
        if (!signed) return
        const res = await fetch(signed)
        if (!res.ok) return
        const blob = await res.blob()

        // The extension comes off the SOURCE path, not off the blob's type: the
        // bucket's allowed_mime_types and the extension have to agree, and the
        // private object was written by `uploadImage`, which already settled
        // both. Anything unrecognised is not published rather than guessed at.
        const ext = (path.match(/\.(png|jpg|jpeg|webp)$/i)?.[1] ?? '').toLowerCase()
        if (!ext) return

        const target = `${owner}/${postId}/${i}.${ext}`
        const { error } = await supabase.storage
          .from(PUBLISHED_BUCKET)
          .upload(target, blob, { upsert: true, contentType: blob.type, cacheControl: '3600' })
        if (!error) out[path] = target
      } catch {
        // A face that could not be copied is a face the post does without.
      }
    }),
  )

  return out
}

/**
 * Storage path → drawable URL, for a published document.
 *
 * `Board` takes `photoHrefs` keyed by storage path; the studio fills that map
 * with SIGNED urls from the private bucket (`useSquadPhotos`), and a post fills
 * it with public ones from `published`. Same map, different bucket, which is
 * why the post page must never reuse the studio's hook: a stranger has no
 * session to sign anything with, and every face would be missing.
 *
 * No request is made — `getPublicUrl` composes a string — so this is cheap
 * enough to call on every render.
 */
export function publishedPhotoUrls(system: System): Record<string, string> {
  const supabase = db()
  const out: Record<string, string> = {}
  if (!supabase) return out
  for (const path of photoPaths(system)) {
    out[path] = supabase.storage.from(PUBLISHED_BUCKET).getPublicUrl(path).data.publicUrl
  }
  return out
}

/**
 * One post by id, for the page at /p/<id>.
 *
 * Through `studio_post_by_id` (024), not through the table, because an unlisted
 * post is invisible to the table policy on purpose. See the header of that
 * migration for why the keyhole is a function rather than a wider policy.
 *
 * Runs on the ANON key: a post has to open for somebody who has never heard of
 * us, which is most of the people a link is sent to.
 */
export async function loadPost(id: string): Promise<Post | null> {
  const supabase = db()
  if (!supabase || !id) return null

  const { data, error } = await supabase.rpc('studio_post_by_id', { want: id })
  if (error || !Array.isArray(data) || data.length === 0) return null

  const row = data[0] as Record<string, unknown>
  const str = (k: string) => (row[k] as string | null) ?? ''
  const num = (k: string) => (typeof row[k] === 'number' ? (row[k] as number) : 0)

  return {
    id: str('id'),
    owner: str('owner'),
    title: str('title'),
    summary: str('summary'),
    // Anything unrecognised reads as the quieter of the two, the same rule
    // `loadProfile` follows for a visibility it has never seen.
    visibility: row.visibility === 'public' ? 'public' : 'unlisted',
    forkedFrom: str('forked_from'),
    doc: row.doc as System,
    publishedAt: str('published_at'),
    viewCount: num('view_count'),
    forkCount: num('fork_count'),
    saveCount: num('save_count'),
  }
}

/**
 * Everything this coach has published, newest first.
 *
 * NAMES ITS OWNER even though `studio_posts_own` would narrow it anyway. That
 * is the rule 017 paid for: a query that leans on RLS for its meaning silently
 * changes meaning the day a second policy lands beside it — and there IS a
 * second policy on this table, `studio_posts_public_read`, so without the
 * filter this would return the whole feed the moment anybody publishes.
 */
export async function listMyPosts(owner: string): Promise<PostCard[]> {
  const supabase = db()
  if (!supabase || !owner) return []

  const { data, error } = await supabase
    .from('studio_posts')
    .select('id, title, summary, visibility, published_at, view_count, fork_count')
    .eq('owner', owner)
    .order('published_at', { ascending: false })

  if (error || !data) return []
  return data.map(toCard)
}

/**
 * The feed: published posts, newest first.
 *
 * NO `.eq('visibility', 'public')`, and this is the one place in the project
 * where leaning on the policy is correct rather than dangerous — because the
 * policy on this table IS 'public' only, and unlisted posts are reachable only
 * through the keyhole function. That is the whole reason 024 was built that
 * way: the feed cannot leak an unlisted post even if this query is wrong.
 */
export async function listFeed(limit = 30): Promise<PostCard[]> {
  const supabase = db()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('studio_posts')
    .select('id, title, summary, visibility, published_at, view_count, fork_count')
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data.map(toCard)
}

function toCard(row: Record<string, unknown>): PostCard {
  return {
    id: (row.id as string) ?? '',
    title: (row.title as string) ?? '',
    summary: (row.summary as string) ?? '',
    visibility: row.visibility === 'public' ? 'public' : 'unlisted',
    publishedAt: (row.published_at as string) ?? '',
    viewCount: typeof row.view_count === 'number' ? row.view_count : 0,
    forkCount: typeof row.fork_count === 'number' ? row.fork_count : 0,
  }
}

/** Change the title, the summary or the visibility of a post already up. */
export async function updatePost(
  id: string,
  owner: string,
  patch: { title?: string; summary?: string; visibility?: PostVisibility },
): Promise<boolean> {
  const supabase = db()
  if (!supabase || !id || !owner) return false

  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.title = patch.title.trim().slice(0, POST_TITLE_MAX)
  if (patch.summary !== undefined) {
    body.summary = patch.summary.trim().slice(0, POST_SUMMARY_MAX) || null
  }
  if (patch.visibility !== undefined) {
    body.visibility = patch.visibility === 'public' ? 'public' : 'unlisted'
  }
  if (!Object.keys(body).length) return true

  const { error } = await supabase.from('studio_posts').update(body).eq('id', id).eq('owner', owner)
  return !error
}

/**
 * Take a post down: the pictures first, then the row.
 *
 * THAT ORDER IS THE ONE THAT FAILS SAFELY, and it is the opposite of the order
 * `removeImage` argues for elsewhere in the project. There, a stray object is
 * merely wasted bytes. Here the objects are published faces, so the intolerable
 * half-finish is a deleted row with world-readable photographs still sitting in
 * the bucket and nothing left pointing at them to say whose they were.
 *
 * The listing is scoped to `<owner>/<post id>/`, which the storage policies
 * (024 §5) also pin, so a bug in the prefix deletes nothing rather than
 * something else.
 */
export async function unpublishPost(id: string, owner: string): Promise<boolean> {
  const supabase = db()
  if (!supabase || !id || !owner) return false

  const folder = `${owner}/${id}`
  const { data: files } = await supabase.storage.from(PUBLISHED_BUCKET).list(folder)
  if (files && files.length) {
    await supabase.storage.from(PUBLISHED_BUCKET).remove(files.map((f) => `${folder}/${f.name}`))
  }

  const { error } = await supabase.from('studio_posts').delete().eq('id', id).eq('owner', owner)
  return !error
}

/**
 * The post id in a URL. `/p/k7f3q9`.
 *
 * `?p=` is the same DEV AFFORDANCE `handleFromPath` and `templateIdFromUrl`
 * keep, and it matters more here than it did for either: the `/p/*` rewrite is
 * applied by `netlify dev` on :8888 and NOT by `astro dev` on :4321, which is
 * where this project is built. Without it the page cannot be opened at all in
 * the ordinary loop. Nothing links to it and it is not what anybody shares.
 */
export function postIdFromPath(pathname: string, search = ''): string | null {
  const m = pathname.replace(/\/+$/, '').match(/^\/p\/([^/]+)$/)
  const id = m ? m[1] : new URLSearchParams(search).get('p')
  if (!id) return null
  const clean = id.toLowerCase()
  return /^[0-9a-hjkmnp-tv-z]{6,16}$/.test(clean) ? clean : null
}

export function postUrl(id: string, origin: string): string {
  return `${origin}/p/${id}`
}

/**
 * A title suggested from the document, so the dialog opens with something in it.
 *
 * The system's own name if it has one. Never invented from the tactics: a
 * generated title that reads like a claim about the football ("High press,
 * 4-3-3") would be our words under the coach's name.
 */
export function suggestedTitle(system: System): string {
  const named = (system.title || '').trim()
  return named.slice(0, POST_TITLE_MAX)
}

/**
 * What the publish dialog starts with, given the coach's account default.
 *
 * `showIdentity` is the account-wide answer to "does my name travel with my
 * work" (supabase/017). It sets the coach and the crest, because those are the
 * two things it has always covered.
 *
 * FACES ARE OFF EVEN WHEN IT IS ON, and that is not an inconsistency. That
 * switch has never governed a photograph — it could not, because no shared
 * board has ever carried one. Publishing a face is a new power and it starts
 * off, every time, for every coach.
 */
export function defaultIdentity(showIdentity: boolean): IdentityParts {
  return {
    coach: showIdentity,
    crest: showIdentity,
    names: showIdentity,
    faces: false,
  }
}

export { IDENTITY_ALL }
