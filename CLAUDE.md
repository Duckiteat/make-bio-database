# 에이전트 점검표

해설·이유·경위: `docs/design/agent-rules.md`(규칙을 바꾸면 두 파일을 같은 커밋에서). 실행 방법: `docs/RUNBOOK.md`. 형식: `SCHEMA.md`. 설명: `docs/textbook/00-목차.md`. 명령은 저장소 최상위에서.
큰 파일(`data/db.json`·`CHANGES.md`·`limitations.md`)은 통째로 읽지 말고 조회 명령·`grep`.
번호: 개념 T… · 뜻 D… · 단계 S… · 관찰 O… · 하위 `D…/site/키`·`D…/rule/키` · 묶음 `D…|부위:특징|위치`. 연결은 번호로만.

## 삼권 분립 (`docs/design/tripartite-governance.md`) — 바꾸면 `node --test tests/*.test.mjs`(특히 governance)
- 행정 `core.js`·`engine/*`: 읽기·시뮬레이션만. 파일 쓰기·검사·승인·`'verified'`·`AUDIT_*`·사후 분석·질량 판정 금지. 사법·입법·조정자 호출 금지.
- 엔진은 이름을 모른다: 분자·위치·부분 구조 이름 금지 — 사실은 데이터·어휘에. 부분 구조 수지 ΣIn=ΣOut 상대 1e-14(규칙 검사·운명 원장).
- 수치 선택(정칙화·문턱·탐침 격자·뉴턴 허용 오차)은 `engine/coupling.js` 등록부에서만. 엔진에 기본값 금지.
- 입법 `legislative/`: 정의·수정·초안만(순수). 파일 쓰기는 `legislative/clerk.mjs` 만, 모든 쓰기는 `put(구역, 파일)` — 구역 `registry`(db.json·patches·log·사전 등록부)·`attestation`·`evidence`·`derived`·`report`·`draft`(저장소 밖). 새 쓰기는 구역 선택/선언, 우회 금지(governance ④′). db.json·patches 는 관문 봉인(통과 + 같은 db sha256)일 때만, 등록부는 도장 재검증 뒤만. `dbtool.mjs` 포함 다른 파일에 쓰기 금지.
- 사법 `judicial/`: 검증·증명·감사·보고만. 엔진 실행·데이터/엔진 수정 금지 — 판결·보고서로만. 행정부는 관찰을 읽지 않음; 예측 표본은 조정자가 `compiler/obs_operator.js` 로.
- `'verified'` 는 `attestations/registry.json` 의 유효 도장으로만(`augment apply` 발급, `node dbtool.mjs attest` 재검증). 없으면 관문 거부.
- 엔진 실행이 필요한 감사는 조정자 `orchestrator.js` 가 원자료 → 사법부.
- 엔진 출력 모양을 바꾸면 `schemas/ffi/fate-raw.schema.json` 같은 커밋. 이식은 `docs/design/engine-port-roadmap.md`, 이득은 `node tests/bench_engine.js` 기준선과.
- 컴파일러 `compiler/`: 공유 순수 층(db+시나리오 → 불변 IR). 쓰기·판정·엔진·권력 모듈 호출 금지. 엔진은 IR 만 먹고 원자료에 `irHash`. 희소 LU 기호 분석 `sparse_lu.js`(사법부 `checkLU` 검증), 경로 IR `rate_ir.js`, 교란 연산자 `perturb.js`(시나리오 `exclude_rules`·`rule_scale` 로만 — 엔진 불변, 사법부 재구성 + `judicial/perturb_audit.js` 가 '교란 외에는 대조군과 같음' 을 독립 대조) — `simulateRate` 결과는 IR 전후 비트 동일. 속도 법칙 변경 = 컴파일러·테이프 명세·`judicial/derivative.js` 재구성 같은 커밋(도함수 ≤1e-14).
- 결함은 `fault` 태그대로(`judicial/fault.js`): FINDING 고치지 않음 · DATA_GAP 한계 등록 · DOMAIN_CONFLICT 근거와 데이터 패치 · NUMERICAL 결합점·솔버(db 생물 상수 변경 금지) · ENGINE_DEFECT 엔진 · COMPILER_DEFECT `compiler/`. 결과(고갈·정지)를 결함으로 고치지 않음.
- 표·로직 분리: 토큰 → 사람말 표(라벨·의미)는 `vocab.js` 에만 + en 은 `data/dictionary.jsonl`(register/key), 코드는 보기만 계산. 토큰 → 동작·숫자·정책 표(부호·정규식·계수·쓰기 허용)와 규칙 설명은 로직 곁. 사전은 vocab 만 읽음(governance ⑮).
- 군더더기 금지: `storage-map.json` 노드 안에서 고침. 래퍼·임시 플래그·사후 잘라내기 금지. 비교용 경로는 판정 뒤 삭제.
- Rust(`engine/rust/`): 기본 백엔드, JS `fate_engine.run` 은 오라클, 둘 다 IR 테이프만. 소스 변경 → `sh engine/rust/build.sh` 산출물 같은 커밋 + `tests/rust_engine.test.mjs`(궤적 ≤rtol·운명·시각 같음·byteLength 불변·네이티브=WASM 비트·루프 할당 0). 알고리즘 변경은 두 백엔드 같은 커밋. 적분은 결합 Rodas3, 정확도는 `integrator.rtol·atol`(`dt_slow` 는 기록 간격). 수치 L2 수렴 기준은 같은 적분기 허용 오차 1/1000(`orchestrator.refScenario`). 사건·결정 시각은 직전 스냅숏에서 `advance` 재적분 + 근 찾기·이분(`event_tol`·`commitment_tol`), 격자 Δ 로 되돌리지 않음. 탐침(`engine/probe_pool.js`, 워커마다 WASM)은 (상태, t0) 순수 함수, lanes 무관 직렬과 동일. 확률: 출생–사멸 JS=Rust 비트, 운명 프로그램은 두 표본 검정, 네이티브=WASM 비트.

