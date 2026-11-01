# STG-11b — 재생성 한 번에

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [재건 계획 (rebuilding project) — 글이 아니라 구조가 말하게](../rebuild.md) · [순서](../ORDER.md)

- **계획 · 부**: rebuild 11b · 7. 단계
- **단계**: 재생성 한 번에
- **무엇**: node rebuild/regen.mjs — 교과서 부록 · 관리 문서 · 계획 문서를 순서대로 다시 씀. 하나를 빠뜨려 전체 시험 끝에 '최신이 아님' 으로 실패하는 일을 없앰 (docs/reports/2026-11-01-work-automation.md §3)
- **끝나는 조건**: 재생성 뒤 textbook --check · status --check · plan check 통과
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-01` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 반복 기록 일 자동화와 파일 탐침을 계획에 — 영수증으로 잰 효율 차이와 순서 (사용자 요청 2026-11-01, docs/reports/2026-11-01-work-automation.md)

## 닿는 결정

- [DEC-0047](../decisions/DEC-0047.md) 2026-11-01 반복 기록 일의 자동화와 파일 탐침 — 기록 규약은 그대로, 손일과 다시 돌리기만 줄인다
