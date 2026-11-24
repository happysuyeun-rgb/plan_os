/**
 * Create a real Supabase project, generate docs via Preview BFF, verify prompt shapes.
 * Requires .env.local with VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)

const SUPABASE = env.VITE_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const GENERATE = process.env.PLANOS_GENERATE_URL ?? 'https://planos-preview.vercel.app/api/ai/generate'
const OWNER = 'b52ed451-4aad-44e7-95d8-20d54b61a11c' // dev@example.com

const projectInput = {
  title: `프롬프트E2E-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}`,
  description: '동네 가게 리뷰와 웨이팅을 한곳에서 보는 로컬 맛집 앱',
  service_type: '앱',
  target_user: '맛집 탐색을 자주 하는 20~30대',
  interview_answers: {
    q1: '예',
    q2: '광고',
    q3: '모바일 앱',
    q4: '예',
    _planning_entry_path: 'direct',
  },
}

async function sb(path, init = {}) {
  const res = await fetch(`${SUPABASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: init.method === 'POST' ? 'return=representation' : 'return=representation',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    throw new Error(`Supabase ${res.status} ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`)
  }
  return body
}

async function generate(type, vars, attempt = 1) {
  const res = await fetch(GENERATE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentType: type, vars }),
  })
  const body = await res.json()
  const thin =
    !body.content ||
    body.mode !== 'gemini' ||
    (type === 'prd' || type === 'ia' ? body.content.length < 800 : body.content.length < 200)
  if (thin && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1500 * attempt))
    return generate(type, vars, attempt + 1)
  }
  return { status: res.status, ...body }
}

function assertDoc(type, content, promptKind) {
  const failures = []
  if (type === 'prd') {
    if (promptKind !== 'prd') failures.push(`promptKind=${promptKind}`)
    if (content.length < 800) failures.push(`len=${content.length}`)
    for (const re of [/#\s*.+/, /제품 개요|1\.\s*제품/, /문제 정의|대상 사용자/, /REQ-00|기능/, /MVP/]) {
      if (!re.test(content)) failures.push(`missing ${re}`)
    }
    if (/# PRD \(자동 생성\)/.test(content)) failures.push('thin stub')
  } else if (type === 'ia') {
    if (promptKind !== 'ia') failures.push(`promptKind=${promptKind}`)
    if (content.length < 600) failures.push(`len=${content.length}`)
    for (const re of [/기능정의서/, /F-00|문서 개요/, /분류|기능 상세/]) {
      if (!re.test(content)) failures.push(`missing ${re}`)
    }
  } else {
    if (content.length < 120) failures.push(`len=${content.length}`)
  }
  return failures
}

const types = ['prd', 'ia', 'policy', 'screen_list', 'wireframe', 'cursor_prompt']

console.log('CREATE project', projectInput.title)
const projectId = randomUUID()
const now = new Date().toISOString()
const [project] = await sb('projects', {
  method: 'POST',
  body: JSON.stringify({
    id: projectId,
    user_id: OWNER,
    title: projectInput.title,
    description: projectInput.description,
    service_type: projectInput.service_type,
    target_user: projectInput.target_user,
    interview_answers: projectInput.interview_answers,
    memory_summary: '',
    chat_title: projectInput.title,
    created_at: now,
    updated_at: now,
  }),
})

await sb('project_members', {
  method: 'POST',
  headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
  body: JSON.stringify({
    project_id: project.id,
    user_id: OWNER,
    email: 'dev@example.com',
    name: '서아',
    role: 'owner',
    status: 'active',
  }),
})

console.log('CREATED', project.id)

const baseVars = {
  title: projectInput.title,
  targetUser: projectInput.target_user,
  description: projectInput.description,
  serviceType: projectInput.service_type,
  interviewAnswers: projectInput.interview_answers,
}

let prior = {}
const results = []

for (const type of types) {
  const t0 = Date.now()
  const gen = await generate(type, {
    ...baseVars,
    priorDocuments: prior,
    approvedSourceDocuments: prior,
  })
  const ms = Date.now() - t0
  const content = gen.content || ''
  const failures = assertDoc(type, content, gen.promptKind)
  const pass = gen.status === 200 && failures.length === 0 && gen.mode === 'gemini'

  if (content) {
    await sb('documents', {
      method: 'POST',
      body: JSON.stringify({
        id: randomUUID(),
        project_id: project.id,
        type,
        content,
        content_revision: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    })
    prior = { ...prior, [type]: content.slice(0, 4000) }
  }

  results.push({
    type,
    pass,
    mode: gen.mode,
    model: gen.model,
    promptKind: gen.promptKind,
    len: content.length,
    ms,
    failures,
    fallback: gen.fallbackReason ?? null,
  })
  console.log(pass ? 'PASS' : 'FAIL', type, JSON.stringify(results.at(-1)))
}

const passed = results.filter((r) => r.pass).length
console.log('\nPROJECT', `https://planos-preview.vercel.app/projects/${project.id}/prd`)
console.log('LOCAL', `http://127.0.0.1:5173/projects/${project.id}/prd`)
console.log(`SUMMARY ${passed}/${results.length} PASS`)
if (passed < results.length) process.exitCode = 1
