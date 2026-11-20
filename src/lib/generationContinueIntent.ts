/**
 * Parse user chat replies while the guided pipeline is awaiting confirmation.
 */

export type ContinueIntent = 'continue' | 'pause' | 'unknown'

const CONTINUE_RE =
  /^(진행(해\s*줘|할까요)?|네|예|좋아요|응|어|다음|계속|시작|작성|만들어|ok|okay|yes|y|go|continue)\s*[.!]*$/i
const PAUSE_RE =
  /^(아직|나중에|아니요|아니|그만|중지|멈춰|stop|no|n|pause|later)\s*[.!]*$/i

export function parseContinueIntent(
  raw: string,
  opts?: { nextStepLabel?: string | null },
): ContinueIntent {
  const text = raw.trim().replace(/\s+/g, ' ')
  if (!text) return 'unknown'
  if (CONTINUE_RE.test(text)) return 'continue'
  if (PAUSE_RE.test(text)) return 'pause'

  const label = opts?.nextStepLabel?.trim()
  if (label) {
    const compact = text.replace(/\s+/g, '')
    const labelCompact = label.replace(/\s+/g, '')
    if (compact.includes(labelCompact) && !/(나중에|아직|그만|아니요)/.test(text)) {
      return 'continue'
    }
  }

  // Soft match: natural “작성해줘 / 만들어줘 / 진행해” replies
  if (
    text.length <= 60 &&
    /(진행|다음|계속|시작|작성해|만들어|해\s*줘|해주세요|부탁)/.test(text) &&
    !/(수정|바꿔|추가|삭제|나중에|아직|그만)/.test(text)
  ) {
    return 'continue'
  }
  if (text.length <= 40 && /(아직|나중에|그만)/.test(text)) {
    return 'pause'
  }
  return 'unknown'
}
