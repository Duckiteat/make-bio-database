# PLAN-004 — 교란 연산자

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 4 · 1부 — 검증 기반과 저장의 출발점
- **작업**: **교란 연산자**: knockout(시작량 0 + 생성 규칙 제거) · block · inhibit · clamp · dose_series. 교란 IR 해시 = f(기준, 교란)
- **자리**: `compiler/perturb.js`(새)
- **끝나는 조건**: 각 교란의 IR 변환 시험 · 엔진 코드 변경 없음
- **상태**: ☑ 완료 2026-10-15

## 결과 (날짜별)

- `2026-10-15` `a342856`: 시나리오 exclude_rules·rule_scale, 사법부 재구성 포함

## 걸어온 길

- `2026-10-15` `ca92cdd` 계획에 들어옴 (☐ 대기) — 구현 계획: 검증·저장·적분 엔진 작업 40개 (docs/design/build-plan.md)
- `2026-10-15` `a342856` 상태 ☐ → ☑ 2026-10-15 — 검증 4: 교란 연산자 — knockout·block·inhibit·clamp·dose_series 를 시나리오 선언 필드로
- `2026-10-15` `a342856` 결과 처음 적힘 — 검증 4: 교란 연산자 — knockout·block·inhibit·clamp·dose_series 를 시나리오 선언 필드로
