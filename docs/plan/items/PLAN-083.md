# PLAN-083 — 미카엘리스–멘텐 기질 수

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 83 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **미카엘리스–멘텐 기질 수** (분석 R5) — 두 엔진 모두 첫 기질만 포화 항에(`ir_builder.js:206`·`core.js:661`). 법칙 입력 > 1 이면 사실로 보고 + Kinetic_Gap, 또는 다기질 법칙 (`docs/reports/2026-10-25-architecture-analysis.md`)
- **자리**: 컴파일러 · 테이프 · `judicial/derivative.js`
- **끝나는 조건**: 컴파일러 시험 · 도함수 ≤ 1e-14
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-10-25` `3b0503f` 계획에 들어옴 (☐ 대기) — Reports: compute efficiency and architecture analysis; build-plan 80-87

## 닿는 결정

- [DEC-0030](../decisions/DEC-0030.md) 2026-10-25 구조 평가 뒤 순서 — 77 → 78 → 52 → 71 → 79
