import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ENABLE_MOCK_ROUTE_GUARDS } from '../../config'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { useAuthStore } from '../../store/authStore'

export function ProtectedRoute() {
  const location = useLocation()
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
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  if (!isOnboardingCompleted) {
    return <Navigate to="/onboarding" replace state={{ from: location }} />
  }

  return <Outlet />
}
