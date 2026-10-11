# PlanOS — 파일보내기 형식 확장 설계서

> 작성일: 2026.06.10  
> 상태: **설계 완료** (구현 Phase E6~E9)  
> 연관: [`HISTORY_AND_EXPORT_DESIGN.md`](./HISTORY_AND_EXPORT_DESIGN.md), [`MEMBER_PERMISSIONS_DESIGN.md`](./MEMBER_PERMISSIONS_DESIGN.md)

---

## 1. 배경 & 목표

### 1.1 현재 (E1~E3 완료)

| 형식 | 코드 | 범위 | 구현 |
|------|------|------|------|
| Markdown | `md` | 단일 산출물 | ✅ `buildMarkdown.ts` |
| ZIP | `zip` | 프로젝트 5종 + README | ✅ `buildZip.ts` (JSZip) |
| 클립보드 | `clipboard` | Cursor 프롬프트 | ✅ `ExportMenu` |

### 1.2 확장 목표

| 목표 | 설명 |
|------|------|
| **수신자 맞춤** | 비개발자(PDF/DOCX), 개발자(MD/ZIP), 협업툴(HTML) 각각에 적합한 형식 |
| **일관된 파이프라인** | 모든 형식이 동일한 「소스 → 변환 → 다운로드」구조를 따름 |
| **권한·플랜 연동** | 형식별 접근 제어, Free/Pro 차등 (기존 `export.md` / `export.zip` 체계 확장) |
| **점진 구현** | 클라이언트 우선 → 서버 렌더(PDF/DOCX 고품질) → OAuth 연동 |

### 1.3 비목표 (이 설계 범위 밖)

- 실시간 협업 편집 (Google Docs 양방향 동기화)
- 산출물 구조화 파싱 후 Excel/CSV 자동 생성 (화면목록 구조화는 V2 데이터 모델 이후)
- 워터마크·DRM

---

## 2. 형식 카탈로그

### 2.1 전체 목록

형식은 **3가지 패밀리**로 분류합니다.

