# PLAN-100 — 감독 장부 + 명령

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 100 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **감독 장부 + 명령** — 원본 장부 `rebuild/state/supervise.jsonl` 하나(덧붙이기만, 서기 appendSupervise, 공통 구역 — F1). 지금 상태는 장부를 접은 것(생성 · 보기). 명령 `node rebuild/supervise.mjs status · check · propose · start · handoff · block · cancel` (계획 장부의 plan.mjs 와 같은 자리 — 명령 장부 밖). **approve 사건 없음** · 실행 중 run 이 있으면 start 거부 · 사건 번호는 <세션 꼬리>-<차례>(F8) · 누가 · 모드 · 문지기(enforcement) 칸은 입력이 아니라 이 세션의 영수증에서 · 계약에 범위 · 승인 칸 없음 · inspect 는 만든 세션과 다른 세션 · 같은 모드 세 번까지. MCP 도구(PLAN-105)는 같은 함수를 부름
- **자리**: 새 모듈 orch(rebuild 아래, 순수 fold · check) · `legislative/clerk.mjs`(쓰기) · `dbtool.mjs` · 새 시험 orch(tests 아래)
- **끝나는 조건**: fold 결정성 · 금지 전이 거부 · 중복 start 거부 · approve 사건 거부 · 두 브랜치에서 붙인 장부를 합쳐도 검사 통과(F8) 시험 · 실행 기록에 executor(claude-code · human · …) · enforcement(훅 · 영수증 있음/없음) 칸 — 계약 모양(DEC-0070) · 권한 범위는 계약에 적지 않고 모드에서 계산
- **상태**: ☑ 완료 2026-11-21

## 결과 (날짜별)

- `2026-11-21` 커밋 전 기록: 2026-11-21 구현: `rebuild/supervise.mjs`(load · refs · sessionFromReceipts 는 읽기 / shape · fold · check · admit · render 는 순수 / 명령) · `legislative/clerk.mjs` appendSupervise(한 줄짜리 사건만 끝에, 구역 rebuild) · `tests/supervise.test.mjs` 8 — ① 한 바퀴(propose → author start → handoff → 다른 세션 inspect start) ② 접기는 결정적(줄 순서를 섞어도 같은 상태) ③ approve · 모르는 사건 · 범위 · 승인자 · 누가 · 문지기 칸 입력 거부, 장부에 직접 끼운 승인 줄도 검사가 잡음 ④ 중복 실행 · 다른 세션의 넘김 · 검사 미통과 넘김 · 없는 전환 순번 · 모드 불일치 · 결정 없는 취소 거부 ⑤ 같은 세션(하위 에이전트 포함)의 inspect 거부 · 재시도 한도 · 막힌 뒤 결정 없는 재시작 거부 ⑥ 두 브랜치의 같은 SUP 번호를 검사가 잡고 사건 번호는 안 겹침 ⑦ 계획 작업 · 결정 · steps 대조 · 차례 빠짐 ⑧ 서기. 번호 사전에 supervise_task(SUP-). 교과서 7 장은 고치지 않음(분류 장부가 본문 줄을 줄 번호로 고정 — 재분류와 함께). 이 세션에서 --dry 로 propose(세션 꼬리가 영수증에서 a1598600-af3) · approved_by 끼워 넣기 거부 확인. 장부 파일은 첫 사건 전이라 아직 없음. 남는 것: 승인 · 반영 · 완료의 계산(PLAN-102) · MCP 연결(PLAN-105).

  <details><summary>고쳐 쓰기 전 글</summary>

2026-11-21 구현: `rebuild/supervise.mjs`(load · refs · sessionFromReceipts 는 읽기 / shape · fold · check · admit · render 는 순수 / 명령) · `legislative/clerk.mjs` appendSupervise(한 줄짜리 사건만 끝에, 구역 rebuild) · `tests/supervise.test.mjs` 8 — ① 한 바퀴(propose → author start → handoff → 다른 세션 inspect start) ② 접기는 결정적(줄 순서를 섞어도 같은 상태) ③ approve · 모르는 사건 · 범위 · 승인자 · 누가 · 문지기 칸 입력 거부, 장부에 직접 끼운 승인 줄도 검사가 잡음 ④ 중복 실행 · 다른 세션의 넘김 · 검사 미통과 넘김 · 없는 전환 순번 · 모드 불일치 · 결정 없는 취소 거부 ⑤ 같은 세션(하위 에이전트 포함)의 inspect 거부 · 재시도 한도 · 막힌 뒤 결정 없는 재시작 거부 ⑥ 두 브랜치의 같은 SUP 번호를 검사가 잡고 사건 번호는 안 겹침 ⑦ 계획 작업 · 결정 · steps 대조 · 차례 빠짐 ⑧ 서기. 번호 사전에 supervise_task(SUP-). 교과서 7.0′. 이 세션에서 --dry 로 propose(세션 꼬리가 영수증에서 a1598600-af3) · approved_by 끼워 넣기 거부 확인. 장부 파일은 첫 사건 전이라 아직 없음. 남는 것: 승인 · 반영 · 완료의 계산(PLAN-102) · MCP 연결(PLAN-105).

