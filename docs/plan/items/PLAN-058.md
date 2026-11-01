# PLAN-058 — 전문 수신함 + 인용–전문 자동 대조

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 58 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **전문 수신함 + 인용–전문 자동 대조** — 외주 전문 에이전트의 출력 자리 (`outsourcing-and-mcp.md` §6 ①)
- **자리**: 서기 받기 · `judicial/collection_audit.js` · `verify-collection`
- **끝나는 조건**: 인용이 전문에 없으면 REJECTED · 전문 없으면 REVIEW · 거부 시험
- **상태**: ☑ 완료 2026-10-23

## 결과 (날짜별)

- `2026-10-23` `d220d66`: `judicial/collection_audit.js quoteCheck`(정규화: 태그·엔터티·NFKC·대시·따옴표, 참고문헌 목록 제외) + 읽기 전용 `inbox.js`. 실물: 텔로미어 후보 9/11 초록 일치, Henderson 1996 공개 전문 받아 일치, Allsopp 1992 본문 인용은 사람 확인

## 걸어온 길

- `2026-10-23` `5796eea` 계획에 들어옴 (☐ 대기) — 외주화와 MCP 분리 설계 — 만드는 일은 밖에, 판정·쓰기는 안에
- `2026-10-23` `d220d66` 상태 ☐ → ☑ 2026-10-23 — 인용–원문 자동 대조 (build-plan 58) — 수신함 원문에 인용이 글자 그대로 있는지 기계가 판정
- `2026-10-23` `d220d66` 결과 처음 적힘 — 인용–원문 자동 대조 (build-plan 58) — 수신함 원문에 인용이 글자 그대로 있는지 기계가 판정

## 닿는 결정

- [DEC-0013](../decisions/DEC-0013.md) 2026-10-23 순서 바꿈 ② — 49 뒤에 58–60(전문 받는 쪽)을 먼저