```
┌─────────────────────────────────────────────────────────────┐
│ A. 문서 형식 (Document)   — 단일 산출물 1개 파일           │
│    md · html · txt · pdf · docx                             │
├─────────────────────────────────────────────────────────────┤
│ B. 번들 형식 (Bundle)     — 프로젝트 단위 묶음              │
│    zip · json · html_bundle                                 │
├─────────────────────────────────────────────────────────────┤
│ C. 액션 (Action)          — 파일 없이 전달                  │
│    clipboard · print_preview                              │
├─────────────────────────────────────────────────────────────┤
│ D. 연동 (Integration)     — 외부 서비스 API (V3+)           │
│    notion · google_docs · confluence                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 형식별 상세

| 코드 | 확장자 | 패밀리 | 범위 | Phase | 렌더 위치 | 주요 사용처 |
|------|--------|--------|------|-------|----------|-------------|
| `md` | `.md` | A | 단일·버전 | **E1** ✅ | 클라이언트 | Cursor, Git, Notion 붙여넣기 |
| `zip` | `.zip` | B | 프로젝트 | **E1** ✅ | 클라이언트 | 아카이브·백업 |
| `clipboard` | — | C | Cursor 탭 | **E1** ✅ | 클라이언트 | Cursor IDE 바로 사용 |
| `html` | `.html` | A | 단일·버전 | **E6** | 클라이언트 | 브라우저 열람·메일 첨부 |
| `txt` | `.txt` | A | 단일·버전 | **E6** | 클라이언트 | 순수 텍스트·레거시 시스템 |
| `json` | `.json` | B | 프로젝트 | **E6** | 클라이언트 | 백업·API·자동화 |
| `html_bundle` | `.zip` | B | 프로젝트 | **E7** | 클라이언트 | 오프라인 HTML 사이트형 패키지 |
| `pdf` | `.pdf` | A | 단일·프로젝트 | **E7** | 클라이언트→서버 | 공유·인쇄·비개발자 |
| `docx` | `.docx` | A | 단일 | **E8** | 클라이언트 | Word·한글 호환 |
| `print_preview` | — | C | 단일·프로젝트 | **E7** | 브라우저 | PDF 전 단계 미리보기 |
| `notion` | — | D | 프로젝트 | **E9** | 서버 OAuth | Notion 워크스페이스 |
| `google_docs` | — | D | 단일·프로젝트 | **E9** | 서버 OAuth | Google Docs 생성 |

### 2.3 우선순위 근거

| 순위 | 형식 | 이유 |
|------|------|------|
| 1 | HTML | MD 파이프라인 재사용, 클라이언트만으로 구현 가능, 공유 UX 즉시 개선 |
| 2 | JSON | 프로젝트 전체 백업·이관, Supabase 연동 전 Mock 데이터 portability |
| 3 | TXT | 구현 비용 극소, 일부 수신 환경 대응 |
| 4 | PDF | 사용자 요청 多, 품질 위해 서버 렌더 검토 |
| 5 | DOCX | 한글/Word 사용자층, 폰트·스타일 이슈로 Phase 늦춤 |
| 6 | 연동 | OAuth·과금·유지보수 비용 큼 |

---

## 3. 보내기 범위 (Scope)

모든 형식은 아래 **4가지 범위** 중 하나와 조합됩니다.

| Scope | 코드 | 설명 | 지원 패밀리 |
|-------|------|------|-------------|
| 현재 탭 | `current_doc` | 활성 `DocumentType` L1 본문 | A, C |
| 현재 버전 | `current_version` | 히스토리 패널에서 선택한 L2 스냅샷 | A |
| 프로젝트 전체 | `all_docs` | 생성된 5종 산출물 모두 | B, D |
| 게스트 미리보기 | `guest_preview` | LAND-001 sessionStorage 결과 | B |

**조합 예시**

```
current_doc  + html  → 반려동물앱_PRD_20260610.html
all_docs     + json  → 반려동물앱_PlanOS_20260610.json
current_version + md → 반려동물앱_PRD_v2_20260610.md
```

---

## 4. 변환 파이프라인

### 4.1 아키텍처

```
                    ┌──────────────────┐
  Project + Docs ──►│ ExportContext    │  메타·권한·scope·format
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ buildExportSource │  Canonical Markdown (+ frontmatter)
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        buildMarkdown   buildHtml     buildPdf ...
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    ┌─────────────────┐
                    │ downloadBlob    │  또는 clipboard / OAuth push
                    └─────────────────┘
                             │
                             ▼
                    logActivity(export)
```

**Canonical Source**: 모든 A·B 패밀리는 먼저 `buildExportSource()`로 통일된 중간 표현을 만듭니다.

```typescript
interface ExportSource {
  project: Project
  documents: ExportDocumentSlice[]  // docType, label, content, version?
  exported_at: string
  app_version: string
}

interface ExportDocumentSlice {
  doc_type: DocumentType
  label: string
  content: string
  version_number?: number
}
```

### 4.2 형식별 변환기

| 파일 | 함수 | 입력 → 출력 |
|------|------|-------------|
| `buildMarkdown.ts` | `buildSingleMarkdown` *(기존)* | ExportSource slice → string |
| `buildHtml.ts` | `buildSingleHtml`, `buildHtmlBundle` | MD → standalone HTML |
| `buildPlainText.ts` | `markdownToPlainText` | MD → TXT |
| `buildJson.ts` | `buildProjectJson` | ExportSource → JSON string |
| `buildPdf.ts` | `buildPdfFromHtml` | HTML → Blob (client) / EF (server) |
| `buildDocx.ts` | `buildDocxFromMarkdown` | MD → DOCX Blob |
| `buildZip.ts` | `buildProjectZip` *(기존)* | MD slices → ZIP |

### 4.3 HTML 변환 (E6)

- 라이브러리: `marked` (또는 `markdown-it`)
- 출력: **단일 self-contained HTML** (인라인 CSS, 외부 CDN 없음)
- 템플릿:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>{project.title} — {docLabel}</title>
  <style>/* PlanOS export 기본 스타일 */</style>
</head>
<body>
  <header>...</header>
  <article class="markdown-body">{renderedHtml}</article>
  <footer>PlanOS export · {exported_at}</footer>
</body>
</html>
```

