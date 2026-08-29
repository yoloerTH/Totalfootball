/**
 * The lineup panel: every role in the document, and who is filling it.
 *
 * ── WHAT IS HERE AND WHAT IS NEXT DOOR ───────────────────────────────────────
 *
 * Only the rendering. Every derivation and every write lives in ../lineup.ts,
 * which is pure `System` in, `System` out and therefore checkable by a script
 * (scripts/check-lineup.mjs runs it against real five-phase documents). The
 * same split ../formations.ts and ./StudioEditor.tsx already have, and the
 * reason it matters more here than usual: the promise this panel makes is that
 * swapping eleven players moves nobody, and a promise about what a function
 * does NOT touch cannot be verified by looking at a screen.
 *
 * ── WHY A PANEL AT ALL, WHEN THE PROPAGATION IS THE FIX ──────────────────────
 *
 * `patchIdentity` in ./StudioEditor.tsx is what actually answers the coach's
 * complaint: change a name on phase 1 and it changes on all five. But a coach
 * with that alone still has to find and click eleven counters on a board to put
 * out a team. Here they are eleven rows in a list, in team sheet order, with
 * the squad in a dropdown on each, and setting a lineup is eleven presses in
 * one place instead of eleven hunts across five slides.
 *
 * ── IT IS A VIEW OF THE DOCUMENT, NOT A SECOND COPY OF THE TRUTH ─────────────
 *
 * `rolesOf` derives every row from the acts on each render. There is no lineup
 * stored anywhere and there must not be: a stored lineup is a thing that can
 * disagree with the board, and the disagreement would stay invisible until a
 * coach was presenting. Reading eleven roles out of five acts costs nothing and
 * cannot be wrong.
 *
 * ── SO IT CAN REPORT DISAGREEMENT INSTEAD OF HIDING IT ───────────────────────
 *
 * Every board built before today was built under the narrow write, so plenty of
 * them genuinely do say Owusu on phase 1 and nothing on phase 4. This panel
 * does NOT quietly heal those on open. Silently rewriting a document a coach
 * has not touched is how you lose the one phase where the difference was
 * deliberate, and an edit nobody asked for is an edit nobody can undo with any
 * confidence. It flags the split, names the roles, and offers a button. The
 * coach presses it. Same posture as Refresh from squad beside it, and the same
 * posture ../account/squad.ts takes about the squad itself: settings supply a
 * value, they do not reach into a finished board and change one.
 */

import type { Player } from '../account/squad'
import type { System } from '../schema'
import { clashesOf, playerFor, rolesOf, staleRoles, type Role } from '../lineup'
import { HINT } from './guide'
import { Tip } from './Tip'
import { Button, Field, Panel, Select, type Option } from './ui'

/**
 * The dropdown value for a name that was typed rather than picked.
 *
 * A sentinel and not `''`, because `''` already means nobody. It cannot collide
 * with a squad id: those are uuids from the database.
 */
const TYPED = 'typed-in'

