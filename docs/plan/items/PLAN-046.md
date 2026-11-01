# PLAN-046 — 강성 프로파일 진단

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 46 · 6부 — 현실 위의 검증 (관찰 연산자 · 벤치마크 · 축약)
- **작업**: **강성 프로파일 진단**: 이미 emit 하는 integrator/stats(steps·rejected·hMinHits·단계당 벽시간·LU)로 "왜 느린가" 분류(시간척도 분리 / 거부 폭주 / 대형 LU) → 축약 적용 여부 판정
- **자리**: `judicial/` 감사
- **끝나는 조건**: L000113 재현에 프로파일 분류가 붙음
- **상태**: ☑ 완료 2026-10-22

## 결과 (날짜별)

- `2026-10-22` `1e02753`: `judicial/stiffness.js`: integrator 진단(steps·rejected·hMinHits·h.min/max)+활성 규칙 수로 분류(`h_min_floor`=NUMERICAL·`rejection_storm`·`timescale_separation`·`lu_cost`·`well_conditioned`). 느림은 결과지 결함 아님 — hMinHits>0(정확도 타협)만 NUMERICAL. 정상 시나리오=well_conditioned·합성 h_min_floor=NUMERICAL 시험. **정직한 한계: L000113(42종 LPS)은 등록된 한계라 실행 가능한 아티팩트가 아니고(코퍼스 최대 nAct 13<40), lu_cost·h_min_floor 분기는 합성으로만 검증** — 적분장(27–37)이 LPS 를 돌리면 자동 부착

## 걸어온 길

- `2026-10-22` `77d95bf` 계획에 들어옴 (☐ 대기) — Phase 0 현실 검증 조사 + 플랜 6부(현실 위의 검증, 항목 42–48)
- `2026-10-22` `1e02753` 상태 ☐ → ☑ 2026-10-22 — 46 강성 프로파일 진단 — judicial/stiffness.js
- `2026-10-22` `1e02753` 결과 처음 적힘 — 46 강성 프로파일 진단 — judicial/stiffness.js

## 닿는 결정

- [DEC-0010](../decisions/DEC-0010.md) 2026-10-22 북극성을 현실 검증으로 — "시뮬레이션이 현실 위에서 기능한다"
- [DEC-0011](../decisions/DEC-0011.md) 2026-10-22 Phase 0 조사 — 현실 닻이 정성 관찰 5개뿐, 정량 검증 0
