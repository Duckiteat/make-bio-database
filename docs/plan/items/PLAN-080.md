# PLAN-080 — 속도 엔진 하나로

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 80 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **속도 엔진 하나로** (분석 R2) — `simulateRate` 는 명시 오일러 + 가용량 자르기 + 단계 순차 갱신 + '즉시' 단계라 Δt·순서에 따라 결과가 바뀐다(LPS 끝 값 상대 6.5e-5). 같은 규칙을 운명 엔진(Rodas3)과 다르게 풀어 서로 기준 금지(L000081). 같은 IR·Rodas3 앞단으로 바꾸거나 동시 갱신 + 오차 제어 + 시간 척도를 선언한 빠른 극한 (`docs/reports/2026-10-25-architecture-analysis.md`)
- **자리**: `core.js` · `compiler/rate_ir.js` · 엔진
- **끝나는 조건**: 두 경로 궤적 대조 · Δt 무관성 · L000081 닫기
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-10-25` `3b0503f` 계획에 들어옴 (☐ 대기) — Reports: compute efficiency and architecture analysis; build-plan 80-87

## 닿는 결정

- [DEC-0030](../decisions/DEC-0030.md) 2026-10-25 구조 평가 뒤 순서 — 77 → 78 → 52 → 71 → 79
- [DEC-0049](../decisions/DEC-0049.md) 2026-11-02 엔진 먼저 — 시계 안전망 시험 → 시계 정리(관찰 격자 한정) 순서로
- [DEC-0050](../decisions/DEC-0050.md) 2026-11-02 시스템의 틀 — 결정론장을 현실에 닿는 바닥(Ground Truth)으로, 확률장을 거기에 붙잡아, 인공간뇌의 기초 데이터를 쌓는 통합 시스템