export function Lineup({
  system,
  squad,
  photoHrefs,
  selectedId,
  onAssign,
  onSelect,
  onRefresh,
  onHeal,
}: {
  system: System
  squad: Player[]
  /** Storage path to signed URL, from `useSquadPhotos`. Empty is fine. */
  photoHrefs: Record<string, string>
  selectedId: string | null
  /** Put a player on a role, or `null` to empty it. Writes across every act. */
  onAssign: (roleId: string, player: Player | null) => void
  /** Select the counter on the board, when this phase has it. */
  onSelect: (roleId: string) => void
  /** Re-copy from the squad, for the roles that have drifted. */
  onRefresh: (roles: Role[]) => void
  /** Make every act agree with the first one, for the roles that disagree. */
  onHeal: (roles: Role[]) => void
}) {
  const roles = rolesOf(system)
  const phases = system.acts.length
  const named = roles.filter((r) => r.name).length

  // A squad nobody has filled in has nothing to offer here, and the Name field
  // on the selected counter is already a complete way to name a player. The
  // same judgement ./SquadPick.tsx makes about rendering nothing at all: a
  // permanent advertisement for a settings page is not help. The panel does
  // still appear once there are names on the board, because the split warning
  // and the phase counts are worth seeing whether or not a squad exists.
  if (squad.length === 0 && named === 0) return null

  const options: Option<string>[] = [
    { value: '', label: '(nobody)' },
    ...squad.map((p) => ({
      value: p.id,
      label: p.number ? `${p.number}   ${p.name}` : p.name,
    })),
  ]

  /** Which squad row each role holds, resolved once for the whole render. */
  const held = new Map(roles.map((r) => [r.id, playerFor(r, squad)]))
  const clashes = clashesOf(roles, squad)
  const stale = staleRoles(roles, squad)
  const split = roles.filter((r) => r.split)

  return (
    <Panel title="Lineup">
      <p className="mb-3 text-[11px] leading-snug text-ink-faint">
        Who is filling each role, on{' '}
        <span className="font-bold text-ink-soft">
          {phases === 1 ? 'this phase' : `all ${phases} phases`}
        </span>
        . Changing a name here changes it everywhere and moves nobody: the runs, the timing and the
        shape stay exactly as you drew them.
      </p>

      <Tip text={HINT.lineup} title="Lineup" side="left" block>
        <div className="rounded-md border border-ink-hair bg-paper">
          {roles.length === 0 && (
            <p className="px-2 py-3 text-[11px] text-ink-faint">No players on the board yet.</p>
          )}
          {roles.map((role) => {
            const player = held.get(role.id) ?? null
            const clash = clashes.get(role.id)
            const partial = role.phases.length < phases
            const href = role.photo ? photoHrefs[role.photo] : undefined
            // A name that resolves to no squad row was typed by hand, and the
            // dropdown has to say so. Showing "(nobody)" above a counter that
            // plainly reads Owusu is the control contradicting the board.
            const typed = !player && role.name
            const value = player ? player.id : typed ? TYPED : ''

            return (
              <div
                key={role.id}
                className={`flex items-center gap-2 border-b border-ink-hair px-2 py-1.5 last:border-b-0 ${
                  selectedId === role.id ? 'bg-ink-hair' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(role.id)}
                  title={`Show ${role.label} on the board`}
                  className="flex w-11 shrink-0 items-center justify-end gap-1 rounded font-mono text-[11px] font-bold text-ink-faint transition-colors hover:text-ink"
                >
                  {href ? (
                    <img src={href} alt="" className="h-5 w-5 rounded-full object-cover" />
                  ) : null}
                  {role.label}
                </button>

                <div className="min-w-0 flex-1">
                  {/*
                   * NO DROPDOWN WITHOUT A SQUAD TO PICK FROM.
                   *
                   * With an empty squad the only option is "(nobody)", so the
                   * one thing the control could do is delete a name. That is a
                   * destructive control dressed as a picker, and the two people
                   * who would see it are the coach who has never opened the
                   * squad page and the stranger reading a board somebody else
                   * drew. Both get the list read-only, which is still worth
                   * having: the split warning, the duplicate check and the
                   * phase counts are exactly what is worth knowing about a
                   * board you did not build.
                   */}
                  {squad.length === 0 ? (
                    <p className="truncate text-[12px] font-bold text-ink">
                      {role.name || <span className="font-normal text-ink-faint">Not named</span>}
                    </p>
                  ) : (
                    <Select
                      id={`lineup-${role.id}`}
                      value={value}
                      onChange={(v) => {
                        // Re-choosing the typed-in name is not an edit. Without
                        // this, picking it would call onAssign(null) and clear the
                        // very name the option was describing.
                        if (v === TYPED) return
                        onAssign(role.id, v ? (squad.find((p) => p.id === v) ?? null) : null)
                      }}
                      options={
                        typed
                          ? [{ value: TYPED, label: `${role.name} (typed in)` }, ...options]
                          : options
                      }
                    />
                  )}
                  {(role.split || partial || clash) && (
                    <p className="mt-0.5 text-[10px] leading-tight text-ink-faint">
                      {role.split && (
                        <span className="font-bold text-ink-soft">Phases disagree here. </span>
                      )}
                      {clash && `Also on ${clash.join(', ')}. `}
                      {partial &&
                        `On ${role.phases.length === 1 ? 'phase' : 'phases'} ${role.phases.join(', ')} only.`}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Tip>

      {roles.length > 0 && (
        <p className="mt-2 text-[11px] text-ink-faint">
          {named} of {roles.length} named.
          {squad.length === 0 && ' Add your squad in Personal settings to swap players from here.'}
        </p>
      )}

      {split.length > 0 && (
        <Field label="Not the same on every phase">
          <Button onClick={() => onHeal(split)}>
            Make {split.length === 1 ? 'it' : 'them'} agree with phase one
          </Button>
          <p className="mt-1.5 text-[10px] leading-snug text-ink-faint">
            {/* Named, not counted. "3 roles differ" tells a coach there is a
                problem and not where to look for it. */}
            {split.map((r) => r.label).join(', ')}. Takes the name from the first phase each one
            appears on and writes it across the rest. Nothing moves.
          </p>
        </Field>
      )}

      {stale.length > 0 && (
        <Field label="Your squad has changed since this was filled">
          <Button onClick={() => onRefresh(stale)}>Refresh {stale.length} from squad</Button>
          <p className="mt-1.5 text-[10px] leading-snug text-ink-faint">
            {stale.map((r) => r.label).join(', ')}. A board keeps the names it was drawn with until
            you ask for them again, so a session from last autumn is never rewritten by a change in
            settings.
          </p>
        </Field>
      )}
    </Panel>
  )
}
