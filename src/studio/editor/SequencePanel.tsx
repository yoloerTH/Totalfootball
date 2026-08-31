import { useState, useEffect } from 'react'
import type { System } from '../schema'
import { DEFAULT_US, DEFAULT_THEM } from '../schema'
import type { SavedSequence } from '../sequences'
import { listSequences, deleteSequence } from '../sequences'
import { Panel, Button, ConfirmButton, Modal } from './ui'
import { HINT } from './guide'
import { listCloudSequences, deleteCloudSequence } from '../account/cloud'
import { useSession } from '../account/session'
import { Board } from '../board/Board'
import { saveSystem, newSystemId } from '../storage'

interface Props {
  onApply: (seq: SavedSequence) => void
}

export function SequencePanel({ onApply }: Props) {
  const { session } = useSession()
  const [sequences, setSequences] = useState<SavedSequence[]>([])
  const [loading, setLoading] = useState(true)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      // Load local sequences first for immediacy
      const local = listSequences()
      if (mounted) setSequences(local)

      // If signed in, merge cloud sequences
      if (session?.user.id) {
        const cloud = await listCloudSequences(session.user.id)
        if (mounted && cloud) {
          // Cloud doc is the full JSON of the sequence
          const cloudSeqs = cloud.map((c) => c.doc as unknown as SavedSequence)
          
          // Merge by ID, cloud wins
          const merged = new Map(local.map(s => [s.id, s]))
          for (const cs of cloudSeqs) {
            merged.set(cs.id, cs)
          }
          if (mounted) {
             setSequences(Array.from(merged.values()))
          }
        }
      }
      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [session?.user.id])

  const handleDelete = async (id: string) => {
    // Delete local
    deleteSequence(id)
    // Delete cloud if present
    if (session?.user.id) {
      await deleteCloudSequence(id, session.user.id)
    }
    setSequences((prev) => prev.filter((s) => s.id !== id))
  }

  const handleEdit = (seq: SavedSequence) => {
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
    
    saveSystem(sysId, sys)
    window.location.href = `/studio/new?s=${sysId}`
  }

  return (
    <Panel title="My Sequences">
      <p className="mb-2.5 text-[11px] leading-snug text-ink-faint">
        Saved sequences of phases you can reuse anywhere.
      </p>
      
      {loading ? (
        <p className="text-[11px] text-ink-faint">Loading...</p>
      ) : sequences.length === 0 ? (
        <div className="flex flex-col gap-2 items-start">
          <p className="text-[11px] text-ink-faint">No sequences saved yet.</p>
          <Button variant="solid" onClick={() => setShowGuide(true)}>
            Add a new sequence
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sequences.map((seq) => (
            <div key={seq.id} className="flex flex-col gap-1 rounded bg-paper p-2 text-sm border border-ink-hair">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-ink truncate mr-2" title={seq.name}>{seq.name}</span>
                <span className="text-[10px] text-ink-faint whitespace-nowrap">{seq.acts.length} phases</span>
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
                  idp={seq.id} 
                />
              </div>

              <div className="flex justify-end gap-1.5 mt-1">
                <Button variant="ghost" onClick={() => handleEdit(seq)}>
                  Edit
                </Button>
                <ConfirmButton
                  variant="ghost"
                  confirm="Delete"
                  onConfirm={() => handleDelete(seq.id)}
                >
                  <span className="text-[11px] text-red-500">Delete</span>
                </ConfirmButton>
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
