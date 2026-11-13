import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, Bot, BookOpen, LogOut, Settings } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/ai-staff', label: 'AI 직원', icon: Bot },
  { to: '/guide', label: '이용 가이드', icon: BookOpen },
]

export function GlobalNavBar() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const showToast = useUIStore((s) => s.showToast)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  const handleSignOut = async () => {
    setMenuOpen(false)
    await signOut()
    showToast('info', '로그아웃되었습니다')
    navigate('/login')
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="text-lg font-bold text-brand-700"
          >
            PlanOS
          </button>
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <NotificationBell />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="프로필 메뉴"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              title="프로필 메뉴"
              className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-50"
              data-testid="nav-profile-menu-trigger"
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
                  {user?.name?.charAt(0) ?? '?'}
                </div>
              )}
            </button>

            {menuOpen && user && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                data-testid="nav-profile-menu"
              >
                <div className="border-b border-gray-100 px-3 py-2">
                  <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="truncate text-xs text-gray-500">{user.email}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/settings')
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  data-testid="nav-profile-menu-settings"
                >
                  <Settings className="h-4 w-4" />
                  설정
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleSignOut()}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  data-testid="nav-profile-menu-logout"
                >
                  <LogOut className="h-4 w-4" />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
