# 독립형 Project Orchestrator 전환 검토 — Claude Code 를 교체 가능한 실행 모듈로 (조사 · 설계, READ-ONLY)

> 2026-11-21 · develop 모드 · 기존 코드 · 장부 · 권한 · 설정 · 레지스트리는 바꾸지 않았다(이 보고서 외의 같은 날 계획 기록 DEC-0066 – 0069 는 사용자 결정의 기록).
> 앞선 보고서: `2026-11-21-self-improvement-loop-minimal.md`(최소판 · RP1 · RP2) · `project-management-system-audit.md`(구조).
> 표기 — **[사실]** 저장소 · 코드 · 기록으로 확인 · **[제안]** 설계 제안 · **[가설]** 검증 필요 · **[결정]** 사용자 결정 필요 · **UNKNOWN**.

---

## 0. 결론

| 질문 | 답 | 근거 |
|---|---|---|
| 이 방향은 지금 체계와 양립하나 | **예 — 대부분은 이미 그 모양이다.** 프로젝트 상태(장부 · 데이터 · 전환 기록 · 결정)는 저장소에 있고, 도구(dbtool · MCP 넷)와 판정(사법부 · 시험 · CI)은 Claude Code 와 무관한 Node 코드다 | [사실] 2 · 3 장 |
| 무엇이 Claude Code 에 묶여 있나 | **Governor 의 바깥 문(문지기 · 설정 권한 · 영수증)** 과 Supervisor 의 손(클라우드 세션 · 예약 작업 · GitHub 앱) | [사실] 1 장 — `rebuild/gate.mjs` 는 Claude Code 훅 입력(`tool_name` · `tool_input` · `session_id`)으로만 끼어든다 |
| 가장 큰 위험 | **훅을 읽지 않는 실행 환경은 문지기를 그냥 지나간다.** CI 는 문지기를 돌리지 않는다. 그래서 다른 AI 를 붙이면 "한 세션 = 한 모드 · 쓰기 구역" 이 지켜진다는 보장이 사라진다 | [사실] `check.yml` · 세션 시작 안내문("훅이 꺼져 있으면 아무것도 막히지 않는다") |
| 선결 조건 | RP1 · RP2 + **AI 의 PR 병합(DEC-0068, PLAN-113)** + **Governor 를 실행 환경 밖(CI · GitHub)으로 한 겹 더** | 8 장 |
| 최소 구현 | 새 Task Contract 를 따로 만들지 않는다 — **감독 장부(PLAN-100)의 실행 기록이 곧 Task Contract** 다. 두 번째 실행 모듈은 다른 AI 보다 **사람 작업 흐름(Human Workflow) 어댑터** 가 먼저 (계약을 싸게 시험) | 10 장 |
| 연구 목표 보호 | 이 전환은 개발체계 축의 일이다. DEC-0066 E3(2 사이클) 기준으로 **방향(DIR)으로 기록하고, 지금 구현은 PLAN-099 · 100 의 칸 모양에만 반영** 하기를 권한다 | 6.2 장 (최소판 보고서) |

---

## 1. Claude Code 에 의존하는 요소 [사실]

