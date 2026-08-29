/**
 * Who is filling each role, and the four writes that change it.
 *
 * ── THE PROBLEM, IN A COACH'S WORDS ──────────────────────────────────────────
 *
 * "The positions and movements stay identical from match to match, but the
 * starting lineup changes. I have to open every single slide and retype the
 * name." (user, 2026-08-29.) Twenty to thirty minutes of a Friday, and the real
 * cost is not the typing. It is the slide where the typing was forgotten,
 * because a board that says Owusu on four phases and Silva on the fifth shows a
 * substitution nobody made, and there is no error to find: every phase looks
 * completely correct on its own.
 *
 * ── ROLE, PERSON, POSE ───────────────────────────────────────────────────────
 *
 * The fix is the distinction ../schema.ts now spells out as three exported
 * lists. A token id is a ROLE and never changes. A name, a number, a face are a
 * PERSON and there is one answer per document, so an edit to any of them has to
 * reach every act. Where somebody stands, and what they are doing on this beat,
 * are a POSE and belong to one act alone. Everything in this file is a write of
 * the middle kind: wide across the acts, and touching nothing else.
 *
 * ── WHY IT IS HERE AND NOT IN ./editor/Lineup.tsx ────────────────────────────
 *
 * Same reason ./formations.ts and ./camera.ts are not in the editor: a document
 * transform is not UI, and a `.tsx` cannot be imported by a check script — Node
 * strips types on its own and will not strip JSX (./../../scripts/lib/ts.mjs).
 * Every function below is pure `System` in, `System` out, so
 * scripts/check-lineup.mjs runs them against real five-phase documents and
 * asserts what a coach actually cares about: that the name reached all five,
 * and that nobody moved a centimetre.
 */

import type { Player } from './account/squad'
import type { Side, System, Token } from './schema'

/** One role in the document: a token id, and whatever the acts say about it. */
export interface Role {
  /** The token id. Stable across acts by construction, see ./schema.ts. */
  id: string
  side: Side
  /** What is printed on the counter, as of the first act this role appears on. */
  label: string
  /** The name on the counter. Empty when the role is nobody in particular. */
  name: string
  /** The squad row it was filled from, when it was filled from one. */
  playerId?: string
  photo?: string
  /** 1-based phase numbers this role stands on. Usually all of them. */
  phases: number[]
  /**
   * The acts do not agree about who this is.
   *
   * Only ever true for a document written before identity edits went wide, or
   * one edited in two tabs at once. It is reported rather than repaired: see
   * `healRoles`.
   */
  split: boolean
}

/**
 * The identity fields as one comparable value.
 *
 * JSON and not a joined string, because a joined string needs a separator that
 * cannot appear in any of the parts, and a coach types the names.
 */
const idOf = (t: Token) => JSON.stringify([t.label, t.name ?? '', t.playerId ?? ''])

/**
 * Every role in the system, in the order a coach would read a team sheet.
 *
 * ORDER IS FIRST APPEARANCE, not sorted. `place` in ./formations.ts lays a
 * shape out keeper first, so first appearance already gives GK, then the back
 * line, then midfield, then the front: the order the coach's own formation put
 * them in. Sorting by label would file "10" before "2", and a coach reading
 * down the list for the man they had missed would have to hunt.
 *
 * A role on SOME acts is still a role. `addPlayer` deliberately adds a twelfth
 * man to one phase only, so `phases` carries where they stand and the panel can
 * say so, rather than reporting the board as inconsistent.
 */
export function rolesOf(system: System): Role[] {
  const byId = new Map<string, Role>()
  const first = new Map<string, string>()

  system.acts.forEach((act, i) => {
    for (const t of act.tokens) {
      const seen = byId.get(t.id)
      if (!seen) {
        byId.set(t.id, {
          id: t.id,
          side: t.side,
          label: t.label,
          name: t.name ?? '',
          playerId: t.playerId,
          photo: t.photo,
          phases: [i + 1],
          split: false,
        })
        first.set(t.id, idOf(t))
        continue
      }
      seen.phases.push(i + 1)
      if (idOf(t) !== first.get(t.id)) seen.split = true
    }
  })

  const roles = [...byId.values()]
  // Us before them, and otherwise untouched. A coach setting their own team
  // should not have to scroll past an opposition nobody has named.
  return [...roles.filter((r) => r.side === 'us'), ...roles.filter((r) => r.side === 'them')]
}

