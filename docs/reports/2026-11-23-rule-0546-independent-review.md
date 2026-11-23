# RULE-0546 (셸 위조 길 수정, 커밋 ac8c344) — 다른 세션의 독립 재검토

- 날짜: 2026-11-23 · 모드: inspect · 대상: `ac8c344` (`judicial/attestation.js` registryPolicy ④ · `judicial/acceptance.js` ISSUE_APPROVERS 내보내기 · `tests/registry_policy.test.mjs` ⑤). 이 브랜치에는 G3(`01f5856` — 모드표 stamps · 문지기 등록부 판정)도 들어 있음.
- 근거: 코드 · 시험 · 실행을 이 세션이 직접 함. 만든 세션의 결론은 받지 않음(DEC-0066 U7 · DEC-0083).
- 읽은 것: `DEC-0083 --depth 2` · `PLAN-106 --depth 1` · `RULE-0546 --depth 1` · `RULE-0542 --depth 0` · `docs/reports/2026-11-23-plan-106-independent-review.md` · `git show ac8c344` · `rebuild/gate.mjs` (decidePre · hook post · RE) · `rebuild/ci-zone.mjs` (judgeCommit · zoneCheck) · `tests/gate.test.mjs` · `tests/registry_policy.test.mjs` · `dbtool.mjs` (attest · accept)
- 실행 자리: 저장소 밖 스크래치 폴더의 로컬 clone(`ac8c344` 에서 가지 `review`) — 실제 `rebuild/gate.mjs hook pre/post` 를 표준 입력으로, 실제 `node rebuild/gate.mjs finish inspect` · `node rebuild/ci-zone.mjs`. 위조 도장은 모두 그 clone 에만. 이 저장소에서는 이 보고서와 전환 기록 말고 바꾸지 않음.

## 다섯 항목

| 항목 | 확인된 사실 | 근거 | 판정 |
|---|---|---|---|
| ① inspect 셸로 `by: human` 승인 도장 → 거부? (CI 구역 점검 · 실제 커밋) | clone 에서 inspect 로 열고 셸로 `ACC.issue({ id: 'O000019', by: 'human', … })` 를 등록부에 넣은 뒤 `finish inspect` 통과 → `git commit` (문지기가 영수증을 실음 · 등록부 포함) → `node rebuild/ci-zone.mjs <base> HEAD` **종료 1**: `✗ … 선언 inspect 의 도장 등록부 정책 밖 1: 새 승인 도장 O000019\|accept\|evidence:O000019 의 승인자 'human' — integrator 만`. 다만 같은 위조가 들어 있어도 `node dbtool.mjs validate` 종료 0 · `dbtool attest` "승인 도장 7: 무효 0" · `finish inspect` 통과 — 거부하는 겹은 CI(와 문지기 알림) 뿐 | 실행 (clone) · ci-zone.mjs:46–52 · attestation.js:136–138 | **막힘** (영수증이 실린 커밋에 한해 — 아래 남은 틈 R1) |
| ② 정상 발급(`by: integrator`, inspect)은 통과? | `node dbtool.mjs accept O000019 --use evidence --reason …` (BIODB_ROLE 없음) → "승인 도장 1 (승인 · evidence · integrator) 기록" · 문지기 post 종료 0 · attest "승인 도장 7: 무효 0". 셸로 `by: integrator` 도장을 직접 넣어도 post 종료 0 (정책 ④ 는 승인자만 봄 — 아래 R3) | 실행 (clone) · 시험 ⑤ 의 '정상 발급은 통과' 단언 | **통과** |
| ③ 옛 승인 도장 6 (`by: human`, U2) 이 바뀌거나 다시 판정되지 않나 | 이 저장소의 `attestations/registry.json` sha256 검토 전 = 검토 후 = `12d72375f5e4dde32204ade3ef860f8de35c1aca6f85e75dae76bfd4ac4e29ff`. `node dbtool.mjs attest` 검토 전후 모두 "승인 도장 6: 무효 0" (O000019 · 20 · 21 · 22 · 27 · 28, human 2026-10-25). 정책 ④ 는 `inB`(HEAD 등록부의 같은 JSON) 에 없는 도장만 봄 — clone 의 모든 실행에서 옛 6 은 위반으로 나오지 않음 | sha256sum · dbtool attest · attestation.js:137–138 · 시험 ⑤ '옛 도장은 다시 판정하지 않음' | **통과** (불변 · 재판정 없음) |
| ④ 실제 문지기 훅이 실시간으로 막나 | clone 에서 `hook pre` → 셸 위조 쓰기 → `hook post`: **종료 2**, 표준 오류 `문지기 [RULE-0542]: 도장 등록부 정책 밖 — 새 승인 도장 O000019\|accept\|evidence:O000019 의 승인자 'human' — integrator 만 …`. 영수증에 violation 이 남음. 그러나 (a) 꼬리표가 RULE-0546 이 아니라 RULE-0542 (영수증 violation 의 rule 도 0542) (b) 알림일 뿐 파일을 되돌리지 않고, 뒤의 finish · 커밋을 막지 않음 (c) **도구 호출 밖**(두 호출 사이)에서 쓴 위조는 다음 도구의 pre 가 `outside` 로만 적고 post 는 종료 0 — 정책을 보지 않음 (R2) | 실행 (clone) · gate.mjs:216–217 · 236–243 | **막힘(알림)** — 도구 안에서 쓴 것만. 도구 밖 쓰기는 **뚫림**(문지기 겹만; CI 는 영수증이 실리면 잡음) |
| ⑤ 판정 검사를 끄면 시험이 실패하나 | clone 에서 attestation.js:138 의 ④ 줄 앞에 `if (0)` → `node --test tests/registry_policy.test.mjs`: 5 중 **⑤ 만 실패** (4 통과 · 1 실패). 원래대로 되돌리면 5 통과 | 실행 (clone 사본 · 이 저장소 파일은 안 고침) | **통과** (변이를 잡음) |