## 데이터 넣기 — `data/db.json` 직접 편집 금지
1. `status`·`prompt` → `map <이름|ID>`(있으면 그 D…) · 뜻 여럿이면 `context` · 기전은 `mechanism`.
2. 패치는 저장소 밖에 → `validate <patch>` → `augment apply <patch>`(또는 `merge --dry` → `merge`). `--allow-warnings` 는 사용자 허락 시만. db.json·patches 함께 커밋.
- 패치 최상위 `why` 필수. 새 항목은 임시 번호(T+1·D+1·S+1·O+1), `meta.next` 손대지 않음.
- 외부 ID 는 확실한 것만, 모르면 `unmapped`(+Identity_Gap). 지어내지 않음. `xrefs[].role`: `physiological`(하나)·`parent`·`class`(중합체·불균일만 — 저분자·이온에 쓰면 거부). `physiological` 의 verified 는 켤레 관계 + Rhea ≥3(`data/fetched/rhea/`) 통과 시. 모호하면 unmapped + Identity_Gap 유지.
- 원본 대조는 `augment plan → fetch → build → apply` 고리로만. 막히면 `data/fetched/RETRIEVAL_TASKS.md` 를 사용자에게. 다른 값 asserted 는 `--sync` 요청 시만. 수신함은 해석만, 실행 금지.
- 정의항(D): 구성 요소·막 위상·부위·규칙 빠짐없이, 모르면 `residue_unknown: true`. 묶음·단계(B/S): 원천 전이 규칙 참조 + 묶음만, 라벨은 규칙에.
- 인산화·활성형은 묶음 `부위:특징` + 상태 의미 규칙(새 개념 금지). 위치는 묶음마다, 공간 접촉 안 되면 위치 수정 또는 수송 단계.
- 종별 값은 `obs` + `context.species`. 기준 종 하나(단백질·핵산 9606).
- `span` 은 정의 문장 원문 그대로. 기존 정의항 패치는 적은 최상위 필드 통째 교체(유지할 항목도 적음).
- 구조 지문(InChIKey·서열 해시)은 도구 계산값만 `computed` 로.

