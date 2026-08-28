/**
 * The coach's systems and profile, in Supabase.
 *
 * Every call here needs a signed-in user, and every one of them returns
 * something harmless when there is not — an empty list, a null, a false. None
 * of them throws. The rule from ../storage.ts still holds and matters more now
 * that there is a network in the path: **a coach must never lose work to a
 * failure they did not cause.** localStorage stays authoritative, this is the
 * sync target, and a dead connection has to degrade to "your work is on this
 * machine" rather than to an error page.
 *
 * RLS does the filtering, not these queries. There is no `.eq('owner', …)`
 * anywhere below, and adding one would be a false comfort: the policy in
 * supabase/005 already restricts every statement to the caller's own rows, and
 * a hand-written filter that agrees with it teaches the next reader that the
 * filter is what makes it safe.
 */

import { darken, readableText } from '../board/palette'
import type { System, TeamStyle } from '../schema'
import type { ProfileLink, Visibility } from './identity'
import { clearSystems, listSystems, migrate } from '../storage'
import { GUEST } from '../scope'
import { db } from './client'

export interface CloudSystem {
  id: string
  system: System
  /** ISO, from the database's own clock — see the trigger in 005. */
  updated: string
}

const TABLE = 'studio_systems'

/**
 * ── THE VERSION EACH SYSTEM WAS LOADED AT ────────────────────────────────────
 *
 * The account is the source of truth now, and this is what makes that
 * enforceable rather than merely intended. Every read records the row's
 * `updated_at`; every write sends it back, and supabase/016 refuses the write
 * if the row has moved on since.
 *
 * WHY IT IS NEEDED AT ALL, given the client reads the account first. Because
 * the browser still keeps an offline buffer, and a buffer that survives a
 * failed fetch can always come back carrying a document older than the one on
 * the server. Read order fixes the ordinary case; only a version token fixes
 * the case where the ordinary path did not run.
 *
 * In memory and NOT in localStorage, deliberately. A version that outlived the
 * page would let a browser claim to have seen a row it has not read this
 * session, which is the exact assertion the guard exists to disbelieve. Lost on
 * reload means the next save is refused once and the client re-reads, which is
 * the safe direction to fail in.
 */
const versions = new Map<string, string>()

/** Forget every version. Called on sign-out with everything else. */
export function forgetVersions(): void {
  versions.clear()
}

/**
 * This coach's systems, newest first.
 *
 * `null` — NOT `[]` — when the fetch failed, because the portal has to tell an
 * empty account from an unreachable server: one means "you have nothing yet"
 * and the other means "fall back to the buffer". They used to be the same
 * value and the portal had to guess.
 */
export async function listCloudSystems(owner: string): Promise<CloudSystem[] | null> {
  const supabase = db()
  if (!supabase || !owner) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, doc, updated_at')
    // ASK FOR YOUR OWN, RATHER THAN TRUSTING RLS TO MEAN THAT.
    //
    // RLS is still the boundary and this filter is not what makes it safe. It
    // is what stops the query CHANGING MEANING when a policy is added later:
    // `loadProfile` was written exactly like this, and the day supabase/012
    // gave studio_profiles a public read, "my profile" silently became "every
    // published profile" and the client broke in a way nobody could see. There
    // is no public policy on this table today. There was none on that one
    // either, once.
    .eq('owner', owner)
    .order('updated_at', { ascending: false })
  if (error || !data) return null
  return data.map((row) => {
    const id = row.id as string
    const updated = row.updated_at as string
    versions.set(id, updated)
    return { id, system: migrate(row.doc as System), updated }
  })
}

export async function loadCloudSystem(id: string, owner: string): Promise<System | null> {
  const supabase = db()
  if (!supabase || !owner) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('doc, updated_at')
    // The primary key in supabase/005 is (owner, id), so an id on its own does
    // not name a row. See `listCloudSystems` for why the filter is written out.
    .eq('owner', owner)
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  versions.set(id, data.updated_at as string)
  return migrate(data.doc as System)
}

/**
 * What happened to a write. Three outcomes, and they are not interchangeable.
 *
 * `failed` is "not yet" — offline, a 500, an expired token. The next edit
 * retries and nothing is said to the coach.
 *
 * `conflict` is the opposite: the request landed and the ANSWER was no. This
 * board is open somewhere newer, and retrying would either do nothing or, if we
 * were careless enough to drop the guard, destroy the newer copy. It has to
 * stop the uploads and it has to be visible.
 */
