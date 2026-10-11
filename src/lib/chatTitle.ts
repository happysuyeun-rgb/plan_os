const MAX_CHAT_TITLE = 40

export function deriveChatTitle(input: {
  title?: string
  description?: string
  interviewAnswers?: Record<string, string>
}): string {
  const candidates = [
    input.description?.trim(),
    input.title?.trim(),
    ...Object.values(input.interviewAnswers ?? {})
      .map((v) => v.trim())
      .filter(Boolean),
  ].filter(Boolean) as string[]

  for (const raw of candidates) {
    const line = raw.split(/\r?\n/)[0]?.trim() ?? ''
    const sentence = (line.split(/[.!?。]/)[0]?.trim() || line).trim()
    if (sentence.length >= 2) {
      return sentence.length <= MAX_CHAT_TITLE
        ? sentence
        : `${sentence.slice(0, MAX_CHAT_TITLE - 1)}…`
    }
  }

  return 'AI 채팅'
}

export function resolveChatTitle(project: {
  chat_title?: string
  title?: string
  description?: string
}): string {
  const stored = project.chat_title?.trim()
  if (stored) return stored
  return deriveChatTitle({
    title: project.title,
    description: project.description,
  })
}

export function validateChatTitle(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length < 2) return '2자 이상 입력해주세요'
  if (trimmed.length > MAX_CHAT_TITLE) return `${MAX_CHAT_TITLE}자 이하로 입력해주세요`
  return null
}
