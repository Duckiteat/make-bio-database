# STG-11c — 빠른 사전 검사

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [재건 계획 (rebuilding project) — 글이 아니라 구조가 말하게](../rebuild.md) · [순서](../ORDER.md)

- **계획 · 부**: rebuild 11c · 7. 단계
- **단계**: 빠른 사전 검사
- **무엇**: node rebuild/gate.mjs precheck — 구조 시험(rebuild · governance) + 생성 문서 --check + 계획 검사, 약 17 초. 이번 세션 전체 시험 실패 8 회 중 약 6 회가 여기서 잡힘. 전체 시험을 대신하지 않고 앞에 선다 (2026-11-01 영수증 측정, docs/reports/2026-11-01-work-automation.md §2)
- **끝나는 조건**: 이번 세션의 구조 실패 사례 재현을 precheck 가 잡음 · push 전 전체 시험은 그대로
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-01` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 반복 기록 일 자동화와 파일 탐침을 계획에 — 영수증으로 잰 효율 차이와 순서 (사용자 요청 2026-11-01, docs/reports/2026-11-01-work-automation.md)

## 닿는 결정

- [DEC-0047](../decisions/DEC-0047.md) 2026-11-01 반복 기록 일의 자동화와 파일 탐침 — 기록 규약은 그대로, 손일과 다시 돌리기만 줄인다
