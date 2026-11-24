import type { DocumentType } from '../../types'
import { serializeScreenList, serializeWireframe } from '../documentContent'
import { getPromptBundle } from './prompts/registry'

const INTERVIEW_LABELS: Record<string, string> = {
  q1: '로그인/회원가입',
  q2: '수익모델',
  q3: '플랫폼(모바일/웹)',
  q4: '부가 기능',
  q5: '관리자 페이지',
}

export type DraftVars = {
  title: string
  targetUser: string
  description?: string
  serviceType?: string
  interviewAnswers?: Record<string, string>
}

function interviewLines(answers?: Record<string, string>): string[] {
  if (!answers) return []
  return Object.entries(answers)
    .filter(([k]) => !k.startsWith('_'))
    .map(([k, v]) => `- ${INTERVIEW_LABELS[k] ?? k}: ${v}`)
}

function baseMeta(vars: DraftVars): string {
  return [
    `- 프로젝트명: ${vars.title}`,
    `- 서비스 유형: ${vars.serviceType ?? '미정'}`,
    `- 서비스 설명: ${vars.description?.trim() || '[결정 필요]'}`,
    `- 대상 사용자: ${vars.targetUser}`,
  ].join('\n')
}

/** Document-shaped draft aligned to specialized prompt outlines when Gemini is unavailable. */
export function buildPromptAlignedDraft(type: DocumentType, vars: DraftVars): string {
  const interview = interviewLines(vars.interviewAnswers)
  const interviewBlock =
    interview.length > 0 ? interview.join('\n') : '- (인터뷰 답변 없음)'

  if (type === 'prd') {
    return [
      `# ${vars.title} PRD`,
      '',
      '> 본 초안은 전용 PRD 프롬프트 구조(제품 개요~결정 필요)를 따르며, 인터뷰·입력값을 반영했습니다.',
      '',
      '## 1. 제품 개요',
      baseMeta(vars),
      '',
      '## 2. 문제 정의',
      `${vars.description?.trim() || vars.title} 이용 시 사용자가 겪는 핵심 문제를 정의합니다.`,
      '- [결정 필요] 현재 대안과 한계',
      '',
      '## 3. 대상 사용자',
      vars.targetUser,
      '',
      '## 4. 사용자 목표',
      '- 인터뷰·설명 기반으로 핵심 목표를 달성한다.',
      '',
      '## 5. 핵심 사용자 시나리오',
      '1. 진입 → 2. 주요 행동 → 3. 목표 달성 → 4. 종료',
      '',
      '## 6. 제품 목표와 성공 기준',
      '- [결정 필요] 검증 가능한 성공 지표',
      '',
      '## 7. 핵심 기능 목록',
      '| ID | 기능 | 목적 | 우선순위 |',
      '| --- | --- | --- | --- |',
      '| REQ-001 | 핵심 서비스 | 사용자 목표 달성 | P0 |',
      '| REQ-002 | 계정/접근 | 인터뷰 로그인 요구 반영 | P0 |',
      '',
      '## 8. MVP 범위',
      '- Must: REQ-001, REQ-002',
      '- Later / Out: [결정 필요]',
      '',
      '## 9. 핵심 비즈니스 규칙 및 제약사항',
      interviewBlock,
      '',
      '## 10. 비기능 요구사항',
      '- 보안·접근성·성능: [결정 필요]',
      '',
      '## 11. 기능별 수용 기준',
      '- REQ-001: 핵심 플로우가 끝까지 완료된다.',
      '',
      '## 12. 가정·위험 요소·추가 결정 필요 사항',
      '- 인터뷰 외 상세 정책은 후속 확정',
      '',
      '### 프롬프트 정렬 메모',
      getPromptBundle('prd').outline.split('\n').slice(0, 8).join('\n'),
    ].join('\n')
  }

  if (type === 'ia') {
    return [
      `# ${vars.title} 전체 기능정의서`,
      '',
      '## 문서 개요',
      `${vars.title}의 기능 범위를 정의합니다. 대상: ${vars.targetUser}`,
      '',
      '## 01. 핵심 서비스',
      '',
      '### F-001. 기본 기능',
      '',
      '**분류**',
      '',
      '대분류: 핵심 서비스',
      '',
      '중분류: 기본',
      '',
      '**기능 상세 설명**',
      '',
      vars.description?.trim() || '서비스의 기본 기능을 제공합니다.',
      '',
      '**주요 처리 규칙**',
      '',
      interviewBlock,
      '',
      '### F-002. 접근/계정',
      '',
      '**분류**',
      '',
      '대분류: 계정',
      '',
      '중분류: 인증',
      '',
      '**기능 상세 설명**',
      '',
      '인터뷰의 로그인·플랫폼 요구를 반영한 접근 흐름.',
      '',
      '**주요 처리 규칙**',
      '',
      '- [결정 필요] 상세 인증 정책',
    ].join('\n')
  }

  if (type === 'policy') {
    return [
      `# ${vars.title} 정책서`,
      '',
      '## 입력값 정책',
      '- 필수값 검증',
      interviewBlock,
      '',
      '## 권한·접근',
      '- 로그인 요구·역할은 인터뷰 답변을 따른다.',
      '',
      '## 예외처리',
      '- 네트워크 오류 시 재시도',
      '- [결정 필요] 결제/소셜 예외',
    ].join('\n')
  }

  if (type === 'screen_list') {
    return serializeScreenList([
      {
        code: 'HOME-001',
        name: '홈',
        entryPath: '앱 실행',
        mainFeature: `${vars.title} 메인`,
        authRequired: vars.interviewAnswers?.q1 === '예',
        notes: vars.targetUser,
      },
      {
        code: 'MAIN-001',
        name: '핵심 기능',
        entryPath: '홈 CTA',
        mainFeature: vars.description?.trim() || '핵심 서비스',
        authRequired: true,
        notes: interview.slice(0, 2).join(' / '),
      },
      {
        code: 'SET-001',
        name: '설정',
        entryPath: '프로필',
        mainFeature: '계정·알림',
        authRequired: true,
        notes: '',
      },
    ])
  }

  if (type === 'wireframe') {
    return serializeWireframe([
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
            description: `${vars.title} 로고 + 메뉴`,
          },
          {
            name: '히어로/요약',
            type: '콘텐츠',
            state: '-',
            description: vars.description?.trim() || '핵심 가치 요약',
          },
        ],
        interactions: [
          {
            condition: '메인 CTA 클릭',
            action: '핵심 플로우 진입',
          },
        ],
      },
    ])
  }

  return [
    `# ${vars.title} Cursor 프롬프트`,
    '',
    'React + TypeScript + Vite로 구현해주세요.',
    '',
    '## 프로젝트 컨텍스트',
    baseMeta(vars),
    '',
    '## 인터뷰 반영',
    interviewBlock,
    '',
    '## 구현 지침',
    '- 위 PRD/기능정의서의 REQ·F-ID를 화면·컴포넌트에 매핑하세요.',
    '- 정보가 부족한 항목은 TODO로 남기세요.',
  ].join('\n')
}

export function isThinGeneratedContent(type: DocumentType, content: string): boolean {
  const text = content.replace(/^\(모델 응답[^\n]*\)\n+/u, '').trim()
  if (type === 'screen_list' || type === 'wireframe') {
    return text.length < 200
  }
  return text.length < 600 || /# PRD \(자동 생성\)|# PRD \(템플릿\)|# POLICY \(템플릿\)/i.test(text)
}