export type SaveResult = 'saved' | 'conflict' | 'failed'

/**
 * Write one system up, refusing to trample a newer copy.
 *
 * `owner` is no longer sent: supabase/016 takes it from `auth.uid()` inside the
 * transaction, which is one fewer thing a client can get wrong and removes the
 * last place a uuid was passed across the wire for a row it did not control.
 * The parameter is kept so call sites read the same and so the caller still has
 * to have a signed-in user to hand.
 *
 * ── ON A CONFLICT THIS DOES NOT "RESOLVE" ANYTHING ───────────────────────────
 *
 * It reports. A coach is mid-session; pulling the server's copy down over the
 * board in front of them would destroy the work they can see in order to save
 * the work they cannot. See ./sync.ts for what is shown instead.
 */
export async function saveCloudSystem(
  id: string,
  system: System,
  owner: string,
): Promise<SaveResult> {
  const supabase = db()
  if (!supabase || !owner) return 'failed'

  const { data, error } = await supabase.rpc('studio_systems_save', {
    p_id: id,
    p_doc: system,
    // Absent for a system this session has never read — a brand new board. The
    // function treats that as "insert if it does not exist, refuse if it does",
    // which is the safe reading of a client that cannot name a version.
    p_base: versions.get(id) ?? null,
  })
  if (error || !data) return 'failed'

  const result = data as { ok?: boolean; updated_at?: string }
  if (result.updated_at) versions.set(id, result.updated_at)
  return result.ok ? 'saved' : 'conflict'
}

export async function deleteCloudSystem(id: string, owner: string): Promise<boolean> {
  const supabase = db()
  if (!supabase || !owner) return false
  const { error } = await supabase.from(TABLE).delete().eq('owner', owner).eq('id', id)
  return !error
}

/**
 * Move whatever is in this browser's localStorage into the coach's account.
 *
 * THIS IS THE MOST IMPORTANT FUNCTION IN THE FILE. The studio is usable without
 * an account on purpose, so the ordinary path is: a coach builds something,
 * likes it, and only then signs up. If signing up is the moment their work
 * disappears, the entire adoption-first plan is worse than a login wall would
 * have been — at least a wall is honest about it up front.
 *
 * `ignoreDuplicates` is the whole safety argument. Signing in on a second
 * machine must not let that machine's stale local copies overwrite the cloud
 * ones; an id that already exists in the account is left exactly as it is.
 * Local ids are preserved rather than reissued, which is what the composite
 * primary key in 005 is for.
 *
 * ── IT READS THE GUEST SCOPE, AND ONLY THE GUEST SCOPE ───────────────────────
 *
 * THIS IS THE FUNCTION THAT LEAKED. It used to call a bare `listSystems()`,
 * which read one browser-global key that every account shared. So a second
 * coach signing in on a machine the first had used found the first one's boards
 * sitting in "their" local store — and the `select('id')` above is RLS-filtered
 * to the NEW owner, so every one of those boards came back as unknown and was
 * upserted into an account that had nothing to do with them, credit line, club
 * and kit colours included (user, 2026-08-27).
 *
 * A claim is now a statement about ownerless work, so it names the scope that
 * holds ownerless work. Signing in cannot reach another account's namespace,
 * because it does not ask for it.
 *
 * ── AND IT RETIRES THE SCOPE IT CLAIMED ──────────────────────────────────────
 *
 * Cleared on success, including the no-op case where everything was already
 * known. Guest work left in place is work the NEXT account to sign in on this
 * browser would claim in turn, which is the same leak wearing a different hat.
 * The cloud copy is authoritative from here and ../editor/StudioMount.tsx falls
 * through to it, so nothing is lost by letting the local guest copy go.
 *
 * Returns how many were newly claimed, so the portal can say so once.
 */
