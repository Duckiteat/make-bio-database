# 이 저장소에서 일하는 AI 에이전트를 위한 규칙

데이터는 사람이 아니라 AI가 넣는다. 저장소는 `data/db.json`, 병합 기록은 `data/patches/`.
모든 항목은 고정 번호(개념 T…, 뜻 D…, 단계 S…)로 식별되고 연결도 번호로만 건다. 정의항의 하위 항목은 `D…/site/키`·`D…/rule/키`, 묶음은 `D…|부위:특징|위치`.
규칙 전체는 `SCHEMA.md`, 구조·저장·알고리즘·상호작용의 설명은 교과서 `docs/textbook/00-목차.md`. 명령은 저장소 최상위에서 실행한다.

## 삼권 분립 (반드시 — 어기면 무결성 규약 위반, `docs/design/tripartite-governance.md`)

- **행정부(`core.js`·`engine/*`)는 읽기·시뮬레이션만.** 규칙과 초기 상태의 순수 함수로 원자료만 낸다 — 파일·db.json 쓰기, 검사·승인, `'verified'` 선언, 감사 코드(`AUDIT_*`)·사후 분석·질량 판정을 엔진에 넣지 않는다. 엔진이 사법·입법·조정자 모듈을 부르지 않는다.
- **입법부(`legislative/`)는 데이터 정의·수정만.** `merge`·패치 초안(보강·리팩터링)은 순수 함수, **파일 쓰기는 입법 서기 `legislative/clerk.mjs` 만** — db.json·patches 는 사법부 관문 봉인(통과 + 같은 db sha256)이 있을 때만, 증명 등록부는 도장 재검증 뒤에만. 다른 파일에 `writeFileSync` 같은 쓰기를 더하지 않는다(`dbtool.mjs` 포함).
- **사법부(`judicial/`)는 검증·증명만.** validate·관문·Patch Report·정제 점검·한계 상태·감사(`auditRate`)·독립 질량 검증(`verifier.js`)·운명 판정(`fate_audit.js`)·보고서·비교 판정·신원 확인·증명 도장. 엔진을 실행하지 않고(원자료를 입력으로 받음) 데이터·엔진을 고치지 않는다 — 오류는 판결·보고서로만 내고, 고치는 것은 에이전트가 새 패치로 한다(읽기 전용 되먹임).
- **`'verified'` 는 사법부 도장으로만.** `attestations/registry.json` 의 유효한 도장(digest·증거 sha256·같은 확인 재실행) 없이 status `verified` 를 패치에 쓰면 관문이 거부한다. 도장은 `augment apply` 가 판결과 함께 발급하고 서기가 기록한다. `node dbtool.mjs attest` 로 재검증.
- 엔진 실행이 필요한 감사(audit-run·해상도 계획·비교 검토·운명 보고서)는 조정자 `orchestrator.js` 가 행정부로 원자료를 만들고 사법부에 넘긴다. 엔진의 수치 선택(정칙화·관문 문턱·탐침 격자·뉴턴 허용 오차)은 `engine/coupling.js` 등록부에서만 읽는다 — 엔진에 기본값을 박지 않는다.
- **엔진 출력은 원자료 계약을 지킨다.** 운명 엔진(JS·Rust/WASM)의 출력 모양을 바꾸면 `schemas/ffi/fate-raw.schema.json` 을 같은 커밋에서 고친다 — 사법부(`judicial/contract.js`)는 계약을 어긴 원자료를 판정하지 않는다. 엔진 이식은 `docs/design/engine-port-roadmap.md` 의 단계·완료 조건을 따르고, 이득은 `node tests/bench_engine.js` 기준선과 함께 보고한다.
- **컴파일러(`compiler/`)는 공유 순수 층.** db + 시나리오 → 불변 IR(정수 번호·화학량·속도식·기호 도함수 테이프·희소 패턴·해시). 3단계: 희소 LU 기호 분석(`sparse_lu.js` — 최소 차수 순서·채움·값 위치, 사법부 `checkLU` 가 검증)과 경로 시뮬레이션 IR(`rate_ir.js` — `simulateRate` 루프는 그 정수 표 위에서, 결과는 이전과 비트 단위로 같아야 한다). 쓰기·판정·엔진·권력 모듈 호출 없음. 엔진은 IR 만 먹고 원자료에 `irHash` 를 적으며, 조정자는 같은 IR 을 사법부에 넘겨 `judicial/derivative.js` 가 법칙 충실도·자동미분 대비 도함수(≤ 1e-14)를 검증한다. 속도 법칙을 바꾸면 컴파일러·테이프 명세·사법부 법칙 재구성을 같은 커밋에서 맞춘다.
- **결함은 태그대로 고친다 (`judicial/fault.js`).** 모든 감사 항목에 `fault` 가 있다: `FINDING`(결과 — 고치지 않음) · `DATA_GAP`(한계 등록, 확인된 값만) · `DOMAIN_CONFLICT`(근거와 함께 데이터 패치) · `NUMERICAL`(결합점·솔버 — **db.json 의 생물 상수를 바꾸지 않는다**) · `ENGINE_DEFECT`(엔진 코드) · `COMPILER_DEFECT`(`compiler/`). 수치 문제를 데이터로 맞추거나 결과(고갈·정지)를 결함으로 고치지 않는다.
- **군더더기 금지.** 결함은 `storage-map.json` 의 아키텍처 노드(`node`·`governance`·`refactor_strategy`) 안에서 고친다 — 래퍼·임시 대체 플래그·사후 잘라내기로 덮지 않는다. 비교용으로 남긴 경로는 판정이 나면 지운다.
- **Rust 엔진 (`engine/rust/`, 1·1.5·2단계).** 운명 엔진의 기본 백엔드는 Rust/WASM(`engine: 'rust'`), JS(`engine/fate_engine.js` 의 `run`)는 기준 구현(오라클)이다. 두 백엔드 모두 IR 테이프만 해석한다(법칙 코드 없음). 적분은 두 층·조절 배율을 묶은 진행량 좌표 결합 Rodas3(오차 추정·단계 거부로 양수성) — 정확도는 `integrator.rtol·atol`(결합점 등록부)로 정하고, 관찰 격자 `dt_slow` 는 신호·기록 간격일 뿐이다. 수치 L2 의 수렴 기준은 같은 적분기를 허용 오차 1/1000 로(`orchestrator.refScenario`). 결정 탐침은 워커마다 독립 WASM 인스턴스로 병렬(`engine/probe_pool.js`) — 탐침은 (시작 상태, t0) 의 순수 함수로 두고, 결정 시각·탐침 끝 상태는 lanes 와 무관하게 직렬과 같아야 한다(⑦). Rust 소스를 바꾸면 `sh engine/rust/build.sh` 로 `pkg/fate_core.wasm`·`.json` 을 다시 만들어 같은 커밋에 넣고, `tests/rust_engine.test.mjs`(JS 와 동등 — 궤적 ≤ rtol·운명·시각 같음·byteLength 불변·네이티브 = WASM 비트·루프 할당 0)가 통과해야 한다. 알고리즘을 바꾸면 두 백엔드를 같은 커밋에서 맞춘다.
- 이 분리를 바꾸는 변경은 `node --test tests/*.test.mjs`(특히 `tests/governance.test.mjs`) 통과가 조건이다.