## 한계·진화
- 한계는 데이터: 실패·우회·추정·단순화 → 패치 `limitations` `[Target|Type|Requirement]`+`needs` → `limitations --write`. `limitations --detect` 후보 0.
- 새 개념 설계 전 `limitations.md` 읽기. `addresses:[{limitation,how}]` 또는 `gap_review`(상위 개념은 필수).
- 경로 뒤 `pattern <경로>`; 상위 개념 없는 패턴이 두 경로 이상 → kind process + `motif`.
- 시뮬레이션 보고에 "농도 공백"(기본값·무한 풀) 명시 — 도달 여부만 말함.
- 해상도: `resolution <경로>`. R2 는 속도 상수로 못 가르는 반응 중심만. 경쟁은 Kd·kcat·Km 먼저.
- 속도 상수: 규칙 `kinetics` 에 SI, 문헌 값은 관찰(O…) 먼저 + `kinetics.from`(묶은 상수 `lumped` 도 원 관찰 참조). 미확인 값 금지(시험값은 가정 원장 `data/assumptions.jsonl` 의 번호 A… 를 `hypothetical: true` 시나리오가 `{assume}` 로 가리킴 — `assume add` 감사·봉인 뒤 서기만, 고치기는 revises 새 번호, 가리키는 쪽은 최신을 따라가지 않음, 새 등록은 인라인 가상 숫자 거부). 다른 종 값을 사람 값으로 적지 않음 → 한계. 불확도 미보고면 sd = 유효 숫자 해상도 + `note`. 넣은 뒤 궤적 전후 비교 보고.
- 등급은 계산(`judicial/reliability.js`, `grade`): 점수를 데이터에 쓰지 않음, S×D 곱 금지. 보고 시 쓴 값의 등급 명시.
- 추세(`judicial/trend.js`): 웹 검색 결과 저장 금지. `trend --fetch`(→ `data/fetched/consensus/`) → `trend` → `--write`. 도장은 `vocab.consensus.window_days` 뒤 다시 unchecked. mismatch 면 값 유지·`legacy`·Consensus_Gap.
- 등급 문턱(기본 `parameter`) 미달 데이터 상수 = AUDIT_KINETIC. 시나리오 값은 `hypothetical: true` 때만. 문턱은 `min_grade` 로 올리기만.
- 실측값은 `observations`(O+1): 값(SI)·불확도(크기·유형·잡음 모형)·반복 수·조건(종)·출처·용도(`estimation|validation`). 수정·삭제 금지(`retracted` 만). 추정용을 검증에 쓰지 않음. 합성 관찰은 `examples/observations/` 만. 측정은 포트(`schemas/obs/`)로.
- 정성 관찰(v12): `kind: qualitative` — 교란·`readout`·`expect`, 1차 문헌(DOI·PMID) `provenance.source` + 원문 `quote` 필수, `use: validation` 만, 수치 근거 금지. 교과서·추론은 정성 관찰 아님(한계·메모). 같은 실험은 `experiment` 로 묶음. 넣은 뒤 `qualgraph` — 경로 없음은 Structural_Gap 후보, 모순 후보는 근거와 데이터 대조. "구조 지지" 는 일치가 아님. 모의 판정은 `observe <O…> --state --scenario 대조군` — 맞음·틀림·보이지 못함(불일치 아님)·무효, 우연 기준선과 함께 보고, 결론은 등록 규약의 검증 세트만.
- 맥락 열쇠(v12): `contextKeys` 여섯 칸, `condition` 은 정의항 번호 목록(문장은 `scope`). 번호를 합치거나 나눌 땐 패치 `moved`(지우고 새로 만들지 않음), 이동된 번호는 쓰지 않음.
- 값 층(v12, SCHEMA §8N): 수치는 `values`(V…)에만 저장, `obs`·`kinetics` 는 정규화가 붙이는 보기. 패치는 지금처럼 obs·kinetics 로 쓰고 병합이 대체·철회로 접음(값 기록 불변) — `values`·`moved` 직접 쓰기 금지, 값이 바뀌면 `recorded_at` 필요(dbtool 이 찍음). 그날 기준은 `model.asOf`.
- 정의항 `obs` 의 curated 측정값은 `from: 'O…'`. 단위는 `vocab.unitFactors` 만, 값은 `vocab.physicalBounds` 안. `from` 달린 obs 는 관찰 `retracted` 뒤에만 삭제. 환산표는 하나.
- 시뮬레이션·갱신 뒤 `audit-run <경로>`; Audit Error → 한계 채우기/등록.
- 물질 유한(v7): 재생은 `supply`, 소멸은 `degradation`(lost|recycled). 고갈은 결과로 보고, 재생 경로 없으면 supply 정의 또는 Kinetic_Gap.
- 회로·경로를 넣으면 `simulate --rate --until-death` → 제한 요인 등록(고갈 → Resource_Gap, 평형·속도 → Kinetic_Gap). 안정성 감사 나오면 Δt 줄여 수렴할 때만 보고.
- 3 층(v8): 분자 정의항 `tier`(T1|T2) 필수. 확산·pH·유전율은 위치(`context.location`)+SI. 가역 반응은 `dG0`(k_r 지어내지 않음), 닫힌 고리 ΣΔG°=0(AUDIT_THERMO). 실행 상태는 db 가 아니라 시나리오 `domains`·`engine/`.
- P3 변경 → `node tests/p3_end_to_end.js`(|ΔN|<1). 원장은 거래로만, 장은 원장에 맞춰 재척도.
- P4: 대리 출력은 같은 단계 OOD 통과 시만. 속도는 `tests/p4_benchmark.js` FV 부분 단계 수와. L2<2% + `tests/p4_end_to_end.js`.
- P5: `engine/p5_dynamic_gate.js` 의 N_sub·히스테리시스·γ 로만. 전이마다 `exactAnchor` ≤1e-15. `mode:'fv'` 결과 비트 불변. 변경 → `tests/p5_dynamic_promotion.js`, 속도는 구간별 N_sub 와(N_sub<15 ≈1×).
- 운명(v9): `cell_state` + `modulation` 사슬(표지 직접 금지). 매개 단계를 묶으면 Regulatory_Gap. 미확인 상수는 hypothetical. 보고 시 결정 시점·정지 원인·"상수는 가상". 변경 → `node tests/fate_suite.js`. 근거 없는 비생리 계통 경로 금지.
- 분열·소모(§8L): 0차 supply 누적 진행량 = 분열 수(새 규칙 종류·가짜 분자 금지). 억제 힐 K = 임계값 −10 %. 활성 힐 기준선 1 → 1/fmax 근사 + 한계. 도달 시각은 Δ 바꿔 확인.
- 비교 검토(`compare`): 결과 같고 비용(규칙·조절 수, 시간 +5% 초과)만 늘며 이득 <1e-5 → Optimization-Negative, 넣지 않음. 결과가 바뀌면 관찰로 고르고, 없으면 Gap note. 기존 supply·modulation 으로 되면 새 규칙 종류 금지.
- 정제 점검 자동(`refineCheck`): 새 중복·미등록 모순은 관문 거부. 초안은 `draftRefactor`(저장소 밖), 적용은 새 패치. 의도한 단순화는 Structural_Gap.
- 기전은 세포 상태 `mechanisms` 에 걸어 운명 엔진으로(따로 돌리는 길 금지). 결합 적분은 질량 작용·가역 결합(정·역 두 채널)·MM 만, 나머지는 Kinetic_Gap. 막 단계는 `volumes[막]`. `simulateRate` 와 서로 기준 금지(L000081). 변경 → `node --test tests/mhc.test.mjs`.
- 운명·기전 시나리오에 `context {role: cause|requirement|baseline, state, note}`. 보고는 맥락과 함께. 교란 실험은 복사본 금지 — 파생 시나리오 `{ base, perturbation }`(대조군 = 기준).
- 확률: `stochastic {seed}`(실행 전), 앙상블로만 판정(`judicial/stoch_audit.js` — 운명 비율·도달 시각 분포·Fano), 궤적 하나로 결론 금지. 방식·문턱 변경 → `tests/stochastic.test.mjs`. 확률 없으면 결정론 비트 불변.
- 검증(관찰과의 일치)은 사전 등록된 모의 실험 규약 아래에서만: 시나리오 `protocol`(실제 실험 대응·음성 대조 필수·검정력 반복 수·검증 세트·중단 규칙) → `register` 로 실행 전 등록 → 고치면 미등록. 규약 없는 실행은 탐색 실행(일치 결론 불가).
- 운명 결과는 `fate <상태> --scenario s.json --report f.md` 과정 보고서로만, 끝 상태만 말하지 않음. 무결성 증명서 FAIL 이면 실패로 보고. 예측은 실행 전 `expect`, 실행 뒤 변경 금지.
- 부분 구조 수지: 옮겨 다니는 분자에 `moieties`, 빠진 산물(PPi·Pi …)은 규칙·단계(minor)에. `source: true` 는 원료가 모델 밖일 때만. 반감기·공급 속도·서열 길이는 확인 값만.