export async function claimLocalSystems(owner: string): Promise<number> {
  const supabase = db()
  if (!supabase) return 0

  const local = listSystems(GUEST)
  if (local.length === 0) return 0

  const { data: existing, error: readError } = await supabase
    .from(TABLE)
    .select('id')
    .eq('owner', owner)
  // A failed read must not be mistaken for an empty account: claiming against
  // an empty `known` set is safe (ignoreDuplicates), but CLEARING the guest
  // scope on the back of a request that never landed is not.
  if (readError) return 0

  const known = new Set((existing ?? []).map((r) => r.id as string))
  const fresh = local.filter((l) => !known.has(l.id))
  if (fresh.length === 0) {
    clearSystems(GUEST)
    return 0
  }

  const { error } = await supabase
    .from(TABLE)
    .upsert(
      fresh.map((l) => ({ id: l.id, owner, doc: l.system })),
      { onConflict: 'owner,id', ignoreDuplicates: true },
    )
  if (error) return 0
  clearSystems(GUEST)
  return fresh.length
}

// ── the profile ──────────────────────────────────────────────────────────────

/**
 * Who a coach is, and what their boards look like.
 *
 * This started as the three fields the share dialog asks for. Phase 1 of
 * docs/SOCIAL.md added the rest: an optional public identity, and the kit a
 * coach works in. Two things about that are worth being precise on.
 *
 * **It still only supplies DEFAULTS.** `System.credit` and `System.teams` live
 * on each document, which is why a system shared last season keeps the club a
 * coach was at last season and the kit they wore then. `withProfile` fills a
 * blank board; it never edits one that already exists.
 *
 * **Every new field is optional and `visibility` starts private.** A coach who
 * never opens the new sections has a profile identical to the one they had
 * before, and nothing about them is visible to anybody. See supabase/012.
 *
 * Empty string is the "not set" value throughout rather than null, so the form
 * never has to hold `string | null` in an input's `value`. `saveProfile` turns
 * empties back into NULL on the way out.
 */
export interface Profile {
  presenter: string
  team: string
  /** Hex, the home counter fill. `deep` and the label colour are derived at render. */
  teamColour: string
  /** The public address, `/c/<handle>`. Empty until claimed, and claiming is optional. */
  handle: string
  bio: string
  role: string
  /** Object path in the `crests` bucket. Compose the URL with `imageUrl()`. */
  crestPath: string
  /**
   * The coach's own face, in the same bucket under a different name.
   *
   * A SEPARATE FIELD FROM THE CREST and not a replacement for it: a badge says
   * which club, a face says which person, and a profile that shows one in place
   * of the other answers the wrong question. Both are optional and neither
   * implies the other.
   */
  avatarPath: string
  /** Optional trim ring, for kits that need a second colour to read. */
  kitRing: string
  /** `KitPattern` — 'solid', 'stripes', 'hoops', 'halves' or 'sash'. */
  kitPattern: string
  /** The pattern's second colour. Ignored while the pattern is 'solid'. */
  kitAlt: string
  visibility: Visibility
  links: ProfileLink[]
  /** 
   * Explicit list of folders created by the user. 
   * This ensures folders persist even if they are empty, satisfying structural DB requirements.
   */
  folders: string[]
  /**
   * Whether the coach's name, club and squad travel with their work.
   *
   * A DEFAULT AND NOT A RULE. It is what each export, film and share link
   * starts set to; every one of the three dialogs can flip it for that one file
   * without coming back here. See `withoutIdentity` in ../schema.ts for exactly
   * what "identity" covers, and supabase/017 for why this defaults to ON when
   * `visibility` defaults to off.
   */
  showIdentity: boolean
}

export const EMPTY_PROFILE: Profile = {
  presenter: '',
  team: '',
  teamColour: '',
  handle: '',
  bio: '',
  role: '',
  crestPath: '',
  avatarPath: '',
  kitRing: '',
  kitPattern: 'solid',
  kitAlt: '',
  visibility: 'private',
  links: [],
  folders: [],
  // Signing your own work is the behaviour that shipped and the one the
  // watermark policy is built on. This field exists to let a coach say no.
  showIdentity: true,
}

const PROFILE_COLUMNS =
  'presenter, team, team_colour, handle, bio, role, crest_path, avatar_path, kit_ring, kit_pattern, kit_alt, visibility, links, folders, show_identity'

