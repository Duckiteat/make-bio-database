# PLAN-010 — 관문 A′

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 10 · 1부 — 검증 기반과 저장의 출발점
- **작업**: **관문 A′**: MHC I 적재 차단을 원 논문 정성 관찰 1 건(DOI·원문 구절, 수신함 경유)으로 0 층 + 모의 판정 → 보고서
- **자리**: 데이터 패치 · 보고서
- **끝나는 조건**: 판정 수준이 붙은 보고서 1 건. 원문을 받지 못하면 `RETRIEVAL_TASKS.md` 로 사용자에게
- **상태**: ☑ 완료 2026-10-15

## 결과 (날짜별)

- `2026-10-15` `cc58ad7`: O000019(de la Salle 1994, 초록 Europe PMC 수신함 경유) · 0 층 구조 지지 · 모의 맞음(차이 −22,880 분자) · **판정 수준 탐색**: 초록에 측정 세포가 없어 규약을 세우지 못함 → 한계 L000107, 보고서 `docs/reports/2026-10-15-gate-a-prime-tap-mhc1.md`

## 걸어온 길

- `2026-10-15` `ca92cdd` 계획에 들어옴 (☐ 대기) — 구현 계획: 검증·저장·적분 엔진 작업 40개 (docs/design/build-plan.md)
- `2026-10-15` `cc58ad7` 상태 ☐ → ☑ 2026-10-15 — 관문 A′ (build-plan 10): TAP 결손 정성 관찰로 0 층 + 모의 판정 — 판정 수준 탐색
- `2026-10-15` `cc58ad7` 결과 처음 적힘 — 관문 A′ (build-plan 10): TAP 결손 정성 관찰로 0 층 + 모의 판정 — 판정 수준 탐색
