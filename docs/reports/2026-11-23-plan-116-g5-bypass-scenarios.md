# PLAN-116 G3 · G5 — 도장 권한 분리 · 우회 시나리오 검증 (DEC-0078 · DEC-0079)

> 2026-11-23 · develop 모드 · 표기: **[사실]** 저장소 · 실행으로 확인 · **[구현]** 이번 커밋의 코드 · **[시험]** 시험으로 검증(변이 — 검사를 끄면 그 시험이 빨개지는지 — 포함) · **[추정]** 한계가 있는 셈 · **[미정]** 사용자 결정.

## 1. G3 — author · inspect 의 도장 쓰기 권한

| 조사 | 결과 |
|---|---|
| author 가 `attestations/**` 에 쓰는 명령 [사실] | `dbtool augment apply` — 신원 도장(verified, judicial/identity.js 가 원본과 대조, 지금 179) · `dbtool trend --write` — 추세 도장(trend, 178). 명령 장부의 augment 줄은 쓰기 칸에 도장을 적지 않았음(장부 · 코드 어긋남 → 고침) |
| inspect 가 쓰는 명령 [사실] | `dbtool accept` — 승인 도장(accept, 6) · `dbtool trend --write` |
| 겹침이 실제 수정 가능성인가 [사실 — 메모리 시험] | 예. author 세션이 `digestOf` 로 승인 도장을 만들어 등록부에 덧붙이면 `verifyAcceptStamp` 가 ok · 경로 구역 · CI 구역 점검도 통과. 도장 하나를 지워도 알리는 검사 없음 |
| author 에게 필요한가 [사실] | 신원 도장은 db 의 verified 와 같은 병합에서 함께 생겨야 한다(도장 없는 verified 는 validate 오류) — author 에서 뺄 수 없음. 추세 도장은 새 원본 재확인 — 작성 쪽 일 |
| 고친 방식 [구현 · 사용자 결정 DEC-0078] | 경로는 그대로 두고 **내용(도장 종류)** 으로 나눔: author [verified · trend] · inspect [accept] · 승인 도장은 누구도 지우거나 바꾸지 못함. 판정 `judicial/attestation.js` registryPolicy(RULE-0542) · 강제 CI 구역 점검(bc9bfad) + 문지기 · 모드표 · 권한 장부(L6 승인 묶음 `workspace/PLAN-116-G3-bundle.*` — 사용자 커밋 대기) · 명령 장부 trend → author 만 |
| 독립성 계산 [구현] | 겹친 자리는 두 모드가 모두 도장 종류를 선언했고 겹치지 않을 때만 갈린 것 — 정책이 없으면 그대로 limited. **지금 SUP-0001 r2 권한 요소 ✗ 그대로**(모드표에 정책이 아직 없음) · 묶음을 적용하면 ✓(메모리 계산) |
| 정보 접근 · 판단 근거 [추정] | 영수증의 명령 글에서 원문 자리(data/fetched · 원천 응답)를 가리킨 호출과 그 글의 문헌 번호를 센다 — **실제로 읽었는지 · 그 문장으로 판단했는지는 모른다.** 보고서에 "(추정)" 으로 남김 |

## 2. G5 — 시나리오 대조