/**
 * What a read of the profile actually found. THREE ANSWERS, NOT TWO.
 *
 * ── WHY THIS IS NOT `Profile | null` ANY MORE ────────────────────────────────
 *
 * It was, and the conflation cost real data. `null` meant "you have no profile
 * yet" AND "the request failed", and ./Settings.tsx could not tell them apart,
 * so a failed read presented an empty form — and `saveProfile` sends a FULL
 * payload by design, so one press of Save on that form overwrites a good row
 * with blanks. A load that did not land must never become the baseline for a
 * write.
 *
 * The studio and the portal collapse 'none' and 'error' back together, because
 * for them the two really are the same: paint nothing extra, say nothing. It is
 * only the page that WRITES that has to know the difference.
 */
export type ProfileRead =
  | { kind: 'row'; profile: Profile }
  /** Signed in, asked, and this account has never saved one. Safe to write. */
  | { kind: 'none' }
  /** Could not ask, or was refused. NOT a baseline for a save. */
  | { kind: 'error' }

/**
 * This coach's profile. Filtered BY ID, and that filter is the whole fix.
 *
 * ── THE BUG IT CLOSES ────────────────────────────────────────────────────────
 *
 * This query used to be `.select(...).maybeSingle()` with no `.eq()`, leaning
 * on RLS to make "a profile" mean "my profile". RLS does not work that way:
 * policies are OR'd, and supabase/012 added a public read for every published
 * profile. So a signed-in coach's own row came back alongside every public one,
 * `.maybeSingle()` answered 406 PGRST116 — "The result contains 2 rows" — and
 * this function reported it as "no profile". The settings page emptied, the
 * studio stopped painting the coach's kit, and the share dialog asked for a
 * name it had been told twice (user, 2026-08-28).
 *
 * It got worse before it was found. While a second coach had no row of their
 * own, the ONE visible row was somebody else's public profile, so the settings
 * form loaded a stranger's identity and Save wrote it back under their own id.
 * supabase/017 is the layer under this one, and is the reason a client bug can
 * no longer put one account's crest path on another account's row.
 *
 * ── SO IT TAKES A uid, AND CALLERS MUST HAVE A SESSION ───────────────────────
 *
 * A parameter rather than a `getUser()` inside, deliberately: it forces every
 * call site to be reached from `useSession()`, which is the gating that was
 * missing. A read fired before the session is restored is an anonymous read,
 * and an anonymous read of this table returns other people's public rows.
 */
export async function loadProfile(uid: string): Promise<ProfileRead> {
  const supabase = db()
  if (!supabase || !uid) return { kind: 'error' }
  const { data, error } = await supabase
    .from('studio_profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', uid)
    .maybeSingle()
  if (error) return { kind: 'error' }
  if (!data) return { kind: 'none' }

  const row = data as Record<string, unknown>
  const str = (k: string) => (row[k] as string | null) ?? ''

  const profile: Profile = {
    presenter: str('presenter'),
    team: str('team'),
    teamColour: str('team_colour'),
    handle: str('handle'),
    bio: str('bio'),
    role: str('role'),
    crestPath: str('crest_path'),
    avatarPath: str('avatar_path'),
    kitRing: str('kit_ring'),
    // Empty reads as plain. A row written before 013, or by a future build this
    // one has not seen, is a plain shirt rather than an unrenderable one.
    kitPattern: str('kit_pattern') || 'solid',
    kitAlt: str('kit_alt'),
    // Anything but the two known values is read as private. A row written by a
    // future migration this build has not seen must fail CLOSED.
    visibility: row.visibility === 'public' ? 'public' : 'private',
    // jsonb comes back parsed. Filtered rather than trusted, because the column
    // only guarantees the SHAPE of the array, not what is in each entry.
    links: Array.isArray(row.links)
      ? (row.links as ProfileLink[])
          .filter((l) => l && typeof l.label === 'string' && typeof l.url === 'string')
          .slice(0, 5)
      : [],
    folders: Array.isArray(row.folders)
      ? (row.folders as string[]).filter((f) => typeof f === 'string')
      : [],
    // Absent on a row written before supabase/017, which is every existing row.
    // Missing must read as ON: the column's default is true and so is the
    // behaviour that shipped, and a coach whose name quietly vanished from
    // their exports on deploy day would have no idea what to look for.
    showIdentity: row.show_identity !== false,
  }

  return { kind: 'row', profile }
}

