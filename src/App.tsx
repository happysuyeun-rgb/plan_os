import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { DesktopOnlyBanner } from './components/common/DesktopOnlyBanner'
import { ToastContainer } from './components/common/Toast'
import { AppLayout } from './components/layout/AppLayout'
import { AuthLayout } from './components/layout/AuthLayout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { PublicOnlyRoute } from './components/layout/PublicOnlyRoute'
import { OnboardingRoute } from './components/layout/OnboardingRoute'
import { useAuthStore } from './store/authStore'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import ProjectListPage from './pages/ProjectListPage'
import ProjectCreatePage from './pages/ProjectCreatePage'
import DocumentPage from './pages/DocumentPage'
import ProjectTasksPage from './pages/ProjectTasksPage'
import ProjectTaskDetailPage from './pages/ProjectTaskDetailPage'
import AuditSourceSelectionPage from './pages/AuditSourceSelectionPage'
import PmPlanListPage from './pages/PmPlanListPage'
import PmPlanNewPage from './pages/PmPlanNewPage'
import PmPlanDetailPage from './pages/PmPlanDetailPage'
import SettingsPage from './pages/SettingsPage'
import TrashPage from './pages/TrashPage'
import NotFoundPage from './pages/NotFoundPage'

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
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectListPage />} />
            <Route path="/projects/new" element={<ProjectCreatePage />} />
            <Route path="/projects/trash" element={<TrashPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="/projects/:projectId/tasks" element={<ProjectTasksPage />} />
          <Route path="/projects/:projectId/tasks/:taskId" element={<ProjectTaskDetailPage />} />
          <Route path="/projects/:projectId/plans" element={<PmPlanListPage />} />
          <Route path="/projects/:projectId/plans/new" element={<PmPlanNewPage />} />
          <Route path="/projects/:projectId/plans/:planId" element={<PmPlanDetailPage />} />
          <Route path="/projects/:projectId/audits/new" element={<AuditSourceSelectionPage />} />
          <Route path="/projects/:projectId" element={<DocumentPage />} />
          <Route path="/projects/:projectId/:docType" element={<DocumentPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}

export default App