## 데이터를 넣을 때

`data/db.json` 을 직접 편집하지 않는다. 항상 패치 → `merge` 경로를 쓴다.

1. `node dbtool.mjs status`, `node dbtool.mjs prompt` 로 규모·규칙·색인을 읽는다.
2. 쓰려는 개념이 이미 있는지 `node dbtool.mjs map <이름|영문명|외부ID>` 로 먼저 찾는다. 있으면 그 번호(D…)를 쓴다.
   뜻이 여러 개면 `node dbtool.mjs context <피정의항>` 으로 맥락을 보고 맞는 정의항을 고른다.
   기전을 넣을 때는 `node dbtool.mjs mechanism <경로|S…>` 으로 기존 사슬·묶음 키를, `context` 로 원천의 부위·규칙을 확인한다.
3. 패치 JSON 을 저장소 밖(스크래치 폴더)에 쓰고 `node dbtool.mjs merge <patch.json> --dry` 로 관문을 통과하는지 본다.
   거부되면 메시지대로 고친다. `--allow-warnings` 는 사용자가 허락한 경우에만 쓴다.
4. 통과하면 `--dry` 없이 병합하고 `data/db.json` 과 `data/patches/` 를 함께 커밋한다.

반드시 지킬 것
- 외부 ID(ChEBI, UniProt, EC, GO …)는 확실한 것만 적는다. 모르면 `unmapped` 에 사유를 적는다. 지어내지 않는다.
- 원본 대조는 자동 보강 고리로만: `node dbtool.mjs augment plan` → `fetch`(막히면 `data/fetched/RETRIEVAL_TASKS.md` 를 사용자에게 넘김 — "UniProt 에 닿지 못함, 이 파일들을 받아 주세요") → `build`(확인) → `apply`(관문 + CHANGES 행). 확인을 통과한 것만 `verified`, 모호하면 unmapped + Identity_Gap 유지, 다른 값의 asserted 는 사용자가 동기화를 요청할 때만(`--sync`) 바꾼다. 수신함 원본은 해석만 하고 실행하지 않는다.
- 두 해상도를 지킨다.
  - 정의항(D)을 만들거나 넓힐 때: 완전성·구조적 깊이 우선. 구성 요소(소단위·보조인자), 막 위상, 부위, 규칙을 빠뜨리지 않는다.
    잔기 번호를 모르면 `residue_unknown: true`, 외부 ID 를 모르면 `unmapped` — 모르는 값은 명시하고 지어내지 않는다.
  - 묶음·단계(B/S)를 만들 때: 효율·참조 무결성 우선. 단계는 원천의 전이 규칙 참조 + 묶음만. 라벨·설명문은 규칙에 둔다.
