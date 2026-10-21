# PlanOS Cursor 통합 실행계획서 2026-10-21

## P0 안정화 및 Draft PR 통합 준비

- **작업 지시:** Cursor 작업 지시서 02 — P0 안정화 및 Draft PR 통합 준비
- **상위 기준:** [통합 실행계획서](PLANOS_INTEGRATED_EXECUTION_PLAN_2026-10-21.md)(G0~G7 게이트와 완료 판정을 우선), [작업 운영규칙](PLANOS_WORK_EXECUTION_PROTOCOL_2026-10-21.md), [로컬 점검 보고서](../quality/CURSOR_LOCAL_AUDIT_2026-10-21.md), [저장소 가이드](../REPOSITORY_GUIDE.md)
- **이번 단계의 성격:** 분석과 통합계획 수립까지만이다. 기능 코드를 수정하지 않았고, PR을 병합하지 않았으며, 어떤 DB에도 SQL을 적용하지 않았다.
- **전제:** 현재 작업 폴더는 `.git`이 없는 ZIP 다운로드본이며 GitHub `main` 최신(`29780a3`)과 동일함을 지시서 01에서 대조했다. 아래 분석은 GitHub API로 조회한 PR 파일 목록·head 내용 대조와 로컬 코드 직접 확인을 근거로 한다. 실제 병합 작업은 정식 클론 작업본의 기능 브랜치에서 수행해야 한다.

> 완료 판정 원칙: 코드 존재, Draft PR 존재, 정적 계약 테스트 존재만으로는 완료가 아니다. 빌드·단위 테스트·격리 DB·브라우저 E2E 중 해당 단계가 요구하는 근거가 실제로 실행되고 기록될 때만 해당 범위를 완료로 적는다.

---

## 0. 조사 시점의 PR 상태 (2026-10-21 재조회)

지시서 01 조사 이후 변동이 있어 재조회 결과를 기준으로 한다.

