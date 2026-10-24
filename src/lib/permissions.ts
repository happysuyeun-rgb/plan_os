import type { MemberRole, Project, ProjectMember } from '../types'

export type ProjectPermission =
  | 'project.view'
  | 'project.edit_meta'
  | 'project.delete'
  | 'project.trash'
  | 'project.restore'
  | 'project.purge'
  | 'document.edit'
  | 'document.regenerate'
  | 'document.version_save'
  | 'document.version_restore'
  | 'chat.send'
  | 'export.md'
  | 'export.zip'
  | 'member.view'
  | 'member.invite'
  | 'member.remove'
  | 'member.update_role'
  | 'comment.view'
  | 'comment.create'
  | 'comment.edit_own'
  | 'comment.delete_own'
  | 'comment.delete_any'
  | 'comment.resolve'
  | 'comment.complete_own'
  | 'ai.review.view'
  | 'ai.review.run'
  | 'ai.review.accept'

const ROLE_PERMISSIONS: Record<MemberRole, ProjectPermission[]> = {
  owner: [
    'project.view',
    'project.edit_meta',
    'project.delete',
    'project.trash',
    'project.restore',
    'project.purge',
    'document.edit',
    'document.regenerate',
    'document.version_save',
    'document.version_restore',
    'chat.send',
    'export.md',
    'export.zip',
    'member.view',
    'member.invite',
    'member.remove',
    'member.update_role',
    'comment.view',
    'comment.create',
    'comment.edit_own',
    'comment.delete_own',
    'comment.delete_any',
    'comment.resolve',
    'comment.complete_own',
    'ai.review.view',
    'ai.review.run',
    'ai.review.accept',
  ],
  editor: [
    'project.view',
    'document.edit',
    'document.regenerate',
    'document.version_save',
    'document.version_restore',
    'chat.send',
    'export.md',
    'export.zip',
    'member.view',
    'comment.view',
    'comment.create',
    'comment.edit_own',
    'comment.delete_own',
    'comment.resolve',
    'comment.complete_own',
    'ai.review.view',
    'ai.review.run',
    'ai.review.accept',
  ],
  viewer: [
    'project.view',
    'export.md',
    'member.view',
    'comment.view',
    'comment.create',
    'comment.edit_own',
    'comment.delete_own',
    'comment.resolve',
    'comment.complete_own',
    'ai.review.view',
  ],
}

export function resolveMemberRole(
  project: Project | null,
  members: ProjectMember[],
  user: { id: string; email: string } | null,
): MemberRole | null {
  if (!project || !user) return null

  const byUser = members.find((m) => m.user_id === user.id && m.status === 'active')
  if (byUser) return byUser.role

  const byEmail = members.find(
    (m) => m.email.toLowerCase() === user.email.toLowerCase() && m.status === 'active',
  )
  if (byEmail) return byEmail.role

  if (project.user_id === user.id) return 'owner'

  return null
}

export function hasPermission(role: MemberRole | null, permission: ProjectPermission): boolean {
  if (!role) return false
  const resolved =
    permission === 'project.delete' ? 'project.trash' : permission
  return ROLE_PERMISSIONS[role].includes(resolved)
}

export function canManageMembers(role: MemberRole | null): boolean {
  return hasPermission(role, 'member.update_role')
}
