import postgres from 'postgres'
import { readEnvLocal, resolveDbUrl } from './lib/db-url.mjs'

const env = readEnvLocal()
const email = env.VITE_DEV_LOGIN_EMAIL ?? 'dev@example.com'
const sql = postgres(resolveDbUrl(env.SUPABASE_DB_URL), { ssl: 'require', max: 1 })

await sql`delete from auth.identities where user_id in (select id from auth.users where email = ${email})`
await sql`delete from public.users where email = ${email}`
await sql`delete from auth.users where email = ${email}`

console.log(`✓ ${email} 계정 삭제 완료`)
await sql.end()
