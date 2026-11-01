# PLAN-009 — null 시나리오 전환

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 9 · 1부 — 검증 기반과 저장의 출발점
- **작업**: **null 시나리오 전환**: `mhc-*-null` 4 건을 기준 + 교란 한 줄로, 복사본 삭제
- **자리**: `examples/scenarios/` · `tests/mhc.test.mjs`
- **끝나는 조건**: 전환 전후 궤적 해시 같음(합성 규칙 없는 경우) 또는 차이를 설명
- **상태**: ☑ 완료 2026-10-15

## 결과 (날짜별)

- `2026-10-15` `52f3da9`: 4 건 모두 궤적 해시 같음. cathepsin·HLA-DM·TAP 는 풀린 시나리오가 예전 파일과 칸 하나까지 같고, β2m 은 k = 0 대신 규칙 제외(block)라 형태만 다름. MHC II 두 건의 숨은 기준(성숙 신호·항원이 처음부터)을 대조군 `mhc-dc-mature-antigen-hypothetical.json` 으로 꺼냄 — 예전 시험의 '같은 신호에서' 는 사실 성숙 시나리오와 신호가 달랐다

## 걸어온 길

- `2026-10-15` `ca92cdd` 계획에 들어옴 (☐ 대기) — 구현 계획: 검증·저장·적분 엔진 작업 40개 (docs/design/build-plan.md)
- `2026-10-15` `52f3da9` 상태 ☐ → ☑ 2026-10-15 — null 시나리오 전환 (build-plan 9): 교란 실험은 기준 + 교란 한 줄
- `2026-10-15` `52f3da9` 결과 처음 적힘 — null 시나리오 전환 (build-plan 9): 교란 실험은 기준 + 교란 한 줄
