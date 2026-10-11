import { useMemo } from 'react'
import type { Project, ProjectMember } from '../types'
import {
  type ProjectPermission,
  resolveMemberRole,
  hasPermission,
  canManageMembers,
} from '../lib/permissions'
import { useAuthStore } from '../store/authStore'

export function useProjectPermissions(
  project: Project | null,
  members: ProjectMember[],
) {
  const user = useAuthStore((s) => s.user)

  return useMemo(() => {
    const role = resolveMemberRole(project, members, user)
    return {
      role,
      isOwner: role === 'owner',
      can: (permission: ProjectPermission) => hasPermission(role, permission),
      canManageMembers: canManageMembers(role),
    }
  }, [project, members, user])
}
