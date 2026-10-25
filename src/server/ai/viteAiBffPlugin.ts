/**
 * Dev-only Vite middleware: POST /api/ai/generate → handleGenerateHttp(runtime: vite-dev).
 * Preview deployments use api/ai/generate.ts instead — do not treat this plugin as a
 * production/Preview BFF.
 */
import type { Plugin } from 'vite'
import { AI_GENERATE_PATH, handleGenerateHttp } from './generationHttp'

export function viteAiBffPlugin(): Plugin {
  return {
    name: 'planos-ai-bff-vite-dev',
    configureServer(server) {
      server.middlewares.use(AI_GENERATE_PATH, (req, res, next) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (c) => chunks.push(Buffer.from(c)))
        req.on('end', () => {
          void (async () => {
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
                documentType?: string
                vars?: { title?: string; targetUser?: string }
                allowPaidCalls?: boolean
                attemptId?: string
                retryIndex?: number
              }
              const result = await handleGenerateHttp(body, { runtime: 'vite-dev' })
              res.statusCode = result.status
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('X-PlanOS-AI-Runtime', 'vite-dev')
              res.end(JSON.stringify(result.body))
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                error: err instanceof Error ? err.message : 'generation failed',
                mode: 'placeholder',
              }))
            }
          })()
        })
        req.on('error', () => next())
      })
    },
  }
}
