import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/common/Button'
import { UpgradeModal } from '../components/common/UpgradeModal'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { useAuthStore } from '../store/authStore'
import { usePlanStore } from '../store/planStore'
import { useUIStore } from '../store/uiStore'
import { deleteAccount as apiDeleteAccount } from '../lib/api/auth'
import { cn } from '../lib/utils'

type Tab = 'profile' | 'plan'

export default function SettingsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)!
  const signOut = useAuthStore((s) => s.signOut)
  const getRemainingGenerations = usePlanStore((s) => s.getRemainingGenerations)
  const showToast = useUIStore((s) => s.showToast)

  const [tab, setTab] = useState<Tab>('profile')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const remaining = getRemainingGenerations()

  const handleSignOut = async () => {
    await signOut()
    showToast('info', '로그아웃되었습니다')
    navigate('/login')
  }

  const handleDeleteAccount = async () => {
    try {
      await apiDeleteAccount(user.id)
      await signOut()
      showToast('success', '계정이 삭제되었습니다')
      setShowDeleteModal(false)
      navigate('/')
    } catch {
      showToast('error', '계정 삭제에 실패했습니다')
      setShowDeleteModal(false)
    }
  }

  return (
    <div className="flex gap-8">
      <aside className="w-40 shrink-0">
        <nav className="space-y-1">
          {(['profile', 'plan'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'w-full rounded-lg px-3 py-2 text-left text-sm font-medium',
                tab === t ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50',
              )}
            >
              {t === 'profile' ? '프로필' : '플랜'}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>

        {tab === 'profile' && (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
                {user.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="ghost" onClick={handleSignOut}>로그아웃</Button>
              <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
                계정 삭제
              </Button>
            </div>
          </div>
        )}

        {tab === 'plan' && (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium capitalize">
                  {user.plan} 플랜
                </span>
                <p className="mt-2 text-sm text-gray-500">
                  AI 생성: {user.ai_generations_this_month}/
                  {remaining === 'unlimited' ? '무제한' : '10'}회 (이번 달)
                </p>
              </div>
              <Button onClick={() => setShowUpgrade(true)}>업그레이드</Button>
            </div>
            {remaining !== 'unlimited' && (
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-brand-600"
                  style={{ width: `${(user.ai_generations_this_month / 10) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <ConfirmModal
        isOpen={showDeleteModal}
        title="계정 삭제"
        message="모든 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        danger
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  )
}
