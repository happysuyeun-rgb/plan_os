import { useEffect, useState } from 'react'
import { Monitor } from 'lucide-react'

const MIN_WIDTH = 1024

export function DesktopOnlyBanner() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MIN_WIDTH)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!isMobile) return null

  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
      <Monitor className="h-4 w-4 shrink-0" />
      <p>PlanOS는 데스크탑 환경(1024px 이상)에 최적화되어 있습니다.</p>
    </div>
  )
}