- `html_bundle`: `index.html`(README) + `{type}.html` 5종을 ZIP으로 (기존 zip과 병렬 옵션)

### 4.4 JSON 스키마 (E6)

```json
{
  "schema_version": "1.0",
  "exported_at": "2026-06-10T12:00:00+09:00",
  "app": { "name": "PlanOS", "version": "0.1.0" },
  "project": {
    "id": "uuid",
    "title": "반려동물 케어 앱",
    "service_type": "앱",
    "target_user": "반려인",
    "memory_summary": "...",
    "interview_answers": { "q1": "...", "q2": "..." }
  },
  "documents": [
    {
      "type": "prd",
      "label": "PRD",
      "content": "# PRD\n...",
      "updated_at": "..."
    }
  ]
}
```

- **V2 확장**: `versions[]`, `chat_messages[]`, `activities[]` (Pro 백업)
- 파일명: `{프로젝트명}_PlanOS_{YYYYMMDD}.json`

### 4.5 PDF (E7)

| 방식 | 장점 | 단점 | 채택 |
|------|------|------|------|
| A. `window.print()` + print CSS | 무료·즉시 | 브라우저별 차이, 「다른 이름으로 저장」UX | **MVP PDF (E7a)** |
| B. html2canvas + jspdf | 완전 클라이언트 | 대용량·한글 품질·성능 | 보조 |
| C. Edge Function + Chromium | 고품질·일관 | 서버 비용·지연 | **Pro PDF (E7b)** |

**권장 2단계**

1. **E7a**: HTML → `print_preview` 액션 → 사용자가 PDF 저장 (권한 `export.pdf`)
2. **E7b**: `export-pdf` EF — HTML 동일 템플릿, Puppeteer `page.pdf()`

### 4.6 DOCX (E8)

- 라이브러리: `docx` (npm) — 프로그래밍 방식 생성
- MD → AST 파싱은 `mdast` + 커스텀 visitor (제목·목록·표·코드블록)
- 한글 폰트: Word 기본 맑은 고딕에 의존 (임베딩은 V2)
- 범위: **단일 산출물만** (프로젝트 DOCX 묶음은 ZIP 내 5 docx로 E8 후반)

---

## 5. UI/UX 설계

### 5.1 문제: 드롭다운 항목 폭발

현재 `ExportMenu`는 3항목. 형식 8개+ 시 **2단계 UI**로 전환합니다.

```
[보내기 ▾]  클릭
    │
    ▼
┌─────────────────────────────────────┐
│  ExportModal (또는 확장 패널)        │
│                                     │
│  범위:  ○ 현재 탭  ○ 프로젝트 전체   │
│         ○ 선택 버전 (히스토리에서 진입 시) │
│                                     │
│  형식:  [ Markdown ▾ ]              │
│         md / html / txt / pdf / docx│
│         (범위=all_docs 시 zip/json) │
│                                     │
│  [ 미리보기 ]  [ 다운로드 ]          │
└─────────────────────────────────────┘
```

### 5.2 진입점별 UX

| 진입점 | 기본 범위 | 기본 형식 | 비고 |
|--------|----------|----------|------|
| DOC-001 툴바 `보내기` | `current_doc` | `md` | Modal 열기 |
| DOC-001 히스토리 버전 행 | `current_version` | `md` | 1클릭 MD, 길게 누르면 Modal |
| LAND-001 `결과 다운로드` | `guest_preview` | `zip` | 기존 유지 + `html_bundle` 추가 |
| PROJ-001 컨텍스트 | `all_docs` | `zip` | V1.2 |

