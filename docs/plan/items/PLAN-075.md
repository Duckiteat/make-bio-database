# PLAN-075 — observe·fate 판정에 인정

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 75 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **observe·fate 판정에 인정** (평가 §5) — '결론은 가장 약한 근거' 가 증거 보고서에만 있다. `observe`·`fate --report` 의 판정 수준도 인정 표를 받아 `acceptance_review` 로 내려가게
- **자리**: 조정자 · `dbtool.mjs` · `judicial/process_report.js`
- **끝나는 조건**: 같은 검증이 명령마다 같은 판정 수준 시험
- **상태**: ☑ 완료 2026-10-25

## 결과 (날짜별)

- `2026-10-25` `473b841`: `obs_compare` 동등성·`qual_compare` 결론이 인정을 받으면 따름, `dbtool observe` 가 인정을 넘김, `fate --report` 증명서 줄. O000021 실제 observe 결론 유지 확인

## 걸어온 길

- `2026-10-25` `d0f6b92` 계획에 들어옴 (☐ 대기) — Handoff for other sessions: direction priorities, build-plan rows 74-79, NEXT note
- `2026-10-25` `473b841` 상태 ☐ → ☑ 2026-10-25 — One judgment: gate uses acceptance estimate, observe/fate follow acceptance, approval history kept (build-plan 74-76)
- `2026-10-25` `473b841` 결과 처음 적힘 — One judgment: gate uses acceptance estimate, observe/fate follow acceptance, approval history kept (build-plan 74-76)

## 닿는 결정

- [DEC-0030](../decisions/DEC-0030.md) 2026-10-25 구조 평가 뒤 순서 — 77 → 78 → 52 → 71 → 79
