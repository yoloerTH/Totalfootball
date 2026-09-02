/**
 * Dialog for applying a saved sequence to the current system.
 *
 * ── THE TWO QUESTIONS ────────────────────────────────────────────────────────
 *
 * A coach dropping a saved drill onto a board is answering two questions, and
 * this asks both of them plainly rather than inferring either.
 *
 * WHAT HAPPENS TO THE PLAYERS ALREADY THERE. `Add alongside` brings the drill
 * in as its own counters and leaves every mark on the board untouched. `Cast my
 * players` is the older behaviour: the men nearest the drill are matched to it
 * and moved into it. Add is the default, because a saved sequence is nearly
 * always a pattern being ADDED to a system rather than a re-pose of the system
 * itself, and because the matching version, run by accident, teleports eleven
 * players into a rondo.
 *
 * WHICH WAY ROUND. Two mirrors, named for the pitch and not for the screen:
 * `Swap flanks` reflects across the width, so the left wing becomes the right
 * wing, and `Swap ends` reflects along the length. Percent x is along the
 * pitch's length on EVERY board, upright or flat (see `metresToUnits` in
 * ../board/pitch.ts), so these two words mean the same thing on all nine views
 * where "horizontal" and "vertical" would swap over on three of them.
 *
 * ── WHERE IT LANDS ───────────────────────────────────────────────────────────
 *
 * On the grass it was captured from, re-expressed against this board's crop by
 * `placementTransform` in ../sequences.ts — and then the coach drags it. Every
 * mark the apply introduces comes back in `AddedMarks` and is handed straight
 * to the editor's multi-select, so the drill lands already selected and the
 * group drag that already exists moves it, across every phase it occupies. No
 * placement gesture inside this dialog, because the board itself is a better
 * placement gesture than any rectangle in a modal.
 */

import { useMemo, useState } from 'react'
import type { Act, System } from '../schema'
import type { SavedSequence, SequencePlacement } from '../sequences'
import { remapSequenceActs, buildRangeActs } from '../sequences'
import { injectSequence, addSequence, type AddedMarks } from '../inject'
import { Modal, Button, Field, Segmented, Toggle } from './ui'

export interface SequenceApply {
  acts: Act[]
  insertAt: number
  replaceCount: number
  /** Marks the apply introduced, for the editor to select. Empty in cast mode. */
  added: AddedMarks | null
  /** The sequence's kit, only when the coach asked for it. */
  teams: SavedSequence['teams'] | null
}

interface Props {
  sequence: SavedSequence
  system: System
  actIndex: number
  selectedTokenIds: string[] | null
  onApply: (result: SequenceApply) => void
  onClose: () => void
}

