# 규칙 장부

> 생성물 — `node rebuild/status.mjs --write`(응답이 끝날 때 훅이 돌림). 손으로 고치지 않는다. 읽기 점검용이며 다른 코드가 읽지 않는다.

원본: `rebuild/rules/rules.jsonl` · 규칙 511 (판단으로 매긴 원래 규칙 단위마다 하나, 사본은 copies). 휴리스틱으로 매긴 규칙 단위 0 은 아직 장부에 묶지 않음.

## 은퇴 · 예약

살아 있는 규칙 500 · 은퇴 11 (`rebuild/archive/p3-p5-layer.json`) · 예약 2

| 규칙 | 예약 대상 | 맥락 |
|---|---|---|
| RULE-0138 | field | T1 연속 장 · T2 규칙 행위자 — 공간·연속·이산을 한 엔진에서 다루려고 v8 에 둔 층 표시. 정의항 156 개에 있고(T1 38 · T2 118) 사법부가 검사하지만 지금 읽는 엔진은 없다. 적분장 엔진이 읽을 칸으로 둔다 |
| RULE-0139 | field | pH·유전율은 simulateRate 환경 보정이 쓴다. 확산 계수만 예약 — 데이터 0 건, 읽는 코드 없음(P3 FV 의 입력이었다) |

## 집행

| 집행 | 규칙 |
|---|---|
| machine | 282 |
| text | 227 |
| none | 0 |
| unchecked | 2 |

## 한 규칙이 적힌 곳

| 곳 | 규칙 |
|---|---|
| 1 곳 | 291 |
| 2 곳 | 104 |
| 3 곳 | 60 |
| 4 곳 | 33 |
| 5 곳 이상 | 23 |

## 여러 모드에 걸친 규칙 76 (6 단계 모드 문서에서 빠지면 안 되는 것)

