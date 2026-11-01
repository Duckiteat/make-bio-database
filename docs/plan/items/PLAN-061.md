# PLAN-061 — MCP 서버

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 61 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **MCP 서버** — query·fetch + 입출력기 clerk (`outsourcing-and-mcp.md` §4.3, lab 은 56 뒤)
- **자리**: `mcp/` · 서기(`handoff` 구역·`writerLock`·XML 받기)
- **끝나는 조건**: 프로토콜·역할 거부·단일 작성자·쓰기 없음 시험
- **상태**: ☑ 완료 2026-10-23

## 결과 (날짜별)

- `2026-10-23` `2ba97c7`: 외부 패키지 없음, 시험 `tests/mcp.test.mjs`(8). 첫 실사용: O'Dea 2007(PMID 17486138) 공개 전문 받음, Allsopp 1995 유료 거부

## 걸어온 길

- `2026-10-23` `2ba97c7` 계획에 들어옴 (☑ 완료) — MCP 서버 — query·fetch + 입출력기 clerk (외부 패키지 없음), 받기 기록 사슬
