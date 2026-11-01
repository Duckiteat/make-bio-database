# PLAN-074 — 관문 = 인정 '추정' (체계 하나)

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 74 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **관문 = 인정 '추정' (체계 하나)** (2026-10-25 평가 §5) — 시뮬레이션 관문 `constantVerdict`·`judicial.js` 상수 등급이 등급 문턱만 보고 인정의 '추정' 조건(기준 종)을 보지 않는다. 관문이 `acceptance.accept(row, 'estimate')` 를 부르게 해 두 판정을 하나로
- **자리**: `judicial/reliability.js` · `judicial/judicial.js` · `judicial/acceptance.js`
- **끝나는 조건**: 다른 종 상수 → 관문 거부 시험 · 지금 판정 불변
- **상태**: ☑ 완료 2026-10-25

## 결과 (날짜별)

- `2026-10-25` `473b841`: `reliability.USES·accept·gateMessage` 하나로, 관문 두 곳(`constantVerdict`·`judicial.js`)이 '추정' accepted 를 요구. 지금 데이터 상수 4 판정 불변

## 걸어온 길

- `2026-10-25` `d0f6b92` 계획에 들어옴 (☐ 대기) — Handoff for other sessions: direction priorities, build-plan rows 74-79, NEXT note
- `2026-10-25` `473b841` 상태 ☐ → ☑ 2026-10-25 — One judgment: gate uses acceptance estimate, observe/fate follow acceptance, approval history kept (build-plan 74-76)
- `2026-10-25` `473b841` 결과 처음 적힘 — One judgment: gate uses acceptance estimate, observe/fate follow acceptance, approval history kept (build-plan 74-76)

## 닿는 결정

- [DEC-0030](../decisions/DEC-0030.md) 2026-10-25 구조 평가 뒤 순서 — 77 → 78 → 52 → 71 → 79
