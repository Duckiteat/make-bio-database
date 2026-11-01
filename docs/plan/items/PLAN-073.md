# PLAN-073 — 등급 비교의 한 줄 세우기

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 73 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **등급 비교의 한 줄 세우기** — `reliability.meets` 가 여섯 등급을 순번으로 비교해, 쌍으로는 비교할 수 없는 구간값(S4,D2)과 매개변수(S3,D3)의 위아래를 정해 버림. 문턱(`min_grade`)을 순번이 아니라 축 조건으로 검사
- **자리**: `judicial/reliability.js`
- **끝나는 조건**: 비교 불가 쌍 시험 · 기존 문턱 판정 불변 확인
- **상태**: ☑ 완료 2026-10-25

## 결과 (날짜별)

- `2026-10-25` `58a94b9`: `THRESHOLD`·`atLeast`·`gateMinError`. 판정이 바뀐 곳은 문턱 bounded 에서 parameter 행뿐(전수 시험 ⑪). 발견: 규칙 '문턱은 올리기만' 이 집행되지 않아 `min_grade: reference` 가 관문을 낮출 수 있었음 → 거부(⑫)

## 걸어온 길

- `2026-10-24` `d2bb627` 계획에 들어옴 (☐ 대기) — build-plan 71(고침)·72·73 — 검증 상태는 기록의 축 (S,D,T,I), 인정은 (기록, 용도)·축 조건 ∧ 관계 조건, 등급 순번 비교 문제
- `2026-10-25` `58a94b9` 상태 ☐ → ☑ 2026-10-25 — Thresholds as axis conditions; gate threshold may only be raised (build-plan 73)
- `2026-10-25` `58a94b9` 결과 처음 적힘 — Thresholds as axis conditions; gate threshold may only be raised (build-plan 73)
