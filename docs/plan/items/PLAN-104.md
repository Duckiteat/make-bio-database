# PLAN-104 — 배정 자동화 (Hybrid)

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 104 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **배정 자동화 (Hybrid)** — PLAN-103 에서 깨진 곳에만 검사를 켠다(RULE-0462). Supervisor 세션이 클라우드 세션을 순차로 띄워 하위 run 을 배정(동시 하나) · policies.json(작업 종류별 자동 가능 여부 · 재시도 한도 2 · 시간 제한) · 시간을 넘긴 run 은 blocked + 사람에게. Supervisor 는 모드 세션을 대신 열지 않고(한 세션 = 한 모드), 승인 · 병합 권한 없음
- **자리**: orch 모듈(PLAN-100) · 정책 파일 policies(workspace/orchestration 아래, 새) · 예약 작업 지시문
- **끝나는 조건**: 두 번째 순환을 Supervisor 가 사람 손 없이 awaiting_approval 까지 끌고 감 · 재시도 한도 넘김 → blocked 시험 · 승인은 여전히 사용자 병합뿐
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-20` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0064 — 여러 모드 세션을 잇는 상위 작업 조율(오케스트레이션), 사용자 요청 2026-11-20
- `2026-11-20` 커밋 전 기록 '자리' 칸이 바뀜 — DEC-0064 — 자리 칸의 아직 없는 파일을 경로 모양에서 이름으로 (탐침이 열린 작업의 경로를 지금 파일로 대조함 — 깨진 참조)

  <details><summary>이전 · 이후</summary>

이전: `rebuild/orch.mjs` · `workspace/orchestration/policies.json` · 예약 작업 지시문

이후: orch 모듈(PLAN-100) · 정책 파일 policies(workspace/orchestration 아래, 새) · 예약 작업 지시문

</details>

## 닿는 결정

- [DEC-0064](../decisions/DEC-0064.md) 2026-11-20 작업 조율(오케스트레이션) — Hybrid · DB 반영은 사람 승인 · 모드 권한 유지 · 기존 기록 재사용 · 승인 증거는 사람이 병합한 PR
