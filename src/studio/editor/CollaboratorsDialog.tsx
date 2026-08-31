import { useEffect, useState } from 'react'
import { Modal, Button } from './ui'
import { db } from '../account/client'
import { useSession } from '../account/session'

interface Props {
  systemId: string
  onClose: () => void
}

type CollaboratorStatus = 'pending' | 'accepted' | 'declined'

interface Collaborator {
  id: string
  member_id: string
  status: CollaboratorStatus
  can_edit: boolean
  handle?: string
  team?: string
}

export function CollaboratorsDialog({ systemId, onClose }: Props) {
  const { user } = useSession()
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteTerm, setInviteTerm] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || !systemId) return
    loadCollaborators()
  }, [user, systemId])

  async function loadCollaborators() {
    const client = db()
    if (!client || !systemId) return
    setLoading(true)
    
    const { data, error } = await client
      .from('studio_system_collaborators')
      .select('*')
      .eq('system_id', systemId)

    if (data && data.length > 0) {
      const memberIds = data.map(c => c.member_id)
      const { data: profiles } = await client
        .from('studio_profiles')
        .select('id, handle, team')
        .in('id', memberIds)
      
      const profilesMap: Record<string, any> = {}
      if (profiles) {
        profiles.forEach(p => { profilesMap[p.id] = p })
      }

      setCollaborators(data.map(c => {
        const profile = profilesMap[c.member_id]
        return {
          ...c,
          handle: profile?.handle,
          team: profile?.team
        }
      }))
    } else {
      setCollaborators([])
    }
    
    if (error) console.error(error)
    setLoading(false)
  }

  async function handleInvite(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!inviteTerm.trim()) return
    setError('')
    setInviting(true)

    const client = db()
    if (!client || !systemId || !user) return

    try {
      const { data: targetId, error: rpcError } = await client.rpc('studio_resolve_invitee', { search_term: inviteTerm })
      
      if (rpcError) throw new Error(rpcError.message)
      if (!targetId) throw new Error('User not found. Check the email or handle.')
      if (targetId === user?.id) throw new Error('You cannot invite yourself.')

      const { error: insertError } = await client
        .from('studio_system_collaborators')
        .insert({
          system_owner: user.id,
          system_id: systemId,
          member_id: targetId,
          status: 'pending',
          can_edit: true // Default to can edit for now
        })
      
      if (insertError) {
        if (insertError.code === '23505') throw new Error('This user is already a collaborator on this system.')
        throw new Error(insertError.message)
      }

      setInviteTerm('')
      await loadCollaborators()
    } catch (err: any) {
      setError(err.message || 'Failed to send invite.')
    } finally {
      setInviting(false)
    }
  }

  async function removeCollaborator(id: string) {
    const client = db()
    if (!client) return
    await client.from('studio_system_collaborators').delete().eq('id', id)
    await loadCollaborators()
  }

  async function toggleCanEdit(id: string, currentValue: boolean) {
    const client = db()
    if (!client) return
    await client.from('studio_system_collaborators').update({ can_edit: !currentValue }).eq('id', id)
    await loadCollaborators()
  }

  return (
    <Modal title="Project Collaborators" onClose={onClose}>
      <div className="w-[420px] max-w-[90vw]">
        <p className="text-[13px] text-ink-soft mb-6">
          Invite other coaches to work on this specific project with you. They will have access only to this system.
        </p>

        <form onSubmit={handleInvite} className="flex gap-2 mb-6">
          <input
            type="text"
            value={inviteTerm}
            onChange={(e) => setInviteTerm(e.target.value)}
            placeholder="Email, @handle, or profile link..."
            className="flex-1 rounded-lg border border-ink-hair bg-surface px-4 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-ink/30"
            disabled={inviting}
          />
          <Button disabled={inviting || !inviteTerm.trim()} variant="solid" onClick={() => handleInvite()}>
            {inviting ? 'Inviting...' : 'Invite'}
          </Button>
        </form>
        {error && <p className="mb-4 text-[13px] font-bold text-ink-soft">{error}</p>}

        <div className="space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-soft mb-2">Collaborators</h4>
          
          {loading ? (
            <div className="text-[13px] text-ink-soft">Loading...</div>
          ) : collaborators.length === 0 ? (
            <div className="text-[13px] text-ink-soft italic">No collaborators yet.</div>
          ) : (
            <div className="divide-y divide-ink-hair rounded-xl border border-ink-hair bg-surface overflow-hidden">
              {collaborators.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-[13px] font-bold text-ink">{c.handle ? `@${c.handle}` : 'Coach'}</p>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft mt-0.5">{c.status}</p>
                  </div>
                  <div className="flex items-center gap-5">
                    <label className="flex items-center gap-1.5 text-[12px] cursor-pointer text-ink-soft hover:text-ink transition-colors">
                      <input 
                        type="checkbox"
                        className="accent-ink"
                        checked={c.can_edit}
                        onChange={() => toggleCanEdit(c.id, c.can_edit)}
                      /> 
                      Can Edit
                    </label>
                    <button 
                      type="button"
                      onClick={() => removeCollaborator(c.id)}
                      className="text-[12px] text-ink-soft hover:text-ink font-bold transition-colors underline underline-offset-4"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
