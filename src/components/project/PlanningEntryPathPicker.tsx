import {
  PLANNING_ENTRY_HINTS,
  PLANNING_ENTRY_LABELS,
  type PlanningEntryPath,
} from '../../lib/planningEntryPath'

type Props = {
  value: PlanningEntryPath | null
  onChange: (path: PlanningEntryPath) => void
  error?: string
}

/**
 * E-01: choose start path. Not exclusive modes — same project_id afterwards.
 */
export function PlanningEntryPathPicker({ value, onChange, error }: Props) {
  const options: PlanningEntryPath[] = ['direct', 'with_pm']

  return (
    <fieldset className="space-y-3" data-testid="planning-entry-path-picker">
      <legend className="text-sm font-semibold text-gray-900">기획 시작 경로</legend>
      <p className="text-xs text-gray-500">
        두 경로 모두 같은 프로젝트로 이어집니다. 나중에 AI 직원을 추가할 수 있으며, 선택만으로 유료
        실행·결제가 시작되지 않습니다.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((path) => {
          const selected = value === path
          return (
            <button
              key={path}
              type="button"
              data-testid={`planning-entry-${path}`}
              aria-pressed={selected}
              onClick={() => onChange(path)}
              className={`rounded-xl border p-4 text-left transition ${
                selected
                  ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-200'
                  : 'border-gray-200 hover:border-indigo-300'
              }`}
            >
              <span className="block text-sm font-bold text-gray-900">
                {PLANNING_ENTRY_LABELS[path]}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-gray-600">
                {PLANNING_ENTRY_HINTS[path]}
              </span>
            </button>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  )
}
