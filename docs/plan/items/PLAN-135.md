# PLAN-135 — L6 PR 을 우회 없이

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 135 · 11부 — 자율 오케스트레이션 (주제 → 분해 → 실행 → 통합 → 검증, 사람은 주제 · 결정 · 승락)
- **작업**: L6 PR 을 우회 없이 — 독립 판정(trust-check)이 지키는 자리 변경을 "코드 소유자(사람 계정)의 승인 리뷰 + 사람 서명 커밋" 일 때만 통과시킴. 지금은 L6 PR 이 늘 실패해 사람이 규칙 우회(병합 때 모든 규칙을 건너뜀 · 관리자 상시 우회 권한)로만 병합한다
- **자리**: `rebuild/trust-check.mjs`(판정 — 순수) · `.github/workflows/trust.yml`(GitHub API 로 리뷰 · 서명 사실 모으기, 읽기만 · main 코드로만) · 시험 `tests/trust_check.test.mjs` · 모두 L6 → 승인 묶음(첫 적용은 우회 한 번)
- **끝나는 조건**: 조건 셋을 시험으로: ① L6 파일을 바꾼 커밋이 모두 사람 서명 커밋(GitHub 검증 서명 · 커미터 = 사람 계정, DEC-0094 와 같은 판정)이어야 — 승인만으로는 실패(AI 가 만든 L6 변경이 습관적 승인에 묻어가는 길) ② 승인은 PR 머리 커밋 sha 에 묶인 코드 소유자(HUMANS)의 APPROVED 리뷰만 — 봇 리뷰 · 옛 커밋 승인 · 승인 뒤 커밋 추가는 실패 ③ 판정은 main 의 코드로만(pull_request_target) · 다른 세션의 독립 재검토 · 변이 시험(검사를 끄면 빨개짐) · 사실을 못 모으면 실패(fail-closed). 그 뒤 규칙 세트 Bypass list 를 다시 비움(사용자) · 다음 L6 PR 이 우회 없이 승인 + 병합으로 끝남을 실제 PR 로 확인 · 선행: PLAN-117(GitHub 사실 모으기)
- **상태**: ☐ 대기

## 결과 (날짜별)

- `2026-11-25` 커밋 전 기록: 2026-11-25 선행 DEC-0100: 사람 서명은 사용자 자신의 SSH 서명 키로(Codespaces GPG 는 커미터가 web-flow 라 DEC-0094 판정을 통과 못 함 — PR #27 의 c298b23). 절차서 docs/reports/2026-11-25-human-signing-key-setup.md — 사용자 설정 뒤 다음 사람 커밋의 커미터 · Verified 로 확인

## 걸어온 길

- `2026-11-24` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 사용자 결정 DEC-0098 — L6 PR 을 우회 없이 (PLAN-135)
- `2026-11-25` 커밋 전 기록 결과 처음 적힘 — 사용자 결정 DEC-0100 — 사람 서명은 사용자 자신의 키로

## 닿는 결정

- [DEC-0098](../decisions/DEC-0098.md) 2026-11-24 L6 PR 은 이번(PR #26)만 우회 병합 — 앞으로는 독립 판정이 "코드 소유자 승인 + 사람 서명 커밋" 이면 통과(조건 셋), 그 뒤 우회 목록을 비움
- [DEC-0099](../decisions/DEC-0099.md) 2026-11-24 PLAN-117 — 승인 사실(병합한 계정 · 승인 리뷰)은 CI 가 모으고 판정도 CI 에서, 세션은 그 결과만 읽는다
- [DEC-0100](../decisions/DEC-0100.md) 2026-11-25 사람 서명 = 사용자 자신의 SSH 서명 키 — Codespaces 의 GPG verification(GitHub 키 · 커미터 web-flow)은 끈다
