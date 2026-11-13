import type { MemberRole } from '../types'

/** 초대 링크 (로그인 후 프로젝트로 이동). 실제 토큰 검증·수락 API는 후속. */
export function buildProjectInviteLink(
  projectId: string,
  role: Exclude<MemberRole, 'owner'>,
): string {
  const url = new URL('/login', window.location.origin)
  url.searchParams.set('redirect', `/projects/${projectId}`)
  url.searchParams.set('invite', '1')
  url.searchParams.set('role', role)
  url.searchParams.set('project', projectId)
  return url.toString()
}
