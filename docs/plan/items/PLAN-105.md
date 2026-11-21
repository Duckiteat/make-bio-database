# PLAN-105 — MCP 연결

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 105 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **MCP 연결** — 저장소 MCP 서버 넷(query · run · clerk · fetch, 도구 32)이 세션에서 닿지 않는다(세션에 꽂는 설정 없음 — 데드존 DZ1). 서버를 등록하는 설정을 만들고, MCP 역할은 켜는 쪽의 이름표가 아니라 **지금 열린 모드에서 계산**(이름표는 더 좁히는 쪽으로만). 조율 도구(query.orch_status · clerk.orch_event)는 PLAN-100 의 같은 함수를 부름. 사람 역할은 이름표로 주지 않음(RP1)
- **자리**: `mcp/protocol.mjs` · `mcp/clerk.mjs` · `mcp/query.mjs` · `rebuild/rules/commands.jsonl` · 세션 MCP 설정(새)
- **끝나는 조건**: 작업 세션에서 MCP 도구가 보이고 문지기 · 영수증을 지남 · 모드와 다른 역할로 켜면 거부 시험 · 권한 장부 대조(RULE-0521) · 설정이 권한을 넓히면 승인 묶음(사용자 커밋)
- **상태**: ◐ 진행 2026-11-21

## 결과 (날짜별)

- `2026-11-21` 커밋 전 기록: 2026-11-21 1 단계: `.mcp.json` 에 읽기 서버 둘(biodb-query · biodb-run, 역할 collector) · `mcp/protocol.mjs` 이름표 역할은 collector · integrator 만, human 은 서버가 뜨지 않음 · 시험 mcp_config 2 + mcp ③ · mcp_run ① 고침. 확인: 이 세션이 작업 프로세스 재시작 뒤 .mcp.json 을 읽어 두 서버를 꽂음(설정 커밋 없이) · mcp__biodb-query__summary 가 답하고 영수증에 남음(문지기 훅이 MCP 호출도 잡음). 찾은 것 ① 쓰기 서버(clerk · fetch)는 저장소당 작성자 하나 잠금을 세션 내내 잡아(clerk 는 켜질 때, fetch 는 첫 받기부터) CLI 쓰기(dbtool transition · merge …)를 막는다(mcp.test ④) → 꽂지 않음, 잠금 방식 결정 필요(열린 질문) ② 역할을 열린 모드에서 계산하는 일은 MCP 서버가 문지기 상태(rebuild/ 안)를 읽어야 해서 구조 시험(rebuild/ 밖 코드는 rebuild/ 를 읽지 않는다)과 부딪힌다 — 그런데 쓰는 MCP 도구는 이미 문지기가 명령 장부의 모드로 막으므로(commandBlock · RULE-0515) 서버 쪽 모드 계산은 필요 없다고 본다 ③ 감독 도구를 MCP 로 감싸는 일도 같은 경계(mcp/ → rebuild/)에 걸림 — 지금은 CLI(node rebuild/supervise.mjs)로. 남은 것: 쓰기 서버 연결(잠금 결정 뒤) · 다음 세션에서 서버가 꽂히는지 확인.

## 걸어온 길

- `2026-11-21` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0066 · DEC-0067 — 자기 개선 루프 최소판 채택 · 권장 결정 전부 · 개발 순서는 조율(오케스트레이터)부터
- `2026-11-21` 커밋 전 기록 상태 ☐ → ◐ 2026-11-21 — PLAN-105 MCP 연결 1 단계 — 읽기 서버만 · 사람 역할 이름표 금지
- `2026-11-21` 커밋 전 기록 결과 처음 적힘 — PLAN-105 MCP 연결 1 단계 — 읽기 서버만 · 사람 역할 이름표 금지

## 닿는 결정

- [DEC-0066](../decisions/DEC-0066.md) 2026-11-21 자기 개선 루프 — 최소판(관측 묶음 · 제안 연결 · 사람 승인 · 증거 완료) · RP1 · RP2 첫 사이클 · 탐지기 보호 · 과학 진척 지표 분리 · 권장 결정 전부
- [DEC-0068](../decisions/DEC-0068.md) 2026-11-21 작업 조율의 정체 — Supervisor(감독)이다, Claude 내장 조율(하위 에이전트 · fork · 작업 목록)과 다르다