/**
 * The profile with every kit colour stripped, credit left alone.
 *
 * For starting from a TEMPLATE. A template is already painted — its kits are
 * part of what it is teaching — so repainting it in the coach's colours is
 * wrong, while signing it with their name is right.
 *
 * This exists as a named function rather than as `{ ...profile, teamColour: '' }`
 * at the call site because that spelling only blanked the one kit field that
 * existed when it was written, and quietly stopped being correct the moment a
 * second one was added.
 */
export function creditOnly(profile: Profile): Profile {
  return { ...profile, teamColour: '', kitRing: '', kitPattern: 'solid', kitAlt: '' }
}

/**
 * Start a new system from what the coach has already told us about themselves.
 *
 * The point of the settings page: a signed-in coach's first board is already in
 * their colours and already signed, so the share dialog is one press instead of
 * three fields. `deep` and the label colour are DERIVED rather than stored — the
 * same two functions the board uses at render time, so a kit colour cannot mean
 * one thing here and another on the pitch.
 *
 * Each half is applied only when the coach has actually set it, so a profile
 * with a home kit and no away kit repaints one team and leaves the other at the
 * house colours. Only fills what is empty; it never edits a document.
 */
export function withProfile(system: System, profile: Profile): System {
  const presenter = profile.presenter.trim()
  const team = profile.team.trim()
  const colour = profile.teamColour.trim()
  const ring = profile.kitRing.trim()
  const alt = profile.kitAlt.trim()
  const pattern = profile.kitPattern.trim()
  // A pattern is only a pattern once it has a second colour; without one there
  // is nothing to draw and `Token.tsx` would fall back to a plain shirt anyway.
  const patterned = pattern && pattern !== 'solid' && alt

  let teams = system.teams

  if (colour) {
    teams = {
      ...teams,
      us: {
        ...teams.us,
        name: team || teams.us.name,
        base: colour,
        deep: darken(colour),
        text: readableText(colour),
        // Undefined rather than '' when unset: `Token.tsx` draws the ring if the
        // property is present at all, so an empty string is a stroke of nothing.
        ring: ring || undefined,
        pattern: patterned ? (pattern as TeamStyle['pattern']) : undefined,
        alt: patterned ? alt : undefined,
      },
    }
  }

  // THE OPPOSITION IS NOT REPAINTED, and that is a decision rather than an
  // omission. A coach owns one kit; the other team is whoever they are playing
  // this week, and asking somebody to keep a setting up to date with next
  // Saturday's fixture is asking them to maintain a field that is wrong most of
  // the time. `teams.them` keeps the house colours unless the system itself
  // says otherwise, which is where an actual opponent belongs.
  //
  // `opponent_colour` still exists on the table (supabase/012) and is dormant.
  // Nothing reads it and nothing writes it. It was never shipped, so no row
  // holds a value; if the away kit is ever wanted back it is a column away.

  return {
    ...system,
    teams,
    credit:
      presenter || team
        ? { ...system.credit, presenter: presenter || undefined, team: team || undefined }
        : system.credit,
  }
}

/**
 * Write the profile up. Returns whether it landed.
 *
 * A FULL payload every time, not a patch. PostgREST's upsert updates exactly the
 * columns present in the body, so sending a subset would silently leave the rest
 * at whatever they were — which is indistinguishable from a successful save
 * right up until the coach reloads and finds a field they cleared has come back.
 */
export async function saveProfile(profile: Profile, id: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false

  // Empty strings go up as NULL: the columns are nullable and "not set yet" is a
  // real state the credit bar and the public policy both read, distinct from
  // "set to nothing".
  const nil = (s: string) => (s.trim() ? s.trim() : null)

  const { error } = await supabase.from('studio_profiles').upsert(
    {
      id,
      presenter: nil(profile.presenter),
      team: nil(profile.team),
      team_colour: nil(profile.teamColour),
      handle: nil(profile.handle),
      bio: nil(profile.bio),
      role: nil(profile.role),
      crest_path: nil(profile.crestPath),
      avatar_path: nil(profile.avatarPath),
      kit_ring: nil(profile.kitRing),
      kit_pattern: nil(profile.kitPattern),
      kit_alt: nil(profile.kitAlt),
      // NOT nullable and NOT nil()'d. The column is `not null default 'private'`
      // and this is the one field where "unset" must never reach the database as
      // an absence the default might fill in differently later.
      visibility: profile.visibility === 'public' ? 'public' : 'private',
      links: profile.links.filter((l) => l.label.trim() && l.url.trim()).slice(0, 5),
      folders: profile.folders.map(f => f.trim()).filter(Boolean),
      // `not null default true`, and read back the same way: a boolean has no
      // "unset" worth preserving, so it goes up as itself every time.
      show_identity: profile.showIdentity !== false,
    },
    { onConflict: 'id' },
  )
  return !error
}

