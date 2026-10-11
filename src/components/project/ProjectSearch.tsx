import { Input } from '../common/Input'

interface ProjectSearchProps {
  value: string
  onChange: (value: string) => void
}

export function ProjectSearch({ value, onChange }: ProjectSearchProps) {
  return (
    <Input
      placeholder="프로젝트명 검색..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-xs"
    />
  )
}