| # | 요소 | 무엇에 묶였나 | 깊이 | 다른 환경으로 옮기면 |
|---|---|---|---|---|
| C1 | **문지기 훅** `.claude/settings.json` hooks (SessionStart · PreToolUse · PostToolUse · Stop) → `node rebuild/gate.mjs hook <ev>` | Claude Code 훅 규약 · `$CLAUDE_PROJECT_DIR` · 입력 JSON 의 `tool_name` · `tool_input` · `session_id` (`gate.mjs` 80 · 191 행) | **깊음 — 쓰기 통제의 바깥 문** | 그 환경의 훅으로 같은 `gate.mjs` 를 부르는 얇은 변환이 있으면 재사용 [가설] · 없으면 문지기 없음 |
| C2 | 도구 이름 | `Bash · Edit · Write · MultiEdit · NotebookEdit · mcp__<서버>__<도구>` (`gate.mjs` MCP_RE) | 중간 | 이름 대응표 |
| C3 | 세션 상태 (열린 모드) | 임시 폴더에 세션 번호별로 (`gate.mjs` scratch — `tmpdir()` · `session_id`) | 중간 | 세션 번호를 주는 쪽이 필요 |
| C4 | 영수증 | 훅이 도구 호출마다 적고 커밋 때 저장소에 실음 | 깊음 (감사) | 훅 없으면 영수증 없음 |
| C5 | 설정 권한 | `permissions.allow · ask · deny` — Claude Code 문법 · 권한 장부(PERM)와 대조(RULE-0521) | 깊음 (권한) | 다른 환경엔 없음 — PERM 장부는 남음 |
| C6 | 스킬 5 | `.claude/skills/<모드>/SKILL.md` — 생성물 | 얕음 — **같은 내용이 `docs/modes/<모드>.md` 로도 생성됨** | 그대로 문서로 |
| C7 | 입구 문서 | `CLAUDE.md` — Claude Code 가 자동으로 읽음 (내용은 평범한 마크다운 · 생성물) | 얕음 | 같은 생성기로 다른 이름의 입구를 만들 수 있음 [가설] |
| C8 | `verify-run` | 하위 에이전트 transcript (harness 내부 JSONL — 코드 주석: "계약이 아니다", best-effort) | 얕음 (보조) | 쓸 수 없음 — 이미 "미인식 = 통과 아님" |
| C9 | Supervisor 의 손 | 클라우드 세션 도구(create_session · send_message · get_session) · claude.ai 예약 작업(`trig_…`) | 깊음 (조율) — 저장소 밖 | 다른 실행기 · 큐 |
| C10 | GitHub 접근 | Claude GitHub 앱 MCP (PR · 병합 — **merged_by 가 사용자 계정으로 남음**, DEC-0068) | 깊음 (승인) | 각 환경의 GitHub 연결 |
| C11 | 커밋 꼬리말 | `Co-Authored-By` · `Claude-Session` | 얕음 (표시) | 행위자 표시로 일반화 (PLAN-090) |
| — | Subagents · Agent Teams | **저장소 설정 없음** (`.claude/` 에 settings · skills 만). 세션 안의 도우미로만 쓰임 (DEC-0068) | 없음 | — |

---

## 2. Claude Code 와 독립적으로 이미 있는 요소 [사실]

| 요소 | 자리 | 독립성 |
|---|---|---|
| 프로젝트 지식 · 데이터 | `data/db.json` · 가정 · 사전 등록 · 사전 · 수신함 · 도장 등록부 | git 파일 — 어떤 실행 환경이든 읽음 |
| 계획 · 결정 · 순서 | `rebuild/state/plans.jsonl` · `plan-log.jsonl` · `plan.mjs` · `read.mjs` | Node CLI |
| 규칙 · 명령 · 권한 장부 | `rebuild/rules/*.jsonl` · `modes.json` | 파일 (집행은 C1 · C5 에 기댐) |
| 세션 인계 | `workspace/transitions.jsonl` (칸 7, 사법부 검사) | 파일 · CLI (`dbtool transition`) |
| 도구 | `dbtool.mjs` 명령 36 | Node CLI |
| MCP 서버 넷 · 도구 32 | `mcp/*.mjs` — 표준 입출력 JSON-RPC 2.0, MCP 판 `2025-06-18 · 2025-03-26 · 2024-11-05`, 외부 패키지 없음 | 열린 규약 — 다른 MCP 클라이언트에서 쓸 수 있는지는 [가설] (시험 안 함) |
| 판정 · 쓰기 · 계산 | `judicial/` · `legislative/clerk.mjs` · `core.js` · `compiler/` · `engine/` (Rust/WASM 포함) | 순수 코드 |
| 시험 · 래칫 · 변이 시험 | `tests/` 500 · `FLOOR.json` · `tests/mutation/` | Node |
| CI | `.github/workflows/check.yml` | GitHub — **AI 와 무관한 유일한 서버 쪽 검사** |
| 끝내기 검사 묶음 | `node rebuild/gate.mjs finish <모드>` | 명령 자체는 훅 없이 돌 수 있음. 단 "통과해야 커밋이 열림" 은 훅(C1)이 막음 |
| 생성 문서 | `docs/modes/*.md` · `docs/plan/*` · `rebuild/status/*` | 파일 |