- 인산화형·활성형 같은 변화는 새 개념이 아니라 묶음의 `부위:특징` 으로, 활성은 원천의 상태 의미 규칙으로 표현한다.
- 위치는 묶음마다 적는다(세포 밖·세포막·세포질 …). 공간 접촉이 안 되는 단계는 거부된다 — 위치를 고치거나 수송 단계를 넣는다.
- 종마다 다른 값은 `obs` 에 `context.species` 와 함께. 정의항의 기준 종은 하나(단백질·핵산은 기본 9606).
- 연결의 `span` 은 정의 문장 속 구절을 원문 그대로. 근거가 문장에 없으면 연결을 빼거나 문장을 고친다.
- 기존 정의항을 고치는 패치는 적은 최상위 필드만 교체한다. `desc`·`site`·`rule` 같은 배열·객체는 통째로 바뀌므로 유지할 항목도 함께 적는다.
- 새 항목에는 임시 번호(T+1, D+1, S+1)를 쓴다. 번호를 직접 지어내지 않는다. `data/db.json` 의 `meta.next` 를 손대지 않는다.
- 구조 지문(InChIKey·서열 해시)은 머릿속으로 계산해 넣지 않는다. 도구로 계산한 값만 `computed` 로 넣는다.

## 한계와 개념 진화 (반드시)

