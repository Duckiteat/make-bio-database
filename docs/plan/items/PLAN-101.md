# PLAN-101 — 문지기 연결

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 101 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **문지기 연결** — `dbtool orch` 를 모든 모드의 명령으로(dbtool transition 과 같은 방식), 쓰기 구역 orchestration(= workspace/orchestration/**) 하나. 권한 장부에 PERM 줄. 문지기 모드 표 · 설정은 문지기 파일이라 develop 도 못 고친다 → 승인 묶음(STG-12 방식, 사용자가 GitHub 웹에서 커밋). STG-12a(사용자 손이 드는 L6 보강 보류, 2026-11-02)와 부딪힘 — 열린 질문
- **자리**: `rebuild/rules/modes.json` · `rebuild/rules/permissions.jsonl` · `rebuild/rules/commands.jsonl` · `.claude/settings.json`(필요하면)
- **끝나는 조건**: 모든 모드에서 orch 쓰기 가능 · 다른 구역 불변 · RULE-0521(장부 = 설정 = 문지기) 시험 통과 · 사용자 커밋
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-20` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0064 — 여러 모드 세션을 잇는 상위 작업 조율(오케스트레이션), 사용자 요청 2026-11-20

## 닿는 결정

- [DEC-0064](../decisions/DEC-0064.md) 2026-11-20 작업 조율(오케스트레이션) — Hybrid · DB 반영은 사람 승인 · 모드 권한 유지 · 기존 기록 재사용 · 승인 증거는 사람이 병합한 PR
