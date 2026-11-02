# STG-11a — 규칙 한 번에

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [재건 계획 (rebuilding project) — 글이 아니라 구조가 말하게](../rebuild.md) · [순서](../ORDER.md)

- **계획 · 부**: rebuild 11a · 7. 단계
- **단계**: 규칙 한 번에
- **무엇**: node rebuild/rules.mjs rule <명세.json> — 규칙·연결·집행 줄 추가 → 변이 실행 → 결과(red) 기록 → 생성 문서 재생성. 먼저 변이 자리(find)가 코드에 정확히 한 번 있는지, 판정 코드에 'RULE-…' 가 글자 그대로 있는지 확인. 규칙당 명령 약 6 회 → 2 회 (docs/reports/2026-11-01-work-automation.md §3) · 변이 자리가 코드와 어긋나면 후보만 제안 — 같은 검사라는 확인 뒤 적용하고 변이를 다시 돌려 caught 일 때만 기록(자동으로 다시 가리키면 지워진 검사가 계속 통과하는 거짓 안심 — RULE-0461, docs/reports/2026-11-01-work-automation.md §8)
- **끝나는 조건**: 같은 명세를 옛 방식과 새 방식으로 넣어 장부 바이트 동일 · 어긋난 find 거부 · 장부 사건(봉인·이유)은 지금과 같음
- **상태**: ☑ 완료 2026-11-01

## 결과 (날짜별)

- `2026-11-01` 커밋 전 기록: 2026-11-01 node rebuild/rules.mjs rule <명세> [--dry] — 먼저 확인(find 한 곳 · 'RULE-…' 글자 그대로 · code: 연결 · from_code) → 변이(임시 명세는 서기 writeDraftText 로 저장소 밖) → caught 일 때만 규칙·연결·집행(+red) 한 묶음 → status --write. 끝까지 시험: 이미 있는 RULE-0526 은 변이 caught 뒤 쓰기에서 거부, 어긋난 find 는 변이 전에 거부 (docs/reports/2026-11-01-work-automation.md §11)

## 걸어온 길

- `2026-11-01` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 반복 기록 일 자동화와 파일 탐침을 계획에 — 영수증으로 잰 효율 차이와 순서 (사용자 요청 2026-11-01, docs/reports/2026-11-01-work-automation.md)
- `2026-11-01` 커밋 전 기록 '무엇' 칸이 바뀜 — 바뀐 자리 따라 고치기를 세 등급으로 — 탐침(11d)과 규칙 한 번에(11a)를 넓힘 (사용자 요청 2026-11-01)

  <details><summary>이전 · 이후</summary>

이전: node rebuild/rules.mjs rule <명세.json> — 규칙·연결·집행 줄 추가 → 변이 실행 → 결과(red) 기록 → 생성 문서 재생성. 먼저 변이 자리(find)가 코드에 정확히 한 번 있는지, 판정 코드에 'RULE-…' 가 글자 그대로 있는지 확인. 규칙당 명령 약 6 회 → 2 회 (docs/reports/2026-11-01-work-automation.md §3)

이후: node rebuild/rules.mjs rule <명세.json> — 규칙·연결·집행 줄 추가 → 변이 실행 → 결과(red) 기록 → 생성 문서 재생성. 먼저 변이 자리(find)가 코드에 정확히 한 번 있는지, 판정 코드에 'RULE-…' 가 글자 그대로 있는지 확인. 규칙당 명령 약 6 회 → 2 회 (docs/reports/2026-11-01-work-automation.md §3) · 변이 자리가 코드와 어긋나면 후보만 제안 — 같은 검사라는 확인 뒤 적용하고 변이를 다시 돌려 caught 일 때만 기록(자동으로 다시 가리키면 지워진 검사가 계속 통과하는 거짓 안심 — RULE-0461, docs/reports/2026-11-01-work-automation.md §8)

</details>
- `2026-11-01` 커밋 전 기록 상태 ☐ → ☑ 2026-11-01 — 작업 도구 넷을 만듦 — 사전 검사 · 재생성 · 규칙 한 번에 · 파일 탐침 (사용자 요청 2026-11-01 '파일 도구들 만들어내고 끝내자')
- `2026-11-01` 커밋 전 기록 결과 처음 적힘 — 작업 도구 넷을 만듦 — 사전 검사 · 재생성 · 규칙 한 번에 · 파일 탐침 (사용자 요청 2026-11-01 '파일 도구들 만들어내고 끝내자')

## 닿는 결정

- [DEC-0047](../decisions/DEC-0047.md) 2026-11-01 반복 기록 일의 자동화와 파일 탐침 — 기록 규약은 그대로, 손일과 다시 돌리기만 줄인다