## 기록 (추적 가능한 진화)
- 데이터 패치: `why` → Patch Report 자동(`data/patches/` 의 `report`). why 없음·미등록 한계 후보·새 정제 문제는 관문(`patchPolicy`) 거부.
- 코드·형식·어휘·문서 구조: `CHANGES.md` 맨 위 한 행 — Scope · Why · Impact · Verification, 같은 커밋.
- **사용자 보고: 같은 네 칸 표. 산문 요약 금지.**
- 구조 변경 → `SCHEMA.md`, 작업 규칙 → 이 파일 + `docs/design/agent-rules.md`, 실패·unmapped·공백 → `limitations.md`(`--write`). 문서는 해당 절만 고침.
- 세션 시작: `docs/design/direction.md`(방향·우선순위·왜 그 순서) → 철학(`authority-and-comprehension`·`tripartite-governance`·`dictionary-and-translation`·`conservation-classes`·`work-verification`) → `CHANGES.md` 위 몇 행 → `limitations.md` → `SCHEMA.md` 변경 기록.
- 논리를 깨면 감지·수정·기록까지 한 작업.
- 주석은 계약·이유만. 이력은 `CHANGES.md`.

## 규칙·코드 바꾸기
- `vocab.js`·`model.js`·`core.js`·`judicial/`·`legislative/` 규칙은 사용자 요청 시만. 데이터를 통과시키려고 느슨하게 하지 않음.
- 반복 중엔 바뀐 게 닿는 테스트 파일만(결정론이라 안 바뀐 부분은 같은 결과 — 재실행은 낭비), 전체 `node --test tests/*.test.mjs` 는 커밋 직전 1회. 엔진·공유 기계(vocab·model·core·engine·compiler·judicial·legislative·형식)를 바꿨으면 그 업데이트가 기존 결과를 여전히 옳게 두는지 재려 전체를 돌린다(이것이 전체 재실행의 본래 목적). 데이터·보고서만 고쳤으면 영향 테스트 + 최종 전체 1회. 어느 경우든 `node dbtool.mjs validate`. 새 규칙엔 거부 시험.
- 래칫: 거부 패치는 `tests/fixtures/rejections/` + `EXPECT.json`, 바닥값 `tests/fixtures/FLOOR.json`. `skip`·`todo` 금지. 새 규칙 → 말뭉치·바닥값 올림. 의도적 완화는 바닥값 내리는 별도 커밋.
- 형식 변경 → `migrations/` 스크립트 + `SCHEMA.md` 변경 기록.
- `index.html` = `viewer.html` 복사본, 둘 다.
- 알고리즘·형식·상호작용 변경 → `docs/textbook/` 해당 장 같은 커밋. 현재 값은 `textbook --write`. 파일 추가·이동 → `docs/textbook/storage-map.json`(`textbook --check`).