---

## 3. 5 모드 · 세션 전환 구조 ↔ 목표 구조 대응표

| 지금 [사실] | 목표 구조의 자리 | 남는 것 · 바뀌는 것 [제안] |
|---|---|---|
| 세션 생성 (사람 · 클라우드 도구) | Supervisor → 어댑터가 실행 환경에 세션을 만듦 | 세션 생성은 어댑터의 일 |
| `gate open <모드>` | 작업 계약의 "모드 · 허용 범위" | **그대로** — 어느 실행 환경이든 첫 일은 모드 열기 |
| 모드별 쓰기 구역 (`modes.json` gate) | Governor 의 범위 정의 | 그대로 — 집행 자리를 하나 더(CI) |
| 전환 기록 확인 | 계약의 "입력 자료" | 그대로 (전환 기록 = 다음 세션 프롬프트) |
| 작업 수행 | Developer | 실행 환경 무관 |
| `gate finish` | Validator 1 겹 (로컬) | 그대로 + CI 에서 같은 묶음 (8 장) |
| 결과 · 전환 기록 작성 | 공통 결과 계약 | 그대로 + 감독 장부의 run 기록 |
| 다음 세션으로 상태 전달 | 상태는 장부에 — 세션은 일시적 | **이미 그러함** (State Independence) |
| 영수증 | 실행 증거 | 실행 환경마다 영수증을 남기는 방법이 필요 (C4) |
| 사람 병합 | Governor 최종 승인 | 그대로 + PLAN-113(AI 병합 막음) · 서명(나중) |

5 모드는 **실행 환경이 아니라 권한 범위** 다 — 목표 구조에서도 그대로 Governor 쪽에 남고, 어댑터는 "어느 모드로 여나" 를 받아 지킨다 [제안].

---

## 4. MCP 서버 · 도구의 재사용

| 서버 | 재사용 | 조건 |
|---|---|---|
| `query` (12) · `run` (3) | **그대로** — 읽기 전용, 어느 실행 모듈이든 같은 답 | 세션에 꽂는 설정이 없음 (PLAN-105) |
| `fetch` (7) | 그대로 — 받기 기록 사슬이 증거 | 실행 환경의 네트워크 허용 |
| `clerk` (10) | 그대로 — 유일한 쓰기 문 · 단일 작성자 잠금 | **역할을 켜는 쪽이 스스로 적음** (RP1) → 역할은 열린 모드에서 계산(PLAN-105) |
| 감독 도구 (계획) | `query.orch_status` · `clerk.orch_event` (PLAN-100 · 105) | 실행 모듈 독립의 핵심 연결 — 어떤 AI 든 이 도구로 run 을 시작 · 넘김 |
| 실행 모듈 독립의 뜻 [제안] | MCP 가 "공통 도구 및 프로젝트 자산" 칸 — 실행 모듈이 바뀌어도 도구가 같으면 결과가 같아야 함 | 같은 시나리오 → 같은 출처 꼬리표(db · IR · 코드 지문)를 run 이 이미 붙임 |

---

## 5. 공통 Task Contract — 최소 필수 스키마 [제안]

**새 장부를 만들지 않는다.** 감독 장부(PLAN-100)의 상위 작업 · 실행(run) 기록과 기존 계획 작업 · 전환 기록을 합친 것이 계약이다.