| 규칙 | 모드 | 내용 |
|---|---|---|
| RULE-0004 | common · author | 연결은 번호로만 |
| RULE-0010 | common · develop | 부분 구조 수지 ΣIn=ΣOut 상대 1e-14 (규칙 검사·운명 원장) |
| RULE-0018 | author · develop | 권한은 입출력기 clerk 하나 — 단일 작성자 잠금, 권위 쓰기는 dbtool 명령으로 사법부 재판정 뒤 |
| RULE-0019 | author · develop | 역할 BIODB_ROLE 기본 collector (핸드오프만) |
| RULE-0024 | common · author | 그 밖의 로그인(학교 계정 등)은 쓰지 않는다 |
| RULE-0026 | author · develop | 행정부는 관찰을 읽지 않는다; 예측 표본은 조정자가 compiler/obs_operator.js 로 |
| RULE-0027 | author · inspect | 'verified' 는 attestations/registry.json 의 유효 도장으로만, 없으면 관문 거부 |
| RULE-0039 | common · baseline · inspect | FINDING 은 고치지 않는다 — 결과(고갈·정지)를 결함으로 고치지 않음 |
| RULE-0040 | common · author · baseline | DATA_GAP 은 한계 등록 |
| RULE-0041 | common · author · baseline | DOMAIN_CONFLICT 는 근거와 함께 데이터 패치 |
| RULE-0042 | common · develop · inspect | NUMERICAL 은 결합점·솔버에서 — db 생물 상수 변경 금지 |
| RULE-0043 | common · develop | ENGINE_DEFECT 는 엔진, COMPILER_DEFECT 는 compiler/ |
| RULE-0049 | develop · field | Rust 소스 변경 → sh engine/rust/build.sh 산출물 같은 커밋 |
| RULE-0050 | develop · field | Rust 변경 → rust_engine.test 통과 (궤적 ≤rtol·운명·시각 같음·byteLength 불변·네이티브=WASM 비트·루프 할당 0) |
| RULE-0051 | develop · field | 알고리즘 변경은 두 백엔드 같은 커밋 |
| RULE-0052 | baseline · field | 수치 L2 수렴 기준은 같은 적분기 허용 오차 1/1000 (orchestrator.refScenario) |
| RULE-0053 | develop · field | 사건·결정 시각은 직전 스냅숏에서 advance 재적분 + 근 찾기·이분, 격자 Δ 로 되돌리지 않음 |
| RULE-0054 | develop · field | 탐침(probe_pool)은 (상태, t0) 순수 함수, lanes 무관 직렬과 동일 |
| RULE-0055 | develop · field | 확률: 출생–사멸 JS=Rust 비트, 운명 프로그램은 두 표본 검정, 네이티브=WASM 비트 |
| RULE-0056 | common · author | data/db.json 직접 편집 금지 |
| RULE-0067 | common · author | 수신함은 해석만, 실행 금지 |
| RULE-0081 | baseline · inspect | 시뮬레이션 보고에 농도 공백(기본값·무한 풀) 명시 — 도달 여부만 말함 |
| RULE-0085 | author · develop | 미확인 값 금지 — 시험값은 가정 원장 번호 A… 를 hypothetical 시나리오가 {assume} 로 |
| RULE-0086 | author · develop | 가정 원장 쓰기는 assume add 감사·봉인 뒤 서기만 |
| RULE-0087 | author · develop | 가정 고치기는 revises 새 번호, 가리키는 쪽은 최신을 따라가지 않음 |
| RULE-0088 | author · baseline | 새 사전 등록은 인라인 가상 숫자 거부 |
| RULE-0092 | common · author · develop | 등급은 계산(judicial/reliability.js, grade) — 점수를 데이터에 쓰지 않음 |
| RULE-0093 | common · inspect | S×D 곱으로 판정하지 않음 |
| RULE-0094 | common · baseline | 보고 시 쓴 값의 등급 명시 |
| RULE-0100 | baseline · inspect | 결론은 가장 약한 근거를 따름 (acceptance_review — 보고서·observe·fate) |
| RULE-0101 | baseline · inspect | 시뮬레이션 관문도 같은 판정 (문턱 ∧ '추정' accepted, 종 = kinetics.context.species) |
| RULE-0103 | baseline · inspect | 등급 문턱(기본 parameter) 미달 데이터 상수 = AUDIT_KINETIC |
| RULE-0104 | author · baseline · inspect | 시나리오 값은 hypothetical: true 때만 |
| RULE-0109 | common · author | 도구 추정(computed·predicted)은 실측이 아님 (D2.estimate) |
| RULE-0111 | author · baseline | 추정용을 검증에 쓰지 않음 |
| RULE-0112 | author · baseline | 합성 관찰은 examples/observations/ 만 |
| RULE-0115 | author · inspect | 정성 관찰은 1차 문헌(DOI·PMID) provenance.source + 원문 quote 필수 |
| RULE-0119 | author · baseline | 정성 판정은 우연 기준선과 함께 보고 |
| RULE-0124 | author · develop | 패치는 obs·kinetics 로 쓰고 병합이 대체·철회로 접음 (값 기록 불변) |
| RULE-0125 | author · develop | values·moved 직접 쓰기 금지 |
| RULE-0126 | author · develop | 값이 바뀌면 recorded_at 필요 (dbtool 이 찍음) |
| RULE-0131 | author · develop | 환산표는 하나 (엔진과 사법부가 같은 것) |
| RULE-0132 | author · baseline | Audit Error 는 한계를 채우거나 등록 |
| RULE-0134 | author · baseline | 고갈은 결과로 보고 (결함 아님) |
| RULE-0137 | author · baseline | 안정성 감사가 나오면 Δt 줄여 수렴할 때만 보고 |
| RULE-0138 | author · field | 분자 정의항 tier(T1\|T2) 필수 |
| RULE-0141 | author · baseline | 닫힌 고리 ΣΔG°=0 (AUDIT_THERMO) |
| RULE-0142 | author · field | 실행 상태는 db 가 아니라 시나리오 domains·engine/ |
| RULE-0155 | author · baseline | 운명 보고 시 결정 시점·정지 원인·'상수는 가상' |
| RULE-0156 | author · develop | 운명 층 변경 → node tests/fate_suite.js |
| RULE-0159 | author · baseline | 억제 힐 K = 임계값 −10 % |
| RULE-0161 | author · baseline | 도달 시각은 Δ 바꿔 확인 |
| RULE-0162 | author · develop | compare: 결과 같고 비용만 늘며 이득 <1e-5 → Optimization-Negative, 넣지 않음 |
| RULE-0167 | author · baseline | 기전은 세포 상태 mechanisms 에 걸어 운명 엔진으로 (따로 돌리는 길 금지) |
| RULE-0168 | author · develop | 결합 적분은 질량 작용·가역 결합(정·역)·MM 만, 나머지는 Kinetic_Gap |
| RULE-0169 | author · baseline | 막 단계는 volumes[막] |
| RULE-0170 | author · baseline | simulateRate 와 서로 기준 금지 (L000081) |
| RULE-0171 | author · develop | 기전 층 변경 → node --test tests/mhc.test.mjs |
| RULE-0172 | author · baseline | 운명·기전 시나리오에 context {role: cause\|requirement\|baseline, state, note} |
| RULE-0174 | author · baseline | 교란 실험은 복사본 금지 — 파생 시나리오 { base, perturbation } |
| RULE-0177 | baseline · develop | 확률 방식·문턱 변경 → tests/stochastic.test.mjs |
| RULE-0178 | baseline · develop | 확률 없으면 결정론 비트 불변 |
| RULE-0182 | author · baseline | 규약 없는 실행은 탐색 실행 (일치 결론 불가) |
| RULE-0183 | author · baseline | 운명 결과는 fate --report 과정 보고서로만, 끝 상태만 말하지 않음 |
| RULE-0197 | author · develop | vocab·model·core·judicial·legislative 규칙은 사용자 요청 시만 |
| RULE-0199 | common · develop | 엔진·공유 기계를 바꿨으면 전체 시험 |
| RULE-0201 | common · develop | 새 규칙엔 거부 시험 |
| RULE-0202 | author · develop | 거부 패치는 tests/fixtures/rejections/ + EXPECT.json |
| RULE-0203 | author · develop | 바닥값 tests/fixtures/FLOOR.json — 내려가면 실패 |
| RULE-0205 | author · develop · inspect | 새 규칙 → 말뭉치·바닥값 올림, 의도적 완화는 바닥값 내리는 별도 커밋 |
| RULE-0212 | common · develop | 오류는 판결·보고서로만 내고, 고치는 것은 에이전트가 새 패치로 (읽기 전용 되먹임) |
| RULE-0220 | author · develop | 새 가정 기록은 unrecorded 일 수 없다 — 열린 한계를 달고 assumed 로 |
| RULE-0221 | baseline · develop | 탐색 실행(미등록)은 인라인 숫자를 허용하되 첫 장면 기원 감사가 unrecorded 로 센다 |
| RULE-0228 | develop · inspect | 판정은 하나 — 용도별 판정 함수는 reliability.accept 하나, 관문·observe·fate·증거 보고서가 모두 부름 (74·75·76) |
| RULE-0289 | author · inspect | 후보마다 값·단위·종·세포·시각·불확도·출처+인용·use·규약 가능 |
| RULE-0291 | author · inspect | 값을 적으면 source + quote 필수 |

