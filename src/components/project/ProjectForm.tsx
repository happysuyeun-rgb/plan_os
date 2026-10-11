import type { ServiceType } from '../../types'
import { SERVICE_TYPES } from '../../types'
import { Input } from '../common/Input'
import { Textarea } from '../common/Textarea'
import { Select } from '../common/Select'
import { Button } from '../common/Button'

export interface ProjectFormData {
  title: string
  description: string
  service_type: ServiceType | ''
  target_user: string
}

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
      />
      <Textarea
        label="서비스 설명"
        value={form.description}
        onChange={(e) => onChange({ ...form, description: e.target.value })}
        maxLength={500}
        showCount
        error={errors.description}
        className="h-28"
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
      />
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
