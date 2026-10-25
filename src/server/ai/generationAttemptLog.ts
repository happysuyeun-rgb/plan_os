/**
 * In-memory generation attempt history (fail / retry / abort).
 * Not durable — Preview/dev only until a ledger migration is approved.
 */

import type { GenerationAttemptRecord } from '../../lib/ai/GenerationProvider'

const MAX = 200
const records: GenerationAttemptRecord[] = []

export function appendGenerationAttempt(record: GenerationAttemptRecord): void {
  records.push(record)
  if (records.length > MAX) records.splice(0, records.length - MAX)
}

export function listGenerationAttempts(limit = 50): readonly GenerationAttemptRecord[] {
  return records.slice(-Math.max(1, limit))
}

export function clearGenerationAttemptsForTests(): void {
  records.length = 0
}
