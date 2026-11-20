# 작업 조율 가상 실행 (PLAN-099 입력) — ORCH-0001 cAMP 출처 보강을 탁상에서 한 바퀴

> 2026-11-20 · develop 모드 · 결정 DEC-0064 · DEC-0065 · 코드를 돌리지 않은 탁상 실행이다. 단계마다 저장소의 실제 명령 · 검사 · 문지기 구역(`rebuild/rules/modes.json` gate) · 클라우드 세션 도구에 대어 보았다.

## 1. 한 줄 결론

순환은 **문지기 변경 없이 돈다** — 공통 쓰기 구역에 이미 `rebuild/state/**` 가 있어 조율 장부를 거기 두면 모든 모드가 쓸 수 있다. 대신 지금 설계에 없던 것 일곱이 필요하다. 그중 셋이 막힘이다: **PR 을 누가 여나**(RULE-0257 은 매번 사용자 요청), **덧붙이기 장부의 순번이 브랜치 병합에서 겹침**, **Supervisor 가 어느 모드인가**.

## 2. 시나리오

- 대상: 전환 기록 #8 — D000050 cAMP 신호 전달의 단계 규칙 7 · 분자 설명 15 가 전부 `asserted`(출처 0). 끄는 단계 3 곳은 #9 에서 develop 필요로 막혔으므로 **이 순환 밖**.
- 흐름: 사람 제안 → Supervisor → author 세션 → inspect 세션 → PR(승인 묶음 지문) → 사람 병합 → baseline 세션 → 완료.
- 조건: 순차(동시 하나) · 세션마다 스스로 `gate open · finish` · DB 반영은 사람이 병합한 PR 만(DEC-0064 가).

## 3. 단계별 실행

