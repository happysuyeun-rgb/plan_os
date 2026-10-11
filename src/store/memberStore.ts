import { create } from 'zustand'
import type { MemberRole, ProjectMember } from '../types'
import {
  fetchProjectMembers as apiFetchMembers,
  inviteProjectMember as apiInviteMember,
  removeProjectMember as apiRemoveMember,
  updateProjectMemberRole as apiUpdateMemberRole,
} from '../lib/api/members'
import { logProjectActivity } from '../lib/api/activities'

interface MemberState {
  members: ProjectMember[]
  isLoading: boolean

  fetchMembers: (projectId: string) => Promise<void>
  inviteMember: (
    projectId: string,
    email: string,
    role: Exclude<MemberRole, 'owner'>,
  ) => Promise<void>
  removeMember: (memberId: string) => Promise<void>
  updateMemberRole: (
    projectId: string,
    memberId: string,
    role: Exclude<MemberRole, 'owner'>,
    fromRole: MemberRole,
  ) => Promise<void>
  reset: () => void
}

export const useMemberStore = create<MemberState>((set, get) => ({
  members: [],
  isLoading: false,

  fetchMembers: async (projectId) => {
    set({ isLoading: true })
    const members = await apiFetchMembers(projectId)
    set({ members, isLoading: false })
  },

  inviteMember: async (projectId, email, role) => {
    const member = await apiInviteMember({ project_id: projectId, email, role })
    await logProjectActivity({
      project_id: projectId,
      action: 'member_invite',
      meta: { email, role },
    })
    set((s) => ({ members: [...s.members, member] }))
  },

  removeMember: async (memberId) => {
    const member = get().members.find((m) => m.id === memberId)
    await apiRemoveMember(memberId)
    if (member) {
      await logProjectActivity({
        project_id: member.project_id,
        action: 'member_remove',
        meta: { email: member.email, role: member.role },
      })
    }
    set((s) => ({ members: s.members.filter((m) => m.id !== memberId) }))
  },

  updateMemberRole: async (projectId, memberId, role, fromRole) => {
    const updated = await apiUpdateMemberRole(memberId, role)
    await logProjectActivity({
      project_id: projectId,
      action: 'member_role_update',
      meta: { member_id: memberId, from: fromRole, to: role },
    })
    set((s) => ({
      members: s.members.map((m) => (m.id === memberId ? updated : m)),
    }))
  },

  reset: () => set({ members: [], isLoading: false }),
}))
