/**
 * Vercel Preview serverless route: POST /api/ai/generate
 * Shares handleGenerateHttp with the Vite-dev middleware but is a separate runtime.
 * Never enables paid LLM calls. Migration 027 / ops DB are unrelated to this route.
 *
 * Contract: same JSON body/response as Vite BFF; response may include budget.runtime
 * hint via X-PlanOS-AI-Runtime header = vercel-preview.
 */
import { handleGenerateHttp } from '../../src/server/ai/generationHttp'

type Req = {
  method?: string
  body?: unknown
}

type Res = {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string): void
  status(code: number): Res
  json(body: unknown): void
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST')
    res.end('Method Not Allowed')
    return
  }

  const raw = req.body
  const body =
    typeof raw === 'string'
      ? (JSON.parse(raw || '{}') as Record<string, unknown>)
      : ((raw ?? {}) as Record<string, unknown>)

  const result = await handleGenerateHttp(
    {
      documentType: typeof body.documentType === 'string' ? body.documentType : undefined,
      vars:
        body.vars && typeof body.vars === 'object'
          ? (body.vars as { title?: string; targetUser?: string })
          : undefined,
      allowPaidCalls: false,
      attemptId: typeof body.attemptId === 'string' ? body.attemptId : undefined,
      retryIndex: typeof body.retryIndex === 'number' ? body.retryIndex : undefined,
    },
    { runtime: 'vercel-preview' },
  )

  res.statusCode = result.status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('X-PlanOS-AI-Runtime', 'vercel-preview')
  res.end(JSON.stringify(result.body))
}
