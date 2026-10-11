import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/common/Button'
import { ENABLE_DEV_LOGIN } from '../config'
import { isLocalDevAuth } from '../lib/localDevAuth'
import { getAuthErrorMessage } from '../lib/api/auth'
import { transferGuestToProject, hasGuestSession } from '../lib/guestTransfer'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'

const defaultDevEmail = import.meta.env.VITE_DEV_LOGIN_EMAIL ?? 'dev@example.com'
const defaultDevPassword = import.meta.env.VITE_DEV_LOGIN_PASSWORD ?? 'dev123456'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const signInWithDevPassword = useAuthStore((s) => s.signInWithDevPassword)
  const showToast = useUIStore((s) => s.showToast)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isDevLoading, setIsDevLoading] = useState(false)
  const [devEmail, setDevEmail] = useState(defaultDevEmail)
  const [devPassword, setDevPassword] = useState(defaultDevPassword)

  const redirect = searchParams.get('redirect') ?? '/dashboard'

  const finishLogin = async () => {
    const { user, isOnboardingCompleted } = useAuthStore.getState()

    if (!isOnboardingCompleted) {
      navigate('/onboarding')
      return
    }

    if (hasGuestSession() && user) {
      const projectId = await transferGuestToProject(user.id)
      if (projectId) {
        showToast('success', '방금 만든 기획서를 저장했습니다')
        navigate(`/projects/${projectId}/prd`)
        return
      }
    }

    navigate(redirect)
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    try {
      await signInWithGoogle(redirect)
    } catch {
      showToast('error', 'Google 로그인에 실패했습니다. Supabase OAuth 설정을 확인해주세요.')
      setIsGoogleLoading(false)
    }
  }

  const handleDevLogin = async () => {
    if (!devEmail.trim() || !devPassword) {
      showToast('error', '이메일과 비밀번호를 입력해주세요')
      return
    }

    setIsDevLoading(true)
    try {
      await signInWithDevPassword(devEmail.trim(), devPassword)
      showToast('success', '임시 로그인되었습니다')
      await finishLogin()
    } catch (error) {
      showToast('error', getAuthErrorMessage(error))
    } finally {
      setIsDevLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-center text-2xl font-bold text-brand-700">PlanOS</h1>
      <p className="mt-2 text-center text-sm text-gray-500">
        기획 자동화 플랫폼에 오신 것을 환영해요
      </p>
      {hasGuestSession() && (
        <p className="mt-2 text-center text-xs text-brand-600">
          로그인하면 체험 결과가 자동으로 저장됩니다
        </p>
      )}

      {ENABLE_DEV_LOGIN && (
        <div className="mt-6 space-y-3 rounded-lg border border-dashed border-brand-200 bg-brand-50/40 p-4">
          <p className="text-center text-xs font-medium text-brand-700">개발용 임시 로그인</p>
          <input
            type="email"
            value={devEmail}
            onChange={(e) => setDevEmail(e.target.value)}
            placeholder="이메일"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
          <input
            type="password"
            value={devPassword}
            onChange={(e) => setDevPassword(e.target.value)}
            placeholder="비밀번호"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
          <Button className="w-full" isLoading={isDevLoading} onClick={handleDevLogin}>
            임시 로그인
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-gray-500">
            {isLocalDevAuth() ? (
              <>Supabase 없이 로컬 개발 계정으로 로그인됩니다.</>
            ) : (
              <>
                최초 1회 계정 생성 (둘 중 하나):
                <br />
                ① Dashboard → Authentication → Users → Add user
                <br />
                이메일 <strong>dev@example.com</strong> / 비밀번호 <strong>dev123456</strong> / Auto Confirm ✓
                <br />
                ② API의 service_role 키를 .env.local에 넣고 <code>npm run dev:user</code>
              </>
            )}
          </p>
        </div>
      )}

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-gray-400">또는</span>
        </div>
      </div>

      <Button className="w-full" isLoading={isGoogleLoading} onClick={handleGoogleLogin}>
        Google로 계속하기
      </Button>
    </div>
  )
}
