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
import type { System } from '../schema'
import { listSystems, migrate } from '../storage'
import { db } from './client'

export interface CloudSystem {
  id: string
  system: System
  /** ISO, from the database's own clock — see the trigger in 005. */
  updated: string
}

const TABLE = 'studio_systems'

/** This coach's systems, newest first. `[]` when signed out or offline. */
export async function listCloudSystems(): Promise<CloudSystem[]> {
  const supabase = db()
  if (!supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, doc, updated_at')
    .order('updated_at', { ascending: false })
  if (error || !data) return []
  return data.map((row) => ({
    id: row.id as string,
    system: migrate(row.doc as System),
    updated: row.updated_at as string,
  }))
}

export async function loadCloudSystem(id: string): Promise<System | null> {
  const supabase = db()
  if (!supabase) return null
  const { data, error } = await supabase.from(TABLE).select('doc').eq('id', id).maybeSingle()
  if (error || !data) return null
  return migrate(data.doc as System)
}

/**
 * Write one system up. Returns whether it landed.
 *
 * `owner` is passed explicitly because it is `not null` and the client is the
 * only thing that knows the id — but the WITH CHECK half of the policy is what
 * makes it honest: a client that sent somebody else's uuid gets rejected by
 * Postgres rather than trusted.
 */
export async function saveCloudSystem(id: string, system: System, owner: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false
  const { error } = await supabase.from(TABLE).upsert(
    { id, owner, doc: system },
    { onConflict: 'owner,id' },
  )
  return !error
}

export async function deleteCloudSystem(id: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
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
 * Returns how many were newly claimed, so the portal can say so once.
 */
export async function claimLocalSystems(owner: string): Promise<number> {
  const supabase = db()
  if (!supabase) return 0

  const local = listSystems()
  if (local.length === 0) return 0

  const { data: existing } = await supabase.from(TABLE).select('id')
  const known = new Set((existing ?? []).map((r) => r.id as string))
  const fresh = local.filter((l) => !known.has(l.id))
  if (fresh.length === 0) return 0

  const { error } = await supabase
    .from(TABLE)
    .upsert(
      fresh.map((l) => ({ id: l.id, owner, doc: l.system })),
      { onConflict: 'owner,id', ignoreDuplicates: true },
    )
  return error ? 0 : fresh.length
}

// ── the profile ──────────────────────────────────────────────────────────────

/**
 * What a coach signs their work with.
 *
 * Deliberately the same three fields the share dialog asks for, minus the
 * per-share note. This is where those fields get their DEFAULTS; the values
 * themselves still live on each document (`System.credit`), which is why a
 * system shared last season keeps the club a coach was at last season.
 */
export interface Profile {
  presenter: string
  team: string
  /** Hex, the counter fill. `deep` and the label colour are derived at render. */
  teamColour: string
}

export const EMPTY_PROFILE: Profile = { presenter: '', team: '', teamColour: '' }

export async function loadProfile(): Promise<Profile | null> {
  const supabase = db()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('studio_profiles')
    .select('presenter, team, team_colour')
    .maybeSingle()
  if (error || !data) return null
  return {
    presenter: (data.presenter as string | null) ?? '',
    team: (data.team as string | null) ?? '',
    teamColour: (data.team_colour as string | null) ?? '',
  }
}

/**
 * Start a new system from what the coach has already told us about themselves.
 *
 * The point of the settings page: a signed-in coach's first board is already in
 * their colours and already signed, so the share dialog is one press instead of
 * three fields. `deep` and the label colour are DERIVED rather than stored —
 * the same two functions the board uses at render time, so a kit colour cannot
 * mean one thing here and another on the pitch.
 *
 * Only fills what is empty. It supplies defaults; it never edits a document.
 */
export function withProfile(system: System, profile: Profile): System {
  const presenter = profile.presenter.trim()
  const team = profile.team.trim()
  const colour = profile.teamColour.trim()

  return {
    ...system,
    teams: colour
      ? {
          ...system.teams,
          us: {
            ...system.teams.us,
            name: team || system.teams.us.name,
            base: colour,
            deep: darken(colour),
            text: readableText(colour),
          },
        }
      : system.teams,
    credit:
      presenter || team
        ? { ...system.credit, presenter: presenter || undefined, team: team || undefined }
        : system.credit,
  }
}

export async function saveProfile(profile: Profile, id: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false
  // Empty strings go up as NULL: the columns are nullable and "not set yet" is
  // a real state the credit bar reads, distinct from "set to nothing".
  const nil = (s: string) => (s.trim() ? s.trim() : null)
  const { error } = await supabase.from('studio_profiles').upsert(
    {
      id,
      presenter: nil(profile.presenter),
      team: nil(profile.team),
      team_colour: nil(profile.teamColour),
    },
    { onConflict: 'id' },
  )
  return !error
}
