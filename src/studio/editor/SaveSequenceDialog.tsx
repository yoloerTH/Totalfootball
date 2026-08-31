/**
 * Dialog for capturing and saving a sequence of phases.
 *
 * ── WHAT THIS DOES ───────────────────────────────────────────────────────────
 *
 * Extracts a slice of the current system's phases into a reusable sequence
 * that lives in the coach's personal library. By default, it captures from
 * the start of the system up to the phase the coach is currently viewing,
 * because that is typically the complete progression of the pattern being
 * authored.
 *
 * ── REGION CAPTURE ───────────────────────────────────────────────────────────
 *
 * The toggle is here and the contract is ready, but the interactive rectangle
 * selector on the pitch is a separate piece of work. For now, "Select area"
 * shows a placeholder message. When built, the pitch overlay will hand the
 * region back here and `captureSequence` will normalise into it.
 */

import { useState } from 'react'
import type { System } from '../schema'
import type { SavedSequence } from '../sequences'
import { captureSequence } from '../sequences'
import { Modal, Button, TextInput, Field, Segmented, Select } from './ui'

interface Props {
  system: System
  actIndex: number
  selectedTokenIds: string[] | null
  hidden?: boolean
  region: import('../sequences').SequenceRegion | null
  onDrawRegion: () => void
  onSave: (seq: SavedSequence) => void
  onClose: () => void
}

export function SaveSequenceDialog({
  system,
  actIndex,
  selectedTokenIds,
  hidden,
  region,
  onDrawRegion,
  onSave,
  onClose,
}: Props) {
  const [name, setName] = useState('')
  const [fromPhase, setFromPhase] = useState(0)
  const [toPhase, setToPhase] = useState(
    actIndex >= 0 ? Math.min(actIndex, system.acts.length - 1) : system.acts.length - 1,
  )
  const [captureScope, setCaptureScope] = useState<'whole' | 'region'>('whole')
  const [playerFilter, setPlayerFilter] = useState<'all' | 'selected'>('all')

  const handleSave = () => {
    if (!name.trim()) return

    const finalRegion = captureScope === 'region' && region ? region : undefined

    const tokensToCapture = playerFilter === 'selected' ? selectedTokenIds : null

    const seq = captureSequence(
      name.trim(),
      system.acts,
      fromPhase,
      toPhase,
      system.pitch,
      system.area,
      finalRegion,
      tokensToCapture,
      system.teams
    )

    onSave(seq)
  }

  const phaseOptions = system.acts.map((_, i) => ({
    value: i.toString(),
    label: `Phase ${i + 1}`,
  }))

  const numPhases = toPhase - fromPhase + 1
  const numPlayers =
    playerFilter === 'selected' && selectedTokenIds
      ? selectedTokenIds.length
      : (system.acts[fromPhase]?.tokens.filter((t) => !t.benched).length ?? 0)

  return (
    <Modal
      hidden={hidden}
      title="Save Sequence"
      label="Save a range of phases as a reusable sequence"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="solid" disabled={!name.trim()} onClick={handleSave}>
            Save Sequence
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Sequence name">
          <TextInput value={name} onChange={setName} placeholder="e.g. Third-man overlap" />
        </Field>

        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-1.5">
            <Field label="From Phase">
              <Select
                value={fromPhase.toString()}
                onChange={(v) => {
                  const n = parseInt(v, 10)
                  setFromPhase(n)
                  if (toPhase < n) setToPhase(n)
                }}
                options={phaseOptions}
              />
            </Field>
          </div>
          <div className="flex-1 space-y-1.5">
            <Field label="To Phase">
              <select
                className="w-full rounded-md border border-ink-hair bg-paper px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-ink-faint"
                value={toPhase}
                onChange={(e) => setToPhase(parseInt(e.target.value, 10))}
              >
                {system.acts.map((_, i) => (
                  <option key={i} value={i} disabled={i < fromPhase}>
                    Phase {i + 1}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <Field label="Capture scope">
          <Segmented
            value={captureScope}
            onChange={setCaptureScope}
            label="Capture scope"
            options={[
              { value: 'whole', label: 'Whole pitch' },
              { value: 'region', label: 'Select area' },
            ]}
          />
          {captureScope === 'region' && (
            <div className="mt-3 rounded-md bg-paper px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-ink">Region to capture</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    {region ? 'Region defined' : 'No region drawn yet'}
                  </p>
                </div>
                <Button variant="solid" onClick={onDrawRegion} className="!px-3 !py-1 text-xs">
                  {region ? 'Redraw' : 'Draw on pitch'}
                </Button>
              </div>
            </div>
          )}
        </Field>

        {selectedTokenIds && selectedTokenIds.length > 0 && (
          <Field label="Players">
            <Segmented
              value={playerFilter}
              onChange={setPlayerFilter}
              label="Players filter"
              options={[
                { value: 'all', label: 'All players' },
                { value: 'selected', label: `Selected only (${selectedTokenIds.length})` },
              ]}
            />
          </Field>
        )}

        <div className="rounded-md bg-paper px-3 py-2">
          <p className="text-[11px] font-bold text-ink-soft">
            {numPhases} phase{numPhases === 1 ? '' : 's'} · {numPlayers} player
            {numPlayers === 1 ? '' : 's'}
          </p>
        </div>
      </div>
    </Modal>
  )
}
