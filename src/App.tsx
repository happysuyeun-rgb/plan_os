import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Routes, Route } from 'react-router-dom'
import { DesktopOnlyBanner } from './components/common/DesktopOnlyBanner'
import { ToastContainer } from './components/common/Toast'
import { AppLayout } from './components/layout/AppLayout'
import { AuthLayout } from './components/layout/AuthLayout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { PublicOnlyRoute } from './components/layout/PublicOnlyRoute'
import { OnboardingRoute } from './components/layout/OnboardingRoute'
import { useAuthStore } from './store/authStore'

/** First-paint public routes stay eager; heavy app screens load on demand. */
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'

const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProjectListPage = lazy(() => import('./pages/ProjectListPage'))
const ProjectCreatePage = lazy(() => import('./pages/ProjectCreatePage'))
const DocumentPage = lazy(() => import('./pages/DocumentPage'))
const ProjectTasksPage = lazy(() => import('./pages/ProjectTasksPage'))
const ProjectTaskDetailPage = lazy(() => import('./pages/ProjectTaskDetailPage'))
const ProjectAiReviewPage = lazy(() => import('./pages/ProjectAiReviewPage'))
const SpecialistRequestMockPage = lazy(() => import('./pages/SpecialistRequestMockPage'))
const AiStaffCatalogMockPage = lazy(() => import('./pages/AiStaffCatalogMockPage'))
const AiStaffHubPage = lazy(() => import('./pages/AiStaffHubPage'))
const AuditSourceSelectionPage = lazy(() => import('./pages/AuditSourceSelectionPage'))
const PmPlanListPage = lazy(() => import('./pages/PmPlanListPage'))
const PmPlanNewPage = lazy(() => import('./pages/PmPlanNewPage'))
const PmPlanDetailPage = lazy(() => import('./pages/PmPlanDetailPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const TrashPage = lazy(() => import('./pages/TrashPage'))

function RouteFallback() {
  return (
    <div role="status" className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
      화면을 불러오는 중…
    </div>
  )
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <>
      <DesktopOnlyBanner />
      <ToastContainer />
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/" element={<LandingPage />} />
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
        </Route>

        <Route element={<OnboardingRoute />}>
          <Route element={<AuthLayout />}>
            <Route
              path="/onboarding"
              element={
                <LazyPage>
                  <OnboardingPage />
                </LazyPage>
              }
            />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<LazyPage><DashboardPage /></LazyPage>} />
            <Route path="/projects" element={<LazyPage><ProjectListPage /></LazyPage>} />
            <Route path="/projects/new" element={<LazyPage><ProjectCreatePage /></LazyPage>} />
            <Route path="/projects/trash" element={<LazyPage><TrashPage /></LazyPage>} />
            <Route path="/ai-staff" element={<LazyPage><AiStaffHubPage /></LazyPage>} />
            <Route path="/settings" element={<LazyPage><SettingsPage /></LazyPage>} />
          </Route>
          <Route path="/projects/:projectId/tasks" element={<LazyPage><ProjectTasksPage /></LazyPage>} />
          <Route path="/projects/:projectId/tasks/:taskId" element={<LazyPage><ProjectTaskDetailPage /></LazyPage>} />
          <Route path="/projects/:projectId/ai-review" element={<LazyPage><ProjectAiReviewPage /></LazyPage>} />
          <Route path="/projects/:projectId/specialists" element={<LazyPage><AiStaffCatalogMockPage /></LazyPage>} />
          <Route path="/projects/:projectId/specialists/request" element={<LazyPage><SpecialistRequestMockPage /></LazyPage>} />
          <Route path="/projects/:projectId/plans" element={<LazyPage><PmPlanListPage /></LazyPage>} />
          <Route path="/projects/:projectId/plans/new" element={<LazyPage><PmPlanNewPage /></LazyPage>} />
          <Route path="/projects/:projectId/plans/:planId" element={<LazyPage><PmPlanDetailPage /></LazyPage>} />
          <Route path="/projects/:projectId/audits/new" element={<LazyPage><AuditSourceSelectionPage /></LazyPage>} />
          <Route path="/projects/:projectId" element={<LazyPage><DocumentPage /></LazyPage>} />
          <Route path="/projects/:projectId/:docType" element={<LazyPage><DocumentPage /></LazyPage>} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}

export default App