</details>

## 걸어온 길

- `2026-11-20` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0064 — 여러 모드 세션을 잇는 상위 작업 조율(오케스트레이션), 사용자 요청 2026-11-20
- `2026-11-20` 커밋 전 기록 '자리' 칸이 바뀜 — DEC-0064 — 자리 칸의 아직 없는 파일을 경로 모양에서 이름으로 (탐침이 열린 작업의 경로를 지금 파일로 대조함 — 깨진 참조)

  <details><summary>이전 · 이후</summary>

이전: `rebuild/orch.mjs`(순수 fold · check) · `legislative/clerk.mjs`(쓰기) · `dbtool.mjs` · `tests/orch.test.mjs`

이후: 새 모듈 orch(rebuild 아래, 순수 fold · check) · `legislative/clerk.mjs`(쓰기) · `dbtool.mjs` · 새 시험 orch(tests 아래)

</details>
- `2026-11-20` 커밋 전 기록 '작업' 칸이 바뀜 — DEC-0065 — 빈 곳 다섯 반영 + 가상 실행 발견(F1–F13)

  <details><summary>이전 · 이후</summary>

이전: **조율 장부 + 명령** — `workspace/orchestration/events.jsonl` 하나가 원본(덧붙이기만, 순번 · 날짜 · 누가 · 왜). 지금 상태 · 상위 작업 읽기는 접어서(fold) 만드는 생성물(plans.jsonl ↔ plan-log.jsonl 과 같은 장부와 잔액). 명령 `dbtool orch propose · plan · dispatch · handoff · block · cancel · status` — 쓰기는 서기만. **approve 명령은 없다**(승인 사건을 쓰려 하면 거부). 같은 상위 작업에 실행 중인 run 이 있으면 dispatch 거부(중복 실행 방지)

이후: **조율 장부 + 명령** — 원본 장부 하나(덧붙이기만, 날짜 · 누가 · 왜). 자리는 F1 결정: 공통 구역 rebuild/state 아래(추천, 문지기 변경 0) 또는 새 구역. 지금 상태 · ORCH 읽기는 접어서 만드는 생성물. 명령 `dbtool orch propose · start · handoff · block · cancel · status` — start 는 자기 영수증 · 브랜치를 적음(F3), handoff 는 전환 순번을 가리킴(F4, 전환 형식 불변). **approve 명령 없음**. 실행 중 run 이 있으면 start 거부(중복 방지). 병합에서 순번이 겹치지 않게(F8): 순번 대신 사건 번호(세션 · 차례) 또는 PR 전 순번 다시 매기기

</details>
- `2026-11-20` 커밋 전 기록 '끝나는 조건' 칸이 바뀜 — DEC-0065 — 빈 곳 다섯 반영 + 가상 실행 발견(F1–F13)

  <details><summary>이전 · 이후</summary>

이전: fold 결정성 · 금지 전이 거부 · 중복 dispatch 거부 · approve 사건 거부 · 장부 순번 끊김 거부 시험 — 이 단계에서는 develop 세션에서만 씀

이후: fold 결정성 · 금지 전이 거부 · 중복 start 거부 · approve 사건 거부 · 두 브랜치에서 붙인 장부를 합쳐도 검사 통과(F8) 시험

</details>
- `2026-11-21` 커밋 전 기록 '작업' 칸이 바뀜 — DEC-0066 · DEC-0067 — 자기 개선 루프 최소판 채택 · 권장 결정 전부 · 개발 순서는 조율(오케스트레이터)부터

  <details><summary>이전 · 이후</summary>

이전: **조율 장부 + 명령** — 원본 장부 하나(덧붙이기만, 날짜 · 누가 · 왜). 자리는 F1 결정: 공통 구역 rebuild/state 아래(추천, 문지기 변경 0) 또는 새 구역. 지금 상태 · ORCH 읽기는 접어서 만드는 생성물. 명령 `dbtool orch propose · start · handoff · block · cancel · status` — start 는 자기 영수증 · 브랜치를 적음(F3), handoff 는 전환 순번을 가리킴(F4, 전환 형식 불변). **approve 명령 없음**. 실행 중 run 이 있으면 start 거부(중복 방지). 병합에서 순번이 겹치지 않게(F8): 순번 대신 사건 번호(세션 · 차례) 또는 PR 전 순번 다시 매기기

이후: **조율 장부 + 명령** — 원본 장부 하나(덧붙이기만, 날짜 · 누가 · 왜). 자리는 **공통 구역 rebuild/state 아래**(F1 — DEC-0066, 문지기 변경 0). 지금 상태 · ORCH 읽기는 접어서 만드는 생성물. 명령 `dbtool orch propose · start · handoff · block · cancel · status` — start 는 자기 영수증 · 브랜치를 적음(F3), handoff 는 전환 순번을 가리킴(F4, 전환 형식 불변). **approve 명령 없음**. 실행 중 run 이 있으면 start 거부(중복 방지). 병합에서 순번이 겹치지 않게(F8): 순번 대신 사건 번호(세션 · 차례) 또는 PR 전 순번 다시 매기기. 명령과 MCP 도구(PLAN-105)는 같은 함수

