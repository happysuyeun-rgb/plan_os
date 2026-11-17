import type { MemberRole, ProjectMember } from '../../types'
import { isLocalDevAuth } from '../localDevAuth'
import {
  localFetchMembers,
  localInviteMember,
  localRemoveMember,
  localUpdateMemberRole,
} from '../localDevData'
import { supabase } from '../supabase'
import { throwIfError, unwrap } from '../supabaseHelpers'

export interface InviteMemberInput {
  project_id: string
  email: string
  role: Exclude<MemberRole, 'owner'>
}

/**
 * Slice 4 — no paid SMTP.
 * - queue (default): DB pending row only; share invite link
 * - supabase_otp: Supabase Auth free-tier magic link (rate-limited); no paid SMTP vendors
 */
export type InviteEmailMode = 'queue' | 'supabase_otp'

export type InviteDelivery =
  | { mode: 'local_dev'; status: 'recorded' }
  | { mode: 'queue'; status: 'pending_no_email' }
  | { mode: 'supabase_otp'; status: 'otp_sent' }
  | { mode: 'supabase_otp'; status: 'otp_failed'; detail: string }

export type InviteMemberResult = {
  member: ProjectMember
  delivery: InviteDelivery
}

export function getInviteEmailMode(): InviteEmailMode {
  return import.meta.env.VITE_INVITE_EMAIL_MODE === 'supabase_otp' ? 'supabase_otp' : 'queue'
}

export function formatInviteDeliveryToast(email: string, delivery: InviteDelivery): string {
  if (delivery.mode === 'local_dev') {
    return `${email}을(를) 초대 대기로 기록했습니다 (localDev · 메일 없음)`
  }
  if (delivery.mode === 'queue') {
    return `${email}을(를) 초대 대기로 저장했습니다. 메일은 보내지 않았습니다 — 초대 링크를 공유하세요.`
  }
  if (delivery.status === 'otp_sent') {
    return `${email}으로 Supabase 로그인 메일을 보냈습니다 (무료 Auth · 유료 SMTP 아님).`
  }
  return `${email}은(는) 초대 대기로 저장됐지만 메일 발송에 실패했습니다: ${delivery.detail}`
}

export async function fetchProjectMembers(projectId: string): Promise<ProjectMember[]> {
  if (isLocalDevAuth()) return localFetchMembers(projectId)

  const { data, error } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .order('invited_at', { ascending: true })
  throwIfError(error)
  return data ?? []
}

export async function inviteProjectMember(input: InviteMemberInput): Promise<InviteMemberResult> {
  if (isLocalDevAuth()) {
    const member = await localInviteMember(input)
    return { member, delivery: { mode: 'local_dev', status: 'recorded' } }
  }

  const name = input.email.split('@')[0]
  const { data, error } = await supabase
    .from('project_members')
    .insert({
      project_id: input.project_id,
      email: input.email,
      name,
      role: input.role,
      status: 'pending',
    })
    .select()
    .single()
  const member = unwrap(data, error)

  const mode = getInviteEmailMode()
  if (mode !== 'supabase_otp') {
    return { member, delivery: { mode: 'queue', status: 'pending_no_email' } }
  }

  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/projects/${input.project_id}?invite=1&role=${input.role}`
      : undefined
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email: input.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectTo,
      data: {
        planos_invite_project_id: input.project_id,
        planos_invite_role: input.role,
      },
    },
  })
  if (otpError) {
    return {
      member,
      delivery: {
        mode: 'supabase_otp',
        status: 'otp_failed',
        detail: otpError.message,
      },
    }
  }
  return { member, delivery: { mode: 'supabase_otp', status: 'otp_sent' } }
}

export async function updateProjectMemberRole(
  memberId: string,
  role: Exclude<MemberRole, 'owner'>,
): Promise<ProjectMember> {
  if (isLocalDevAuth()) return localUpdateMemberRole(memberId, role)

  const { data, error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('id', memberId)
    .select()
    .single()
  return unwrap(data, error)
}

export async function removeProjectMember(memberId: string): Promise<void> {
  if (isLocalDevAuth()) {
    localRemoveMember(memberId)
    return
  }

  const { error } = await supabase.from('project_members').delete().eq('id', memberId)
  throwIfError(error)
}