/**
 * The squad row a role is holding, or null.
 *
 * ID FIRST, NAME AS A FALLBACK. The id is definite and a name is not: two
 * players called Owusu are one name and two rows, and only the id says which.
 * But every board built before `Token.playerId` existed carries only a name and
 * those boards have to go on showing the right player, so the fallback stays.
 *
 * A DEAD ID FALLS THROUGH TO THE NAME rather than resolving to nobody, which is
 * worth being explicit about because the opposite reading is tempting. The case
 * is a coach who deleted a player and re-added them: a new row, the same human,
 * the same name. Matching it is the best guess available and costs nothing when
 * it is wrong, since the only consequences are a highlighted row in the picker
 * and a refresh that would write the name already on the counter. When the name
 * finds nobody either, the role reads as typed in, which by then is what it is.
 */
export function playerFor(
  // A `Token` and a `Role` both satisfy this, which is the point: the picker on
  // the selected counter has a token and the lineup panel has a role, and if
  // the two resolved a player differently they would contradict each other on
  // the same screen.
  role: { playerId?: string; name?: string },
  squad: Player[],
): Player | null {
  if (role.playerId) {
    const byId = squad.find((p) => p.id === role.playerId)
    if (byId) return byId
  }
  if (!role.name) return null
  return squad.find((p) => p.name === role.name) ?? null
}

/**
 * roleId to the other roles holding the same player.
 *
 * The duplicate XI check, and the cheapest of the three things the panel does
 * for accuracy: a coach who has the same lad at right back and in midfield has
 * made a mistake that is invisible on the board, because the two counters are
 * in different places and both look perfectly right.
 */
export function clashesOf(roles: Role[], squad: Player[]): Map<string, string[]> {
  const held = new Map(roles.map((r) => [r.id, playerFor(r, squad)]))
  const out = new Map<string, string[]>()
  for (const r of roles) {
    const mine = held.get(r.id)
    if (!mine) continue
    const others = roles.filter((o) => o.id !== r.id && held.get(o.id)?.id === mine.id)
    if (others.length) out.set(r.id, others.map((o) => o.label))
  }
  return out
}

/**
 * A squad row whose details have moved on from what the board copied.
 *
 * Compared field by field rather than by a timestamp, because the document
 * holds no record of WHEN it copied, and a squad row's `updated_at` moves when
 * the coach merely reorders the list. The only honest question is whether the
 * values differ from the values on the board.
 *
 * `''` and `undefined` are the same absence here: a token with no photo carries
 * `undefined`, a squad row with no photo carries `''`, and calling that a
 * difference would offer a refresh that changes nothing.
 *
 * ── THE COUNTER IS NOT COMPARED, AND THAT IS NOT AN OVERSIGHT ────────────────
 *
 * Only the name and the photo. What is printed on a counter belongs to the
 * coach and not to the squad: `applyLabels` rewrites every label on the board
 * to positions in one press, and `Token.label` is a field they can retype by
 * hand. Comparing it here would mean a coach who chose "Positions (CB, DM, ST)"
 * had every numbered player in their squad reported as out of date forever, and
 * pressing the button they were offered would put the numbers back and undo the
 * choice. Filling a role from the squad still writes the number onto the
 * counter, because that is the coach asking for it. Drift is measured on the
 * person alone.
 */
export function isStale(role: Role, player: Player): boolean {
  return player.name !== role.name || (player.photoPath || '') !== (role.photo ?? '')
}

/** The roles whose own squad row has moved on. What Refresh from squad offers. */
export function staleRoles(roles: Role[], squad: Player[]): Role[] {
  return roles.filter((r) => {
    // Only where the board says it came from THIS row. A name that merely
    // matches a squad entry was typed, and offering to refresh it from a row it
    // was never copied from is the panel guessing.
    const p = r.playerId ? squad.find((x) => x.id === r.playerId) : undefined
    return p ? isStale(r, p) : false
  })
}

