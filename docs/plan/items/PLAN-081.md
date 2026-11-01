# PLAN-081 — 쓰기의 비교 후 교체

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 81 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **쓰기의 비교 후 교체** (분석 R3) — 봉인이 '병합이 읽은 db = 디스크 db' 를 확인하지 않고, 잠금은 MCP clerk 만·비원자적 → 잃어버린 갱신 가능. 봉인에 `base_sha256`, `commitMerge` 대조, 원자적 잠금, CLI 도 잠금 (`docs/reports/2026-10-25-architecture-analysis.md`)
- **자리**: `legislative/clerk.mjs` · `judicial/attestation.js` · `dbtool.mjs`
- **끝나는 조건**: 동시 병합 거부 시험
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-10-25` `3b0503f` 계획에 들어옴 (☐ 대기) — Reports: compute efficiency and architecture analysis; build-plan 80-87

## 닿는 결정

- [DEC-0030](../decisions/DEC-0030.md) 2026-10-25 구조 평가 뒤 순서 — 77 → 78 → 52 → 71 → 79
