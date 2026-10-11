import { Outlet } from 'react-router-dom'
import { GlobalNavBar } from './GlobalNavBar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <GlobalNavBar />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
