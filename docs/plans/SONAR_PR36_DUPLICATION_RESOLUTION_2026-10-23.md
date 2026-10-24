# PR #36 Sonar 중복률 — 원인·조치 (2026-10-23)

## 원인 (Automatic Analysis)

| 시도 | 결과 |
|---|---|
| `sonar-project.properties` + `sonar.cpd.exclusions=supabase/migrations/**` | **무시됨**. AA는 이 파일을 읽지 않음 ([문서](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/automatic-analysis): *Presence of a properties file*). |
| 측정 | `new_duplicated_lines_density=9.0` — 거의 전부 `022`/`023`/`024` 간 CREATE OR REPLACE 본문 중복 (62+116+62), E2E 14줄. |

## 의도적 재정의 vs 결함

- **의도:** 022 스키마+초기 RPC → 023 무결성 강화 → 024 재검토 보강. 운영/Preview는 파일을 **순서대로 적용**해야 하므로 히스토리 본문을 한 파일로 합치면 이미 적용된 DB와 불일치 위험이 큼.
- **결함 아님:** 동일 함수의 버전 누적. 앱 TypeScript 중복 결함 아님.
- **회귀 유지:** `tests/rls/test_local_supabase_pm_*.mjs` + CI `rls-auth-integration` (전체 mig 적용 후 JWT/RLS).

## 조치 (좁은 범위 우선)

1. **`.sonarcloud.properties`** 추가 — AA가 실제로 읽는 파일.
2. CPD 제외를 **022·023·024 세 경로만** 명시 (와일드카드 불가; 전체 `migrations/**` 일괄 제외 안 함).
3. `sonar-project.properties`는 CI 전환 시에만 동일 좁은 목록으로 유지.

## CI 기반 분석 적합성

| | Automatic Analysis | CI 기반 |
|---|---|---|
| 설정 파일 | `.sonarcloud.properties` | `sonar-project.properties` + Action |
| 로그 | 없음 | 있음 |
| 전제 | 현재 사용 중 | **AA 끄기** + `SONAR_TOKEN` 시크릿 필요 |
| 권고 | 이번엔 AA+좁은 CPD로 QG 재측정 | AA가 PR head props를 무시하면 전환 검토 (org 관리자·시크릿 승인) |

AA와 CI를 **동시에** 돌리면 분석 충돌 — 전환 시 AA OFF 필수.

## 수용 기준

- PR #36 Sonar Quality Gate **OK** (실측 제출).
- PM RLS 스위트 회귀 유지.