## 남은 틈 (고치지 않음 — RULE-0262)

| 번호 | 확인된 사실 | 재현 절차 | 판정 |
|---|---|---|---|
| R1 | CI 구역 점검은 영수증(모드 선언)이 없는 커밋을 `undeclared` 로 보고 **등록부 정책을 아예 보지 않음** — 종료 0, "사람의 커밋으로 봄 (알리기만)" (ci-zone.mjs:47 · 82 · 86). 문지기의 커밋 감지 RE.commit = `/\bgit\s+(?:-C\s+\S+\s+)?commit\b/` 은 `git -c k=v commit` · `git --no-pager commit` 을 못 알아봄(정규식만 확인: false) — 그런 커밋은 끝내기 전 시험 검사도, 영수증 싣기도 없이 지나갈 것으로 봄. `git commit -m x -- attestations/registry.json`(경로 지정) 은 RE 에 걸리지만, 문지기가 스테이징한 영수증이 그 커밋에 들어가지 않을 것으로 봄 | 1. inspect 로 열고 셸로 `by: human` 도장을 등록부에 넣는다 (문지기 post 종료 2 · 알림만) 2. `finish inspect` (통과 — validate 가 human 을 받음) 3. `git commit -m x -- attestations/registry.json` 또는 `git -c user.name=x commit -am x` 4. `node rebuild/ci-zone.mjs <base> HEAD` → 예상: `선언 없음 1` · 종료 0. **실행하지 않음** — 3 단계 실행이 이 세션에서 거부됨. 코드 읽기로만 | **확인 불가** (가능성 높음 — 남는 겹은 사람의 병합 · DEC-0069) |
| R2 | 문지기 post 는 그 도구 호출 안에서 바뀐 파일(changed)만 정책에 넣는다. 도구 사이에 바뀐 등록부(뒤로 돌린 프로세스 등)는 다음 pre 가 `{"t":"outside","changed":["attestations/registry.json"]}` 로만 적음 | clone 에서: 도구 호출 밖에서 위조 쓰기 → `hook pre/post` (`ls`) → post 종료 0, 등록부는 위조된 채. 영수증 끝: `outside … attestations/registry.json` 다음 `tool ls … changed: []` | **뚫림** (문지기 겹만 — 영수증이 실린 커밋이면 CI 가 잡음, ① 실행) |
| R3 | 정책 ④ 는 승인자(`by`)만 본다. 셸로 쓴 `by: integrator` 승인 도장은 발급 검사 checkIssue 의 축 조건을 거치지 않지만 문지기 post 종료 0 | clone ②' 실행. 재검증 `verifyAcceptStamp` 가 attest · validate 에서 같은 조건을 보는지는 이 세션이 끝까지 대조하지 않음 | 확인 불가 (RULE-0546 범위 밖 — 승인자 위조는 아님) |
| R4 | 재검증 `APPROVERS = ['human','integrator']` 이라 `validate` · `attest` · `finish inspect` 는 새 human 도장도 유효로 셈 — 로컬에서 거부하는 검사는 없음(문지기는 알림) | ① 의 실행: 위조 뒤 validate 종료 0 · attest 무효 0 | 설계상 남음 (U2 와 묶임 — 옛 6 을 digest 목록으로 고정하면 닫힘, 앞 보고서의 후보 a) |
| R5 | 문지기 메시지 · 영수증의 규칙 번호가 RULE-0542 — RULE-0546 위반도 같은 꼬리표 (gate.mjs:242 `say('RULE-0542', …)`) | ④ 의 실행 출력 | 사소 (번호로 찾을 때 혼동) |

