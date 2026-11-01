# STG-10c — 장부 고치기 도구

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [재건 계획 (rebuilding project) — 글이 아니라 구조가 말하게](../rebuild.md) · [순서](../ORDER.md)

- **계획 · 부**: rebuild 10c · 7. 단계
- **단계**: 장부 고치기 도구
- **무엇**: rebuild/rules/*.jsonl(규칙 · 검토 · 수식 · 집행)을 고치는 명령 하나 — plan.mjs apply 와 같은 방식(변경 묶음 · 고칠 때마다 왜 · 검사 통과 뒤 서기만 씀) · 줄 모양 하나로 고정
- **끝나는 조건**: 장부를 도구 밖에서 고치면 시험이 거부 · 모양이 다르면 거부
- **상태**: ☑ 완료 2026-10-30

## 결과 (날짜별)

- `2026-10-30` 커밋 전 기록: 2026-10-30: node rebuild/rules.mjs apply <ops.json> (add · set · remove · seal) · check — rebuild/rules/ 의 .jsonl 여섯(규칙 · 검토 · 수식 · 집행 · 맥락 · 명령). 검사: 줄 모양 하나(구분자 ', ' · ': ', 숫자 JSON 표기) · 장부마다 필수·허용 칸 · 열쇠 겹침 · 없는 규칙 참조. 통과하면 서기 writeLedger(새 구역 ledger)가 쓰고 사건 기록 rebuild/rules/changes.jsonl(덧붙이기만)에 왜 · 앞뒤 줄 · 바꾼 뒤 sha256. 장부가 마지막 봉인과 다르면 거부 — 새 기계 규칙 RULE-0519, 시험 rebuild ㉓, 변이 시험 caught(커밋 전 작업 파일로 — 10b). 첫 봉인에서 formulas 두 줄의 숫자 표기만 바뀜(값 그대로). modes.json 은 JSON 하나라 도구 밖(계획의 대상 '.jsonl'). 함께 고친 것: rebuild ㉒ 가 변이 사본(분리된 HEAD)에서 늘 빨갰음 — 모든 변이를 잘못 '잡음' 으로 만들던 구멍 · 중심 문서의 끝내기 전 문장(10d 의 --full 을 반영)

## 걸어온 길

- `2026-10-29` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 재건 10 단계 계획 — 6b 세션의 사용 평가에서 나온 비용·구멍을 작업으로 (DEC-0037)
- `2026-10-30` 커밋 전 기록 상태 ☐ → ☑ 2026-10-30 — 재건 10c 장부 고치기 도구 — 규칙 장부를 변경 묶음 · 왜 · 봉인으로만 (사용자 'ㄱㄱㄱ')
- `2026-10-30` 커밋 전 기록 결과 처음 적힘 — 재건 10c 장부 고치기 도구 — 규칙 장부를 변경 묶음 · 왜 · 봉인으로만 (사용자 'ㄱㄱㄱ')

## 닿는 결정

- [DEC-0037](../decisions/DEC-0037.md) 2026-10-29 10 단계 — 작업 비용 줄이기: 목적 · 합치기 전 범위 · 커밋 검사
