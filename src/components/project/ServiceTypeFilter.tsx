import { SERVICE_TYPES } from '../../types'
import { Select } from '../common/Select'

interface ServiceTypeFilterProps {
  value: string
  onChange: (value: string) => void
}

export function ServiceTypeFilter({ value, onChange }: ServiceTypeFilterProps) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={[
        { value: '전체', label: '전체' },
        ...SERVICE_TYPES.map((t) => ({ value: t, label: t })),
      ]}
      className="max-w-[140px]"
    />
  )
}
