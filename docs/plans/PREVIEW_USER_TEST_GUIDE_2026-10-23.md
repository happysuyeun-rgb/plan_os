# PlanOS 통합 Preview — 사용자 직접 테스트 안내서

작성일: 2026-10-23  
대상 브랜치: `preview/planos-integrated-20261023` (PR #30 + #36 + #42 HEAD `716f9e6` 포함)  
상태: Preview 전용. **운영(Production) DB·`main` 병합·Production 배포와 무관합니다.**

---

## 1. Preview 접속

| 항목 | 값 |
|---|---|
| Preview URL | **https://planos-preview.vercel.app** |
| Vercel 프로젝트 | `planos-preview` (신규, Production PlanOS 앱과 **별도**) |
| 백엔드 | Supabase 프로젝트 **`PlanOS-Preview`** (`fydngfylpzdwvjyuqhdm`, 서울) |
| 운영 백엔드 | **`Plan OS`** (`ggviusdmxalsflyybamm`) — Preview에서 **사용하지 않음** |
| Feature flags | `VITE_ENABLE_DEV_LOGIN=true`, `VITE_S1_SERVER_TASKS=true` (Preview만) |
| 접근 제한 | Vercel Deployment Protection = **Vercel Authentication** (팀 로그인 필요). `X-Robots-Tag: noindex` |

접속 시 Vercel 계정으로 인증이 한 번 필요합니다. 외부 공개가 필요하면 대시보드에서 Protection 설정을 조정하되, 운영 키는 절대 넣지 마세요.

---

## 2. 테스트 계정 (가상 데이터만)

| 역할 | 이메일 | 용도 |
|---|---|---|
| Owner | `preview-owner@planos.test` | 프로젝트 생성·문서·PM 승인·업무·대시보드 |
| Editor | `preview-editor@planos.test` | 멤버 초대 후 편집 권한 확인 |
| Viewer | `preview-viewer@planos.test` | 읽기 전용 확인 |

**비밀번호는 GitHub·공개 문서에 기록하지 않습니다.** 검수자에게는 별도 채널(채팅/안전한 전달)로만 공유합니다.  
로그인 페이지의 **「개발용 임시 로그인」** 폼에 이메일·비밀번호를 입력합니다.  
Google 로그인은 Preview 프로젝트에 OAuth를 연결하지 않았으므로 사용하지 않습니다.  
`VITE_ENABLE_DEV_LOGIN` / `VITE_S1_SERVER_TASKS`는 **Preview 빌드 환경변수로만** 켜지며, 운영 Production 빌드에는 넣지 않습니다.

---

## 3. 시나리오 A — 직접 프로젝트 진행 (Owner)

1. Owner로 로그인 → 대시보드
2. 새 프로젝트 생성
3. 기획 문서(PRD 등) 작성·자동저장 확인
4. 새로고침·재진입 후 내용 유지 확인
5. 문서 버전 저장(스냅샷) → 내용 수정 → 이전 버전 복원
6. S1 업무 보드에서 업무 생성·상태 변경(할 일 / 진행 / 완료 / 차단)
7. 대시보드로 돌아와 **등록 업무 완료율·차단·승인 대기** 갱신 확인

---

## 4. 시나리오 B — 사람 PM 계획 → 승인 → S1 연결

현재 Preview에 **구현된 범위만** 제공합니다.

1. 프로젝트에서 PM 계획 작성·단계 입력·저장
2. 승인 요청 (pending)
3. Owner로 승인 / 반려 / 수정 요청 각각 1회
4. 승인된 계획의 단계를 S1 업무로 연결
5. 대시보드에서 승인 대기 건수·업무 집계 변화 확인

### 아직 구현되지 않음 (Mock / 미제공)

- 실제 AI PM 자동 실행·직원 채용
- 모델 선택·과금·구독
- AI 영업/마케팅 자동화
- N29 복수 프로젝트 AI PM 대시보드

화면에 위 기능이 보이더라도 **실제 과금·외부 발송·운영 데이터는 연결되지 않습니다.**

---

## 5. 시나리오 C — 오류·권한

| 항목 | 기대 |
|---|---|
| 잘못된 비밀번호 | 로그인 실패 안내 |
| Viewer | 문서·업무 쓰기 거부, 읽기는 가능(초대된 경우) |
| 승인 대기(pending) 계획 | 본문/단계 임의 변경 차단 |
| 동시 수정(문서 CAS / 업무 version) | 충돌 안내, 원본 보존 |
| 문서 복원 | 새 버전 append, 과거 버전 내용 불변 |
| 대시보드 집계 RPC 실패 | 오류 배너 + 「다시 시도」(가짜 0건으로 숨기지 않음) |
| 새로고침·재로그인 | 세션·데이터 유지 |

---

## 6. 검증자가 기록할 체크리스트

- [ ] Owner로 A 시나리오 완료
- [ ] B 시나리오(승인 루프 + 업무 연결) 완료
- [ ] Viewer/잘못된 로그인 확인
- [ ] 복원 후 과거 버전 내용이 바뀌지 않음
- [ ] 대시보드 수치가 업무·승인 상태와 일치
- [ ] 운영 프로젝트 URL(`*.supabase.co` 중 Plan OS)이 네트워크 탭에 **나타나지 않음**

문제 발견 시: 재현 단계 + 스크린샷 + 브라우저 콘솔/네트워크 오류를 Issue #41 또는 PR #42에 남기세요.

---

## 7. Preview ≠ Production

| | Preview | Production |
|---|---|---|
| Git 브랜치 | `preview/planos-integrated-20261023` | `main` (아직 병합 안 함) |
| Supabase | `PlanOS-Preview` | `Plan OS` |
| 데이터 | 테스트 계정·가상 프로젝트만 | 고객 데이터 — **건드리지 않음** |
| 배포 | Vercel Preview/`planos-preview` | **승인 전 금지** |
