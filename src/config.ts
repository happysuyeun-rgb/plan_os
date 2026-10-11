/** true: mock API 사용 / false: Supabase API 사용 */
export const USE_MOCK_API = false

/** true: 미생성 산출물 탭도 모두 열기 / false: 생성된 탭만 접근 가능 */
export const TEST_UNLOCK_ALL_DOCUMENTS = false

/** true: 인증·온보딩 라우트 가드 활성화 / false: 모든 라우트 자유 접근 */
export const ENABLE_MOCK_ROUTE_GUARDS = true

/** true: 로그인 페이지에 이메일/비밀번호 임시 로그인 표시 */
export const ENABLE_DEV_LOGIN =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true'

/** @deprecated Supabase Auth 사용 — activities 등에서 session.user.id 사용 */
export const MOCK_USER_ID = 'mock-user-1'