</details>
- `2026-11-21` 커밋 전 기록 '끝나는 조건' 칸이 바뀜 — DEC-0070 — 독립형 오케스트레이터 검토의 권장 결정 전부

  <details><summary>이전 · 이후</summary>

이전: fold 결정성 · 금지 전이 거부 · 중복 start 거부 · approve 사건 거부 · 두 브랜치에서 붙인 장부를 합쳐도 검사 통과(F8) 시험

이후: fold 결정성 · 금지 전이 거부 · 중복 start 거부 · approve 사건 거부 · 두 브랜치에서 붙인 장부를 합쳐도 검사 통과(F8) 시험 · 실행 기록에 executor(claude-code · human · …) · enforcement(훅 · 영수증 있음/없음) 칸 — 계약 모양(DEC-0070) · 권한 범위는 계약에 적지 않고 모드에서 계산

</details>
- `2026-11-21` 커밋 전 기록 '작업' 칸이 바뀜 — PLAN-099 사용자 확정 · PLAN-100 감독 장부 + 명령 구현

  <details><summary>이전 · 이후</summary>

이전: **조율 장부 + 명령** — 원본 장부 하나(덧붙이기만, 날짜 · 누가 · 왜). 자리는 **공통 구역 rebuild/state 아래**(F1 — DEC-0066, 문지기 변경 0). 지금 상태 · ORCH 읽기는 접어서 만드는 생성물. 명령 `dbtool orch propose · start · handoff · block · cancel · status` — start 는 자기 영수증 · 브랜치를 적음(F3), handoff 는 전환 순번을 가리킴(F4, 전환 형식 불변). **approve 명령 없음**. 실행 중 run 이 있으면 start 거부(중복 방지). 병합에서 순번이 겹치지 않게(F8): 순번 대신 사건 번호(세션 · 차례) 또는 PR 전 순번 다시 매기기. 명령과 MCP 도구(PLAN-105)는 같은 함수

이후: **감독 장부 + 명령** — 원본 장부 `rebuild/state/supervise.jsonl` 하나(덧붙이기만, 서기 appendSupervise, 공통 구역 — F1). 지금 상태는 장부를 접은 것(생성 · 보기). 명령 `node rebuild/supervise.mjs status · check · propose · start · handoff · block · cancel` (계획 장부의 plan.mjs 와 같은 자리 — 명령 장부 밖). **approve 사건 없음** · 실행 중 run 이 있으면 start 거부 · 사건 번호는 <세션 꼬리>-<차례>(F8) · 누가 · 모드 · 문지기(enforcement) 칸은 입력이 아니라 이 세션의 영수증에서 · 계약에 범위 · 승인 칸 없음 · inspect 는 만든 세션과 다른 세션 · 같은 모드 세 번까지. MCP 도구(PLAN-105)는 같은 함수를 부름

</details>
- `2026-11-21` 커밋 전 기록 상태 ☐ → ☑ 2026-11-21 — PLAN-099 사용자 확정 · PLAN-100 감독 장부 + 명령 구현
- `2026-11-21` 커밋 전 기록 결과 처음 적힘 — PLAN-099 사용자 확정 · PLAN-100 감독 장부 + 명령 구현
- `2026-11-21` 커밋 전 기록 결과 고쳐 씀 — PLAN-100 결과 바로잡기 — 교과서는 고치지 않음

## 닿는 결정

- [DEC-0064](../decisions/DEC-0064.md) 2026-11-20 작업 조율(오케스트레이션) — Hybrid · DB 반영은 사람 승인 · 모드 권한 유지 · 기존 기록 재사용 · 승인 증거는 사람이 병합한 PR
- [DEC-0065](../decisions/DEC-0065.md) 2026-11-20 작업 조율 보강 다섯 + 가상 실행 — Supervisor 는 쓰지 않음 · 전환 형식 불변 · 세션 브랜치 잇기 · 077 뒤 순환 · 안전장치
- [DEC-0066](../decisions/DEC-0066.md) 2026-11-21 자기 개선 루프 — 최소판(관측 묶음 · 제안 연결 · 사람 승인 · 증거 완료) · RP1 · RP2 첫 사이클 · 탐지기 보호 · 과학 진척 지표 분리 · 권장 결정 전부
- [DEC-0068](../decisions/DEC-0068.md) 2026-11-21 작업 조율의 정체 — Supervisor(감독)이다, Claude 내장 조율(하위 에이전트 · fork · 작업 목록)과 다르다
- [DEC-0070](../decisions/DEC-0070.md) 2026-11-21 독립형 오케스트레이터 — 방향으로 기록 · 계약은 감독 장부 · Governor CI 겹 · 둘째 실행 모듈은 사람 작업 흐름
