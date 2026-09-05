/**
 * The coach's library of saved sequences.
 *
 * ── ONE STORE, AND THEREFORE NO MERGE ────────────────────────────────────────
 *
 * This used to read localStorage for immediacy and then merge a cloud list over
 * the top, cloud winning. Both halves were wrong. The merge could not tell a
 * sequence deleted on another machine from one this browser had simply never
 * seen, so a deletion came back on the next load. And the cloud list was ALWAYS
 * EMPTY — supabase/019 created the table with no GRANT, so every read was a
 * silent 42501 for three weeks (supabase/026) and the merge was quietly a
 * no-op that nobody could see.
 *
 * One fetch, one list, three states, and 'unreachable' is not 'empty'. With no
 * local copy left, telling a coach with forty sequences that they have none is
 * the failure to design against.
 */
import { useCallback, useEffect, useState } from 'react'
import type { System } from '../schema'
import { DEFAULT_US, DEFAULT_THEM } from '../schema'
import type { SequenceRow, SavedSequence } from '../sequences'
import { listSequences, deleteSequence } from '../sequences'
import { Panel, Button, ConfirmButton, Modal } from './ui'
import { useSession } from '../account/session'
import { Board } from '../board/Board'
import { newSystemId } from '../storage'
import { saveCloudSystem } from '../account/cloud'

interface Props {
  onApply: (seq: SavedSequence) => void
}

export function SequencePanel({ onApply }: Props) {
  const { session } = useSession()
  const [rows, setRows] = useState<SequenceRow[]>([])
  /**
   * Three states, not two.
   *
   * 'ready' with an empty list means the library IS empty and saying so is
   * correct. 'failed' means we could not ask, which is a different sentence and
   * a different button.
   */
  const [load, setLoad] = useState<'working' | 'ready' | 'failed'>('working')
  const [showGuide, setShowGuide] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const uid = session?.user.id

  const refresh = useCallback(async () => {
    setLoad('working')
    const list = await listSequences()
    if (!list) {
      setLoad('failed')
      return
    }
    setRows(list)
    setLoad('ready')
  }, [])

  useEffect(() => {
    if (!uid) return
    void refresh()
  }, [uid, refresh])

  const handleDelete = async (id: string) => {
    // Optimism is cheap when there is a second store to reconcile against and
    // a lie when there is not. The row goes when the delete has landed.
    setBusy(id)
    const gone = await deleteSequence(id)
    setBusy(null)
    if (!gone) {
      alert('Could not delete that sequence — check your connection and try again.')
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  /**
   * Open a sequence as an ordinary board, so it can be re-choreographed.
   *
   * The scratch system it makes has to EXIST before we navigate: the editor
   * opens by id out of `studio_systems` and nothing else, so writing it locally
   * and hoping — which is what this did — now lands on a blank board. Hence the
   * await, and hence the failure being said out loud.
   */
  const handleEdit = async (seq: SavedSequence) => {
    if (!uid) return
    const sysId = newSystemId()
    const sys = {
      v: 1,
      id: sysId,
      pitch: seq.sourcePitch,
      area: seq.sourceArea,
      teams: seq.teams || { us: DEFAULT_US, them: DEFAULT_THEM },
      acts: seq.acts,
      title: `Editing Sequence: ${seq.name}`,
      folder: 'My Sequences',
      editingSequenceId: seq.id,
    } as unknown as System

    setBusy(seq.id)
    const result = await saveCloudSystem(sysId, sys, uid)
    setBusy(null)
    if (result !== 'saved') {
      alert('Could not open that sequence for editing — check your connection and try again.')
      return
    }
    window.location.href = `/studio/new?s=${sysId}`
  }

  return (
    <Panel title="My Sequences">
      <p className="mb-2.5 text-[11px] leading-snug text-ink-faint">
        Saved sequences of phases you can reuse anywhere.
      </p>
      
      {load === 'working' ? (
        <p className="text-[11px] text-ink-faint">Loading…</p>
      ) : load === 'failed' ? (
        /* Not "you have none". We could not ask, and those are different
           sentences — see the header. */
        <div className="flex flex-col items-start gap-2">
          <p className="text-[11px] text-ink-faint">
            Could not reach your library. Your sequences are safe on your account.
          </p>
          <Button variant="ghost" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-2 items-start">
          <p className="text-[11px] text-ink-faint">No sequences saved yet.</p>
          <Button variant="solid" onClick={() => setShowGuide(true)}>
            Add a new sequence
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(({ id, sequence: seq, owner }) => (
            <div key={id} className="flex flex-col gap-1 rounded bg-paper p-2 text-sm border border-ink-hair">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-ink truncate mr-2" title={seq.name}>{seq.name}</span>
                <span className="text-[10px] text-ink-faint whitespace-nowrap">
                  {seq.acts.length} phases
                </span>
              </div>

              <div className="relative h-20 w-full bg-grass rounded overflow-hidden pointer-events-none">
                <Board
                  system={{
                    v: 1,
                    title: 'Preview',
                    id: 'preview',
                    pitch: seq.sourcePitch,
                    area: seq.sourceArea,
                    teams: seq.teams || { us: DEFAULT_US, them: DEFAULT_THEM },
                    acts: [seq.acts[0]],
                  } as unknown as System}
                  act={seq.acts[0] as any}
                  idp={id}
                />
              </div>

              <div className="flex justify-end gap-1.5 mt-1">
                {/* A team-mate's library is readable and not editable — the same
                    rule `studio_sequences_all_access` enforces on the server
                    (supabase/020). Showing the buttons and letting the row bounce
                    off RLS would be a worse way to say it. */}
                {owner === uid && (
                  <>
                    <Button variant="ghost" onClick={() => void handleEdit(seq)}>
                      {busy === id ? 'Opening…' : 'Edit'}
                    </Button>
                    <ConfirmButton
                      variant="ghost"
                      confirm="Delete"
                      onConfirm={() => void handleDelete(id)}
                    >
                      <span className="text-[11px] text-red-500">Delete</span>
                    </ConfirmButton>
                  </>
                )}
                <Button variant="solid" onClick={() => onApply(seq)}>
                  Apply
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showGuide && (
        <Modal title="How to save a sequence" onClose={() => setShowGuide(false)}>
          <div className="space-y-3 text-sm text-ink-soft">
            <p>
              A sequence is a reusable movement pattern that you can save once and apply to any other system.
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-[13px]">
              <li>Create the movement across a few phases on your board.</li>
              <li>Tap the <strong className="text-ink">Create Sequence</strong> button on the phase strip.</li>
              <li>Choose whether to capture the whole pitch or draw a region around just the players involved.</li>
              <li>Give it a name and hit Save!</li>
            </ol>
            <p className="mt-2 text-[12px] text-ink-faint">
              Your sequences will appear here. When you apply them to a new board, they automatically bring their equipment, zones, and team colours.
            </p>
            <div className="mt-4 flex justify-end">
              <Button variant="solid" onClick={() => setShowGuide(false)}>Got it</Button>
            </div>
          </div>
        </Modal>
      )}
    </Panel>
  )
}
