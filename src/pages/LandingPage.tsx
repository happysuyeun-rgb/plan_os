import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DocumentType } from '../types'
import { DOCUMENT_TYPE_LABELS } from '../types'
import { Button } from '../components/common/Button'
import { buildGuestPreviewZip } from '../lib/export/buildZip'
import { downloadBlob, sanitizeFilename } from '../lib/export/download'
import { useUIStore } from '../store/uiStore'
import { LoginModal } from '../components/common/LoginModal'
import { GenerationStep } from '../components/project/GenerationStep'
import { InterviewPanel } from '../components/project/InterviewPanel'
import { useGenerationStore } from '../store/generationStore'
import { useInterviewStore } from '../store/interviewStore'
import { DOCUMENT_TYPE_UI_ORDER } from '../lib/documentTypes'
import { LandingShell } from '../components/landing/LandingShell'
import { LandingHero } from '../components/landing/LandingHero'
import { LandingValueStrip } from '../components/landing/LandingValueStrip'
import { LandingHowItWorks } from '../components/landing/LandingHowItWorks'
import { LandingAfterLogin } from '../components/landing/LandingAfterLogin'

const PREVIEW_DOC_TYPES: DocumentType[] = DOCUMENT_TYPE_UI_ORDER

type GuestPhase = 'input' | 'interview' | 'generating' | 'preview'

export default function LandingPage() {
  const navigate = useNavigate()
  const [idea, setIdea] = useState('')
  const [phase, setPhase] = useState<GuestPhase>('input')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const showToast = useUIStore((s) => s.showToast)

  const {
    currentStep,
    completedSteps,
    streamText,
    generatedResults,
    isGenerating,
    error: generationError,
    startPipeline,
    cancelGeneration,
    reset: resetGeneration,
  } = useGenerationStore()

  const { answers, reset: resetInterview } = useInterviewStore()

  const startGenerating = async () => {
    setPhase('generating')
    sessionStorage.setItem('planos_guest_idea', idea)
    sessionStorage.setItem('planos_guest_interview', JSON.stringify(answers))

    const serviceType = useInterviewStore.getState().serviceType || '웹'

    const result = await startPipeline({
      projectId: 'guest-preview',
      title: idea.slice(0, 50),
      description: idea,
      service_type: serviceType,
      targetUser: '일반 사용자',
      interviewAnswers: answers,
    })

    const { generatedResults: results, error } = useGenerationStore.getState()
    sessionStorage.setItem('planos_guest_result', JSON.stringify(results))

    if (result.completedCount === 0) {
      showToast('error', error ?? '생성에 실패했습니다. 다시 시도해주세요.')
      setPhase('interview')
      resetGeneration()
      return
    }

    if (result.cancelled && result.completedCount === 0) {
      setPhase('input')
      return
    }
    setPhase('preview')
  }

  const handleStartInterview = () => {
    if (!idea.trim()) return
    resetInterview()
    setPhase('interview')
  }

  const handleDownloadZip = async () => {
    setIsDownloading(true)
    try {
      const blob = await buildGuestPreviewZip(idea, generatedResults)
      const name = sanitizeFilename(idea.slice(0, 30) || 'planos-preview')
      downloadBlob(blob, `${name}_PlanOS.zip`)
      showToast('success', 'ZIP 파일을 다운로드했습니다')
    } catch {
      showToast('error', '다운로드에 실패했습니다')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleRetry = () => {
    resetGeneration()
    resetInterview()
    setPhase('input')
    setIdea('')
    sessionStorage.removeItem('planos_guest_result')
    sessionStorage.removeItem('planos_guest_idea')
    sessionStorage.removeItem('planos_guest_interview')
  }

  const handleHome = () => {
    if (isGenerating) cancelGeneration()
    resetGeneration()
    resetInterview()
    setPhase('input')
    setShowLoginModal(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <LandingShell
      onLoginClick={() => setShowLoginModal(true)}
      onHomeClick={handleHome}
    >
      {phase === 'input' && (
        <main>
          <LandingHero
            idea={idea}
            onIdeaChange={setIdea}
            onStart={handleStartInterview}
            onNeedLogin={() => setShowLoginModal(true)}
          />
          <LandingValueStrip />
          <LandingHowItWorks />
          <LandingAfterLogin onStart={() => navigate('/login')} />
        </main>
      )}

      {phase === 'interview' && (
        <main className="mx-auto max-w-lg px-6 pb-16 pt-10">
          <p className="mb-6 text-center text-sm text-gray-500">
            아이디어: <span className="font-medium text-gray-800">{idea}</span>
          </p>
          <InterviewPanel onComplete={startGenerating} onSkipAll={startGenerating} />
        </main>
      )}

      {phase === 'generating' && (
        <main className="mx-auto max-w-xl px-6 pb-16 pt-16">
          <GenerationStep
            currentStep={currentStep}
            completedSteps={completedSteps}
            streamText={streamText}
            isGenerating={isGenerating}
            error={generationError}
            onCancel={cancelGeneration}
          />
        </main>
      )}

      {phase === 'preview' && (
        <main className="mx-auto max-w-3xl px-6 pb-16 pt-10">
          <h2 className="landing-display text-xl font-semibold text-gray-900">결과 미리보기</h2>
          <p className="mt-1 text-sm text-gray-500">
            5개 산출물 전체가 펼쳐져 있습니다. 저장 및 편집은 로그인 후 가능합니다.
          </p>

          <div className="mt-6 space-y-4">
            {PREVIEW_DOC_TYPES.map((type) => (
              <div
                key={type}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <div className="border-b border-gray-100 bg-brand-50 px-4 py-2">
                  <h3 className="text-sm font-semibold text-brand-800">
                    {DOCUMENT_TYPE_LABELS[type]}
                  </h3>
                </div>
                <div className="p-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700">
                    {generatedResults[type] || '(생성된 내용 없음)'}
                  </pre>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="ghost" onClick={handleRetry}>
              다시 시도
            </Button>
            <Button variant="ghost" isLoading={isDownloading} onClick={handleDownloadZip}>
              ZIP 다운로드
            </Button>
            <Button onClick={() => setShowLoginModal(true)}>저장하려면 로그인</Button>
          </div>
        </main>
      )}

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </LandingShell>
  )
}