- **한계는 데이터다.** 시뮬레이션 실패·우회·추정·단순화를 오류로 넘기지 않는다. 발견하는 즉시 패치의 `limitations` 로 `[Target | Type | Requirement]` 를 등록하고(해결 경로 `needs` 포함) `node dbtool.mjs limitations --write` 로 `limitations.md` 를 갱신한다. `node dbtool.mjs limitations --detect` 의 후보가 0 이 되게 한다.
- **새 개념을 설계하기 전에 `limitations.md` 를 먼저 읽는다.** 새 정의항이 어떤 한계를 어떻게 해결하는지 `addresses: [{ limitation, how }]` 에 적는다. 해결하지 않으면 `gap_review` 에 이유를 적는다(상위 개념은 둘 중 하나가 없으면 거부된다).
- **개별 단계에 갇히지 않는다.** 경로를 넣은 뒤 `node dbtool.mjs pattern <경로>` 로 상위 패턴을 확인하고, 상위 개념이 없는 패턴이 두 경로 이상에서 반복되면 kind process + `motif` 정의항으로 추상화한다.
- 시뮬레이션 결과를 보고할 때는 "농도 공백" 표시(기본값·무한 풀)를 함께 밝힌다 — 그 결과는 도달 여부만 말한다.
- **3차원을 무작정 늘리지 않는다.** `node dbtool.mjs resolution <경로>` 로 단계마다 필요한 해상도(R0 위상·R1 부위·R2 구조)를 보고, R2 는 경쟁(T3)을 속도 상수로 가를 수 없는 반응 중심에만 둔다. 경쟁은 먼저 속도 상수(Kd·kcat·Km)로 푼다.
- **속도 상수는 규칙의 `kinetics` 에 SI 정준 단위로, 근거와 함께.** 확인하지 못한 값은 넣지 않는다 — 엔진 시험용 값은 `examples/scenarios/` 의 `hypothetical: true` 시나리오에만 둔다.
- **실측값은 관찰 기록으로 (v10, `docs/design/observation-port.md`).** 측정한 수치는 모델 표현이 아니라 "무엇을 쟀는가"로 `observations`(O+1)에 넣는다. 값(SI)·불확도(크기·유형·잡음 모형)·반복 수·조건(종)·출처·용도(`estimation | validation`)가 필수다. 문헌 속도 상수는 그 관찰을 `kinetics.from` 으로 참조하는 파생값이고, 묶은 상수(`lumped`)도 원 관찰을 참조한다. 관찰 기록은 바꾸거나 지우지 않는다 — 잘못이면 `retracted` 만 더한다. 추정에 쓴 관찰을 검증에 쓰지 않는다. 합성 관찰은 `examples/observations/` 에만 둔다. 측정값은 손으로 옮기지 말고 포트(계약 `schemas/obs/`)로 넣는다 — 지식(개념·기전)은 직접 패치, 측정은 포트.
- **모든 시뮬레이션·갱신 뒤 `node dbtool.mjs audit-run <경로>` 를 돌린다.** Audit Error 는 오류로 넘기지 말고, 교정 제안의 한계를 채우거나 새 한계로 등록한다.
- **물질은 무한하지 않다 (v7).** 대사물은 유한 저장소이고, 재생은 공급 규칙(`type: supply`)으로, 소멸은 분해 규칙(`type: degradation`, lost | recycled)으로만 표현한다. 고갈(AUDIT_RESOURCE·stalled)은 결과로 보고하고, 재생 경로가 없으면 공급 규칙을 정의하거나 Kinetic_Gap 으로 등록한다.
- **유한 계는 결국 멈춘다.** 회로·경로를 넣으면 `simulate --rate --until-death` 로 정지까지 돌리고, 사후 분석의 제한 요인(고갈 → Resource_Gap, 평형·속도 → Kinetic_Gap)을 등록한다. 적분 안정성 감사(Δt 너무 큼)가 나오면 Δt 를 줄여 결과가 수렴할 때만 보고한다.
- **3 층 (v8).** 새 분자 정의항에는 `tier`(T1 연속 장 | T2 규칙 행위자)를 — 분자 부류는 반드시 명시. 확산 계수·pH·유전율은 위치(`context.location`)와 SI 단위로만. 가역 반응은 `dG0` 로 역 상수를 정하고(k_r 를 따로 지어내지 않음), 닫힌 고리 ΣΔG° = 0 (AUDIT_THERMO). 실행 상태(영역·원장 거래)는 데이터베이스에 넣지 않고 시나리오 `domains`·`engine/` 에.
- **실행 층(P3) 을 바꾸면** `node tests/p3_end_to_end.js` 가 |N_initial − N_final| < 1 로 통과해야 한다. 원장은 거래(`applyLedgerTx`·`applyLocalTx`)로만 바꾸고, 장(FV)은 언제나 원장에 맞춰 재척도한다 — 반대 방향 금지.
- **대리 모델(P4) 은 분포 안에서만.** 대리 출력은 같은 단계에서 OOD 탐지를 통과해야 쓰고, 아니면 버리고 FV. 속도 향상을 보고할 때는 `tests/p4_benchmark.js` 의 FV 부분 단계 수(강성)와 함께 — 비강성 영역에서는 대리 모델이 더 느리다. 정확도 기준(L2 < 2%)과 `tests/p4_end_to_end.js` 통과가 바꾼 뒤의 조건.
- **동적 관문(P5) 은 강성으로 고른다.** 경로는 `engine/p5_dynamic_gate.js` 의 N_sub(FV 부분 단계 수와 같아야 함)·히스테리시스(K_up/K_down/M)·사전 필터 γ 로만 정하고, 충격·OOD 는 같은 단계 강등 + W 냉각. 전이마다 `exactAnchor` 로 |Σu − N_ledger| ≤ 1e-15. `mode: 'fv'`(P3) 결과는 비트 단위로 바꾸지 않는다. 관문·대리 모델을 바꾸면 `tests/p5_dynamic_promotion.js` 통과가 조건이고, 속도는 구간별 N_sub 와 함께 보고한다(N_sub < 15 구간은 ≈ 1×). 운명 엔진은 1.5단계부터 이 관문을 쓰지 않는다 — 강성은 L-안정 결합 적분이 흡수한다.
- **운명은 상태 전이다 (v9).** 계통 결정은 `cell_state`(표지 서명·대사 프로그램·전이)와 `modulation` 규칙의 사슬(신호 → 대사 공급 규칙 → 대사물 → 전사 인자 합성)로 넣는다 — 표지를 데이터에 직접 올리지 않는다. 매개 단계를 조절 규칙 하나로 묶으면 `Regulatory_Gap` 을 등록하고(힐 상수 포함), 힐 상수·합성 속도·문턱은 확인한 값만 데이터에, 나머지는 `hypothetical` 시나리오에. 운명 결과를 보고할 때는 결정 시점(신호 철회 시험)·분화 정지 원인(사후 분석의 고갈 저장소·시각)과 함께 "상수는 가상" 을 밝히고, 운명 층을 바꾸면 `node tests/fate_suite.js` 통과가 조건이다. 생리적이지 않은 계통 경로(예: B 세포 → NKT 세포)는 근거 사슬 없이 만들지 않는다.
- **엔진은 이름을 모른다.** `core.js`·`engine/*` 에 분자·위치·부분 구조 이름을 쓰지 않는다 — 화학·생물 사실(부분 구조의 원자 수 `elements`, 기본 위치 `defaultVolumeLocation` …)은 데이터나 어휘에 두고 엔진은 번호·부분 구조·속도 상수로만 계산한다. 부분 구조 수지 ΣIn = ΣOut 은 규칙 검사와 운명 엔진 원장 모두 상대 1e-14.
- **비교 검토 없이 더하지 않는다 (Comparative Optimization).** 새 규칙·경로·수식·수치 선택은 `node dbtool.mjs compare --state … --scenario A [--scenario-b B | --patch p]` 로 지금 구현과 나란히 돌려 판정을 본다: 결과가 같고 비용(규칙·조절 수, 시간 +5% 초과)만 늘며 수치 이득 < 1e-5 이면 **Optimization-Negative — 넣지 않는다**. 결과가 바뀌면(Behavior-Changing) 수치로는 고를 수 없으니 관찰 데이터로 고르고, 없으면 그 선택을 Kinetic_Gap/Regulatory_Gap 의 note 로 남긴다. 이미 있는 supply·modulation 으로 표현할 수 있으면 새 규칙 종류를 만들지 않는다.
- **정제 점검은 자동이다.** `augment build/apply`, `simulate --rate`, `fate`, `validate <patch>` 가 `refineCheck`(사법부, 판결만) 를 돌린다 — 중복 규칙(같은 화학량·위치의 공급, 같은 조절자·대상·효과·위치의 조절)과 경로 순 반응 ↔ 단계 화학량 합의 모순. 패치가 새로 만든 중복이나 등록 안 된 모순은 병합을 막고, 입법부(`legislative.draftRefactor`)가 리팩터링 패치 초안(참조 없는 중복 제거)을 저장소 밖에 쓴다 — 적용은 에이전트가 새 패치로. 의도한 단순화면 그 규칙을 대상으로 Structural_Gap 을 등록한다(→ known).
- **운명 결과는 과정 보고서로만 보고한다.** `node dbtool.mjs fate <상태> --scenario s.json [--report 파일.md]` 가 만드는 보고서(1 요약 · 2 변곡점·시계열·구간 [기간 | 주된 원인 | 우세 표지 | 대사 비용] · 3 무결성 증명서 · 4 인과 추적 · 5 기술 부록)를 근거로 쓰고, 끝 상태만 말하지 않는다. 무결성 증명서가 FAIL(원장·재생이 어느 한 단계라도 1e-14 초과, 신호가 선언된 일정과 다름, 다시 돌린 궤적 해시가 다름, 쓰인 상수가 입력과 다름)이면 그 결과는 실패로 보고하고 결론에 쓰지 않는다. 예측은 실행 전에 시나리오 `expect` 에 적는다(입력 해시에 들어감) — 실행 뒤 바꾸지 않는다.
- 데이터 패치 절차: 초안(스크래치) → `node dbtool.mjs validate <patch.json>`(관문 미리 보기 + 정제 점검) → `node dbtool.mjs augment apply <patch.json>`(병합 + 기록 + CHANGES.md 행 + limitations.md·교과서 부록 갱신).
- **부분 구조 수지를 지킨다.** 부분이 옮겨 다니는 분자에는 `moieties` 를 달고, 변환·분해·공급 규칙의 빠진 산물(피로인산·Pi …)은 규칙과 단계(minor)에 함께 넣는다. 원료가 모델 밖이면 `source: true` — 수지 검사를 피하려고 쓰지 않는다. 반감기·공급 속도·서열 길이는 확인한 값만.