| 시나리오 | 탐지하는 것 [사실 · 구현] | 시험 | 결과 |
|---|---|---|---|
| A1 author 가 inspect 몫(승인 도장)을 씀 | registryPolicy (RULE-0542) — CI · (묶음 뒤) 문지기 | `tests/registry_policy.test.mjs` ① ④ (실제 커밋) · 묶음의 `tests/gate.test.mjs` ⑳ | 거부 ✓ · 변이 caught |
| A2 inspect 가 author 자리(data)에 씀 | 문지기 경로 규칙 · CI (gate.mjs violations) | **새** `tests/bypass_scenarios.test.mjs` A2 (실제 커밋) | 거부 ✓ |
| A3 허용되지 않은 모드에서 보호 명령 | 명령 장부 commandBlock | 기존 `tests/gate.test.mjs` ② | 거부 ✓ (중복 안 만듦) |
| A4 장부에 없는 쓰기 | 경로 규칙(도구 뒤 대조 — 셸 쓰기 포함) | 기존 `tests/gate.test.mjs` ③ · `tests/ci_zone.test.mjs` | 거부 ✓ |
| B1 사람 승인 없이 병합 | 설정의 병합 도구 막음 · 영수증의 AI 병합 호출 | 기존 `tests/supervise_approval.test.mjs` ② ③ ⑦ | 승인으로 안 침 ✓ |
| B2 승인 파일 ≠ 병합 파일 | 바이트가 main 에 "모두 그대로" 처음 나타나야 | 기존 `supervise_approval` ① | 병합 전으로 ✓ |
| B3 승인 지문 ≠ 실제 바이트 | 승인 묶음 지문(approval.js) | 기존 `tests/approval.test.mjs` 지문 | ✓ |
| **B4 검수 뒤에 대상이 바뀜** | **구멍이었음** — 승인 대상에 검수하지 않은 바이트(SUP-0001 의 모양: r2 inspect 뒤 r3 author). 고침: 최종 권고 hold(RULE-0543) | **새** bypass B4 (실제 장부 접기 · 다시 검수하면 풀림 · 정상 흐름은 mergeable) | 보류 ✓ · 변이 caught |
| C1 작성 세션이 스스로 검수 | 감독 장부 admit | 기존 `tests/supervise.test.mjs` ⑤ | 거부 ✓ |
| C2 원문을 보지 않고 도장 · 검수 | 독립성 정보 접근(추정) → limited → hold | `tests/supervise_report.test.mjs` ② ④ | 보류 ✓ — [추정] 명령 글만 본다 |
| **C3 검수 영수증이 실행과 안 맞음 · 없음** | 영수증 사슬(RULE-0517) · 영수증 = git 변경 — 기존. **구멍이었음**: 영수증이 없으면 unknown 인데 권고가 병합 가능. 고침: unknown 도 hold(RULE-0543) | 기존 `gate.test` ③ ④ · **새** bypass C2 · C3 | 보류 ✓ |
| **C4 검수 기록의 사후 변경** | 승인 도장 지우기 · 고치기 — registryPolicy ③(정책이 없어도). **구멍이었음**: 감독 장부 · 전환 기록의 기존 줄을 셸로 고쳐도 check 오류 0. 고침: CI 덧붙이기만(RULE-0544) | `registry_policy` ② ④ · **새** bypass C4 (실제 커밋 — 덧붙이기 통과 · 줄 순서만 바뀜은 통과 · 사람의 커밋은 알리기만) | 거부 ✓ · 변이 caught · 지난 역사 248 커밋에 거짓 양성 0 |
| D1 Supervisor 가 승인 | 승인 사건 이름 거부 | 기존 `supervise` ③ | 거부 ✓ |
| D2 결과 확인 없이 다음 단계 | 넘김은 verify 필요 · 진행 중 아닌 실행 넘김 거부 | 기존 `supervise` ④ | 거부 ✓ |
| D3 끝 알림만으로 완료 | 완료는 증거(승인 + baseline)에서 계산 | 기존 `supervise_approval` ④ | ✓ |
| D4 제한된 모드에 자동 배정 | **시험할 대상 없음** — 자동 배정(PLAN-104) 미구현. 장부는 steps 밖 모드의 start 를 거부(기존 supervise ④) | — | PLAN-104 의 끝나는 조건으로 |
| E1 영수증 없는 완료 기록 | 영수증이 없으면 --human 으로만 · 보고서 절차 감사에 "영수증 없음" · 검수면 hold | 기존 supervise ③ · 새 C3 | ✓ (작성 실행의 사람 손 작업은 허용 — DEC-0070 Human Workflow) |
| E2 없는 세션을 가리키는 사건 | 사건 번호의 세션 꼬리 = by.session · 시작한 세션만 그 실행의 사건 | 기존 supervise ④ ⑥ | ✓ |
| **E3 다른 작업의 기록을 잘못 이음** | **미해결** — 넘김의 transition_seq 가 다른 상위 작업의 전환 기록을 가리켜도 잡지 못함. 전환 기록에 상위 작업 칸이 없음(DEC-0065 전환 형식 불변) | — | [미정] 형식 변경이 필요 |
| E4 순번 · 사건 번호 충돌 | 세션 꼬리 번호 · 상위 작업 번호 겹침 검사 | 기존 supervise ⑥ | ✓ |

## 3. 영향

- 기존 시험 · 기능: 감독 시험 15 · ci_zone 3 그대로 통과. 명령 장부에서 inspect 의 `trend` 가 빠짐 — inspect 의 추세 재확인은 author 로(DEC-0078).
- 최종 권고가 엄해짐: SUP-0001 은 지금 hold — "검수 뒤에 작성이 더 넘김(r3 author)". 전에는 "독립성 제한적" 으로 hold.
- 데이터 · 도장: data/ · attestations/ 바이트 그대로(이 일의 커밋들에서 git 으로 확인).

## 4. 제안만 (이번에 하지 않음)

- 문지기(L6)에도 감독 장부 · 전환 기록 덧붙이기만 검사(지금은 CI 만) — 다음 승인 묶음에.
- E3: 전환 기록에 상위 작업 번호 칸 — 형식 변경, 사용자 결정.
- 정보 접근 · 판단 근거를 추정에서 사실로: 검수 세션이 원문 파일을 읽는 도구(MCP 조회)를 쓰게 하고 그 호출을 영수증에 구조로 남기면 글 추정이 필요 없다.