export function ApplySequenceDialog({
  sequence,
  system,
  actIndex,
  selectedTokenIds,
  onApply,
  onClose,
}: Props) {
  const [how, setHow] = useState<'add' | 'cast'>('add')
  const [mode, setMode] = useState<'auto' | 'range'>('auto')
  const [flanks, setFlanks] = useState(false)
  const [ends, setEnds] = useState(false)
  const [takeKit, setTakeKit] = useState(false)
  const [insertAfter, setInsertAfter] = useState(actIndex)
  const [rangeStart, setRangeStart] = useState(actIndex)
  const [rangeEnd, setRangeEnd] = useState(
    Math.min(actIndex + sequence.acts.length - 1, system.acts.length - 1),
  )

  const placement: SequencePlacement = useMemo(
    () => ({ flanks, ends }),
    [flanks, ends],
  )

  const handleApply = () => {
    // Onto this board's crop, mirrored as asked. One transform, applied once,
    // by the same walk the pitch picker uses.
    const remapped = remapSequenceActs(sequence, system.pitch, system.area, placement)
    const teams = takeKit ? sequence.teams ?? null : null

    if (how === 'add') {
      if (mode === 'auto') {
        /*
         * NEW PHASES AFTER THE ANCHOR, and the anchor itself is not touched at
         * all. Each new phase is a copy of the board as it stands with one beat
         * of the drill added, so the players already on it hold their positions
         * while the pattern runs beside them — which is what "it should not
         * affect what is already on that phase" has to mean once the sequence
         * is longer than one phase.
         */
        const anchor = system.acts[insertAfter]
        if (!anchor) return
        const bases = remapped.map(() => anchor)
        const { acts, added } = addSequence(bases, remapped, 'sequence')
        onApply({ acts, insertAt: insertAfter + 1, replaceCount: 0, added, teams })
      } else {
        const bases = system.acts.slice(rangeStart, rangeEnd + 1)
        if (bases.length === 0) return
        const { acts, added } = addSequence(bases, remapped, 'board')
        onApply({ acts, insertAt: rangeStart, replaceCount: bases.length, added, teams })
      }
      return
    }

    // Cast: the older behaviour, unchanged. It re-poses the board's own players
    // into the drill, so it necessarily replaces the phases it lands on.
    if (mode === 'auto') {
      const anchor = system.acts[insertAfter]
      if (!anchor) return
      const acts = injectSequence(anchor, remapped, selectedTokenIds, false)
      onApply({ acts, insertAt: insertAfter, replaceCount: 1, added: null, teams })
    } else {
      const anchor = system.acts[rangeStart]
      if (!anchor) return
      const matched = injectSequence(anchor, remapped, selectedTokenIds, false)
      const rangeLength = rangeEnd - rangeStart + 1
      const rangeActs = buildRangeActs(matched, rangeLength)
      onApply({ acts: rangeActs, insertAt: rangeStart, replaceCount: rangeLength, added: null, teams })
    }
  }

  const rangeLength = rangeEnd - rangeStart + 1
  const seqLength = sequence.acts.length
  const holdCount = mode === 'range' ? Math.max(0, rangeLength - seqLength) : 0
  const truncateCount =
    mode === 'range' && how === 'cast' ? Math.max(0, seqLength - rangeLength) : 0
  const overflowCount =
    mode === 'range' && how === 'add' ? Math.max(0, seqLength - rangeLength) : 0

  return (
    <Modal
      title="Apply Sequence"
      subtitle={
        <>
          <span className="font-bold text-ink">{sequence.name}</span>
          <span className="mx-1.5">·</span>
          {seqLength} phase{seqLength === 1 ? '' : 's'}
          <span className="mx-1.5">·</span>
          {sequence.playerCount} player{sequence.playerCount === 1 ? '' : 's'}
        </>
      }
      label={`Apply "${sequence.name}" to the current system`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="solid" onClick={handleApply}>
            Apply
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="The players already on the board">
          <Segmented
            value={how}
            onChange={setHow}
            label="What happens to the players already on the board"
            options={[
              { value: 'add', label: 'Add alongside' },
              { value: 'cast', label: 'Cast my players' },
            ]}
          />
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            {how === 'add' ? (
              <>
                The sequence arrives as its own counters.{' '}
                <span className="font-bold text-ink-soft">
                  Nothing already on the board moves.
                </span>{' '}
                It lands selected, so you can drag it straight into place.
              </>
            ) : (
              <>
                The players nearest the sequence are{' '}
                <span className="font-bold text-ink-soft">moved into it</span>, so your own
                squad runs the pattern. The phases it lands on are replaced.
              </>
            )}
          </p>
        </Field>

        <Field label="Which way round">
          <div className="space-y-1.5">
            <Toggle label="Swap flanks" checked={flanks} onChange={setFlanks} />
            <Toggle label="Swap ends" checked={ends} onChange={setEnds} />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            {flanks && ends
              ? 'Turned right round: the other flank at the other end.'
              : flanks
                ? 'Mirrored across the pitch. A drill drawn down the left runs down the right.'
                : ends
                  ? 'Mirrored along the pitch. What was drawn attacking is now defending.'
                  : 'Lands the way round it was saved.'}
          </p>
        </Field>

        <Field label="Phases">
          <Segmented
            value={mode}
            onChange={setMode}
            label="Application mode"
            options={[
              { value: 'auto', label: 'New phases' },
              { value: 'range', label: 'Over a range' },
            ]}
          />
        </Field>

        {mode === 'auto' ? (
          <Field label="Insert after phase">
            <select
              className="w-full rounded-md border border-ink-hair bg-paper px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-ink-faint"
              value={insertAfter}
              onChange={(e) => setInsertAfter(parseInt(e.target.value, 10))}
            >
              {system.acts.map((_, i) => (
                <option key={i} value={i}>
                  Phase {i + 1}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11px] leading-snug text-ink-faint">
              {how === 'add' ? (
                <>
                  Adds{' '}
                  <span className="font-bold text-ink-soft">
                    {seqLength} new phase{seqLength === 1 ? '' : 's'}
                  </span>{' '}
                  after phase {insertAfter + 1}. Phase {insertAfter + 1} itself is left
                  exactly as it is.
                </>
              ) : (
                <>
                  Replaces phase {insertAfter + 1} with{' '}
                  <span className="font-bold text-ink-soft">
                    {seqLength} phase{seqLength === 1 ? '' : 's'}
                  </span>
                  .
                </>
              )}
            </p>
          </Field>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Field label="From Phase">
                  <select
                    className="w-full rounded-md border border-ink-hair bg-paper px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-ink-faint"
                    value={rangeStart}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10)
                      setRangeStart(n)
                      if (rangeEnd < n) setRangeEnd(n)
                    }}
                  >
                    {system.acts.map((_, i) => (
                      <option key={i} value={i}>
                        Phase {i + 1}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="flex-1">
                <Field label="To Phase">
                  <select
                    className="w-full rounded-md border border-ink-hair bg-paper px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-ink-faint"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(parseInt(e.target.value, 10))}
                  >
                    {system.acts.map((_, i) => (
                      <option key={i} value={i} disabled={i < rangeStart}>
                        Phase {i + 1}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
            <div className="rounded-md bg-paper px-3 py-2">
              <p className="text-[11px] font-bold leading-snug text-ink-soft">
                {how === 'add'
                  ? `Laid over ${rangeLength} phase${rangeLength === 1 ? '' : 's'}`
                  : `${rangeLength} phase${rangeLength === 1 ? '' : 's'} will be replaced`}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-faint">
                {how === 'add' && (
                  <>
                    Everything on {rangeLength === 1 ? 'that phase' : 'those phases'} stays
                    where it is.{' '}
                  </>
                )}
                {holdCount > 0 && (
                  <>
                    {seqLength} sequence phase{seqLength === 1 ? '' : 's'} +{' '}
                    <span className="font-bold text-ink-soft">
                      {holdCount} static hold{holdCount === 1 ? '' : 's'}
                    </span>
                    .
                  </>
                )}
                {truncateCount > 0 && (
                  <>
                    Sequence{' '}
                    <span className="font-bold text-ink-soft">
                      truncated to {rangeLength} phase{rangeLength === 1 ? '' : 's'}
                    </span>{' '}
                    ({truncateCount} cut).
                  </>
                )}
                {overflowCount > 0 && (
                  <>
                    Sequence{' '}
                    <span className="font-bold text-ink-soft">
                      truncated to {rangeLength} phase{rangeLength === 1 ? '' : 's'}
                    </span>{' '}
                    ({overflowCount} cut). Widen the range to see all of it.
                  </>
                )}
                {holdCount === 0 && truncateCount === 0 && overflowCount === 0 && 'Perfect fit.'}
              </p>
            </div>
          </>
        )}

        {sequence.teams && (
          <Field label="Kit">
            <Toggle
              label="Take the sequence's colours"
              checked={takeKit}
              onChange={setTakeKit}
            />
            <p className="mt-2 text-[11px] leading-snug text-ink-faint">
              Repaints the whole system in the kit this sequence was saved in. Off by
              default: a drill should not change what your team is wearing.
            </p>
          </Field>
        )}
      </div>
    </Modal>
  )
}
