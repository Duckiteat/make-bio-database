# PLAN-099 — 조율 규격 = 감독(Supervisor) 규격

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 99 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **조율 규격 = 감독(Supervisor) 규격** — DEC-0068: 이 층은 Supervisor(사용자와 대화하는 상위 세션이 여러 모드 세션을 띄우고 잇는 것)이고 Claude 내장 조율(하위 에이전트 · fork · 작업 목록 — 한 세션 안의 도우미)과 다르다. 두 쪽의 경계표(쓰임 · 금지)와 이름(감독 장부 · 명령 · 상위 작업 번호)을 정한다. 상위 작업의 상태 · 전이 · 전이 주체 · 승인 증거를 글로 고정한다. 상태 7: planned · running · awaiting_approval · applying · completed + blocked · cancelled (재작업은 시도 횟수). 끝의 종류: completed · completed_with_finding · gap_registered · needs_user · cancelled. 하위는 기존 Task(형식 그대로) + 모드 실행(run = { mode, session, receipt, branch, transition_seq, result } — 기존 기록을 가리키는 링크). Supervisor 는 쓰지 않는 세션(DEC-0065 ①) · 상위 작업 하나 = 통합 브랜치 하나 · inspect 는 author 와 다른 새 세션 · 완료는 baseline 세션의 finish --full 영수증으로. 승인은 사건으로 적지 않고 증거에서 계산 — **단 AI 도 병합할 수 있고 병합 기록이 사람 계정으로 남으므로(DEC-0068), 사람만 만들 수 있는 증거를 먼저 정한다**. 입력: `docs/reports/2026-11-20-orchestration-tabletop.md`
- **자리**: 설계 문서 orchestration(새, docs/design 아래) · `docs/textbook/` 해당 장
- **끝나는 조건**: 규격 문서 + 금지 전이 표 + Supervisor ↔ Claude 내장 조율 경계표 + 사용자 확인 — 기존 tasks/ · handoff/ · transitions.jsonl · receipts/ · gate.mjs 의 역할이 바뀌지 않음을 표로 · 하위 에이전트의 도구 호출도 문지기 훅 · 영수증을 지나는지 확인(시험 또는 영수증)
- **상태**: ☑ 완료 2026-11-21

## 결과 (날짜별)

- `2026-11-21` 커밋 전 기록: 2026-11-21 초안 v0: `docs/design/supervisor.md` — 1 무엇인가 · 2 Supervisor ↔ Claude 내장 조율 경계표 · 3 상위 작업 · 실행 기록 = 공통 작업 계약(SUP-0001 · SUP-0001/r1, 범위 · 승인 칸은 두지 않음) · 4 상태 일곱(적는 셋 · 계산하는 셋 · 취소) · 전이표 · 승인 증거 네 겹 · 금지 전이 아홉 · 5 누가 무엇을 쓰나(Supervisor 는 쓰지 않음 · 사건 번호는 세션 앞 8 자-차례) · 6 한 바퀴 · 7 기존 체계 대조표(모두 안 바뀜) · 8 열린 것. 시험한 사실: 하위 에이전트가 돌린 Bash 가 부모 세션의 영수증에 같은 세션 번호로 남음(205 번째 줄) → 하위 에이전트는 같은 세션 · 같은 모드 · 같은 문지기 — 다른 세션의 재검토로 칠 수 없음. 남은 끝나는 조건: 사용자 확인.
- `2026-11-21` 커밋 전 기록: · 2026-11-21 사용자 확정("확정하고 PLAN-100 시작하자"). 명령 이름은 PLAN-100 에서 `node rebuild/supervise.mjs` 로 바꿈(규격 §3.1 고침).

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
- `2026-11-21` 커밋 전 기록 '작업' 칸이 바뀜 — DEC-0068 — 조율의 정체(Supervisor)와 Claude 내장 조율의 구분 · AI 병합 발견으로 승인 증거의 전제 다시 세움

  <details><summary>이전 · 이후</summary>

이전: **조율 규격** — 상위 작업(ORCH-nnnn)의 상태 · 전이 · 전이 주체 · 승인 증거를 글로 고정한다. 상태 7: planned · running · awaiting_approval · applying · completed + blocked · cancelled (재작업은 상태가 아니라 실행 시도 횟수). 끝의 종류(F10): completed · completed_with_finding · gap_registered · needs_user · cancelled. 하위는 기존 Task(형식 그대로) + 모드 실행(run = { mode, session, receipt, branch, transition_seq, result } — 기존 기록을 가리키는 링크). Supervisor 는 쓰지 않는 세션(DEC-0065 ①, F2) · ORCH 하나 = 통합 브랜치 하나, 다음 세션은 앞 브랜치에서(③) · inspect 는 author 와 다른 새 세션(⑤) · 완료는 baseline 세션의 finish --full 영수증으로(F9). 승인은 사건으로 적지 않고 증거에서 계산(DEC-0064 가). 입력: 가상 실행 `docs/reports/2026-11-20-orchestration-tabletop.md`

