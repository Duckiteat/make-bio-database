# STG-05a — 규칙 장부

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [재건 계획 (rebuilding project) — 글이 아니라 구조가 말하게](../rebuild.md) · [순서](../ORDER.md)

- **계획 · 부**: rebuild 5a · 7. 단계
- **단계**: 규칙 장부
- **무엇**: 판단으로 매긴 원래 규칙 단위마다 RULE 하나(`rebuild/rules/rules.jsonl`), 사본은 copies, 모드는 원래 + 사본의 합
- **끝나는 조건**: 판단 규칙 단위 전부 장부에 · 관리 파일 07
- **상태**: ☑ 완료 2026-10-25

## 결과 (날짜별)

- `2026-10-25` `97ee064`: RULE 314 (기계 182 · 글뿐 120 · 확인 전 12) · 한 규칙이 적힌 곳 최대 9 · 여러 모드에 걸친 규칙 45 · 규칙 여러 개를 한 문장에 묶은 사본 57

## 걸어온 길

- `2026-10-25` `97ee064` 계획에 들어옴 (☑ 완료) — 재건 5a: 규칙 장부 RULE 314 · 결정 ②(수집가 push 는 자기 브랜치 + 문지기)
