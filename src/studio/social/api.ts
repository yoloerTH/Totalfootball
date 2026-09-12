/**
 * Reading and writing the network: the feed, reactions, comments, reposts and
 * the report button.
 *
 * ── EVERY READ IS A FUNCTION CALL AND EVERY WRITE IS A TABLE WRITE ───────────
 *
 * That split is the whole architecture and it is worth stating once here rather
 * than deducing it five times below.
 *
 * READS go through the security-definer functions in supabase/025, because a
 * card needs a post, its author, its counters AND the caller's own reaction —
 * four tables — and doing that from the browser is either four round trips per
 * card or a join the anon key is not allowed to make. One function, one row per
 * card, and the visibility rules live in the database where a forgotten filter
 * cannot undo them (the lesson supabase/017 paid for).
 *
 * WRITES go straight to the tables under the coach's own session, because RLS
 * is a better guard than any function we would write: `studio_reactions_own`
 * pins the owner AND requires the post to be public, so a reaction on a post
 * somebody guessed the id of is refused by the database rather than by us.
 *
 * ── NOTHING HERE THROWS ──────────────────────────────────────────────────────
 *
 * A feed that fails to load shows an empty feed; a reaction that fails to save
 * comes back false and the button returns to where it was. The same house rule
 * as ../account/cloud.ts. A social surface is the last place a coach should
 * meet a stack trace.
 */

import { db } from '../account/client'
import type { System } from '../schema'

export type FeedMode = 'featured' | 'recent'

/** One card, whole. Everything on the screen comes from one row of `studio_feed`. */
export interface FeedPost {
  id: string
  title: string
  summary: string
  /** 'image' — a still of `coverAct`. 'video' — the board plays. */
  media: 'image' | 'video'
  coverAct: number
  doc: System
  publishedAt: string
  reactionCount: number
  commentCount: number
  repostCount: number
  forkCount: number
  /** Per-kind counts, keyed by reaction id. Empty when nobody has reacted. */
  kinds: Record<string, number>
  owner: string
  /** The author, when their profile is public. Empty when it is not. */
  handle: string
  presenter: string
  team: string
  role: string
  licence: string
  avatarPath: string
  crestPath: string
  /** The reading coach's own reaction, or '' — straight off the feed row. */
  mine: string
  /**
   * One of ours: a system that went out as a Total Football video.
   *
   * Set only by scripts/publish-official.mjs under the service role, and
   * defended by a trigger in supabase/032 — a coach cannot award it to their
   * own post. The card draws the Total Football mark instead of an avatar for
   * these, which is why it has to be a fact and not a convention about who owns
   * the row.
   */
  official: boolean
}

function toPost(row: Record<string, unknown>): FeedPost {
  const str = (k: string) => (row[k] as string | null) ?? ''
  const num = (k: string) => (typeof row[k] === 'number' ? (row[k] as number) : 0)
  return {
    id: str('id'),
    title: str('title'),
    summary: str('summary'),
    media: row.media === 'video' ? 'video' : 'image',
    coverAct: num('cover_act'),
    doc: row.doc as System,
    publishedAt: str('published_at'),
    reactionCount: num('reaction_count'),
    commentCount: num('comment_count'),
    repostCount: num('repost_count'),
    forkCount: num('fork_count'),
    kinds: (row.kinds && typeof row.kinds === 'object' ? row.kinds : {}) as Record<string, number>,
    owner: str('owner'),
    handle: str('handle'),
    presenter: str('presenter'),
    team: str('team'),
    role: str('role'),
    licence: str('licence'),
    avatarPath: str('avatar_path'),
    crestPath: str('crest_path'),
    mine: str('mine'),
    official: row.official === true,
  }
}

/**
 * The feed, ranked or dated.
 *
 * `featured` is arithmetic, not an editor's shelf — see supabase/025 §8 for the
 * formula and for why every public post scores above zero, which is what stops
 * the tab ever being empty while the network is small.
 */
export async function loadFeed(mode: FeedMode, limit = 24, offset = 0): Promise<FeedPost[]> {
  const supabase = db()
  if (!supabase) return []
  const { data, error } = await supabase.rpc('studio_feed', {
    want_mode: mode,
    want_limit: limit,
    want_offset: offset,
  })
  if (error || !Array.isArray(data)) return []
  return data.map(toPost)
}

