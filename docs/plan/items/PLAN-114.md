# PLAN-114 — Governor 의 CI 겹

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 114 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **Governor 의 CI 겹** (DEC-0070 V2 · 검토 보고서 S4 ①) — 문지기 훅 · 설정 권한은 Claude Code 안에서만 걸린다. 서버 쪽(GitHub Actions)에서 커밋마다 "선언된 모드의 쓰기 구역 밖 변경" 을 거부한다. 모드 선언을 커밋에 싣는 방법(영수증 · 커밋 꼬리말 중)을 정하고, `gate.mjs` 의 구역 판정 함수를 그대로 재사용(새 판정 코드 없음). 근거 `docs/reports/2026-11-21-platform-independent-orchestrator-review.md`
- **자리**: `.github/workflows/check.yml` · `rebuild/gate.mjs` (판정 함수 재사용) · `tests/gate.test.mjs` (자기 검사 시험 — 사람 확인)
- **끝나는 조건**: 구역 밖 변경이 든 커밋을 CI 가 거부하는 시험 · 모드 선언이 없는 커밋의 처리 규칙 · 훅 없이 만든 커밋도 같은 판정 · CI 설정 변경이 L6 이면 사용자 커밋
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-21` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0070 — 독립형 오케스트레이터 검토의 권장 결정 전부

## 닿는 결정

- [DEC-0070](../decisions/DEC-0070.md) 2026-11-21 독립형 오케스트레이터 — 방향으로 기록 · 계약은 감독 장부 · Governor CI 겹 · 둘째 실행 모듈은 사람 작업 흐름
