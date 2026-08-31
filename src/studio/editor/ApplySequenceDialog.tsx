/**
 * Dialog for applying a saved sequence to the current system.
 *
 * ── TWO MODES ────────────────────────────────────────────────────────────────
 *
 * AUTO-FILL creates exactly as many new phases as the sequence has, inserted
 * after the current phase. This is the simple case: "put the drill here".
 *
 * INSERT AT RANGE replaces a span of existing phases with the sequence. If
 * the span is longer than the sequence, the remaining phases hold the last
 * pose static — arrows stripped, because arrows mean movement and a hold has
 * none. If shorter, the sequence is truncated.
 *
 * ── CROSS-VIEW REMAPPING ─────────────────────────────────────────────────────
 *
 * A sequence captured on "attacking-half" stores coordinates as percent of
 * that crop. When applied to a "full" pitch, `remapSequenceActs` translates
 * them through `remap()` in ./board/pitch.ts — the same function that
 * handles every pitch-view switch in the editor. The coach does not have to
 * think about it; the drill lands where it should.
 */

import { useState } from 'react'
import type { Act, System } from '../schema'
import { uid } from '../schema'
import type { SavedSequence } from '../sequences'
import { remapSequenceActs, buildRangeActs } from '../sequences'
import { injectSequence } from '../inject'
import { Modal, Button, Field, Segmented } from './ui'

interface Props {
  sequence: SavedSequence
  system: System
  actIndex: number
  selectedTokenIds: string[] | null
  onApply: (newActs: Act[], insertAt: number, replaceCount: number, sequenceTeams?: SavedSequence['teams'] | null) => void
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
  const [mode, setMode] = useState<'auto' | 'range'>('auto')
  const [insertAfter, setInsertAfter] = useState(actIndex)
  const [rangeStart, setRangeStart] = useState(actIndex)
  const [rangeEnd, setRangeEnd] = useState(
    Math.min(actIndex + sequence.acts.length - 1, system.acts.length - 1),
  )

  const handleApply = () => {
    // Remap the sequence from its source pitch view to this system's view.
    const remapped = remapSequenceActs(
      sequence,
      system.pitch,
      system.area,
    )

    if (mode === 'auto') {
      // Auto-fill: use injectSequence to match/overlay tokens from the anchor phase.
      const anchor = system.acts[insertAfter]
      if (!anchor) return

      // Pass false to skip generating a realignment phase
      const newActs = injectSequence(anchor, remapped, selectedTokenIds, false)
      // Replace the anchor phase completely with the first phase of the sequence,
      // appending the rest after it.
      onApply(newActs, insertAfter, 1, sequence.teams)
    } else {
      // Insert at range:
      const anchor = system.acts[rangeStart]
      if (!anchor) return

      // Pass false to skip realignment phase
      const matched = injectSequence(anchor, remapped, selectedTokenIds, false)
      const rangeLength = rangeEnd - rangeStart + 1
      const rangeActs = buildRangeActs(matched, rangeLength)
      onApply(rangeActs, rangeStart, rangeLength, sequence.teams)
    }
  }

  const rangeLength = rangeEnd - rangeStart + 1
  const seqLength = sequence.acts.length
  const holdCount = mode === 'range' ? Math.max(0, rangeLength - seqLength) : 0
  const truncateCount = mode === 'range' ? Math.max(0, seqLength - rangeLength) : 0

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
        <Field label="Mode">
          <Segmented
            value={mode}
            onChange={setMode}
            label="Application mode"
            options={[
              { value: 'auto', label: 'Auto-fill' },
              { value: 'range', label: 'Insert at range' },
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
              Creates{' '}
              <span className="font-bold text-ink-soft">
                {seqLength + 1} new phase{seqLength + 1 === 1 ? '' : 's'}
              </span>{' '}
              after phase {insertAfter + 1} (includes a realignment phase).
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
                {rangeLength} phase{rangeLength === 1 ? '' : 's'} will be replaced
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-faint">
                {holdCount > 0 && (
                  <>
                    {seqLength} sequence phase{seqLength === 1 ? '' : 's'} +{' '}
                    <span className="font-bold text-ink-soft">{holdCount} static hold{holdCount === 1 ? '' : 's'}</span>
                  </>
                )}
                {truncateCount > 0 && (
                  <>
                    Sequence will be{' '}
                    <span className="font-bold text-ink-soft">truncated to {rangeLength} phase{rangeLength === 1 ? '' : 's'}</span>{' '}
                    ({truncateCount} phase{truncateCount === 1 ? '' : 's'} cut)
                  </>
                )}
                {holdCount === 0 && truncateCount === 0 && 'Perfect fit'}
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
