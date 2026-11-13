import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../common/Button'

type LandingShellProps = {
  children: ReactNode
  onLoginClick?: () => void
  /** 이미 `/`에 있어도 히어로(input)로 되돌릴 때 사용 */
  onHomeClick?: () => void
}

export function LandingShell({ children, onLoginClick, onHomeClick }: LandingShellProps) {
  const navigate = useNavigate()

  const handleLogoClick = () => {
    if (onHomeClick) {
      onHomeClick()
      return
    }
    navigate('/')
  }

  return (
    <div className="landing-root">
      <header className="relative z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white/80 px-6 backdrop-blur-sm md:px-10">
        <button
          type="button"
          onClick={handleLogoClick}
          className="landing-display text-lg font-semibold tracking-tight text-brand-700"
          aria-label="PlanOS 홈"
        >
          PlanOS
        </button>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            onClick={() => (onLoginClick ? onLoginClick() : navigate('/login'))}
          >
            로그인
          </Button>
          <Button onClick={() => navigate('/login')}>시작하기</Button>
        </div>
      </header>
      {children}
    </div>
  )
}
