/**
 * Dev-only Vite middleware exposing POST /api/ai/generate → handleGenerationRequest.
 * Never enables paid calls; responses are always mode:'placeholder' unless approved later.
 */
import type { Plugin } from 'vite'
import { handleGenerationRequest } from './generationBff'

export function viteAiBffPlugin(): Plugin {
  return {
    name: 'planos-ai-bff',
    configureServer(server) {
      server.middlewares.use('/api/ai/generate', (req, res, next) => {
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
                vars?: Record<string, string>
                allowPaidCalls?: boolean
              }
              if (!body.documentType || !body.vars) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'documentType and vars required' }))
                return
              }
              const result = await handleGenerationRequest({
                documentType: body.documentType as never,
                vars: body.vars as never,
                allowPaidCalls: false,
              })
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(result))
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
