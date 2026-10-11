import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FolderKanban } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
]

export function GlobalNavBar() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

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
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-50"
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
        </div>
      </div>
    </header>
  )
}
