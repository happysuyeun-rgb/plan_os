export type PlanType = 'free' | 'pro' | 'team'
export type DocumentType =
  | 'prd'
  | 'ia'
  | 'screen_list'
  | 'policy'
  | 'wireframe'
  | 'cursor_prompt'

export interface ScreenListRow {
  code: string
  name: string
  entryPath: string
  mainFeature: string
  authRequired: boolean
  notes: string
}

export interface WireframeComponent {
  name: string
  type: string
  state: string
  description: string
}

export interface WireframeInteraction {
  condition: string
  action: string
}

export interface WireframeSlide {
  id: string
  code: string
  name: string
  layout: string
  components: WireframeComponent[]
  interactions: WireframeInteraction[]
}
export type ChatRole = 'user' | 'assistant'

export interface User {
  id: string
  email: string
  name: string
  avatar_url: string
  plan: PlanType
  ai_generations_this_month: number
  onboarding_completed: boolean
  created_at: string
}

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  animation?: 'completion'
}

export type ServiceType = '앱' | '웹' | '커머스' | 'SaaS' | '플랫폼' | '기타'

export const SERVICE_TYPES: ServiceType[] = ['앱', '웹', '커머스', 'SaaS', '플랫폼', '기타']

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  prd: 'PRD',
  ia: '기능명세서',
  screen_list: '화면목록',
  policy: '정책서',
  wireframe: '화면설계서',
  cursor_prompt: 'Cursor 프롬프트',
}

export const DOCUMENT_TYPE_PATHS: Record<DocumentType, string> = {
  prd: 'prd',
  ia: 'ia',
  screen_list: 'screen-list',
  policy: 'policy',
  wireframe: 'wireframe',
  cursor_prompt: 'cursor-prompt',
}

export interface Project {
  id: string
  user_id: string
  title: string
  description: string
  service_type: string
  target_user: string
  memory_summary: string
  chat_title: string
  interview_answers: Record<string, string>
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
  updated_at: string
}

export type ProjectLifecycle = 'active' | 'trashed'

export interface TrashedProject extends Project {
  deleted_at: string
  days_until_purge: number
}

export type MemberRole = 'owner' | 'editor' | 'viewer'
export type MemberStatus = 'active' | 'pending'

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  owner: '소유자',
  editor: '편집자',
  viewer: '뷰어',
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string | null
  email: string
  name: string
  role: MemberRole
  status: MemberStatus
  invited_at: string
}

export interface Document {
  id: string
  project_id: string
  type: DocumentType
  content: string
  /** Server CAS revision (migration 018). Advances exactly once per content change. */
  content_revision: number
  created_at: string
  updated_at: string
}

export interface DocumentVersion {
  id: string
  document_id: string
  version_number: number
  version_name: string | null
  content: string
  created_at: string
}

export interface DocumentVersionSummary {
  document_id: string
  latest_version_number: number
  version_count: number
}

/** 사이드바 산출물 탭용 버전 표시 */
export interface SidebarVersionInfo {
  latest_version_number: number
  /** 현재 탭에서 과거 버전을 보고 있으면 해당 번호 */
  viewing_version_number: number | null
  /** 최신 본문(L1)을 보고 있음 */
  is_on_latest: boolean
}

export interface ChatMessage {
  id: string
  project_id: string
  document_id: string | null
  role: ChatRole
  content: string
  created_at: string
}

export type ActivityAction =
  | 'create'
  | 'update'
  | 'version_save'
  | 'version_restore'
  | 'regenerate'
  | 'regenerate_cascade'
  | 'chat'
  | 'export'
  | 'member_invite'
  | 'member_remove'
  | 'member_role_update'
  | 'pipeline_complete'
  | 'pipeline_cancel'
  | 'comment_create'
  | 'comment_reply'
  | 'comment_resolve'
  | 'comment_reopen'
  | 'comment_reaction'
  | 'comment_complete'
  | 'project_rename'
  | 'project_trash'
  | 'project_restore'
  | 'project_purge'

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  create: '프로젝트 생성',
  update: '문서 수정',
  version_save: '버전 저장',
  version_restore: '버전 복원',
  regenerate: '재생성',
  regenerate_cascade: '연쇄 재생성',
  chat: 'AI 채팅',
  export: '파일보내기',
  member_invite: '멤버 초대',
  member_remove: '멤버 제거',
  member_role_update: '권한 변경',
  pipeline_complete: '생성 완료',
  pipeline_cancel: '생성 취소',
  comment_create: '댓글 작성',
  comment_reply: '댓글 답글',
  comment_resolve: '댓글 완료',
  comment_reopen: '댓글 재오픈',
  comment_reaction: '댓글 리액션',
  comment_complete: '댓글 내 완료',
  project_rename: '프로젝트명 변경',
  project_trash: '휴지통 이동',
  project_restore: '프로젝트 복원',
  project_purge: '영구 삭제',
}

export type ThreadStatus = 'open' | 'resolved'
export type ParticipantStatus = 'pending' | 'completed'
export type CommentAnchorType = 'region' | 'none' | 'project'

export interface RegionAnchor {
  type: 'region'
  rect_norm: { x: number; y: number; w: number; h: number }
  line_start: number
  line_end: number
  excerpt: string
  pin_index: number
}

export interface CommentReaction {
  id: string
  comment_id: string
  user_id: string
  user_name: string
  emoji: string
  created_at: string
}

export interface CommentParticipant {
  user_id: string
  name: string
  avatar_url: string
  status: ParticipantStatus
}

export interface ProjectComment {
  id: string
  project_id: string
  document_id: string | null
  thread_root_id: string | null
  parent_id: string | null
  user_id: string
  author_name: string
  author_avatar_url: string
  body: string
  anchor_type: CommentAnchorType
  anchor_meta: RegionAnchor | Record<string, never>
  status: ThreadStatus
  resolved_by: string | null
  resolved_at: string | null
  reactions: CommentReaction[]
  created_at: string
  updated_at: string
  deleted_at: string | null
  replies?: ProjectComment[]
}

export interface CommentThread {
  root: ProjectComment
  replies: ProjectComment[]
  participants: CommentParticipant[]
}

export type CommentFilter = 'open' | 'resolved' | 'all' | 'mine_pending'

export interface CommentCounts {
  by_document: Partial<Record<DocumentType, { open: number }>>
  project_open: number
}

export interface ProjectActivity {
  id: string
  project_id: string
  user_id: string | null
  document_id: string | null
  action: ActivityAction
  meta: Record<string, unknown>
  created_at: string
}

export type GenerationRunStatus = 'running' | 'completed' | 'cancelled' | 'failed'

export interface GenerationRun {
  id: string
  project_id: string
  status: GenerationRunStatus
  completed_steps: DocumentType[]
  interview_answers: Record<string, string>
  started_at: string
  finished_at: string | null
}

export type NotificationType =
  | 'comment.mention'
  | 'comment.reply'
  | 'comment.thread_activity'
  | 'comment.resolve'
  | 'comment.reopen'
  | 'chat.document_updated'

export interface UserNotification {
  id: string
  user_id: string
  project_id: string
  project_title: string
  document_id: string | null
  doc_type: DocumentType | null
  type: NotificationType
  actor_id: string | null
  actor_name: string
  title: string
  body: string
  link_path: string
  thread_root_id: string | null
  comment_id: string | null
  chat_message_id: string | null
  read_at: string | null
  created_at: string
}

export interface NotificationSummary {
  total_unread: number
  by_project: Record<string, { unread: number; comment: number; chat: number }>
}
