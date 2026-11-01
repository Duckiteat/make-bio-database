# STG-05c — 집행 자리 확인

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [재건 계획 (rebuilding project) — 글이 아니라 구조가 말하게](../rebuild.md) · [순서](../ORDER.md)

- **계획 · 부**: rebuild 5c · 7. 단계
- **단계**: 집행 자리 확인
- **무엇**: machine 규칙마다 거부 시험이 그 규칙을 실제로 집행하는지, unchecked 를 machine·text 로
- **끝나는 조건**: unchecked 0
- **상태**: ☑ 완료 2026-10-25

## 결과 (날짜별)

- `2026-10-25` `0f3f8ae`: unchecked 193 → machine 78 · text 115. machine 253 모두 변이 시험(`rebuild/rules/enforcement.jsonl`, `tests/mutation/run.mjs`): 잡음 191 · 놓침 21 · 설정 8 · 본보기만 7 · 시험만 26. 놓침 21 은 review `enforcement_gap`(시험 추가는 사용자 확인), 관리 파일 10 · 시험 ⑪

## 걸어온 길

- `2026-10-25` `97ee064` 계획에 들어옴 (☐ 대기) — 재건 5a: 규칙 장부 RULE 314 · 결정 ②(수집가 push 는 자기 브랜치 + 문지기)
- `2026-10-25` `0f3f8ae` 상태 ☐ → ☑ 2026-10-25 — 재건 5c (2/2): 집행 변이 시험 결과 — machine 253 중 잡음 191 · 놓침 21
- `2026-10-25` `0f3f8ae` 결과 처음 적힘 — 재건 5c (2/2): 집행 변이 시험 결과 — machine 253 중 잡음 191 · 놓침 21