| 단계 | 무엇이 일어나나 (저장소 사실) | 통과? | 발견 |
|---|---|---|---|
| S0 제안 | ORCH-0001 을 장부에 적어야 함. 공통 쓰기 구역 = `rebuild/status/**` · `rebuild/state/**` · `docs/plan/**` · `workspace/transitions.jsonl` · `workspace/receipts/**` (모든 모드) | ◐ | F1 장부 자리 · F2 Supervisor 모드 |
| S1 배정 | Supervisor 가 `create_session`(저장소 · 프롬프트)로 author 세션을 띄움. 프롬프트 = 전환 기록 #8 그대로(이미 "다음 세션이 이것만 받는다" 형식) | ☑ | — 전환 기록을 프롬프트로 재사용 |
| S2 author | Europe PMC(`www.ebi.ac.uk`) 는 환경에서 허용됨 → 초록 대조 가능. 출처는 받은 문헌만(RULE-0494). 패치 → validate → augment apply → `finish author` → 커밋 · push(자기 브랜치) | ☑ | F3 실행 ↔ 영수증 연결 |
| S3 넘김 | 끝을 전환 기록 `author→inspect` 로 남김. 그런데 전환 검사(`judicial/transition_audit.js`)는 칸 7 외에는 거부(RULE-0513) → `orch` 칸을 넣을 수 없음 | ✕ → ☑ | F4 연결 방향을 뒤집음: 조율 장부가 전환 순번을 가리킨다(전환 형식 불변) |
| S4 알림 | `create_session` 은 깨끗이 끝난 세션이 알리지 않을 수 있음 → Supervisor 가 모름 | ✕ | F5 끝 신호 |
| S5 inspect | author 브랜치에서 시작(`source_revision`) · 새 세션이라 "자기가 모은 것을 자기가 통과" 위험 없음. verify-collection · 인용–원문 대조 · attest → `attestations/` 에 도장 | ☑ | 실패면 `inspect→author` 전환 = 재작업 1 회(시도 수는 장부에서 셈) |
| S6 PR | 마지막 브랜치 → main PR. **RULE-0257: PR 은 사용자가 명시로 요청할 때만** → Supervisor 가 열 수 없음 | ✕ | F6 PR 권한 |
| S7 병합 | 사람이 승인 화면(approval.js `screen`) · 지문(`digest` = 파일 목록 + 바뀐 뒤 바이트) 확인 후 병합. CI(check.yml) 가 PR 에서 한 번 더 | ◐ | F7 병합 방식 · F8 순번 겹침 |
| S8 baseline | main 에서 새 세션 · 사전 등록 → 실행 → 보고서(`docs/reports/`). 결과를 main 에 남기려면 PR 하나 더 → 사람 병합 또 | ◐ | F9 완료 기록 자리 |
| S9 갈림 | 관찰과 안 맞음 → FINDING(고치지 않음, RULE-0039) · 출처 없음 → DATA_GAP 한계(RULE-0040) · develop 이 필요(#9 처럼) → develop 은 사용자 요청만 | ◐ | F10 끝의 종류 · F11 자동 배정 금지 모드 |

## 4. 발견 — 필요한 것

| 번호 | 무엇이 빠졌나 | 제안 | 넣을 곳 |
|---|---|---|---|
| F1 | 장부를 `workspace/orchestration/` 에 두면 문지기 구역 신설(L6, STG-12a 보류와 부딪힘) | 장부를 **`rebuild/state/orch-log.jsonl`** 로 — 공통 구역이라 모든 모드가 이미 씀. 계획 장부(plans/plan-log)와 같은 집. ⚠ 공통 구역의 원래 뜻은 "계획 상태" — 조율도 계획 상태로 본다는 것을 사용자가 결정해야 함(틈 악용이 아니라 명시 결정, RULE-0461) | DEC-0065 · PLAN-100 |
| F2 | Supervisor 의 모드가 없음 | Supervisor = **쓰지 않는 세션**(DEC-0065 가). 장부 쓰기는 각 모드 세션이 자기 사건만. 제안(S0)은 사람이 시작한 세션이 적음 | PLAN-099 |
| F3 | 클라우드 세션 번호와 영수증 번호(`<날짜>-<해시>`) 가 따로 | 각 세션의 첫 사건 `run start` 에 자기 영수증 파일 · 브랜치를 적음 | PLAN-100 |
| F4 | 전환 기록에 `orch` 칸 불가(RULE-0513) | 전환 형식은 그대로 — 조율 장부의 `handoff` 사건이 전환 순번 `transition_seq` 를 가리킴 | PLAN-100 |
| F5 | 끝 신호 없음 | 각 세션 마지막 일 = Supervisor 에게 `send_message`(ORCH · 브랜치 · 결과) + Supervisor 쪽 늦은 깨우기(20 분 이상)로 `get_session` 확인 | PLAN-104 |
| F6 | **PR 을 열 사람** | (가) 사용자가 PR 을 연다 · (나) 상시 권한으로 "ORCH 승인 PR 만 Supervisor 가 연다" — 권한 장부 + RULE-0257 고침 + 철회 가능(RULE-0461 의 유일한 길). 병합은 어느 쪽이든 사람만 | PLAN-101(바뀜) |
| F7 | 병합 방식(머지 · 스쿼시 · 리베이스)마다 커밋 모양이 다름 | 승인 = "지문과 같은 바이트가 origin/main 의 어떤 커밋에 처음 나타남" — 커밋 모양에 기대지 않음. HEAD 가 아니라 처음 나타난 커밋 | PLAN-102 |
| F8 | **덧붙이기 장부의 순번**(transitions · plan-log · orch-log) 이 브랜치에서 붙고, 그 사이 main 에도 붙으면 병합 때 순번 겹침(plan check: "덧붙이기만" 오류) | ORCH 는 하나씩(순차) + PR 전에 main 을 받아 순번을 다시 매기는 도구(사건 내용은 그대로, 순번만) — 또는 조율 장부는 순번 대신 사건 번호(세션 · 차례)로 | PLAN-100 |
| F9 | baseline 결과를 main 에 남기려면 PR 이 또 하나 | 완료는 baseline 세션의 `finish baseline --full` 통과 영수증(main 커밋 위)으로 계산하고, 보고서 PR 은 다음 승인 PR 과 묶어도 됨 | PLAN-099 |
| F10 | 끝이 "완료" 하나뿐 | 끝의 종류: completed(맞음) · completed_with_finding(FINDING) · gap_registered(DATA_GAP 한계) · needs_user(develop 필요) · cancelled | PLAN-099 |
| F11 | 자동 배정 범위 | 자동 배정은 author · inspect · baseline 만. develop · field 는 "사용자 요청만" 규칙이라 needs_user 로 멈춤 | PLAN-104 · policies |
| F12 | 정지 · 한도 | 정지 스위치(정책 하나로 전부) · ORCH 당 세션 수 · 재시도 2 · 시간 제한 — 넘기면 blocked + 사람 | PLAN-104 |
| F13 | push 실패 유실(PLAN-077 의 11/3) | 띄운 세션 첫 일 = push 권한 확인, 안 되면 바로 실패 보고 | PLAN-104 (PLAN-077 뒤) |

## 5. 남는 결정 (사용자)

| 질문 | 선택지 | 추천 | 까닭 |
|---|---|---|---|
| F1 — 조율 장부를 공통 구역(`rebuild/state/`) 에 둘까 | 공통 구역 · 새 구역(L6) | 공통 구역 | 문지기 변경 0, 계획 장부와 같은 검사 방식 재사용 |
| F6 — 승인 PR 을 누가 여나 | 사용자 · 상시 권한으로 Supervisor | 처음(PLAN-103)은 사용자, 두 번째부터 상시 권한 검토 | 첫 순환에서 PR 모양을 본 뒤 권한을 좁게 쓸 수 있음 |
