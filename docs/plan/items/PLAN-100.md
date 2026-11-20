# PLAN-100 — 조율 장부 + 명령

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 100 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **조율 장부 + 명령** — `workspace/orchestration/events.jsonl` 하나가 원본(덧붙이기만, 순번 · 날짜 · 누가 · 왜). 지금 상태 · 상위 작업 읽기는 접어서(fold) 만드는 생성물(plans.jsonl ↔ plan-log.jsonl 과 같은 장부와 잔액). 명령 `dbtool orch propose · plan · dispatch · handoff · block · cancel · status` — 쓰기는 서기만. **approve 명령은 없다**(승인 사건을 쓰려 하면 거부). 같은 상위 작업에 실행 중인 run 이 있으면 dispatch 거부(중복 실행 방지)
- **자리**: 새 모듈 orch(rebuild 아래, 순수 fold · check) · `legislative/clerk.mjs`(쓰기) · `dbtool.mjs` · 새 시험 orch(tests 아래)
- **끝나는 조건**: fold 결정성 · 금지 전이 거부 · 중복 dispatch 거부 · approve 사건 거부 · 장부 순번 끊김 거부 시험 — 이 단계에서는 develop 세션에서만 씀
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-20` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0064 — 여러 모드 세션을 잇는 상위 작업 조율(오케스트레이션), 사용자 요청 2026-11-20
- `2026-11-20` 커밋 전 기록 '자리' 칸이 바뀜 — DEC-0064 — 자리 칸의 아직 없는 파일을 경로 모양에서 이름으로 (탐침이 열린 작업의 경로를 지금 파일로 대조함 — 깨진 참조)

  <details><summary>이전 · 이후</summary>

이전: `rebuild/orch.mjs`(순수 fold · check) · `legislative/clerk.mjs`(쓰기) · `dbtool.mjs` · `tests/orch.test.mjs`

이후: 새 모듈 orch(rebuild 아래, 순수 fold · check) · `legislative/clerk.mjs`(쓰기) · `dbtool.mjs` · 새 시험 orch(tests 아래)

</details>

## 닿는 결정

- [DEC-0064](../decisions/DEC-0064.md) 2026-11-20 작업 조율(오케스트레이션) — Hybrid · DB 반영은 사람 승인 · 모드 권한 유지 · 기존 기록 재사용 · 승인 증거는 사람이 병합한 PR