### 5.3 형식 선택 UI 규칙

- **범위 = current_doc / current_version** → A 패밀리 + `print_preview`
- **범위 = all_docs** → B 패밀리 (`zip`, `json`, `html_bundle`)
- **Cursor 탭 + clipboard** → Modal 하단 고정 「클립보드 복사」 (C 패밀리)
- Pro 뱃지: `pdf`(EF), `json`(전체 메타), `docx`
- 비활성 형식: 권한 없음 시 grey + tooltip

### 5.4 컴포넌트 변경

| 컴포넌트 | 변경 |
|---------|------|
| `ExportMenu` | Modal 트리거만 유지 (하위 호환) |
| `ExportModal` *(신규)* | 범위·형식·미리보기·다운로드 |
| `ExportFormatSelect` *(신규)* | 형식 드롭다운 + 설명 툴팁 |
| `ExportPreview` *(신규)* | HTML/TXT 인라인 미리보기 (iframe sandbox) |
| `HistoryPanel` | 버전 행에 형식 선택 보내기 (선택) |

---

## 6. 권한 & 플랜

### 6.1 권한 모델 확장

기존 2개 권한을 **패밀리 권한**으로 일반화합니다.

```typescript
type ExportPermission =
  | 'export.document'   // md, html, txt, pdf, docx, clipboard, print_preview
  | 'export.bundle'     // zip, json, html_bundle
  | 'export.integrate'  // notion, google_docs (V3+)

// 하위 호환 alias (기존 코드)
// export.md     → export.document
// export.zip    → export.bundle
```

| 역할 | export.document | export.bundle | export.integrate |
|------|:---------------:|:-------------:|:----------------:|
| owner | ✅ | ✅ | V3 |
| editor | ✅ | ✅ | V3 |
| viewer | ✅ | ❌ | ❌ |
| guest | ✅ (체험만) | ✅ (ZIP) | ❌ |

**형식별 세부 제한 (플랜)**

| 형식 | free | pro | team |
|------|:----:|:---:|:----:|
| md, html, txt, clipboard | ✅ | ✅ | ✅ |
| zip | ✅ | ✅ | ✅ |
| json | ❌ | ✅ | ✅ |
| html_bundle | ❌ | ✅ | ✅ |
| pdf (print) | ✅ 10회/일 | ✅ | ✅ |
| pdf (EF 고품질) | ❌ | ✅ | ✅ |
| docx | ❌ | ✅ | ✅ |
| notion / gdocs | ❌ | ❌ | ✅ |

> MVP(Mock): 플랜 제한 UI 표시만, enforcement는 E4(Supabase) 이후.

### 6.2 활동 로그 meta 확장

```json
{
  "action": "export",
  "meta": {
    "format": "html",
    "scope": "current_doc",
    "doc_type": "prd",
    "version_number": null,
    "file_name": "반려동물앱_PRD_20260610.html"
  }
}
```

---

## 7. 파일명 규칙 (통일)

```
단일:   {sanitize(title)}_{docSlug}_{YYYYMMDD}.{ext}
버전:   {sanitize(title)}_{docSlug}_v{N}_{YYYYMMDD}.{ext}
번들:   {sanitize(title)}_PlanOS_{YYYYMMDD}.{ext}

docSlug: prd | ia | screen-list | policy | cursor-prompt
sanitize: 공백→없음, 특수문자 제거, 50자 제한
```

---

## 8. API & 타입

### 8.1 TypeScript

```typescript
export type ExportFormat =
  | 'md' | 'html' | 'txt' | 'pdf' | 'docx'
  | 'zip' | 'json' | 'html_bundle'
  | 'clipboard' | 'print_preview'
  | 'notion' | 'google_docs'

export type ExportScope =
  | 'current_doc' | 'current_version' | 'all_docs' | 'guest_preview'

export interface ExportRequest {
  project_id: string
  format: ExportFormat
  scope: ExportScope
  doc_type?: DocumentType
  version_id?: string
}

export interface ExportResult {
  blob?: Blob
  file_name: string
  mime_type: string
}
```

