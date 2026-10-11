import { useNavigate } from 'react-router-dom'
import { Lightbulb, MessageSquare, FileText } from 'lucide-react'
import { Button } from '../components/common/Button'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { hasGuestSession, transferGuestToProject } from '../lib/guestTransfer'

const STEPS = [
  {
    icon: Lightbulb,
    title: '아이디어 입력',
    description: '만들고 싶은 서비스 아이디어를 간단히 설명하세요.',
  },
  {
    icon: MessageSquare,
    title: 'AI 인터뷰',
    description: 'AI가 5가지 질문으로 서비스를 더 깊이 이해합니다.',
  },
  {
    icon: FileText,
    title: '산출물 생성',
    description: 'PRD, 기능명세서, 화면목록, 정책서, Cursor 프롬프트가 자동 생성됩니다.',
  },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding)
  const showToast = useUIStore((s) => s.showToast)
  const guestPending = hasGuestSession()

  const handleStart = async () => {
    try {
      await completeOnboarding()

      if (guestPending) {
        const projectId = await transferGuestToProject(user!.id)
        if (projectId) {
          showToast('success', '방금 만든 기획서를 저장했습니다')
          navigate(`/projects/${projectId}/prd`)
          return
        }
      }

      navigate('/projects/new')
    } catch {
      showToast('error', '온보딩 완료 처리에 실패했습니다')
    }
  }

  return (
    <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-center text-xl font-bold text-gray-900">
        PlanOS에 오신 것을 환영합니다
      </h1>
      <p className="mt-2 text-center text-sm text-gray-500">
        3단계로 기획서를 자동 생성해보세요
      </p>

      {guestPending && (
        <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          방금 만든 기획서를 저장할게요. 아래 버튼을 누르면 프로젝트로 이관됩니다.
        </div>
      )}

      <div className="mt-8 space-y-4">
        {STEPS.map((step, index) => (
          <div key={step.title} className="flex items-start gap-4 rounded-lg border border-gray-100 p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              {index + 1}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <step.icon className="h-4 w-4 text-brand-600" />
                <h3 className="font-medium text-gray-900">{step.title}</h3>
              </div>
              <p className="mt-1 text-sm text-gray-500">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      <Button className="mt-8 w-full" onClick={handleStart}>
        {guestPending ? '기획서 저장하고 시작하기' : '첫 프로젝트 시작하기'}
      </Button>
    </div>
  )
}