| 칸 | 뜻 | 값의 출처 (기존) | 필수 |
|---|---|---|---|
| `task` | 상위 작업 번호 (SUP-… — PLAN-099 에서 확정) | 감독 장부 | ✔ |
| `plan_item` | 계획 작업 번호 (PLAN · ASY · STG) | 계획 장부 | ✔ |
| `purpose` | 한 줄 목적 | 계획 작업 · 결정 | ✔ |
| `inputs` | 전환 기록 순번 · 파일 · 번호(T · D · S · L · O · V · A · RULE) | `transitions.jsonl` 칸 그대로 | ✔ |
| `mode` | 다섯 중 하나 | `modes.json` | ✔ |
| `scope` | 쓸 수 있는 자리 · 명령 — **모드에서 계산, 계약에 따로 적지 않음** (적으면 넓힐 수 있음) | `modes.json` gate · 명령 장부 | 계산 |
| `done_when` | 끝나는 조건 | 계획 작업 칸 | ✔ |
| `verify` | 검증 묶음 — `gate finish <모드> --full` + 지정 시험 | `modes.json` finish | ✔ |
| `outputs` | 브랜치 · PR · 전환 기록 순번 · 보고서 | 결과 계약 | ✔ |
| `evidence` | 시험 통과 · CI 커밋 · 영수증 · 병합 커밋 | gate · CI · git | ✔ |
| `executor` | 실행 모듈 (claude-code · human · …) · 세션 번호 | 어댑터 | ✔ |
| `state` | planned · running · awaiting_approval · applying · completed · blocked · cancelled | PLAN-099 | ✔ |
| `failure` | 중단 · 재시도 수 · 원인 태그 (FINDING · DATA_GAP · DOMAIN_CONFLICT · NUMERICAL · ENGINE/COMPILER_DEFECT) | 결함 태그 규칙 | 실패 때 |

| 원칙 | 까닭 |
|---|---|
| 권한 범위는 계약에 적지 않고 모드에서 계산 | 계약을 쓰는 쪽(AI)이 범위를 넓히지 못하게 (RULE-0461) |
| 승인 칸 없음 | 승인은 증거에서 계산 (PLAN-102 · DEC-0069) |
| 결과 계약 = 같은 칸의 뒤쪽 절반 | 형식 하나 |

---

## 6. AI Adapter — 책임과 인터페이스 [제안]

| 책임 | 내용 | 하지 않는 것 |
|---|---|---|
| A1 열기 | 계약 → 실행 환경의 세션 + 첫 지시(전환 기록 · 모드 · 끝나는 조건) | 모드를 대신 고르기 |
| A2 문지기 잇기 | 그 환경이 훅을 주면 `gate.mjs hook` 으로 · 못 주면 **"집행 없음" 을 계약에 표시** 하고 CI 겹을 필수로 | 집행 없는 환경을 있는 것처럼 보고 |
| A3 거두기 | 브랜치 · PR · 전환 기록 · 영수증(있으면) → 결과 계약 | 결과 해석 · 판정 |
| A4 실패 알리기 | 시간 초과 · 형식 틀림 · 결과 없음 → `failure` | 재시도 정책 결정 (Supervisor 의 일) |
| A5 정체 표시 | executor · 세션 번호 · 커밋 꼬리말 | 사람인 척 (RP1 · DEC-0068) |

인터페이스 (개념):

```text
open(contract)            → { executor, session, branch }
status(session)           → running | done | failed | unknown
collect(session)          → result-contract (outputs · evidence · failure)
enforcement()             → { hooks: yes|no, receipts: yes|no }   ← A2 의 정직한 표시
```

| 어댑터 | 지금 있는 것 [사실] | 빈 곳 |
|---|---|---|
| Claude Code | 클라우드 세션 도구 · 훅 · 영수증 · 전환 기록 프롬프트 (PLAN-103 의 손 순환) | 계약 형식 · 끝 신호(가상 실행 F5) |
| **Human Workflow** | 사람이 세션을 열고 전환 기록을 읽음 (지금 방식) · GitHub 웹 커밋(STG-12) | 계약 형식만 — **가장 싸게 계약을 시험** [제안] |
| 다른 AI (예: Codex) | 없음 | 훅 · 설정 · MCP 연결 · 네트워크 — **호환 여부 UNKNOWN** (확인하지 않음) |

---

## 7. Supervisor 와 기존 세션 관리체계

