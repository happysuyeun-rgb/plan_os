import { Link } from 'react-router-dom'

const SECTIONS = [
  {
    id: 'start',
    title: '시작하기',
    body: '대시보드에서 프로젝트를 만들거나 체험용 프로젝트를 엽니다. 「새 프로젝트」로 아이디어를 입력하면 기획 산출물 초안을 만들 수 있습니다.',
    link: { to: '/projects/new', label: '새 프로젝트 만들기' },
  },
  {
    id: 'docs',
    title: '문서 작업',
    body: '프로젝트 안에서는 PRD·기능명세·화면목록·정책서·Cursor 프롬프트 탭을 봅니다. 생성된 탭만 열리며, 편집·댓글·버전은 문서 화면에서 이어갑니다.',
    link: { to: '/projects', label: '프로젝트 목록' },
  },
  {
    id: 'members',
    title: '멤버 초대',
    body: '대시보드의 「멤버 초대」로 이메일 초대 또는 초대 링크를 공유할 수 있습니다. 카드의 아바타로 초대 대기·활성 멤버를 구분합니다.',
    link: { to: '/dashboard', label: '대시보드로' },
  },
  {
    id: 'tasks',
    title: '업무',
    body: '프로젝트의 업무 화면에서 할 일을 등록·상태 변경합니다. 서버 업무 모드가 꺼진 환경에서는 브라우저에만 저장되는 시안 업무일 수 있습니다.',
    link: null,
  },
  {
    id: 'ai-staff',
    title: 'AI 직원',
    body: '상단 「AI 직원」에서 역할 목록을 보고, 채용 가능한 역할만 프로젝트에 요청할 수 있습니다. 준비 중 표시 역할은 아직 채용할 수 없습니다.',
    link: { to: '/ai-staff', label: 'AI 직원 허브' },
  },
  {
    id: 'settings',
    title: '설정·프로필',
    body: '프로필 메뉴 → 설정에서 이름·아바타·알림·구독 안내를 관리합니다. 휴지통은 설정 사이드바 또는 프로젝트 목록에서 열 수 있습니다.',
    link: { to: '/settings', label: '설정 열기' },
  },
]

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl" data-testid="guide-page">
      <header className="space-y-2">
        <p className="text-sm font-medium text-brand-700">이용 가이드</p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">프로젝트 이용 가이드</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-gray-500">
          PlanOS에서 프로젝트를 만들고 문서를 다루는 기본 흐름입니다. 화면 위치와 다음 행동을
          빠르게 찾는 용도입니다.
        </p>
      </header>

      <ol className="mt-10 space-y-0 divide-y divide-gray-100 border-y border-gray-100">
        {SECTIONS.map((section, index) => (
          <li key={section.id} id={section.id} className="py-6">
            <div className="flex gap-4">
              <span className="mt-0.5 text-sm font-semibold tabular-nums text-brand-700">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{section.body}</p>
                {section.link && (
                  <Link
                    to={section.link.to}
                    className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline"
                  >
                    {section.link.label}
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
