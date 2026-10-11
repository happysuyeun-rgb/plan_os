import type { DocumentType } from '../../types'
import { serializeScreenList, serializeWireframe } from '../documentContent'

const PLACEHOLDER_CONTENT: Record<DocumentType, string> = {
  prd: `# PRD (자동 생성)\n\n## 개요\n{title} 서비스 기획서입니다.\n\n## 목표 사용자\n{targetUser}\n\n## 핵심 기능\n- 사용자 인증\n- 핵심 서비스 기능\n- 알림`,
  ia: `# 기능명세서 (자동 생성)\n\n## 1Depth\n- 홈\n- 서비스\n- 마이페이지`,
  screen_list: serializeScreenList([
    {
      code: 'HOME-001',
      name: '홈',
      entryPath: '앱 실행',
      mainFeature: '메인 대시보드',
      authRequired: true,
      notes: '',
    },
    {
      code: 'MAIN-001',
      name: '메인',
      entryPath: '탭 네비게이션',
      mainFeature: '핵심 기능',
      authRequired: true,
      notes: '',
    },
  ]),
  policy: `# 정책서 (자동 생성)\n\n## 입력값 정책\n- 필수값 검증\n\n## 예외처리\n- 네트워크 오류 시 재시도`,
  wireframe: serializeWireframe([
    {
      id: 'slide-gen-1',
      code: 'HOME-001',
      name: '홈',
      layout: '상단 네비 + 메인 콘텐츠 + 하단 탭',
      components: [
        {
          name: '상단 네비',
          type: '네비게이션',
          state: '-',
          description: '로고 + 메뉴',
        },
      ],
      interactions: [
        {
          condition: '메인 CTA 클릭',
          action: '핵심 플로우 진입',
        },
      ],
    },
  ]),
  cursor_prompt: `# Cursor 프롬프트 (자동 생성)\n\nReact + TypeScript + Vite로 구현해주세요.`,
}

export function buildGeneratedContent(
  type: DocumentType,
  vars: { title: string; targetUser: string },
): string {
  return PLACEHOLDER_CONTENT[type]
    .replace('{title}', vars.title)
    .replace('{targetUser}', vars.targetUser)
}
