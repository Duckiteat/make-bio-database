# STG-11d — 파일 탐침

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [재건 계획 (rebuilding project) — 글이 아니라 구조가 말하게](../rebuild.md) · [순서](../ORDER.md)

- **계획 · 부**: rebuild 11d · 7. 단계
- **단계**: 파일 탐침
- **무엇**: node rebuild/probe.mjs <파일 · 함수 · RULE-… · ASY-… · 작업 이름> — 닿는 자리를 한 번에: 규칙 장부 where · 집행 장부 · 시험 추적 지도 · 계획 자리 · git 함께 바뀜 · 단위 장부 분류 · 반복 작업 처방을 엮음(손으로 적은 지도를 새로 만들지 않음). 읽기·찾기가 호출의 37 % (2026-11-01 영수증) — 절반으로 줄이는 것이 목표 (docs/reports/2026-11-01-work-automation.md §4)
- **끝나는 조건**: 이번 세션 작업 셋(RULE-0525 · 0526 · 무결성 보고서)에 탐침이 내놓는 자리 ⊇ 실제로 고친 파일 · 읽기만
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-01` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 반복 기록 일 자동화와 파일 탐침을 계획에 — 영수증으로 잰 효율 차이와 순서 (사용자 요청 2026-11-01, docs/reports/2026-11-01-work-automation.md)

## 닿는 결정

- [DEC-0047](../decisions/DEC-0047.md) 2026-11-01 반복 기록 일의 자동화와 파일 탐침 — 기록 규약은 그대로, 손일과 다시 돌리기만 줄인다
