# PLAN-106 (RP1 승인자 기본값) — 다른 세션의 독립 재검토

- 날짜: 2026-11-23 · 모드: inspect · 대상 커밋: `f096a1e` (main 에 PR #16 으로 병합)
- 근거: 코드·시험을 이 세션이 직접 읽고 돌림. 저장소 파일은 이 보고서 말고 바꾸지 않음. 시험은 저장소 밖 사본(`git archive HEAD` → 스크래치 폴더)에서만.
- 읽은 것: `PLAN-106 --depth 2` · `DEC-0066 --depth 1` · `DEC-0069 --depth 0` · `git show f096a1e` · `judicial/acceptance.js` · `legislative/clerk.mjs` (appendAttestations · writerLock) · `mcp/clerk.mjs` · `mcp/protocol.mjs` (roleOf) · `judicial/attestation.js` (digestOf) · `rebuild/gate.mjs` (decidePre · violations) · `rebuild/rules/modes.json` · `.claude/settings.json` · `tests/acceptance.test.mjs` · `tests/mcp.test.mjs` · `tests/gate.test.mjs`

## 요약 — 길마다 판정

| 길 | 확인된 사실 | 막는 자리 · 시험 | 판정 |
|---|---|---|---|
| ① CLI `dbtool accept` | 이름표 없으면 `by = 'integrator'` (dbtool.mjs:647). 사본에서 `BIODB_ROLE` = `human` · `Human` · `␠human` · `collector` 네 경우 모두 오류로 끝나고 등록부 sha256 이 그대로(12d72375…). 이름표 없이 철회 1 개는 `integrator` 로 기록됨 | 발급 검사 `checkIssue` (acceptance.js:66). 시험 ⑥ 이 checkIssue 와 서기를 직접 검사. **CLI 기본값 자체를 보는 시험은 없음** — `dbtool accept` 를 실제로 돌리는 시험이 없다 (gate.test 는 명령 글만 봄) | 막힘 (기본값 회귀 시험 없음) |
| ② MCP clerk `accept` 도구 | `human` 이름표면 서버가 뜨지 않음 (protocol.mjs:15, mcp.test ③). `integrator` 로 accept 를 부르면 자식 dbtool 이 **부모 서버가 쥔 작성자 잠금** 에 걸려 거부(RULE-0018) — 어떤 역할로도 도장이 써지지 않음 | roleOf 의 human 거부 + checkIssue (두 겹). 시험: mcp.test ③ (human 이름표 거부). MCP accept 를 끝까지 부르는 시험은 없음 | 막힘 (부수 결함 F1 — 아래) |
| ③ 서기 `appendAttestations` 직접 호출 | claim `accept` 면 checkIssue → `ISSUE_APPROVERS = ['integrator']` 밖은 거부, 등록부를 쓰지 않음. claim 이 다르면 신원·추세 검증으로 가고, 인정 표(`table`)는 claim `accept` 만 읽으므로 승인이 되지 않음 | checkIssue. 시험 ⑥: 사본에서 `ISSUE_APPROVERS` 에 `human` 을 넣으면 acceptance 시험 10 중 ⑥ 만 실패(9 통과 · 1 실패) — 되돌리면 10 통과 | 막힘 (보통 객체 기준. 이론상 틈 T1 — 아래) |
| ④ 셸로 `attestations/registry.json` 직접 쓰기 | digest 는 열쇠 없는 sha256(canon) (attestation.js:25) — 누구나 다시 계산. 재검증 `verifyAcceptStamp` 는 `APPROVERS = ['human','integrator']` 를 받음 (시험 ⑥ 마지막 줄이 "옛 human 도장 재검증 ok" 를 단언). 문지기: Edit/Write 는 settings deny 로 막히지만 **Bash 쓰기는** `inspect`·`author` 모드에서 `attestations/**` 가 쓰기 자리라 앞(decidePre)·뒤(violations) 대조 모두 통과. CI 겹(PLAN-114)도 같은 구역 표 | 막는 자리 없음. 남는 것은 사람의 병합(DEC-0069) — diff 에 `"by": "human"` 이 보임. 저장 지도의 "입법 서기만(clerk.attest)" 은 문지기가 집행하지 않음 | **뚫림** (코드 읽기 + 기존 시험 단언으로 확인 · 실제 위조 실행은 안 함) |

## 길 ④ — 재현 절차 (고치지 않음, RULE-0262)

실행은 하지 않았다(이 세션의 자동 승인 분류기가 human 도장 위조 시도를 막았고, 그 뜻을 따름). 아래는 코드에서 따라간 절차다.

1. `node rebuild/gate.mjs open inspect` (또는 `author`).
2. 셸에서 node 한 줄로: `attestations/registry.json` 을 읽고, `ACC.issue({ id: <축 조건을 넘는 관찰>, use: 'evidence', by: 'human', reason: '…', date: '…' })` 로 만든 객체를 `stamps` 에 넣어 `fs.writeFileSync` 로 다시 쓴다 (서기를 거치지 않음 — checkIssue 가 불리지 않음).
3. 문지기: Bash 라 Edit/Write deny 에 안 걸리고, 바뀐 파일 `attestations/registry.json` 이 이 모드의 쓰기 자리라 violations 가 비어 있음.
4. `node dbtool.mjs attest` → 그 도장이 `✓ … (승인 approved · human …)` 로 유효. `dbtool accept` 표의 "승인된 높은 용도" 에 `human` 으로 나옴. `gate finish inspect` 의 `dbtool validate` 도 통과할 것으로 봄.
5. 커밋 · push 가능. main 에 닿으려면 사용자 병합이 필요 (DEC-0069) — 그것이 현재 유일한 겹.

고칠 자리 후보 (develop 모드 · 사용자 결정): (a) 재검증에서도 `human` 은 옛 6 개(digest 목록 고정)만 받기 — U2 와 묶임, (b) 문지기가 `attestations/registry.json` 을 Bash 로 바꾼 호출을 거부(서기 영수증이 없으면), (c) 도장 digest 를 사람 기기 키 서명으로(DEC-0069 의 나중 단계).

## 부수 발견

| 번호 | 확인된 사실 | 영향 | 판정 |
|---|---|---|---|
| F1 | `mcp/clerk.mjs` 는 뜰 때 `CLERK.writerLock(ROOT)` 를 잡고, 쓰기 도구는 `dbtool` 을 자식 프로세스로 부른다. 자식은 첫 권위 쓰기에서 다른 pid 의 살아 있는 잠금을 보고 거부 — 사본에서 `accept` 호출이 `작성자가 이미 떠 있음 (pid …)` 로 끝남 | MCP 의 권위 쓰기 도구(accept · merge · register · assume_add · dictionary_add · write_derived …)가 모두 같은 이유로 실패할 것으로 봄 (accept 만 실행 확인). 보안 구멍은 아니고 기능 결함 | 확인됨(accept) · 나머지 확인 불가 |
| T1 | checkIssue 는 `st.by` 를 검사 때 읽고, 서기는 나중에 `JSON.stringify` 로 쓴다. 직접 부르는 코드가 `by` · `digest` 를 getter 로 준 객체(검사 때 integrator, 직렬화 때 human)를 넘기면 이론상 통과 | 임의 코드를 돌릴 수 있는 쪽은 길 ④ 로 더 쉽게 같은 일을 하므로 새 힘은 아님. 서기가 받은 도장을 `JSON.parse(JSON.stringify(st))` 로 굳힌 뒤 검사하면 닫힘 | 이론상 틈 (실행 안 함) |
| T2 | 시험 이름 `⑥` 이 acceptance.test.mjs 에 둘 (가장 약한 근거 · PLAN-106) | 읽기 혼동뿐 | 사소 |
| T3 | 서기는 등록부에 이미 있는 도장을 다시 검증하지 않고 그대로 다시 쓴다 | 길 ④ 로 넣은 도장이 이후 정상 발급 때 그대로 실려 감 | 길 ④ 에 딸림 |

## 옛 `by: human` 도장 6 — 현황만 (열린 질문 U2, 판정하지 않음)

| 관찰 | 용도 · 판정 | 발급일 | 넣은 커밋 · 작성자 | 지금 재검증 (`dbtool attest`) |
|---|---|---|---|---|
| O000019 · O000020 · O000021 · O000022 · O000027 · O000028 | evidence · approved | 2026-10-25 | `853cb42` · Claude | 6 모두 유효 (승인 도장 6: 무효 0) |

이유 칸(6 개 같음): "사전 등록 검증 #1–#5 의 검증 세트로 이미 쓰인 정성 관찰 — 인정(build-plan 72) 도입 때 일괄 기록 (2026-10-25 사용자 결정: 한 번에 승인 기록 남기기)". 등록부의 다른 도장(verified 179 · trend 178)에는 `by` 칸이 없다.

## 끝나는 조건 대조

| 끝나는 조건 (PLAN-106) | 확인된 사실 | 근거 | 판정 |
|---|---|---|---|
| BIODB_ROLE 없이 accept → human 이 남지 않는 거부 시험 | 기본값 integrator. 다만 기본값을 human 으로 되돌려도 checkIssue 가 막을 뿐, 기본값을 직접 보는 시험은 없음 | dbtool.mjs:647 · tests/ 에 `dbtool accept` 실행 없음 | 효과는 충족 · 시험 틈 |
| CLI · MCP 어느 길로도 AI 세션이 사람 승인 칸을 못 만드는 시험 | CLI · MCP · 서기 직접은 막힘. 시험 ⑥ 은 끄면 실패함 | 사본 변이 시험 (9 통과 · 1 실패) | 충족 |
| 재관측: accept 경로 전수에서 위조 경로 0 | 셸 직접 쓰기(길 ④)가 남음 | 위 재현 절차 | **미충족** |
| 다른 세션 재검토 | 이 보고서 | — | 끝남 (사용자 결정 남음) |

## 사용자 결정이 필요한 것

1. 길 ④ 를 PLAN-106 안에서 닫을지, 따로 계획을 낼지 (고칠 자리 후보 a · b · c).
2. U2 — 옛 human 도장 6 의 처리 (길 ④ 의 고침 a 가 여기에 기댐).
3. F1 — MCP clerk 쓰기 도구가 자기 잠금에 걸리는 결함을 develop 에서 고칠지.
