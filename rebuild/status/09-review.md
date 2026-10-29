# 규칙 검토

> 생성물 — `node rebuild/status.mjs --write`(응답이 끝날 때 훅이 돌림). 손으로 고치지 않는다. 읽기 점검용이며 다른 코드가 읽지 않는다.

원본: `rebuild/rules/review.jsonl` (88 행 · 규칙 83). 규칙이 가리키는 파일·명령·이름·숫자를 지금 저장소와 대조하고, 실제로 쓰이는지·뜻이 서는지 본 결과. 6 단계 옛 규칙 대조에서 사용자가 확인할 목록이다 — 여기서 규칙을 고치지 않는다. 결정된 것 77 행.

| 종류 | 규칙 |
|---|---|
| 현실과 안 맞음 | 6 |
| 재건이 없앨 것 | 2 |
| 쓰이지 않는 층 | 11 |
| 검사만 하고 쓰는 곳 없음 | 2 |
| 이름이 두 뜻 | 3 |
| 아직 닿을 대상이 없음 | 2 |
| 뜻이 서지 않음 | 4 |
| 숫자 근거 없음 | 5 |
| 느슨하게 지켜짐 | 2 |
| 보고서가 지적한 약점 | 9 |
| 실제로 구멍이 났던 규칙 | 21 |
| 망가뜨려도 시험이 못 잡음 | 21 |

## 현실과 안 맞음 `stale` — 6