## 재현 절차 (① · ② · ④ · ⑤)

1. `git clone <이 저장소> <스크래치>/r546-clone && git -C <…> checkout -b review ac8c344`
2. 훅 부르기(tests/gate.test.mjs 와 같은 방식): `spawnSync(node, ['<clone>/rebuild/gate.mjs','hook','pre'|'post'], { cwd: clone, input: JSON.stringify({ session_id, tool_name: 'Bash', tool_input: { command } }), env: { CLAUDE_PROJECT_DIR: clone, BIODB_ROLE: '' } })` — 도구 하나 = pre → 셸 실행 → post.
3. `node rebuild/gate.mjs open inspect` 를 그 방식으로 → post 종료 0.
4. ④: 도구 안에서 등록부를 읽고 `ACC.issue({ id: 'O000019', use: 'evidence', by: 'human', reason, date: '2026-11-23' })` 를 `stamps` 에 넣어 다시 씀 → post 종료 2 · `문지기 [RULE-0542]: … 승인자 'human' — integrator 만`.
5. ①: `git add attestations/registry.json` → 훅으로 `finish inspect`(통과) → 훅으로 `git commit -qm …` (영수증이 실림) → `node rebuild/ci-zone.mjs <base> HEAD` 종료 1.
6. ②: `git checkout -- attestations/registry.json` 뒤 훅으로 `node dbtool.mjs accept O000019 --use evidence --reason …` → post 종료 0 · 기록 `integrator`.
7. ⑤: clone 의 `judicial/attestation.js` 138 행(④ 의 `for (const s of A) … !issuers.includes(s.by)`) 앞에 `if (0)` → `node --test tests/registry_policy.test.mjs` 1 실패(⑤) → 원본으로 되돌림 → 5 통과.
8. ③: 이 저장소에서 검토 전후 `sha256sum attestations/registry.json` · `node dbtool.mjs attest | tail -2`.

## 끝나는 조건 대조 (PLAN-106 '위조 경로 0' · DEC-0083)

| 조건 (DEC-0083 ①) | 확인된 사실 | 근거 | 판정 |
|---|---|---|---|
| 셸을 통한 inspect 의 `by: human` 위조는 반드시 거부 | 영수증이 실린 커밋은 CI 가 거부(종료 1) · 도구 안 쓰기는 문지기가 알림(종료 2). 영수증 없는 커밋(R1)은 CI 가 정책을 보지 않음 · 도구 밖 쓰기(R2)는 문지기가 못 봄 · 로컬 validate 는 받음(R4) | 위 표 | **부분 충족** — 경로 0 아님(R1 확인 불가 · R2 뚫림) |
| inspect 정상 승인 · integrator 정상 발급은 계속 됨 | ② | 실행 | 충족 |
| 기존 6 은 바꾸거나 다시 판정하지 않음 | ③ | sha256 · attest | 충족 |
| 정책 검사를 끄면 시험 실패 | ⑤ | 변이 실행 | 충족 |

## 사용자 결정이 필요한 것

1. R1 — CI 구역 점검이 영수증 없는 커밋에서도 등록부 정책(③ ④ 처럼 모드에 기대지 않는 판정)을 볼지, 그리고 문지기 RE.commit 이 `git -c … commit` · 경로 지정 커밋을 다룰지 (develop · 판정 코드라 사용자 요청 필요).
2. R2 — 문지기가 `outside` 로 바뀐 등록부도 정책에 넣을지.
3. 위 둘이 닫히거나 사람의 병합(DEC-0069)을 유일한 겹으로 받아들이기로 정할 때까지, PLAN-106 의 '위조 경로 0' 을 채운 것으로 볼지.