/**
 * Whether a handle is free, asked while the coach is still typing.
 *
 * Reads through the PUBLIC policy in supabase/012, which only exposes profiles
 * that are public AND have a handle. So this answers "is it taken by somebody
 * who has published a profile", not "does the string exist in the table" — a
 * private profile holding the handle is invisible here and the unique index is
 * what actually refuses the write.
 *
 * That is the correct trade and not a bug to fix later: the alternative is an
 * endpoint that confirms the existence of accounts that have chosen not to be
 * seen. A rare "that one is taken" at save time is a much smaller cost.
 */
export async function handleTaken(handle: string, self: string): Promise<boolean> {
  const supabase = db()
  if (!supabase || !handle) return false
  const { data, error } = await supabase
    .from('studio_profiles')
    .select('id')
    .eq('handle', handle)
    .maybeSingle()
  if (error || !data) return false
  return (data.id as string) !== self
}

// ── somebody else's profile ──────────────────────────────────────────────────

/**
 * What a visitor sees. A strict SUBSET of `Profile`.
 *
 * Spelled out as its own type rather than reusing `Profile` so that adding a
 * field to the settings form does not silently publish it. If a value is to be
 * shown to strangers it has to be named here, on purpose, by somebody who
 * thought about it. `visibility` is deliberately absent: by the time a row is
 * readable through the public policy the answer is already 'public'.
 */
export interface PublicProfile {
  handle: string
  presenter: string
  team: string
  role: string
  bio: string
  crestPath: string
  avatarPath: string
  teamColour: string
  kitRing: string
  kitPattern: string
  kitAlt: string
  links: ProfileLink[]
}

/**
 * Fetch a public profile by handle. `null` for anything that is not one.
 *
 * NO `.eq('visibility', 'public')` HERE, and that is not an oversight — it is
 * the same rule the top of this file states. The policy in supabase/012 already
 * restricts this table to rows that are public AND have a handle, and a
 * hand-written filter that agrees with it teaches the next reader that the
 * filter is what makes it safe. It is not. Delete the policy and this function
 * would start serving private profiles no matter what it asked for.
 *
 * Runs on the ANON key, signed in or not: a shared link has to open for someone
 * who has never heard of us, which is most of the people it will be sent to.
 */
export async function loadPublicProfile(handle: string): Promise<PublicProfile | null> {
  const supabase = db()
  if (!supabase || !handle) return null

  const { data, error } = await supabase
    .from('studio_profiles')
    .select(
      'handle, presenter, team, role, bio, crest_path, avatar_path, team_colour, kit_ring, kit_pattern, kit_alt, links',
    )
    .eq('handle', handle)
    .maybeSingle()

  // A private profile, a handle nobody has claimed and a typo are all the same
  // answer on purpose. Telling them apart would confirm that an account exists
  // for somebody who has chosen not to be seen.
  if (error || !data) return null

  const row = data as Record<string, unknown>
  const str = (k: string) => (row[k] as string | null) ?? ''

  return {
    handle: str('handle'),
    presenter: str('presenter'),
    team: str('team'),
    role: str('role'),
    bio: str('bio'),
    crestPath: str('crest_path'),
    avatarPath: str('avatar_path'),
    teamColour: str('team_colour'),
    kitRing: str('kit_ring'),
    kitPattern: str('kit_pattern') || 'solid',
    kitAlt: str('kit_alt'),
    links: Array.isArray(row.links)
      ? (row.links as ProfileLink[])
          .filter((l) => l && typeof l.label === 'string' && typeof l.url === 'string')
          .slice(0, 5)
      : [],
  }
}