| 규칙 | 집행 | 내용 | 근거 | 제안 | 결정 |
|---|---|---|---|---|---|
| RULE-0314 | text | 규칙은 `tests/` 의 시험(개수는 `tests/fixtures/FLOOR.json` 이 센다)이 지키고, GitHub A | "시험 195개" — 지금 349 (tests/fixtures/FLOOR.json) | 숫자를 지우고 관리 파일이 센다 | 2026-10-29 user: 권장대로 — 숫자를 문장에서 지우고 관리 파일이 센다 (6b 에서 고침) |
| RULE-0468 | text | **하지 말 것**: 한계·db 서술문을 **영어로 일괄 이관 금지**(반경 크고 신뢰 이득 작음) · 병기를 레코드마다 | "한계 115개" — 지금 124 (data/db.json limitations) | 숫자를 지운다 | 2026-10-29 user: 권장대로 — 숫자를 문장에서 지운다 (6b 에서 고침) |
| RULE-0299 | machine | **본체(main) 금지.** 커밋·push 는 자기 수집 브랜치(`collector/*`)에만, 바뀐 파일은 `workspa | 작업 브랜치 `sonnet/*` — 그런 브랜치는 없고, 결정 ② 는 `collector/*` + 문지기 훅 (RULE-0287 과 모순으로 이미 기록) | 7 단계에서 collector/* 로 고치고 훅으로 집행 | 2026-10-29 user: 권장대로 — 7 단계: 브랜치 이름을 collector/* 로 고치고 문지기 훅으로 집행 |
| RULE-0274 | machine | **B (상주 수집가 세션, 독립 실행 시):** 문지기 훅(`rebuild/gate.mjs` — 저장소 `.claude/se | 막는 설정 틀(workspace/collector.settings.json)은 있다 — apply·merge·register·commit·push 를 deny. 그러나 "비활성 틀" 이라 수집가 세션의 .claude/settings.json 에 손으로 복사해야 켜지고, 규칙 파일은 Edit 만 막고 Write 는 막지 않는다. 저장소 기본 설정(.claude/settings.json)은 같은 명령을 묻기(ask)만 한다. (2026-10-25 정정: 처음엔 틀 파일을 보지 못해 "막지 않는다" 로 적었음) | 7 단계 문지기 훅이 역할(BIODB_ROLE)을 보고 자동으로 막게 — 복사에 기대지 않게. Write 도 막는다 | 2026-10-29 user: 권장대로 — 7 단계: 문지기 훅이 역할을 보고 막게 + 문장 고침 |
| RULE-0275 | machine | `register`·`attest`·`accept` · `collector/*` 밖 브랜치로의 `git commit`·`git | 막는 설정 틀(workspace/collector.settings.json)은 있다 — apply·merge·register·commit·push 를 deny. 그러나 "비활성 틀" 이라 수집가 세션의 .claude/settings.json 에 손으로 복사해야 켜지고, 규칙 파일은 Edit 만 막고 Write 는 막지 않는다. 저장소 기본 설정(.claude/settings.json)은 같은 명령을 묻기(ask)만 한다. (2026-10-25 정정: 처음엔 틀 파일을 보지 못해 "막지 않는다" 로 적었음) | 7 단계 문지기 훅이 역할(BIODB_ROLE)을 보고 자동으로 막게 — 복사에 기대지 않게. Write 도 막는다 | 2026-10-29 user: 권장대로 — 7 단계: 문지기 훅이 역할을 보고 막게 + 문장 고침 |
| RULE-0018 | machine | 권한은 입출력기 clerk 하나 — 단일 작성자 잠금(clerk 서버와 dbtool 의 권위 쓰기가 같은 잠금, 원자적), 권 | "단일 작성자 잠금" — writerLock 은 MCP clerk(mcp/clerk.mjs)만 잡고 dbtool CLI 는 잡지 않으며, 잠금 확인 → 쓰기가 원자적이지 않다(보고서 U4993·U5235). 외부 에이전트가 clerk 를 쓴 기록도 없다(U5185) | 7 단계에서 dbtool 도 잠금을 잡게 하거나 문장을 "MCP 경로만" 으로 고친다 | 2026-10-29 user: 권장대로 — 7 단계: dbtool 도 단일 작성자 잠금을 잡게 + 문장 고침 |

## 재건이 없앨 것 `obsolete_by_design` — 2

| 규칙 | 집행 | 내용 | 근거 | 제안 | 결정 |
|---|---|---|---|---|---|
| RULE-0001 | text | 규칙을 바꾸면 CLAUDE.md 와 agent-rules.md 를 같은 커밋에서 | CLAUDE.md ↔ agent-rules.md 두 곳에 같은 규칙 — 재건이 규칙 장부 하나로 바꾼다 | 6 단계에서 은퇴 (규칙은 장부 한 곳) | 2026-10-29 user: 권장대로 — 8 단계 교체 때 은퇴 (규칙은 장부 한 곳) |
| RULE-0193 | text | 구조 변경 → SCHEMA.md, 작업 규칙 → CLAUDE.md + agent-rules.md, 실패·공백 → limitat | CLAUDE.md ↔ agent-rules.md 두 곳에 같은 규칙 — 재건이 규칙 장부 하나로 바꾼다 | 6 단계에서 은퇴 (규칙은 장부 한 곳) | 2026-10-29 user: 권장대로 — 8 단계 교체 때 은퇴 (규칙은 장부 한 곳) |

## 쓰이지 않는 층 `unused_layer` — 11

| 규칙 | 집행 | 내용 | 근거 | 제안 | 결정 |
|---|---|---|---|---|---|
| RULE-0142 | text | 실행 상태는 db 가 아니라 시나리오 domains·engine/ | P3–P5 층(engine/devs_scheduler.js·hmse·fv_solver·fno_surrogate·p5_dynamic_gate)은 시험만 부르고 실제 경로(운명 엔진·simulateRate·dbtool)는 쓰지 않는다. 운명 엔진은 1.5 단계부터 P5 를 쓰지 않음(U0368) | 적분장(field) 모드로 보관하거나 층 정리(build-plan 85) 때 은퇴 — 사용자 확인 | 2026-10-25 user: 은퇴 — 나중에 쓸 수 있게 rebuild/archive/p3-p5-layer.json 에 정리 |
| RULE-0143 | machine | P3 변경 → node tests/p3_end_to_end.js (\|ΔN\|<1) | P3–P5 층(engine/devs_scheduler.js·hmse·fv_solver·fno_surrogate·p5_dynamic_gate)은 시험만 부르고 실제 경로(운명 엔진·simulateRate·dbtool)는 쓰지 않는다. 운명 엔진은 1.5 단계부터 P5 를 쓰지 않음(U0368) | 적분장(field) 모드로 보관하거나 층 정리(build-plan 85) 때 은퇴 — 사용자 확인 | 2026-10-25 user: 은퇴 — 나중에 쓸 수 있게 rebuild/archive/p3-p5-layer.json 에 정리 |
| RULE-0144 | machine | 원장은 거래로만, 장은 원장에 맞춰 재척도 | P3–P5 층(engine/devs_scheduler.js·hmse·fv_solver·fno_surrogate·p5_dynamic_gate)은 시험만 부르고 실제 경로(운명 엔진·simulateRate·dbtool)는 쓰지 않는다. 운명 엔진은 1.5 단계부터 P5 를 쓰지 않음(U0368) | 적분장(field) 모드로 보관하거나 층 정리(build-plan 85) 때 은퇴 — 사용자 확인 | 2026-10-25 user: 은퇴 — 나중에 쓸 수 있게 rebuild/archive/p3-p5-layer.json 에 정리 |
| RULE-0145 | machine | P4 대리 출력은 같은 단계 OOD 통과 시만 | P3–P5 층(engine/devs_scheduler.js·hmse·fv_solver·fno_surrogate·p5_dynamic_gate)은 시험만 부르고 실제 경로(운명 엔진·simulateRate·dbtool)는 쓰지 않는다. 운명 엔진은 1.5 단계부터 P5 를 쓰지 않음(U0368) | 적분장(field) 모드로 보관하거나 층 정리(build-plan 85) 때 은퇴 — 사용자 확인 | 2026-10-25 user: 은퇴 — 나중에 쓸 수 있게 rebuild/archive/p3-p5-layer.json 에 정리 |
| RULE-0146 | text | P4 속도는 tests/p4_benchmark.js FV 부분 단계 수와 함께 보고 | P3–P5 층(engine/devs_scheduler.js·hmse·fv_solver·fno_surrogate·p5_dynamic_gate)은 시험만 부르고 실제 경로(운명 엔진·simulateRate·dbtool)는 쓰지 않는다. 운명 엔진은 1.5 단계부터 P5 를 쓰지 않음(U0368) | 적분장(field) 모드로 보관하거나 층 정리(build-plan 85) 때 은퇴 — 사용자 확인 | 2026-10-25 user: 은퇴 — 나중에 쓸 수 있게 rebuild/archive/p3-p5-layer.json 에 정리 |
| RULE-0147 | machine | P4 L2<2% + tests/p4_end_to_end.js | P3–P5 층(engine/devs_scheduler.js·hmse·fv_solver·fno_surrogate·p5_dynamic_gate)은 시험만 부르고 실제 경로(운명 엔진·simulateRate·dbtool)는 쓰지 않는다. 운명 엔진은 1.5 단계부터 P5 를 쓰지 않음(U0368) | 적분장(field) 모드로 보관하거나 층 정리(build-plan 85) 때 은퇴 — 사용자 확인 | 2026-10-25 user: 은퇴 — 나중에 쓸 수 있게 rebuild/archive/p3-p5-layer.json 에 정리 |
| RULE-0148 | unchecked | P5 경로는 engine/p5_dynamic_gate.js 의 N_sub·히스테리시스·γ 로만 | P3–P5 층(engine/devs_scheduler.js·hmse·fv_solver·fno_surrogate·p5_dynamic_gate)은 시험만 부르고 실제 경로(운명 엔진·simulateRate·dbtool)는 쓰지 않는다. 운명 엔진은 1.5 단계부터 P5 를 쓰지 않음(U0368) | 적분장(field) 모드로 보관하거나 층 정리(build-plan 85) 때 은퇴 — 사용자 확인 | 2026-10-25 user: 은퇴 — 나중에 쓸 수 있게 rebuild/archive/p3-p5-layer.json 에 정리 |
| RULE-0149 | machine | P5 전이마다 exactAnchor ≤1e-15 | P3–P5 층(engine/devs_scheduler.js·hmse·fv_solver·fno_surrogate·p5_dynamic_gate)은 시험만 부르고 실제 경로(운명 엔진·simulateRate·dbtool)는 쓰지 않는다. 운명 엔진은 1.5 단계부터 P5 를 쓰지 않음(U0368) | 적분장(field) 모드로 보관하거나 층 정리(build-plan 85) 때 은퇴 — 사용자 확인 | 2026-10-25 user: 은퇴 — 나중에 쓸 수 있게 rebuild/archive/p3-p5-layer.json 에 정리 |
| RULE-0150 | unchecked | mode:'fv' 결과 비트 불변 | P3–P5 층(engine/devs_scheduler.js·hmse·fv_solver·fno_surrogate·p5_dynamic_gate)은 시험만 부르고 실제 경로(운명 엔진·simulateRate·dbtool)는 쓰지 않는다. 운명 엔진은 1.5 단계부터 P5 를 쓰지 않음(U0368) | 적분장(field) 모드로 보관하거나 층 정리(build-plan 85) 때 은퇴 — 사용자 확인 | 2026-10-25 user: 은퇴 — 나중에 쓸 수 있게 rebuild/archive/p3-p5-layer.json 에 정리 |
| RULE-0151 | machine | P5 변경 → tests/p5_dynamic_promotion.js, 속도는 구간별 N_sub 와 (N_sub<15 ≈1×) | P3–P5 층(engine/devs_scheduler.js·hmse·fv_solver·fno_surrogate·p5_dynamic_gate)은 시험만 부르고 실제 경로(운명 엔진·simulateRate·dbtool)는 쓰지 않는다. 운명 엔진은 1.5 단계부터 P5 를 쓰지 않음(U0368) | 적분장(field) 모드로 보관하거나 층 정리(build-plan 85) 때 은퇴 — 사용자 확인 | 2026-10-25 user: 은퇴 — 나중에 쓸 수 있게 rebuild/archive/p3-p5-layer.json 에 정리 |
| RULE-0237 | machine | 충격·OOD 는 같은 단계 강등 + W 냉각 | P3–P5 층(engine/devs_scheduler.js·hmse·fv_solver·fno_surrogate·p5_dynamic_gate)은 시험만 부르고 실제 경로(운명 엔진·simulateRate·dbtool)는 쓰지 않는다. 운명 엔진은 1.5 단계부터 P5 를 쓰지 않음(U0368) | 적분장(field) 모드로 보관하거나 층 정리(build-plan 85) 때 은퇴 — 사용자 확인 | 2026-10-25 user: 은퇴 — 나중에 쓸 수 있게 rebuild/archive/p3-p5-layer.json 에 정리 |

## 검사만 하고 쓰는 곳 없음 `no_consumer` — 2

| 규칙 | 집행 | 내용 | 근거 | 제안 | 결정 |
|---|---|---|---|---|---|
| RULE-0138 | machine | 분자 정의항 tier(T1\|T2) 필수 | tier 는 정의항 156 개에 있고 사법부가 검사하지만, 엔진·컴파일러·simulateRate 어느 것도 읽지 않는다 | 적분장 엔진 전까지 "예약 칸" 으로 표시하거나 필수를 푼다 — 규칙 변경이라 사용자 결정 | 2026-10-25 user: 맥락으로 쓸 수 있게 적는다 — 예약(reserved) 표시와 이유 연결 |
| RULE-0139 | machine | 확산·pH·유전율은 위치(context.location) + SI | pH·유전율은 simulateRate 환경 보정이 쓰지만, 확산 계수는 데이터 0 건이고 읽는 코드가 없다 | 확산 부분은 "예약" 으로 표시 | 2026-10-25 user: 맥락으로 쓸 수 있게 적는다 — 예약(reserved) 표시와 이유 연결 |

## 이름이 두 뜻 `naming_collision` — 3

| 규칙 | 집행 | 내용 | 근거 | 제안 | 결정 |
|---|---|---|---|---|---|
| RULE-0082 | text | 해상도 structure(구조)는 속도 상수로 못 가르는 반응 중심만, 경쟁(competition)은 Kd·kcat·Km 먼저 | "R2" 가 두 뜻 — 해상도 R2(반응 중심) 와 사전의 R2(원문 통과, RULE-0463) | 해상도 쪽 이름을 바꾸고 번호 사전에 둘 다 등록 | 2026-10-29 user: 권장대로 — 해상도 쪽 이름을 바꾸고 번호 사전에 둘 다 등록 (6b) |
| RULE-0453 | text | 6 \| 시나리오의 **가상 값** (`hypothetical: true`) \| 엔진이 작동한다는 것만. 생물학적 결론 금지 | "등급 1–6" 이 두 체계 — 교과서 06 의 읽기 등급(curated…가상 값) 과 신뢰 지표의 6 칸(anchor…blocked, RULE-0426·0434) | 읽기 표를 "근거 수준" 으로 부르거나 신뢰 지표로 합친다 | 2026-10-29 user: 권장대로 — 교과서 읽기 등급을 '근거 수준' 으로 부름 (6b) |
| RULE-0138 | machine | 분자 정의항 tier(T1\|T2) 필수 | "T1·T2·T3" 가 두 뜻 — 층(tier: T1 연속 장·T2 규칙 행위자·T3 영역) 과 해상도 계획의 필요(T1 부위 사건·T2 화학량·T3 경쟁, U2033) | 해상도 쪽 이름을 바꾸고 번호 사전에 둘 다 등록 (RULE-0082 의 R2 와 함께) | 2026-10-29 user: 권장대로 — 해상도 쪽 이름을 바꾸고 번호 사전에 둘 다 등록 (6b) — 데이터 tier T1/T2 는 그대로 |

## 아직 닿을 대상이 없음 `unreachable` — 2

| 규칙 | 집행 | 내용 | 근거 | 제안 | 결정 |
|---|---|---|---|---|---|
| RULE-0227 | machine | 기준(standard)은 독립 단위 ≥ 2 — I 축(52) 전에는 아무것도 닿지 못함 | 기준(standard)은 I 축(build-plan 52) 전에는 어떤 기록도 닿지 못한다 — 지금은 지배하는 대상이 없다 | I 축이 생길 때까지 "예약" 으로 표시 | 2026-10-29 user: 권장대로 — 예약 — I 축(build-plan 52)이 생기면 켠다 |
| RULE-0465 | text | 한 줄: **정준 텍스트 = 권위(봉인·감사) · SQLite 색인(16) = 파생 질의 · 뷰어(19) = 렌더.** 셋을  | SQLite 색인(16)·뷰어 조각(19) 은 아직 코드가 없다 | 계획 항목으로 옮기고 규칙에서 뺀다 | 2026-10-29 user: 권장대로 — 예약 — SQLite 색인(16)·뷰어(19)가 생기면 켠다 |

## 뜻이 서지 않음 `unclear` — 4

| 규칙 | 집행 | 내용 | 근거 | 제안 | 결정 |
|---|---|---|---|---|---|
| RULE-0252 | text | 두 해상도를 지킨다 | "두 해상도를 지킨다" — 무엇을 하면 어기는지 문장에 없음 (RULE-0068·0069 와 겹침) | 0068·0069 의 사본으로 묶는다 | 2026-10-29 user: 권장대로 — RULE-0068 의 사본으로 묶음 (6b) |
| RULE-0469 | text | 병기(ko·en 을 나란히 적기)를 레코드마다 손으로 뿌리지 않는다 — 손으로 뿌린 병기는 사전과 어긋난다(drift). 병기 | "손으로 뿌리지 않음(drift)" — 앞 문장 없이 떨어져 나온 조각, 무엇을 뿌리는지 없음 | 원문 앞 줄과 합쳐 다시 쓴다 | 2026-10-29 user: 권장대로 — 원문 앞 줄과 합쳐 다시 씀 (6b) |
| RULE-0284 | machine | `tests/rejections.test.mjs` 가 자동으로 잡지만, 사람 눈으로도 한 번 본다. | "사람 눈으로도 한 번 본다" — 누가·언제 보는지 없고 집행할 수 없음 | 점검·검증(inspect) 모드의 확인 항목으로 옮기거나 지운다 | 2026-10-29 user: 권장대로 — 점검·검증(inspect) 모드의 확인 항목으로 옮김 (6b) |
| RULE-0307 | text | (서브에이전트면 **파일에 쓰지 말고 반환**, 상주 수집가 세션이면 `workspace/handoff/<과제>.jsonl`  | "상주 세션이면 이 표에 append" — 어느 표인지 문장 밖에서만 알 수 있음, 상주 세션 방식(B)은 결정 ② 와 겹침 | 7 단계에서 수집가 쓰기 자리를 하나로 정리 | 2026-10-29 user: 권장대로 — 7 단계: 수집가 쓰기 자리를 하나로 정리 |

## 숫자 근거 없음 `number_unexplained` — 5

| 규칙 | 집행 | 내용 | 근거 | 제안 | 결정 |
|---|---|---|---|---|---|
| RULE-0010 | machine | 부분 구조 수지 ΣIn=ΣOut 상대 1e-14 (규칙 검사·운명 원장) | 상대 1e-14 — 배정도 반올림 수준이라는 근거가 어디에도 적혀 있지 않음 | 숫자 기록(수식 기록, 6 단계)에 근거를 단다 | — |
| RULE-0037 | machine | 속도 법칙 변경 = 컴파일러·테이프 명세·judicial/derivative.js 재구성 같은 커밋, 도함수 ≤1e-14 | 상대 1e-14 — 배정도 반올림 수준이라는 근거가 어디에도 적혀 있지 않음 | 숫자 기록(수식 기록, 6 단계)에 근거를 단다 | — |
| RULE-0052 | machine | 수치 L2 수렴 기준은 같은 적분기 허용 오차 1/1000 (orchestrator.refScenario) | 수렴 기준 = 허용 오차 1/1000 — 왜 1000 배인지 기록 없음 | 같음 | — |
| RULE-0162 | machine | compare: 결과 같고 비용만 늘며 이득 <1e-5 → Optimization-Negative, 넣지 않음 | 이득 < 1e-5 · 시간 +5% — 문턱의 근거 기록 없음 | 같음 | — |
| RULE-0090 | text | 불확도 미보고면 sd = 유효 숫자 해상도 + note | 미보고 불확도 sd = 유효 숫자 해상도 — 관례인지 근거 기록 없음 | 같음 | — |

## 느슨하게 지켜짐 `loosely_followed` — 2

| 규칙 | 집행 | 내용 | 근거 | 제안 | 결정 |
|---|---|---|---|---|---|
| RULE-0196 | text | 주석은 계약·이유만, 이력은 CHANGES.md | "주석은 계약·이유만, 이력은 CHANGES" — 코드 주석에 날짜·"예전" 같은 이력이 약 30 줄 | 5c 에서 판정 시험으로 올릴지 정한다 | — |
| RULE-0052 | machine | 수치 L2 수렴 기준은 같은 적분기 허용 오차 1/1000 (orchestrator.refScenario) | orchestrator.js refScenario 는 rtol 1e-9·atol 1e-5 를 박아 둔다 — 기본값(1e-6·1e-2)의 1/1000 일 뿐, 시나리오가 rtol 1e-8 이면 기준해는 1/10. 같은 파일 101 행 주석은 '1/100'. 수치 선택이 coupling 등록부 밖에 있음(RULE-0011 과도 겹침) | 기준해 허용 오차 = 시나리오 integrator 값 × 1/1000 으로 계산하고 배율은 coupling 등록부에 — 조정자 변경이라 사용자 확인 뒤 | 2026-10-26 user: 권장대로 — 기준해 허용 오차를 시나리오 값 × 등록부 ref_tol_factor 로 계산 + 시험 |

## 보고서가 지적한 약점 `weakness_reported` — 9

| 규칙 | 집행 | 내용 | 근거 | 제안 | 결정 |
|---|---|---|---|---|---|
| RULE-0081 | text | 시뮬레이션 보고에 농도 공백(기본값·무한 풀) 명시 — 도달 여부만 말함 | 보고서 U5236·U4991·U4992: 모르는 시작량은 10·1000 분자로 채워 실행이 늘 끝까지 돈다 — "농도 공백" 표시가 있어 다룬 것처럼 느껴지지만 근사가 궤적에 숫자로 숨어 쌓인다. 시나리오가 늘 데이터를 이겨 데이터를 고쳐도 결과가 안 바뀔 수 있다 | 보고서·결론에서 기본값이 닿은 양을 판정에 쓰지 못하게(5c 에서 집행 확인) | 2026-10-29 user: 권장대로 — 한계로 등록 — 정보 작성 모드 새 세션의 일로 전환 기록 (6c 전환 기록 형식으로) |
| RULE-0390 | text | 시작량: 시나리오 `reservoirs` / `amounts` → 데이터(copy_number, 또는 concentration | 보고서 U5236·U4991·U4992: 모르는 시작량은 10·1000 분자로 채워 실행이 늘 끝까지 돈다 — "농도 공백" 표시가 있어 다룬 것처럼 느껴지지만 근사가 궤적에 숫자로 숨어 쌓인다. 시나리오가 늘 데이터를 이겨 데이터를 고쳐도 결과가 안 바뀔 수 있다 | 보고서·결론에서 기본값이 닿은 양을 판정에 쓰지 못하게(5c 에서 집행 확인) | 2026-10-29 user: 권장대로 — 한계로 등록 — 정보 작성 모드 새 세션의 일로 전환 기록 (6c 전환 기록 형식으로) |
| RULE-0169 | machine | 막 단계는 volumes[막] | 보고서 U5030: 막 단계의 반응 부피는 시나리오가 고른 막 유효 부피 — 생물 근거가 아니라 선택이라 시나리오마다 같은 규칙이 다른 속도 | 막 유효 부피를 위치 정의항의 관찰로(보고서 R10, U5062), 없으면 Concentration_Gap | 2026-10-29 user: 권장대로 — 한계로 등록 — 정보 작성 모드 새 세션의 일로 전환 기록 (6c 전환 기록 형식으로) |
| RULE-0364 | machine | 위치 조건(`where`)과 **공간 접촉**: 반응 중심(행위자, 없으면 대상)과 모든 참여자가 맞닿을 수 있어야 한다. 3 | 보고서 U5030: 막 단계의 반응 부피는 시나리오가 고른 막 유효 부피 — 생물 근거가 아니라 선택이라 시나리오마다 같은 규칙이 다른 속도 | 막 유효 부피를 위치 정의항의 관찰로(보고서 R10, U5062), 없으면 Concentration_Gap | 2026-10-29 user: 권장대로 — 한계로 등록 — 정보 작성 모드 새 세션의 일로 전환 기록 (6c 전환 기록 형식으로) |
| RULE-0378 | machine | 법칙(`kineticLaws`): `mass_action`(k, order — 차수 = 반응물 분자 수 + 행위자 수) · ` | 보고서 U4996: 미카엘리스–멘텐이 첫 기질 하나만 포화 항에 넣는다 — 두 기질 효소는 둘째 기질 농도와 무관하게 돈다 | 다기질 법칙 또는 Kinetic_Gap 등록(속도 법칙 변경은 컴파일러·테이프·derivative.js 같은 커밋) | 2026-10-29 user: 권장대로 — 한계로 등록 — 정보 작성 모드 새 세션의 일로 전환 기록 (6c 전환 기록 형식으로) |
| RULE-0367 | text | **사슬 연결**: 한 단계의 출력 묶음 키가 다른 단계의 입력·행위자·조절자 묶음 키와 같으면 이어진다. `minor`(부산 | 보고서 U4999·U5002: simulateRate 는 단계 순서대로 갱신 — 같은 입력을 다투면 목록 앞 단계가 먼저 가져가 결과가 파일 순서에 달린다 | 경쟁 단계가 있으면 "순서 의존" 표시(보고서 R11, U5063) | 2026-10-29 user: 권장대로 — 한계로 등록 — 정보 작성 모드 새 세션의 일로 전환 기록 (6c 전환 기록 형식으로) |
| RULE-0391 | text | 공급 규칙은 시뮬레이션의 묶음에 닿으면 켜지고, 그 규칙의 다른 분자도 저장소가 된다(닫힌 집합이 될 때까지). 속도 상수나  | 보고서 U4999·U5002: simulateRate 는 단계 순서대로 갱신 — 같은 입력을 다투면 목록 앞 단계가 먼저 가져가 결과가 파일 순서에 달린다 | 경쟁 단계가 있으면 "순서 의존" 표시(보고서 R11, U5063) | 2026-10-29 user: 권장대로 — 한계로 등록 — 정보 작성 모드 새 세션의 일로 전환 기록 (6c 전환 기록 형식으로) |
| RULE-0175 | machine | 확률은 stochastic {seed} (실행 전) | 보고서 U5008: 확률 층 성향을 MM·힐 같은 연속 법칙에서 그대로 씀 — 적은 분자 수에서 근사인데 한계로 등록돼 있지 않다 | 한계로 등록 | 2026-10-29 user: 권장대로 — 한계로 등록 — 정보 작성 모드 새 세션의 일로 전환 기록 (6c 전환 기록 형식으로) |
| RULE-0170 | text | simulateRate 와 서로 기준 금지 (L000081) | 보고서 U5234·U5243: simulateRate 를 결합 적분으로 옮기지 않고 "서로 기준 금지"(L000081)를 한계로 남겨 두 엔진이 같은 규칙을 다르게 푼다 — 한계 등록이 고침 대신 기록의 출구가 됨 | 대체에는 제거 기한(보고서 P2) | 2026-10-29 user: 권장대로 — 한계로 등록 — 정보 작성 모드 새 세션의 일로 전환 기록 (6c 전환 기록 형식으로) |

## 실제로 구멍이 났던 규칙 `broken_before` — 21

| 규칙 | 집행 | 내용 | 근거 | 제안 | 결정 |
|---|---|---|---|---|---|
| RULE-0013 | machine | 파일 쓰기는 legislative/clerk.mjs 만, 모든 쓰기는 put(구역, 파일) | CHG-0050: 경로 경계가 표시뿐이었고 실제 구멍 둘(commitMerge dbPath·fetchToInbox) | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 '① 쓰기 권한: 파일 쓰기 코드는 legislative/clerk.mjs 와 migrati' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |
| RULE-0014 | machine | 새 쓰기는 구역을 고르거나 새로 선언, put 우회 금지 | CHG-0050: 경로 경계가 표시뿐이었고 실제 구멍 둘(commitMerge dbPath·fetchToInbox) | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 '④′ 구역(Zone): 쓰기는 모두 구역을 지나고, 저장소 안의 다른 구역에 쓰려 하면 거' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |
| RULE-0165 | machine | 정제 점검 자동 — 새 중복·미등록 모순은 관문 거부 | CHG-0067: why 필수·미등록 한계·정제 점검이 CLI 에만 있어 직접 호출로 건너뜀 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 '① 거부 말뭉치: 나쁜 패치가 모두 거부되고, 사유가 그대로다' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |
| RULE-0190 | machine | why 없음·미등록 한계 후보·새 정제 문제는 관문(patchPolicy) 거부 | CHG-0067: why 필수·미등록 한계·정제 점검이 CLI 에만 있어 직접 호출로 건너뜀 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 '① 거부 말뭉치: 나쁜 패치가 모두 거부되고, 사유가 그대로다' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |
| RULE-0105 | machine | 문턱은 min_grade 로 올리기만 — 낮추거나 비교 못 하는 등급은 관문 거부 | CHG-0194: "문턱은 올리기만" 이 글로만 있어 reference 문턱이 통과 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 '⑫ 관문 문턱은 올리기만: 기본보다 느슨하거나 비교할 수 없는 문턱은 거부 · 지금 데이터' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |
| RULE-0106 | machine | 문턱 비교는 순번이 아니라 축 조건 (reliability.THRESHOLD) | CHG-0194: "문턱은 올리기만" 이 글로만 있어 reference 문턱이 통과 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 '⑦ 관문은 인정의 추정 조건을 본다: 다른 종 상수 거부 · 조건부(오차 막대)도 관문은 ' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |
| RULE-0229 | machine | bounded(S4,D2)와 parameter(S3,D3)는 서로의 문턱을 넘지 못한다 | CHG-0194: "문턱은 올리기만" 이 글로만 있어 reference 문턱이 통과 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 '⑫ 관문 문턱은 올리기만: 기본보다 느슨하거나 비교할 수 없는 문턱은 거부 · 지금 데이터' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |
| RULE-0084 | machine | 문헌 값은 관찰(O…) 먼저 + kinetics.from (lumped 도 원 관찰 참조) | CHG-0062: 레드팀 공격 11 건 중 7 건 통과 — 정의항 obs 가 관찰과 안 묶임 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 '③ 실측 상수 = 관찰의 파생값: from 이 같은 규칙·칸·값을 가리켜야 하고, 검증용 ' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |
| RULE-0127 | machine | 정의항 obs 의 curated 측정값은 from: 'O…' | CHG-0062: 레드팀 공격 11 건 중 7 건 통과 — 정의항 obs 가 관찰과 안 묶임 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 'RULE-0127 정의항 obs 의 문헌(curated) 측정값은 관찰 기록(from)을 ' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |
| RULE-0444 | machine | (`checkSenseObsFrom` — `checkKineticsFrom` 의 거울). 철회된 관찰이나 `use: valid | CHG-0062: 레드팀 공격 11 건 중 7 건 통과 — 정의항 obs 가 관찰과 안 묶임 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 '② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |
| RULE-0109 | machine | 도구 추정(computed·predicted)은 실측이 아님 (D2.estimate) | CHG-0192: 계산값(eQuilibrator ΔG°′ 8 개)이 실측 등급을 받음 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 '⑩ 도구 추정값은 D2.estimate · 반복 수 미보고(null)는 받되 D3 · 비교' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |
| RULE-0231 | machine | 미보고 반복 수는 D3, 비교는 1 회로 본다 | CHG-0192: 계산값(eQuilibrator ΔG°′ 8 개)이 실측 등급을 받음 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 '⑩ 도구 추정값은 D2.estimate · 반복 수 미보고(null)는 받되 D3 · 비교' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |
| RULE-0433 | text | `evidence` 검증 근거 \| S ≥ 3 ∧ D ≥ 2 ∧ 불일치 아님 \| 기준 종 · 확인된 문헌(S3.unconfi | CHG-0186: DOI 글자만 있으면 S3 — 원고·철회 논문도 포함 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | — |
| RULE-0100 | machine | 결론은 가장 약한 근거를 따름 (acceptance_review — 보고서·observe·fate) | CHG-0198: 관문과 인정이 따로 판정, 승인 경과가 덮어써짐 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 '⑥ 결론은 가장 약한 근거를 따른다 — 검증 세트 관찰이 인정되지 않으면 보고서 판정이 인' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |
| RULE-0101 | machine | 시뮬레이션 관문도 같은 판정 (문턱 ∧ '추정' accepted, 종 = kinetics.context.species) | CHG-0198: 관문과 인정이 따로 판정, 승인 경과가 덮어써짐 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 '⑦ 관문은 인정의 추정 조건을 본다: 다른 종 상수 거부 · 조건부(오차 막대)도 관문은 ' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |
| RULE-0102 | machine | 승인 도장은 추가만 (마지막이 유효) | CHG-0198: 관문과 인정이 따로 판정, 승인 경과가 덮어써짐 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 '⑨ 승인 이력: 승인 → 철회 → 재승인이 등록부에 모두 남고 마지막이 유효 · 같은 도장' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |
| RULE-0228 | text | 판정은 하나 — 용도별 판정 함수는 reliability.accept 하나, 관문·observe·fate·증거 보고서가 모두  | CHG-0198: 관문과 인정이 따로 판정, 승인 경과가 덮어써짐 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | — |
| RULE-0456 | text | 판정 셋: **CONSISTENT**(FINDING — 가설 하나면 선언된 허용 차이 δ 안임을 동등성 검정(TOST)으로 * | CHG-0077: p ≥ α 를 일치로 셈 — 오차 막대가 크면 무엇이든 일치 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | — |
| RULE-0486 | text | CONSISTENT \| (사전 등록된 규약의 검증 세트 관찰만 — build-plan 3) 가설 하나: 선언된 δ(근거 등급 | CHG-0077: p ≥ α 를 일치로 셈 — 오차 막대가 크면 무엇이든 일치 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | — |
| RULE-0494 | text | **에이전트의 지식은 기준이 아니다** — 기준은 출처가 있는 관찰로만. 에이전트 지식은 §5 처럼 "후보" 를 만드는 데까지 | CHG-0180: 시나리오 점검의 기준이 에이전트 지식이었음 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | — |
| RULE-0096 | machine | 추세 도장은 원천별 창 vocab.consensus.sources 뒤 다시 unchecked | CHG-0190: 365 일 창은 근거 없는 숫자였음 | 지금 집행 방식을 5c 에서 거부 시험으로 확인 | 2026-10-29 claude: 확인됨 — 5c 변이 시험에서 집행 자리를 망가뜨리면 '⑨ 합의 창은 원천별 판 주기 — 같은 나이라도 원천마다 만료가 다르고, 창이 없는 원천은' 가 빨개짐 (rebuild/rules/enforcement.jsonl) |

## 망가뜨려도 시험이 못 잡음 `enforcement_gap` — 21

| 규칙 | 집행 | 내용 | 근거 | 제안 | 결정 |
|---|---|---|---|---|---|
| RULE-0011 | machine | 수치 선택(정칙화·문턱·탐침 격자·뉴턴 허용 오차)은 engine/coupling.js 등록부에서만, 엔진에 기본값 금지 | 변이 시험(rebuild/rules/enforcement.jsonl): engine/fate_engine.js 끝에 `x.rtol \|\| 1e-6` 을 넣어도 governance ⑥ 이 통과 — 검사가 기본값을 String(1e-6) = '0.000001' 로 찾아 지수 표기를 못 보고, fate_engine.js 한 파일만 본다(engine/* 의 다른 파일·orchestrator 는 안 봄) | 검사가 숫자 표기 무관(값으로 비교)·engine/* 전체를 보게 고치기 — 시험 변경이라 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |
| RULE-0033 | machine | 희소 LU 기호 분석 sparse_lu.js 는 사법부 checkLU 가 검증 | 변이 시험(rebuild/rules/enforcement.jsonl): judicial/derivative.js checkLU 의 대각 위치 검사를 끄면(problems.push 안 함) 아무 시험도 빨개지지 않음 — governance ⑧ 은 정상 LU 만 넣고 망가진 LU 를 거부하는지 보지 않음 | 망가진 기호 분석(대각 자리 틀림)을 넣어 checkLU 가 거부하는 시험 추가 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |
| RULE-0052 | machine | 수치 L2 수렴 기준은 같은 적분기 허용 오차 1/1000 (orchestrator.refScenario) | 변이 시험(rebuild/rules/enforcement.jsonl): orchestrator.js refScenario 의 기준해 허용 오차를 바꿔도 시험이 통과 — 기준해 값을 확인하는 시험이 없음 (같은 규칙의 loosely_followed 항목과 함께 볼 것) | refScenario 의 허용 오차를 시나리오에서 계산하게 고친 뒤 그 값을 확인하는 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 권장대로 — 기준해 허용 오차를 시나리오 값 × 등록부 ref_tol_factor 로 계산 + 시험 |
| RULE-0064 | machine | physiological 의 verified 는 켤레 관계 + Rhea ≥3 통과 시 | 변이 시험(rebuild/rules/enforcement.jsonl): judicial/identity.js 의 Rhea 반응 수(RHEA_MIN) 미달 거부를 꺼도 통과 — Rhea 가 3 개 미만인 physiological 을 넣어 보는 시험이 없음 | Rhea 2 개짜리 합성 수신함으로 verified 거부 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |
| RULE-0066 | machine | 다른 값 asserted 는 --sync 요청 시만 바꾼다 | 변이 시험(rebuild/rules/enforcement.jsonl): legislative/augment_draft.js 가 --sync 없이도 다른 값을 덮게 바꿔도 통과 — --sync 없는 경우 값 유지를 보는 시험이 없음 | --sync 없음 · 있음 두 경우의 초안 비교 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 권장대로 — 시험 추가 (tests/enforcement_gaps.test.mjs) |
| RULE-0111 | machine | 추정용을 검증에 쓰지 않음 | 변이 시험(rebuild/rules/enforcement.jsonl): checkKineticsFrom 의 '용도가 … 인 관찰은 모델 값의 출처로 쓸 수 없음' 을 꺼도 통과 — validation 관찰을 kinetics.from 에 건 거부 말뭉치가 없음(상수 쪽은 0405 가 잡음) | validation 용도 관찰을 obs.from 에 건 패치를 거부 말뭉치에 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |
| RULE-0114 | machine | 정성 관찰은 kind: qualitative — 교란·readout·expect | 변이 시험(rebuild/rules/enforcement.jsonl): validateQualitative 의 readout.target 없음 거부를 꺼도 통과 — 정성 관찰 시험이 대상 빠진 경우를 넣지 않음 | readout.target 이 빠진 정성 관찰 거부 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |
| RULE-0123 | machine | 이동된 번호는 쓰지 않음 | 변이 시험(rebuild/rules/enforcement.jsonl): validateMoved 의 '이동된 번호가 아직 표에 있음' 을 꺼도 통과 — moved 뒤 옛 번호를 다시 쓰는 경우를 넣는 시험이 없음 | 이동된 번호를 다시 쓰는 패치를 거부 말뭉치에 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |
| RULE-0127 | machine | 정의항 obs 의 curated 측정값은 from: 'O…' | 변이 시험(rebuild/rules/enforcement.jsonl): checkSenseObsFrom 의 curated obs 에 from 없음 거부를 꺼도 통과 — 집행 자리에 적힌 'rejections 2b' 는 다른 사유로도 거부되어 이 자리를 꺼도 빨개지지 않음 | 2b 말뭉치를 이 사유 하나만 남게 다듬거나 전용 거부 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |
| RULE-0153 | machine | 매개 단계를 묶으면 Regulatory_Gap | 변이 시험(rebuild/rules/enforcement.jsonl): detectGaps 의 '힐 상수 없는 조절 → Regulatory_Gap 후보' 를 꺼도 통과 — limitations --detect 후보 0 시험은 후보가 생기지 않는 쪽만 봄 | 상수 없는 조절 규칙을 넣으면 후보가 나오는지 보는 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |
| RULE-0168 | machine | 결합 적분은 질량 작용·가역 결합(정·역)·MM 만, 나머지는 Kinetic_Gap | 변이 시험(rebuild/rules/enforcement.jsonl): ir_builder.js 의 지원하지 않는 단계 법칙(step_law_unsupported) 거부를 꺼도 통과(느린 mhc 시험 포함) — 지원 밖 법칙을 넣어 보는 시험이 없음 | hill 등 지원 밖 법칙 단계를 넣으면 Kinetic_Gap/오류가 나는지 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |
| RULE-0169 | machine | 막 단계는 volumes[막] | 변이 시험(rebuild/rules/enforcement.jsonl): ir_builder.js 의 막 단계 부피(volumes[막])를 고정값 1e-15 로 바꿔도 통과(mhc ⑪ 포함) — 시험 시나리오에 막 단계가 없거나 부피가 같은 값 | 막 부피가 다른 시나리오로 cinv 를 대조하는 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 claude: 구멍 아님 — 처음 변이가 동작을 바꾸지 못했음. 막 위치 고르기를 끄는 변이는 기존 MHC 시험이 잡음 (직접 시험도 추가) |
| RULE-0182 | machine | 규약 없는 실행은 탐색 실행 (일치 결론 불가) | 변이 시험(rebuild/rules/enforcement.jsonl): judicial/protocol.js 가 규약 없는 실행을 '규약 통과' 로 내게 바꿔도 통과 — 규약 없는 실행의 판정을 보는 시험이 없음 | 규약 없는 시나리오가 탐색 실행(일치 결론 불가)으로 나오는지 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |
| RULE-0223 | machine | 합의 수신함(data/fetched/consensus/)은 신원 수신함을 덮지 않는다 | 변이 시험(rebuild/rules/enforcement.jsonl): judicial/trend.js 의 합의 수신함 경로를 신원 수신함(data/fetched)으로 바꿔도 통과 — 두 수신함 분리를 보는 시험이 없음 | 합의 수신함 경로가 data/fetched/consensus 인지·신원 파일을 읽지 않는지 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |
| RULE-0224 | machine | 표에 없는 원천은 창이 없으니 만료 — 창을 지어내지 않는다 | 변이 시험(rebuild/rules/enforcement.jsonl): trend.js 의 '창이 없는 원천은 만료' 를 '창이 없으면 유지' 로 바꿔도 통과 — 표에 없는 원천을 넣는 시험이 없음 | vocab.consensus.sources 에 없는 원천 도장이 unchecked 로 돌아가는지 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |
| RULE-0245 | machine | FAIL 조건: 원장·재생 1e-14 초과 · 신호가 일정과 다름 · 궤적 해시 다름 · 쓰인 상수가 입력과 다름 | 변이 시험(rebuild/rules/enforcement.jsonl): process_report.js 의 'AUDIT_MASS 없음' FAIL 조건을 늘 참으로 바꿔도 통과 — 질량 감사가 실패한 원자료로 보고서를 만드는 시험이 없음 | 질량 수지가 깨진 원자료로 증명서가 FAIL 인지 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 권장대로 — 시험 추가 (tests/enforcement_gaps.test.mjs) |
| RULE-0289 | machine | 후보마다 값·단위·종·세포·시각·불확도·출처+인용·use·규약 가능 | 변이 시험(rebuild/rules/enforcement.jsonl): collection_audit.js 의 '값 없음 → incomplete' 를 꺼도 통과 — 수집 시험이 값이 빠진 read_value 후보를 넣지 않음 | 값 빠진 후보가 INCOMPLETE 인지 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |
| RULE-0327 | machine | 가리키는 개념의 뜻이 여러 개면 거부하고 후보를 보여 준다. 없는 이름이면 거부하고 비슷한 이름을 제안한다. | 변이 시험(rebuild/rules/enforcement.jsonl): merge 의 '이름이 여러 개념과 겹침' 거부를 꺼도 통과 — 겹치는 이름으로 가리키는 패치가 거부 말뭉치에 없음 | 겹치는 이름 패치를 거부 말뭉치에 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 권장대로 — 시험 추가 (tests/enforcement_gaps.test.mjs) |
| RULE-0374 | machine | 시뮬레이터는 기본값·무한 풀로 시작량을 정한 묶음을 표시하고, 그 경로의 Concentration_Gap 이 등록되어 있지 않 | 변이 시험(rebuild/rules/enforcement.jsonl): simulateText 의 '⚠ 농도 공백' 줄을 지워도 통과 — 보고 글에 농도 공백이 찍히는지 보는 시험이 없음 | 기본값으로 시작하는 시뮬레이션 글에 농도 공백 줄이 있는지 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |
| RULE-0436 | machine | 모체만 적힌 저분자 \| 경고 — 반응 참여자(physiological)를 함께 적는 것이 규약 | 변이 시험(rebuild/rules/enforcement.jsonl): validateSense 의 '중성 모체만 적혀 있음' 경고를 꺼도 통과 — 경고는 오류가 아니라 지금 저장소에 해당 항목이 없으면 아무 시험도 안 봄 | 모체만 있는 합성 정의항으로 경고가 나오는지 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |
| RULE-0451 | machine | **기록**: `{ seq, at, id: 'A' + 여섯 자리 순번, slot { kind: kinetics \| amoun | 변이 시험(rebuild/rules/enforcement.jsonl): assumption_audit.js checkRecord 의 기원(origin) 어휘 밖 거부를 꺼도 통과 — 가정 원장 시험이 모르는 기원을 넣지 않음 | 모르는 origin 기록 거부 시험 — 시험 추가는 사용자 확인 뒤 | 2026-10-26 user: 이유가 있어 시험 추가 (tests/enforcement_gaps.test.mjs · RULE-0011 은 governance ⑥ 강화) |

## 형식 오류

없음
