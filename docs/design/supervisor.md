# 감독 (Supervisor) 규격 — 상위 작업 · 상태 · 전이 · 승인 증거 (PLAN-099, 초안 v0)

> 2026-11-21 · develop 모드 · 설계 문서 — 구현은 PLAN-100(장부 · 명령) · 102(승인 증거) · 105(MCP) · 114(CI 겹)에서.
> 결정: DEC-0064 · 0065 · 0066 · 0067 · 0068 · 0069 · 0070 · 방향 DIR-0010. 입력: `docs/reports/2026-11-20-orchestration-tabletop.md` · `docs/reports/2026-11-21-self-improvement-loop-minimal.md` · `docs/reports/2026-11-21-platform-independent-orchestrator-review.md`.
> 표기 — **[사실]** 저장소에서 확인 · **[정함]** 이 규격이 정하는 것(사용자 확인 대상) · **[열림]** 아직 정하지 않음.

---

## 1. 무엇인가

**감독(Supervisor)** 은 사용자와 대화하는 상위 세션이, 여러 모드 세션을 띄우고 그 결과를 잇게 하는 **운영 규칙과 장부** 다. 프로그램 하나가 아니다. 상태는 저장소 장부에 있고, 세션은 일시적인 실행 단위다 [정함 — DEC-0068 · DIR-0010].

| 이 규격이 다루는 것 | 다루지 않는 것 |
|---|---|
| 상위 작업(여러 모드를 거치는 일 하나)의 정의 · 상태 · 전이 · 증거 | 생물 시뮬레이션 배선 (`orchestrator.js` — 이름이 비슷할 뿐 다른 것) |
| 실행 기록(run) — 어느 실행 모듈 · 세션 · 브랜치가 무엇을 했나 | 데이터 판정 (사법부) · 데이터 쓰기 (서기) |
| 승인을 무엇으로 계산하나 | 권한 부여 (권한 장부 · 모드 표 — 사람) |
| 감독 장부의 모양과 쓰는 규칙 | 계획 내용 (계획 장부) · 모드 통제 (문지기) |

---

## 2. Supervisor ↔ Claude 내장 조율 경계표

| | 감독 (Supervisor) | Claude 내장 조율 (하위 에이전트 · fork · 작업 목록 · 백그라운드 작업) |
|---|---|---|
| 정체 | 사용자와 대화하는 상위 세션 + 감독 장부 | 한 세션 안의 도우미 |
| 세션 · 모드 | 실행마다 **새 세션**, 세션마다 모드 하나 (각자 `gate open`) | **부모와 같은 세션 · 같은 모드** — 2026-11-21 시험: 하위 에이전트가 돌린 `ls workspace/tasks` 가 부모 세션의 영수증에 같은 세션 번호로 남음 (205 번째 줄) [사실] |
| 문지기 · 영수증 | 각 세션의 훅이 따로 | 부모의 훅을 그대로 지남 [사실 — 같은 시험] |
| 상태 | 저장소 장부 — 세션이 끝나도 이어짐 | 맥락은 휘발, 결과는 부모에게 글로 |
| 결과 | 브랜치 · PR · 전환 기록 · 실행 기록 | 부모가 받아 씀 |
| 승인 | 사람 (4 장) | 없음 |
| **써도 되는 곳** | — | 모드 세션 안의 찾기 · 웹 읽기 · 검토 보조 |
| **금지** [정함] | Supervisor 가 모드 세션을 대신 열기 · 쓰기 | ① 다른 모드의 일을 대신하기 ② **"다른 세션의 재검토"(DEC-0066 U7)로 치기** — 같은 세션이라 독립이 아님 ③ Supervisor 의 상태를 그 안에만 두기 |

---

## 3. 상위 작업과 실행 기록 — 공통 작업 계약

상위 작업 하나 = 여러 모드 세션을 거치는 일 하나. 새 Task Contract 를 따로 두지 않고 **감독 장부의 기록이 곧 계약** 이다 [정함 — DEC-0070].

### 3.1 이름