이후: **조율 규격 = 감독(Supervisor) 규격** — DEC-0068: 이 층은 Supervisor(사용자와 대화하는 상위 세션이 여러 모드 세션을 띄우고 잇는 것)이고 Claude 내장 조율(하위 에이전트 · fork · 작업 목록 — 한 세션 안의 도우미)과 다르다. 두 쪽의 경계표(쓰임 · 금지)와 이름(감독 장부 · 명령 · 상위 작업 번호)을 정한다. 상위 작업의 상태 · 전이 · 전이 주체 · 승인 증거를 글로 고정한다. 상태 7: planned · running · awaiting_approval · applying · completed + blocked · cancelled (재작업은 시도 횟수). 끝의 종류: completed · completed_with_finding · gap_registered · needs_user · cancelled. 하위는 기존 Task(형식 그대로) + 모드 실행(run = { mode, session, receipt, branch, transition_seq, result } — 기존 기록을 가리키는 링크). Supervisor 는 쓰지 않는 세션(DEC-0065 ①) · 상위 작업 하나 = 통합 브랜치 하나 · inspect 는 author 와 다른 새 세션 · 완료는 baseline 세션의 finish --full 영수증으로. 승인은 사건으로 적지 않고 증거에서 계산 — **단 AI 도 병합할 수 있고 병합 기록이 사람 계정으로 남으므로(DEC-0068), 사람만 만들 수 있는 증거를 먼저 정한다**. 입력: `docs/reports/2026-11-20-orchestration-tabletop.md`

</details>
- `2026-11-21` 커밋 전 기록 '끝나는 조건' 칸이 바뀜 — DEC-0068 — 조율의 정체(Supervisor)와 Claude 내장 조율의 구분 · AI 병합 발견으로 승인 증거의 전제 다시 세움

  <details><summary>이전 · 이후</summary>

이전: 규격 문서 + 금지 전이 표 + 사용자 확인 — 기존 tasks/ · handoff/ · transitions.jsonl · receipts/ · gate.mjs 의 역할이 바뀌지 않음을 표로

이후: 규격 문서 + 금지 전이 표 + Supervisor ↔ Claude 내장 조율 경계표 + 사용자 확인 — 기존 tasks/ · handoff/ · transitions.jsonl · receipts/ · gate.mjs 의 역할이 바뀌지 않음을 표로 · 하위 에이전트의 도구 호출도 문지기 훅 · 영수증을 지나는지 확인(시험 또는 영수증)

</details>
- `2026-11-21` 커밋 전 기록 상태 ☐ → ◐ 2026-11-21 — PLAN-099 감독 규격 초안 v0 — 사용자 확인 전이라 진행으로
- `2026-11-21` 커밋 전 기록 결과 처음 적힘 — PLAN-099 감독 규격 초안 v0 — 사용자 확인 전이라 진행으로
- `2026-11-21` 커밋 전 기록 상태 ◐ 2026-11-21 → ☑ 2026-11-21 — PLAN-099 사용자 확정 · PLAN-100 감독 장부 + 명령 구현
- `2026-11-21` 커밋 전 기록 결과 덧붙음 — PLAN-099 사용자 확정 · PLAN-100 감독 장부 + 명령 구현

## 닿는 결정

- [DEC-0064](../decisions/DEC-0064.md) 2026-11-20 작업 조율(오케스트레이션) — Hybrid · DB 반영은 사람 승인 · 모드 권한 유지 · 기존 기록 재사용 · 승인 증거는 사람이 병합한 PR
- [DEC-0065](../decisions/DEC-0065.md) 2026-11-20 작업 조율 보강 다섯 + 가상 실행 — Supervisor 는 쓰지 않음 · 전환 형식 불변 · 세션 브랜치 잇기 · 077 뒤 순환 · 안전장치
- [DEC-0068](../decisions/DEC-0068.md) 2026-11-21 작업 조율의 정체 — Supervisor(감독)이다, Claude 내장 조율(하위 에이전트 · fork · 작업 목록)과 다르다
- [DEC-0070](../decisions/DEC-0070.md) 2026-11-21 독립형 오케스트레이터 — 방향으로 기록 · 계약은 감독 장부 · Governor CI 겹 · 둘째 실행 모듈은 사람 작업 흐름