## 추적 가능한 진화 (Traceable Evolution Protocol)

추적 가능성 > 장황함. 기록은 구조화·고밀도·차등(diff)으로.
| 변경 | 기록 | 도구 |
|---|---|---|
| 데이터 패치 | 패치 최상위 `why` 필수 → `merge` 가 **Patch Report**(Scope·Why·Impact·Verification)를 계산해 출력하고 `data/patches/` 기록의 `report` 에 저장. `why` 없거나 미등록 한계 후보가 있으면 거부 | `merge`, `report <기록>` |
| 코드·형식·어휘·문서 구조 | `CHANGES.md` 맨 위에 한 행(표): Scope(파일·함수·정의항) · Why · Impact(하류 규칙·명령·데이터) · Verification(테스트 수·validate·check) | 손으로, 같은 커밋 |
| 사용자 보고 | 같은 네 칸의 표. 산문 요약 금지 | — |

- 살아 있는 문서: 구조(D·묶음·S 형식) 변경 → `SCHEMA.md`, 작업 규칙·원리 → `CLAUDE.md`, 모든 실패·unmapped·미해결 공백 → `limitations.md`(패치 `limitations` → `--write`). 문서는 전체 재작성 금지, 해당 절만 고친다.
- `unmapped` 외부 ID 도 한계다(`Identity_Gap`). `limitations --detect` 후보 0 은 병합 조건.
- 세션 시작: `CHANGES.md` 위 몇 행 → `limitations.md` → `SCHEMA.md` 변경 기록 순으로 최신 설계와 동기화한다.
- 변경이 논리를 깨면 감지·수정·기록까지가 한 작업이다 (테스트·`audit-run` 로 감지, CHANGES.md 에 기록).

## 규칙·코드를 바꿀 때

- 통제 어휘(`vocab.js`)나 규칙(`model.js`·`core.js`·`judicial/`·`legislative/`)은 사용자 요청이 있을 때만 바꾼다. 데이터를 통과시키려고 규칙을 느슨하게 하지 않는다.
- 바꾼 뒤 `node --test tests/*.test.mjs` 와 `node dbtool.mjs validate` 가 모두 통과해야 한다. 새 규칙에는 거부 테스트를 추가한다.
- 형식이 바뀌면 `migrations/` 에 변환 스크립트를 추가하고 `SCHEMA.md` 변경 기록을 갱신한다.
- `index.html` 은 `viewer.html` 의 복사본이다. 화면을 고치면 둘 다 맞춘다.
- 교과서: 알고리즘·형식·상호작용을 바꾸면 `docs/textbook/` 해당 장을 같은 커밋에서 고친다. 지금 값은 손으로 쓰지 않고 `node dbtool.mjs textbook --write` 로 부록을 만든다. 파일을 더하거나 옮기면 `docs/textbook/storage-map.json` 에 분류를 적는다 — `textbook --check` 가 분류되지 않은 파일을 잡는다.