| 무엇 | 이름 [정함] | 까닭 |
|---|---|---|
| 층 | 감독 (Supervisor) | DEC-0068 |
| 장부 | 감독 장부 — `rebuild/state/supervise.jsonl` (덧붙이기만, 서기 `appendSupervise`) | F1 공통 구역 (DEC-0066) |
| 명령 | `node rebuild/supervise.mjs <status · check · propose · start · handoff · block · cancel>` — 계획 장부의 `rebuild/plan.mjs` 와 같은 자리 (v0 의 `dbtool supervise` 에서 바꿈, PLAN-100: 공통 구역을 쓰는 관리 도구라 명령 장부 · 모드별 막기가 필요 없음) | MCP 도구(PLAN-105)는 같은 함수를 부른다 |
| 상위 작업 번호 | `SUP-0001` … | 번호 사전에 먼저 등록 (PLAN-100) — `ORCH-` 는 쓰지 않음 (조정자 · 내장 조율과 섞임) |
| 실행 번호 | `SUP-0001/r1` … | 상위 작업 안의 차례 |

### 3.2 상위 작업 칸

| 칸 | 뜻 | 값의 출처 | 필수 |
|---|---|---|---|
| `id` | SUP-… | 장부가 줌 | ✔ |
| `plan_item` | 계획 작업 번호 (PLAN · ASY · STG) | 계획 장부 | ✔ |
| `purpose` | 한 줄 목적 | 계획 작업 · 결정 | ✔ |
| `inputs` | 전환 기록 순번 · 파일 · 번호(T · D · S · L · O · V · A · RULE) | 전환 기록 칸 그대로 | ✔ |
| `steps` | 거칠 모드의 차례 (예: author → inspect → baseline) | 계획 | ✔ |
| `done_when` | 끝나는 조건 | 계획 작업 | ✔ |
| `branch` | 통합 브랜치 하나 (상위 작업 하나 = 통합 브랜치 하나 — F 가상 실행) | 첫 실행 | ✔ |
| `policy` | 재시도 한도 · 시간 제한 (기본 2 회 · [열림]) | 정책 | — |

### 3.3 실행 기록 (run) 칸

| 칸 | 뜻 | 필수 |
|---|---|---|
| `run` | SUP-…/r… | ✔ |
| `mode` | 다섯 중 하나 | ✔ |
| `executor` | 실행 모듈 — `claude-code` · `human` · (나중) 다른 AI | ✔ |
| `enforcement` | `{ hooks: yes|no, receipts: yes|no }` — 문지기 · 영수증이 걸렸나를 **정직하게** | ✔ |
| `session` · `receipt` | 세션 번호 · 영수증 파일 | 있으면 |
| `branch` · `base` | 작업 브랜치 · 시작 커밋 | ✔ |
| `transition_seq` | 넘김 때 남긴 전환 기록 순번 | 넘길 때 |
| `outputs` | 커밋 · PR · 보고서 | 끝날 때 |
| `verify` | 끝내기 검사 결과 (`gate finish <모드> --full` 통과 여부 · 작업 지문) | 끝날 때 |
| `failure` | 원인 태그 (FINDING · DATA_GAP · DOMAIN_CONFLICT · NUMERICAL · ENGINE_DEFECT · COMPILER_DEFECT · 실행 실패) | 실패 때 |

| 칸에 **두지 않는 것** [정함] | 까닭 |
|---|---|
| 쓸 수 있는 자리 · 명령 범위 | 모드에서 계산 — 계약을 쓰는 쪽이 범위를 넓히지 못하게 (RULE-0461) |
| 승인 · 승인자 | 증거에서 계산 (4 장) — 칸이 있으면 누군가 적을 수 있음 |
| 계획 작업의 상태 | 계획 장부에만 — 이중으로 적지 않음 |
| 핸드오프 후보의 상태 (collected → verified → applied) | 핸드오프에만 |

---

## 4. 상태 · 전이 · 증거

### 4.1 상태 일곱과 끝의 종류

| 상태 | 뜻 | 적나 · 계산하나 |
|---|---|---|
| `planned` | 상위 작업이 장부에 있음 | 적음 (`propose`) |
| `running` | 어떤 모드 세션이 일하는 중 | 적음 (`start`) — 앞 실행이 넘기면 다음 `start` 까지도 running |
| `awaiting_approval` | 마지막 단계의 결과가 PR 로 열렸고 병합 전 | **계산** — PR 이 있고 지문이 붙음 |
| `applying` | 병합됨, 재관측 · baseline 확인 중 | **계산** — 4.3 의 승인 증거 |
| `completed` | 끝 | **계산** — 끝나는 조건의 증거가 모두 있음 |
| `blocked` | 막힘 — 사람이 봐야 함 | 적음 (`block`) 또는 계산 (한도 넘김) |
| `cancelled` | 취소 | 적음 (`cancel`, 사용자 결정 번호 필요) |

