# PLAN-099 — 조율 규격

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 99 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **조율 규격** — 상위 작업(ORCH-nnnn)의 상태 · 전이 · 전이 주체 · 승인 증거를 글로 고정한다. 상태 7: planned · running · awaiting_approval · applying · completed + blocked · cancelled (재작업은 상태가 아니라 실행 시도 횟수). 끝의 종류(F10): completed · completed_with_finding · gap_registered · needs_user · cancelled. 하위는 기존 Task(형식 그대로) + 모드 실행(run = { mode, session, receipt, branch, transition_seq, result } — 기존 기록을 가리키는 링크). Supervisor 는 쓰지 않는 세션(DEC-0065 ①, F2) · ORCH 하나 = 통합 브랜치 하나, 다음 세션은 앞 브랜치에서(③) · inspect 는 author 와 다른 새 세션(⑤) · 완료는 baseline 세션의 finish --full 영수증으로(F9). 승인은 사건으로 적지 않고 증거에서 계산(DEC-0064 가). 입력: 가상 실행 `docs/reports/2026-11-20-orchestration-tabletop.md`
- **자리**: 설계 문서 orchestration(새, docs/design 아래) · `docs/textbook/` 해당 장
- **끝나는 조건**: 규격 문서 + 금지 전이 표 + 사용자 확인 — 기존 tasks/ · handoff/ · transitions.jsonl · receipts/ · gate.mjs 의 역할이 바뀌지 않음을 표로
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-20` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0064 — 여러 모드 세션을 잇는 상위 작업 조율(오케스트레이션), 사용자 요청 2026-11-20
- `2026-11-20` 커밋 전 기록 '자리' 칸이 바뀜 — DEC-0064 — 자리 칸의 아직 없는 파일을 경로 모양에서 이름으로 (탐침이 열린 작업의 경로를 지금 파일로 대조함 — 깨진 참조)

  <details><summary>이전 · 이후</summary>

이전: `docs/design/orchestration.md`(새) · `docs/textbook/` 해당 장

이후: 설계 문서 orchestration(새, docs/design 아래) · `docs/textbook/` 해당 장

</details>
- `2026-11-20` 커밋 전 기록 '작업' 칸이 바뀜 — DEC-0065 — 빈 곳 다섯 반영 + 가상 실행 발견(F1–F13)

  <details><summary>이전 · 이후</summary>

이전: **조율 규격** — 상위 작업(ORCH-nnnn)의 상태 · 전이 · 전이 주체 · 승인 증거를 글로 고정한다. 상태 7: planned · running · awaiting_approval · applying · completed + blocked · cancelled (재작업은 상태가 아니라 실행 시도 횟수). 하위는 기존 Task(TASK-*.md, 형식 그대로) 참조 + 모드 실행(run = { mode, session, receipt, transition_seq, result } — 기존 영수증·전환 기록을 가리키는 링크, 새 상태 머신 아님). 하위에서 계산되는 상태(handoff collected → verified → applied)는 상위에 다시 적지 않는다. 승인은 사건으로 적지 않고 증거에서 계산한다(DEC-0064 가: 지문 + 사람이 병합한 PR)

이후: **조율 규격** — 상위 작업(ORCH-nnnn)의 상태 · 전이 · 전이 주체 · 승인 증거를 글로 고정한다. 상태 7: planned · running · awaiting_approval · applying · completed + blocked · cancelled (재작업은 상태가 아니라 실행 시도 횟수). 끝의 종류(F10): completed · completed_with_finding · gap_registered · needs_user · cancelled. 하위는 기존 Task(형식 그대로) + 모드 실행(run = { mode, session, receipt, branch, transition_seq, result } — 기존 기록을 가리키는 링크). Supervisor 는 쓰지 않는 세션(DEC-0065 ①, F2) · ORCH 하나 = 통합 브랜치 하나, 다음 세션은 앞 브랜치에서(③) · inspect 는 author 와 다른 새 세션(⑤) · 완료는 baseline 세션의 finish --full 영수증으로(F9). 승인은 사건으로 적지 않고 증거에서 계산(DEC-0064 가). 입력: 가상 실행 `docs/reports/2026-11-20-orchestration-tabletop.md`

</details>

## 닿는 결정

- [DEC-0064](../decisions/DEC-0064.md) 2026-11-20 작업 조율(오케스트레이션) — Hybrid · DB 반영은 사람 승인 · 모드 권한 유지 · 기존 기록 재사용 · 승인 증거는 사람이 병합한 PR
- [DEC-0065](../decisions/DEC-0065.md) 2026-11-20 작업 조율 보강 다섯 + 가상 실행 — Supervisor 는 쓰지 않음 · 전환 형식 불변 · 세션 브랜치 잇기 · 077 뒤 순환 · 안전장치
