export interface PendingChatAttachment {
  id: string
  file: File
  previewUrl?: string
}

const MAX_FILES = 5
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_TEXT_EXCERPT = 4000

const TEXT_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
])

export function validateChatAttachment(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name}: 5MB 이하만 첨부할 수 있습니다`
  }
  return null
}

export function canAddMoreAttachments(currentCount: number): boolean {
  return currentCount < MAX_FILES
}

export async function buildAttachmentContent(
  attachments: PendingChatAttachment[],
): Promise<string> {
  const lines: string[] = []

  for (const { file } of attachments) {
    lines.push(`📎 ${file.name} (${formatFileSize(file.size)})`)

    if (TEXT_TYPES.has(file.type) || /\.(md|txt|csv|json)$/i.test(file.name)) {
      try {
        const text = await file.text()
        const excerpt = text.trim().slice(0, MAX_TEXT_EXCERPT)
        if (excerpt) {
          lines.push('```')
          lines.push(excerpt)
          if (text.length > MAX_TEXT_EXCERPT) lines.push('…(이하 생략)')
          lines.push('```')
        }
      } catch {
        // 읽기 실패 시 파일명만 포함
      }
    }
  }

  return lines.join('\n')
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function createPendingAttachment(file: File): PendingChatAttachment {
  const attachment: PendingChatAttachment = {
    id: crypto.randomUUID(),
    file,
  }
  if (file.type.startsWith('image/')) {
    attachment.previewUrl = URL.createObjectURL(file)
  }
  return attachment
}

export function revokeAttachmentPreview(attachment: PendingChatAttachment): void {
  if (attachment.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl)
  }
}
