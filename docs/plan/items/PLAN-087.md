# PLAN-087 — 막 유효 부피를 데이터로 · 사건 기반 경쟁 표시

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 87 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **막 유효 부피를 데이터로 · 사건 기반 경쟁 표시** (분석 R10·R11) — 막 반응 속도가 선택한 부피에 비례, `simulate` 는 경쟁을 선언 순서로 정함 (`docs/reports/2026-10-25-architecture-analysis.md`)
- **자리**: `core.js` · 관문
- **끝나는 조건**: 순서 바꿔 같은 결과 · Concentration_Gap
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-10-25` `3b0503f` 계획에 들어옴 (☐ 대기) — Reports: compute efficiency and architecture analysis; build-plan 80-87

## 닿는 결정

- [DEC-0030](../decisions/DEC-0030.md) 2026-10-25 구조 평가 뒤 순서 — 77 → 78 → 52 → 71 → 79
