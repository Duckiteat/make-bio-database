# 오케스트레이터 설계 연구 — 병렬 실행 · 조율 · 통합 체계 (2026-11-24, 설계 · 조사)

> develop 모드 · 사용자 지시서 "ORCHESTRATOR ARCHITECTURE — 병렬 실행·조율·통합 체계 설계 지시서"(채팅, 2026-11-24)에 따른 **설계 연구**다. 코드 · 장부 · 권한 · 설정 · 데이터는 바꾸지 않았다. 지시서 1 장대로 이 단계에서는 커밋 · 병합을 하지 않는다(이 파일은 작업 트리에만 있다).
> 함께 읽을 것: `docs/design/supervisor.md`(감독 규격 v0) · `docs/reports/2026-11-24-governance-system-map.md`(권한 · 보안 지도).
> 표기: **[사실]** 저장소 코드 · 장부 · 기록에서 이 세션이 직접 확인 · **[외부]** 외부 문헌 · 공식 문서(맨 끝 출처 목록, 이 세션이 검색으로 서지를 확인 — 본문 전체를 읽지 않은 것은 그렇게 적음) · **[제안]** 이 보고서의 설계 제안(결정 아님) · **[확인 필요]** 이 세션이 확인하지 못함 · **[결정]** 사람이 정할 것(H 장).
> 지시서 14 장의 9 단계 "독립 검토"는 **이 세션이 할 수 없다** — 하위 에이전트는 같은 세션 번호로 영수증에 남아 독립이 아니다(감독 규격 §2, [사실]). 별도 inspect 세션의 재검토가 남은 일이다(G 장 0 단계).

---

## 0. 결론 — 한 장

| # | 질문 | 답 | 근거 |
|---|---|---|---|
| 1 | 지금 오케스트레이터는 병렬을 할 수 있나 | **아니다 — 구조적으로 일렬 순환만 표현된다.** 상위 작업은 모드의 차례(`steps`) 하나이고, 완료 계산은 "모드마다 넘김 한 번"이며, 승인 판정은 **마지막 넘김 run 하나의 끝 커밋** 만 본다 | [사실] `rebuild/supervise.mjs` evidence() · `judicial/supervise_approval.js` derive() |
| 2 | 병렬을 가로막는 가장 큰 것 | ① 장부가 **브랜치마다 따로** 있어 병렬 세션이 서로의 claim 을 못 본다 ② 작업 그래프(DAG)가 어디에도 없다(계획 장부도 일렬 순서) ③ Supervisor 의 배정 행위가 기록되지 않는다 ④ 쓰기 잠금이 컨테이너 안에서만 유효하다 | [사실] §A.4 |
| 3 | 새 층을 지어야 하나 | **아니다 — 감독 장부를 "목표 = DAG" 로 일반화하고, 순수 함수 셋(스케줄 · 조정 · 관문)을 더하는 것으로 충분하다.** 삼권 · 서기 · 승인 증거 · Governor 는 그대로, Supervisor 는 여전히 아무것도 쓰지 않는다 | [제안] B 장 |
| 4 | 병렬의 안전 판정은 누가 | 판단(어느 작업을 같이 돌릴까)은 AI, **허용은 코드** — 계약의 쓰기 집합 · 저장 지도의 구역 등급 · 의존 그래프 · 자원 한도로 계산한 "실행 가능 집합" 안에서만 배정 | [제안] C 장 |
| 5 | 통합은 | **목표마다 통합 브랜치 하나 + 사람 승인 PR 하나.** 작업 브랜치는 통합 브랜치로 모으고, main 으로 가는 것은 목표 끝의 한 번 — 사람 승인 횟수가 작업 수가 아니라 목표 수에 비례 | [제안] D 장 |
| 6 | 장애 복구는 | Supervisor 가 쓰지 않으므로 **재시작 = 장부를 다시 접고 실제(세션 · 브랜치)와 대조** 하는 것(reconciliation). 임차(lease)는 적지 않고 계산, 늦게 돌아온 실행은 run 번호로 거부(fencing) | [제안] E 장 · [외부] Kubernetes · Gray & Cheriton |
| 7 | 검증의 유효성 | 검증 기록을 **입력의 내용 지문** 에 묶는다. 상위 작업의 산출이 바뀌면 하위 검증은 계산상 낡음 — 지금의 "검수 뒤 변경 → 보류"(RULE-0543)를 그래프 전체로 넓힌 것 | [제안] §E.5 · [외부] Mokhov 외 |
| 8 | 가장 먼저 할 것 | 독립 재검토 → **일렬 순환 하나를 Supervisor 가 실제로 띄워 끝까지**(PLAN-103 의 남은 끝나는 조건) → 그 다음 DAG 일반화. 병렬은 순차가 한 번 completed 된 뒤에만 의미가 있다 | [제안] G 장 |

---

## A. 현재 아키텍처 진단

### A.1 모듈과 책임 [사실]