끝의 종류 (`completed` 의 부속): `ok` · `with_finding`(관찰과 안 맞음 — 고치지 않고 기록, RULE-0039) · `gap_registered`(DATA_GAP 한계 등록, RULE-0040) · `needs_user`(develop 요청 등 사용자 일) · 그리고 `cancelled` 상태.

재작업은 상태가 아니라 **실행 시도 횟수** — 같은 모드의 run 이 늘어난다.

### 4.2 전이표

| 전이 | 사건 | 누가 적나 | 필요한 것 |
|---|---|---|---|
| — → planned | `propose` | 사용자가 시작한 세션 (어느 모드든, 공통 구역) | `plan_item` · 사용자 결정 번호 (DEC 또는 open 해소) |
| planned → running | `start` (run 하나) | **그 실행 세션 자신** | 모드를 연 뒤 (`gate open`) · 진행 중인 run 이 없음 |
| running → running | `handoff` 뒤 다음 `start` | 넘기는 세션 · 다음 세션 | 전환 기록 순번 · 앞 run 의 `verify` 통과 |
| running → awaiting_approval | (계산) | — | 마지막 단계 PR · 승인 묶음 지문 |
| awaiting_approval → applying | (계산) | — | 4.3 |
| applying → completed | (계산) | — | 끝나는 조건의 증거 · baseline 세션의 `finish --full` 영수증 (main 커밋 위) |
| any → blocked | `block` | 실행 세션 · 또는 계산(재시도 · 시간 한도) | 원인 태그 |
| blocked → running | `start` | 실행 세션 | 사용자 결정 번호 (막힌 까닭을 푼 결정) |
| planned · blocked → cancelled | `cancel` | 사용자가 시작한 세션 | 사용자 결정 번호 |

### 4.3 승인 증거 — 사람만 만들 수 있는 것 [정함 — DEC-0069]

| 겹 | 무엇 | 지금 |
|---|---|---|
| ① | 승인 묶음 지문(`judicial/approval.js` digest)과 같은 바이트가 origin/main 의 어떤 커밋에 **처음** 나타남 (머지 · 스쿼시 · 리베이스 무관) | PLAN-102 |
| ② | 그 병합을 AI 가 할 수 없음 — `.claude/settings.json` deny 에 PR 병합 도구 (Claude Code 안) | **PLAN-113 — 사용자 커밋 대기.** 그 전에는 ① 만으로 사람 승인이 아님 (DEC-0068: AI 의 병합도 merged_by 가 사람 계정으로 남음) |
| ③ | 실행 환경 밖의 겹 — CI 가 구역 밖 변경을 거부 · GitHub main 보호 | PLAN-114 · 열린 질문 (사용자 판단) |
| ④ (나중) | 높은 위험 변경(권한 · 판정 기준 · 탐지기 보호)은 사용자 기기 키 서명 | 열린 질문 "사람 승인의 증명" |

승인으로 **치지 않는 것**: accept 도장의 `by: human` (RP1) · `BIODB_ROLE` · MCP 역할 · AI 가 쓴 결정 기록의 문장 · 하위 에이전트의 검토.

### 4.4 금지 전이 · 금지 사건 [정함]

| 금지 | 까닭 | 장부 검사 (PLAN-100) |
|---|---|---|
| `approve` · `approved` 사건 | 승인은 계산 | 그런 사건 이름은 거부 |
| planned → completed (실행 없이) | 증거 없는 완료 | 거부 |
| running 인 run 이 있는데 또 `start` | 중복 실행 | 거부 |
| 모드를 열지 않은 세션의 `start` | 한 세션 = 한 모드 | 거부 (세션의 열린 모드와 run 의 mode 가 같아야) |
| run 의 mode 와 다른 모드의 쓰기 | 문지기가 막음 | 문지기 (훅) · CI 겹 (114) |
| 실행 세션이 아닌 쪽이 run 사건을 적음 | 자기 사건만 | 세션 번호 대조 |
| `cancel` · blocked 해제 · propose 에 사용자 결정 번호 없음 | 사람의 결정 | 거부 |
| 같은 세션이 만든 결과를 같은 세션(또는 그 하위 에이전트)이 inspect | 독립성 | 거부 — inspect run 의 세션 ≠ author run 의 세션 |
| 계약에 범위 · 승인 칸을 씀 | 3.3 | 모르는 칸 거부 |

