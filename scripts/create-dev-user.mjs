import { createClient } from '@supabase/supabase-js'
import { readEnvLocal } from './lib/db-url.mjs'

const env = readEnvLocal()
const url = env.VITE_SUPABASE_URL
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
const email = env.VITE_DEV_LOGIN_EMAIL ?? 'dev@example.com'
const password = env.VITE_DEV_LOGIN_PASSWORD ?? 'dev123456'

if (!url || !serviceRoleKey) {
  console.error('VITE_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 .env.local에 필요합니다.')
  console.error('Service Role Key: Supabase Dashboard → Project Settings → API → service_role')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: existing, error: listError } = await admin.auth.admin.listUsers()
if (listError) {
  console.error('사용자 목록 조회 실패:', listError.message)
  process.exit(1)
}

const found = existing.users.find((user) => user.email === email)

if (found) {
  const { error } = await admin.auth.admin.updateUserById(found.id, {
    password,
    email_confirm: true,
    user_metadata: { full_name: '서아', name: '서아' },
  })
  if (error) {
    console.error('계정 업데이트 실패:', error.message)
    process.exit(1)
  }
  console.log(`✓ ${email} 계정 비밀번호/확인 상태 갱신 완료`)
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: '서아', name: '서아' },
  })
  if (error) {
    console.error('계정 생성 실패:', error.message)
    process.exit(1)
  }
  console.log(`✓ ${email} 계정 생성 완료 (id: ${data.user.id})`)
}

console.log('이제 앱에서 "임시 로그인"을 눌러주세요.')
