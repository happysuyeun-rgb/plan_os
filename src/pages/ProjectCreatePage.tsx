import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ServiceType } from '../types'
import { UpgradeModal } from '../components/common/UpgradeModal'
import { InterviewPanel } from '../components/project/InterviewPanel'
import { PlanningEntryPathPicker } from '../components/project/PlanningEntryPathPicker'
import { ProjectForm, type ProjectFormData } from '../components/project/ProjectForm'
import { StepProgress } from '../components/project/StepProgress'
import { Button } from '../components/common/Button'
import { MidProjectAiStaffingNotice } from '../components/common/MidProjectAiStaffingNotice'
import { useProjectStore } from '../store/projectStore'
import { useInterviewStore } from '../store/interviewStore'
import { useGenerationStore } from '../store/generationStore'
import { usePlanStore } from '../store/planStore'
import { useUIStore } from '../store/uiStore'
import {
  assertCanCreateProjectAgainstEnv,
  isLocalDevAuth,
  PLACEHOLDER_PROJECT_CREATE_BLOCKED,
} from '../lib/localDevAuth'
import {
  withPlanningEntryPath,
  type PlanningEntryPath,
} from '../lib/planningEntryPath'

type Step = 1 | 2

export default function ProjectCreatePage() {
  const navigate = useNavigate()
  const showToast = useUIStore((s) => s.showToast)
  const createProject = useProjectStore((s) => s.createProject)
  const canGenerate = usePlanStore((s) => s.canGenerate)

  const { answers, isComplete, setServiceType, reset: resetInterview } = useInterviewStore()
  const queueGuidedPipeline = useGenerationStore((s) => s.queueGuidedPipeline)

  const [step, setStep] = useState<Step>(1)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)
  const [entryPath, setEntryPath] = useState<PlanningEntryPath | null>(null)
  const [form, setForm] = useState<ProjectFormData>({
    title: '',
    description: '',
    service_type: '',
    target_user: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isEntering, setIsEntering] = useState(false)

  const validateStep1 = () => {
    const e: Record<string, string> = {}
    if (!entryPath) e.entryPath = '기획 시작 경로를 선택해주세요'
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

  /** Create project only — PRD generation starts inside DocumentPage. */
  const enterProjectAndGenerate = async () => {
    if (!canGenerate()) {
      setShowUpgrade(true)
      return
    }
    if (isEntering) return
    setIsEntering(true)

    try {
      let projectId = createdProjectId
      if (!projectId) {
        if (!isLocalDevAuth()) {
          try {
            assertCanCreateProjectAgainstEnv()
          } catch (guardErr) {
            const message =
              guardErr instanceof Error ? guardErr.message : PLACEHOLDER_PROJECT_CREATE_BLOCKED
            showToast('error', message)
            return
          }
        }
        const path = entryPath ?? 'direct'
        const interviewWithEntry = withPlanningEntryPath(answers, path)
        const project = await createProject({
          title: form.title,
          description: form.description,
          service_type: form.service_type,
          target_user: form.target_user,
          interview_answers: interviewWithEntry,
        })
        projectId = project.id
        setCreatedProjectId(projectId)
      }

      const path = entryPath ?? 'direct'
      const pipelineInput = {
        projectId,
        title: form.title,
        description: form.description,
        service_type: form.service_type,
        targetUser: form.target_user,
        interviewAnswers: withPlanningEntryPath(answers, path),
      }
      queueGuidedPipeline(pipelineInput)
      resetInterview()
      // PRD generation starts only after DocumentPage mounts (not on this create screen).
      navigate(`/projects/${projectId}/prd`, {
        replace: true,
        state: { guidedPipeline: pipelineInput },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '프로젝트 생성에 실패했습니다'
      showToast('error', message)
    } finally {
      setIsEntering(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <StepProgress currentStep={step} totalSteps={2} />
      <MidProjectAiStaffingNotice />

      {step === 1 && (
        <div className="space-y-6">
          <PlanningEntryPathPicker
            value={entryPath}
            onChange={(path) => {
              setEntryPath(path)
              setErrors((prev) => {
                const next = { ...prev }
                delete next.entryPath
                return next
              })
            }}
            error={errors.entryPath}
          />
          <ProjectForm
            form={form}
            errors={errors}
            onChange={setForm}
            onCancel={() => navigate('/dashboard')}
            onNext={handleStep1Next}
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <InterviewPanel
            onComplete={enterProjectAndGenerate}
            onSkipAll={enterProjectAndGenerate}
          />
          <div className="flex justify-start">
            <Button variant="ghost" onClick={() => setStep(1)} disabled={isEntering}>
              이전
            </Button>
          </div>
          {isComplete() && (
            <div className="flex justify-end">
              <Button onClick={enterProjectAndGenerate} isLoading={isEntering}>
                프로젝트에서 PRD 작성
              </Button>
            </div>
          )}
        </div>
      )}

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  )
}