/** Everything one coach has published. Public posts only, whoever is asking. */
export async function loadPostsByHandle(handle: string, limit = 24): Promise<FeedPost[]> {
  const supabase = db()
  if (!supabase || !handle) return []
  const { data, error } = await supabase.rpc('studio_posts_by_handle', {
    want: handle,
    want_limit: limit,
  })
  if (error || !Array.isArray(data)) return []
  return data.map(toPost)
}

// ── reactions ────────────────────────────────────────────────────────────────

/**
 * Set, change or clear this coach's reaction. `kind: ''` clears it.
 *
 * ONE ROW PER PERSON PER POST, upserted. A coach who taps Golazo and then
 * Masterclass has changed their mind, not reacted twice, and the primary key in
 * supabase/025 makes that the only representable outcome.
 */
export async function react(post: string, owner: string, kind: string): Promise<boolean> {
  const supabase = db()
  if (!supabase || !post || !owner) return false

  if (!kind) {
    const { error } = await supabase
      .from('studio_reactions')
      .delete()
      .eq('post', post)
      .eq('owner', owner)
    return !error
  }

  const { error } = await supabase
    .from('studio_reactions')
    .upsert({ post, owner, kind }, { onConflict: 'post,owner' })
  return !error
}

/**
 * The reaction breakdown for ONE post, and the reader's own.
 *
 * The feed gets this aggregated in `studio_feed`, because doing it per card
 * would be a query per card. A single post page is the opposite case: one page,
 * one post, and the rows are readable through `studio_reactions_read` — so it
 * reads the table and counts in the browser rather than growing another
 * function that would have to be kept in step with the first.
 */
export async function loadReactions(
  post: string,
  owner: string,
): Promise<{ kinds: Record<string, number>; mine: string }> {
  const supabase = db()
  const empty = { kinds: {} as Record<string, number>, mine: '' }
  if (!supabase || !post) return empty

  const { data, error } = await supabase.from('studio_reactions').select('kind, owner').eq('post', post)
  if (error || !data) return empty

  const kinds: Record<string, number> = {}
  let mine = ''
  for (const row of data as { kind: string; owner: string }[]) {
    kinds[row.kind] = (kinds[row.kind] ?? 0) + 1
    if (owner && row.owner === owner) mine = row.kind
  }
  return { kinds, mine }
}

// ── comments ─────────────────────────────────────────────────────────────────

export interface Comment {
  id: string
  body: string
  createdAt: string
  owner: string
  handle: string
  presenter: string
  avatarPath: string
  /**
   * A system of the commenter's own, offered as a rework of the one above.
   *
   * '' for an ordinary comment. When set it is a public `studio_posts` id owned
   * by the same coach — a trigger in supabase/032 refuses anything else, so a
   * reader can follow it without wondering whose work they are about to open.
   *
   * THE DOCUMENT IS NOT HERE. A thread with five variations would be a megabyte
   * of jsonb to draw five cards; the RPC returns the title and the length, and
   * `loadPost` fetches the board when the card is scrolled into view.
   */
  variation: string
  variationTitle: string
  variationPhases: number
  variationReactions: number
}