| PR | 상태 | mergeable (재조회) | base | 변경 규모 | 01 조사 대비 변동 |
|---|---|---|---|---|---|
| [#15](https://github.com/happysuyeun-rgb/plan_os/pull/15) Phase 0 통합 | OPEN·Draft | **CONFLICTING** | `fix/planos-chat-document-write-20261016` (main 아님) | 22파일 +1866/−21 | 변동 없음 |
| [#19](https://github.com/happysuyeun-rgb/plan_os/pull/19) 로컬 초안 복구 | OPEN·Draft | MERGEABLE | `fix/planos-chat-atomic-c10-20261017` (main 아님) | 5파일 +178/−6 | 변동 없음 |
| [#22](https://github.com/happysuyeun-rgb/plan_os/pull/22) 문서 조건부 저장 계약 | OPEN·Draft | **MERGEABLE** | `main` | 4파일 +131/−0 | UNKNOWN → MERGEABLE로 확정. 단 "충돌 없음"일 뿐 검증 완료 아님 |
| [#23](https://github.com/happysuyeun-rgb/plan_os/pull/23) 자동저장·CAS 통합 | OPEN·Draft | **CONFLICTING** | `main` | 54파일 +4170/−220 | UNKNOWN → **CONFLICTING으로 확정** |
| [#24](https://github.com/happysuyeun-rgb/plan_os/pull/24) Revision CAS 설계 | OPEN·Draft | **CONFLICTING** | `main` | 61파일 +4396/−220 | UNKNOWN → **CONFLICTING으로 확정** |
| [#25](https://github.com/happysuyeun-rgb/plan_os/pull/25) S3 전문가 요청 Mock | OPEN·Draft | MERGEABLE | `main` | 10파일 +378/−0 | 변동 없음 |
| [#27](https://github.com/happysuyeun-rgb/plan_os/pull/27) S4 PM 계획 초안 Mock | OPEN·Draft | MERGEABLE | `main` | 6파일 +112/−0 | 변동 없음 |

CI 재확인: PR #23·#24는 여전히 SonarCloud 실패만 있고 verify/build 계열 run이 없다. PR #15는 base가 main이 아니므로 GitHub의 mergeable 판정 자체가 main 기준이 아니다.

---

## 1. PR 의존성 및 통합 순서

### 1.1 파일 집합 기준 의존성 (실측)

GitHub API로 각 PR의 변경 파일 목록을 받아 집합 관계를 계산하고, PR #23/#24의 공유 파일 5개는 head SHA 기준 원본 내용을 직접 대조했다.

| 관계 | 실측 결과 | 해석 |
|---|---|---|
| PR #15 ⊂ PR #23 (파일 집합) | PR #15의 22개 파일이 전부 PR #23에 포함됨. 빠진 파일 0개 | PR #23은 PR #15의 파일 범위를 이미 흡수한 누적 PR이다. 두 PR을 각각 병합하면 같은 변경을 두 번 적용하게 된다. |
| PR #19 ⊂ PR #23 (파일 집합) | PR #19의 5개 파일이 전부 PR #23에 포함됨. 빠진 파일 0개 | 동일. PR #23이 초안 복구 파일까지 포함한다. |
| PR #23 ⊂ PR #24 (파일 집합) | PR #24 = PR #23의 54개 파일 + 7개 파일(revision CAS 워크플로, 계약/감사/테스트 매트릭스 문서 3종, `013_document_revision_cas_DRAFT.sql`, 테스트 2종). PR #23에만 있는 파일 0개 | PR #24는 PR #23의 **완전한 상위집합**이다. |
| PR #23 vs PR #24 공유 파일 내용 | 대조한 5개 파일(`src/lib/api/documents.ts`, `src/store/documentStore.ts`, `src/pages/DocumentPage.tsx`, `supabase/migrations/011_atomic_document_version_restore.sql`, `src/lib/documentAutosave.ts`)이 **바이트 단위(줄바꿈 정규화 후) 동일** | PR #24는 PR #23 위에 revision 설계만 얹은 후속 PR이다. 둘 중 하나만 선택하면 되고, 둘을 순서대로 병합할 이유가 없다. |
| PR #22 vs PR #23/#24 | `src/lib/api/documents.ts`를 함께 수정하지만 PR #22는 독립된 4파일 계약 PR | PR #22의 본문 비교 CAS(`.eq('content', baseline)`)는 PR #24의 revision CAS와 **방식이 서로 다르다.** 둘 다 채택하는 것은 불가능하고 하나를 폐기해야 한다(§1.3 결정 필요). |
| PR #25 vs PR #27 | 공유 파일은 `src/App.tsx`, `src/pages/ProjectTasksPage.tsx` 2개뿐. 나머지(페이지·lib·테스트)는 서로 겹치지 않음 | 기능적으로 독립. 다만 같은 두 파일을 고치므로 병합 순서에 따라 한쪽이 가벼운 충돌을 맞을 수 있다. |
| PR #15/#19의 base | base가 main이 아닌 중간 브랜치 | GitHub의 MERGEABLE(#19) 판정은 main 기준이 아니다. main 기준으로 다시 세우지 않으면 병합 결과를 예측할 수 없다. |

**결론: PR 전부를 합치는 방식은 금지이며, 실제로도 불가능하다.** PR #15·#19·#23은 PR #24에 파일 단위로 흡수되어 있어, 이들을 각각 병합하는 것은 중복 적용이다. 통합은 "PR을 순서대로 병합"이 아니라 **"채택할 단일 베이스를 정하고 나머지는 참고 자료로 닫는"** 방식으로 해야 한다.

### 1.2 권장 통합 순서 (요약)

상세 단계는 §3을 따른다.

```text
[선택] 통합 베이스 = PR #24의 head를 새 통합 브랜치로 재작성 (PR #15/#19/#22/#23은 병합하지 않음)
   │
   ├─ 1단계: 마이그레이션 재번호 + 013 초안 격리 (§4)
   ├─ 2단계: P0-04 RLS 009/010 격리 DB 실증 (§3.2 단계 B)
   ├─ 3단계: P0-01 자동저장 CAS 실제 연결 + P0-02 복원 원자성 (§3.2 단계 C)
   ├─ 4단계: P0-03 채팅 단일 쓰기 경로 통합 (§3.2 단계 D)
   ├─ 5단계: 전체 회귀 + main 병합 조건 심사 (§6)
   │
   └─ (병행 가능, P0와 무관) PR #25 → PR #27 순서로 Mock 통합 (§8)
```

순서의 근거:

1. PR #24가 가장 큰 상위집합이므로, 이를 버리고 #15→#19→#23을 쌓아 올리면 같은 충돌을 세 번 해결해야 한다. 반대로 #24를 베이스로 삼으면 충돌 해결은 한 번이다.
2. 다만 PR #24는 현재 CONFLICTING이고 CI가 실행된 적이 없으므로, head를 그대로 믿지 않고 새 통합 브랜치에서 main과 대조하며 재작성한다. PR #24를 직접 Ready로 전환해 병합하는 방식은 취하지 않는다.
3. RLS(P0-04)를 저장 로직(P0-01~03)보다 먼저 격리 DB로 실증하는 이유는, CAS RPC들이 전부 `can_edit_project_content` 같은 006 함수와 RLS 경계 위에서 동작하기 때문이다. 권한이 닫혀 있지 않으면 CAS를 붙여도 우회 경로가 남는다.
4. S3/S4 Mock(PR #25/#27)은 문서 저장 경로를 건드리지 않으므로 P0와 병행할 수 있다(운영규칙의 신규 기능 레인). 단 §8의 조건을 지킨다.

### 1.3 통합 전에 필요한 결정 (사람 확정)

| 결정 | 선택지 | 본 계획의 권고 |
|---|---|---|
| D-1 CAS 방식 | (가) PR #22 본문 비교 CAS / (나) PR #24 revision CAS | **(나).** (가)는 장문 본문을 PostgREST 필터로 보내 URL 길이·인코딩 한계에 걸릴 수 있어 실사용 부적합하다는 실행계획서 G1-B-04 기록과 013 초안의 전제가 타당하다. PR #22는 계약 참고로만 남기고 병합하지 않는다. |
| D-2 통합 베이스 | (가) PR #24 재작성 / (나) PR #15부터 순차 병합 | **(가).** §1.1 실측상 (나)는 중복 적용이다. |
| D-3 PR #15/#19/#22/#23의 처분 | 병합 / 닫기(superseded 명시) / 방치 | 통합 브랜치가 main에 들어간 뒤, 각 PR에 "PR #24 기반 통합으로 대체됨"을 남기고 닫는다. 방치는 혼란을 남기므로 하지 않는다. 단 본 계획 단계에서는 어떤 PR도 닫지 않는다. |
| D-4 S1 삭제·복원 권한 | DB 현행(owner 전용) 유지 / editor 허용으로 DB 변경 | 지시서 01 P1-02. 통합 범위 밖의 제품 결정이지만, G2 착수 전에 확정해야 UI와 DB 중 어느 쪽을 고칠지 정해진다. 본 계획에서는 현행 DB를 기준으로 UI를 맞추는 쪽을 기본값으로 둔다. |
| D-5 격리 검증 환경 | 로컬 Supabase / 전용 개발 프로젝트 / CI 일회용 Postgres | §3의 완료 기준 대부분이 격리 DB를 전제한다. 누가 어떤 환경에 테스트 계정 시드까지 준비할지 정해지지 않으면 어떤 단계도 완료 처리할 수 없다. **운영 Supabase를 이 용도로 쓰지 않는다.** |

---

## 2. P0 결함별 수정 파일

아래 "현재 코드"는 다운로드본(main)에서 직접 확인한 경로이고, "수정 대상"은 다음 개발 단계에서 건드릴 파일이다. 이번 단계에서는 어떤 파일도 수정하지 않았다.

### 2.1 문서 쓰기 경로 전수 (main 기준 실측)

문서 본문을 쓰는 경로는 아래 5묶음뿐임을 저장소 전체 검색으로 확인했다. CAS·revision을 붙일 때 하나라도 빠지면 그 경로가 우회로가 된다.

| # | 쓰기 경로 | 현재 진입점 | 현재 저장 방식 |
|---|---|---|---|
| W1 | 자동저장(편집) | `src/store/documentStore.ts` `autoSave` | `saveDocumentContent(id, content)` 무조건 UPDATE |
| W2 | 버전 복원 | `src/store/versionStore.ts` `restoreVersion` | 버전 INSERT 후 `saveDocumentContent` 별도 호출 (비원자) |
| W3 | 최초 생성 파이프라인 | `src/lib/api/generation.ts` `runGenerationPipeline` | 문서 타입별 `upsertDocument` (project_id,type 충돌 기준) |
| W4 | 재생성·연쇄 재생성 | `src/lib/api/generation.ts` `regenerateDocument`/`regenerateCascade` | `upsertDocument` 무조건 대체 |
| W5 | 채팅 반영 | `src/lib/api/chat.ts` `sendChatMessage` | 본문 조회 → 문자열 결합 → 직접 UPDATE (자동저장 우회) |
| (참고) | 게스트 결과 이전 | `src/lib/guestTransfer.ts` | `upsertDocument`. 로그인 전환 시점의 일회성 쓰기지만 같은 우회 대상 |

읽기 전용 접근(`comments.ts`의 문서 타입 조회, `notify.ts`의 문서 메타 조회)은 쓰기가 아니므로 대상에서 제외했다.

### 2.2 P0-01 문서 자동저장 데이터 유실 위험

| 항목 | 내용 |
|---|---|
| 실제 코드 경로 | `MarkdownEditor` 입력 → `documentStore.updateContent` (모듈 전역 `saveTimer` 1개, 2초 디바운스) → `autoSave` → `src/lib/api/documents.ts` `saveDocumentContent`가 `.update({ content }).eq('id', id)`로 무조건 덮어씀 |
| 결함 1: 전역 타이머 | 타이머가 문서별이 아니라 전역 1개다. 문서 A 편집 직후 문서 B로 전환하면 `setActiveDocType`이 내용을 교체하는데, A의 예약된 저장이 취소되거나 B의 내용으로 A를 저장할 여지가 있다. 전환 시 미저장 편집을 먼저 내보내는(flush) 절차가 없다. |
| 결함 2: 순서 경쟁 | 저장 요청이 진행 중인데 다시 편집하면 이전 요청의 응답이 나중에 도착해 `documents` 상태를 오래된 본문으로 되돌릴 수 있다. 요청 일련번호나 문서별 직렬화 큐가 없다. |
| 결함 3: 오래된 본문 덮어쓰기 | 서버에 "내가 읽은 이후 바뀐 적 없는가"를 묻는 조건이 전혀 없다. 다른 사용자·다른 탭·채팅(W5)이 먼저 저장해도 마지막에 도착한 낡은 본문이 조용히 이긴다. 실패로도 표시되지 않는다. |
| 재현 조건 | 같은 문서를 두 브라우저(또는 두 탭)에서 열고, 한쪽에서 저장한 뒤 다른 쪽에서 예전 화면 그대로 편집·저장하면 앞선 저장이 사라진다. 자동저장 타이밍(2초)과 겹치면 단일 사용자 다중 탭만으로도 재현된다. |
| 해결 방안 | PR #24의 revision CAS를 채택한다. ① 문서에 서버 revision을 두고 모든 쓰기(W1~W5)가 revision을 전진시킨다. ② 자동저장은 문서별 큐+마지막으로 서버가 확인한 revision을 기준값으로 RPC `save_document_content_cas`만 호출한다. ③ 기준이 어긋나면 조용히 덮지 말고 충돌 상태로 표시하고 로컬 초안을 보존한다(PR #19의 `unsavedDraft` 개념). ④ 문서 전환·언마운트 시 flush를 강제한다. |
| 수정 대상 파일 | `src/lib/api/documents.ts`(CAS RPC 호출로 교체, blind update 제거), `src/store/documentStore.ts`(문서별 큐·기준 revision·flush), 신규 `src/lib/documentAutosave.ts`(PR #23/#24에 존재), `src/pages/DocumentPage.tsx`(충돌·초안 복구 UI), `supabase/migrations/`(§4의 재번호된 revision CAS), `tests/`(아래 기준) |
| 테스트·완료 기준 | ① 두 클라이언트가 같은 revision으로 저장하면 하나만 성공하고 다른 하나는 충돌로 표시될 것 ② 저장 응답이 역전 도착해도 화면 본문이 되돌아가지 않을 것 ③ 문서 전환 직전 편집이 유실되지 않을 것 ④ 새로고침 후 미저장 초안이 복구 제안될 것 ⑤ 장문(수만 자) 문서에서도 CAS가 동작할 것(URL 필터 방식이 아님을 확인) ⑥ 위 항목이 격리 DB + 실제 브라우저에서 실행되고 기록될 것. 단위 mock만으로는 완료 처리하지 않는다. |

### 2.3 P0-02 문서 버전 복원

| 항목 | 내용 |
|---|---|
| 실제 코드 경로 | `HistoryPanel` 복원 → `versionStore.restoreVersion`이 `createVersion(복원)` INSERT를 먼저 실행하고, 이어서 `saveDocumentContent`로 본문을 교체하는 두 번의 독립 호출 |
| 결함 | 첫 호출만 성공하고 두 번째가 실패하면 "복원됨"이라는 버전 기록만 남고 본문은 그대로다. 반대로 본문 교체 중 자동저장(W1)이 끼어들면 복원 결과가 다시 덮일 수 있다. 복원 직전의 현재 미저장 편집을 보존하는 절차도 없다. 실행계획서 Issue #16과 동일한 결함이 main에 그대로 있다. |
| 재현 조건 | 복원 요청 중 네트워크를 끊거나, 복원과 동시에 다른 탭에서 자동저장을 발생시키면 버전 이력과 본문이 어긋난다. |
| 해결 방안 | PR #23/#24에 포함된 원자적 복원 RPC 방식을 채택한다. 서버 함수 한 트랜잭션 안에서 현재 본문 체크포인트 기록, 복원 버전 기록, 본문 교체를 함께 수행하고, operation id로 재시도를 멱등하게 만든다. 클라이언트에서는 복원 전에 자동저장을 멈추고 flush한 뒤, 복원 완료 응답으로만 화면을 교체한다. 이때 복원도 문서 쓰기이므로 revision을 전진시켜 다른 편집자의 기준값을 무효화해야 한다. |
| 수정 대상 파일 | `src/store/versionStore.ts`(2단계 호출을 RPC 1회로 교체), `src/lib/api/versions.ts`, `src/pages/DocumentPage.tsx` 및 `HistoryPanel`(복원 중 편집 잠금·실패 복구 표시), 마이그레이션(§4의 원자적 복원 SQL), `tests/` |
| 테스트·완료 기준 | ① 복원 중간 단계마다 실패를 강제해도 버전 이력과 본문이 항상 일치할 것 ② 같은 operation id 재시도 시 복원이 이중 적용되지 않을 것 ③ 복원 중 자동저장·채팅 쓰기가 끼어들어도 복원 결과가 임의로 덮이지 않을 것 ④ 복원 후에도 이전 버전 이력이 그대로 조회될 것 ⑤ 격리 DB에서 실제 RPC로 실행해 확인할 것 |

### 2.4 P0-03 AI 채팅의 문서 직접 수정

| 항목 | 내용 |
|---|---|
| 실제 코드 경로 | `ChatPanel` 전송 → `chatStore` → `src/lib/api/chat.ts` `sendChatMessage`가 사용자 메시지 INSERT, 문서 본문 조회, 문자열 결합, 문서 직접 UPDATE, assistant 메시지 INSERT를 각각 별도 호출로 수행 |
| 결함 | 자동저장 상태(`documentStore`)를 거치지 않으므로, 편집 중인 본문과 채팅이 읽은 본문이 다르면 한쪽이 사라진다. 중간 실패 시 사용자 메시지만 남거나 문서만 바뀌는 부분 성공이 생기고, 재시도하면 같은 내용이 중복으로 붙을 수 있다. 현재 채팅 반영 내용은 실제 AI 결과가 아니라 고정 문구를 덧붙이는 placeholder 수준이라는 점도 함께 고지되어야 한다. |
| 재현 조건 | 문서를 편집해 자동저장 대기(2초) 상태로 두고 채팅으로 수정을 보내면, 채팅이 저장한 뒤 자동저장이 낡은 본문으로 다시 덮거나 그 반대가 발생한다. |
| 해결 방안 | PR #23/#24의 원자적 채팅 RPC 방식을 채택하되, 문서 변경 부분은 P0-01의 revision CAS와 같은 기준값을 공유하게 만든다. 즉 채팅도 "문서 쓰기"로서 동일한 단일 경로를 타야 하며, 사용자 메시지+문서 변경+assistant 메시지를 한 트랜잭션으로 묶고 operation id로 멱등성을 보장한다. 실패 시에는 문서와 메시지 모두 롤백되고, 사용자에게 재시도 가능 상태로 표시되어야 한다. |
| 수정 대상 파일 | `src/lib/api/chat.ts`(직접 UPDATE 제거, RPC 호출로 교체), `src/store/chatStore.ts`, `src/components/document/ChatPanel.tsx`(실패·재시도 표시), `src/store/documentStore.ts`(채팅 반영 후 기준 revision 동기화), 마이그레이션(§4의 원자적 채팅 SQL), `tests/` |
| 테스트·완료 기준 | ① 편집 중 채팅 반영 시 편집 내용과 채팅 반영이 모두 남을 것 ② 각 단계 실패 주입 시 부분 성공이 없을 것 ③ 재시도해도 내용이 중복 적용되지 않을 것 ④ 채팅 반영 직후 자동저장이 낡은 본문으로 덮지 않을 것 ⑤ 격리 DB 실증. placeholder 문구 수준이라는 사용자 고지는 별도 UX 항목으로 확인한다. |

### 2.5 P0-04 RLS·멤버 권한

| 항목 | 내용 |
|---|---|
| 실제 코드 경로 | `supabase/migrations/001`(기본 스키마·정책), `002`(멤버 조회 정책 재귀 회피 시도), `006`(`get_project_role`/`can_access_project`/`can_edit_project_content` 함수). PR에만 있는 `009`(멤버 SELECT 재귀 수정), `010`(댓글·알림·버전 강화)은 main에 없다. |
| 결함 | 멤버 정책이 프로젝트/멤버 테이블을 서로 참조하는 구조라 재귀(42P17) 또는 우회 가능성이 실행계획서 Issue #12/#7로 남아 있고, 역할별 실 JWT 검증이 한 번도 수행되지 않았다. UI에서 메뉴를 숨기는 것은 서버 권한이 아니므로, RLS가 실제로 닫혀 있는지가 출시를 좌우한다. CAS RPC들도 전부 이 함수들 위에서 동작하므로 이 결함은 P0-01~03의 전제이기도 하다. |
| 재현 조건 | viewer 또는 타 프로젝트 사용자의 JWT로 문서·댓글·업무 테이블에 직접 PostgREST 요청을 보내, 읽기·쓰기가 허용되는지 확인하면 된다. 현재는 이 검증 자체가 미실행이다. |
| 해결 방안 | PR #15 계열의 009/010을 통합 브랜치에 재번호해 포함시키되, 격리 DB에서 마이그레이션 001부터 끝까지 순서대로 적용한 뒤 역할별(owner/editor/viewer/pending/outsider/anon) JWT 매트릭스로 허용·차단을 전수 실측한다. 서버 측 검증은 RLS와 RPC의 역할 함수 양쪽에서 확인하고, 클라이언트 숨김 처리는 보조 수단으로만 둔다. |
| 수정 대상 파일 | `supabase/migrations/`(§4 재번호안), `tests/rls/*`(PR #15/#23/#24에 존재), 필요 시 `src/lib/permissions.ts`와 `src/hooks/useProjectPermissions.ts`의 UI 판정을 서버 판정과 일치시키기 |
| 테스트·완료 기준 | ① 빈 격리 DB에 전체 마이그레이션을 순서대로 적용해 오류가 없을 것 ② 역할 × 리소스(프로젝트/문서/버전/댓글/업무/감사 manifest) × 동작(읽기/생성/수정/삭제/복원) 매트릭스 전 항목이 기대와 일치할 것 ③ 타 프로젝트 ID로는 존재 자체가 노출되지 않을 것 ④ 재귀 오류(42P17)가 재현되지 않을 것 ⑤ 결과가 테스트 로그로 남을 것. 하나라도 실패하면 해당 단계에서 멈추고 원인을 수정한 뒤 재실행한다. |

---

## 3. 단계별 구현 범위

### 3.1 단계 구성 원칙

- 한 단계는 하나의 검증 가능한 단위로 자른다. 앞 단계의 완료 기준을 충족하지 못하면 다음 단계로 넘어가지 않는다.
- 각 단계는 정식 클론 작업본의 전용 브랜치와 Draft PR로 진행하고, 단계마다 빌드·테스트 근거를 남긴다.
- DB가 필요한 단계는 격리 환경에서만 수행한다. 운영 DB 적용은 전체 완료 후에도 별도 승인이 필요하다.

### 3.2 단계표

| 단계 | 이름 | 구현 범위 (할 것 / 하지 않을 것) | 테스트·완료 기준 |
|---|---|---|---|
| A | 통합 베이스 재작성 | PR #24 head를 기준으로 새 통합 브랜치를 만들고 main과의 충돌을 파일 단위로 해소한다. 이 단계에서는 동작을 바꾸지 않고, 충돌 해소 결과와 main 대비 차분 목록을 남긴다. PR #15/#19/#22/#23은 병합하지 않는다. | `npm run build` 성공, 기존 테스트(지시서 01 기준 14건) 회귀 없음, 충돌 해소 파일 목록과 각 파일의 채택 근거 기록. 이 단계만으로는 어떤 기능도 완료로 적지 않는다. |
| B | P0-04 RLS 실증 | 재번호한 009/010을 포함한 전체 마이그레이션을 격리 DB에 적용하고 역할별 JWT 매트릭스를 실측한다. 실패하면 SQL을 고치고 처음부터 재적용한다. | §2.5의 완료 기준 전부. 운영 DB에는 적용하지 않는다. |
| C | P0-01 + P0-02 저장 안전성 | revision CAS를 자동저장 경로(W1)에 실제로 연결하고, 복원(W2)을 원자적 RPC로 교체한다. 재생성(W3/W4)과 게스트 이전도 같은 revision 전진 규칙을 따르게 한다. blind update 경로는 제거하거나 내부 전용으로 봉인한다. | §2.2와 §2.3의 완료 기준 전부. 브라우저 새로고침·다중 탭·문서 전환·장문 문서 포함. |
| D | P0-03 채팅 통합 | 채팅(W5)을 C와 같은 CAS 기준의 원자적 RPC로 교체하고 실패·재시도 표시를 완성한다. | §2.4의 완료 기준 전부. |
| E | 회귀·병합 심사 | 기존 문서 기능(댓글·버전·알림·휴지통·생성) 회귀, 린트 신규 오류 0건 확인, §6의 병합 조건을 항목별로 심사한다. | 전체 테스트 실행 기록, 격리 DB 매트릭스 재실행, 브라우저 E2E(로그인→프로젝트→문서 편집/복원/채팅→업무) 통과 기록. |
| F (병행) | S3/S4 Mock 통합 | §8 참조. P0 단계와 파일을 공유하지 않는 범위에서만 병행한다. | §8의 기준. |

### 3.3 단계별 산출물

각 단계 종료 시 남길 것: 변경 파일 목록, 실행한 명령과 결과(성공/실패 그대로), 실패한 테스트와 그 처리, 새로 발견한 결함의 ID와 심각도, 다음 단계의 선행 조건 충족 여부. 실행계획서 본문의 진행 로그에도 같은 내용을 짧게 남긴다(§7).

---

## 4. 마이그레이션 점검

실제 DB에는 어떤 SQL도 적용하지 않았다. 아래 적용 여부는 파일 존재와 문서 기록 기준이며, 특정 운영/개발 DB에 실제로 적용됐는지는 DB 접속 없이 확정할 수 없어 "확인 필요"로 둔다.

### 4.1 main(다운로드본)에 있는 마이그레이션

| 번호 | 파일 | 성격 | 의존성·비고 |
|---|---|---|---|
| 001 | `001_initial_schema.sql` | 기본 테이블·정책 | 모든 것의 전제 |
| 002 | `002_fix_project_members_rls.sql` | 멤버 조회 정책 재귀 회피 | 009(PR 전용)와 같은 문제를 다루는 구 방식. 통합 시 009와의 관계 정리가 필요 |
| 003 | `003_generation_runs_rls.sql` | 생성 실행 RLS | |
| 004 | `004_add_wireframe_document_type.sql` | 문서 타입 제약 변경 | |
| 005 | `005_project_comments.sql` | 댓글 테이블 | 010(PR 전용)의 강화 대상 |
| 006 | `006_member_project_access_rls.sql` | `get_project_role`/`can_access_project`/`can_edit_project_content` 함수 | 011/012(main)와 PR의 모든 CAS·복원·채팅 RPC가 이 함수들에 의존 |
| 007 | `007_user_notifications.sql` | 알림 테이블 | 010의 강화 대상 |
| 008 | `008_project_chat_title.sql` | 프로젝트 채팅 제목 컬럼 | |
| 011 | `011_project_tasks.sql` | S1 업무 테이블·이벤트·트리거 | 006 함수 의존. 파일 서두에 "운영 적용 전 검토" 명시 |
| 012 | `012_audit_source_manifests.sql` | S2 감사 manifest RPC | 006 함수 의존. 격리 개발 DB 전용 전제 |
| (없음) | 009, 010 | **main에 없음** | PR #15/#23/#24에만 존재. 번호만 비어 있는 상태 |

번호 체계의 문제: main은 008 다음이 011이다. 즉 009/010은 PR에서만 쓰이고 있고, PR의 011/012는 main의 011/012와 이름이 충돌한다. Supabase CLI(`scripts/db-push.mjs`가 호출)는 파일명의 버전 번호로 적용 이력을 관리하므로, 같은 번호의 파일이 두 개 생기면 적용 순서와 이력이 깨진다.

### 4.2 PR에만 있는 마이그레이션

| PR 파일 | 내용 | 포함 PR | 성격 판정 |
|---|---|---|---|
| `009_fix_project_members_select_recursion.sql` | 멤버 SELECT 재귀 수정 | #15, #23, #24 | 채택 후보. 단 main의 002와 중복으로 같은 문제를 다루므로, 002를 대체하는지 보완하는지 먼저 확정해야 한다. |
| `010_harden_comments_notifications_versions.sql` | 댓글·알림·버전 정책 강화 | #15, #23, #24 | 채택 후보. 005/007과의 정합을 격리 DB에서 확인해야 한다. |
| `011_atomic_document_version_restore.sql` | 원자적 복원 RPC + 복원 operation 테이블 | #23, #24 | 채택 후보이나 **번호 충돌**. 파일 내용도 "일회용 로컬 CI 전용, 운영 승인 별도"로 명시돼 있다. |
| `012_atomic_chat_document_edit.sql` | 원자적 채팅 RPC + 채팅 operation 테이블 | #23, #24 | 채택 후보이나 **번호 충돌**. 파일 서두에 DRAFT/일회용 명시. |
| `013_document_revision_cas_DRAFT.sql` | `content_revision` 컬럼 + CAS RPC + revision 트리거 | #24만 | **실험적 SQL. 현 상태로는 적용 금지.** 파일 자체에 "NOT applied", "MUST NOT be deployed", "Do not apply to prod"가 반복 명시돼 있다. 모든 쓰기 경로가 revision을 전진시키고 직접 UPDATE를 차단하기 전에는, 트리거만으로 낡은 덮어쓰기를 막을 수 없다는 한계도 파일에 적혀 있다. |

### 4.3 적용하면 안 되는 것 (명시)

1. `013_document_revision_cas_DRAFT.sql`은 설계 초안이다. 격리 DB 검증과 §3 단계 C의 클라이언트 연결이 끝나기 전에는 어떤 환경에도 적용하지 않는다. 특히 직접 UPDATE 차단(권한 회수)은 기존 클라이언트를 깨뜨릴 수 있어 컷오버 절차가 먼저 확정되어야 한다.
2. PR의 `011_atomic_*`/`012_atomic_*`는 번호를 바꾸지 않은 채 main 트리에 넣지 않는다.
3. 출처가 PR뿐인 SQL을 운영 DB에 적용하는 것은 전체 검증과 별도 승인 후에만 가능하다. 본 계획의 어떤 단계도 운영 적용을 포함하지 않는다.

### 4.4 최종 권장 번호 체계

원칙: 이미 main에 있는 번호는 절대 재사용하지 않고, PR 전용 SQL은 main의 마지막 번호(012) 뒤에 새 번호를 부여한다. 기존 파일의 번호를 바꾸는 것은 이미 적용했을지 모르는 환경의 이력을 깨므로 하지 않는다.

| 권장 번호 | 내용 | 출처 | 전제 |
|---|---|---|---|
| 001~008 | 현행 유지 | main | 변경 없음 |
| 011, 012 | 현행 유지 (S1 업무, S2 manifest) | main | 변경 없음 |
| 013 | 멤버 SELECT 재귀 수정 | PR `009_*` 재번호 | 002와의 대체/보완 관계 확정 후 |
| 014 | 댓글·알림·버전 정책 강화 | PR `010_*` 재번호 | 005/007 정합 확인 후 |
| 015 | 원자적 문서 복원 RPC | PR `011_atomic_*` 재번호 | 단계 B의 RLS 실증 통과 후 |
| 016 | 원자적 채팅 문서 수정 RPC | PR `012_atomic_*` 재번호 | 015와 같은 revision 규칙 공유 확정 후 |
| 017 | 문서 revision CAS (컬럼·RPC·트리거) | PR `013_*_DRAFT` 정식화 | 파일명의 DRAFT를 제거하는 것은 내용 확정과 격리 검증을 마친 뒤에만. 직접 UPDATE 차단(권한 컷오버)은 별도 후속 번호로 분리할 것을 권고 |
| 018 (예비) | 직접 UPDATE 차단·권한 컷오버 | 신규 | 모든 클라이언트 쓰기가 RPC로 전환된 것을 확인한 뒤에만 |

주의: 재번호는 파일명만 바꾸는 작업이 아니다. PR 안의 테스트·워크플로·문서가 옛 번호(009~013)를 문자열로 참조하고 있어, 재번호와 함께 참조를 전수 검색해 함께 고쳐야 한다. 이번 점검에서도 PR 문서들이 번호 기준으로 서로를 참조하는 것을 확인했다.

### 4.5 의존성 순서

```text
001 → 002 → 003 → 004 → 005 → 006(권한 함수) → 007 → 008
                                                     ├→ 011(S1 업무, 006 의존)
                                                     ├→ 012(S2 manifest, 006 의존)
                                                     ├→ 013(멤버 재귀 수정)
                                                     ├→ 014(댓글·알림·버전 강화, 005/007 의존)
                                                     ├→ 015(원자적 복원, 006 + 문서/버전 테이블 의존)
                                                     ├→ 016(원자적 채팅, 006 + 채팅 테이블 의존)
                                                     └→ 017(revision CAS, 015/016과 규칙 공유)
```

격리 DB 검증은 항상 빈 DB에서 001부터 권장 순서 끝까지 통째로 적용해 확인한다. 중간 번호만 골라 적용한 결과는 근거로 쓰지 않는다.

### 4.6 롤백 및 재실행 위험

| 위험 | 내용 | 대응 |
|---|---|---|
| 재실행 비멱등 | main의 여러 파일이 `create table`(if not exists 없음) 형태라 같은 DB에 두 번 적용하면 실패할 수 있다. PR의 011(복원)은 `if not exists`를 쓰지만 012(채팅)는 쓰지 않는 등 PR 내부도 일관되지 않다. | 격리 검증은 매번 빈 DB로 시작한다. 이미 적용된 DB에 재적용하는 절차는 만들지 않는다. |
| 적용 이력 불명 | 어떤 개발 DB에 무엇이 적용됐는지 이 점검으로는 확인할 수 없다(D-5). | 병합 전에 환경별 적용 이력을 사람이 확정한다. 이력이 불명인 DB에는 재번호한 파일을 적용하지 않는다. |
| 롤백 수단 부재 | 저장소에 down 마이그레이션이 없다. 잘못 적용하면 되돌릴 공식 절차가 없다. | 운영 적용은 백업·복원 절차와 묶어 별도 승인으로만 진행한다. 본 계획 범위에서는 격리 DB 폐기로 갈음한다. |
| 트리거 부작용 | revision 트리거(017)는 모든 문서 UPDATE에 개입한다. 기존 재생성·upsert 경로가 의도치 않게 revision을 전진시키면 CAS 기준값이 어긋나 저장이 전부 충돌로 변할 수 있다. | 017 적용 전에 W1~W5 전 경로의 revision 전진을 테스트로 고정한다. |
| 권한 컷오버 중단 | 직접 UPDATE를 차단하는 순간, 아직 RPC로 전환되지 않은 구 클라이언트는 저장이 전부 실패한다. | 컷오버는 예비 번호(018)로 분리하고, 전환 완료 확인 전에는 실행하지 않는다. |

---

## 5. 충돌 해결 방법

1. **기준은 항상 현재 main이다.** 통합 브랜치에서 충돌이 나면 PR 쪽 변경을 무조건 채택하지 않고, main에서 그 파일이 왜 바뀌었는지 확인한 뒤 변경 의도를 합친다. 특히 지시서 01 이후 main이 움직였을 수 있으므로, 통합 착수 시점에 main HEAD를 다시 대조한다.
2. **파일별 채택표를 먼저 쓴다.** 충돌 파일마다 "main 유지 / PR 채택 / 수동 병합" 중 하나와 근거를 적고 시작한다. 이번 조사로 확정된 중복 파일은 아래와 같다.

   | 파일 | 겹치는 PR | 처리 원칙 |
   |---|---|---|
   | `src/pages/DocumentPage.tsx` | #15, #19, #23, #24 (4개) | PR #24본을 기준으로 삼고 main과의 차분만 수동 병합한다. #15/#19의 개별 변경을 다시 적용하지 않는다. |
   | `src/store/documentStore.ts`, `src/lib/unsavedDraft.ts`, `tests/unsaved-draft.test.mjs`, `.github/workflows/b04-draft-recovery.yml` | #19, #23, #24 | PR #24본 채택. #19 단독 병합 금지 |
   | `src/lib/api/documents.ts` | #22, #23, #24 | D-1 결정에 따라 revision CAS(PR #24 계열)로 통일. PR #22의 본문 비교 방식은 채택하지 않는다. |
   | `src/store/commentStore.ts`, 마이그레이션 009/010, RLS/E2E 테스트·워크플로 다수 | #15, #23, #24 | PR #24본 채택 후 §4 재번호를 적용한다. |
   | `src/store/versionStore.ts`, `src/lib/documentAutosave.ts`, `src/lib/chatDocumentEdit.ts`, `src/store/chatStore.ts`, `src/lib/api/chat.ts` 등 | #23, #24 | 내용이 동일함을 확인했으므로 PR #24본 하나만 채택한다. |
   | `src/App.tsx`, `src/pages/ProjectTasksPage.tsx` | #25, #27 | §8 순서(#25 후 #27)로 병합하고, 두 번째 병합에서 라우트·진입 링크 추가 위치만 수동 조정한다. |

3. **충돌 해결 후에는 반드시 그 파일의 테스트를 실행한다.** 빌드 성공만으로 충돌 해결 완료로 적지 않는다.
4. **마이그레이션 파일은 텍스트 병합으로 해결하지 않는다.** 번호와 적용 순서는 §4.4를 따르고, SQL 내용은 격리 DB 적용 결과로만 판단한다.
5. **해결할 수 없는 충돌은 억지로 합치지 않는다.** 해당 변경을 별도 후속 PR로 분리하고, 본 통합에서는 main 동작을 유지한 채 사유를 기록한다.

---

## 6. main 병합 조건

아래를 전부 충족할 때만 통합 브랜치를 main에 병합할 수 있다. 하나라도 미충족이면 Draft를 유지한다.

1. §3 단계 A~E가 순서대로 완료되고, 각 단계의 테스트 근거(명령, 결과, 실패와 재실행 기록)가 실행계획서 로그에 남아 있다.
2. 격리 DB에서 빈 DB 기준 전체 마이그레이션(재번호 후 001~017)이 오류 없이 적용되고, 역할별 JWT 권한 매트릭스가 전부 기대와 일치한다.
3. P0-01~03의 완료 기준(동시 저장, 역전 응답, 문서 전환, 새로고침 복구, 복원 실패 주입, 채팅 실패·재시도, 장문 문서)이 실제 브라우저와 격리 DB에서 실행되어 통과했다.
4. 기존 기능 회귀(로그인, 프로젝트, 문서 생성·편집·버전·댓글·알림, 휴지통, S1 업무, S2 선택)가 깨지지 않았음을 확인했다.
5. `npm run build` 성공, 저장소 테스트 전체 실행 통과, 통합으로 새로 생긴 린트 오류 0건. (기존 린트 13건은 지시서 01에 기록된 레거시로, 이번 통합에서 늘어나지 않았음을 대조한다. 전체 린트 청정은 G7 과제다.)
6. 마이그레이션 재번호와 그에 따른 테스트·문서 참조 수정이 완료됐고, 적용하면 안 되는 실험 SQL(구 013 DRAFT 원본)이 정식 번호 없이 main에 들어가지 않았다.
7. PR #15/#19/#22/#23/#24의 처분(대체 명시 후 닫기)이 준비됐고, 병합되는 변경과 중복되는 열린 PR이 남지 않는다.
8. 병합은 코드 통합일 뿐 출시가 아니다. 운영 DB 적용과 배포는 이 조건과 별도로 사용자 승인을 받아야 하며, 병합 사실만으로 기능 완료를 선언하지 않는다.

---

## 7. 예상되는 잔여 위험

| 위험 | 내용 | 완화 |
|---|---|---|
| 통합 브랜치 자체의 미검증 | PR #24는 CI가 실행된 적이 없고 현재 CONFLICTING이다. 파일 집합이 가장 크다는 것이 품질 보증은 아니다. | 단계 A에서 차분을 전수 목록화하고, 단계 B~D의 실증 없이는 병합하지 않는다. |
| 숨은 우회 쓰기 경로 | W1~W5 외에 이후 추가되는 쓰기가 revision 규칙을 빠뜨리면 CAS가 무력화된다. | 쓰기 경로 목록(§2.1)을 문서로 고정하고, 새 쓰기 추가 시 같은 목록을 갱신하는 것을 리뷰 조건으로 삼는다. |
| 장문 문서·대용량 본문 | 본문 비교 CAS를 쓰지 않더라도, 본문 전체를 주고받는 저장 자체의 비용과 실패율은 남는다. | revision CAS 채택(D-1)과 장문 테스트를 완료 기준에 포함했다. |
| 격리 환경 부재 | D-5가 정해지지 않으면 단계 B~E를 시작조차 할 수 없다. | 다음 개발 작업 1개(최종 보고)를 환경 확정과 통합 브랜치 착수로 잡는다. |
| SonarCloud 반복 실패 | 대상 PR 전반에서 실패가 반복되고 원인이 미확인이다. 품질 게이트인지 설정 문제인지 모른 채 병합하면 같은 실패를 main으로 가져온다. | 단계 E에서 원인을 분리해 기록한다. 원인 확인 전에는 "CI 통과"로 보고하지 않는다. |
| S1/S2의 기존 미완결 | 업무 상세·AI 담당(F-105), 삭제 권한 불일치, 감사 이력 미연결 등은 이번 P0 통합과 별개로 남는다. | G2 과제로 유지한다. 이번 통합에서 S1/S2 동작을 바꾸지 않는다. |
| Mock과 실기능의 혼동 | 문서 생성 placeholder와 S3/S4 Mock이 실제 기능처럼 보일 수 있다. | 화면 고지와 상태 표기를 병합 조건으로 확인하고, Mock은 Mock으로만 병합한다. |
| 사용자 데이터 | 실제 사용자 문서를 대상으로 한 동시 편집 테스트는 운영 데이터로 할 수 없다. | 합성 데이터와 격리 계정으로만 검증한다. |

---

## 8. S3·S4 기능을 통합하는 시점

PR #25(S3 전문가 업무 요청·계약 검토 Mock)와 PR #27(S4 사람 PM 계획 초안 Mock)은 문서 저장 경로와 DB를 건드리지 않는 메모리 기반 Mock이므로, 실행계획서의 신규 기능 레인으로 P0 통합과 병행할 수 있다. 다만 아래 순서를 지킨다.

1. **시점:** 단계 A(통합 베이스 재작성)와 충돌하지 않는 별도 시점에, 각각 독립 PR로 병합한다. P0 통합 브랜치에 함께 섞지 않는다.
2. **순서:** PR #25를 먼저, PR #27을 나중에 병합한다. 두 PR이 공유하는 파일이 `src/App.tsx`와 `src/pages/ProjectTasksPage.tsx`뿐이므로, 두 번째 병합에서 라우트와 진입 링크의 위치만 수동으로 조정하면 된다.
3. **병합 전 확인할 것:** 각 PR의 기존 CI(verify, PR #25는 Chromium E2E 포함)가 최신 main 기준으로 재실행되어 통과할 것. 지시서 01·02 조사 시점의 통과 기록은 과거 head 기준이므로, main이 움직인 뒤에는 재실행 근거가 필요하다. SonarCloud 실패 원인이 두 PR에도 공통으로 나타나는지 함께 확인한다.
4. **범위의 고정:** 병합되는 것은 Mock 화면과 순수 로직까지다. 실제 계약 동의(F-302 실기능), 비용 원장(F-303), 계획 승인(F-402), AI 실행 연결은 운영정책 OP-01~03 승인과 G3/G4 게이트가 열리기 전에는 시작하지 않는다. Mock 화면에는 실제 실행·전송·과금이 없다는 고지가 유지되어야 한다.
5. **완료 표기:** 병합 후에도 상태는 "Mock 통합, 검증은 브라우저 E2E 범위까지"로 적는다. F-301/F-401 기능 완료로 적지 않는다.

---

## 부록 A. 이번 단계에서 새로 확인한 누락·불일치

실행계획서 본문에도 같은 항목을 G1 후속 결함으로 등록했다.

| ID | 심각도 | 내용 | 처리 단계 |
|---|---|---|---|
| INT-01 | P1 | PR #23/#24의 mergeable이 UNKNOWN에서 CONFLICTING으로 확정됐다. 실행계획서의 기존 기록("CI 미확인")보다 상태가 나빠졌으므로, 두 PR 모두 재작성 없이 병합할 수 없다. | 단계 A |
| INT-02 | P1 | PR #24가 PR #23의 완전한 상위집합(파일·공유 파일 내용 동일)임이 실측됐다. 기존 실행계획서는 두 PR을 별도 병합 후보처럼 병기하고 있어, 그대로 두면 중복 병합 시도가 가능하다. | 단계 A, D-2/D-3 |
| INT-03 | P1 | PR #15와 PR #19의 파일이 전부 PR #23(따라서 PR #24)에 포함되어 있다. 두 PR의 MERGEABLE 여부는 main 기준이 아니며(base가 중간 브랜치), 개별 병합은 중복 적용이다. | 단계 A, D-3 |
| INT-04 | P0 | 문서 쓰기 경로가 자동저장·복원·생성·재생성·채팅·게스트 이전의 5묶음이며, 어느 하나라도 revision 규칙에서 빠지면 CAS 전체가 우회된다. 실행계획서 G1-B-06의 writer 감사가 main 기준 전수 목록으로 다시 확정됐다. | 단계 C/D 완료 조건 |
| INT-05 | P1 | 마이그레이션 재번호 시 PR 내부 테스트·문서·워크플로의 옛 번호 참조를 함께 고쳐야 한다. 파일명만 바꾸면 CI와 문서가 깨진 상태로 남는다. | 단계 A/B |
| INT-06 | P1 | PR의 원자성 SQL 2종(복원·채팅)도 멱등성·멱등 테이블 방식이 서로 다르고(복원은 operation 테이블, 채팅도 별도 operation 테이블), 두 테이블의 보관·정리 정책이 정해져 있지 않다. 통합 시 operation 기록의 보존 기간과 조회 권한을 함께 정해야 한다. | 단계 C/D |
| INT-07 | P2 | PR #22가 MERGEABLE로 확정됐지만, 이는 revision 방식 채택 시 폐기 대상이다. MERGEABLE이라는 이유로 먼저 병합하면 이후 revision 전환 때 저장 API를 다시 바꾸게 된다. | D-1 |

## 부록 B. 이번 단계에서 수행하지 않은 것

- 기능 코드, 마이그레이션, 테스트 파일의 수정·삭제 (작성한 문서는 본 계획서와 실행계획서 로그뿐)
- PR 병합·닫기·Ready 전환, 브랜치 생성, commit·push
- 모든 DB 접속과 SQL 적용 (운영·격리 포함)
- 운영 배포, 유료 AI API 호출
- 미검증 항목의 완료 처리 (기존 완료 기록은 증빙이 확인된 범위만 유지)

---

## 실행 기록 — 단계 A (Cursor 지시서 03, 2026-10-21)

### A-1. 작업 환경과 기준

| 항목 | 결과 |
|---|---|
| ZIP 작업본 | `plan_os-main`은 그대로 보존했다. 미추적 산출물(`.env.local`, `dist/`, `node_modules/`)과 점검 문서 2종(`docs/quality/CURSOR_LOCAL_AUDIT_2026-10-21.md`, 본 계획서)은 삭제·수정하지 않았고, 점검 문서 2종은 클론에도 복사해 보존했다. |
| 정식 클론 | `plan_os-integration`에 `https://github.com/happysuyeun-rgb/plan_os.git`을 클론했다. |
| 기준 commit | `main` = `701841a075b1731c1f0c6d18622c1e9bb76a79dc`. 지시서 01 시점(`29780a3`) 이후 main에 커밋 2개(설계 교차검수 문서 추가와 실행계획서 추적 기록, 문서만 변경)가 추가된 것을 확인하고 최신 main을 기준으로 삼았다. 지적된 설계 문서는 지시서 표기와 달리 `docs/quality/PLANOS_DESIGN_CROSS_AUDIT_2026-10-21.md`에 있었다. |
| 통합 브랜치 | `feat/planos-g1-integration-stage-a-20261021` (기준 `701841a`) |
| PR 재조회 | 전 PR OPEN·Draft 유지. 이 기록 작성 시점의 GitHub mergeable은 조회 시점에 따라 UNKNOWN으로 표시되는 경우가 있어, 판정은 로컬에서 merge-base 기준 차분을 직접 계산한 결과로 대체했다. |

### A-2. PR #24 기준 재작성의 실측

- PR #24의 merge-base는 `c623e7ef77b1aa9e45f48c3e97d6f00ad57f7a80`이다. 이후 main에서 바뀐 파일 55개와 PR이 바꾼 파일 61개를 대조한 결과, **양쪽이 모두 바꾼 파일은 `package.json` 1개뿐**이었다. 나머지는 main에서 변경되지 않은 파일에 대한 PR 변경이거나 신규 파일이다.
- 따라서 방식은 커밋 cherry-pick이 아니라, PR #24의 변경을 파일 단위로 선별 적용하고 `package.json`만 수동 병합(스크립트 `test:s1`과 `test:unit`을 모두 유지)하는 것으로 했다.
- 이 결과는 "PR #24를 통째로 병합하면 최신 main이 되돌아간다"는 우려가 최소 이 파일 범위에서는 성립하지 않음을 뜻한다. 다만 동작 검증은 별개이며 아래 테스트 실패가 남아 있다.

### A-3. 반영·제외 목록

**반영 (PR #24에서 선별):**

| 구분 | 내용 |
|---|---|
| 자동저장·초안 | `src/lib/documentAutosave.ts`, `src/lib/unsavedDraft.ts`, `src/store/documentStore.ts`, `src/pages/DocumentPage.tsx`, 관련 컴포넌트(ConfirmModal, SaveVersionModal, ScreenListTable, WireframeSlideView, EditableInlineTitle, RenameProjectModal)와 린트 수정(`useDebouncedSave`, `src/lib/api/projects.ts`) |
| 조건부 저장 | `src/lib/api/documents.ts`의 `saveDocumentContentIfUnchanged`와 자동저장 연결. 단 아래 A-5의 우회 경로 참조 |
| 복원 | `src/lib/api/versions.ts`, `src/store/versionStore.ts`, 마이그레이션 015(원자적 복원 RPC) |
| 채팅 | `src/lib/api/chat.ts`(RPC `commit_chat_document_edit` 호출), `src/lib/chatDocumentEdit.ts`, `src/store/chatStore.ts`, `ChatPanel`, 마이그레이션 016 |
| RLS | `src/store/commentStore.ts`, 마이그레이션 013(멤버 재귀)·014(댓글·알림·버전 강화), RLS 테스트·워크플로 |
| 테스트·CI·문서 | PR의 단위 테스트 7종, `tests/rls/*`, `tests/e2e/*`, 워크플로 7종, QA·엔지니어링 문서. `docs/qa/*`의 옛 마이그레이션 링크는 재번호에 맞게 갱신했다. |

**제외:**

| 대상 | 제외 이유 |
|---|---|
| PR #15, #19의 개별 병합 | 파일이 전부 PR #24에 포함되어 있어 중복 적용이다. 두 PR은 통합 완료 후 대체 명시와 함께 닫는 대상으로 남긴다. |
| PR #22의 본문 비교 CAS 단독 채택 | D-1 결정에 따라 방식이 충돌한다. PR #24에도 같은 이름의 API가 포함되어 있어 별도 병합은 하지 않았다. |
| PR #25, #27 (S3/S4 Mock) | 설계 교차검수 문서의 "결함 안정화 완료 전 main 병합 금지"와 본 계획 §8에 따라 이번 브랜치에 섞지 않았다. |
| `013_document_revision_cas_DRAFT.sql`의 정식 적용 | 017로 재번호하되 파일명의 DRAFT와 파일 안의 적용 금지 경고를 그대로 유지했다. 어떤 DB에도 실행하지 않았다. |
| PR #24의 커밋 이력 자체 | cherry-pick 대신 파일 단위 선별을 택했으므로 PR의 커밋은 브랜치에 들어오지 않았다. |

### A-4. 마이그레이션 최종 정리 (단계 A 확정)

main 기존 번호(001~008, 011, 012)는 건드리지 않았다. PR 전용 SQL은 아래로 재번호했고, 워크플로·테스트·계약 문서의 참조를 함께 고쳤다.

| 최종 번호 | 내용 | 출처 |
|---|---|---|
| 013 | 멤버 SELECT 재귀 수정 | PR 009 |
| 014 | 댓글·알림·버전 정책 강화 | PR 010 |
| 015 | 원자적 문서 복원 RPC + 복원 operation 테이블 | PR 011 |
| 016 | 원자적 채팅 문서 수정 RPC + 채팅 operation 테이블 | PR 012 |
| 017 | 문서 revision CAS (**DRAFT 유지, 실행 금지**) | PR 013 |

- 의존성: 013~017은 전부 006의 `get_project_role`/`can_access_project`/`can_edit_project_content`에 의존한다. 적용 순서는 001부터 번호 순서를 지켜 빈 DB에 통째로 적용하는 것만 인정한다.
- 적용 이력: 어떤 DB에 무엇이 적용됐는지는 이 단계에서 확인할 수 없었다(D-5 미확정). 운영 DB에는 적용하지 않았고, 격리 DB에도 아직 적용하지 않았다. 재번호한 파일을 적용 이력이 불명인 DB에 넣지 않는다.
- 잔여: `tests/rls/test_member_select_009.sql`의 파일명은 시험 이름으로서 009를 유지했다(마이그레이션 번호가 아니라 PR 시절 테스트 명칭). 혼동이 크면 단계 B에서 개명한다.

### A-5. 직접 쓰기 우회 경로 표시 (통합 후 현재 상태)

| 경로 | 통합 후 상태 |
|---|---|
| 자동저장 (W1) | `saveDocumentContentIfUnchanged`(본문 비교 조건부)로 연결됨. 단 이 방식은 D-1에서 지적한 장문 한계가 있어, 017 revision CAS가 정식화되면 교체 대상이다. |
| 복원 (W2) | 원자적 RPC(015)를 호출하는 구조로 반영됨. 격리 DB 실증 전에는 동작 보장 없음. |
| 채팅 (W5) | 직접 UPDATE가 제거되고 RPC(016) 호출로 교체됨. |
| 생성 파이프라인 (W3), 재생성 (W4), 게스트 이전 | **여전히 `upsertDocument` 무조건 쓰기다.** revision 규칙이 정식화되기 전까지 이 세 경로는 우회로 남는다. 단계 C의 완료 조건에서 반드시 함께 전환한다. |
| `saveDocumentContent` (무조건 UPDATE 함수) | **호출처는 없어졌지만 함수 자체가 남아 있다.** 이후 코드가 다시 호출하면 우회가 부활하므로, 단계 C에서 제거하거나 내부 전용으로 봉인해야 한다. 이번 단계에서는 삭제를 금지 조건으로 두어 남겨 두었다. |

### A-6. 검수 결과 (실제 실행)

| 검사 | 명령 | 결과 |
|---|---|---|
| 의존성 설치 | `npm ci` | 성공 |
| 빌드 | `npm run build` | **성공** (exit 0). 경고는 기존과 같은 번들 1.1MB 단일 청크와 `lottie-web` eval 2건 |
| 단위 테스트 전체 | `npm run test:unit` (`tests/*.test.mjs`, 47건) | **43 pass / 4 fail** (아래 A-7) |
| 기존 S1 테스트 | `npm run test:s1` | 6/6 pass |
| 변경 파일 린트 | 변경한 `src` 파일 지정 실행 | 0 errors, 1 warning (`DocumentPage` exhaustive-deps) |
| 전체 린트 | `npm run lint` | **0 errors, 1 warning으로 통과.** main의 13 errors가 PR에 포함된 린트 수정으로 해소됐다. 단 이것은 PR이 가져온 수정이며, 린트 청정을 기능 완료로 해석하지 않는다. |
| 충돌 마커 | `<<<<<<<`, `=======`, `>>>>>>>` 전수 검색 | 없음 |
| 누락 파일 | 테스트·워크플로가 참조하는 마이그레이션 경로 전수 대조 | 참조된 파일 전부 존재. 재번호로 깨진 참조는 A-4 작업에서 함께 수정했다. |
| 브라우저·DB 검증 | — | **수행하지 않았다.** 격리 환경(D-5)이 없어 이 단계에서는 실행할 수 없었다. |

### A-7. 실패 항목과 원인 (재현 절차 포함)

단위 테스트 실패 4건은 전부 PR #24가 가져온 신규 테스트에서 발생했다.

| 테스트 | 파일 | 내용 |
|---|---|---|
| `serializes in-flight writes without stale success callback` | `tests/documentAutosave.test.mjs` | 진행 중 저장이 직렬화되지 않아 오래된 성공 콜백이 남는다 |
| `restore after pending draft never lets old debounce overwrite the restored content` | `tests/documentAutosave.test.mjs` | 복원 후에도 예전 디바운스 저장이 복원 본문을 덮을 수 있다 |
| `acknowledgement of older in-flight revision advances baseline for newer queued edit` | `tests/g1-autosave-cas.test.mjs` | 오래된 저장 응답이 새 편집의 기준값을 전진시키지 못한다 |
| `draft CAS compares compact server revision, not document body` | `tests/g1-revision-cas-contract.test.mjs` | 017 초안이 기대하는 `content_revision = content_revision + 1` 형태와 실제 SQL 내용이 다르다 |

**원인 판정:** 통합 작업이 만든 실패가 아니다. PR #24 원본 head(`4923c5d`)를 별도 워크트리로 체크아웃해 같은 테스트를 실행한 결과 **동일한 4건이 그대로 실패**했다. 즉 PR #24는 자체 테스트가 기대하는 동작을 코드가 아직 충족하지 못하는 상태로 작성되어 있으며, 이는 통합 실행계획서의 기존 기록(G1-B-04의 설계 결함 지적)과도 일치한다.

**재현 절차:** 클론에서 `npm run test:unit`을 실행하면 47건 중 위 4건이 실패한다. 파일별로는 `node --experimental-strip-types --test tests/documentAutosave.test.mjs` 등 개별 실행으로 분리할 수 있다.

**처리 방침:** 이번 단계에서 임의로 고치지 않았다. 이 4건은 단계 C(P0-01 저장 안전성)의 착수 조건이자 완료 기준의 일부로 이관한다. 테스트를 삭제하거나 기대값을 낮춰 통과시키는 방식으로 처리하지 않는다.

### A-8. 단계 A 완료 판정과 단계 B 착수 가능 여부

| 완료 기준 (계획 §3.2 단계 A) | 판정 |
|---|---|
| 통합 브랜치를 최신 main 기준으로 생성 | 충족 (`feat/planos-g1-integration-stage-a-20261021`, 기준 `701841a`) |
| PR 중복 제거와 선별 반영 목록 확보 | 충족 (A-3) |
| 충돌 정리 | 충족. 텍스트 충돌은 `package.json` 1건뿐이었고 수동 병합했다. 충돌 마커 없음 |
| 마이그레이션 의존성 검토와 재번호 | 충족 (A-4). 단 적용 이력 확인은 D-5 미확정으로 불가 |
| 빌드·테스트 결과 기록 | 충족 (A-6, A-7). 테스트 실패 4건을 숨기지 않고 원인과 함께 기록했다 |

**단계 A 판정: 조건부 완료.** 브랜치 구축과 선별 반영이라는 단계 A의 목적은 달성했지만, 통합된 코드에는 PR에서 물려받은 테스트 실패 4건과 우회 경로 3건(W3/W4/게스트 이전)이 남아 있다. 이 브랜치는 main 병합 대상이 아니며, 그 상태 그대로 기능이 동작한다고 주장할 수 없다.

**단계 B 착수 가능 여부: 지금은 착수할 수 없다.** 이유는 두 가지다.

1. 격리 검증 환경(D-5: 로컬 Supabase 또는 전용 개발 DB, 테스트 계정 시드)이 확정되지 않았다. 단계 B는 빈 격리 DB에 마이그레이션 001~017을 적용하고 역할별 JWT를 실측하는 작업이라 환경 없이는 시작 자체가 불가능하다.
2. 단계 B의 전제로 삼을 클라이언트 저장 동작이 테스트 4건 실패 상태다. RLS만 먼저 검증하고 저장 결함을 나중에 고치면, 단계 C에서 저장 경로를 바꿀 때 RLS 검증을 다시 해야 한다.

**다음 작업 1개:** 격리 검증 환경을 확정하고(환경 종류, 접속 정보 관리 방식, 테스트 계정 시드 담당), 그 환경에서 단계 B의 첫 실행인 "빈 DB에 001~017 순서 적용"까지를 수행한다. 그 전까지는 코드 병합·운영 DB·배포를 하지 않는다.

---

## 실행 기록 — 단계 B-01 (Cursor 지시서 04, 2026-10-21)

### B01-1. 작업 기준 재확인

- 통합 브랜치 `feat/planos-g1-integration-stage-a-20261021`, 로컬 기준 커밋 `c22a3e9`. 작업 트리는 시작 시점에 clean이었고, GitHub `main`은 `701841a`로 단계 A 기준과 동일함을 재확인했다.
- 통합 실행계획서, 설계 교차검수 보고서(`docs/quality/PLANOS_DESIGN_CROSS_AUDIT_2026-10-21.md`)를 먼저 확인했다. 설계 문서의 인수 기준 중 "writer 단일 경로", "역할별 UI·RLS·API 일치", "독립 PR #25/#27을 안정화 전 main에 병합하지 않았는지"를 이번 검증의 전제로 삼았다.

### B01-2. 실제 사용한 테스트 환경

| 항목 | 내용 |
|---|---|
| 방식 | 우선순위 2안(개발 전용 Supabase 프로젝트)은 사용자 승인이 필요하므로 사용하지 않았다. 우선순위 1안의 변형으로, **일회용 PostgreSQL 17 컨테이너 + Supabase 인증 에뮬레이션**을 사용했다. |
| 컨테이너 | `postgres:17-alpine`, 이름 `planos-g1-b01-pg`, 호스트 포트 55432, DB `planos_b01`, 비밀번호는 로컬 테스트용 임의값. 검증 후 컨테이너를 제거했다. |
| 기존 로컬 Supabase와의 분리 | 이 PC에는 다른 작업의 로컬 Supabase 스택이 이미 실행 중이었다. 그 스택과 그 데이터는 건드리지 않았고, 별도 컨테이너·별도 포트·별도 DB로 완전히 분리했다. |
| 운영 정보 사용 여부 | 운영 Supabase 접속 정보, 운영 환경변수, 실사용자 데이터를 일절 사용하지 않았다. 모든 계정·프로젝트·문서는 `example.test` 합성 데이터다. |
| 인증 에뮬레이션 | `tests/rls/bootstrap_postgres.sql`이 만드는 `auth.users`와 `auth.uid()`(JWT claim `request.jwt.claim.sub` 기반)를 사용하고, `set local role authenticated/anon`으로 실제 RLS가 적용되는 세션을 만들었다. 관리자 권한으로 직접 판단하는 테스트가 아니다. |
| 재현 스크립트 | `tests/rls/run_b01_local_pg.sh`를 추가했다. 같은 명령으로 빈 환경에서 전체를 재실행할 수 있다. |
| 한계 | 실제 Supabase(GoTrue + PostgREST + 실제 JWT 발급) 환경이 아니다. `tests/rls/test_local_supabase_*.mjs` 같은 실제 Auth/PostgREST 통합 테스트는 이번에 실행하지 못했으며, 이 한계가 남는 한 RLS 검증을 "실제 Supabase에서 통과"로 표기하지 않는다. |

### B01-3. 마이그레이션별 적용·보류 상태

빈 DB에 `ON_ERROR_STOP=1`로 한 건씩 적용하고 건마다 결과를 기록했다.

| 번호 | 파일 | 결과 |
|---|---|---|
| 001~008 | 기존 스키마 일괄 | 전부 적용 성공 |
| 011 | `011_project_tasks.sql` | 적용 성공 |
| 012 | `012_audit_source_manifests.sql` | 적용 성공 (`extensions` 스키마와 pgcrypto를 파일이 직접 생성) |
| 013 | 멤버 RLS 재귀 조정 | 적용 성공. 006의 자기 참조 정책이 만드는 42P17 재귀를 SECURITY DEFINER 헬퍼 경유로 교체함을 코드로 확인 |
| 014 | 댓글·알림·버전 강화 | 적용 성공. 적용 후 `document_versions`의 UPDATE 정책이 사라져 버전 불변성이 정책 수준에서 확인됨 |
| 015 | 원자적 문서 복원 RPC | 적용 성공 |
| 016 | 원자적 채팅 문서 수정 RPC | 적용 성공 |
| 017 | Revision CAS 초안 | **적용하지 않았다.** 적용 후 `documents.content_revision` 컬럼과 CAS 함수가 없음을 조회로 확인했다. |

사전 의존성 검사: 007 이후의 모든 마이그레이션은 006이 정의하는 `get_project_role`/`can_access_project`/`can_edit_project_content`에 의존하므로, 번호 순서 적용이 곧 의존성 순서와 일치한다. 중간 번호만 골라 적용하는 방식은 인정하지 않는다.

적용 과정에서 찾은 환경 결함: PR이 가져온 `bootstrap_postgres.sql`에는 015/016이 호출하는 `auth.role()`이 없어, 원본 그대로는 복원 RPC 실행 시 `function auth.role() does not exist` 오류가 났다. 실제 Supabase에는 있는 함수이므로, 에뮬레이션에 `auth.role()`을 추가해 보완했다(테스트 코드 수정이며 마이그레이션 변경이 아니다).

### B01-4. RLS 역할별 결과 (전부 실제 실행)

시드: `tests/rls/seed_members.sql`의 합성 사용자 7명(owner/editor/viewer/pending/타 프로젝트 owner·editor/outsider)과 프로젝트 2개.

| 검증 | 실행 파일 | 결과 |
|---|---|---|
| 멤버 조회 격리: owner·editor·viewer는 자기 프로젝트 명단만, pending은 자기 초대 행만, 타 프로젝트 사용자와 outsider·anon은 0건 | `tests/rls/test_member_select_009.sql` | **PASS** (전 항목) |
| 문서 읽기 격리: 역할별 자기 프로젝트만, outsider·anon 0건 | `tests/rls/test_b01_role_matrix.sql` (신규) | **PASS** |
| 문서 쓰기: editor 1건 성공, viewer·outsider 0건(차단) | 〃 | **PASS** |
| 업무 쓰기: editor 생성 성공, viewer 차단 | 〃 | **PASS** |
| 멤버 제거 후 즉시 차단: 제거된 editor는 `can_access_project=false`, 문서 0건 | 〃 | **PASS** |
| 복원 RPC: viewer 호출 시 서버에서 거부(42501 계열), owner 호출 시 정상 복원 | 〃 + 수동 확인 | **PASS** |

### B01-5. SECURITY DEFINER 검수 결과

적용 후 public 스키마의 SECURITY DEFINER 함수 10개를 전수 조회했다.

- 전부 소유자가 `postgres`이고, 복원·채팅·감사 manifest RPC는 함수 내부에서 `can_edit_project_content` 또는 owner 역할을 다시 확인한다. viewer의 복원 RPC 호출이 실제로 거부되는 것을 B01-4에서 확인했으므로, DEFINER라는 이유만으로 권한이 뚫리지는 않았다.
- **결함 B01-D1 (P2):** `get_project_role`, `can_access_project`, `can_edit_project_content`, `handle_new_user`, `record_project_task_event`에 실행 권한 ACL이 없어 기본값인 PUBLIC execute(anon 포함) 상태다. 현재 구현은 `auth.uid()`가 없으면 null/false를 반환해 실제 누출은 확인되지 않았지만, 최소 권한 원칙상 authenticated 전용으로 좁히는 것이 맞다. 단계 B 후속 또는 단계 C에서 REVOKE/GRANT를 정리한다.
- **결함 B01-D2 (P2):** 감사 manifest 함수 2종은 `search_path=""`로 설정되어 있다. 본문이 스키마를 명시해 동작에는 문제가 없었으나, 빈 search_path는 유지보수 중 암묵적 참조가 생기면 바로 깨지는 형태다. 정식화 시점에 `pg_catalog, public` 형태로 통일할 것을 권고한다.
- 트리거 함수(`record_project_task_event`, `validate_project_task_change`)는 DEFINER 여부가 아니라 트리거 권한으로 동작하므로 별도 위험으로 보지 않았다.

### B01-6. 기존 실패 테스트 4건 재현

`npm run test:unit`을 재실행했다. **47건 중 43건 통과, 동일한 4건이 그대로 실패**했다(자동저장 직렬화, 복원 후 덮어쓰기, 기준 revision 전진, Revision CAS 계약). 테스트를 삭제하거나 기대값을 바꾸지 않았다. 이 4건은 단계 C의 착수 조건으로 유지한다.

### B01-7. 추가 발견 사항

| ID | 심각도 | 내용 |
|---|---|---|
| B01-D1 | P2 | SECURITY DEFINER 헬퍼 5종의 PUBLIC execute (B01-5) |
| B01-D2 | P2 | 감사 manifest 함수의 빈 search_path (B01-5) |
| B01-D3 | P1 | 실제 Supabase Auth/PostgREST 경로(실제 JWT 발급, `test_local_supabase_auth.mjs`, `test_local_supabase_content.mjs`)는 아직 실행된 적이 없다. 현재 근거는 PostgreSQL 에뮬레이션까지이며, PostgREST의 역할 전환·claim 전달이 실제와 같은지는 미확인이다. |
| B01-D4 | P1 | 014 적용 후 댓글·알림 강화 정책이 실제로 역할별로 어떻게 동작하는지는 이번 매트릭스에 포함되지 않았다(정책 존재만 확인). 댓글·알림·버전의 역할별 실측은 단계 B 후속으로 남긴다. |
| B01-D5 | P2 | `tests/rls/bootstrap_postgres.sql`의 주석이 "001..009" 기준으로 쓰여 있어 현재 016 범위와 맞지 않는다. 에뮬레이션 범위(015/016의 `auth.role()` 포함)를 주석에 반영해야 한다. 이번에 `auth.role()`은 추가했지만 주석 정리는 함께 수행했다. |

### B01-8. 다음 수정 대상 파일 및 우선순위

1. **단계 C 착수 조건:** 실패 테스트 4건이 가리키는 `src/lib/documentAutosave.ts`와 `src/store/documentStore.ts`의 직렬화·기준값 전진·복원 후 덮어쓰기 문제. 테스트를 건드리지 않고 코드를 고친다.
2. `supabase/migrations/` 후속 번호(018 예비): B01-D1의 실행 권한 정리와 직접 UPDATE 차단을 묶은 컷오버. 모든 쓰기가 RPC로 전환된 뒤에만 적용한다.
3. `tests/rls/test_b01_role_matrix.sql` 확장: 댓글·알림·감사 manifest의 역할별 실측(B01-D4)과 실제 Supabase 로컬 스택에서의 재실행(B01-D3).
4. `docs/engineering/G1_DOCUMENT_WRITER_AUDIT_2026-10-21.md`의 쓰기 경로 목록에 이번에 확인한 우회 잔여(W3/W4/게스트 이전)를 그대로 유지하고, 전환 완료 시에만 상태를 바꾼다.

### B01-9. 단계 B-01 완료 판정

| 완료 기준 | 판정 |
|---|---|
| 운영과 분리된 독립 DB 환경 구축 | 충족 (일회용 PostgreSQL 컨테이너, 합성 데이터, 운영 정보 미사용) |
| 마이그레이션 사전검증과 단계별 적용 | 충족 (001~016 전부 적용 성공, 017 보류 유지) |
| 실제 역할/JWT 조건의 RLS 테스트 | **부분 충족.** 멤버·문서·업무·복원 RPC·멤버 제거는 실측 PASS. 단 실제 Supabase Auth/PostgREST 경로는 미실행(B01-D3)이고 댓글·알림 상세 매트릭스가 남았다(B01-D4) |
| 실패 테스트 4건 유지 | 충족 (동일하게 재현, 삭제·우회 없음) |

**단계 B-01 판정: 조건부 완료.** 격리 환경 구축과 PostgreSQL 수준의 RLS 실증이라는 목적은 달성했지만, 실제 Supabase 스택에서의 재검증이 남아 있어 단계 B 전체가 끝난 것으로 보지 않는다. 다음은 단계 C(저장 안전성 코드 수정)로 넘어가되, B의 잔여 실증(실제 Supabase 로컬 스택 기동 후 동일 매트릭스 재실행)을 단계 E 회귀 전에 반드시 채운다. 운영 DB·main 병합·배포는 하지 않았다.

---

## 실행 기록 — 단계 C-01 (Cursor 지시서 05, 2026-10-21)

### C01-1. 실패 4건의 원인과 조치

작업 시작 시점에 `npm run test:unit`으로 47건 중 4건 실패를 다시 재현한 뒤 착수했다. 기존 테스트의 기대값은 하나도 바꾸지 않았다.

| # | 실패 테스트 | 원인 (실제 코드 기준) | 조치 |
|---|---|---|---|
| 1 | `serializes in-flight writes without stale success callback` (`tests/documentAutosave.test.mjs`) | 저장이 진행 중일 때 새 편집이 들어와도, 진행 중이던 오래된 저장이 완료되면 `onSaved`가 그대로 발행돼 낡은 스냅샷이 "저장됨"으로 보고됐다. | 문서별 작업에 진행 중 revision 추적을 추가했다. 진행 중 저장이 있던 상태에서 새 편집이 예약되면 그 저장은 서버에 그대로 기록하되(취소 불가) 가시적인 저장 완료 콜백을 발행하지 않고, 기준값만 조용히 전진시킨다. |
| 2 | `restore after pending draft never lets old debounce overwrite the restored content` (`tests/documentReplacement.test.mjs`) | 복원(`replace`)이 사전 작업으로 미저장 초안을 저장하면서 그 저장 완료 이벤트까지 발행해, 복원이 소유해야 할 최종 상태와 경합하는 표시가 남았다. | 교체 경로의 사전 저장은 완료 이벤트를 발행하지 않고 기준값만 전진시키도록 바꿨다. 최종 상태는 복원 결과(`onCommitted`/`onReplaced`)만 보고한다. |
| 3 | `acknowledgement of older in-flight revision advances baseline for newer queued edit` (`tests/g1-autosave-cas.test.mjs`) | 큐에 대기 중인 저장이 실행 시점에 "최신 revision이 아니다"라는 이유로 통째로 건너뛰어졌다. CAS에서는 다음 저장의 기대 기준값이 바로 이 스냅샷이라, 건너뛰면 이후 저장이 전부 오래된 기준값으로 실패한다. | 건너뛰기 조건을 "이미 저장된 revision의 중복 실행"으로만 좁혔다. 큐에 들어간 스냅샷은 예약 순서대로 전부 저장·확인되며 기준값이 순서대로 전진한다. |
| 4 | `draft CAS compares compact server revision, not document body` (`tests/g1-revision-cas-contract.test.mjs`) | 017 초안의 CAS 함수가 본문을 갱신하면서 revision을 명시적으로 전진시키지 않아, 계약 테스트가 요구하는 "revision 비교 + revision 전진" 형태와 달랐다. 트리거와의 이중 전진 우려는 트리거가 `old + 1`을 강제 대입하므로 실제로는 한 번만 오른다. | CAS의 SET 절에서 revision을 명시적으로 `+1` 전진시키고(트리거의 강제 대입과 합쳐도 최종 증가량은 1), 본문이 아니라 revision으로만 비교한다는 주석을 달았다. 017은 여전히 DRAFT이며 어떤 DB에도 적용하지 않았다. |

### C01-2. 자동저장·복원 충돌 방지 방식 (수정 후)

- **문서별 직렬화:** 저장은 문서 ID별 큐(`tail`)로만 직렬화되고, 다른 문서는 서로를 막지 않는다. 신규 테스트로 "한 문서가 막혀 있어도 다른 문서는 저장 완료됨"을 검증했다.
- **기준값 관리:** 성공한 저장만 기준값을 전진시킨다. 진행 중 덮인 저장은 가시 콜백 없이 `onCommitted`로 기준값과 로컬 복구 초안의 기준을 함께 전진시키며(`documentStore`), 실패·충돌한 저장은 기준값을 건드리지 않고 해당 revision을 실패로 표시해 같은 경로로 재시도할 수 있게 한다.
- **복원 보호:** 복원·재생성·채팅은 같은 문서별 큐의 `replace`를 거친다. 미저장 초안은 복원 전에 먼저 저장하고, 그 저장이 실패하면 복원 자체를 시작하지 않는다. 복원 중 들어온 새 편집은 복원보다 최신으로 취급해 복원 결과로 화면을 덮지 않는다.
- **충돌 처리:** 서버 비교 저장이 실패하면 `DocumentWriteConflictError`로 상태를 `error`로 표시하고, 로컬 입력은 복구 초안으로 보존된다. 자동 재시도로 서버를 덮지 않으며, 사용자가 서버를 다시 확인한 뒤 같은 편집을 재저장하는 경로를 신규 테스트로 검증했다. 화면에는 기존 복구 충돌 UI(`DocumentPage`의 충돌 초안 표시)가 그대로 연결된다.

### C01-3. 수정 파일

| 파일 | 변경 |
|---|---|
| `src/lib/documentAutosave.ts` | 진행 중 revision 추적과 낡은 완료 콜백 억제, 큐 스냅샷 건너뛰기 조건 축소, 교체 사전 저장의 콜백 분리 |
| `src/store/documentStore.ts` | 조용한 기준값 전진 시 복구 초안의 기준도 함께 전진 |
| `supabase/migrations/017_document_revision_cas_DRAFT.sql` | CAS revision 명시 전진과 주석 정합 (적용하지 않음) |
| `tests/documentAutosave-concurrency.test.mjs` | 신규: 문서 간 독립 저장, 충돌 후 입력 보존·재저장 검증 |

### C01-4. 수정 전후 테스트 결과

| 검사 | 수정 전 | 수정 후 |
|---|---|---|
| `npm run test:unit` | 47건 중 43 pass / **4 fail** | **49건 중 49 pass** (기존 47건 전부 통과 + 신규 2건) |
| `npm run test:s1` | 6/6 pass | 6/6 pass |
| `npm run build` | 성공 | 성공 (경고는 기존 번들 크기·eval 2건과 동일) |
| `npm run lint` | 0 errors / 1 warning | 0 errors / 1 warning (신규 오류 없음) |

필수 검증 대응: 동일 문서 다중 요청(직렬화 테스트), 다른 문서 동시 저장(신규 테스트), 복원과 자동저장 경쟁(교체 테스트군), 충돌 후 입력 유지(신규 테스트)가 전부 실행됐다. 실제 DB·브라우저 검증은 이번 범위에서 수행하지 않았다.

### C01-5. 서버 CAS·DB 의존성으로 남긴 것

- 클라이언트 저장은 여전히 **본문 비교** 방식(`saveDocumentContentIfUnchanged`)이다. 이번에 정합을 맞춘 revision CAS(017)는 초안이며, 클라이언트가 `content_revision`을 읽어 RPC를 호출하는 연결, 다른 쓰기 경로(생성·재생성·게스트 이전)의 revision 전진, 직접 UPDATE 차단은 아직 없다.
- 따라서 다중 클라이언트 동시 편집의 최종 차단은 서버 revision CAS와 격리 DB 실증이 끝나야 성립한다. 이번 수정은 단일 클라이언트 안에서의 순서·기준값·표시 안전성을 코드와 단위 테스트로 고정한 것까지다.
- 실제 Supabase Auth/PostgREST 실증(B01-D3)과 댓글·알림 상세 매트릭스(B01-D4)도 그대로 남아 있다.

### C01-6. 단계 C-01 판정

**단계 C-01 판정: 완료(코드·단위 테스트 범위).** 실패 4건의 원인을 코드에서 해결했고 전체 단위 테스트와 빌드·린트를 통과했다. 다만 지시서 기준대로 **단계 C 전체 완료로 표시하지 않는다.** 서버 Revision CAS 연동과 실제 DB 검증이 남아 있기 때문이다.

**다음 개발 작업 1개:** 클라이언트 자동저장을 본문 비교에서 revision CAS로 전환하는 단계 C-02. 017을 정식화하기 전에, 생성·재생성·게스트 이전까지 모든 쓰기 경로가 revision을 전진시키는 설계와 격리 DB 동시성 테스트를 먼저 확정한다. 운영 DB·main 병합·배포는 하지 않는다.
