import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ServiceType } from '../types'
import { UpgradeModal } from '../components/common/UpgradeModal'
import { InterviewPanel } from '../components/project/InterviewPanel'
import { ProjectForm, type ProjectFormData } from '../components/project/ProjectForm'
import { StepProgress } from '../components/project/StepProgress'
import { GenerationStep } from '../components/project/GenerationStep'
import { Button } from '../components/common/Button'
import { useProjectStore } from '../store/projectStore'
import { useInterviewStore } from '../store/interviewStore'
import { useGenerationStore } from '../store/generationStore'
import { usePlanStore } from '../store/planStore'
import { useUIStore } from '../store/uiStore'

type Step = 1 | 2 | 3

export default function ProjectCreatePage() {
  const navigate = useNavigate()
  const showToast = useUIStore((s) => s.showToast)
  const createProject = useProjectStore((s) => s.createProject)
  const canGenerate = usePlanStore((s) => s.canGenerate)

  const { answers, isComplete, setServiceType, reset: resetInterview } = useInterviewStore()

  const {
    currentStep,
    completedSteps,
    streamText,
    isGenerating,
    error: generationError,
    startPipeline,
    cancelGeneration,
    reset: resetGeneration,
  } = useGenerationStore()

  const [step, setStep] = useState<Step>(1)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)
  const [form, setForm] = useState<ProjectFormData>({
    title: '',
    description: '',
    service_type: '',
    target_user: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateStep1 = () => {
    const e: Record<string, string> = {}
    if (form.title.length < 2) e.title = '2자 이상 입력해주세요'
    if (form.description.length < 10) e.description = '10자 이상 입력해주세요'
    if (!form.service_type) e.service_type = '서비스 유형을 선택해주세요'
    if (form.target_user.length < 2) e.target_user = '2자 이상 입력해주세요'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleStep1Next = () => {
    if (!validateStep1()) return
    setServiceType(form.service_type as ServiceType)
    setStep(2)
  }

  const runGeneration = async () => {
    if (!canGenerate()) {
      setShowUpgrade(true)
      return
    }

    setStep(3)

    try {
      let projectId = createdProjectId
      if (!projectId) {
        const project = await createProject({
          title: form.title,
          description: form.description,
          service_type: form.service_type,
          target_user: form.target_user,
          interview_answers: answers,
        })
        projectId = project.id
        setCreatedProjectId(projectId)
      }

      const result = await startPipeline({
        projectId,
        title: form.title,
        description: form.description,
        service_type: form.service_type,
        targetUser: form.target_user,
        interviewAnswers: answers,
      })

      resetInterview()

      if (result.cancelled) {
        resetGeneration()
        showToast('info', `${result.completedCount}개 산출물까지 저장되었습니다`)
        if (result.completedCount > 0) {
          navigate(`/projects/${projectId}/prd`)
        } else {
          navigate('/dashboard')
        }
        return
      }

      if (result.completedCount === 0) {
        const message = useGenerationStore.getState().error ?? '생성에 실패했습니다'
        showToast('error', message)
        setStep(2)
        resetGeneration()
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 900))
      resetGeneration()
      showToast('success', '산출물 생성이 완료되었습니다', { animation: 'completion' })
      navigate(`/projects/${projectId}/prd`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '생성에 실패했습니다'
      showToast('error', message)
      setStep(2)
      resetGeneration()
    }
  }

  if (step === 3) {
    return (
      <GenerationStep
        currentStep={currentStep}
        completedSteps={completedSteps}
        streamText={streamText}
        isGenerating={isGenerating}
        error={generationError}
        onCancel={cancelGeneration}
      />
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      <StepProgress currentStep={step} />

      {step === 1 && (
        <ProjectForm
          form={form}
          errors={errors}
          onChange={setForm}
          onCancel={() => navigate('/dashboard')}
          onNext={handleStep1Next}
        />
      )}

      {step === 2 && (
        <div className="space-y-4">
          <InterviewPanel onComplete={runGeneration} onSkipAll={runGeneration} />
          <div className="flex justify-start">
            <Button variant="ghost" onClick={() => setStep(1)}>
              이전
            </Button>
          </div>
          {isComplete() && (
            <div className="flex justify-end">
              <Button onClick={runGeneration}>생성 시작</Button>
            </div>
          )}
        </div>
      )}

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  )
}