### 4.5 막힘의 두 종류 · 검수 독립성 · 승인 보고서 [정함 — DEC-0077, PLAN-116 G2–G4]

| 무엇 | 정한 것 | 자리 |
|---|---|---|
| 막힘 두 종류 | 원인 태그 일곱을 **거부**(deny — 필수 검증 실패 · 결함: ENGINE_DEFECT · COMPILER_DEFECT · EXEC_FAILURE)와 **보류**(hold — 근거 부족 · 해석 불확실 · 검증 불일치 · 원인 모름: FINDING · DATA_GAP · DOMAIN_CONFLICT · NUMERICAL)로. 사건 형식은 그대로 | `rebuild/supervise.mjs` CAUSE_KIND |
| 검수 독립성 | 다섯 요소 — 역할(검수 모드 ≠ 작성 모드) · 권한(쓰기 자리가 겹치지 않음, 보고서 자리 빼고) · 실행(세션 ≠) · 정보 접근(검수 영수증에 원문 자리 호출이 있음 — 추정) · 판단 근거(작성 패치의 PMID 를 검수 영수증이 모두 가리킴 — 추정). 다섯 다 → full · 하나라도 아님 → limited · 셀 수 없음 → unknown | `judicial/supervise_approval.js` independence |
| 승인 보고서 | 제안서 §8 의 12 칸(작업 목적 · 실행 내역 · 변경 내역 · 근거 · 검증 · 독립 검수 · 절차 감사 · 실패 이력 · 미해결 · 영향 분석 · 승인 대상 · 최종 권고)을 읽기 명령이 계산 — Supervisor 는 보여 주기만(§5 그대로) | `node rebuild/supervise.mjs report <SUP-…>` |
| 검수 · 넘김 기록 (DEC-0079) | 감독 장부 · 전환 기록은 덧붙이기만 — 모드를 선언한 커밋이 기존 줄을 고치거나 지우면 CI 구역 점검이 거부(줄 순서만 바뀐 것은 통과 · 사람의 커밋은 알리기만 — 사람 = push · PR 을 일으킨 계정이 부모 커밋 `.github/CODEOWNERS` 의 @계정, 그 밖의 계정이 민 선언 없는 커밋은 거부 RULE-0551). 문지기 쪽 검사는 아직 없음 | `rebuild/ci-zone.mjs` appendOnly · RULE-0544 |
| 도장 등록부 권한 (DEC-0078) | author 와 inspect 가 `attestations/**` 를 함께 쓴다 — 모드표 `stamps` 로 낼 수 있는 도장 종류를 나눔(author: verified · trend / inspect: accept) · 승인 도장은 누구도 지우거나 바꾸지 못함 · 새 승인 도장의 승인자는 integrator 만(RULE-0546 — 셸로 by: human 을 써 넣는 길) · 강제는 CI 구역 점검(`rebuild/ci-zone.mjs`)과 문지기 도구 뒤 대조(승인 묶음). 독립성의 권한 요소는 두 모드가 `stamps` 를 선언했고 겹치지 않을 때만 그 자리를 갈린 것으로 — 정책이 없으면 그대로 limited | `judicial/attestation.js` registryPolicy · RULE-0542 |
| 최종 권고 | 규칙으로: 막힘 거부 → deny · 막힘 보류 · 검수 전 · **검수 뒤에 작성이 더 넘김** · 독립성 limited · **독립성 unknown** · 판정 못 함 → hold (DEC-0079 · RULE-0543) · 끝내기 실패 → deny · 병합 전 + 나머지 → mergeable(사용자 결정) · 승인됨 → approved. **승인이 아니다** — 병합 = 사람 | `judicial/supervise_approval.js` recommend |

---

## 5. 누가 무엇을 쓰나

| 주체 | 쓰는 것 | 안 쓰는 것 |
|---|---|---|
| **Supervisor** (사용자와 대화하는 상위 세션) | **아무것도 쓰지 않음** (DEC-0065 ①) — 장부를 읽고, 세션을 띄우고, 메시지를 보냄 | 장부 · 코드 · 데이터 |
| 사용자가 시작한 세션 | `propose` · `cancel` (사용자 결정 번호와 함께) | run 사건 |
| 실행 세션 (모드 하나) | 자기 run 의 `start` · `handoff` · `block` | 다른 run 의 사건 |
| 사용자 | 결정 · PR 병합 · 설정 커밋 | — |
| 생성기 | 지금 상태 · 상위 작업 읽기 (장부를 접은 생성물) | 원본 |

