# PLAN-076 — 승인 이력 + validate 가 승인 도장 검사

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 76 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **승인 이력 + validate 가 승인 도장 검사** (평가 §5) — 같은 주체의 새 승인 도장이 옛 것을 덮어써 승인→철회 경과가 git 에만 남는다. 승인은 추가 전용(가장 최근이 유효)으로, `validate` 도 승인 도장을 검사
- **자리**: `legislative/clerk.mjs` · `judicial/attestation.js` · `dbtool.mjs`
- **끝나는 조건**: 철회 이력 보존 · 변조 승인 도장 → validate 실패
- **상태**: ☑ 완료 2026-10-25

## 결과 (날짜별)

- `2026-10-25` `473b841`: 서기가 승인 도장을 추가만(같은 도장 거부), 표는 마지막 도장, `validate` 가 승인 도장 검사

## 걸어온 길

- `2026-10-25` `d0f6b92` 계획에 들어옴 (☐ 대기) — Handoff for other sessions: direction priorities, build-plan rows 74-79, NEXT note
- `2026-10-25` `473b841` 상태 ☐ → ☑ 2026-10-25 — One judgment: gate uses acceptance estimate, observe/fate follow acceptance, approval history kept (build-plan 74-76)
- `2026-10-25` `473b841` 결과 처음 적힘 — One judgment: gate uses acceptance estimate, observe/fate follow acceptance, approval history kept (build-plan 74-76)

## 닿는 결정

- [DEC-0030](../decisions/DEC-0030.md) 2026-10-25 구조 평가 뒤 순서 — 77 → 78 → 52 → 71 → 79