| | 관계 [제안 — DEC-0068 을 따름] |
|---|---|
| 세션 | Supervisor 는 세션을 **띄우고 잇기만**. 각 세션은 스스로 `gate open` — Supervisor 가 대신 열지 않음 |
| 전환 기록 | 그대로 — 감독 장부는 전환 순번을 **가리키기만** (전환 형식 불변, F4) |
| 계획 장부 | 계약의 `plan_item` 으로 가리킴 · 상태를 이중으로 적지 않음 |
| Claude 내장 조율 | 실행 모듈 **안쪽** 의 도우미 — Supervisor 의 상태 · 권한을 대신하지 않음 |
| 사용자 인터페이스 | 지금 Supervisor 의 대화 창구는 claude.ai 앱(C9) — **목표의 "웹 · 모바일" 은 이미 있으나 Claude 에 묶임**. CLI 창구는 `dbtool supervise`(PLAN-100) 로 독립 |
| 우회 금지 | Supervisor 도 계획 장부 · 세션 체계를 우회하지 않음 · 쓰지 않는 세션 (DEC-0065 ①) |

---

## 8. 보안 · 동시성 선결 조건

| # | 조건 | 왜 여러 AI 에서 더 커지나 | 계획 |
|---|---|---|---|
| S1 | **RP1** 승인 위조 | 실행 모듈이 늘수록 "human" 을 적는 쪽이 늘어남 | PLAN-106 |
| S2 | **RP2** 갱신 · 번호 · seq 충돌 | 동시 실행 모듈 = 동시 브랜치 | PLAN-081 · 111 |
| S3 | **AI 의 PR 병합** (DEC-0068) | 모든 실행 모듈이 같은 사용자 계정으로 GitHub 에 닿으면 병합이 구분 안 됨 | PLAN-113 (Claude Code 안 — 설정 deny) |
| **S4** | **Governor 를 실행 환경 밖에 한 겹** — 설정 deny · 문지기 훅은 Claude Code 안에서만 걸림 [사실] | 다른 실행 모듈은 훅 · 설정을 읽지 않음 | **새 [제안]**: ① CI 가 커밋마다 "선언된 모드의 쓰기 구역 밖 변경" 을 거부 (모드 선언을 커밋에 싣는 방법 필요 — 영수증 또는 꼬리말 [가설]) ② GitHub 쪽 보호(main 직접 push 금지 · 필수 검사 · 병합 권한) — 저장소 설정이라 **사용자 결정** |
| S5 | 탐지기 보호 | 실행 모듈마다 탐지기를 고칠 수 있음 | PLAN-108 |
| S6 | 결과 형식 틀림 · 누락 | 실행 모듈마다 결과 모양이 다름 | 계약 + 어댑터 A3 · A4 |
| S7 | 한 서비스 장애 | 실행 모듈 하나가 멈춰도 상태는 장부에 → 다른 모듈 · 사람이 이어 받음 | 이미 State Independence |

---

## 9. 다른 실행 환경으로 전환하는 실현 가능성

| 층 | 옮기기 | 근거 |
|---|---|---|
| 지식 · 상태 · 판정 · 도구 · CI | **됨** [사실] — Node · git · 파일 | 2 장 |
| MCP 도구 | 될 것 [가설] — 열린 규약 · 외부 패키지 없음 · 다른 클라이언트로 시험 안 함 | 4 장 |
| 모드 문서 · 입구 | 됨 [사실] — 생성물 · 평범한 마크다운 | C6 · C7 |
| **쓰기 통제 · 영수증** | **환경에 달림** — 훅을 주는 환경이면 같은 `gate.mjs` 를 잇는 변환, 아니면 CI 겹(S4)만 | C1 · C4 |
| 설정 권한 | 안 됨 — Claude Code 문법. 권한 장부(PERM)는 남으니 다른 환경의 형식으로 다시 만드는 생성기 [가설] | C5 |
| 조율 손 · 예약 작업 | 안 됨 (claude.ai) — 다른 실행기 필요 | C9 |
| 특정 AI(Codex 등)와의 호환 | **UNKNOWN** — 이 보고서는 다른 제품의 훅 · 설정 · MCP 지원을 확인하지 않았다 | — |

