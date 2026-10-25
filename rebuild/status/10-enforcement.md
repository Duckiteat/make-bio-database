# 집행 변이 시험

> 생성물 — `node rebuild/status.mjs --write`(응답이 끝날 때 훅이 돌림). 손으로 고치지 않는다. 읽기 점검용이며 다른 코드가 읽지 않는다.

원본: `rebuild/rules/enforcement.jsonl` (0 행) · 다시 돌리기: `node tests/mutation/run.mjs --spec rebuild/rules/enforcement.jsonl --check --jobs 3`. "기계가 막는다(machine)" 는 규칙의 집행 자리를 저장소 밖 사본에서 일부러 망가뜨리고, 시험이 하나라도 빨개지면 잡음, 모두 통과하면 놓침이다. 놓침은 `rebuild/rules/review.jsonl` 의 `enforcement_gap` 으로 사용자 확인을 기다린다.

| 결과 | 규칙 |
|---|---|
| 아직 시험 안 함 (machine) | 253 |

## 형식 오류

없음

## 아직 시험 안 함 — 253

| 규칙 | 집행 자리 |
|---|---|
| RULE-0004 | judicial/judicial.js validate (참조 해석·없는 번호 거부) |
| RULE-0005 | tests/governance.test.mjs ② |
| RULE-0006 | tests/governance.test.mjs ① |
| RULE-0007 | tests/governance.test.mjs ② |
| RULE-0008 | tests/governance.test.mjs ② |
| RULE-0010 | judicial/judicial.js moietyImbalance · judicial/verifier.js ③ |
| RULE-0011 | tests/governance.test.mjs ⑥ |
| RULE-0012 | tests/governance.test.mjs ① |
| RULE-0013 | tests/governance.test.mjs ① · ④′ |
| RULE-0014 | tests/governance.test.mjs ④′ |
| RULE-0015 | tests/governance.test.mjs ④ |
| RULE-0016 | tests/governance.test.mjs ④ · legislative/clerk.mjs appendAttestations |
| RULE-0017 | tests/governance.test.mjs ① |
| RULE-0018 | tests/mcp.test.mjs (단일 작성자) |
| RULE-0019 | mcp/protocol.mjs · tests/mcp.test.mjs (역할 거부) |
| RULE-0020 | tests/governance.test.mjs ① |
| RULE-0023 | tests/mcp.test.mjs ⑩ ⑪ · legislative/clerk.mjs postToInbox |
| RULE-0025 | tests/governance.test.mjs ③ |
| RULE-0026 | tests/governance.test.mjs ②′ |
| RULE-0027 | tests/governance.test.mjs ④ · judicial/judicial.js checkAttestations |
| RULE-0028 | tests/governance.test.mjs ③ (사법부는 엔진을 실행하지 않음 — 원자료는 조정자가) |
| RULE-0029 | tests/governance.test.mjs ⑦ · judicial/contract.js |
| RULE-0031 | tests/governance.test.mjs ⑧ |
| RULE-0032 | tests/governance.test.mjs ⑧ |
| RULE-0033 | tests/governance.test.mjs ⑧ |
| RULE-0034 | tests/perturb.test.mjs · judicial/perturb_audit.js |
| RULE-0035 | judicial/perturb_audit.js |
| RULE-0037 | tests/governance.test.mjs ⑧ (도함수 대조) |
| RULE-0038 | tests/governance.test.mjs ⑨ |
| RULE-0044 | tests/governance.test.mjs ⑮ |
| RULE-0046 | tests/governance.test.mjs ⑮ |
| RULE-0049 | tests/rust_engine.test.mjs ① (소스 해시) |
| RULE-0050 | tests/rust_engine.test.mjs |
| RULE-0051 | tests/rust_engine.test.mjs (JS=Rust 동등) |
| RULE-0052 | orchestrator.js refScenario |
| RULE-0053 | tests/mhc.test.mjs MHC ⑤ (사건 시각이 관찰 격자 Δ 에 묶이지 않음) |
| RULE-0054 | tests/rust_engine.test.mjs ⑦ |
| RULE-0055 | tests/stochastic.test.mjs · tests/rust_engine.test.mjs |
| RULE-0056 | .claude/settings.json deny Edit/Write(data/db.json) · legislative/clerk.mjs (봉인) |
| RULE-0059 | judicial/judicial.js patchPolicy · rejections 5a |
| RULE-0060 | legislative/legislative.js merge (없는 번호 거부) |
| RULE-0061 | judicial/judicial.js validate (meta.next > 쓰인 번호) |
| RULE-0063 | judicial/judicial.js validateSense (ChEBI 규약) |
| RULE-0064 | judicial/identity.js |
| RULE-0066 | legislative/augment_draft.js (--sync 없으면 유지) |
| RULE-0068 | judicial/judicial.js validateSense (잔기 번호 필수) · limitations --detect |
| RULE-0069 | judicial/judicial.js validateStep |
| RULE-0071 | judicial/judicial.js validateStep (공간 접촉) |
| RULE-0072 | judicial/judicial.js validateSense (종 의존 속성 context.species 필수) |
| RULE-0073 | judicial/judicial.js validateSense (reference_species) |
| RULE-0074 | judicial/judicial.js validateSense (span ⊂ text) |
| RULE-0078 | judicial/judicial.js patchPolicy · CI limitations --detect |
| RULE-0079 | judicial/judicial.js validateSense (motif) |
| RULE-0083 | judicial/judicial.js kineticIssues |
| RULE-0084 | judicial/judicial.js checkKineticsFrom · rejections 2a·2a2·2a3 |
| RULE-0085 | judicial/assumption_audit.js · judicial/reliability.js constantVerdict |
| RULE-0086 | judicial/assumption_audit.js checkProposals · legislative/clerk.mjs |
| RULE-0087 | judicial/assumption_audit.js · compiler/assumptions.js resolve |
| RULE-0088 | judicial/protocol.js · tests/assumptions.test.mjs |
| RULE-0089 | judicial/judicial.js 종 대조 · rejections 4b·4d·4e |
| RULE-0092 | judicial/reliability.js (저장 없음) |
| RULE-0093 | judicial/reliability.js THRESHOLD · tests/reliability_criteria.test.mjs |
| RULE-0094 | judicial/process_report.js 무결성 증명서 상수 등급 줄 |
| RULE-0096 | judicial/trend.js windowDays · tests/reliability_criteria.test.mjs |
| RULE-0097 | judicial/reliability.js (legacy) · judicial/trend.js |
| RULE-0098 | judicial/reliability.js accept |
| RULE-0099 | judicial/acceptance.js checkIssue · tests/acceptance.test.mjs |
| RULE-0100 | judicial/evidence_report.js · obs_compare · qual_compare · process_report |
| RULE-0101 | judicial/reliability.js gateMessage |
| RULE-0102 | legislative/clerk.mjs appendAttestations · judicial/acceptance.js table |
| RULE-0103 | judicial/reliability.js constantVerdict · judicial/judicial.js auditRate |
| RULE-0104 | judicial/reliability.js constantVerdict |
| RULE-0105 | judicial/reliability.js gateMinError · tests/reliability_criteria.test.mjs ⑫ |
| RULE-0106 | judicial/reliability.js meets · tests/reliability_criteria.test.mjs ⑪ |
| RULE-0107 | judicial/judicial.js validateObservation · schemas/obs/observation.schema.json |
| RULE-0109 | judicial/reliability.js scoreObservation |
| RULE-0110 | judicial/judicial.js observationImmutability · rejections 3b |
| RULE-0111 | judicial/judicial.js checkKineticsFrom · judicial/protocol.js |
| RULE-0112 | judicial/judicial.js validateObservation (hypothetical 거부) |
| RULE-0113 | judicial/contract.js checkObservation |
| RULE-0114 | judicial/judicial.js validateQualitative |
| RULE-0115 | judicial/judicial.js validateQualitative |
| RULE-0116 | judicial/judicial.js validateQualitative · checkKineticsFrom |
| RULE-0119 | judicial/qual_compare.js (chance) |
| RULE-0120 | judicial/protocol.js · judicial/evidence_report.js (판정 수준) |
| RULE-0121 | judicial/judicial.js checkContextKeys |
| RULE-0123 | judicial/judicial.js validateMoved |
| RULE-0124 | judicial/judicial.js valueImmutability |
| RULE-0125 | legislative/legislative.js merge · rejections 6a |
| RULE-0126 | judicial/judicial.js validateValues · rejections 6b |
| RULE-0127 | judicial/judicial.js checkSenseObsFrom · rejections 2b |
| RULE-0128 | judicial/judicial.js obsUnit · rejections 4a |
| RULE-0129 | judicial/judicial.js checkBound · rejections 4c |
| RULE-0130 | judicial/judicial.js (파생값 삭제 거부) · rejections 3 |
| RULE-0133 | judicial/judicial.js validateSupply · validateDegradation |
| RULE-0138 | judicial/judicial.js validateSense (tier) |
| RULE-0139 | judicial/judicial.js validateObservation (location 필수) |
| RULE-0140 | judicial/judicial.js kineticIssues (미시적 가역성) |
| RULE-0141 | judicial/judicial.js thermoLoops |
| RULE-0153 | judicial/judicial.js detectGaps (힐 상수 없는 조절) |
| RULE-0154 | judicial/reliability.js constantVerdict |
| RULE-0155 | judicial/process_report.js |
| RULE-0156 | tests/fate_suite.js · CI |
| RULE-0162 | judicial/compare.js |
| RULE-0165 | judicial/judicial.js refineCheck · patchPolicy · rejections 5c |
| RULE-0168 | compiler/ir_builder.js (step_law_unsupported) · tests/mhc.test.mjs |
| RULE-0169 | compiler/ir_builder.js |
| RULE-0171 | tests/mhc.test.mjs |
| RULE-0172 | judicial/fate_audit.js (선언·실행 일관성) |
| RULE-0173 | judicial/process_report.js |
| RULE-0174 | compiler/perturb.js derive (다른 필드 거부) |
| RULE-0175 | judicial/stoch_audit.js (seed 재현) |
| RULE-0177 | tests/stochastic.test.mjs |
| RULE-0178 | tests/stochastic.test.mjs |
| RULE-0179 | judicial/protocol.js · judicial/evidence_report.js (판정 수준) |
| RULE-0180 | judicial/protocol.js |
| RULE-0181 | judicial/protocol.js · data/preregistrations.jsonl scenario_sha256 |
| RULE-0182 | judicial/evidence_report.js |
| RULE-0185 | 시나리오 입력 해시 · 사전 등록 |
| RULE-0186 | judicial/judicial.js moietyImbalance |
| RULE-0189 | judicial/judicial.js patchReport |
| RULE-0190 | judicial/judicial.js patchPolicy · rejections 5a·5b·5c |
| RULE-0198 | tests/rejections.test.mjs (거부 말뭉치) · FLOOR |
| RULE-0200 | CI validate |
| RULE-0202 | tests/rejections.test.mjs ① |
| RULE-0203 | tests/rejections.test.mjs ② |
| RULE-0204 | tests/rejections.test.mjs ③ |
| RULE-0206 | judicial/judicial.js validate (version 일치) |
| RULE-0207 | CI cmp index.html viewer.html |
| RULE-0209 | CI textbook --check |
| RULE-0210 | dbtool textbook --check · CI |
| RULE-0211 | tests/governance.test.mjs ④′ |
| RULE-0212 | tests/governance.test.mjs ③ |
| RULE-0213 | judicial/contract.js · tests/governance.test.mjs ⑦ |
| RULE-0216 | judicial/identity.js |
| RULE-0217 | judicial/judicial.js validateSense (span) |
| RULE-0218 | legislative/legislative.js merge |
| RULE-0219 | compiler/assumptions.js resolve · judicial/assumption_audit.js |
| RULE-0220 | judicial/assumption_audit.js checkRecord |
| RULE-0221 | judicial/scene_origin.js |
| RULE-0223 | legislative/clerk.mjs (consensus 경로) |
| RULE-0224 | judicial/trend.js windowDays |
| RULE-0225 | judicial/acceptance.js verifyAcceptStamp |
| RULE-0226 | judicial/acceptance.js table |
| RULE-0227 | judicial/reliability.js USES |
| RULE-0229 | judicial/reliability.js THRESHOLD |
| RULE-0230 | judicial/process_report.js |
| RULE-0231 | judicial/reliability.js scoreObservation · judicial/obs_compare.js |
| RULE-0233 | judicial/judicial.js checkContextKeys |
| RULE-0234 | judicial/qual_compare.js |
| RULE-0235 | judicial/qual_compare.js |
| RULE-0236 | judicial/qual_compare.js |
| RULE-0238 | engine/fate_engine.js (결정 탐침) · judicial/process_report.js |
| RULE-0240 | judicial/fate_audit.js |
| RULE-0241 | judicial/stoch_audit.js |
| RULE-0243 | judicial/perturb_audit.js |
| RULE-0244 | judicial/protocol.js |
| RULE-0245 | judicial/process_report.js · judicial/verifier.js |
| RULE-0246 | judicial/judicial.js detectGaps |
| RULE-0247 | legislative/clerk.mjs postToInbox · tests/mcp.test.mjs ⑪ |
| RULE-0250 | mcp/protocol.mjs · tests/mcp.test.mjs |
| RULE-0251 | mcp/clerk.mjs |
| RULE-0253 | .claude/settings.json |
| RULE-0274 | workspace/collector.settings.json |
| RULE-0275 | workspace/collector.settings.json |
| RULE-0284 | tests/rejections.test.mjs |
| RULE-0286 | workspace/collector.settings.json · legislative/clerk.mjs handoff |
| RULE-0287 | workspace/collector.settings.json |
| RULE-0289 | judicial/collection_audit.js |
| RULE-0290 | judicial/collection_audit.js |
| RULE-0291 | judicial/collection_audit.js |
| RULE-0292 | judicial/collection_audit.js |
| RULE-0293 | workspace/collector.settings.json |
| RULE-0295 | workspace/collector.settings.json |
| RULE-0296 | workspace/collector.settings.json |
| RULE-0297 | workspace/collector.settings.json |
| RULE-0300 | .claude/settings.json |
| RULE-0319 | judicial/judicial.js validateSense (부위 키는 영문 소문자·숫자·_ ［예: reg_phos］) |
| RULE-0323 | judicial/judicial.js validate (이름에 # @ · / 금지) |
| RULE-0324 | legislative/legislative.js merge (이미 뜻이 있는 개념 — distinction 없으면 거부) |
| RULE-0325 | legislative/legislative.js merge (정의항을 다른 개념으로 옮길 수 없음) |
| RULE-0327 | legislative/legislative.js merge (이름 '…' 이 여러 개념과 겹침) |
| RULE-0331 | judicial/judicial.js validateSense (구성 요소［components］는 kind complex 만 가질 수 있음 ［현재 …］) |
| RULE-0332 | judicial/judicial.js validateSense (구성 요소［components］는 kind complex 만 가질 수 있음 ［현재 …］) |
| RULE-0333 | judicial/judicial.js validateStep (소속 경로 '…' 없음) |
| RULE-0337 | judicial/judicial.js validateSense (잔기 '…' 형식 틀림 ［예: Ser14］) |
| RULE-0339 | judicial/judicial.js validateSense (… 분자는 붙어 있는 막 면［membrane.side］이 필요함) |
| RULE-0340 | judicial/judicial.js validateSense (수용성 분자에는 membrane.location/side 를 두지 않음) |
| RULE-0341 | judicial/judicial.js checkBundle (수용성 분자는 막 2D 위치에 있을 수 없음) |
| RULE-0342 | judicial/judicial.js validateSense (부위 '…' 는 특징 '…' 를 가질 수 없음) |
| RULE-0343 | judicial/judicial.js validateSense (부위가 있는 구성 요소 '…' 는 이 복합체의 구성 요소가 아님) |
| RULE-0344 | judicial/judicial.js checkEvidence (근거 수준 curated 는 출처［source: DOI 또는 PMID］가 필요함) |
| RULE-0345 | judicial/judicial.js checkEvidence (… 은［는］ 무엇에서 추론했는지［basis］를 적어야 함) |
| RULE-0346 | judicial/judicial.js checkEvidence (근거 수준 computed 는 도구［tool］가 필요함) |
| RULE-0348 | judicial/judicial.js validateSense (조건의 부위 '…' 가 이 정의항에 없음) |
| RULE-0349 | judicial/judicial.js validateSense (행위 구성 요소 '…' 는 구성 요소가 아님) |
| RULE-0350 | judicial/judicial.js validateSense (한 부위에는 특징이 하나) |
| RULE-0351 | judicial/judicial.js validateSense (convert 효과는 consumes 와 produces 가 필요함) |
| RULE-0352 | judicial/judicial.js validateSense (구성 요소 '…' 에 'bound' 를 받는 부위 '…' 가 없음) |
| RULE-0353 | judicial/judicial.js validateStep (수송이 아닌 단계에서 위치가 바뀜) |
| RULE-0354 | judicial/judicial.js validateSense (transfer 효과는 넘기는 리간드［partner］가 필요함) |
| RULE-0355 | judicial/judicial.js validateSense (degrade 효과는 분해 산물［produces］이 필요함) |
| RULE-0356 | judicial/judicial.js validateSense ('…' 은［는］ 특징 '…' 를 추가해야 함) |
| RULE-0357 | judicial/judicial.js validateSense (보조 기질 '…' 없음) |
| RULE-0358 | judicial/judicial.js checkBundle (묶음 키 '…' 는 정렬된 표준 형식이 아님 ［…］) |
| RULE-0360 | judicial/judicial.js validateStep (규칙 '…' 없음) |
| RULE-0361 | judicial/judicial.js validateStep (규칙 '…' 의 행위자 '…' 묶음이 agents 에 없음) |
| RULE-0362 | judicial/judicial.js validateStep (분해된 구성 요소 '…' 가 출력에 남아 있음) |
| RULE-0363 | judicial/judicial.js validateStep (수송이 아닌 단계에서 위치가 바뀜) |
| RULE-0364 | judicial/judicial.js validateStep (공간 접촉 불가: … ↔ …) |
| RULE-0365 | judicial/judicial.js validateStep (보조 기질 '…' 가 입력에 없음) |
| RULE-0366 | judicial/judicial.js validateStep (동일성 보존 위반: ${diff.map［［k］ =>) |
| RULE-0369 | judicial/judicial.js validateLimitation (해결 경로［requirement.needs］ 없음) |
| RULE-0370 | judicial/judicial.js validateLimitation (해결 경로［requirement.needs］ 없음) |
| RULE-0371 | judicial/judicial.js validateLimitation (해결 경로 종류 '…') |
| RULE-0372 | judicial/judicial.js validateLimitation (증상 키 '…') |
| RULE-0374 | judicial/judicial.js simulateText (⚠ 농도 공백: 시작량 …개가 기본값, …개가 무한 풀) |
| RULE-0377 | judicial/judicial.js validateSense (해상도 일관성: 부위의 구조 … 가 정의항의 PDB 외부 ID 에 없음) |
| RULE-0378 | judicial/judicial.js kineticIssues (binding 법칙은 두 분자 결합［k_on 단위 M⁻¹s⁻¹］) |
| RULE-0379 | judicial/judicial.js kineticIssues (Kd 와 k_off/k_on 이 맞지 않음 ［Kd … M, k_off/k_on … M］) |
| RULE-0382 | judicial/judicial.js validateSense (규칙은 분자 종류 정의항만 가질 수 있음 ［경로·과정·원리는 공급 규칙 supply 만) |
| RULE-0383 | judicial/judicial.js validateSupply (공급 규칙은 위치［where］가 정확히 하나 ［저장소 묶음 = 정의항\|위치］) |
| RULE-0384 | judicial/judicial.js validateSupply (공급 규칙의 속도 법칙은 zero_order 또는 mass_action) |
| RULE-0385 | judicial/judicial.js validateDegradation (분해 산물의 운명［fate］ '…') |
| RULE-0386 | judicial/judicial.js validateDegradation (재활용 단위 '…' 의 화학량 n 은 양수 또는 'sequence_length') |
| RULE-0387 | judicial/judicial.js kineticIssues (k_deg … s⁻¹ 와 반감기 … s 가 맞지 않음 ［ln2/t½ = …］) |
| RULE-0389 | judicial/judicial.js validateSense (부분 구조［moieties］는 분자 종류만 가질 수 있음) |
| RULE-0396 | judicial/judicial.js validateCellState (세포 상태는 분자가 아님) |
| RULE-0397 | judicial/judicial.js validateCellState (대사 프로그램은 공급 규칙［supply］만) |
| RULE-0398 | judicial/judicial.js validateCellState (결정 기준 '…') |
| RULE-0399 | judicial/judicial.js validateModulation (활성화 조절은 fmax > 1 ［최대 배율］이 필요함) |
| RULE-0400 | judicial/judicial.js validateSupply (모든 소비가 saturating 이면 속도 법칙의 기질이 없음) |
| RULE-0402 | judicial/judicial.js validateObservation (ratio 측정에는 분모 묶음［observable.denominator］이 필요함) |
| RULE-0403 | judicial/judicial.js validateObservation (보정 … 에는 읽은 값［raw］이 필요함) |
| RULE-0404 | judicial/judicial.js validateObservation (관찰 근거는 curated［문헌］ \| computed［포트 변환 도구］) |
| RULE-0405 | judicial/judicial.js checkKineticsFrom (용도가 … 인 관찰은 상수 추정에 쓸 수 없음) |
| RULE-0406 | judicial/judicial.js checkKineticsFrom (문헌［curated］ 속도 상수 … 에 관찰 기록［kinetics.from］이 없음) |
| RULE-0414 | judicial/judicial.js validate (］, `외부 ID ${k.slice［k.indexOf［) |
| RULE-0417 | judicial/judicial.js validateSense (구성 요소 개수 틀림) |
| RULE-0418 | judicial/judicial.js checkAttestations |
| RULE-0421 | legislative/legislative.js merge (이전 형식 패치) |
| RULE-0422 | legislative/clerk.mjs commitMerge (관문 판결이 거부 ［오류 …, 경고 …］) |
| RULE-0436 | judicial/judicial.js validateSense (중성 모체만 적혀 있음 — 경고) |
| RULE-0440 | judicial/judicial.js validateSense (］ E［where, `막 이동 경로의) |
| RULE-0441 | judicial/judicial.js validateSupply (공급 규칙은 생성물［produces］이 필요함) |
| RULE-0442 | judicial/judicial.js validateModulation (활성화 조절은 fmax > 1 ［최대 배율］이 필요함) |
| RULE-0446 | judicial/judicial.js validateValues (분포에 값［mean 또는 level］이 없음) |
| RULE-0447 | judicial/judicial.js validateValues (기록 시각［recorded_at］이 없음) |
| RULE-0448 | legislative/legislative.js merge (관찰 기록은 바꿀 수 없음) |
| RULE-0451 | judicial/assumption_audit.js checkRecord (기원 '…') |
| RULE-0452 | judicial/assumption_audit.js checkRecord |
| RULE-0482 | judicial/collection_audit.js REVIEW_REQUIRED |
| RULE-0489 | judicial/judicial.js validateValues (대상 정의항·규칙이 없으면 거부) |
