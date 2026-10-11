import { useNavigate } from 'react-router-dom'
import { Button } from '../components/common/Button'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="text-gray-500">존재하지 않는 페이지입니다</p>
      <Button onClick={() => navigate('/dashboard')}>대시보드로 이동</Button>
    </div>
  )
}
