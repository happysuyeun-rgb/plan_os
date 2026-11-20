import type { ServiceType } from '../../types'
import { SERVICE_TYPES } from '../../types'
import { Input } from '../common/Input'
import { Textarea } from '../common/Textarea'
import { Select } from '../common/Select'
import { Button } from '../common/Button'
import { cn } from '../../lib/utils'

export interface ProjectFormData {
  title: string
  description: string
  service_type: ServiceType | ''
  target_user: string
}

const RECOMMENDED_PROJECTS: Array<ProjectFormData & { tag: string }> = [
  {
    tag: '#음식배달',
    title: '동네 음식 배달',
    description:
      '근처 식당 주문·배달·리뷰를 한곳에서 처리하는 모바일 배달 앱. 단골 가게 추천과 실시간 배달 현황을 제공합니다.',
    service_type: '앱',
    target_user: '배달 음식을 자주 주문하는 2030 직장인',
  },
  {
    tag: '#온라인강의',
    title: '실무 온라인 강의',
    description:
      '직무별 단기 강의를 수강·진도·수료증까지 관리하는 온라인 강의 플랫폼. 실습 과제와 커뮤니티 Q&A를 포함합니다.',
    service_type: '웹',
    target_user: '이직·스킬업을 준비하는 직장인 학습자',
  },
  {
    tag: '#반려동물케어',
    title: '반려동물 케어 SaaS',
    description:
      '병원·미용·산책 일정을 통합 관리하고 보호자 알림을 보내는 반려동물 케어 SaaS입니다.',
    service_type: 'SaaS',
    target_user: '반려동물을 키우는 보호자와 펫샵 운영자',
  },
  {
    tag: '#지역커뮤니티',
    title: '우리동네 커뮤니티',
    description:
      '같은 동네 이웃과 중고거래·모임·생활정보를 나누는 지역 커뮤니티 앱입니다.',
    service_type: '앱',
    target_user: '동네 생활 정보를 찾는 거주자',
  },
]

interface ProjectFormProps {
  form: ProjectFormData
  errors: Record<string, string>
  onChange: (form: ProjectFormData) => void
  onCancel: () => void
  onNext: () => void
}

export function ProjectForm({ form, errors, onChange, onCancel, onNext }: ProjectFormProps) {
  const isValid =
    form.title.length >= 2 &&
    form.description.length >= 10 &&
    !!form.service_type &&
    form.target_user.length >= 2

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">기본 정보</h1>
      <Input
        label="프로젝트명"
        value={form.title}
        onChange={(e) => onChange({ ...form, title: e.target.value })}
        maxLength={50}
        showCount
        error={errors.title}
        placeholder="예: 동네 반려동물 산책 매칭"
      />
      <Textarea
        label="서비스 설명"
        value={form.description}
        onChange={(e) => onChange({ ...form, description: e.target.value })}
        maxLength={500}
        showCount
        error={errors.description}
        className="h-28"
        placeholder="예: 집 근처 이웃과 반려동물 산책을 함께할 수 있도록 일정·경로·후기를 연결하는 모바일 서비스"
      />
      <Select
        label="서비스 유형"
        value={form.service_type}
        onChange={(e) => onChange({ ...form, service_type: e.target.value as ServiceType })}
        options={[
          { value: '', label: '선택하세요' },
          ...SERVICE_TYPES.map((t) => ({ value: t, label: t })),
        ]}
        error={errors.service_type}
      />
      <Input
        label="목표 사용자"
        value={form.target_user}
        onChange={(e) => onChange({ ...form, target_user: e.target.value })}
        maxLength={100}
        showCount
        error={errors.target_user}
        placeholder="예: 반려견을 키우는 2040 직장인"
      />

      <div className="space-y-2 pt-1" data-testid="recommended-project-chips">
        <p className="text-xs font-medium text-slate-500">추천 프로젝트</p>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {RECOMMENDED_PROJECTS.map((item) => {
            const selected = form.title === item.title
            return (
              <button
                key={item.tag}
                type="button"
                onClick={() =>
                  onChange({
                    title: item.title,
                    description: item.description,
                    service_type: item.service_type,
                    target_user: item.target_user,
                  })
                }
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  selected
                    ? 'border-brand-400 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700',
                )}
              >
                {item.tag}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button onClick={onNext} disabled={!isValid}>
          다음
        </Button>
      </div>
    </div>
  )
}