장부 규칙 [정함]: 덧붙이기만 · 줄마다 `at` · `by`(executor · 세션) · `why` · 사건 번호는 **순번 대신 `<세션 앞 8 자>-<차례>`** (두 브랜치가 합쳐도 겹치지 않게 — 가상 실행 F8) · 접기는 결정적(같은 장부 → 같은 상태).

---

## 6. 한 바퀴 (Claude Code 실행 모듈 · 손으로 — PLAN-103)

| 차례 | 누가 | 무엇 | 남는 것 |
|---|---|---|---|
| 1 | 사용자 + 사용자가 시작한 세션 | `propose` (plan_item · 결정 번호) | planned |
| 2 | Supervisor | 클라우드 세션을 새로 띄우고 전환 기록 · 계약을 첫 지시로 | — |
| 3 | 실행 세션 (author) | `gate open author` → `start` → 일 → `gate finish author --full` → 커밋 · 자기 브랜치 push → 전환 기록 → `handoff` → Supervisor 에게 끝 알림 | run r1 |
| 4 | Supervisor | inspect 세션을 **새로** (r1 브랜치에서 시작) | — |
| 5 | 실행 세션 (inspect) | `gate open inspect` → `start` → 판정 · 도장 → finish → handoff | run r2 |
| 6 | (승인 PR — 첫 순환은 **사용자가 엶**, DEC-0066 F6) | PR + 승인 묶음 지문 | awaiting_approval (계산) |
| 7 | 사용자 | 병합 | applying (계산 — 4.3 ② 가 선 뒤에야 사람 승인) |
| 8 | Supervisor → baseline 세션 | main 에서 사전 등록 → 실행 → 비교 → finish --full | completed (계산) |

둘째 실행 모듈 **Human Workflow** (DEC-0070 V4): 2 · 4 · 8 의 "세션을 띄움" 을 사람이 하고, 나머지 칸은 같다 — 결과 칸이 같은 모양인지 확인하는 것이 PLAN-103 의 끝나는 조건.

---

## 7. 기존 체계는 그대로 — 대조표

| 기존 [사실] | 역할 | 감독과의 연결 | 바뀌나 |
|---|---|---|---|
| `workspace/tasks/TASK-*.md` | 수집가 묶음 과제 | `inputs` 가 가리킬 수 있음 | 안 바뀜 |
| `workspace/handoff/` | 수집 후보 · 상태 | 참조만 | 안 바뀜 |
| `workspace/transitions.jsonl` | 모드 인계 (칸 7, 사법부 검사) | run 의 `transition_seq` 가 가리킴 — 연결 방향은 감독 → 전환 | 선택 칸 `sup`(상위 작업 번호) 하나만 더함 (DEC-0081) — 넘김이 다른 상위 작업의 전환 기록을 가리키면 장부 검사가 거부(RULE-0545), sup 없는 옛 기록은 보고서에 '연결 확인 못 함' |
| `workspace/receipts/` | 도구 호출 영수증 (문지기 훅) | run 의 `receipt` 가 가리킴 | 안 바뀜 |
| `rebuild/gate.mjs` | 모드 · 쓰기 통제 · 끝내기 검사 | `start` 의 전제 · `verify` 의 출처 | 안 바뀜 (우회 금지) |
| 계획 장부 | 계획 · 결정 · 순서 | `plan_item` · 결정 번호 | 안 바뀜 |
| 권한 장부 · 모드 표 | 권한 | 범위는 여기서 계산 | 안 바뀜 |
| 사법부 · 서기 · 관문 | 판정 · 쓰기 | 실행 세션이 평소대로 | 안 바뀜 |
| `orchestrator.js` | 시뮬레이션 조정자 | 관계 없음 | 안 바뀜 |

---

## 8. 열린 것 [열림]

| 무엇 | 어디서 정하나 |
|---|---|
| 감독 장부 파일 이름 · 사건 이름 목록 확정 | PLAN-100 |
| 시간 제한 값 · 정지 스위치의 자리 | PLAN-104 |
| 모드 선언을 커밋에 싣는 방법 (CI 겹) | PLAN-114 |
| 끝 알림의 형식 (세션 → Supervisor 메시지) | PLAN-103 |
| `needs_user` 가 된 상위 작업을 다시 여는 규칙 | PLAN-103 결과를 보고 |
| GitHub main 보호 | 사용자 (열린 질문) |
