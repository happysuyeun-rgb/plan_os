# Slice 4 — 초대 메일 무과금 경로 · 2026-11-17

부모: [UNIMPLEMENTED_KICKOFF_PLAN](./UNIMPLEMENTED_KICKOFF_PLAN_2026-11-17.md)

## 동작

| `VITE_INVITE_EMAIL_MODE` | 동작 |
|--------------------------|------|
| 미설정 / `queue` (기본) | `project_members` pending 저장 · **메일 없음** · 링크 공유 |
| `supabase_otp` | pending 저장 + Supabase Auth `signInWithOtp` (무료 Auth 한도) |
| Resend/SendGrid 등 유료 SMTP | **미구현 · 보류** |

localDev는 항상 `recorded` (메일 없음).

## 수락

- Owner 초대 → DB pending row
- Toast가 `(mock)`이 아니라 delivery 상태를 말함
- 유료 SMTP 코드 경로 없음

## 롤백

env에서 `supabase_otp` 제거 → queue 모드.