---

## 10. 최소 구현안과 단계별 검증 기준

### 10.1 최소 구현 — 이미 계획된 것에 칸만 맞춤 [제안]

| 무엇 | 어디에 | 추가 비용 |
|---|---|---|
| 감독 장부의 run 기록을 5 장 계약 모양으로 | PLAN-099 · 100 | 칸 설계만 |
| `executor` · `enforcement` 칸 | PLAN-100 | 칸 둘 |
| 첫 어댑터 = Claude Code (PLAN-103 손 순환) · 둘째 = Human Workflow | PLAN-103 | 문서 |
| CI 겹(S4 ①) | 새 작업 후보 — **사용자 결정** | 중간 |
| 다른 AI 어댑터 · 웹 · 모바일 독립 창구 | **방향(DIR)으로만** | — |

### 10.2 요청서의 6 단계 ↔ 지금 계획

| 요청서 단계 | 지금 계획의 자리 | 검증 기준 [제안] |
|---|---|---|
| 1 기존 구조 조사 | **이 보고서** | 1 · 2 장 표 · 사용자 확인 |
| 2 공통 작업 규약 | PLAN-099 · 100 (계약 = 감독 장부 run) | 계약 하나로 run 시작 · 넘김 · 끝이 장부에서 되짚힘 · 승인 칸 없음 · 범위는 모드에서 계산 |
| 3 실행 환경 분리 (Claude Code 어댑터) | PLAN-103 + PLAN-105 | 첫 순환을 계약으로 돌림 · 결과 계약이 영수증 · 전환 · 병합을 가리킴 |
| 4 교체 가능성 | **Human Workflow 어댑터 먼저**, 그 뒤 다른 AI [제안] | 같은 계약을 두 실행 모듈이 처리 → 상태 · 권한 · 산출물 · 증거 칸이 같은 모양 · 같은 검증 묶음 통과. 집행 없는 모듈은 `enforcement: no` 로 드러나고 CI 겹에서 걸림 |
| 5 독립 인터페이스 | CLI = `dbtool supervise` (PLAN-100) · 웹 · 모바일은 방향 | CLI 만으로 상위 작업 하나를 열고 닫음 |
| 6 멀티 에이전트 조율 | PLAN-104 (선행 106 · 081 · 111 · 113 · S4) | 두 실행 모듈 동시 — 번호 충돌 0 · 승인 위조 0 · 구역 밖 쓰기 0 |

### 10.3 연구 목표와의 순서 [추론]

이 전환은 개발체계 축이다. 지금 순서(DEC-0067)는 이미 조율 → RP → **과학 한 걸음(PLAN-112)** → 자동화다. 이 보고서의 제안은 순서에 새 큰 작업을 넣지 않고 **099 · 100 · 103 의 칸 모양** 과 **방향 기록** 으로 흡수하기를 권한다. 다른 AI 어댑터 · 웹 창구는 PLAN-112(D000051) 이 한 번 돈 뒤에 다시 연다.

---

## 11. 정할 것

| # | 질문 | 선택지 | 권장 |
|---|---|---|---|
| V1 | 이 방향을 계획에 어떻게 올릴까 | 방향(DIR) 기록 + 099 · 100 칸에 반영 / 새 부(部)로 작업들 | DIR + 칸 반영 |
| V2 | Governor 의 CI 겹(S4 ①) 을 작업으로 둘까 | 예 (PLAN-104 의 선행) / 나중 | 예 |
| V3 | GitHub 쪽 보호(S4 ② — main 보호 · 필수 검사) | 사용자가 저장소 설정에서 / 나중 | 사용자 판단 — 저장소 설정은 이 세션이 바꾸지 않음 |
| V4 | 둘째 실행 모듈 | Human Workflow 먼저 / 다른 AI 먼저 | Human Workflow |
| V5 | 입구 문서를 다른 AI 용 이름으로도 생성할까 | 지금 / 둘째 AI 를 붙일 때 | 붙일 때 (빈 장치 금지, RULE-0462) |