| 모듈 | 자리 | 책임 | 받는 것 | 내는 것 · 쓰는 곳 |
|---|---|---|---|---|
| 감독 장부 · 명령 | `rebuild/supervise.mjs` · `rebuild/state/supervise.jsonl` | 상위 작업(SUP) · 실행 기록(run)의 덧붙이기 장부. `load` · `check` · `fold` · `admit` 은 순수 | 쓰기 사건 5: `propose · start · handoff · block · cancel <사건.json>` · 읽기 4: `status · check · report · evidence` | 장부 한 줄(서기 `appendSupervise`). `by · mode · enforcement` 는 입력으로 받지 않고 그 세션의 영수증에서 읽음(`sessionFromReceipts`) |
| 승인 판정 | `judicial/supervise_approval.js` | `judge`(main 에 같은 바이트가 처음 나타난 커밋) · `derive`(계산 상태) · `independence`(다섯 요소) · `recommend` | 감독 도구가 모은 git · 영수증 사실 | 값만 |
| 감독 규격 | `docs/design/supervisor.md` v0 | 상태 일곱 · 전이표 · 금지 전이 · 승인 증거 네 겹 · 한 바퀴 | — | — |
| 문지기 | `rebuild/gate.mjs` · 정책 `rebuild/rules/modes.json` (L6) | 한 세션 = 한 모드 · 모드 쓰기 구역 · 끝내기 검사 · 영수증 | 훅 4(`session-start · pre · post · stop` — Claude Code 가 자동 호출) · 명령 `open · finish · receipt` | 영수증 · 막음(종료 2). **훅이 예외를 내면 통과**(`gate.mjs:317`, N11) |
| 서기 | `legislative/clerk.mjs` | 쓰기의 유일한 문 · 구역(`ZONES`) · 작성자 잠금 · 비교 후 교체(`commitMerge` 의 `base_sha256`, PLAN-081) | 쓰기 함수 약 30 | 파일 |
| 작성자 잠금 | `clerk.mjs` `writerLock` | 저장소마다 작성자 하나 | — | 잠금 파일이 **운영체제 임시 폴더**(`tmpdir()`) — 같은 컨테이너 안에서만 유효 |
| 병합 사전 점검 | `rebuild/merge-check.mjs` | `git merge-tree` 로 시험 합치기 · 충돌을 "다시 만듦 · 합집합 · 도구나 손" 으로 분류 · 번호 충돌(DEC · PLAN · RULE · db 의 T D S L O V · 가정 A · 전환 seq) | 브랜치 | 종료 코드 · 목록 (읽기만, 탐지만) |
| 바뀐 것만 시험 | `tests/affected.mjs` · `tests/trace.mjs` | 시험마다 **실제로 읽은 파일**을 추적해 바뀐 입력이 있는 시험만 돌림 · 전체일 때 추적 구멍 검사 | — | 저장소 밖 지도 |
| 저장 지도 · 권한 표 | `docs/textbook/storage-map.json`(자리 242) · `docs/textbook/authority.json`(구역 40 · 등급 L0–L6 · 열쇠) | 자리마다 등급 · 구역 · 쓰는 열쇠 · 판정 열쇠 | — | — |
| 계획 장부 | `rebuild/state/plans.jsonl` · `rebuild/plan.mjs apply` | 작업(칸: 작업 · 자리 · 끝나는 조건) · 결정 · 순서 · 방향 | ops.json | **의존 칸 없음** — 순서는 `ORDER` 한 줄 목록 |
| 전환 기록 | `dbtool transition` → `workspace/transitions.jsonl` | 세션 사이 인계 `{from,to,at,why,target,files,open,sup?}` | — | 감독 장부 `handoff.transition_seq` 가 가리킴 |
| MCP | `.mcp.json` · `mcp/*.mjs` | 읽기 서버 query(12) · run(3) 연결, 역할 collector · clerk(10) · fetch(7) **연결 안 됨**(잠금 F1) | JSON-RPC stdio | — |
| CI | `.github/workflows/check.yml`(rules: ci-zone + 전체 시험 등) · `trust.yml`(independent-judge: `pull_request_target`, main 코드로 순 변경) | 구역 밖 변경 · 등록부 정책 · L6 · 판정 코드 의존 닫힘 | push · PR 이벤트 | 필수 검사 둘(규칙 세트 `main`) |
| GitHub 규칙 세트 | main | 승인 1 · 필수 검사 rules · independent-judge · **Require branches up to date** · 강제 push 막음 · 지우기 막음 · 우회 비움 | — | 봇 `daduteria`(write) 의 PR 은 사람 승인 없이 병합 불가 (PR #23 blocked) — [사실] `2026-11-24-bot-identity-check.md`, 규칙 세부는 사용자 화면 캡처에 기댐 |
| Supervisor 의 손 | 클라우드 세션 도구 `create_session · send_message · list_sessions · get_session · list_events · send_later · create_trigger` | 세션 띄우기 · 메시지 · 상태 · 예약 | — | 저장소에 아무것도 쓰지 않음 |

### A.2 실제 실행 흐름 — SUP-0001 장부 8 줄 [사실]

| 사건 | run · 모드 | 브랜치 | why 의 첫머리 |
|---|---|---|---|
| propose | — | — | 사용자 결정 DEC-0072 |
| start · handoff(#13) | r1 author | `ccr-2a8c4e06-0zo0i6` | 사용자 결정(2026-11-21) |
| start · handoff(#14) | r2 inspect | 같은 브랜치 | 사용자 요청(2026-11-22) |
| start · handoff(#16) | r3 author | 같은 브랜치 | 사용자 결정 DEC-0073 |
| cancel | — | — | 사용자 결정 DEC-0080 |

- 세 run 이 **모두 같은 브랜치** · 차례대로 · 매 start 의 이유가 사용자 결정 · 요청이다. Supervisor 가 클라우드 세션 도구로 세션을 띄웠다는 기록은 장부 구조상 남지 않는다 → **Supervisor 의 배정 경로는 실증되지 않았다 [확인 필요 — 클라우드 세션 기록 대조]**. 실제로는 "사람이 세션을 열고 전환 기록을 건네는" Human Workflow 로 돌았다고 보는 것이 장부와 맞다.
- 계산 상태 `awaiting_approval · applying · completed` 는 실제로 한 번도 도달하지 않았다(취소로 끝).

### A.3 병렬 실행의 지금 가능 범위 [사실 + 추론]

| 범위 | 지금 | 근거 |
|---|---|---|
| 서로 다른 상위 작업(SUP) 둘을 다른 세션에서 동시에 | **된다 — 단 브랜치가 달라야 하고, 합칠 때 장부 · 번호 충돌을 merge-check 가 탐지만** | 사건 번호가 `<세션 꼬리>-<차례>` 라 장부 줄은 겹치지 않음 · SUP 번호 겹침은 check 가 잡음 · db 번호(meta.next)는 브랜치마다 따로 발급돼 겹칠 수 있음(탐지만) |
| 한 상위 작업 안의 두 작업을 동시에 | **안 된다** | §A.4 ① – ③ |
| 한 세션 안의 하위 에이전트로 병렬 | 찾기 · 읽기 · 검토 보조만 — 같은 세션 · 같은 모드 · 독립 검수로 칠 수 없음 | 감독 규격 §2 |
| 읽기 전용 병렬(조회 · 엔진 실행) | 된다 — MCP query · run 은 쓰지 않음 | `.mcp.json` |

### A.4 병렬을 가로막는 구조 [사실]

| # | 구조 | 왜 막나 | 자리 |
|---|---|---|---|
| ① | 상위 작업 = 모드 차례 하나(`steps: [author, inspect, baseline]`) | 같은 모드의 작업 둘 · 갈라지고 합쳐지는 흐름을 표현 못 함 | `FIELDS.propose` · `derive()` 의 `pre.every(done)` |
| ② | 승인 판정이 **마지막 넘김 run 의 끝 커밋** 만 대상으로 | 병렬 run 들의 산출이 서로 다른 브랜치에 있으면 앞의 것은 판정에서 빠짐 | `evidence()` — `last = pre[pre.length-1]`, `tip = last.outputs.commits[...]` |
| ③ | 장부가 각 세션의 브랜치에 덧붙음 | 병렬 세션 A 의 `start` 를 세션 B 가 볼 수 없음 → 같은 작업을 둘이 잡을 수 있음(중복 배정을 막을 공유 기록이 없음) | 장부 = 저장소 파일 · 세션마다 브랜치 |
| ④ | 작성자 잠금 · 끝내기 기록이 컨테이너의 임시 폴더 | 클라우드 세션은 컨테이너가 따로라 잠금이 세션 사이에 안 걸림 | `writerLock` · `finishFile` = `tmpdir()` |
| ⑤ | 계획 장부에 의존 칸이 없음 | Planner 가 낼 DAG 를 담을 자리가 없음 | `plans.jsonl` item 칸 = 작업 · 자리 · 끝나는 조건 |
| ⑥ | Supervisor 행위 무기록 | 재시작한 Supervisor 가 "누구를 이미 띄웠나" 를 저장소에서 못 봄 | DEC-0065 ① · 사건 5 종에 배정 없음 |
| ⑦ | 끝 알림 · 시간 제한 · 정지 스위치 없음 | 사라진 실행을 알 길이 없음 | 감독 규격 §8 [열림] |
| ⑧ | main 규칙 "Require branches up to date" | PR 하나가 병합되면 나머지 PR 은 모두 다시 맞춰야 함 → main 으로의 병합은 사실상 직렬 | 규칙 세트(사용자 캡처) |

### A.5 코드 · 규격 · 장부의 불일치 [사실]

| # | 규격 | 코드 / 장부 | 영향 |
|---|---|---|---|
| 1 | "상위 작업 하나 = 통합 브랜치 하나" (§3.2) | 봇 세션은 세션마다 새 `ccr-…` 브랜치를 받는다(이 세션도) | 다음 순환부터 run 마다 브랜치가 달라짐 → ② 와 겹쳐 앞 run 산출이 판정에서 빠질 수 있음 |
| 2 | `awaiting_approval` = "PR 이 있고 지문이 붙음" (§4.1) | `derive()` 는 PR 을 보지 않음 — 넘김이 끝나고 main 에 없으면 곧 awaiting_approval | PR 이 없어도 "승인 대기" 로 보임 |
| 3 | 승인 증거 ② "AI 가 병합할 수 없음" — Claude 설정 deny (§4.3) | `judge()` 의 approved 조건 = 바이트 일치 + 그 커밋의 settings deny + 영수증에 병합 호출 없음. GitHub 의 `merged_by` · 리뷰는 보지 않음 | 봇 신원 분리(DEC-0090) 뒤의 더 강한 증거를 아직 안 씀 |
| 4 | 재시도 "기본 2 회 · [열림]" (§3.2) | `MAX_ATTEMPTS = 3`(처음 1 + 재시도 2) | 말만 다름 — 정책 칸으로 옮길 대상 |
| 5 | 한 바퀴 2 · 4 단계 "Supervisor 가 세션을 띄움" (§6) | 장부상 모든 start 가 사용자 결정 · 요청 | §A.2 |
| 6 | 덧붙이기만 — 문지기 쪽 검사는 아직 없음 (§4.5) | CI(ci-zone · RULE-0544)만 | 병렬이 되면 공유 장부 줄 고침이 늦게 잡힘 |

### A.6 기존 결정과 충돌할 수 있는 곳 [사실]

| 결정 | 내용 | 이 설계가 닿는 곳 |
|---|---|---|
| DEC-0065 ① | Supervisor 는 쓰지 않음 | 배정 기록 · 임차를 누가 적나(§E.2) — **지킨다**: 실행 세션이 자기 start 에 배정 사실을 실음 |
| DEC-0065 ② · DEC-0081 | 전환 기록 형식 불변(`sup` 한 칸만 예외) | 작업 번호를 전환 기록에 싣고 싶어짐 — **새 칸을 더하지 않고** `sup` 에 작업 번호까지 담는 방법은 형식 변경이라 [결정] |
| DEC-0067 · DEC-0074 | 자동 배정(PLAN-104)은 106 · 081 · 111 · 077 · 115 · 116 뒤 | 이 설계의 최소 구현은 104 의 일부 — 선행 순서를 지킴(G 장) |
| DEC-0069 · DEC-0090 | 병합 = 사람 계정 | 작업 브랜치 → 통합 브랜치 합치기를 봇이 해도 되나(§D.2) — **[결정]** |
| DEC-0079 · RULE-0543 | 검수 뒤 바뀐 대상은 보류 | §E.5 무효화로 일반화 — 같은 원리 |
| PLAN-104 D4 | develop · field 는 자동 배정 금지 | 스케줄러의 불변 조건으로 그대로 |
| DEC-0066 E3 (메타 편중 경보) | 개발체계 일이 과학 축을 밀어내지 않게 | 이 설계의 구현은 과학 순환(PLAN-112)을 실증 대상으로 삼는다(G 장) |

---

## B. 목표 아키텍처

### B.1 전체 구조 [제안]

```
                      사람 (Human Authority) — 목표 승인(DEC) · 사람 관문 · 통합 PR 승인 · L6 묶음
                         │ 결정 번호                                   ▲ 병합
                         ▼                                             │
  ┌─ Planner (세션, 아무 모드 — 공통 구역) ─┐                          │
  │ 목표 계획 = DAG + 계약 + 완료 조건      │── propose ──▶ 감독 장부 (조율 기록 — 덧붙이기만)
  └─────────────────────────────────────────┘                 │      ▲ 자기 사건만 (start · heartbeat? · handoff · block)
                                                               │      │
  ┌─ Supervisor (세션 — 쓰지 않음) ─────────────────────────┐ │      │
  │ fold → reconcile(실제와 대조) → schedule(실행 가능 집합) │◀┘      │
  │ → 배정(클라우드 세션 도구) · 예약 깨우기(send_later)      │──▶ Executor 세션들 (모드 1 · 계약 1 · 작업 브랜치 1)
  └──────────────────────────────────────────────────────────┘            │ push (봇)
                                                                          ▼
                          Independent Judge = 사법부 순수 함수 + CI 두 겹 + inspect 세션(다른 세션)
                                                                          │
                          통합 브랜치(목표마다 하나) ── 관문(barrier) 계산 ── 통합 PR → 사람
                          Governor = 문지기(겹 1) + CI · GitHub 규칙(겹 2) — 계약의 쓰기 집합도 여기서 대조
```

### B.2 책임 경계 [제안]

| 주체 | 하는 것 | 할 수 없는 것 | 기존 무엇에 얹나 | 강제하는 곳 |
|---|---|---|---|---|
| **Planner** | 목표 · 작업 분해 · 의미적 의존 · 입력 · 산출 · 작업별 완료 조건 · 사람 관문 · 검증 요구 · 목표 완료 조건 | 병렬 가능성 확정 · 자원 배정 · 실행 | 계획 장부(목표의 `plan_item`) + 감독 장부 `propose` 의 확장 | 계획 내용의 지문을 사람 결정(DEC)이 고정 — 바뀌면 다시 승인(§B.4) |
| **Supervisor** | 실행 가능 집합 계산 · 충돌 · 순서 · 자원 · 세션 배정 · 추적 · 조정 · 재시도 · 통합 조율 · 관문 확인 · 목표 상태 **계산** | 계획 · 완료 조건 변경 · 쓰기 · 승인 · develop · field 자동 배정 | `rebuild/supervise.mjs` 의 순수 함수 + 클라우드 세션 도구 | 계약의 계획 지문 · 스케줄 함수가 거부한 배정은 Executor 의 `start` 가 거부됨(§C.5) |
| **Executor** | 배정 작업 하나 — 모드 하나 · 계약 하나 · 작업 브랜치 하나 | 계약 밖 쓰기 · 다른 작업 변경 · 목표 완료 선언 · 자기 결과 승인 | 모드 세션 그대로 | 문지기(모드 구역) · CI(계약 쓰기 집합 — 새 판정) · 서기 |
| **Independent Judge** | 산출 · 커밋 · 시험 · 출처 · 승인 기록으로 판정 | 실행 · 쓰기 · 승인 | `judicial/*` + `trust.yml` + inspect 세션 | main 코드로 판정(pull_request_target) · 다른 세션 독립성 계산 |
| **Governor** | 강제 | 판단 | 문지기 + CI + 규칙 세트 | L6 · 사람 커밋 |
| **Human** | 목표 승인 · 사람 관문 · 통합 PR 승인 · L6 · 재계획 승인 · 취소 | — | GitHub 사람 계정 · 결정 번호 | 규칙 세트 |

**Planner 와 Supervisor 를 같은 AI 가 하면** 계획을 자기 편의대로 쪼갤 수 있다 — 그래서 경계는 사람이 아니라 **지문**으로 지킨다: Planner 의 산출(DAG + 계약 + 완료 조건)은 `propose` 한 줄에 고정되고 그 지문을 사람 결정이 가리킨다. Supervisor 의 어떤 배정도 그 지문을 바꾸지 못하며, 바꾸려면 새 `propose`(재계획) + 새 결정이다 [제안].

### B.3 모듈별 입력 · 출력 [제안]

| 모듈 (새 = ★) | 입력 | 출력 | 순수? | 자리 |
|---|---|---|---|---|
| `fold` (있음 → 넓힘) | 감독 장부 | 목표 · 작업 · run 의 적힌 상태 | 순수 | `rebuild/supervise.mjs` |
| ★ `reconcile` | fold 결과 · 세션 사실(`get_session` · `list_events` 를 Supervisor 가 모아 넘김) · git 사실(브랜치 · 커밋) | 작업마다 실제 상태(살아 있음 · 넘김 · 고아 · 임차 끝남) · 할 일 제안 | 순수 | `rebuild/supervise.mjs` |
| ★ `schedule` | reconcile 결과 · DAG · 계약(쓰기 · 읽기 집합) · 저장 지도 구역 등급 · 정책(병렬 한도 · 재시도 · 우선) | 실행 가능 집합 + 고른 배정 + 고르지 않은 까닭 | 순수 | `rebuild/supervise.mjs` |
| ★ `freshness` | 작업의 검증 기록(입력 지문) · 지금 입력 | 유효 · 낡음(까닭) | 순수 | `judicial/` (판정이라 사법부) |
| ★ `barrier` | 목표 · 모든 작업의 계산 상태 · 통합 브랜치 사실 · 승인 판정 | 목표 상태(completed 여부) · 못 넘는 까닭 목록 | 순수 | `judicial/supervise_approval.js` 확장 |
| `judge` · `derive` (있음 → 넓힘) | 대상 = **작업별 산출의 합**(마지막 run 하나가 아니라) | 승인 판정 | 순수 | `judicial/supervise_approval.js` |
| ★ 계약 쓰기 집합 판정 | 작업 브랜치의 순 변경 · 계약 | 계약 밖 변경 목록 | 순수 | CI — `trust-check` 와 같은 꼴(main 코드) |
| Supervisor 루프 | 위 함수의 결과 | 클라우드 세션 도구 호출 · 사용자에게 보고 | (세션) | 감독 규격 §6 |

### B.4 데이터 · 장부 연결 [제안]

```
계획 장부 plan_item ◀── 목표 GOAL (= SUP-…) ──▶ 결정 DEC (계획 지문을 가리킴)
                              │ tasks[]  (DAG: id · depends_on · 계약)
                              ▼
                     작업 SUP-…/t<k> ──▶ run SUP-…/t<k>/r<n> ──▶ 영수증 · 전환 기록(sup) · 작업 브랜치 · 커밋
                              │                                        │
                              └── 검증 기록(입력 지문 · 산출 지문) ◀──┘
                     통합 브랜치 ── 통합 PR ── main 병합 커밋 ── 승인 판정 ── barrier
```

- **목표 = 지금의 상위 작업(SUP)** 을 그대로 쓴다. 새 번호 공간(GOAL-)을 만들지 않는다 — 감독 규격 · 장부 · 명령 · 시험이 이미 SUP 에 묶여 있다 [제안].
- `steps`(모드 차례)는 `tasks`(작업 그래프)의 특수한 경우다: `steps: [author, inspect]` ≡ `tasks: [t1 author, t2 inspect depends_on t1]`. 옛 장부는 이 변환으로 그대로 읽힌다(호환) [제안].
- run 번호는 작업 아래로: `SUP-0002/t1/r1`. 옛 `SUP-0001/r1` 은 "작업 하나짜리 목표" 로 읽는다 [제안 — 형식 변경이라 [결정] H-2].

---

## C. 병렬 실행 설계

### C.1 DAG 스키마 [제안]

```json
{ "ev": "propose", "sup": "SUP-0002", "plan_item": "PLAN-112", "decision": "DEC-0093",
  "purpose": "…", "done_when": "목표 완료 조건 (사람 글)",
  "tasks": [
    { "task": "t1", "mode": "author",   "depends_on": [],        "contract": { … } },
    { "task": "t2", "mode": "author",   "depends_on": [],        "contract": { … } },
    { "task": "t3", "mode": "inspect",  "depends_on": ["t1","t2"], "independent_of": ["t1","t2"], "contract": { … } },
    { "task": "g1", "kind": "human_gate", "depends_on": ["t3"],   "evidence": "decision" },
    { "task": "t4", "mode": "baseline", "depends_on": ["g1"],     "on": "integration", "contract": { … } }
  ],
  "plan_digest": "sha256(위 tasks · done_when 의 정준 직렬화)" }
```

| 칸 | 뜻 | 검사 (순수, `check`) |
|---|---|---|
| `depends_on` | 선행 작업 — 그 작업의 **계산 상태가 완료** 여야 시작 | 고리 없음(위상 정렬 성공) · 모르는 작업 없음 |
| `kind: human_gate` | 사람 관문 — 실행이 아니라 **증거**로 완료(결정 번호가 계획 장부에 있음 · 또는 PR 승인) | 증거 종류는 정해진 목록만 — AI 가 "승인됨" 을 적는 길이 없음 |
| `independent_of` | 검수 작업이 독립이어야 할 작업 — 다른 세션 · 다섯 요소(G3) | 같은 세션 배정을 schedule 이 거부 |
| `on: integration` | 통합 브랜치에서 돌아야 하는 작업(통합 검증 · baseline) | — |
| 조건부 작업 | `when: { task: "t3", recommend: "hold" }` 꼴 — 앞 작업의 **계산된** 결과에 따라 | 조건은 계산 값만 가리킴(자유 글 금지) |
| `plan_digest` | Planner 산출의 지문 — 결정 번호가 가리킴 | 사건마다 지문 다시 계산 · 다르면 거부 |

스케줄의 바탕은 위상 정렬과 임계 경로(가장 긴 의존 사슬) — 정적 DAG 스케줄링의 고전 정리는 Kwok & Ahmad (1999) 의 27 알고리즘 분류 [외부]. 이 저장소의 작업은 수가 작고(한 목표에 수 개 – 십여 개), 소요 시간을 미리 알기 어려우므로 **정적 최적화가 아니라 동적 목록 스케줄링**(준비된 작업 중 임계 경로가 긴 것부터)이면 충분하다 [제안].

### C.2 충돌 그래프 — 읽기 · 쓰기 집합 [제안]

충돌의 기본 정의는 데이터베이스 직렬성 이론의 것 — 같은 대상에 대해 둘 중 하나라도 쓰기면 충돌(Bernstein · Hadzilacos · Goodman 1987, 2 장) · 읽기 집합 · 쓰기 집합이라는 말은 Papadimitriou (1979) [외부]. 이 저장소에서 **대상의 단위는 파일 경로가 아니라 저장 지도의 구역(40 개)과 등급** 이 알맞다 — 이미 자리마다 등급 · 구역 · 쓰는 열쇠가 있고 기계가 대조하고 있다 [사실 `authority.json`].

| 충돌 종류 | 예 [사실 — 자리] | 수준 | 해결 전략 [제안] |
|---|---|---|---|
| 같은 권위 데이터 쓰기 | `data:db`(L5) — `meta.next` 번호 · 봉인 사슬 | **직렬** | 같은 목표 안에서 `data:db` 를 쓰는 작업은 한 번에 하나 — 번호 충돌은 merge-check 가 탐지만 하고 고치지 못함 |
| 덧붙이기 장부 | 전환 기록 · 감독 장부 · CHANGES · 계획 기록 | 낮음 — 합집합 | 줄 단위 합집합(merge-check 의 "두 쪽 합집합") · 순번은 세션 꼬리 번호(감독 장부) · 일 묶음 번호(DEC-0092) |
| 생성물 | `rebuild/status/**` · 부록 | 없음 | 통합 브랜치에서 다시 만듦(merge-check "다시 만든다") — 계약의 쓰기 집합에서 뺀다 |
| 번호를 새로 집는 장부 | 계획 장부(DEC · PLAN) · 규칙 장부(RULE) | 중간 | 병렬 작업이 새 번호를 집지 않게 하거나(Planner 가 미리 배정) 통합 때 다시 매김 — [결정] H-6 |
| 같은 코드 모듈 | `judicial/x.js` 를 두 작업이 | 의미적 — git 이 안 잡을 수 있음 | 기본 직렬 · 인터페이스를 계약에 고정하면 조건부 병렬 |
| 인터페이스 · 형식 | `SCHEMA` · `vocab.js` · `model.js` (공유 헌법) | 높음 | 형식 변경 작업은 그것을 읽는 모든 작업의 **선행**으로 — 충돌이 아니라 의존으로 바꿈 |
| L6 | 문지기 · 설정 · 모드표 · 판정 코드 | 병렬 금지 | AI 작업의 쓰기 집합에 들어갈 수 없음(묶음 → 사람) |
| 외부 자원 | 문헌 받기(fetch) · 예약 작업 | 낮음 | 횟수 제한(자원 표) |
| 읽기만 | 조회 · 엔진 실행 · 검수의 읽기 | 없음 | 자유 병렬 |

같은 파일을 고쳐도 충돌이 아닐 수 있다(덧붙이기 장부 · 생성물), 다른 파일이어도 충돌일 수 있다(형식을 바꾸는 쪽과 읽는 쪽) — 그래서 판정은 **구역 등급 + 충돌 종류 표** 로 하고 git 충돌 여부로 하지 않는다 [제안].

읽기 집합은 선언만으로는 믿기 어렵다. 이 저장소에는 이미 **실제 읽기를 추적하는 장치**가 있다(`tests/trace.mjs` — 시험이 실제로 읽은 파일 · 폴더) [사실]. 실행 세션의 읽기를 같은 방식으로 추적하는 것은 비용이 크므로: 선언(계약) + 사후 대조(영수증의 도구 호출이 가리킨 경로)로 시작하고, 어긋나면 그 작업의 검증을 낡음으로 [제안].

### C.3 병렬 분류 [제안]

| 분류 | 조건 (계산) | 예 |
|---|---|---|
| 독립 병렬 | 의존 없음 · 쓰기 집합끼리 · 쓰기와 다른 쪽 읽기가 겹치지 않음 | 서로 다른 관찰 둘의 출처 보강(같은 db 를 안 씀 — 패치만 handoff 로) |
| 조건부 병렬 | 겹침이 "합집합" · "다시 만듦" 종류뿐 | 두 작업이 각자 전환 기록 · 보고서를 씀 |
| 읽기 전용 병렬 | 쓰기 집합이 비었거나 저장소 밖 | 검수 둘 · 엔진 실행 |
| 공유 자원 제한 병렬 | 겹침 없음, 그러나 자원 한도(세션 수 · 외부 API · CI) | fetch 를 많이 쓰는 작업 셋 |
| 순차 필요 | 같은 L5 구역 쓰기 · 형식 변경과 그 사용자 · 같은 코드 모듈 | db 병합 둘 |
| 사람 결정 대기 | 선행에 미완료 `human_gate` | 결정이 후속 입력을 바꾸는 경우 |
| 충돌 해결 뒤 실행 | 선행의 산출이 바뀌어 낡음 | §E.5 |

### C.4 계약 (Contract-Driven Execution) [제안]

지시서 4 장의 칸을 지금 구조에 맞춘다 — **새 권한 칸을 만들지 않는다**: 계약은 모드의 쓰기 구역을 **좁히기만** 한다(RULE-0461 · 감독 규격 §3.3 "계약에 범위 칸을 두지 않는다" 와의 관계는 아래).

| 지시서 칸 | 이 저장소의 칸 | 값의 출처 | 바꿀 수 있나 |
|---|---|---|---|
| task_id · goal_id | `task` · `sup` | 장부 | — |
| depends_on | `depends_on` | Planner | 재계획만 |
| required_inputs | `inputs` (지금 칸 그대로: 전환 기록 · 파일 · 번호) | Planner | 재계획만 |
| expected_outputs | `outputs_expected` — 산출 종류(패치 · 보고서 · 커밋 · 도장 종류) | Planner | 재계획만 |
| read_set · write_set | `read_zones` · `write_zones` — **저장 지도 구역 이름**(예 `data:db`) 또는 경로 glob | Planner | 재계획만 · **모드 구역의 부분집합이어야**(넓히면 check 거부) |
| resource_requirements | `resources` — 정책 표의 자원 이름(세션 1 · fetch n) | Planner | — |
| execution_constraints | `independent_of` · `on` · 시간 한도 | Planner · 정책 | 정책 |
| acceptance_criteria · completion_conditions | `done_when` — 사람 글 + 기계 조건 목록(`finish --full` 통과 · 특정 시험 · 산출 존재) | Planner | 재계획만 |
| verification_requirements | `verify_by` — 검수 작업 · 시험 · CI | Planner | 재계획만 |
| approval_requirements | `human_gate` 작업으로 표현 (칸이 아니라 그래프 노드) | Planner | 재계획만 |
| base_commit | run 의 `base` (있음) | Executor 가 start 에 | — |

감독 규격 §3.3 은 "쓸 수 있는 자리 · 명령 범위를 계약에 두지 않는다" 고 정했다(적는 쪽이 넓히지 못하게). `write_zones` 는 이 원칙과 충돌하지 않게 **상한이 아니라 하한 쪽 제약**으로만 쓴다: 실제 권한 = 모드 구역 ∩ 계약 쓰기 집합. 계약이 모드보다 넓으면 거부, 계약 밖 변경은 CI 가 거부 — 계약은 권한을 줄 수 없고 뺄 수만 있다 [제안 · [결정] H-3 — 규격 §3.3 의 문장을 고치는 일].

계약 변경은 새 `propose`(재계획) — 이전 계획 지문 · 새 지문 · 결정 번호가 장부에 남는다(이력 = 장부 자체, 이벤트 소싱 [외부 Fowler]).

### C.5 실행 가능성 판정 알고리즘 [제안 — 순수 함수 `schedule`]

```
입력: G (DAG, 계획 지문), S (reconcile 결과: 작업마다 계산 상태 · 실행 중 run · 임차),
      Z (저장 지도 구역 등급 · 충돌 종류 표), P (정책: 병렬 한도 · 자원 · 재시도 · 우선)
1. done(t)   = t 의 계산 상태가 완료 (run 의 handoff 가 아니라 증거 — human_gate 는 결정 · PR, 작업은 검증 기록이 신선)
2. ready     = { t | t 미완료 ∧ 실행 중 run 없음 ∧ ∀d∈depends_on(t): done(d) ∧ 시도 < P.max_attempts
                   ∧ mode(t) ∉ {develop, field}  (PLAN-104 D4 — 사용자 요청 없이는 needs_user) }
3. 충돌 걸러내기: 실행 중 집합 R 에 대해 t 를 남기는 조건
      ∀r∈R: conflict(t, r, Z) ∈ {없음, 합집합, 다시 만듦}
   — conflict 는 쓰기∩쓰기, 쓰기∩읽기 를 구역 단위로 보고 종류 표로 수준을 정함
4. 자원: Σ resources(R ∪ 고른 것) ≤ P.limits (동시 세션 · fetch · CI 대기)
5. 고르기: 남은 ready 를 (임계 경로 길이 내림, 우선 내림, 작업 번호) 로 정렬해 한도까지 — 탐욕 목록 스케줄링
6. 출력: 고른 배정 · 고르지 않은 것과 까닭(의존 · 충돌 상대 · 자원 · 사람 관문 · 시도 한도)
```

- 같은 입력이면 같은 출력(결정적) — Supervisor 가 바뀌어도 같은 배정이 나와 재현 · 감사가 된다.
- **허용의 강제는 Executor 쪽 `start` 검사**: 실행 세션이 `start` 를 적을 때 `admit` 이 같은 `schedule` 을 다시 돌려 그 작업이 실행 가능 집합에 없으면 거부 — Supervisor 가 잘못 배정해도 장부에는 들어가지 못한다 [제안]. (단 §A.4 ③ 때문에 실행 세션이 다른 세션의 claim 을 볼 수 있어야 의미가 있다 → §D.3)
- AI(Supervisor)의 판단이 들어가는 곳은 5 의 동점 처리 · 정책 범위 안의 선택 · 사용자에게 보고할 설명뿐이다.

### C.6 자원 스케줄러 [제안]

| 자원 | 지금 사실 | 정책 칸 | 기본 제안 |
|---|---|---|---|
| 동시 실행 세션 | 클라우드 세션 수 · 비용 — 한도 [확인 필요] | `max_parallel` | 2 (처음) — 늘리는 것은 실증 뒤 |
| 사람 승인 | 규칙 세트: PR 마다 승인 1 [사실] | 통합 전략 | 목표마다 통합 PR 하나(§D.1) — 사람 손이 가장 비싼 자원 |
| CI | `check` 한 번에 수 분 · 필수 검사 둘 [사실 — 시간은 확인 필요] | — | 작업 브랜치 push 마다 돎 — 병렬 수만큼 늘어남 |
| main 병합 | "up to date" 규칙으로 직렬 [사실] | — | 목표 끝 한 번만 main 으로 |
| 외부 API(fetch) | 연결 안 됨 · CLI 로 | `fetch_per_task` | 작업마다 상한 |
| 토큰 · 시간 | 측정 장치 없음 [확인 필요] | `time_limit` | 작업마다 시간 한도 → 넘으면 계산상 `stale_lease` |
| 장부 · db 잠금 | 컨테이너 안에서만 [사실] | — | 잠금 대신 **구역 단위 직렬 규칙**(C.2) — 잠금을 세션 사이로 넓히지 않음 |

잠금을 늘리는 대신 **충돌 종류를 계획 단계에서 의존으로 바꾸는 것**이 이 규모에서는 싸다: 잠금은 실패하면 교착 · 고아 잠금 관리가 생기지만, 의존은 그래프에 보이고 계산된다 [제안].

---

## D. 실행 및 통합 설계

### D.1 브랜치 전략 — 대안 비교 [제안]

| 안 | 모양 | 좋은 점 | 나쁜 점 | 이 저장소에서 |
|---|---|---|---|---|
| ① 한 브랜치 | 모든 작업이 목표 브랜치 하나에 (SUP-0001 이 실제로 이렇게) | 통합 비용 0 · 지금 코드(`evidence` 끝 커밋)와 맞음 | **병렬 불가**(세션이 같은 브랜치에 동시 push → 충돌) · 작업 단위 되돌리기 어려움 | 순차 목표에는 그대로 좋음 |
| ② 작업마다 PR → main | 작업 브랜치마다 main 으로 PR | 작업이 작게 검토됨 | 사람 승인 = 작업 수 · "up to date" 로 매번 다시 맞춤 · 목표 중간 상태가 main 에 남음 | 비쌈 — 권하지 않음 |
| ③ **통합 브랜치 + 작업 브랜치** | 목표 브랜치 `sup/SUP-…` (main 에서) · 작업 브랜치는 그 시점의 통합 머리에서 · 끝난 작업을 통합으로 합침 · 목표 끝에 통합 → main PR 하나 | 병렬 가능 · 사람 승인 = 목표 수 · 목표가 끝나기 전에는 main 이 깨끗(되돌리기 = 브랜치 버림) | 작업 → 통합 합치기를 **누가** 하나(§D.2) · 통합 브랜치 보호 규칙이 없음 | **권장** |
| ④ 쌓인 PR (stacked) | 작업 PR 이 앞 작업 PR 위에 | 순서가 보임 | 앞 PR 이 바뀌면 뒤가 모두 다시 맞춤 · 승인 수 많음 | 권하지 않음 |
| ⑤ 머지 큐 | GitHub merge queue — 큐에서 main 과 합친 상태로 CI 를 다시 돌려 병합 | main 으로 가는 PR 이 많을 때 직렬화 · 신선한 검증 | CI 가 `merge_group` 이벤트를 받아야 함 [외부 GitHub Docs] — `trust.yml` 은 `pull_request_target` 이라 같은 보장으로 옮기는 설계가 따로 필요 [확인 필요] · L6 워크플로 변경 | ③ 으로 main PR 이 목표마다 하나면 **필요 없음** — 나중 |

worktree 는 한 저장소에서 여러 브랜치를 동시에 펼치는 git 기능이다 [외부 git-scm]. 클라우드 세션은 **세션마다 컨테이너 · 저장소 복제본이 따로** 라 이미 격리돼 있으므로 worktree 가 필요한 곳은 "한 세션 안에서 두 브랜치를 견줄 때"(예: 통합 검증 세션이 작업 브랜치를 펼쳐 볼 때) 정도다 [제안].

### D.2 작업 → 통합 합치기의 주체 [결정 H-4]

| 안 | 누가 | 보안 | 비용 |
|---|---|---|---|
| a | 봇이 git 으로 통합 브랜치에 합침(통합 브랜치는 보호 없음) | DEC-0090 "병합은 사람 계정만" 을 **main 만의 뜻**으로 읽어야 함. 통합 → main PR 에서 `independent-judge`(main 코드 · 순 변경)가 전체를 다시 봄 — 통합 중에 숨긴 변경도 순 변경에 드러남(N9 닫힌 방식) | 사람 0 |
| b | 작업 PR → 통합 브랜치(사람 승인) | 가장 강함 | 사람 승인 = 작업 수 — ② 와 같아짐 |
| c | 통합 세션(별도 Executor, mode = 공통 구역 일)이 합치고, 결과 트리 지문을 기록 | a 와 같음 + 합친 주체 · 지문이 run 으로 남음 | 사람 0 |

권장: **c** — 합치기도 하나의 작업(run)으로 두고 장부에 남긴다. 보안의 마지막 겹은 그대로 main PR 의 사람 승인 + `independent-judge` [제안].

### D.3 공유 조율 기록 — 병렬 세션이 서로의 claim 을 보는 법 [결정 H-1]

§A.4 ③ 이 병렬의 가장 큰 벽이다. 대안:

| 안 | 모양 | 좋은 점 | 나쁜 점 |
|---|---|---|---|
| a 브랜치마다 장부(지금) | 각 작업 브랜치의 `supervise.jsonl` · 통합 때 합집합 | 바뀜 없음 | 진행 중 서로 못 봄 → 중복 배정을 **사후에만** 탐지 |
| b **통합 브랜치의 장부를 공유 기록으로** | 실행 세션이 `start` 를 통합 브랜치 장부에 덧붙여 push — git push 는 앞서간 원격을 덮지 못해(fast-forward 아님 → 거부) **비교 후 교체** 처럼 동작 → 두 세션이 같은 작업을 잡으면 늦은 쪽 push 가 거부되고, 다시 받아 `admit` 하면 중복으로 거부 | 새 저장소 · 서비스 없음 · Supervisor 는 여전히 쓰지 않음 · 기록 = git(증거 사슬) | 실행 세션이 작업 브랜치와 통합 브랜치 두 곳에 push · push 경쟁 재시도 필요 · **git 의 원자적 ref 갱신에 기댐 [확인 필요 — 시험으로]** |
| c 바깥 저장소(서비스 · DB) | 조율 상태를 저장소 밖에 | 빠름 · 임차 쉬움 | 새 신뢰 경계 · 증거가 git 밖 · DIR-0010(상태는 저장소에)와 충돌 |

권장: **b** — 이벤트 소싱(장부 = 사건의 덧붙이기, 상태는 접기 [외부 Fowler])과 git 의 비교 후 교체를 합친 꼴. a 는 순차 목표에 그대로 둔다 [제안].

### D.4 검증된 커밋 = 병합된 커밋 — 동일성 [제안]

| 겹 | 무엇 | 지금 |
|---|---|---|
| 1 | 검증 기록에 **git 트리 지문**(커밋의 `tree` — 내용 주소)을 남김: 작업 검증은 작업 머리의 트리, 통합 검증은 통합 머리의 트리 | 없음 — 지금 `judge` 는 파일별 blob 이 main 에 처음 모두 나타났나를 봄(같은 원리의 파일 단위판) |
| 2 | main 규칙 "Require branches up to date" 가 켜져 있으므로 병합 직전 PR 머리는 main 을 포함 → 병합 커밋의 트리 = PR 머리의 트리 | 규칙은 있음 [사실] · **트리가 같다는 것은 시험으로 확인 필요** [확인 필요] |
| 3 | barrier 가 "main 병합 커밋 트리 == 통합 검증 트리" 를 확인 — 다르면 검증이 그 커밋을 덮지 않은 것 | 없음 |
| 4 | 작업 검증 → 통합: 통합 트리가 작업 트리의 단순 합(충돌 없음)인지, 아니면 합치며 바뀐 부분이 있는지 → 바뀐 부분이 닿는 작업은 낡음(§E.5) | 없음 |

### D.5 Barrier 와 목표 완료 [제안 — 순수 함수 `barrier`]

흐름: 목표 생성(propose · 결정) → 분해(tasks) → 의존 확인 → 병렬 실행 → 사람 관문 → 작업별 완료(증거) → **합류 관문** → 통합(통합 run) → 통합 독립 검증(통합 브랜치의 inspect · baseline · CI) → 통합 PR 사람 승인 · 병합 → 승인 판정 → **목표 완료(계산)**.

사람 관문이 있어도 무관한 작업은 멈추지 않는다: schedule 의 ready 는 **그 작업의 선행에** 미완료 관문이 있을 때만 막힌다. 관문의 결정이 후속 입력 · 안전 조건을 바꾸는 경우는 Planner 가 그 후속을 관문 뒤에 의존으로 두는 것으로 표현한다 [제안].

| 관문 조건 (지시서 8 장) | 계산 방법 | 자리 |
|---|---|---|
| 필수 작업 전부 완료 | 모든 `required` 작업의 계산 상태 | barrier |
| 실패 · 미해결 필수 작업 없음 | blocked · 시도 한도 넘김 없음 | barrier |
| 산출물 존재 | `outputs_expected` 대 실제 커밋 · 파일 | barrier |
| 계약 충족 | 작업 브랜치 순 변경 ⊆ 쓰기 집합 (CI 판정 결과) | CI → barrier 가 읽음 |
| 검증 결과 유효 | freshness — 입력 지문이 지금과 같음 | `judicial/` freshness |
| 사람 승인 완료 | human_gate 증거 + 통합 PR 의 승인 · `merged_by` 가 사람 계정 | 승인 판정 (GitHub 사실로 — §F) |
| 통합 결과 존재 | 통합 run 의 handoff · 통합 머리 | barrier |
| 통합 독립 검증 통과 | 통합 브랜치 위의 inspect(다른 세션) · baseline `finish --full` · CI 둘 | barrier |
| 최종 증거 무결성 | main 병합 트리 == 통합 검증 트리(§D.4) · 장부 덧붙이기만 | barrier · CI |

하나라도 못 넘으면 목표는 completed 가 아니며, 못 넘는 까닭 목록이 그대로 사용자 보고가 된다(승인 보고서 12 칸의 확장) [제안].

### D.6 분산 트랜잭션 — 무엇을 쓰고 무엇을 안 쓰나 [제안]

| 개념 | 맞나 | 까닭 |
|---|---|---|
| 2 단계 커밋(2PC) | **안 맞음** | 참여자(세션)가 몇 시간씩 살아 있어야 하고 사람이 중간에 끼며, 잠금을 오래 쥐어야 함 |
| Saga — 긴 일을 작은 트랜잭션의 차례로 나누고 실패하면 보상 트랜잭션으로 되돌림 [외부 Garcia-Molina & Salem 1987] | **맞음 — 단 보상이 대부분 공짜** | 통합 브랜치안(③)에서는 main 에 닿기 전까지 모든 작업이 브랜치에만 있어 보상 = 브랜치 버림 · 작업 다시 함. main 병합 뒤의 보상은 되돌림 PR(사람 승인) 하나 |
| 커밋 지점 | 목표 끝의 사람 병합 한 번 | 2PC 의 "준비 → 커밋" 이 "관문 통과 → 사람 병합" 으로 바뀐 것 — 사람만 커밋 지점을 넘김 |
| 이벤트 소싱 | 이미 씀 | 감독 장부 = 덧붙이기 · `fold` 결정적 [사실] |
| 재실행(replay) 복구 — 기록된 사건을 다시 돌려 상태를 복원하고 이미 끝난 부작용은 다시 하지 않음 [외부 Temporal Docs] | 맞음 | Supervisor 재시작 = 장부 다시 접기 · 끝난 run 은 다시 배정하지 않음 |
| 빌드 시스템의 "검증 추적" — 입력의 지문이 같으면 결과를 다시 쓰고, 다르면 다시 만듦 · 스케줄과 재빌드 전략은 서로 독립인 두 축 [외부 Mokhov 외 2018] | 맞음 | `tests/affected.mjs` 가 이미 시험 단위로 이 방식 [사실] — 작업 검증의 신선도(§E.5)에 같은 원리 |

---

## E. 장애 및 복구 설계

### E.1 원칙 [제안]

- **조정(reconciliation)**: 원하는 상태(DAG · 계획)와 실제 상태(세션 · 브랜치 · 장부)를 견줘 차이를 줄이는 고리. 사건을 놓쳐도 다음 고리가 다시 봄(수준 기반) · 고리는 몇 번 돌아도 같은 결과(멱등) [외부 Kubernetes 문서].
- **임차(lease)**: 시간이 정해진 권리 — 주인이 사라져도 시간이 지나면 저절로 풀림. 짧은 임차가 효율과 장애 허용 둘 다 좋다는 분석 [외부 Gray & Cheriton 1989].
- 이 저장소에서는 임차를 **적지 않고 계산**한다: 임차 = 실행 세션의 `start` 시각 + 마지막 활동(클라우드 세션의 `updated_at` · 장부 사건 · 브랜치 push) + 정책의 시간 한도. Supervisor 가 쓰지 않는 원칙을 지킨다.

### E.2 Supervisor 재시작 [제안]

```
1. fold(공유 장부 — D.3 b)                      → 적힌 상태
2. 실행 중 run 마다: 세션 사실(get_session · list_events) · 브랜치 사실(push 된 커밋)
3. reconcile 표(E.3)로 실제 상태 계산
4. schedule → 새 배정은 실행 가능 집합에서만 · 이미 살아 있는 run 의 작업은 ready 에서 빠짐
5. 다음 깨우기 예약(send_later) — 정지 · 시간 한도 감시
```

배정 사실의 기록: 실행 세션의 `start` 에 `dispatch: { session_by, at, sup_session? }` 를 싣는다 — Supervisor 가 아니라 실행 세션이 적는다(DEC-0065 ① 유지) [제안 · [결정] H-5]. 띄웠는데 `start` 를 적지 못하고 죽은 세션은 장부에 없으므로 Supervisor 는 클라우드 세션 목록(자기가 만든 자식 세션 — `list_sessions` 의 children)과 대조해 찾는다 [확인 필요 — 자식 세션 목록이 재시작한 Supervisor 에서도 보이는지].

### E.3 조정 표 [제안]

| 장부 | 세션 | 브랜치 | 판정 | 행동 |
|---|---|---|---|---|
| start 있음 · handoff 없음 | 살아 있음 · 일하는 중 | — | 진행 | 기다림 |
| start 있음 · handoff 없음 | 멈춤(idle) | 새 커밋 없음 | 멈춘 실행 | 메시지로 묻기 → 시간 한도 뒤 임차 끝남 |
| start 있음 · handoff 없음 | 멈춤 · 사라짐 | **새 커밋 있음** | 고아 산출 — **실패로 단정하지 않음** | 사람 또는 새 run 이 그 커밋을 이어받을지 판단(이어받기 = 새 run 의 base 를 그 커밋으로) |
| start 있음 · handoff 없음 | 사라짐 | 새 커밋 없음 · 임차 끝남 | 임차 끝남 | 새 run(시도 +1) — 옛 run 은 계산상 superseded |
| start 없음 | Supervisor 가 띄운 자식 세션이 있음 | — | 배정 미확정 | 그 세션에 묻기 · 시간 한도 뒤 버림 |
| handoff 있음 | — | 커밋 있음 | 넘김 | 다음 작업 |
| handoff 있음 | — | **handoff 의 커밋이 원격에 없음** | 증거 없음 | blocked(EXEC_FAILURE) — 계산 |

### E.4 중복 · 늦은 실행 · 멱등 [제안]

| 상황 | 막는 법 |
|---|---|
| 같은 작업 두 번 배정 | 공유 장부(D.3 b)에서 `admit` 이 "실행 중 run 이 있으면 start 거부" (지금 규칙 그대로 — 규격 §4.4) |
| 임차가 끝난 옛 실행이 늦게 돌아와 handoff | **run 번호가 순서 표지(fencing)** — 그 작업에 더 높은 시도의 start 가 있으면 옛 run 의 handoff 거부. 산출 커밋은 버리지 않고 "고아 산출" 로 보고 |
| 재시도 | 새 run 번호 · 새 브랜치(또는 같은 브랜치의 이어받기) — 옛 run 의 기록을 지우지 않음(덧붙이기만) |
| 같은 사건 두 번 적기 | 사건 번호 `<세션 꼬리>-<차례>` 가 세션마다 빠짐없이 증가해야 함(check — 이미 있음 [사실]) |
| 실패 작업 처리(dead letter) | 시도 한도 넘김 → 계산상 blocked · 원인 태그 → 거부(deny) 류는 고친 뒤 재계획, 보류(hold) 류는 사람 |
| 취소 | `cancel`(사용자 결정 번호) — 실행 중 세션에는 Supervisor 가 메시지(멈춤 요청) · 그 뒤의 handoff 는 거부 |

### E.5 의존 변경 · 검증 무효화 (Provenance) [제안]

| 개념 | 이 저장소에서 |
|---|---|
| 입력 지문 | handoff 의 `verify` 에 `inputs_digest` — (base 커밋의 트리에서 읽기 집합 구역의 blob 지문들) + (선행 작업 산출 커밋들) 의 정준 직렬화 sha256 |
| 산출 지문 | 작업 머리의 트리 지문(§D.4) |
| 신선도 | freshness(t) = 지금 다시 계산한 입력 지문 == 기록된 입력 지문 |
| 무효화 전파 | 선행 산출이 바뀌면(재시도 · 수정) 그 뒤 모든 작업의 신선도가 계산상 거짓 → 다시 검증(필요한 것만 — 읽기 집합이 바뀐 부분에 닿는 것만, `tests/affected.mjs` 와 같은 원리) |
| 예: A 가 형식을 바꿈 → B 의 Validator 결과 | B 의 읽기 집합에 형식 구역이 있으므로 입력 지문이 달라짐 → B 검증 낡음 → 관문 못 넘음 |
| 증거 사슬 | 목표 → 계획 지문(결정) → 작업 → run → 영수증 · 전환 기록 · 커밋 · 검증 지문 → 통합 트리 → main 병합 커밋 — 모두 번호 · 지문으로 되짚힘 |
| 지금 있는 것 | RULE-0543 "검수 뒤 작성이 더 넘김 → 보류" · trust-check 순 변경 · 서기 봉인 사슬 · 도장 digest [사실] — 이 설계는 그것을 작업 그래프 전체로 넓힌 것 |

---

## F. 보안과 권한 분석

### F.1 삼권 분립 보존 [제안]

| 보장 (지시서 11 장) | 어떻게 | 자리 |
|---|---|---|
| Supervisor 는 승인 권한 없음 | 쓰지 않음 · 승인 사건 없음 · 상태는 계산 | 규격 §4.4 · `EVENTS` |
| Executor 는 자기 결과를 승인 못 함 | 자기 run 사건만 · 검수는 `independent_of` 로 다른 세션 · 승인은 사람 병합 | `admit` · `independence` |
| Judge 는 실행 권한을 얻지 않음 | 새 함수(schedule · reconcile · freshness · barrier)는 모두 순수 · 쓰기는 서기만 | 삼권 규격 · `tests/governance.test.mjs` |
| Governor 의 바깥 강제 유지 | 계약 쓰기 집합 판정은 CI(main 코드) 에 더함 — 같은 기계 겹에 기대지 않음 | `trust.yml` 꼴 |
| 서기 잠금 · 기록 무결성 | 서기 쓰기 함수 그대로 · 감독 장부 덧붙이기만(RULE-0544) | `clerk.mjs` |
| 사람 결정을 AI 가 대체 못 함 | human_gate 의 증거는 결정 번호(계획 장부, main) · PR 승인 · `merged_by` 뿐 | 승인 판정 |

### F.2 이 설계가 새로 만드는 공격 경로와 대응 [제안]

| 경로 | 무엇 | 대응 |
|---|---|---|
| 계약 부풀리기 | Planner 가 쓰기 집합을 넓게 | 실제 권한 = 모드 ∩ 계약 — 계약은 넓힐 수 없음 · 계획 지문을 사람 결정이 가리킴 |
| Planner · Supervisor 담합 (같은 AI) | 검수를 빼고 쪼갬 | 목표 완료 조건 · 검수 작업은 계획 지문에 고정 · barrier 가 `verify_by` 를 계산으로 확인 |
| 통합 중 숨긴 변경 | 합치며 다른 것을 끼움 | 통합 → main PR 의 `independent-judge` 가 순 변경 전체를 봄 · 통합 run 의 트리 지문 |
| 낡은 검증 재사용 | 선행이 바뀌었는데 옛 통과를 씀 | freshness — 계산 |
| 임차 경쟁 · 중복 | 둘이 같은 작업 | 공유 장부의 push 비교 후 교체 + `admit` · fencing |
| 공유 장부 줄 고침 | 남의 start 를 지움 | 덧붙이기만 판정(RULE-0544)을 통합 브랜치 장부에도 · 문지기 쪽 검사(지금 없음) |
| 자동 배정으로 develop · field 열기 | 사용자 요청 우회 | schedule 불변 조건(D4) — 시험으로 고정 |
| 사람 관문 위조 | AI 가 결정 번호를 만듦 | 결정 번호는 계획 장부에 있어야 하고 그 장부 줄이 **main 에 사람 병합으로 들어간 것만** 인정 — [결정] H-7 |
| Supervisor 의 세션 도구 남용 | 무한 세션 · 비용 | 정책 `max_parallel` · 사용자 보고 · 정지 스위치(H-8) |

### F.3 사람 승인 지점 — 한곳에 [제안]

| 지점 | 무엇을 승인 | 증거 |
|---|---|---|
| 목표 · 계획 | 계획 지문 | 결정 번호(DEC) — main 에 있는 계획 장부 줄 |
| 재계획 | 새 계획 지문 | 새 결정 번호 |
| 사람 관문(DAG 노드) | 그 노드가 정한 것 | 결정 번호 또는 PR 승인 |
| develop · field 작업 | 사용자 요청 | 사용자의 요청(사람이 그 세션을 시작) — 자동 배정 금지 |
| L6 변경 | 승인 묶음 | 사람 커밋 |
| 통합 PR | 목표 결과 | 승인 1 + `merged_by` 사람 계정 |
| 취소 | — | 결정 번호 |

---

## G. 단계별 구현 계획 [제안]

| 단계 | 무엇 | 선행 | 끝나는 조건 |
|---|---|---|---|
| 0 독립 재검토 | 이 보고서를 다른 세션(inspect)이 코드 · 장부와 줄마다 대조 | — | 재검토 보고서 · 틀린 사실 목록 |
| 1 순차 실증 | **일렬 순환 하나를 Supervisor 가 클라우드 세션 도구로 실제로 띄워 completed 까지** — PLAN-112 를 SUP-0002 로 · 사람은 propose 결정 · 병합만 | 보안 묶음(N11 · ci-zone · CODEOWNERS) · 승인 증거를 GitHub 사실로(PLAN-102 고침) | SUP-0002 계산 상태 completed · 장부 · 영수증 · 병합 커밋이 되짚힘 · 브랜치 불일치(A.5-1) 해결 |
| 2 형식 일반화 | `steps` → `tasks`(DAG) · run 을 작업 아래로 · 옛 장부 읽기 호환 · `evidence` 를 작업별 산출의 합으로 · `derive` 를 작업 단위로 | 1 · H-2 결정 | 단위 시험: 옛 SUP-0001 이 같은 상태로 접힘 · 고리 있는 DAG 거부 · 계획 지문 불일치 거부 |
| 3 순수 함수 넷 | `schedule` · `reconcile` · `freshness` · `barrier` | 2 | 단위 시험: 충돌 종류마다 · 자원 한도 · D4 거부 · 조정 표 일곱 줄 · 무효화 전파 · 관문 아홉 조건(각각 하나만 빠져도 not completed) · 변이 시험(검사를 끄면 시험이 빨개짐) |
| 4 계약 쓰기 집합의 CI 판정 | 작업 브랜치 순 변경 ⊆ 계약 — `trust-check` 꼴 | 2 · L6(워크플로 · 판정 코드) → 승인 묶음 | 계약 밖 변경 PR 이 실패 · 계약이 모드보다 넓으면 check 거부 |
| 5 공유 조율 기록 | 통합 브랜치 장부 + push 비교 후 교체 · fencing | 2 · 3 · H-1 | 통합 시험: 두 복제본이 같은 작업을 잡으면 하나만 성공 · 늦은 handoff 거부 |
| 6 장애 주입 시험 | Supervisor 강제 종료 · Executor 사라짐 · 고아 커밋 · 임차 끝남 · 늦은 귀환 · 중복 배정 · 선행 변경 | 3 · 5 | 모든 경우에 중복 0 · 잃은 산출 0 · 잘못된 completed 0 |
| 7 다중 세션 실증 | 병렬 2 작업 + 검수 1 + 통합 1 의 실제 목표 하나 | 1 – 6 · H-4 | 목표 completed · 사람 승인 1 회(통합 PR) · 병렬 구간이 실제로 겹쳐 돎(세션 시각) |
| 8 전체 완료 검증 | 독립 세션이 7 의 증거 사슬을 처음부터 되짚음 + 공격 경로(F.2) 재현 | 7 | 우회 0 · 되짚기 끊김 0 |

메타 편중 경보(DEC-0066 E3)를 지키려면 1 과 7 의 실증 대상은 **과학 축 작업**(PLAN-112 · ASY-08 등)이어야 한다 [제안].

---

## H. 결정 필요 사항

| # | 결정 | 선택지 | 장단점 | 기존 구조 영향 | 보안 영향 | 구현 비용 | 권장 | 결정권자 |
|---|---|---|---|---|---|---|---|---|
| H-1 | 병렬 세션의 공유 조율 기록 | a 브랜치마다(지금) · **b 통합 브랜치 장부 + push 비교 후 교체** · c 바깥 저장소 | a 바뀜 없음·중복 사후 탐지 / b 새 서비스 없음·push 경쟁 처리 필요 / c 빠름·새 신뢰 경계 | b: 실행 세션이 두 곳에 push | b: 덧붙이기만 판정을 통합 장부에도 / c: 증거가 git 밖 | b 중 · c 큼 | b (시험으로 원자성 확인 뒤) | 사용자 |
| H-2 | 감독 장부 형식 일반화 | **steps → tasks(DAG), run 을 작업 아래로, 옛 장부 호환** · 새 장부를 따로 | 하나의 장부 / 이중 장부의 어긋남 | 규격 §3 · 장부 · 명령 · 시험 | 없음(칸이 늘 뿐 권한 칸 없음) | 중 | 일반화 | 사용자 (형식 변경 — RULE-0261) |
| H-3 | 계약의 쓰기 · 읽기 집합 | **모드 ∩ 계약(좁히기만)** · 두지 않음(지금 규격) | 병렬 충돌 판정의 바탕 / 판정 불가 | 규격 §3.3 문장 고침 | 좁히기만이면 권한 확대 없음 | 소 – 중 | 좁히기만 | 사용자 |
| H-4 | 작업 → 통합 합치기 주체 | a 봇 git · b 작업 PR(사람) · **c 통합 run** | 사람 0 / 사람 많음 / 사람 0 + 기록 | DEC-0090 "병합" 의 범위를 main 으로 읽음 | main PR 의 independent-judge 가 마지막 겹 | 소 | c | 사용자 (DEC-0090 해석) |
| H-5 | 배정 사실 기록 | **실행 세션의 start 에 dispatch 칸** · Supervisor 가 기록(원칙 변경) · 기록 안 함 | Supervisor 비작성 유지 / 단순하나 원칙 깨짐 / 되짚기 불가 | start 칸 하나 | 없음 | 소 | start 에 칸 | 사용자 |
| H-6 | 병렬 작업의 새 번호(DEC · PLAN · RULE · db 번호) | Planner 가 미리 배정 · 통합 때 다시 매김 · 해당 작업 직렬 | 충돌 0 / 자동화 필요 / 병렬 줄어듦 | merge-check | 다시 매김은 증거 사슬을 끊을 수 있음 | 중 | db 번호는 직렬(L5) · 장부 번호는 미리 배정 | 사용자 |
| H-7 | 사람 관문 증거 | **main 에 사람 병합된 결정 번호 · PR 승인 · merged_by** · 작업 브랜치의 결정 번호도 인정 | 강함 / 빠르나 AI 가 결정 줄을 만들 수 있음 | 승인 판정 | 앞쪽이 위조 불가 | 소 | 앞쪽 | 사용자 |
| H-8 | 정지 스위치 · 시간 한도 · 병렬 한도의 자리 | **정책 장부(L4, 바꿀 때마다 why · 사람 결정) + 불변 조건은 코드** · 모드표(L6) | 바꾸기 쉬움·검증됨 / 바꿀 때마다 사람 커밋 | 새 정책 파일 하나 | 정책이 권한을 넓히지 못하게 — 칸 목록 고정 | 소 | 정책 장부 | 사용자 |
| H-9 | 머지 큐 | 지금 안 씀 · 켬 | — / `merge_group` 과 pull_request_target 보장 재설계 | 워크플로(L6) | 재설계 전에는 판정 공백 위험 | 중 – 큼 | 안 씀(목표마다 PR 하나면 필요 없음) | 사용자 |
| H-10 | 첫 실증 대상 · 병렬 수 | PLAN-112 순차 → 병렬 2 | — | — | — | — | PLAN-112 순차부터 · 병렬 2 | 사용자 |
| H-11 | 이 보고서를 감독 규격 v1 의 입력으로 | 예 · 일부만 · 아니오 | — | `docs/design/supervisor.md` | — | — | 예 — 단 0 단계 재검토 뒤 | 사용자 |

---

## 출처 (외부 — 이 세션이 검색으로 서지 · 요지를 확인)

| 분야 | 출처 | 이 보고서에서 쓴 곳 | 확인 수준 |
|---|---|---|---|
| Saga | H. Garcia-Molina, K. Salem, "Sagas", Proc. ACM SIGMOD 1987, pp. 249–259, DOI 10.1145/38713.38742 — [bibtex.github.io](https://bibtex.github.io/SIGMOD-1987-Garcia-MolinaS.html) · [Princeton TR](https://www.cs.princeton.edu/research/techreps/598) | §D.6 | 서지 · 요지(보상 트랜잭션) |
| 임차 | C. G. Gray, D. R. Cheriton, "Leases: An Efficient Fault-Tolerant Mechanism for Distributed File Cache Consistency", SOSP 1989, pp. 202–210, DOI 10.1145/74850.74870 — [dblp](https://dblp1.uni-trier.de/rec/conf/sosp/GrayC89.html) · [PDF](https://www.andrew.cmu.edu/course/15-440/assets/READINGS/gray1989.pdf) | §E.1 | 서지 · 요지(시간 한정 권리 · 짧은 임차) |
| 빌드 시스템 | A. Mokhov, N. Mitchell, S. Peyton Jones, "Build Systems à la Carte", PACMPL 2(ICFP), Article 79, 2018, DOI 10.1145/3236774 — [Microsoft Research](https://www.microsoft.com/en-us/research/publication/build-systems-la-carte) · 확장판 JFP 2020 [PDF](https://microsoft.com/en-us/research/uploads/prod/2020/04/build-systems-jfp.pdf) | §D.6 · §E.5 | 서지 · 요지(스케줄 · 재빌드 두 축) |
| DAG 스케줄링 | Y.-K. Kwok, I. Ahmad, "Static Scheduling Algorithms for Allocating Directed Task Graphs to Multiprocessors", ACM Computing Surveys 31(4), 1999, pp. 406–471, DOI 10.1145/344588.344618 — [dblp](https://dblp.dagstuhl.de/rec/journals/csur/KwokA99.html) | §C.1 | 서지 · 요지(27 알고리즘 분류) |
| 충돌 · 직렬성 | P. A. Bernstein, V. Hadzilacos, N. Goodman, *Concurrency Control and Recovery in Database Systems*, Addison-Wesley 1987 — [2 장 PDF (Microsoft Research)](https://microsoft.com/en-us/research/wp-content/uploads/2016/05/chapter2.pdf) · 읽기 · 쓰기 집합: C. H. Papadimitriou 1979 [PDF](https://www.cs.purdue.edu/homes/bb/cs542-11Spr/SCDU-Papa-79.pdf) | §C.2 | 정의 확인(충돌 = 같은 대상 · 하나라도 쓰기) |
| 이벤트 소싱 | M. Fowler, "Event Sourcing" — [martinfowler.com](https://martinfowler.com/eaaDev/EventSourcing.html) | §C.4 · §D.3 · §D.6 | 요지만(본문 일부) |
| 재실행 복구 | Temporal Docs, Event History — [docs.temporal.io](https://docs.temporal.io/encyclopedia/event-history/event-history-python) | §D.6 | 요지(기록 재생 · 끝난 활동은 다시 안 함) |
| 조정 고리 | Kubernetes Docs, Controllers — [kubernetes.io](https://kubernetes.io/docs/concepts/architecture/controller/) | §E.1 | 요지(원하는 상태 ↔ 실제 상태) · 수준 기반 · 멱등은 2 차 자료 |
| 머지 큐 | GitHub Docs, Managing a merge queue — [docs.github.com](https://docs.github.com/en/enterprise-server@3.20/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) · Available rules for rulesets — [docs.github.com](https://docs.github.com/en/enterprise-cloud@latest/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) | §D.1 | 요지(규칙 세트로 요구 · `merge_group` 이벤트 필요) — github.com 판이 아닌 Enterprise 문서 |
| worktree | Git, git-worktree — [git-scm.com](https://git-scm.com/docs/git-worktree/2.35.0) | §D.1 | 요지 |
| 자기 관리 고리(참고) | J. O. Kephart, D. M. Chess, "The Vision of Autonomic Computing", IEEE Computer 36(1), 2003, pp. 41–50, DOI 10.1109/MC.2003.1160055 (Crossref) — [researchr](https://researchr.org/publication/KephartC03/bibtex) | (11-21 최소판 보고서의 MAPE-K 와 이어짐 — 본문에서는 쓰지 않음) | 서지만 · MAPE 용어가 이 논문에 있는지는 [확인 필요] |

**조사하지 않은 분야** (지시서 12 장 중): 형식 기법(TLA+ 등 — 상태 기계 검증), 정책 기반 시스템(OPA 등), 다중 에이전트 시스템 문헌 — 이번에는 원문을 찾지 않았다. 형식 기법은 §D.3 의 공유 장부 · fencing 이 서면 그 상태 기계를 검증하는 데 쓸 만하다 [제안 — 다음 단계].