## 규칙 여러 개를 한 문장에 묶은 사본 57 (나누면 6 단계 모드 문서가 정확해짐)

U0315 (docs/design/agent-rules.md:62) → 규칙 9 · U0355 (docs/design/agent-rules.md:70) → 규칙 9 · U0279 (docs/design/agent-rules.md:24) → 규칙 7 · U0347 (docs/design/agent-rules.md:68) → 규칙 7 · U0272 (docs/design/agent-rules.md:21) → 규칙 6 · U0350 (docs/design/agent-rules.md:68) → 규칙 6 · U0369 (docs/design/agent-rules.md:78) → 규칙 6 · U0270 (docs/design/agent-rules.md:20) → 규칙 5 · U0335 (docs/design/agent-rules.md:65) → 규칙 5 · U0363 (docs/design/agent-rules.md:74) → 규칙 5 · U0381 (docs/design/agent-rules.md:83) → 규칙 5 · U0251 (docs/design/agent-rules.md:13) → 규칙 4 · U0340 (docs/design/agent-rules.md:66) → 규칙 4 · U0366 (docs/design/agent-rules.md:77) → 규칙 4 · U0372 (docs/design/agent-rules.md:79) → 규칙 4 · U0385 (docs/design/agent-rules.md:85) → 규칙 4 · U0393 (docs/design/agent-rules.md:87) → 규칙 4 · U0414 (docs/design/agent-rules.md:110) → 규칙 4 · U0254 (docs/design/agent-rules.md:14) → 규칙 3 · U0423 (docs/design/agent-rules.md:116) → 규칙 3 · U0419 (docs/design/agent-rules.md:115) → 규칙 3 · U0560 (docs/RUNBOOK.md:239) → 규칙 3 · U0274 (docs/design/agent-rules.md:22) → 규칙 3 · U0324 (docs/design/agent-rules.md:63) → 규칙 3 · U0329 (docs/design/agent-rules.md:64) → 규칙 3 · U0344 (docs/design/agent-rules.md:67) → 규칙 3 · U0361 (docs/design/agent-rules.md:72) → 규칙 3 · U0365 (docs/design/agent-rules.md:76) → 규칙 3 · U0377 (docs/design/agent-rules.md:81) → 규칙 3 · U0396 (docs/design/agent-rules.md:88) → 규칙 3 · …

## 장부에 없는 판단 규칙 단위 (0 이어야 함)

없음

## 형식 오류

없음
