import { Modal } from './Modal'
import { Button } from './Button'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
}

const PLANS = [
  { name: 'Free', price: '무료', projects: '3개', ai: '월 10회', versions: '10개' },
  { name: 'Pro', price: '월 9,900원', projects: '무제한', ai: '무제한', versions: '50개' },
  { name: 'Team', price: '월 29,000원~', projects: '무제한', ai: '무제한', versions: '무제한' },
]

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="플랜 업그레이드" className="max-w-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-4">플랜</th>
              <th className="pb-2 pr-4">가격</th>
              <th className="pb-2 pr-4">프로젝트</th>
              <th className="pb-2 pr-4">AI 생성</th>
              <th className="pb-2">버전 보관</th>
            </tr>
          </thead>
          <tbody>
            {PLANS.map((plan) => (
              <tr key={plan.name} className="border-b border-gray-100">
                <td className="py-3 pr-4 font-medium">{plan.name}</td>
                <td className="py-3 pr-4">{plan.price}</td>
                <td className="py-3 pr-4">{plan.projects}</td>
                <td className="py-3 pr-4">{plan.ai}</td>
                <td className="py-3">{plan.versions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          닫기
        </Button>
        <Button onClick={onClose}>Pro로 업그레이드</Button>
      </div>
    </Modal>
  )
}
