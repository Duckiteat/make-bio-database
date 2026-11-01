# PLAN-020 — 카운터 기반 난수

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 20 · 3부 — 판정 강화
- **작업**: **카운터 기반 난수**(JS·Rust, 비트 연속성 1 회 단절) + 공통 난수 짝 판정
- **끝나는 조건**: 네이티브 = WASM 비트 · 짝 판정 검정력 시험
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-10-15` `ca92cdd` 계획에 들어옴 (☐ 대기) — 구현 계획: 검증·저장·적분 엔진 작업 40개 (docs/design/build-plan.md)

## 닿는 결정

- [DEC-0004](../decisions/DEC-0004.md) 2026-10-15 북극성 — 살아 있는 생명체의 기전 연구, 자원 먼저 장 나중
- [DEC-0005](../decisions/DEC-0005.md) 2026-10-16 측정·기록 인프라 점검 + 계측기 시기(TIER A·B·C)
- [DEC-0007](../decisions/DEC-0007.md) 2026-10-16 보존 분류를 기저 데이터로 — 범용 BigInt 고정소수점은 반려