/** What a role becomes when a squad player is put on it. */
export function fillFrom(player: Player, currentLabel: string): Partial<Token> {
  return {
    // The squad's number wins if there is one, and the counter keeps what it
    // had if there is not. The same rule the picker on the selected counter has
    // always followed: a player with no number is a real entry, and blanking a
    // counter that already said "6" is the picker taking something away rather
    // than filling something in.
    label: player.number || currentLabel,
    name: player.name,
    photo: player.photoPath || undefined,
    playerId: player.id,
  }
}

/**
 * What a role becomes when it is REFRESHED from the squad row it came from.
 *
 * `fillFrom` without the label, for the reason `isStale` gives above: a refresh
 * corrects who somebody is and must not quietly take back a counter the coach
 * relabelled. The two have to agree about which fields drift, so they sit next
 * to each other.
 */
export function refreshFrom(player: Player): Partial<Token> {
  return {
    name: player.name,
    photo: player.photoPath || undefined,
    playerId: player.id,
  }
}

/**
 * What a role becomes when it is emptied.
 *
 * The counter's LABEL IS LEFT ALONE, which is the call `onClear` on the player
 * panel already makes: "LB" is where somebody plays, and it survives the player
 * leaving. Emptying a role is a team sheet with a gap in it, not a hole in the
 * shape.
 */
export const EMPTY_ROLE: Partial<Token> = {
  name: undefined,
  photo: undefined,
  playerId: undefined,
}

/**
 * The one write shared by everything below: patch some roles, on every act.
 *
 * ── WHAT IT CANNOT DO, WHICH IS THE POINT ────────────────────────────────────
 *
 * `x`, `y`, the arrows, the bands, the balls, the writing, the gear, the shot
 * and the captions are all untouched, because a patch is spread onto a token
 * and nothing else in the act is read. That is the promise the whole feature
 * rests on: swapping eleven players changes eleven tags and leaves the film
 * frame-for-frame identical. It is asserted, on a real document, in
 * scripts/check-lineup.mjs — a promise about what a function does NOT do is
 * exactly the sort that rots quietly.
 *
 * Returns the same object when there is nothing to do, so a caller's `edit`
 * does not push an undo step for a no-op.
 */
export function patchRoles(system: System, patches: Map<string, Partial<Token>>): System {
  if (patches.size === 0) return system
  return {
    ...system,
    acts: system.acts.map((a) => ({
      ...a,
      tokens: a.tokens.map((t) => {
        const patch = patches.get(t.id)
        return patch ? { ...t, ...patch } : t
      }),
    })),
  }
}

/** Put a squad player on a role, or empty it. On every act. */
export function assignRole(system: System, roleId: string, player: Player | null): System {
  /*
   * ONE label for every act, read from the first act that has this role.
   *
   * `fillFrom` keeps the counter it finds when the player has no squad number.
   * Reading that per act would let a role whose phases already disagree keep a
   * different counter on each of them: the split this panel reports, made
   * permanent by the thing meant to fix it.
   */
  const base = system.acts.flatMap((a) => a.tokens).find((t) => t.id === roleId)?.label ?? ''
  return patchRoles(system, new Map([[roleId, player ? fillFrom(player, base) : EMPTY_ROLE]]))
}

/**
 * Re-copy the name and the face from the squad, for roles that have drifted.
 *
 * THE COACH PRESSES THIS. Nothing calls it on open, on save or on a squad edit,
 * which is the rule ./account/squad.ts sets out at length: a board is a record
 * of a session that happened and it keeps the names it was drawn with. A player
 * renamed in settings in March does not rewrite February.
 */
export function refreshRoles(system: System, roles: Role[], squad: Player[]): System {
  const patches = new Map<string, Partial<Token>>()
  for (const r of roles) {
    const p = squad.find((x) => x.id === r.playerId)
    if (p) patches.set(r.id, refreshFrom(p))
  }
  return patchRoles(system, patches)
}

/**
 * Make every act agree with the first one, for roles whose phases disagree.
 *
 * Only reachable from a warning that names the roles, and only on documents
 * written before identity edits went wide — nothing can produce a split from
 * here on. `Role` already carries the first act's values, which is the
 * authority we want: the earliest phase a role appears on is the one the coach
 * filled in deliberately.
 */
export function healRoles(system: System, roles: Role[]): System {
  return patchRoles(
    system,
    new Map(
      roles.map((r) => [
        r.id,
        { label: r.label, name: r.name || undefined, photo: r.photo, playerId: r.playerId },
      ]),
    ),
  )
}
