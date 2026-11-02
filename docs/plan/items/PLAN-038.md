# PLAN-038 — SBML core(반응망) · SED-ML(규약·교란·측정) · OMEX(묶음) 내보내기

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 38 · 5부 — 신뢰 외부화
- **작업**: **SBML core(반응망) · SED-ML(규약·교란·측정) · OMEX(묶음) 내보내기**, 공간 장은 자체 형식 + 문서 (결정 8, 원문 확인 후)
- **끝나는 조건**: 외부 도구 재현 1 건
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-10-15` `ca92cdd` 계획에 들어옴 (☐ 대기) — 구현 계획: 검증·저장·적분 엔진 작업 40개 (docs/design/build-plan.md)
- `2026-10-15` `fc8b5eb` '작업' 칸이 바뀜 — 결정 정리: 설계 문서 앞 절을 확정 결정에 맞춤, 판정 강도 = min(δ 등급, 검증 관찰 등급)

  <details><summary>이전 · 이후</summary>

이전: **SBML core · SED-ML · OMEX 내보내기**(원문 확인 후)

이후: **SBML core(반응망) · SED-ML(규약·교란·측정) · OMEX(묶음) 내보내기**, 공간 장은 자체 형식 + 문서 (결정 8, 원문 확인 후)

</details>

## 닿는 결정

- [DEC-0004](../decisions/DEC-0004.md) 2026-10-15 북극성 — 살아 있는 생명체의 기전 연구, 자원 먼저 장 나중
- [DEC-0050](../decisions/DEC-0050.md) 2026-11-02 시스템의 틀 — 결정론장을 현실에 닿는 바닥(Ground Truth)으로, 확률장을 거기에 붙잡아, 인공간뇌의 기초 데이터를 쌓는 통합 시스템
