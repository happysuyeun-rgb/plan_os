import type { DocumentType, Project } from '../../types'
import { DOCUMENT_TYPE_LABELS } from '../../types'

export function buildMarkdownHeader(project: Project, docLabel: string): string {
  return `# ${project.title} — ${docLabel}

> 서비스 유형: ${project.service_type}  
> 목표 사용자: ${project.target_user}  
>보내기: ${new Date().toLocaleString('ko-KR')}

---

`
}

export function buildSingleMarkdown(
  project: Project,
  docType: DocumentType,
  content: string,
): string {
  return buildMarkdownHeader(project, DOCUMENT_TYPE_LABELS[docType]) + content
}

export function buildReadmeMarkdown(project: Project, docTypes: DocumentType[]): string {
  const lines = docTypes.map(
    (t) => `| ${t}.md | ${DOCUMENT_TYPE_LABELS[t]} |`,
  )
  return `# ${project.title}

- 서비스 유형: ${project.service_type}
- 목표 사용자: ${project.target_user}
-보내기 일시: ${new Date().toLocaleString('ko-KR')}
- PlanOS export

## 포함 산출물

| 파일 | 설명 |
|------|------|
${lines.join('\n')}
`
}
