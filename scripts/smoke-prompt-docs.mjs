/**
 * Preview smoke: each document type should reflect specialized/legacy prompts.
 * Usage: node scripts/smoke-prompt-docs.mjs
 */
const BASE = process.env.PLANOS_GENERATE_URL ?? 'https://planos-preview.vercel.app/api/ai/generate'

const vars = {
  title: '프롬프트검증앱',
  targetUser: '패션에 관심 있는 20~40대',
  description: '옷장 사진으로 코디를 추천하는 AI 비서',
  serviceType: '앱',
  interviewAnswers: {
    q1: '예',
    q2: '무료',
    q3: '모바일 앱',
    q4: '예',
    _planning_entry_path: 'direct',
  },
}

const checks = {
  prd: {
    promptKind: 'prd',
    minLen: 1200,
    must: [
      /#\s*.*프롬프트검증앱/,
      /제품 개요|1\.\s*제품/,
      /문제 정의/,
      /대상 사용자/,
      /사용자 목표/,
      /시나리오/,
      /성공 기준|제품 목표/,
      /REQ-00/,
      /MVP/,
      /비기능/,
      /수용 기준|가정/,
    ],
    forbid: [/# PRD \(자동 생성\)/, /# PRD \(템플릿\)/],
  },
  ia: {
    promptKind: 'ia',
    minLen: 800,
    must: [/#\s*.*프롬프트검증앱/, /기능정의서/, /문서 개요|F-00/, /분류|기능 상세|F-001/],
    forbid: [/\{title\}/],
  },
  policy: {
    promptKind: 'legacy',
    minLen: 200,
    must: [/정책|규칙|예외|권한|입력|검증앱/],
    forbid: [],
  },
  screen_list: {
    promptKind: 'legacy',
    minLen: 120,
    must: [/HOME|화면|screen|code|name/i],
    forbid: [],
  },
  wireframe: {
    promptKind: 'legacy',
    minLen: 120,
    must: [/slide|layout|wire|화면|컴포넌트|HOME/i],
    forbid: [],
  },
  cursor_prompt: {
    promptKind: 'legacy',
    minLen: 80,
    must: [/React|TypeScript|Vite|구현|프롬프트검증앱/i],
    forbid: [],
  },
}

function evalDoc(type, body) {
  const spec = checks[type]
  const content = body.content || ''
  const failures = []
  if (body.mode !== 'gemini' && body.mode !== 'placeholder') {
    failures.push(`bad mode ${body.mode}`)
  }
  if (body.promptKind !== spec.promptKind) {
    failures.push(`promptKind want ${spec.promptKind} got ${body.promptKind}`)
  }
  if (content.length < spec.minLen) {
    failures.push(`len ${content.length} < ${spec.minLen}`)
  }
  for (const re of spec.must) {
    if (!re.test(content)) failures.push(`missing ${re}`)
  }
  for (const re of spec.forbid) {
    if (re.test(content)) failures.push(`forbidden ${re}`)
  }
  if (/모델 응답이 지연되어 로컬 초안/.test(content) && content.length < 600) {
    failures.push('client thin stub pattern')
  }
  return {
    failures,
    len: content.length,
    mode: body.mode,
    model: body.model,
    promptKind: body.promptKind,
    head: content.slice(0, 120).replace(/\n/g, ' | '),
  }
}

const types = Object.keys(checks)
const results = []
let prior = {}

for (const type of types) {
  const t0 = Date.now()
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentType: type,
      vars: { ...vars, priorDocuments: prior, approvedSourceDocuments: prior },
    }),
  })
  const body = await res.json()
  const ms = Date.now() - t0
  const ev = evalDoc(type, body)
  const pass = res.status === 200 && ev.failures.length === 0
  results.push({
    type,
    status: res.status,
    ms,
    pass,
    ...ev,
    fallbackReason: body.fallbackReason,
  })
  if (body.content && (body.mode === 'gemini' || body.content.length >= checks[type].minLen)) {
    prior = { ...prior, [type]: String(body.content).slice(0, 4000) }
  }
  console.log(
    pass ? 'PASS' : 'FAIL',
    type,
    JSON.stringify({
      status: res.status,
      ms,
      mode: ev.mode,
      model: ev.model,
      promptKind: ev.promptKind,
      len: ev.len,
      failures: ev.failures,
      fallback: body.fallbackReason ?? null,
    }),
  )
  if (!pass) console.log('  head:', ev.head)
}

const passed = results.filter((r) => r.pass).length
console.log(`\nSUMMARY ${passed}/${results.length} PASS`)
if (passed < results.length) process.exitCode = 1
