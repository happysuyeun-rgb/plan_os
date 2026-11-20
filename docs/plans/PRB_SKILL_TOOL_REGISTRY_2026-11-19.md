# PR-B — Agent Definition / Skill·Tool Registry (2026-11-19)

**F/TF/N:** STAFF registry hardening (기능 신규 화면 없음) · TF: CrewAI worker 계약  
**브랜치:** `feat/prb-skill-tool-registry-20261119`  
**기준 tip:** `main` @ `c9b8252` (#84 이후)  
**금지:** 추가 OSS 설치 · Gate C · Preview/ops DDL apply · OpenHands 활성화

## 목표

`roles.py`의 skill 문자열을 **등록된 Skill / Tool 계약**으로 승격한다.  
첫 실행 직무 `requirements_auditor_v1`부터 skill↔tool allowlist를 프롬프트·리포트 메타에 넣는다.

## 변경

| 파일 | 역할 |
|------|------|
| `workers/crewai/src/planos_crewai/skills.py` | Skill Registry |
| `workers/crewai/src/planos_crewai/tools_registry.py` | Tool Registry (prompt / liner / rpc / deferred_sandbox) |
| `workers/crewai/src/planos_crewai/roles.py` | `skill_tool_contract()`, import-time validate |
| `workers/crewai/src/planos_crewai/crews/requirements_auditor.py` | 프롬프트 + `skillToolContract` 메타 |
| `workers/crewai/src/planos_crewai/cli.py` | `skills` · `tools` · `skill-contract` |
| `workers/crewai/tests/test_skill_tool_registry.py` | 정합성 단위 테스트 |

## 수락

- [x] 모든 `ROLE_REGISTRY` skill id ∈ `SKILL_REGISTRY`
- [x] `requirements_auditor_v1` 계약에 gap/contradiction/testability/cite + manifest/finding/citation/liner 도구
- [x] OpenHands 도구는 `deferred_sandbox` · developer skills `executable_today=false`
- [x] `uv run pytest` PASS (워커 패키지)
- [ ] 실 Liner E2E — NOT RUN (키·큐 별도)

## 롤백

워커 모듈만 되돌리면 됨. 앱 TS·DDL 무변경.

## 다음 1코드

PR-C: Preview에서 `requirements_auditor_v1` CrewAI 큐 E2E 기본 고정 (fixture Mock 분리) · 또는 Preview 027/036/037 apply 승인.