### 8.2 통합 진입 함수

```typescript
// lib/export/exportDocument.ts
export async function runExport(req: ExportRequest, ctx: ExportContext): Promise<ExportResult>
```

`exportStore`는 `runExport` 단일 액션으로 통합 (기존 `exportDocument` / `exportProjectZip` deprecate).

### 8.3 의존성 (신규)

| 패키지 | Phase | 용도 |
|--------|-------|------|
| `jszip` | E1 ✅ | ZIP |
| `marked` | E6 | MD → HTML |
| `remove-markdown` | E6 | MD → TXT (선택) |
| `jspdf` + `html2canvas` | E7 | 클라이언트 PDF (선택) |
| `docx` | E8 | DOCX 생성 |

---

## 9. 구현 Phase

### Phase E6 — 클라이언트 문서·JSON (우선) ⭐

- [ ] `ExportSource`, `runExport`, `buildHtml.ts`, `buildPlainText.ts`, `buildJson.ts`
- [ ] `ExportModal` + `ExportFormatSelect`
- [ ] 권한 `export.document` / `export.bundle` (하위 호환 유지)
- [ ] activity meta `format` + `scope` 통일
- [ ] `package.json`: `marked`

### Phase E7 — PDF & HTML 번들

- [ ] `print_preview` + print CSS
- [ ] `html_bundle` ZIP
- [ ] `buildPdf.ts` (클라이언트 MVP)
- [ ] Edge Function `export-pdf` 스펙 초안

### Phase E8 — DOCX

- [ ] `buildDocx.ts` + MD AST visitor
- [ ] Pro 플랜 게이트

### Phase E9 — 외부 연동 (V3)

- [ ] Notion API / Google Docs OAuth
- [ ] `export.integrate` 권한
- [ ] Team 플랜 전용

### Phase E4 (기존) — Supabase 연동 시

- [ ] `export_logs` 테이블 — 일일 횟수 enforcement
- [ ] 서버사이드 PDF 큐

---

## 10. 에러·엣지 케이스

| 상황 | 처리 |
|------|------|
| 빈 산출물 | toast 「보낼 내용이 없습니다」, 다운로드 중단 |
| viewer가 bundle 요청 | 권한 거부 toast |
| 50,000자 초과 PDF | 경고 + print_preview 권장 |
| 클립보드 API 거부 | fallback `textarea` + 수동 복사 안내 |
| 다국어 파일명 | Blob download 시 ASCII fallback 파일명 병행 |
| 생성 중인 문서 | 해당 타입 제외 후 번들 (기존 ZIP 정책 유지) |

---

## 11. 의사결정 (서아 확인)

| # | 항목 | 제안 | 대안 |
|---|------|------|------|
| 1 | UI | `ExportModal` 2단계 (범위×형식) | 드롭다운 2단 서브메뉴 |
| 2 | JSON에 버전/채팅 포함 | E6는 documents만, Pro는 full backup | 항상 전체 |
| 3 | PDF 1차 | 브라우저 인쇄 (`print_preview`) | 바로 EF |
| 4 | 권한 키 | `export.document` / `export.bundle` 통합 | 형식마다 개별 permission |
| 5 | HTML 스타일 | GitHub markdown CSS 유사 | PlanOS 브랜드 템플릿 |

---

## 12. 문서·코드 반영 체크리스트

- [ ] `HISTORY_AND_EXPORT_DESIGN.md` §4.1 포맷 표 → 이 문서 링크
- [ ] `MEMBER_PERMISSIONS_DESIGN.md` 권한 목록 확장
- [ ] `TECH_SPEC.md` 컴포넌트·lib/export 목록 갱신
- [ ] `DEV_GUIDE.md` Phase E6~E9 추가

---

*구현 지시 예: 「Phase E6 HTML·JSON보내기 구현해줘」*
