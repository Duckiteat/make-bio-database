# STG-06c — 전환 기록 · 명령 장부 · 상태 기록

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [재건 계획 (rebuilding project) — 글이 아니라 구조가 말하게](../rebuild.md) · [순서](../ORDER.md)

- **계획 · 부**: rebuild 6c · 7. 단계
- **단계**: 전환 기록 · 명령 장부 · 상태 기록
- **무엇**: 기록 형식 + 시험
- **끝나는 조건**: 형식 시험
- **상태**: ☑ 완료 2026-10-29

## 결과 (날짜별)

- `2026-10-29` `e4423d8`: 전환 기록: `workspace/transitions.jsonl`(서기 `appendTransition` ← 사법부 `judicial/transition_audit.js`, RULE-0513, 모드는 `vocab.sessionModes`) · `dbtool transition` · 첫 기록 #1(약점 9 → 정보 작성). 명령 장부: `rebuild/rules/commands.jsonl`(CLI 35 · MCP 27, 시험 ⑭) → 모드 문서의 '쓸 명령'. 상태 기록: `rebuild/state/build-plan.jsonl`(작업 한 줄 = 기록 하나, 번호 PLAN-…, 이름공간 `plan_item`) ← `rebuild/state.mjs` parse, 글 `rebuild/draft/build-plan.md` 은 render — 지금 문서와 바이트까지 같음(시험 ⑯), 문서가 바뀌면 `status --write` 가 서기 `writeState` 로 다시 들임

  <details><summary>고쳐 쓰기 전 글</summary>

전환 기록: `workspace/transitions.jsonl`(서기 `appendTransition` ← 사법부 `judicial/transition_audit.js`, RULE-0513, 모드는 `vocab.sessionModes`) · `dbtool transition` · 첫 기록 #1(약점 9 → 정보 작성). 명령 장부: `rebuild/rules/commands.jsonl`(CLI 35 · MCP 27, 시험 ⑭) → 모드 문서의 '쓸 명령'. 상태 기록(build-plan 을 기록으로)은 남음

</details>
- `2026-10-29` 커밋 전 기록: · 2026-10-29 ②: 계획 문서 둘(docs/design/build-plan.md · rebuild/PLAN.md)을 생성물로(DEC-0027) — 원본 rebuild/state/plans.jsonl(결정 30 · 작업·단계 115 · 종합 10 · 방향 7 · 열린 질문 3) · plan-log.jsonl(손으로 쓰던 102 판의 git 역사에서 사건 261 + 그 뒤 apply). 검사(rebuild/state.mjs check)가 참조 · 지금 = 사건을 접은 것 · 근거 있는 종합·방향 · 인용이 원문에 그대로를 보고, 옛 문서의 깨진 곳 둘(build 14 행의 '||' · 재건 §5′ 표에 붙어 §7 에 없던 5b′ · 5b″ · 5b‴)을 고쳐 읽음. 고치기 rebuild/plan.mjs apply · 읽기 모드 PLAN · STG · DEC · DIR · 시험 ⑯–⑲

## 걸어온 길

- `2026-10-29` `60fd2d2` 계획에 들어옴 (☐ 대기) — 재건 6a: 중심·모드 문서·스킬을 규칙 장부에서 생성 (rebuild/draft — 8 단계에 교체)
- `2026-10-29` `02128d6` 상태 ☐ → ◐ 2026-10-29 — 재건 6c: 전환 기록(검사·서기·dbtool transition) · 명령 장부 → 모드 문서
- `2026-10-29` `02128d6` 결과 처음 적힘 — 재건 6c: 전환 기록(검사·서기·dbtool transition) · 명령 장부 → 모드 문서
- `2026-10-29` `e4423d8` 상태 ◐ 2026-10-29 → ☑ 2026-10-29 — 재건 6c′·6e: 상태 기록 · 관리 파일 JSON · 삼권 점검
- `2026-10-29` `e4423d8` 결과 고쳐 씀 — 재건 6c′·6e: 상태 기록 · 관리 파일 JSON · 삼권 점검
- `2026-10-29` 커밋 전 기록 결과 덧붙음 — 계획 문서 둘을 생성물로 바꾼 일(DEC-0027)을 6c 결과에 남김

## 닿는 결정

- [DEC-0018](../decisions/DEC-0018.md) 2026-10-25 세션 규칙 — 한 세션 = 한 모드 (사용자 결정 2026-10-25)
- [DEC-0027](../decisions/DEC-0027.md) 2026-10-29 계획 문서는 생성물로 — 길어도 되지만 정확하게, 맥락을 모두
