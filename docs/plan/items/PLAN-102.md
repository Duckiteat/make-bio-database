# PLAN-102 — 승인 증거 판정

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 102 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **승인 증거 판정** — 상위 작업이 approved 인지 기록이 아니라 사실에서 계산한다: ① 승인 묶음 지문(judicial/approval.js digest — 바뀐 파일 목록 + 바뀐 뒤 바이트) ② 그 지문을 본문에 적은 PR 의 병합 커밋이 origin/main 에 닿아 있음 ③ 병합 시점 파일의 지문 = ① (승인 뒤 바뀌면 무효). 사실 모으기(git 읽기)는 조정자 쪽, 판정은 순수 사법부. AI 는 자기 브랜치에만 push 하고 병합하지 않으므로 ② 는 사람만 만든다
- **자리**: 새 판정 모듈 orch_approval(judicial 아래, 순수) · orch 모듈의 사실 모으기 · 새 시험 orch_approval(tests 아래)
- **끝나는 조건**: 브랜치 커밋만 → 승인 아님 · 병합 뒤 파일 바뀜 → 승인 아님 · 지문 일치 병합 → 승인 시험 · 판정 모듈이 실행·쓰기를 하지 않음(RULE-0475 류 검사)
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-20` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0064 — 여러 모드 세션을 잇는 상위 작업 조율(오케스트레이션), 사용자 요청 2026-11-20
- `2026-11-20` 커밋 전 기록 '자리' 칸이 바뀜 — DEC-0064 — 자리 칸의 아직 없는 파일을 경로 모양에서 이름으로 (탐침이 열린 작업의 경로를 지금 파일로 대조함 — 깨진 참조)

  <details><summary>이전 · 이후</summary>

이전: `judicial/orch_approval.js`(새, 순수) · `rebuild/orch.mjs` 사실 모으기 · `tests/orch_approval.test.mjs`

이후: 새 판정 모듈 orch_approval(judicial 아래, 순수) · orch 모듈의 사실 모으기 · 새 시험 orch_approval(tests 아래)

</details>

## 닿는 결정

- [DEC-0064](../decisions/DEC-0064.md) 2026-11-20 작업 조율(오케스트레이션) — Hybrid · DB 반영은 사람 승인 · 모드 권한 유지 · 기존 기록 재사용 · 승인 증거는 사람이 병합한 PR
