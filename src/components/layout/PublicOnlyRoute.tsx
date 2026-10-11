import { Navigate, Outlet } from 'react-router-dom'
import { ENABLE_MOCK_ROUTE_GUARDS } from '../../config'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { useAuthStore } from '../../store/authStore'

export function PublicOnlyRoute() {
  const isInitialized = useAuthStore((s) => s.isInitialized)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isOnboardingCompleted = useAuthStore((s) => s.isOnboardingCompleted)

  if (!ENABLE_MOCK_ROUTE_GUARDS) {
    return <Outlet />
  }

  if (!isInitialized) {
    return <LoadingSpinner className="min-h-screen" />
  }

  if (!isAuthenticated) {
    return <Outlet />
  }

  if (!isOnboardingCompleted) {
    return <Navigate to="/onboarding" replace />
  }

  return <Navigate to="/dashboard" replace />
}
