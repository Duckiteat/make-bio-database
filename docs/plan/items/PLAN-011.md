# PLAN-011 — 엔진 단계 0 상수 접기

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 11 · 2부 — 보고서 · 저장 확장
- **작업**: **엔진 단계 0 상수 접기** `1/(N_A·V)`
- **자리**: `compiler` · `tape.rs` · `fate_engine.js` · `derivative.js`
- **끝나는 조건**: JS = Rust · 도함수 ≤1e-14 · bench 전후
- **상태**: ☑ 완료 2026-10-15

## 결과 (날짜별)

- `2026-10-15` `211bf81`: IR 4 `species[i].cinv`, 덩어리 판 5(아보가드로 칸 삭제·부피 자리에 cinv), 테이프 CONC = max(0,N)·cinv · DCONC = cinv, 사법부가 cinv 를 부피에서 따로 계산해 비트 대조(한 ulp 꾸밈 거부). 결정론 기록 궤적은 MHC 성숙·혼합 최적 모두 비트 같음(도달 시각 마지막 자리만 ~1e-15), JS = Rust. 속도 이득은 bench 측정 잡음(±30 %) 안 — 보이지 않음. 확률 궤적은 반올림 위치가 바뀌어 달라짐(비트 연속성 단절 — 시험 통과)

## 걸어온 길

- `2026-10-15` `ca92cdd` 계획에 들어옴 (☐ 대기) — 구현 계획: 검증·저장·적분 엔진 작업 40개 (docs/design/build-plan.md)
- `2026-10-15` `211bf81` 상태 ☐ → ☑ 2026-10-15 — 엔진 단계 0 상수 접기 (build-plan 11): 농도 = N·cinv, cinv = 1/(N_A·V) 를 컴파일러가 접음
- `2026-10-15` `211bf81` 결과 처음 적힘 — 엔진 단계 0 상수 접기 (build-plan 11): 농도 = N·cinv, cinv = 1/(N_A·V) 를 컴파일러가 접음

## 닿는 결정

- [DEC-0005](../decisions/DEC-0005.md) 2026-10-16 측정·기록 인프라 점검 + 계측기 시기(TIER A·B·C)