export async function loadComments(post: string): Promise<Comment[]> {
  const supabase = db()
  if (!supabase || !post) return []
  const { data, error } = await supabase.rpc('studio_post_comments', { want_post: post })
  if (error || !Array.isArray(data)) return []
  return (data as Record<string, unknown>[]).map((row) => ({
    id: (row.id as string) ?? '',
    body: (row.body as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
    owner: (row.owner as string) ?? '',
    handle: (row.handle as string) ?? '',
    presenter: (row.presenter as string) ?? '',
    avatarPath: (row.avatar_path as string) ?? '',
    variation: (row.variation as string) ?? '',
    variationTitle: (row.variation_title as string) ?? '',
    variationPhases: typeof row.variation_phases === 'number' ? row.variation_phases : 0,
    variationReactions:
      typeof row.variation_reactions === 'number' ? row.variation_reactions : 0,
  }))
}

/**
 * Write a comment, optionally offering one of your own systems with it.
 *
 * `variation` is a post id of the commenter's OWN public work. Everything that
 * could go wrong with it — somebody else's post, an unlisted one, one of ours —
 * is refused by a trigger in supabase/032 rather than here, so a caller that
 * forgets to check cannot produce a bad row.
 *
 * The RETURN IS NOT A BOOLEAN ANY MORE. It used to be, and a `false` covered
 * both "the network is down" and "you have no @handle yet", which are the same
 * word to the reader and completely different sentences to write in the UI. The
 * identity gate in 032 is a policy, so a coach without a handle gets a row-level
 * security error from PostgREST, and the composer needs to be able to say so.
 */
export type CommentResult = { ok: true } | { ok: false; fault: string; needsIdentity: boolean }

export async function addComment(
  post: string,
  owner: string,
  body: string,
  variation = '',
): Promise<CommentResult> {
  const supabase = db()
  const text = body.trim()
  if (!supabase || !post || !owner || !text) {
    return { ok: false, fault: 'Nothing to send.', needsIdentity: false }
  }
  const { error } = await supabase.from('studio_comments').insert({
    post,
    owner,
    body: text.slice(0, 1000),
    // Sent as null rather than '' so the foreign key is absent rather than
    // pointing at a post that cannot exist.
    variation: variation || null,
  })
  if (!error) return { ok: true }

  /*
   * 42501 is PostgREST's code for a row the policy refused. On this table there
   * is exactly one policy and two ways to fail it — no handle, or a post that is
   * not public — and the second cannot happen from a thread the reader is
   * looking at. So the identity gate is the honest reading.
   */
  const needsIdentity = error.code === '42501'
  return {
    ok: false,
    needsIdentity,
    fault: needsIdentity
      ? 'Pick an @handle and a name before you write under somebody else\u2019s system.'
      : 'That did not send. Try again in a moment.',
  }
}

/**
 * Remove a comment.
 *
 * NO OWNER FILTER, and this is the one place in the project where that is
 * correct rather than the bug 017 records. The policy allows two different
 * people to delete this row — its author, and the coach whose post it sits
 * under — so a `.eq('owner', me)` here would break moderation for the only
 * person with a reason to moderate at three in the morning.
 */
export async function removeComment(id: string): Promise<boolean> {
  const supabase = db()
  if (!supabase || !id) return false
  const { error } = await supabase.from('studio_comments').delete().eq('id', id)
  return !error
}

// ── reposts ──────────────────────────────────────────────────────────────────

/**
 * Put somebody else's system in front of your own readers, with a note.
 *
 * A repost is the strongest thing on the network short of a fork, which is why
 * it is weighted highest in the ranking: a reaction is an opinion about
 * somebody's work, a repost is your own name attached to it.
 *
 * Reposting your own post is refused by a trigger rather than by this function,
 * so a script cannot do what the button will not.
 */
export async function repost(post: string, owner: string, note: string): Promise<boolean> {
  const supabase = db()
  if (!supabase || !post || !owner) return false
  const { error } = await supabase
    .from('studio_reposts')
    .upsert(
      { post, owner, note: note.trim().slice(0, 280) || null },
      { onConflict: 'post,owner' },
    )
  return !error
}

export async function unrepost(post: string, owner: string): Promise<boolean> {
  const supabase = db()
  if (!supabase || !post || !owner) return false
  const { error } = await supabase
    .from('studio_reposts')
    .delete()
    .eq('post', post)
    .eq('owner', owner)
  return !error
}

/** Which of these posts this coach has already reposted. One query, not one per card. */
export async function myReposts(owner: string, posts: string[]): Promise<Set<string>> {
  const supabase = db()
  const out = new Set<string>()
  if (!supabase || !owner || posts.length === 0) return out
  const { data, error } = await supabase
    .from('studio_reposts')
    .select('post')
    .eq('owner', owner)
    .in('post', posts)
  if (error || !data) return out
  for (const row of data) out.add(row.post as string)
  return out
}

// ── reports ──────────────────────────────────────────────────────────────────

export const REPORT_REASONS = [
  { id: 'not_football', label: 'Nothing to do with football' },
  { id: 'abusive', label: 'Abusive or hateful' },
  { id: 'stolen', label: 'Somebody else’s work, passed off as theirs' },
  { id: 'private_person', label: 'Identifies a private person, or a child' },
  { id: 'spam', label: 'Spam or advertising' },
  { id: 'other', label: 'Something else' },
] as const

/**
 * File a report. Write-only, by design.
 *
 * `studio_reports` has an insert policy and no select policy for anybody, so a
 * report cannot be read back by the person who filed it, by the person it names,
 * or by any other coach — only by the service role. A readable reports table is
 * a harassment surface with extra steps.
 */
export async function report(
  kind: 'post' | 'comment',
  target: string,
  reporter: string,
  reason: string,
  note: string,
): Promise<boolean> {
  const supabase = db()
  if (!supabase || !target || !reporter || !reason) return false
  const { error } = await supabase
    .from('studio_reports')
    .insert({ kind, target, reporter, reason, note: note.trim().slice(0, 1000) || null })
  return !error
}
