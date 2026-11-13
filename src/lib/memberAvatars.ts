import type { MemberStatus, ProjectMember } from '../types'

export type MemberAvatarPerson = {
  id: string
  name: string
  status: MemberStatus
}

export function toAvatarPeople(members: ProjectMember[]): MemberAvatarPerson[] {
  return members.map((m) => ({
    id: m.id,
    name: m.name || m.email,
    status: m.status,
  }))
}
