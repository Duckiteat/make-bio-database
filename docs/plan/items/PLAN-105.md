# PLAN-105 — MCP 연결

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 105 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **MCP 연결** — 저장소 MCP 서버 넷(query · run · clerk · fetch, 도구 32)이 세션에서 닿지 않는다(세션에 꽂는 설정 없음 — 데드존 DZ1). 서버를 등록하는 설정을 만들고, MCP 역할은 켜는 쪽의 이름표가 아니라 **지금 열린 모드에서 계산**(이름표는 더 좁히는 쪽으로만). 조율 도구(query.orch_status · clerk.orch_event)는 PLAN-100 의 같은 함수를 부름. 사람 역할은 이름표로 주지 않음(RP1)
- **자리**: `mcp/protocol.mjs` · `mcp/clerk.mjs` · `mcp/query.mjs` · `rebuild/rules/commands.jsonl` · 세션 MCP 설정(새)
- **끝나는 조건**: 작업 세션에서 MCP 도구가 보이고 문지기 · 영수증을 지남 · 모드와 다른 역할로 켜면 거부 시험 · 권한 장부 대조(RULE-0521) · 설정이 권한을 넓히면 승인 묶음(사용자 커밋)
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-21` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0066 · DEC-0067 — 자기 개선 루프 최소판 채택 · 권장 결정 전부 · 개발 순서는 조율(오케스트레이터)부터

## 닿는 결정

- [DEC-0066](../decisions/DEC-0066.md) 2026-11-21 자기 개선 루프 — 최소판(관측 묶음 · 제안 연결 · 사람 승인 · 증거 완료) · RP1 · RP2 첫 사이클 · 탐지기 보호 · 과학 진척 지표 분리 · 권장 결정 전부
- [DEC-0068](../decisions/DEC-0068.md) 2026-11-21 작업 조율의 정체 — Supervisor(감독)이다, Claude 내장 조율(하위 에이전트 · fork · 작업 목록)과 다르다
