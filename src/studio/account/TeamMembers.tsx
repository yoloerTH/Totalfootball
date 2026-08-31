import { useEffect, useState } from 'react'
import { db } from './client'
import { useSession } from './session'

type MemberStatus = 'pending' | 'accepted' | 'declined'

interface TeamMember {
  id: string
  owner_id: string
  member_id: string
  status: MemberStatus
  can_view_systems: boolean
  can_edit_systems: boolean
  can_view_squad: boolean
  can_edit_squad: boolean
  can_view_sequences: boolean
  can_edit_sequences: boolean
  can_view_settings: boolean
  can_edit_settings: boolean
  // Joined fields
  handle?: string
  team?: string
}

export default function TeamMembers() {
  const { user } = useSession()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [projectInvites, setProjectInvites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteTerm, setInviteTerm] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    loadMembers()
  }, [user])

  async function loadMembers() {
    const client = db()
    if (!client || !user) return
    setLoading(true)
    
    // Fetch members where user is owner or member
    const { data: asOwner } = await client
      .from('studio_team_members')
      .select('*')
      .eq('owner_id', user.id)

    const { data: asMember } = await client
      .from('studio_team_members')
      .select('*')
      .eq('member_id', user.id)

    // Also fetch project-specific invites received by user
    const { data: projectInvitesData } = await client
      .from('studio_system_collaborators')
      .select('id, system_id, system_owner, status')
      .eq('member_id', user.id)

    const allMembers = [...(asOwner || []), ...(asMember || [])]
    
    // Extract unique user IDs that we need profiles for
    const profileIds = new Set<string>()
    allMembers.forEach(m => {
      if (m.owner_id !== user.id) profileIds.add(m.owner_id)
      if (m.member_id !== user.id) profileIds.add(m.member_id)
    })
    
    // Add profile IDs for project invites
    if (projectInvitesData) {
      projectInvitesData.forEach(p => profileIds.add(p.system_owner))
    }

    // Fetch their profiles
    let profilesMap: Record<string, any> = {}
    if (profileIds.size > 0) {
      const { data: profiles } = await client
        .from('studio_profiles')
        .select('id, handle, team')
        .in('id', Array.from(profileIds))
      
      if (profiles) {
        profiles.forEach(p => { profilesMap[p.id] = p })
      }
    }

    // Attach profile info
    const combined = allMembers.map(m => {
      const targetId = m.owner_id === user.id ? m.member_id : m.owner_id
      const profile = profilesMap[targetId]
      return {
        ...m,
        handle: profile?.handle,
        team: profile?.team
      }
    })
    
    // Attach profile info to project invites
    if (projectInvitesData) {
      const invitesWithProfiles = projectInvitesData.map(p => {
        const profile = profilesMap[p.system_owner]
        return {
          ...p,
          handle: profile?.handle,
          team: profile?.team
        }
      })
      setProjectInvites(invitesWithProfiles)
    }

    setMembers(combined)
    setLoading(false)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteTerm.trim()) return
    setError('')
    setInviting(true)

    const client = db()
    if (!client) return

    try {
      // 1. Resolve invitee
      const { data: targetId, error: rpcError } = await client.rpc('studio_resolve_invitee', { search_term: inviteTerm })
      
      if (rpcError) throw new Error(rpcError.message)
      if (!targetId) throw new Error('User not found. Check the email or handle.')
      if (targetId === user?.id) throw new Error('You cannot invite yourself.')

      // 2. Insert invite
      const { error: insertError } = await client
        .from('studio_team_members')
        .insert({
          owner_id: user?.id,
          member_id: targetId,
          status: 'pending'
        })
      
      if (insertError) {
        if (insertError.code === '23505') throw new Error('An invite already exists for this user.')
        throw new Error(insertError.message)
      }

      setInviteTerm('')
      await loadMembers()
    } catch (err: any) {
      setError(err.message || 'Failed to send invite.')
    } finally {
      setInviting(false)
    }
  }

  async function updateStatus(id: string, newStatus: MemberStatus) {
    const client = db()
    if (!client) return
    await client.from('studio_team_members').update({ status: newStatus }).eq('id', id)
    await loadMembers()
  }

  async function updateProjectInviteStatus(id: string, newStatus: string) {
    const client = db()
    if (!client) return
    await client.from('studio_system_collaborators').update({ status: newStatus }).eq('id', id)
    await loadMembers()
  }

  async function togglePermission(id: string, field: keyof TeamMember, currentValue: boolean) {
    const client = db()
    if (!client) return
    const { error } = await client.from('studio_team_members').update({ [field]: !currentValue }).eq('id', id)
    if (!error) loadMembers()
  }

  const myInvites = members.filter(m => m.owner_id === user?.id)
  const receivedInvites = members.filter(m => m.member_id === user?.id)

  return (
    <div className="space-y-6">
      <div className="max-w-xl">
        <h3 className="text-sm font-bold text-ink">Team Members</h3>
        <p className="mt-1 text-xs text-ink-soft">
          Invite coaches to collaborate. You can choose what they see and edit.
        </p>

        <form onSubmit={handleInvite} className="mt-4 flex gap-2">
          <input
            type="text"
            value={inviteTerm}
            onChange={(e) => setInviteTerm(e.target.value)}
            placeholder="Email, @handle, or profile link..."
            className="flex-1 rounded-lg border border-ink-hair bg-surface px-4 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-ink/30"
            disabled={inviting}
          />
          <button
            type="submit"
            disabled={inviting || !inviteTerm.trim()}
            className="shrink-0 rounded-lg bg-ink px-4 py-2.5 text-[13px] font-bold text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {inviting ? 'Inviting...' : 'Invite'}
          </button>
        </form>
        {error && <p className="mt-2 text-[13px] font-bold text-ink-soft">{error}</p>}
      </div>

      {loading ? (
        <div className="text-xs text-ink-soft">Loading team...</div>
      ) : (
        <div className="space-y-8 max-w-2xl">
          {myInvites.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-soft mb-3">People you invited</h4>
              <div className="divide-y divide-ink-hair rounded-xl border border-ink-hair bg-paper overflow-hidden">
                {myInvites.map(m => (
                  <div key={m.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[14px] font-bold text-ink">{m.handle ? `@${m.handle}` : 'Team Member'}</p>
                        {m.team && <p className="text-[12px] text-ink-soft mt-0.5">{m.team}</p>}
                        <p className="text-[11px] font-bold text-ink-soft mt-1.5 uppercase tracking-wide">{m.status}</p>
                      </div>
                    </div>
                    {m.status === 'accepted' && (
                      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg bg-surface p-4 text-[13px] border border-ink-hair">
                        {['systems', 'squad', 'sequences', 'settings'].map((resource) => (
                          <div key={resource} className="flex items-center justify-between border-b border-ink-hair pb-3 last:border-0 last:pb-0">
                            <span className="capitalize font-medium text-ink">{resource}</span>
                            <div className="flex gap-3">
                              <label className="flex items-center gap-1.5 cursor-pointer text-ink-soft hover:text-ink transition-colors">
                                <input 
                                  type="checkbox" 
                                  className="accent-ink"
                                  checked={m[`can_view_${resource}` as keyof TeamMember] as boolean}
                                  onChange={() => togglePermission(m.id, `can_view_${resource}` as keyof TeamMember, m[`can_view_${resource}` as keyof TeamMember] as boolean)}
                                /> View
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer text-ink-soft hover:text-ink transition-colors">
                                <input 
                                  type="checkbox" 
                                  className="accent-ink"
                                  checked={m[`can_edit_${resource}` as keyof TeamMember] as boolean}
                                  onChange={() => togglePermission(m.id, `can_edit_${resource}` as keyof TeamMember, m[`can_edit_${resource}` as keyof TeamMember] as boolean)}
                                /> Edit
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {receivedInvites.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-soft mb-3">Invitations to you</h4>
              <div className="divide-y divide-ink-hair rounded-xl border border-ink-hair bg-paper overflow-hidden">
                {receivedInvites.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-[14px] font-bold text-ink">{m.handle ? `@${m.handle}` : 'Coach'} invited you</p>
                      {m.team && <p className="text-[12px] text-ink-soft mt-0.5">{m.team}</p>}
                    </div>
                    {m.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button onClick={() => updateStatus(m.id, 'accepted')} className="rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-paper hover:opacity-90 transition-opacity">Accept</button>
                        <button onClick={() => updateStatus(m.id, 'declined')} className="rounded-lg border border-ink-hair px-4 py-2 text-[13px] font-bold text-ink hover:bg-ink-hair transition-colors">Decline</button>
                      </div>
                    ) : (
                      <span className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{m.status}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {projectInvites.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-soft mb-3">Project Invitations to you</h4>
              <div className="divide-y divide-ink-hair rounded-xl border border-ink-hair bg-paper overflow-hidden">
                {projectInvites.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-[14px] font-bold text-ink">{m.handle ? `@${m.handle}` : 'Coach'} invited you to a project</p>
                      {m.team && <p className="text-[12px] text-ink-soft mt-0.5">{m.team}</p>}
                    </div>
                    {m.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button onClick={() => updateProjectInviteStatus(m.id, 'accepted')} className="rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-paper hover:opacity-90 transition-opacity">Accept</button>
                        <button onClick={() => updateProjectInviteStatus(m.id, 'declined')} className="rounded-lg border border-ink-hair px-4 py-2 text-[13px] font-bold text-ink hover:bg-ink-hair transition-colors">Decline</button>
                      </div>
                    ) : (
                      <span className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{m.status}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
