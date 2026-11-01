# PLAN-063 — 수집 후보에 종 필수

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 63 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **수집 후보에 종 필수** — 값 후보(read_value·ambiguous)에 species 없으면 INCOMPLETE
- **자리**: `judicial/collection_audit.js`
- **끝나는 조건**: 거부 시험
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-10-23` `aae6dec` 계획에 들어옴 (☐ 대기) — build-plan 62–65 — 종 처리 결정(빈 종 구멍·후보 종 필수·다른 종 판정 상한, 종 계보 보류) + 보고서 계획서·가설·결과
