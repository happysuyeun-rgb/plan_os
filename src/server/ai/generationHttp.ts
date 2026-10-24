/**
 * Shared HTTP contract for AI generation.
 * - Vite dev: viteAiBffPlugin → this module
 * - Vercel Preview: api/ai/generate.ts → this module
 * Paid calls remain blocked until explicit approval.
 */

import { handleGenerationRequest, type GenerationBffResponse } from './generationBff'

export type GenerateHttpBody = {
  documentType?: string
  vars?: { title?: string; targetUser?: string }
  allowPaidCalls?: boolean
  attemptId?: string
  retryIndex?: number
}

export type GenerateHttpResult = {
  status: number
  body: GenerationBffResponse | { error: string; mode: 'placeholder' }
}

export async function handleGenerateHttp(
  body: GenerateHttpBody,
  opts: { runtime: 'vite-dev' | 'vercel-preview' },
): Promise<GenerateHttpResult> {
  if (!body.documentType || !body.vars?.title || !body.vars?.targetUser) {
    return {
      status: 400,
      body: { error: 'documentType and vars.title/targetUser required', mode: 'placeholder' },
    }
  }

  // Preview/dev always force unpaid path regardless of client payload.
  try {
    const result = await handleGenerationRequest({
      documentType: body.documentType as never,
      vars: {
        title: body.vars.title,
        targetUser: body.vars.targetUser,
      },
      allowPaidCalls: false,
      attemptId: body.attemptId,
      retryIndex: body.retryIndex,
    })
    return { status: 200, body: { ...result, runtime: opts.runtime } }
  } catch (err) {
    return {
      status: 500,
      body: {
        error: err instanceof Error ? err.message : 'generation failed',
        mode: 'placeholder',
      },
    }
  }
}

export const AI_GENERATE_PATH = '/api/ai/generate' as const
