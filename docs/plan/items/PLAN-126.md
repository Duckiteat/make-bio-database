# PLAN-126 — 범위 ② 작업 종류 넓히기

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 126 · 11부 — 자율 오케스트레이션 (주제 → 분해 → 실행 → 통합 → 검증, 사람은 주제 · 결정 · 승락)
- **작업**: 범위 ② 작업 종류 넓히기 — 수집(fetch) · 후보 판정 · baseline 통합 검증 · 사람 관문 종류 · MCP 쓰기 서버 연결(작성자 잠금 F1)
- **자리**: `mcp/clerk.mjs` · `mcp/fetch.mjs` · `.mcp.json` · `legislative/clerk.mjs` writerLock · 감독 규격
- **끝나는 조건**: author 수집 → inspect 판정 → baseline 통합 검증이 한 목표 안에서 돎 · MCP 쓰기 도구가 문지기 · 영수증을 지남 · 잠금 결함 시험 · PLAN-105 끝나는 조건 채움
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-24` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 사용자 결정 DEC-0093 — 오케스트레이터를 MVP(최종 형식) → 범위 → 병렬 → 자율 순서로 계획

## 닿는 결정

- [DEC-0093](../decisions/DEC-0093.md) 2026-11-24 오케스트레이터 순서 — MVP(최종 형식으로 · 있는 것 최대한) → 범위 넓히기 → 병렬 → 자율(사람은 주제 · 결정 · 확인 · 승락만)
