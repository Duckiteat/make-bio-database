# 집행 변이 시험

> 생성물 — `node rebuild/status.mjs --write`(응답이 끝날 때 훅이 돌림). 손으로 고치지 않는다. 읽기 점검용이며 다른 코드가 읽지 않는다.

원본: `rebuild/rules/enforcement.jsonl` (287 행) · 다시 돌리기: `node tests/mutation/run.mjs --spec rebuild/rules/enforcement.jsonl --check --jobs 3`. "기계가 막는다(machine)" 는 규칙의 집행 자리를 저장소 밖 사본에서 일부러 망가뜨리고, 시험이 하나라도 빨개지면 잡음, 모두 통과하면 놓침이다. 놓침은 `rebuild/rules/review.jsonl` 의 `enforcement_gap` 으로 사용자 확인을 기다린다.

| 결과 | 규칙 |
|---|---|
| 잡음 `caught` | 253 |
| 설정에 있음 `present` | 8 |
| 시험 통과 (자리 변이 없음) `test_passes` | 26 |
| 아직 시험 안 함 (machine) | 0 |

## 형식 오류

없음

## 잡음 `caught` — 253

| 규칙 | 내용 | 변이 | 파일 | 빨개진 시험 · 메모 |
|---|---|---|---|---|
| RULE-0005 | 행정(core.js·engine/*)은 읽기·시뮬레이션만 | inject | core.js | ② 행정부: 사법·입법·조정자를 부르지 않고, 감사 코드·verified 선언이 없다 |
| RULE-0006 | 행정은 파일 쓰기 금지 | inject | engine/fate_engine.js | ① 쓰기 권한: 파일 쓰기 코드는 legislative/clerk.mjs 와 migrations/ 에만 |
| RULE-0007 | 행정은 검사·승인·'verified'·AUDIT_*·사후 분석·질량 판정 금지 | inject | core.js | ② 행정부: 사법·입법·조정자를 부르지 않고, 감사 코드·verified 선언이 없다 |
| RULE-0008 | 행정은 사법·입법·조정자 호출 금지 | inject | core.js | ② 행정부: 사법·입법·조정자를 부르지 않고, 감사 코드·verified 선언이 없다 |
| RULE-0010 | 부분 구조 수지 ΣIn=ΣOut 상대 1e-14 (규칙 검사·운명 원장) | replace | judicial/judicial.js | 현재 저장소는 오류·경고 없음 |
| RULE-0011 | 수치 선택(정칙화·문턱·탐침 격자·뉴턴 허용 오차)은 engine/coupling.js 등록부에서만, 엔진에 | inject | engine/fate_engine.js | ⑥ 결합점 등록부: 시나리오 → 데이터(params) → 기본값, 엔진 코드를 고치지 않고 값이 바뀐다 |
| RULE-0012 | 입법(legislative/)은 정의·수정·초안만(순수) | inject | legislative/legislative.js | ③ 사법부: 엔진을 실행하지 않고 쓰지 않는다 · 입법 초안은 검사하지 않는다 |
| RULE-0013 | 파일 쓰기는 legislative/clerk.mjs 만, 모든 쓰기는 put(구역, 파일) | inject | orchestrator.js | ① 쓰기 권한: 파일 쓰기 코드는 legislative/clerk.mjs 와 migrations/ 에만 |
| RULE-0014 | 새 쓰기는 구역을 고르거나 새로 선언, put 우회 금지 | inject | legislative/clerk.mjs | ④′ 구역(Zone): 쓰기는 모두 구역을 지나고, 저장소 안의 다른 구역에 쓰려 하면 거부된다 |
| RULE-0015 | db.json·patches 는 관문 봉인(통과 + 같은 db sha256)일 때만 | disable | legislative/clerk.mjs | ④ 입법 서기: 봉인 없는·변조된·다른 db 의 판결로는 쓰지 않는다 · 보호 위치에 보고서를 쓰지 않는다 |
| RULE-0016 | 증명 등록부는 도장 재검증 뒤에만 쓴다 | disable | legislative/clerk.mjs | ④ 입법 서기: 봉인 없는·변조된·다른 db 의 판결로는 쓰지 않는다 · 보호 위치에 보고서를 쓰지 않는다 |
| RULE-0017 | dbtool.mjs 포함 다른 파일에 쓰기 금지 | inject | dbtool.mjs | ① 쓰기 권한: 파일 쓰기 코드는 legislative/clerk.mjs 와 migrations/ 에만 |
| RULE-0018 | 권한은 입출력기 clerk 하나 — 단일 작성자 잠금(clerk 서버와 dbtool 의 권위 쓰기가 같은 잠 | disable | legislative/clerk.mjs | ④ 단일 작성자: clerk 가 떠 있으면 둘째 clerk 도, dbtool 쓰기도 막힌다 |
| RULE-0019 | 역할 BIODB_ROLE 기본 collector (핸드오프만) | replace | mcp/protocol.mjs | ③ 역할: 기본 collector 는 clerk 의 권위 쓰기를 못 보고, 불러도 거부 · 모르는 역할은 시작 거부 |
| RULE-0020 | mcp 서버는 파일을 직접 쓰지 않는다 | inject | mcp/query.mjs | ① 쓰기 권한: 파일 쓰기 코드는 legislative/clerk.mjs 와 migrations/ 에만 |
| RULE-0023 | BRENDA 계정은 환경 변수 BRENDA_EMAIL·BRENDA_PASSWORD_SHA256 — 출력·받기 | replace | legislative/clerk.mjs | ⑪ 서기 POST 받기: 본문은 표준 입력으로만 · 응답에 되돌아온 계정 정보는 지움 · 오류 본문도 지움 |
| RULE-0025 | 사법(judicial/)은 검증·증명·감사·보고만, 엔진 실행·데이터/엔진 수정 금지 | inject | judicial/stats.js | ③ 사법부: 엔진을 실행하지 않고 쓰지 않는다 · 입법 초안은 검사하지 않는다 |
| RULE-0026 | 행정부는 관찰을 읽지 않는다; 예측 표본은 조정자가 compiler/obs_operator.js 로 | inject | core.js | ② 행정부는 관찰을 모른다: 관찰 기록·관찰 연산자·관찰 판정을 읽지 않음 (4단계 — 관찰에 맞추느라 결함을 덮는 순환 방지) |
| RULE-0027 | 'verified' 는 attestations/registry.json 의 유효 도장으로만, 없으면 관문 거 | disable | judicial/judicial.js | ④ 증명 등록부: 도장 없는 verified 는 오류, 변조·위조 도장은 무효 |
| RULE-0028 | 엔진 실행이 필요한 감사는 조정자 orchestrator.js 가 원자료 → 사법부 | inject | judicial/fate_audit.js | ③ 사법부: 엔진을 실행하지 않고 쓰지 않는다 · 입법 초안은 검사하지 않는다 |
| RULE-0029 | 엔진 출력 모양을 바꾸면 schemas/ffi/fate-raw.schema.json 같은 커밋 | replace | judicial/fate_audit.js | ⑦ 원자료 계약 (FFI): 엔진 출력은 schemas/ffi/fate-raw.schema.json 을 지키고, 어기면 사법부가 판정하지 않는다 |
| RULE-0031 | 컴파일러는 공유 순수 층(db+시나리오 → 불변 IR) — 쓰기·판정·엔진·권력 모듈 호출 금지 | inject | compiler/tape.js | ① 쓰기 권한: 파일 쓰기 코드는 legislative/clerk.mjs 와 migrations/ 에만 |
| RULE-0032 | 엔진은 IR 만 먹고 원자료에 irHash | replace | engine/fate_engine.js | ⑧ 컴파일러 IR (0.5단계): 순수 · 엔진은 IR 만 먹음 · 사법부가 해시·법칙·기호 도함수를 독립 검증 |
| RULE-0033 | 희소 LU 기호 분석 sparse_lu.js 는 사법부 checkLU 가 검증 | replace | judicial/derivative.js | RULE-0033 희소 LU 기호 분석은 사법부 checkLU 가 검증 — 대각 위치가 틀린 패턴은 거부 |
| RULE-0035 | perturb_audit 가 '교란 외에는 대조군과 같음' 을 독립 대조 | replace | judicial/perturb_audit.js | ④ 교란 차이 검사: 교란 외에는 대조군과 같다 — 사법부 독립 재구성 |
| RULE-0037 | 속도 법칙 변경 = 컴파일러·테이프 명세·judicial/derivative.js 재구성 같은 커밋, 도함수 | replace | judicial/derivative.js | ⑧ 컴파일러 IR (0.5단계): 순수 · 엔진은 IR 만 먹음 · 사법부가 해시·법칙·기호 도함수를 독립 검증 |
| RULE-0038 | 모든 감사 항목에 fault 태그 (judicial/fault.js) | replace | judicial/fate_audit.js | ⑨ 결함 출처 태그: 모든 감사 항목이 6 분류 중 하나 — 결과는 FINDING, 엔진·컴파일러·수치·데이터 결함은 각자의 층으로 |
| RULE-0044 | 토큰 → 사람말 표(라벨·의미)는 vocab.js 에만 + en 은 data/dictionary.jsonl  | inject | dictionary.js | ⑮ 표·로직 분리 — 사전은 vocab 만 읽고, 결함 표는 vocab.faultChannels 에만 |
| RULE-0046 | 사전은 vocab 만 읽는다 | inject | dictionary.js | ⑮ 표·로직 분리 — 사전은 vocab 만 읽고, 결함 표는 vocab.faultChannels 에만 |
| RULE-0052 | 수치 L2 수렴 기준은 같은 적분기 허용 오차 1/1000 (orchestrator.refScenario) | replace | orchestrator.js | RULE-0052 수렴 기준해는 그 시나리오 적분 허용 오차의 1/1000 (등록부 ref_tol_factor) — 고정 숫자가 아님 |
| RULE-0059 | 패치 최상위 why 필수 | replace | judicial/judicial.js | ④‴ 봉인 = 병합 규약: dbtool 을 거치지 않아도 why·미등록 한계·정제 점검이 관문에서 막힌다 (판정이 CLI 에만 있으면 서기 경로가 건너뛴다) |
| RULE-0060 | 새 항목은 임시 번호(T+1·D+1·S+1·O+1) | disable | legislative/legislative.js | 없는 번호로 수정하면 거부 |
| RULE-0061 | meta.next 손대지 않음 | disable | judicial/judicial.js | 번호 배정기가 쓰인 번호보다 작으면 오류 |
| RULE-0063 | xrefs[].role: physiological(하나)·parent·class — class 를 저분자·이 | disable | judicial/judicial.js | 외부 ID 역할: 분류 항목은 셀 수 있는 분자의 번호가 될 수 없고, 역할이 겹치거나 physiological 이 없으면 거부 |
| RULE-0064 | physiological 의 verified 는 켤레 관계 + Rhea ≥3 통과 시 | replace | judicial/identity.js | RULE-0064 physiological 의 확인은 Rhea 반응 참여 ≥ 3 — 2 회면 거부 |
| RULE-0066 | 다른 값 asserted 는 --sync 요청 시만 바꾼다 | replace | legislative/augment_draft.js | RULE-0066 자동 보강은 원본 값이 asserted 값과 달라도 --sync 없이는 바꾸지 않는다 |
| RULE-0068 | 정의항(D): 구성 요소·막 위상·부위·규칙 빠짐없이, 모르면 residue_unknown: true | disable | judicial/judicial.js | 단백질·핵산의 수식 부위는 기준 종 잔기 번호, 모르면 residue_unknown 명시 |
| RULE-0069 | 묶음·단계(B/S): 원천 전이 규칙 참조 + 묶음만, 라벨은 규칙에 | disable | judicial/judicial.js | 규칙 참조·보조 기질·조절자는 원천 규칙에 정의된 것만 |
| RULE-0071 | 위치는 묶음마다, 공간 접촉 안 되면 위치 수정 또는 수송 단계 | disable | judicial/judicial.js | 공간 접촉: 세포 밖 에피네프린은 세포질의 분자와 반응할 수 없음 |
| RULE-0072 | 종별 값은 obs + context.species | disable | judicial/judicial.js | 종에 따라 달라지는 관찰은 context.species 필수, 종 별칭은 번호로 |
| RULE-0073 | 기준 종 하나 (단백질·핵산 9606) | disable | judicial/judicial.js | 단백질은 기준 종 필수(패치에서 생략하면 기본 9606), 저분자에는 종 금지 |
| RULE-0074 | span 은 정의 문장 원문 그대로 | disable | judicial/judicial.js | 정의 문장에 없는 근거 구절은 거부 |
| RULE-0078 | limitations --detect 후보 0 (병합 조건) | replace | judicial/judicial.js | ④‴ 봉인 = 병합 규약: dbtool 을 거치지 않아도 why·미등록 한계·정제 점검이 관문에서 막힌다 (판정이 CLI 에만 있으면 서기 경로가 건너뛴다) |
| RULE-0079 | 상위 개념은 addresses:[{limitation,how}] 또는 gap_review 필수 | disable | judicial/judicial.js | 상위 개념(motif): kind process 만, 한계 검토(addresses 또는 gap_review) 필수, 없는 한계를 가리키면 거부 |
| RULE-0084 | 문헌 값은 관찰(O…) 먼저 + kinetics.from (lumped 도 원 관찰 참조) | disable | judicial/judicial.js | ③ 실측 상수 = 관찰의 파생값: from 이 같은 규칙·칸·값을 가리켜야 하고, 검증용 관찰은 추정에 못 씀 |
| RULE-0085 | 미확인 값 금지 — 시험값은 가정 원장 번호 A… 를 hypothetical 시나리오가 {assume} 로 | replace | judicial/reliability.js | 신뢰 지표 ②: 관문은 쓰인 상수의 등급을 보고 미달을 거부한다 (가상 값은 hypothetical 선언 아래에서만) |
| RULE-0086 | 가정 원장 쓰기는 assume add 감사·봉인 뒤 서기만 | disable | legislative/clerk.mjs | ⑤ 서기: 봉인이 없으면 못 쓰고, 번호는 순번으로 붙는다 · 사슬이 이어진다 |
| RULE-0088 | 새 사전 등록은 인라인 가상 숫자 거부 | replace | dbtool.mjs | ⑥ 등록은 번호로만: 인라인 가상 숫자가 있는 시나리오는 등록 거부 (쓰기 전에) |
| RULE-0089 | 다른 종 값을 사람 값으로 적지 않음 → 한계 | disable | judicial/judicial.js | ① 거부 말뭉치: 나쁜 패치가 모두 거부되고, 사유가 그대로다 |
| RULE-0093 | S×D 곱으로 판정하지 않음 | replace | judicial/reliability.js | ① 지금 표: 추정 인정 = anchor·parameter · 서술 = blocked 말고 전부 · 검증 근거 = 승인된 정성 관찰 6 · 기준 0 |
| RULE-0096 | 추세 도장은 원천별 창 vocab.consensus.sources 뒤 다시 unchecked | replace | judicial/trend.js | ⑨ 합의 창은 원천별 판 주기 — 같은 나이라도 원천마다 만료가 다르고, 창이 없는 원천은 만료 |
| RULE-0097 | mismatch 면 값 유지·legacy·Consensus_Gap | replace | judicial/reliability.js | ⑪ 문턱은 축 조건: 모든 (S,D,T) 에서 순번 비교와 같고, 다른 곳은 bounded↔parameter 쌍뿐 · 등급은 제 문턱을 넘는다 |
| RULE-0098 | 인정 = (기록, 용도) — 서술·비교·추정은 계산 | replace | judicial/reliability.js | ① 지금 표: 추정 인정 = anchor·parameter · 서술 = blocked 말고 전부 · 검증 근거 = 승인된 정성 관찰 6 · 기준 0 |
| RULE-0099 | 검증 근거·기준은 승인 도장 (사람·integrator, 이유 필수, 축·관계 조건을 넘지 못함) | replace | judicial/acceptance.js | ④ 도장 검사: 수집가 역할 · 이유 없음 · 변조 · 관찰이 아닌 주체 · 승인 없이 되는 용도는 거부 |
| RULE-0100 | 결론은 가장 약한 근거를 따름 (acceptance_review — 보고서·observe·fate) | replace | judicial/acceptance.js | ⑥ 결론은 가장 약한 근거를 따른다 — 검증 세트 관찰이 인정되지 않으면 보고서 판정이 인정 재검토 필요 |
| RULE-0101 | 시뮬레이션 관문도 같은 판정 (문턱 ∧ '추정' accepted, 종 = kinetics.context.sp | replace | judicial/reliability.js | ⑦ 관문은 인정의 추정 조건을 본다: 다른 종 상수 거부 · 조건부(오차 막대)도 관문은 통과시키지 않음 · 사람 상수는 그대로 |
| RULE-0102 | 승인 도장은 추가만 (마지막이 유효) | disable | legislative/clerk.mjs | ⑨ 승인 이력: 승인 → 철회 → 재승인이 등록부에 모두 남고 마지막이 유효 · 같은 도장은 거부 |
| RULE-0103 | 등급 문턱(기본 parameter) 미달 데이터 상수 = AUDIT_KINETIC | replace | judicial/reliability.js | ⑦ 관문은 인정의 추정 조건을 본다: 다른 종 상수 거부 · 조건부(오차 막대)도 관문은 통과시키지 않음 · 사람 상수는 그대로 |
| RULE-0104 | 시나리오 값은 hypothetical: true 때만 | replace | judicial/reliability.js | 신뢰 지표 ②: 관문은 쓰인 상수의 등급을 보고 미달을 거부한다 (가상 값은 hypothetical 선언 아래에서만) |
| RULE-0105 | 문턱은 min_grade 로 올리기만 — 낮추거나 비교 못 하는 등급은 관문 거부 | replace | judicial/reliability.js | ⑫ 관문 문턱은 올리기만: 기본보다 느슨하거나 비교할 수 없는 문턱은 거부 · 지금 데이터의 판정은 그대로 |
| RULE-0106 | 문턱 비교는 순번이 아니라 축 조건 (reliability.THRESHOLD) | replace | judicial/reliability.js | ⑦ 관문은 인정의 추정 조건을 본다: 다른 종 상수 거부 · 조건부(오차 막대)도 관문은 통과시키지 않음 · 사람 상수는 그대로 |
| RULE-0107 | 실측값은 observations(O+1): 값(SI)·불확도(크기·유형·잡음 모형)·반복 수·조건(종)·출처 | disable | judicial/judicial.js | ② 관문: 올바른 관찰은 통과(O 번호 배정), 합성·불확도 없음·SI 아님·보정 불일치는 거부 |
| RULE-0109 | 도구 추정(computed·predicted)은 실측이 아님 (D2.estimate) | replace | judicial/reliability.js | ⑩ 도구 추정값은 D2.estimate · 반복 수 미보고(null)는 받되 D3 · 비교는 1 회로 봄(보수적) · 반복 수를 빼면 거부 |
| RULE-0110 | 관찰 수정·삭제 금지 (retracted 만) | replace | judicial/judicial.js | ④ 변경 불가: 관찰은 바꾸거나 지울 수 없고, 철회 표시만 더할 수 있음 |
| RULE-0111 | 추정용을 검증에 쓰지 않음 | disable | judicial/judicial.js | RULE-0111 추정용만 모델 값의 출처: 검증용(validation) 관찰을 정의항 obs 의 from 으로 쓰면 거부 |
| RULE-0112 | 합성 관찰은 examples/observations/ 만 | disable | judicial/judicial.js | ② 관문: 올바른 관찰은 통과(O 번호 배정), 합성·불확도 없음·SI 아님·보정 불일치는 거부 |
| RULE-0113 | 측정은 포트(schemas/obs/)로 | replace | judicial/contract.js | ① 계약: 합성 예시는 모양을 지키고, 값만 있는 관찰은 모양에서 거부 |
| RULE-0114 | 정성 관찰은 kind: qualitative — 교란·readout·expect | disable | judicial/judicial.js | RULE-0114 정성 관찰: 읽을 거리 대상(readout.target)이 없으면 거부 |
| RULE-0115 | 정성 관찰은 1차 문헌(DOI·PMID) provenance.source + 원문 quote 필수 | disable | judicial/judicial.js | ① 정성 관찰: 구절·1차 문헌·교란·읽을 거리·용도 위반은 거부 |
| RULE-0116 | 정성 관찰은 use: validation 만, 수치 근거 금지 | disable | judicial/judicial.js | ① 정성 관찰: 구절·1차 문헌·교란·읽을 거리·용도 위반은 거부 |
| RULE-0119 | 정성 판정은 우연 기준선과 함께 보고 | replace | judicial/qual_compare.js | ① 유무 · 단조 · 순서 · 무효 · 결론 조건 |
| RULE-0120 | 결론은 등록 규약의 검증 세트만 | replace | judicial/protocol.js | ① 규약 구조: 완결하면 통과, 빠지면 사유 |
| RULE-0121 | 맥락 열쇠는 contextKeys 여섯 칸, condition 은 정의항 번호 목록 (문장은 scope) | disable | judicial/judicial.js | ③ 맥락 열쇠: 여섯 칸 · 빈 칸 null · 조건 정렬 · 자유 문장은 열쇠 밖 |
| RULE-0123 | 이동된 번호는 쓰지 않음 | disable | judicial/judicial.js | RULE-0123 이동된 번호는 다시 쓰지 않는다: 이동 표에 있는 번호가 아직 표에 있으면 거부 |
| RULE-0124 | 패치는 obs·kinetics 로 쓰고 병합이 대체·철회로 접음 (값 기록 불변) | replace | judicial/judicial.js | ④ 사법부: 값 기록 모양 · 값은 바꾸거나 지울 수 없다 |
| RULE-0125 | values·moved 직접 쓰기 금지 | disable | legislative/legislative.js | ① 거부 말뭉치: 나쁜 패치가 모두 거부되고, 사유가 그대로다 |
| RULE-0126 | 값이 바뀌면 recorded_at 필요 (dbtool 이 찍음) | disable | judicial/judicial.js | ④ 사법부: 값 기록 모양 · 값은 바꾸거나 지울 수 없다 |
| RULE-0127 | 정의항 obs 의 curated 측정값은 from: 'O…' | disable | judicial/judicial.js | RULE-0127 정의항 obs 의 문헌(curated) 측정값은 관찰 기록(from)을 가리켜야 한다 |
| RULE-0128 | 단위는 vocab.unitFactors 만 | disable | judicial/judicial.js | ② 관문: 올바른 관찰은 통과(O 번호 배정), 합성·불확도 없음·SI 아님·보정 불일치는 거부 |
| RULE-0129 | 값은 vocab.physicalBounds 안 | disable | judicial/judicial.js | ① 거부 말뭉치: 나쁜 패치가 모두 거부되고, 사유가 그대로다 |
| RULE-0130 | from 달린 obs 는 관찰 retracted 뒤에만 삭제 | replace | judicial/judicial.js | ④ 사법부: 값 기록 모양 · 값은 바꾸거나 지울 수 없다 |
| RULE-0133 | 재생은 supply, 소멸은 degradation(lost\|recycled) | disable | judicial/judicial.js | 분해 규칙(Degradation_Rule): 운명·재활용 단위·1차 속도(k_deg ↔ 반감기) |
| RULE-0138 | 분자 정의항 tier(T1\|T2) 필수 | disable | judicial/judicial.js | v8 층(tier): 분자 종류는 T1\|T2 필수, 기본값은 kind 로, T1 은 부위 없음, T3 는 정의항에 못 씀 |
| RULE-0139 | 확산·pH·유전율은 위치(context.location) + SI | disable | judicial/judicial.js | v8 관찰: 확산 계수·pH·이온 세기·유전율은 위치 필수, SI 단위, 값 범위 |
| RULE-0140 | 가역 반응은 dG0 (k_r 지어내지 않음) | replace | judicial/judicial.js | v8 열역학: 전이 상태 이론 일치, 미시적 가역성(k/k_r = exp(−ΔG°/RT)), dG_act ≥ 0 |
| RULE-0141 | 닫힌 고리 ΣΔG°=0 (AUDIT_THERMO) | replace | judicial/judicial.js | v8 Wegscheider: 닫힌 고리의 ΣΔG° ≠ 0 이면 AUDIT_THERMO |
| RULE-0153 | 매개 단계를 묶으면 Regulatory_Gap | replace | judicial/judicial.js | RULE-0153 힐 상수 없는 조절 규칙은 한계가 없으면 Regulatory_Gap 후보가 된다 |
| RULE-0154 | 미확인 상수는 hypothetical | replace | judicial/reliability.js | 신뢰 지표 ②: 관문은 쓰인 상수의 등급을 보고 미달을 거부한다 (가상 값은 hypothetical 선언 아래에서만) |
| RULE-0162 | compare: 결과 같고 비용만 늘며 이득 <1e-5 → Optimization-Negative, 넣지 않 | replace | judicial/compare.js | 비교 검토: 같은 조절을 하나 더 넣는 패치는 결과가 같고 복잡도만 늘어 Optimization-Negative (질량 ≤ 1e-14) |
| RULE-0165 | 정제 점검 자동 — 새 중복·미등록 모순은 관문 거부 | replace | judicial/judicial.js | ① 거부 말뭉치: 나쁜 패치가 모두 거부되고, 사유가 그대로다 |
| RULE-0168 | 결합 적분은 질량 작용·가역 결합(정·역)·MM 만, 나머지는 Kinetic_Gap | replace | compiler/ir_builder.js | RULE-0168 결합 적분은 질량 작용·가역 결합·MM 만 — 다른 법칙의 단계는 끄고 사실(step_law_unsupported)로 보고 |
| RULE-0169 | 막 단계는 volumes[막] | replace | compiler/ir_builder.js | RULE-0169 막에서만 일어나는 단계의 반응 부피는 시나리오 volumes[막] 이다 |
| RULE-0172 | 운명·기전 시나리오에 context {role: cause\|requirement\|baseline, sta | replace | judicial/fate_audit.js | MHC ④: 맥락 선언(원인·필수성·일반 상황)이 실행과 맞아야 한다 — 틀린 선언은 판정 실패 |
| RULE-0174 | 교란 실험은 복사본 금지 — 파생 시나리오 { base, perturbation } | replace | compiler/perturb.js | MHC ⑩: null 시나리오 = 기준 + 교란 한 줄 (build-plan 9) — 교란 차이 검사 통과 · 필수성은 같은 대조군과 비교 |
| RULE-0175 | 확률은 stochastic {seed} (실행 전) | replace | judicial/stoch_audit.js | ④ 재현·정수 발화·원장: 같은 (seed, 궤적) → 같은 해시, 다른 궤적 → 다름, 사법부 감사 결함 없음 |
| RULE-0179 | 검증은 사전 등록된 모의 실험 규약 아래에서만 | replace | judicial/protocol.js | ⑭′ 사법부: 증거 보고서 — 세포 상태 계 · 파생(교란) 시나리오 · 사전 등록 판정 수준 |
| RULE-0180 | 규약 protocol: 실제 실험 대응·음성 대조 필수·검정력 반복 수·검증 세트·중단 규칙 | replace | judicial/protocol.js | ① 규약 구조: 완결하면 통과, 빠지면 사유 |
| RULE-0181 | register 로 실행 전 등록, 고치면 미등록 | replace | judicial/protocol.js | ⑭′ 사법부: 증거 보고서 — 세포 상태 계 · 파생(교란) 시나리오 · 사전 등록 판정 수준 |
| RULE-0182 | 규약 없는 실행은 탐색 실행 (일치 결론 불가) | replace | judicial/protocol.js | RULE-0182 규약 없는 실행은 탐색 실행: 규약 판정이 통과로 나오지 않는다 |
| RULE-0186 | 옮겨 다니는 분자에 moieties, 빠진 산물(PPi·Pi)은 규칙·단계(minor)에 | replace | judicial/judicial.js | 현재 저장소는 오류·경고 없음 |
| RULE-0190 | why 없음·미등록 한계 후보·새 정제 문제는 관문(patchPolicy) 거부 | replace | judicial/judicial.js | ① 거부 말뭉치: 나쁜 패치가 모두 거부되고, 사유가 그대로다 |
| RULE-0198 | 데이터를 통과시키려고 규칙을 느슨하게 하지 않음 | delete | tests/fixtures/rejections/ | ① 거부 말뭉치: 나쁜 패치가 모두 거부되고, 사유가 그대로다 |
| RULE-0203 | 바닥값 tests/fixtures/FLOOR.json — 내려가면 실패 | delete | tests/fixtures/rejections/ | ① 거부 말뭉치: 나쁜 패치가 모두 거부되고, 사유가 그대로다 |
| RULE-0204 | skip·todo 금지 | inject | tests/conservation.test.mjs | ③ 건너뛴 시험이 없다 (규칙을 느슨하게 하면서 시험만 skip 하는 수를 막는다) |
| RULE-0206 | 형식 변경 → migrations/ 스크립트 + SCHEMA.md 변경 기록 | disable | judicial/judicial.js | 저장소 형식 버전이 다르면 오류 |
| RULE-0211 | 저장소 밖 사본은 구역 밖이다 | replace | legislative/clerk.mjs | ⑩ 델타 기록 (S1): 기원 봉인 → 병합마다 사건 추가 → 재생 = db · 사건·스냅숏·db 변조를 사법부가 잡는다 |
| RULE-0212 | 오류는 판결·보고서로만 내고, 고치는 것은 에이전트가 새 패치로 (읽기 전용 되먹임) | inject | judicial/obs_compare.js | ③ 사법부: 엔진을 실행하지 않고 쓰지 않는다 · 입법 초안은 검사하지 않는다 |
| RULE-0213 | 사법부(judicial/contract.js)는 계약을 어긴 원자료를 판정하지 않는다 | replace | judicial/fate_audit.js | ⑦ 원자료 계약 (FFI): 엔진 출력은 schemas/ffi/fate-raw.schema.json 을 지키고, 어기면 사법부가 판정하지 않는다 |
| RULE-0216 | 확인을 통과한 것만 verified | replace | judicial/attestation.js | ④ 증명 등록부: 도장 없는 verified 는 오류, 변조·위조 도장은 무효 |
| RULE-0217 | 근거가 문장에 없으면 연결을 빼거나 문장을 고친다 | disable | judicial/judicial.js | 정의 문장에 없는 근거 구절은 거부 |
| RULE-0218 | 번호를 직접 지어내지 않는다 | disable | legislative/legislative.js | 없는 번호로 수정하면 거부 |
| RULE-0219 | 가정 번호는 자기 자리(종류·열쇠·칸·부피는 세포)에만 — 다른 칸에 옮겨 붙이면 풀기 거부 | replace | compiler/assumptions.js | ② 풀기: 번호를 다른 자리에 옮겨 붙이면·없는 번호면 거부 · 번호 없는 시나리오는 같은 객체와 같은 글자 |
| RULE-0220 | 새 가정 기록은 unrecorded 일 수 없다 — 열린 한계를 달고 assumed 로 | disable | judicial/assumption_audit.js | ④ 새 기록 검사: 통과 1 + 거부 사유별 |
| RULE-0223 | 합의 수신함(data/fetched/consensus/)은 신원 수신함을 덮지 않는다 | replace | judicial/trend.js | RULE-0223 합의 수신함은 신원 수신함의 하위 폴더이고 같은 폴더가 아니다 (신원 도장의 증거를 덮지 않음) |
| RULE-0224 | 표에 없는 원천은 창이 없으니 만료 — 창을 지어내지 않는다 | replace | judicial/trend.js | RULE-0224 창 표에 없는 원천의 추세 도장은 만료 — 창을 지어내지 않는다 |
| RULE-0225 | 승인은 사람과 integrator (2026-10-25 결정 — 자동결정률을 위해), 수집가는 못 한다 | replace | judicial/acceptance.js | ④ 도장 검사: 수집가 역할 · 이유 없음 · 변조 · 관찰이 아닌 주체 · 승인 없이 되는 용도는 거부 |
| RULE-0226 | 나중에 축이 내려가면 도장이 있어도 '재검토' | replace | judicial/reliability.js | ② 승인 없음 → needs_approval · 승인 → accepted · 축이 내려가면 review · 철회 → needs_approval |
| RULE-0227 | 기준(standard)은 독립 단위 ≥ 2 — I 축(52) 전에는 아무것도 닿지 못함 | replace | judicial/reliability.js | ③ 승인은 축·관계 조건을 넘지 못한다 — 서기가 쓰지 않는다 |
| RULE-0229 | bounded(S4,D2)와 parameter(S3,D3)는 서로의 문턱을 넘지 못한다 | replace | judicial/reliability.js | ⑫ 관문 문턱은 올리기만: 기본보다 느슨하거나 비교할 수 없는 문턱은 거부 · 지금 데이터의 판정은 그대로 |
| RULE-0230 | 무결성 증명서가 상수 등급 판정을 한 줄로 싣고, 미달이면 FAIL | replace | judicial/process_report.js | MHC ⑨: 상수 등급 관문 — 가상 상수는 hypothetical 선언 아래에서만, 선언을 빼면 운명 판정이 거부한다 |
| RULE-0231 | 미보고 반복 수는 D3, 비교는 1 회로 본다 | replace | judicial/reliability.js | ⑩ 도구 추정값은 D2.estimate · 반복 수 미보고(null)는 받되 D3 · 비교는 1 회로 봄(보수적) · 반복 수를 빼면 거부 |
| RULE-0233 | 같은 열쇠의 현재 값은 하나뿐 | disable | judicial/judicial.js | ③ 같은 열쇠의 현재 값이 둘이면 거부 (새 값은 supersedes 로) |
| RULE-0234 | 결정론은 차이가 분해능(수치 오차 + 분자 1 개)을 넘어야 방향이 있고, 앙상블은 검정으로 | replace | judicial/qual_compare.js | ① 방향: 결정론은 분해능, 앙상블은 z 검정 — 못 보이면 불일치가 아니라 보이지 못함 |
| RULE-0240 | 사법부가 선언과 실행의 일관성을 판정, 어긋나면 무결성 증명서 FAIL | replace | judicial/fate_audit.js | MHC ④: 맥락 선언(원인·필수성·일반 상황)이 실행과 맞아야 한다 — 틀린 선언은 판정 실패 |
| RULE-0243 | perturb_audit 는 컴파일러 코드를 쓰지 않고 기준에서 교란 결과를 다시 세운다 | replace | judicial/perturb_audit.js | ④ 교란 차이 검사: 교란 외에는 대조군과 같다 — 사법부 독립 재구성 |
| RULE-0244 | 규약 칸: 흉내 내는 실험의 출처·종·세포·조건·측정 시점, 음성 대조, 측정량, 검정력 반복 수, 검증 관 | replace | judicial/protocol.js | ① 규약 구조: 완결하면 통과, 빠지면 사유 |
| RULE-0245 | FAIL 조건: 원장·재생 1e-14 초과 · 신호가 일정과 다름 · 궤적 해시 다름 · 쓰인 상수가 입력과 | replace | judicial/process_report.js | RULE-0245 무결성 증명서: 엔진 감사에 AUDIT_MASS 가 있으면 FAIL |
| RULE-0246 | unmapped 외부 ID 도 한계(Identity_Gap) | replace | judicial/judicial.js | ④‴ 봉인 = 병합 규약: dbtool 을 거치지 않아도 why·미등록 한계·정제 점검이 관문에서 막힌다 (판정이 CLI 에만 있으면 서기 경로가 건너뛴다) |
| RULE-0247 | 요청 본문은 서기 postToInbox 가 curl 표준 입력으로, 응답에 계정이 되돌아오면 저장 전에 지운 | replace | legislative/clerk.mjs | ⑪ 서기 POST 받기: 본문은 표준 입력으로만 · 응답에 되돌아온 계정 정보는 지움 · 오류 본문도 지움 |
| RULE-0250 | 목록에 없는 도구는 부르는 자리에서도 거부 | replace | mcp/protocol.mjs | ③ 역할: 기본 collector 는 clerk 의 권위 쓰기를 못 보고, 불러도 거부 · 모르는 역할은 시작 거부 |
| RULE-0251 | --allow-warnings 는 사람 역할만 (MCP) | replace | mcp/clerk.mjs | ③ 역할: 기본 collector 는 clerk 의 권위 쓰기를 못 보고, 불러도 거부 · 모르는 역할은 시작 거부 |
| RULE-0274 | **B (상주 수집가 세션, 독립 실행 시):** 문지기 훅(`rebuild/gate.mjs` — 저장소 ` | replace | rebuild/gate.mjs | ② 판단: 모드 · 막는 명령 · 끝내기 전 시험 없이는 커밋·push 없음 · 수집가 브랜치 |
| RULE-0275 | `register`·`attest`·`accept` · `collector/*` 밖 브랜치로의 `git co | replace | rebuild/gate.mjs | ① 정책: 모드별 쓰기 경로 · 수집가는 핸드오프만 · 영수증은 문지기만 |
| RULE-0286 | 수집가 쓰기는 workspace/ 안에서만, 규칙·코드·db 는 읽기만 | replace | rebuild/gate.mjs | ① 정책: 모드별 쓰기 경로 · 수집가는 핸드오프만 · 영수증은 문지기만 |
| RULE-0287 | **이 명령들 금지**(문지기 훅이 `BIODB_ROLE=collector` 를 보고 막는다): `node  | replace | rebuild/gate.mjs | ② 판단: 모드 · 막는 명령 · 끝내기 전 시험 없이는 커밋·push 없음 · 수집가 브랜치 |
| RULE-0289 | 후보마다 값·단위·종·세포·시각·불확도·출처+인용·use·규약 가능 | replace | judicial/collection_audit.js | RULE-0289 수집 후보: read_value 인데 값이 없으면 INCOMPLETE (출처·인용이 있어도 검토로 넘기지 않음) |
| RULE-0290 | `outcome` ∈ `not_searched\|not_found\|unreadable\|read_no_va | replace | judicial/collection_audit.js | ⑦ outcome 누락·빈 입력 → INCOMPLETE |
| RULE-0291 | 값을 적으면 source + quote 필수 | replace | judicial/collection_audit.js | ③ 근거 없는 값 → REJECTED (꼼수: 미확인을 사실처럼) |
| RULE-0292 | 완료는 수집가가 아니라 판정기가 정한다 — 값 후보는 1차 출처 재확인 전 PASS 아님 | replace | judicial/collection_audit.js | ② 값 후보(출처+인용) 미검증 → REVIEW_REQUIRED (자동 PASS 금지) |
| RULE-0293 | > **아예 분리**돼 있다. 작업자는 저장소 전체를 **읽을** 수 있으나 **쓰기는 여기(`workspa | replace | rebuild/gate.mjs | ① 정책: 모드별 쓰기 경로 · 수집가는 핸드오프만 · 영수증은 문지기만 |
| RULE-0295 | **쓰기는 `workspace/` 안에서만.** `data/db.json`·`vocab.js`·`model. | replace | rebuild/gate.mjs | ① 정책: 모드별 쓰기 경로 · 수집가는 핸드오프만 · 영수증은 문지기만 |
| RULE-0296 | `compiler/`·`engine/`·테스트·형식 파일을 수정하지 않는다(읽기만). | replace | rebuild/gate.mjs | ① 정책: 모드별 쓰기 경로 · 수집가는 핸드오프만 · 영수증은 문지기만 |
| RULE-0297 | **적용·등록 금지.** `node dbtool.mjs augment apply`·`merge`·`regis | replace | rebuild/gate.mjs | ② 판단: 모드 · 막는 명령 · 끝내기 전 시험 없이는 커밋·push 없음 · 수집가 브랜치 |
| RULE-0309 | **통제 어휘** (`vocab.js`): kind·분야·위치(3D/2D, 막 면, 특수 위치의 부모)·막  | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0311 | **외부 ID·구조 지문·잔기 번호**: 형식·kind 검사, 같은 ID·지문 중복 금지. 모르면 지어내지  | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0312 | **구조**: 구성 요소는 복합체만, 부위의 `on` 은 구성 요소, 막 면은 그 막에 있는 면, 막 결합  | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0319 | 부위·규칙 키는 영문 소문자·숫자·`_` (`reg_phos`, `gs_gef`). 잔기 번호 같은 종 의존 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0323 | 패치의 새 별칭이 다른 개념의 이름이면 거부. 이름에 `#` `@` `\|` `/` 금지. | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0324 | 이미 뜻이 있는 개념에 새 뜻을 더하려면 `distinction`(기존 뜻과의 차이)이 필수. 없으면 거부. | replace | legislative/legislative.js | 띄어쓰기만 다른 이름은 기존 개념으로 매핑되고, 설명 없는 새 뜻 추가는 거부 |
| RULE-0325 | 정의항을 다른 개념으로 옮길 수 없다. | replace | legislative/legislative.js | 정의항을 다른 개념으로 옮길 수 없음 |
| RULE-0327 | 가리키는 개념의 뜻이 여러 개면 거부하고 후보를 보여 준다. 없는 이름이면 거부하고 비슷한 이름을 제안한다. | replace | legislative/legislative.js | RULE-0327 뜻이 여러 개인 이름은 거부하고 후보를 보이고, 없는 이름은 비슷한 이름을 제안하고, 여러 개념과 겹치는 이름은 패치에서 거부 |
| RULE-0330 | 목록에 없는 값은 거부되고 가까운 값을 제안한다. 목록에 값을 추가하는 것은 사람이 `vocab.js` 를  | replace | model.js | RULE-0330 어휘 목록에 없는 값은 거부하고 가까운 값을 제안한다 (전체 목록이 아니라 비슷한 값) |
| RULE-0331 | **참여자 종류**(protein, complex, nucleic_acid, small_molecule, m | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0332 | 구성 요소(`components`)는 `complex` 만 가지며, 구성 요소는 참여자 종류여야 한다. 구성 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0333 | 단계의 `part_of` 대상은 `pathway` 정의항이어야 한다. | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0334 | `is_a`: 분자 → 같은 kind 또는 molecule_class / molecule_class → mo | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0337 | 잔기 번호는 부위의 `numbering: { "종 번호": "Ser14" }` 로 종마다 적는다. | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0339 | `association`: soluble \| integral \| peripheral \| lipid_an | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0340 | 막 결합(soluble 이 아님)이면 `location` 은 2D 위치(막). peripheral·lipid | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0341 | 수용성 분자의 묶음은 3D 위치에만, 막 결합 분자의 묶음은 자기 막(또는 그 하위 위치)에만 있을 수 있다 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0342 | `features`: 이 부위가 가질 수 있는 특징. 묶음에서 한 부위는 특징 하나. | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0343 | `on`: 복합체에서 그 부위가 실제로 있는 구성 요소. `face`: 막 결합 분자에서 그 부위가 향한 면 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0344 | **curated**: 실제로 확인한 문헌만. DOI 또는 PMID + citation 필수. **인용을 지 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0345 | **abstracted** = `[Abstracted Logic: Derived from the inferr | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0346 | computed(도구 `tool` 필수) \| asserted(출처 없이 적은 일반 지식) \| predic | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0348 | `when` 의 부위·특징은 그 정의항에 정의된 것이어야 한다. | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0349 | `agent: true` 면 소유자(규칙을 가진 정의항)가 행위자로 단계에 들어가야 한다. `via_site | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0350 | `modify` \| `target`(생략하면 소유자), `site`, `add`, `remove`, `pa | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0351 | `convert` \| `consumes`, `produces` \| 기질 → 생성물 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0352 | `dissociate` / `associate` \| `complex`(생략하면 소유자), `partner` | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0353 | `transport` \| `target`, `from`, `to` \| 위치 변화 — 위치를 바꾸는 유일한 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0354 | `transfer` \| `partner`(리간드), `from_site`(소유자 부위), `target`, | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0355 | `degrade` \| `complex`, `component`, `produces` \| 복합체의 한 구성 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0356 | `action` 은 어휘의 허용 효과만 쓸 수 있고, `adds`·`removes` 가 정해진 action( | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0357 | `with`: 보조 기질·생성물(ATP→ADP 등). `regulators`: `[{ ref, effect, | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0358 | 묶음 키: `바탕 D\|부위:특징\|…\|위치`. 특징은 부위 이름순으로 정렬한 표준 형식이어야 한다. 빈  | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0359 | 패치에서는 참여자를 `{ ref, features: { 부위: 특징 } \| ["부위:특징"], locati | replace | legislative/legislative.js | RULE-0359 패치 참여자의 특징 "부위:특징" 은 콜론으로 나뉜다 — 형식이 틀리면 거부 |
| RULE-0360 | 규칙은 원천의 전이 규칙이어야 한다. | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0361 | 행위자: `agent` 규칙이면 소유자의 묶음이 agents 에 있고, 소유자의 상태 의미 규칙상 **비활성 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0362 | 변화량 = 규칙 효과: modify 는 대상의 입력·출력 묶음이 정확히 하나씩, 규칙의 부위만 `remove | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0363 | 위치: 수송이 아닌 단계에서 대상의 위치가 바뀌면 오류. 수송은 `from → to` 와 일치, 특징은 그대 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0364 | 위치 조건(`where`)과 **공간 접촉**: 반응 중심(행위자, 없으면 대상)과 모든 참여자가 맞닿을 수 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0365 | 보조 기질·생성물, 조절자는 규칙에 정의된 것만. | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0366 | **동일성 보존**: 결합(상대 흡수)·해리·결합체 형성·전달·분해·수송 단계는 입력과 출력의 실체가 같아야 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0369 | **Type** (`vocab.js` 의 `gapTypes`): `Kinetic_Gap`(속도·Kd·시간 상 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0370 | **Requirement**: 사람이 읽는 `text` + 기계가 확인하는 해결 경로 `needs`. | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0371 | `obs`: 그 정의항에 그 관찰(세포·위치 맥락)이 들어오면 충족 · `residue`: 그 부위에 기준  | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0372 | **구조 필드 (가 스키마, 2026-10-23, 선택)**: `symptom`(정량 증상 — 키 소문자·숫 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0374 | 시뮬레이터는 기본값·무한 풀로 시작량을 정한 묶음을 표시하고, 그 경로의 Concentration_Gap 이 | replace | judicial/judicial.js | RULE-0374 시뮬레이션 보고는 기본값·무한 풀 시작량을 농도 공백으로 표시하고 등록된 한계를 적는다 |
| RULE-0377 | 해상도 일관성: 부위의 구조 참조는 정의항 `xrefs` 의 같은 PDB 여야 한다. 좌표 자체는 저장하지  | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0378 | 법칙(`kineticLaws`): `mass_action`(k, order — 차수 = 반응물 분자 수 +  | replace | judicial/judicial.js | 속도 무결성: 법칙·필수 상수·Kd = k_off/k_on·두 분자 결합·효소 규칙 |
| RULE-0379 | 속도 무결성: Kd 와 k_off/k_on 이 10% 안에서 맞아야 하고, 차수·분자 수·효소 조건이 맞아야 | replace | judicial/judicial.js | 속도 무결성: 법칙·필수 상수·Kd = k_off/k_on·두 분자 결합·효소 규칙 |
| RULE-0382 | 경로·과정·원리 정의항은 `supply` 규칙만 가질 수 있다. 단계는 `transition` 규칙만 참조한 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0383 | `where` 는 부피(3D) 위치 정확히 하나 — 저장소 묶음 = `정의항\|위치`. | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0384 | 속도 법칙은 `zero_order`(k, M·s⁻¹ — 소비가 없는 공급) 또는 `mass_action`(차 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0385 | `fate` (`lifecycleFates`): `lost` 계 밖으로(질량 감사의 소실 원장) · `rec | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0386 | `recycle_to[].n` 은 양수 또는 `"sequence_length"` (그 정의항의 `sequen | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0387 | 속도는 1차(`mass_action`, order 1): `k`(= k_deg, s⁻¹) 또는 `half_l | replace | judicial/judicial.js | 분해 규칙(Degradation_Rule): 운명·재활용 단위·1차 속도(k_deg ↔ 반감기) |
| RULE-0389 | 정의항 `moieties: [{ ref: 구조 요소(structure_feature) 정의항, n: 정수 } | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0396 | kind `cell_state` \| 정의항 \| 분자가 아닌 상태 — 규칙·부위·부분 구조·구성 요소·층  | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0397 | `metabolome: [{ ref: "D…/rule/키", level }]` \| cell_state \| | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0398 | `transitions: [{ to, signals, commitment: { criterion }, tex | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0399 | 속도 법칙 `hill` \| kinetics \| 조절 규칙에만, 조절 규칙은 hill 만. `K`(M) > | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0400 | 공급 소비 `saturating: true` \| supply 의 consumes 항목 \| 포화 보조 기질 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0402 | `observable { kind, target, param?, denominator?, also? }`:  | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0403 | `calibration { kind: identity \| linear(a, b) \| table(point | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0404 | `evidence`: curated(문헌) 또는 computed(포트 변환 도구)만. | replace | judicial/judicial.js | ② 관문: 올바른 관찰은 통과(O 번호 배정), 합성·불확도 없음·SI 아님·보정 불일치는 거부 |
| RULE-0405 | 참조한 관찰은 같은 규칙·같은 칸을 같은 값으로 잰 `estimation` 용도의 철회되지 않은 기록이어야  | replace | judicial/judicial.js | ③ 실측 상수 = 관찰의 파생값: from 이 같은 규칙·칸·값을 가리켜야 하고, 검증용 관찰은 추정에 못 씀 |
| RULE-0406 | 근거가 curated 인 속도 상수는 order 를 뺀 모든 칸에 `from` 이 있어야 한다. | replace | judicial/judicial.js | ③ 실측 상수 = 관찰의 파생값: from 이 같은 규칙·칸·값을 가리켜야 하고, 검증용 관찰은 추정에 못 씀 |
| RULE-0414 | 형식은 `vocab.js` 의 정규식으로 검사한다. 같은 외부 ID 는 정의항 하나에만 붙는다. | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0417 | `COMPLEX` \| complex \| `CPX(구성지문x개수+…)` — 구성 요소를 정렬해 이은 것 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0418 | 같은 지문은 정의항 하나에만 붙는다. `status`: `computed`(도구로 계산) / `asserte | replace | judicial/judicial.js | ④ 증명 등록부: 도장 없는 verified 는 오류, 변조·위조 도장은 무효 |
| RULE-0421 | 이전 형식(v2·v3) 패치(`terms` 가 객체, `definientia`, `states`)는 거부된다 | replace | legislative/legislative.js | 이전 형식 패치(v2·v3)는 거부 |
| RULE-0422 | 매핑 오류 또는 검사 오류가 새로 생김 \| 거부 | replace | legislative/clerk.mjs | ④ 입법 서기: 봉인 없는·변조된·다른 db 의 판결로는 쓰지 않는다 · 보호 위치에 보고서를 쓰지 않는다 |
| RULE-0435 | 한 db 에 항목이 둘 이상 \| 역할이 서로 달라야 하고, 그중 하나는 `physiological` 이어야 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0436 | 모체만 적힌 저분자 \| 경고 — 반응 참여자(physiological)를 함께 적는 것이 규약 | replace | judicial/judicial.js | RULE-0436 저분자에 ChEBI 모체(parent)만 있으면 경고 — 반응 참여자(physiological)를 함께 적는 규약 |
| RULE-0440 | 막 이동 경로 `membrane.route` \| 막 단백질이 분비·섭취 경로에서 거쳐 가는 다른 막들. 묶 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0441 | 소모된 것의 행방 \| 공급 규칙은 생성물이 필요하다(`produces` 필수). 떨어져 나간 반복 단위는  | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0442 | 분열 허가·정지 \| 조절 규칙(힐)의 배율. 허가는 신호의 **활성**(`activates`), 정지는 억 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0444 | (`checkSenseObsFrom` — `checkKineticsFrom` 의 거울). 철회된 관찰이나 ` | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0446 | **값 기록**: `{ subject: D… \| D…/rule/키, property, value { dis | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0447 | **두 시간**: `recorded_at`(기록 시각)·`evidence_at`(근거 시각). `model. | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0448 | **사법부**: `validateValues`(대상·속성 어휘·분포·유도 방식·기록 시각·근거 관찰·대체 사 | replace | legislative/legislative.js | ④ 변경 불가: 관찰은 바꾸거나 지울 수 없고, 철회 표시만 더할 수 있음 |
| RULE-0451 | **기록**: `{ seq, at, id: 'A' + 여섯 자리 순번, slot { kind: kinetic | replace | judicial/assumption_audit.js | RULE-0451 가정 원장: 기원(origin) 어휘 밖의 새 기록은 거부 |
| RULE-0452 | **사법부**: `judicial/assumption_audit.js` — 사슬(seq·prev·root·번 | replace | judicial/assumption_audit.js | ④ 새 기록 검사: 통과 1 + 거부 사유별 |
| RULE-0482 | → 이들은 **REVIEW_REQUIRED**로 두고 "완료"로 적지 않는다. | replace | judicial/collection_audit.js | ② 값 후보(출처+인용) 미검증 → REVIEW_REQUIRED (자동 PASS 금지) |
| RULE-0489 | `subject`: 정의항 `D…` · 규칙 `D…/rule/키` · 묶음 키 · 위치(`vocab.loca | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0498 | 번호는 정해진 모양이다 — 개념 T·정의항 D·단계 S·관찰 O·한계 L 은 글자 하나 + 숫자 여섯 자리 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0499 | 개념(T)은 한국어 이름(names.ko)을 가지고, 뜻(정의항)이 하나 이상 있다 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0500 | 정의항(D)은 소속 개념이 있고, 개념 안에서 겹치지 않는 뜻 번호(n)를 가진다 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0501 | 정의항 설명(desc)은 하나 이상이고, 각 설명은 정의 문장(text)·분야(field, 어휘)·맥락 범위 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0502 | 규칙은 정의항 안에서 겹치지 않는 id 와 이름(label)을 가지고, 종류(type)는 어휘의 것이다 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0503 | 규칙의 전제 조건(requires)은 있는 정의항의 있는 부위·특징을 가리키고, 그 규칙을 쓰는 단계는 전제 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0504 | 정의항 obs 값은 속성의 값 종류·SI 정준 단위·위치 필수 여부·범위(pH 0–14, 양수 속성)·값 목 | replace | judicial/judicial.js | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| RULE-0505 | 패치는 JSON 객체이고 terms·senses·steps·limitations·observations 는  | replace | legislative/legislative.js | RULE-0505 패치는 JSON 객체여야 한다 — 객체가 아니면 병합 거부 |
| RULE-0506 | 추가만 하는 기록(병합 기록·받기 기록·사전·사전 등록부)은 사슬이다 — 순번이 이어지고 prev 는 직전  | replace | judicial/dictionary_audit.js | ② 변조·삭제는 거부 |
| RULE-0507 | 입법 서기는 사법부 봉인이 있고, 판결이 통과이고, 쓰려는 내용이 봉인된 것과 같을 때만 쓴다 (형식 변환· | replace | legislative/clerk.mjs | RULE-0507 서기는 봉인된 db 와 쓰려는 db 가 같을 때만 형식 변환을 쓴다 |
| RULE-0508 | 수신함 파일은 받기 기록(FETCH_LOG)과 같아야 한다 — 기록에 있는데 없거나, 받은 뒤 내용이 바뀌면 | replace | judicial/collection_audit.js | ⑥ 받기 기록 검사: 통과 · 사슬 변조 · 받은 뒤 파일이 바뀜 · 파일이 사라짐 |
| RULE-0509 | 병합 기록을 기원 스냅숏부터 다시 돌리면 지금 db 와 같아야 한다 — 기록을 거치지 않은 쓰기(직접 편집) | replace | judicial/log_audit.js | RULE-0509 병합 기록 재생: 형식 변환 스크립트가 기록과 다르거나 지금 db 가 기록의 끝과 다르면 거부 |
| RULE-0510 | 사전 새 항목은 vocab 에 있는 register·키만, 영어 라벨·뜻은 비지 않은 문자열, since 는 | replace | judicial/dictionary_audit.js | RULE-0510 사전 새 항목은 객체여야 하고 vocab 의 register·키만 받는다 |
| RULE-0511 | 외부 ID 확인은 원본 응답과 대조한다 — 번호·기준 종·이름이 맞아야 하고, 이미 다른 정의항에 있는 번호 | replace | judicial/identity.js | 자동 보강 build: 검증만 verified·출처·서열 길이·지문, 종·번호·이름·화학식·중복 위반은 거부, 모호하면 unmapped 유지 + 후보 메모, as |
| RULE-0512 | 검사 자리는 첫 인자로 규칙 번호를 낸다 — 새 검사는 규칙 장부에 규칙 먼저(없으면 from_code),  | replace | judicial/judicial.js | ⑫ 판정 코드가 규칙 번호를 낸다: 검사 자리마다 첫 인자가 살아 있는 RULE 번호 (5d) |
| RULE-0513 | 다른 모드가 필요하면 세션은 전환 기록 { from, to, at, why, target, files, op | replace | judicial/transition_audit.js | RULE-0513 전환 기록 검사: 통과 1 + 거부 사유별 |
| RULE-0514 | 세션은 모드 하나로 시작해서 끝난다 — 모드를 열기 전에는 저장소에 쓰지 않고, 세션 안에서 모드를 바꾸지  | replace | rebuild/gate.mjs | ② 판단: 모드 · 막는 명령 · 끝내기 전 시험 없이는 커밋·push 없음 · 수집가 브랜치 |
| RULE-0515 | 모드마다 쓸 수 있는 곳만 바뀐다 (rebuild/rules/modes.json gate) — Edit·Wr | replace | rebuild/gate.mjs | ② 판단: 모드 · 막는 명령 · 끝내기 전 시험 없이는 커밋·push 없음 · 수집가 브랜치 |
| RULE-0517 | 영수증(workspace/receipts/)은 문지기만 쓴다 — 사슬로 덧붙이기만, 고치거나 지우면 쓰는 도 | replace | rebuild/gate.mjs | ② 판단: 모드 · 막는 명령 · 끝내기 전 시험 없이는 커밋·push 없음 · 수집가 브랜치 |
| RULE-0516 | 끝내기 전 시험 묶음(node rebuild/gate.mjs finish <모드>)이 지금 파일 상태(작업  | replace | rebuild/gate.mjs | ② 판단: 모드 · 막는 명령 · 끝내기 전 시험 없이는 커밋·push 없음 · 수집가 브랜치 |
| RULE-0299 | **본체(main) 금지.** 커밋·push 는 자기 수집 브랜치(`collector/*`)에만, 바뀐 파일 | replace | rebuild/gate.mjs | ② 판단: 모드 · 막는 명령 · 끝내기 전 시험 없이는 커밋·push 없음 · 수집가 브랜치 |
| RULE-0433 | `evidence` 검증 근거 \| S ≥ 3 ∧ D ≥ 2 ∧ 불일치 아님 \| 기준 종 · 확인된 문헌( | replace | judicial/reliability.js | ② 승인 없음 → needs_approval · 승인 → accepted · 축이 내려가면 review · 철회 → needs_approval |
| RULE-0228 | 판정은 하나 — 용도별 판정 함수는 reliability.accept 하나, 관문·observe·fate·증 | replace | judicial/reliability.js | ⑦ 관문은 인정의 추정 조건을 본다: 다른 종 상수 거부 · 조건부(오차 막대)도 관문은 통과시키지 않음 · 사람 상수는 그대로 |
| RULE-0456 | 판정 셋: **CONSISTENT**(FINDING — 가설 하나면 선언된 허용 차이 δ 안임을 동등성 검정 | replace | judicial/obs_compare.js | ④ 관찰 판정: 세 판정·필요 정밀도·추정용 거부·결정론의 퍼짐 공백 |
| RULE-0486 | CONSISTENT \| (사전 등록된 규약의 검증 세트 관찰만 — build-plan 3) 가설 하나: 선 | replace | judicial/obs_compare.js | ④ 관찰 판정: 세 판정·필요 정밀도·추정용 거부·결정론의 퍼짐 공백 |
| RULE-0196 | 주석은 계약·이유만, 이력은 CHANGES.md | replace | core.js | ⑳ 코드 주석에 이력(날짜·예전)이 없다 — 이력은 CHANGES.md (RULE-0196) |

## 설정에 있음 `present` — 8

| 규칙 | 내용 | 변이 | 파일 | 빨개진 시험 · 메모 |
|---|---|---|---|---|
| RULE-0056 | data/db.json 직접 편집 금지 | static | .claude/settings.json |  |
| RULE-0156 | 운명 층 변경 → node tests/fate_suite.js | static | .github/workflows/check.yml |  |
| RULE-0200 | 어느 경우든 node dbtool.mjs validate | static | .github/workflows/check.yml |  |
| RULE-0207 | index.html = viewer.html 복사본 | static | .github/workflows/check.yml |  |
| RULE-0209 | 현재 값은 textbook --write 로 생성 | static | .github/workflows/check.yml |  |
| RULE-0210 | 파일 추가·이동 → storage-map.json 에 분류 | static | .github/workflows/check.yml |  |
| RULE-0253 | 읽기·검증·시뮬레이션·시험은 허가를 묻지 않는다. 데이터를 바꾸는 명령과 `git push` 는 묻는다(`. | static | .claude/settings.json |  |
| RULE-0300 | 보이게 못박는다. `data/fetched/`(원본 수신함)는 별개로 쓰기 보호이며 `augment plan | static | .claude/settings.json |  |

## 시험 통과 (자리 변이 없음) `test_passes` — 26

| 규칙 | 내용 | 변이 | 파일 | 빨개진 시험 · 메모 |
|---|---|---|---|---|
| RULE-0004 | 연결은 번호로만 | test_only | tests/rules.test.mjs | 번호 참조 — 정규화·매핑 전체에 흩어져 자리 하나로 끌 수 없음 |
| RULE-0034 | 교란은 컴파일러 perturb.js 가 시나리오 exclude_rules·rule_scale 로만, 엔진 불 | test_only | tests/perturb.test.mjs |  |
| RULE-0049 | Rust 소스 변경 → sh engine/rust/build.sh 산출물 같은 커밋 | test_only | tests/rust_engine.test.mjs |  |
| RULE-0050 | Rust 변경 → rust_engine.test 통과 (궤적 ≤rtol·운명·시각 같음·byteLength  | test_only | tests/rust_engine.test.mjs |  |
| RULE-0051 | 알고리즘 변경은 두 백엔드 같은 커밋 | test_only | tests/rust_engine.test.mjs |  |
| RULE-0053 | 사건·결정 시각은 직전 스냅숏에서 advance 재적분 + 근 찾기·이분, 격자 Δ 로 되돌리지 않음 | test_only | tests/mhc.test.mjs |  |
| RULE-0054 | 탐침(probe_pool)은 (상태, t0) 순수 함수, lanes 무관 직렬과 동일 | test_only | tests/rust_engine.test.mjs |  |
| RULE-0055 | 확률: 출생–사멸 JS=Rust 비트, 운명 프로그램은 두 표본 검정, 네이티브=WASM 비트 | test_only | tests/stochastic.test.mjs tests/rust_engine.test.mjs |  |
| RULE-0083 | 속도 상수는 규칙 kinetics 에 SI 정준 단위 | test_only | tests/rules.test.mjs | SI 정준 단위 — 정규화가 환산하므로 끌 자리가 여럿 |
| RULE-0087 | 가정 고치기는 revises 새 번호, 가리키는 쪽은 최신을 따라가지 않음 | test_only | tests/assumptions.test.mjs |  |
| RULE-0092 | 등급은 계산(judicial/reliability.js, grade) — 점수를 데이터에 쓰지 않음 | test_only | tests/reliability_criteria.test.mjs |  |
| RULE-0094 | 보고 시 쓴 값의 등급 명시 | test_only | tests/mhc.test.mjs |  |
| RULE-0155 | 운명 보고 시 결정 시점·정지 원인·'상수는 가상' | test_only | tests/mhc.test.mjs |  |
| RULE-0171 | 기전 층 변경 → node --test tests/mhc.test.mjs | test_only | tests/mhc.test.mjs |  |
| RULE-0173 | 보고는 맥락과 함께 | test_only | tests/mhc.test.mjs |  |
| RULE-0177 | 확률 방식·문턱 변경 → tests/stochastic.test.mjs | test_only | tests/stochastic.test.mjs |  |
| RULE-0178 | 확률 없으면 결정론 비트 불변 | test_only | tests/stochastic.test.mjs |  |
| RULE-0185 | 예측은 실행 전 expect, 실행 뒤 변경 금지 | test_only | tests/protocol.test.mjs |  |
| RULE-0189 | 데이터 패치 why → Patch Report 자동 (data/patches/ 의 report) | test_only | tests/rules.test.mjs |  |
| RULE-0202 | 거부 패치는 tests/fixtures/rejections/ + EXPECT.json | test_only | tests/rejections.test.mjs |  |
| RULE-0221 | 탐색 실행(미등록)은 인라인 숫자를 허용하되 첫 장면 기원 감사가 unrecorded 로 센다 | test_only | tests/assumptions.test.mjs |  |
| RULE-0235 | 보이지 못한 것은 불일치가 아니다 | test_only | tests/qual_compare.test.mjs |  |
| RULE-0236 | 효과 없음은 앙상블에서 동등성 허용 차이 δ 가 있어야 보인다 | test_only | tests/qual_compare.test.mjs |  |
| RULE-0238 | 운명 보고에 결정 시점은 신호 철회 시험으로 | test_only | tests/mhc.test.mjs |  |
| RULE-0241 | 운명 비율(구간)·도달 시각 분포·표지 퍼짐(Fano)은 judicial/stoch_audit.js | test_only | tests/stochastic.test.mjs |  |
| RULE-0284 | `tests/rejections.test.mjs` 가 자동으로 잡지만, 사람 눈으로도 한 번 본다. | test_only | tests/rejections.test.mjs |  |

## 아직 시험 안 함 — 0

없음
