# PLAN-081 — 쓰기의 비교 후 교체

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 81 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **쓰기의 비교 후 교체** (분석 R3) — 봉인이 '병합이 읽은 db = 디스크 db' 를 확인하지 않고, 잠금은 MCP clerk 만·비원자적 → 잃어버린 갱신 가능. 봉인에 `base_sha256`, `commitMerge` 대조, 원자적 잠금, CLI 도 잠금 (`docs/reports/2026-10-25-architecture-analysis.md`)
- **자리**: `legislative/clerk.mjs` · `judicial/attestation.js` · `dbtool.mjs`
- **끝나는 조건**: 동시 병합 거부 시험
- **상태**: ☑ 완료 2026-11-21

## 결과 (날짜별)

- `2026-11-21` 커밋 전 기록: 2026-11-21 구현: 서기 commitMerge 가 봉인의 base_sha256(병합이 읽은 디스크 db)을 요구하고, 잠금을 잡은 뒤 지금 디스크 db 와 대조 — 다르면 거부(RULE-0015). dbtool merge · augment apply 가 처음 읽은 db 의 sha256 을 봉인에 넣음(digest 에 묶여 바꾸면 변조). 잠금의 원자성과 CLI 잠금은 재건 7 단계에서 이미 됨. 끝나는 조건 시험: governance ⑯ 같은 db 를 읽은 두 병합 — 앞만 쓰고 뒤는 거부 · base 없는 봉인 거부 · 다시 읽으면 통과. 남김: commitMigration · sealGenesis 는 대조 안 함.

## 걸어온 길

- `2026-10-25` `3b0503f` 계획에 들어옴 (☐ 대기) — Reports: compute efficiency and architecture analysis; build-plan 80-87
- `2026-11-21` 커밋 전 기록 결과 처음 적힘 — PLAN-081 구현 — 사용자 '다음거부터 하자' (SUP-0001 author 실행은 원천 허용과 함께 뒤로)
- `2026-11-21` 커밋 전 기록 상태 ☐ → ☑ 2026-11-21 — PLAN-081 구현 — 사용자 '다음거부터 하자' (SUP-0001 author 실행은 원천 허용과 함께 뒤로)

## 닿는 결정

- [DEC-0030](../decisions/DEC-0030.md) 2026-10-25 구조 평가 뒤 순서 — 77 → 78 → 52 → 71 → 79
- [DEC-0066](../decisions/DEC-0066.md) 2026-11-21 자기 개선 루프 — 최소판(관측 묶음 · 제안 연결 · 사람 승인 · 증거 완료) · RP1 · RP2 첫 사이클 · 탐지기 보호 · 과학 진척 지표 분리 · 권장 결정 전부
