# PLAN-045 — 수렴 스윕

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 45 · 6부 — 현실 위의 검증 (관찰 연산자 · 벤치마크 · 축약)
- **작업**: **수렴 스윕** (지금 없음 — 단일 refScenario 뿐): rtol/atol/dt 를 ≥2 단계 반감, 수렴 차수 추정 + 단조 오차
- **자리**: `orchestrator.refScenario` 확장 · `tests/fate_suite.js`
- **끝나는 조건**: 차수 추정 보고 · 비수렴 시 NUMERICAL 등록
- **상태**: ☑ 완료 2026-10-22

## 결과 (날짜별)

- `2026-10-22` `bf433f6`: `convergenceSweep`(조정자)→`convergenceTrend`(사법부, `ensembleLimit→limitTrend` 와 같은 분립): 허용 오차 수열마다 결정론 실행 + 더 조인 기준해 상대 L2, worst<bound 면 수렴·아니면 NUMERICAL. 비선형 다종(mixed-optimal) 스윕이 전 구간 기준해 대비 <1e-6. 매끈한 계는 느슨한 허용 오차에서도 바닥이라 차수 slope 는 보고만(판정은 bound) — 정직한 한계. 합성 입력으로 NUMERICAL 분기도 시험

## 걸어온 길

- `2026-10-22` `77d95bf` 계획에 들어옴 (☐ 대기) — Phase 0 현실 검증 조사 + 플랜 6부(현실 위의 검증, 항목 42–48)
- `2026-10-22` `bf433f6` 상태 ☐ → ☑ 2026-10-22 — 45 수렴 스윕 — convergenceSweep(조정자) → convergenceTrend(사법부)
- `2026-10-22` `bf433f6` 결과 처음 적힘 — 45 수렴 스윕 — convergenceSweep(조정자) → convergenceTrend(사법부)

## 닿는 결정

- [DEC-0010](../decisions/DEC-0010.md) 2026-10-22 북극성을 현실 검증으로 — "시뮬레이션이 현실 위에서 기능한다"
- [DEC-0011](../decisions/DEC-0011.md) 2026-10-22 Phase 0 조사 — 현실 닻이 정성 관찰 5개뿐, 정량 검증 0
