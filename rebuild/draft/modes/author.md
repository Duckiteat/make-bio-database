# 모드: 정보 작성 (`author` — 수집가 포함)

> 생성물 — `node rebuild/status.mjs --write` 가 `rebuild/rules/rules.jsonl · modes.json` 에서 만든다. 손으로 고치지 않는다 (규칙을 바꾸려면 원본을).

- **언제**: 정의·기전·관찰·외부 ID·한계를 데이터에 더하거나 고칠 때, 또는 문헌에서 값 후보를 모을 때
- **목표**: 실측에 매인 사실을 늘린다
- **쓸 수 있는 곳**: 패치 → 관문(validate · augment apply / merge)만. 수집가는 핸드오프(workspace/handoff/)만. 코드 편집 금지
- **가장 큰 위험**: 지어내기 · 다른 종 값을 사람 값으로
- **끝내기 전**: node dbtool.mjs validate · node dbtool.mjs limitations --detect (후보 0) · 닿은 경로 audit-run · node --test tests/rejections.test.mjs
- **멈춤**: 어휘에 없는 값이 필요할 때 · 종이 다를 때 → 사람에게

공통 규칙은 중심 문서(`CLAUDE.md`)에 있다.

## 지켜야 할 규칙 — 사람·AI (112)

### 삼권 분립 (docs/design/tripartite-governance.md) — 바꾸면 node --test tests/*.test.mjs(특히 governance)

- `RULE-0021` 유료 원천은 받지 않는다
- `RULE-0022` 계정 원천은 BRENDA 하나, fetch 의 brenda_kinetics 로만

### 데이터 넣기 — data/db.json 직접 편집 금지

- `RULE-0057` --allow-warnings 는 사용자 허락 시만
- `RULE-0058` db.json·patches 함께 커밋
- `RULE-0062` 외부 ID 는 확실한 것만, 모르면 unmapped (+Identity_Gap), 지어내지 않음
- `RULE-0065` 모호하면 unmapped + Identity_Gap 유지
- `RULE-0070` 인산화·활성형은 묶음 부위:특징 + 상태 의미 규칙 (새 개념 금지)
- `RULE-0075` 기존 정의항 패치는 적은 최상위 필드 통째 교체 — 유지할 항목도 적음
- `RULE-0076` 구조 지문(InChIKey·서열 해시)은 도구 계산값만 computed 로

### 한계·진화

- `RULE-0077` 실패·우회·추정·단순화는 한계 데이터로 — 패치 limitations [Target — Type — Requirement]+needs
- `RULE-0080` 상위 개념 없는 패턴이 두 경로 이상이면 kind process + motif _(코드가 알림)_
- `RULE-0082` R2 는 속도 상수로 못 가르는 반응 중심만, 경쟁은 Kd·kcat·Km 먼저 _(코드가 알림)_
- `RULE-0090` 불확도 미보고면 sd = 유효 숫자 해상도 + note
- `RULE-0091` 상수를 넣은 뒤 궤적 전후 비교 보고
- `RULE-0108` 반복 수가 원문에 없으면 null — 1 로 적지 않음 _(코드가 알림)_
- `RULE-0117` 교과서·추론은 정성 관찰이 아님 (한계·메모로)
- `RULE-0118` 같은 실험은 experiment 로 묶음
- `RULE-0122` 번호를 합치거나 나눌 땐 패치 moved (지우고 새로 만들지 않음) _(코드가 알림)_
- `RULE-0131` 환산표는 하나 (엔진과 사법부가 같은 것)
- `RULE-0132` Audit Error 는 한계를 채우거나 등록
- `RULE-0134` 고갈은 결과로 보고 (결함 아님) _(코드가 알림)_
- `RULE-0135` 재생 경로 없으면 supply 정의 또는 Kinetic_Gap _(코드가 알림)_
- `RULE-0136` 제한 요인 등록: 고갈 → Resource_Gap, 평형·속도 → Kinetic_Gap _(코드가 알림)_
- `RULE-0137` 안정성 감사가 나오면 Δt 줄여 수렴할 때만 보고 _(코드가 알림)_
- `RULE-0152` 운명은 cell_state + modulation 사슬 (표지 직접 금지) _(코드가 알림)_
- `RULE-0157` 근거 없는 비생리 계통 경로 금지
- `RULE-0158` 분열 = 0차 supply 누적 진행량 (새 규칙 종류·가짜 분자 금지)
- `RULE-0159` 억제 힐 K = 임계값 −10 %
- `RULE-0160` 활성 힐 기준선 1 → 1/fmax 근사 + 한계
- `RULE-0161` 도달 시각은 Δ 바꿔 확인
- `RULE-0166` 의도한 단순화는 Structural_Gap
- `RULE-0167` 기전은 세포 상태 mechanisms 에 걸어 운명 엔진으로 (따로 돌리는 길 금지)
- `RULE-0170` simulateRate 와 서로 기준 금지 (L000081)
- `RULE-0183` 운명 결과는 fate --report 과정 보고서로만, 끝 상태만 말하지 않음
- `RULE-0187` source: true 는 원료가 모델 밖일 때만
- `RULE-0188` 반감기·공급 속도·서열 길이는 확인 값만

### 규칙·코드 바꾸기

- `RULE-0197` vocab·model·core·judicial·legislative 규칙은 사용자 요청 시만
- `RULE-0205` 새 규칙 → 말뭉치·바닥값 올림, 의도적 완화는 바닥값 내리는 별도 커밋

### 한계와 개념 진화 (반드시)

- `RULE-0222` 종이 다른 값(돼지·소 심장 효소)은 찾지 못한 것으로 한계 등록
- `RULE-0232` 지식(개념·기전)은 직접 패치, 측정은 포트

### 규칙·코드를 바꿀 때

- `RULE-0248` 남는 위험: 같은 환경의 셸은 환경 변수를 읽을 수 있다 — BRENDA 전용 비밀번호
- `RULE-0249` 받기는 도구의 기록이 증거 — 유료·PMC 무료 열람본은 저작권 때문에 받지 않음

### 데이터를 넣을 때

- `RULE-0252` 두 해상도를 지킨다

### 3. 다른 AI 를 함께 쓸 때

- `RULE-0270` 다른 AI 에게서 온 값은 전부 후보 — 원 논문에서 직접 확인한 것만
- `RULE-0271` 확인하지 못하면 한계로 등록한다 — 그게 이 저장소가 다른 데이터베이스와 다른 점이다.

### 3′. 수집가·통합가 핸드오프 (싼 모델에 수집을 맡길 때)

- `RULE-0272` 단위는 묶음(batch) — 항목마다 핑퐁하지 않는다.
- `RULE-0273` A (서브에이전트, 지금 기본): 보고만 — 구조적으로 apply·commit 불가. 설정 0. 묶음마다 통합가가 띄운다.

### 0. 한 문장

- `RULE-0285` 수집가는 후보를 workspace/handoff/ 에 적기만, 적용·커밋·판단은 통합가

### 1. 절대 규칙 (어기면 안 된다)

- `RULE-0288` 인용·값은 지정 1차 출처 API 응답에서만, 웹 검색 스니펫·2차 리뷰 금지 (TASK-002 교훈)

### 절대 선 (작업자가 깨면 안 되는 것)

- `RULE-0299` 본체(main) 금지. 커밋·push 는 자기 작업 브랜치(`sonnet/*` 등)에만. `main` 에 쓰지 않는다

### 규칙 (깨면 안 됨)

- `RULE-0301` 인용·값은 지정 1차 출처 API가 반환한 내용에서만 뽑는다. 웹 검색 스니펫·2차 리뷰·블로그를 값·인용
- `RULE-0302` 근거로 쓰지 마라. 못 찾으면 `not_found`, 접근 안 되면 `unreadable` — 지어내거나 스니펫으로 메우지 않는다.

### 출처 표

- `RULE-0303` 나머지는 엔드포인트를 통합가가 확인해 이 표를 갱신하기 전까지 "통합가 필요"로 표시한다.

### 역할 분리 (깨면 안 되는 선)

- `RULE-0307` (서브에이전트면 파일에 쓰지 말고 반환, 상주 세션이면 이 표에 append). 금지: `augment apply`·`merge`·
- `RULE-0308` "후보"다 — 베끼지 않는다). 통과분만 패치 → `validate` → `augment apply` → 커밋. 상태를 바꾼다.

### 매핑 규칙 요약 (자세히는 SCHEMA.md)

- `RULE-0310` 이름 하나 = 개념 하나: 띄어쓰기·하이픈·대소문자·그리스 문자 차이를 없앤 이름이 두 개념을 가리키면 오류. 새 이름이 기존 별칭과 같으면 기존 개념으로 합쳐진다.
- `RULE-0313` 단계는 규칙의 적용: 행위자 활성, 변화량 = 규칙 효과, 해리 구성 요소 개수, 수송 외 위치 변화 금지, 위치 조건, 공간 접촉.
- `RULE-0314` 규칙은 `tests/` 의 시험 195개가 지키고, GitHub Actions 가 푸시마다 테스트와 전체 검사를 돌린다.

### 스키마와 매핑 규칙 (형식 버전 9)

- `RULE-0315` AI 패치는 데이터(`terms`, `senses`, `steps`, `remove`)만 바꿀 수 있고 어휘·규칙은 바꿀 수 없다.

### 1. 식별자: 의미 없는 고정 번호

- `RULE-0316` 번호에는 의미를 넣지 않는다. 이름·분류·기능처럼 바뀔 수 있는 정보가 번호에 들어가면 지식이 바뀔 때 번호도 바뀌어야 한다.
- `RULE-0317` 이름을 바꿔도 번호와 연결은 그대로다. 옛 한국어 이름은 자동으로 별칭에 남는다.
- `RULE-0318` 사람용 꼬리표: 뜻이 하나인 개념은 `이름`, 여러 개면 `이름#n`(n = 개념 안 뜻 번호, 바뀌지 않음).

### 2. 이름 매핑 (하나의 이름 = 하나의 개념)

- `RULE-0320` 정규화: 유니코드 NFKC → 소문자 → 그리스 문자를 이름으로(β→beta) → 공백·하이픈·괄호·점·쉼표 등 제거.
- `RULE-0321` 정규화한 이름(`names.ko`, `names.en`, 별칭) 하나는 데이터베이스 전체에서 개념 하나만 가리킨다. 겹치면 오류.
- `RULE-0322` 패치의 새 개념 이름(ko 또는 en)이 기존 이름과 같으면 기존 개념으로 매핑되고 새 별칭·영문명만 더해진다.
- `RULE-0326` 참조 매핑 (패치 안에서만, 저장 전에 번호로 바뀜): 정의항 번호 → 임시 번호 → 개념 번호(뜻이 하나일 때) → `이름#n` → 외부 ID(`CHEBI:15422`) → 구조 지문 → 이름·별칭.
- `RULE-0328` 단, 정의항의 `term` 에 없는 이름을 쓰면 그 이름으로 새 개념이 만들어진다.

### 3. 통제 어휘

- `RULE-0329` 패치에서는 표의 별칭도 쓸 수 있다(`phosphorylation`, `cytoplasm`, `biochemistry`, `활성`, `human` …). 병합 때 표준 키로 바뀐다.

### 4. 종류(kind) 규칙

- `RULE-0335` `part_of`: 분자·structure_feature → 분자 / pathway → pathway / process → process·pathway
- `RULE-0336` `instance_of`: is_a 와 같음 / `requires`·`contrasts`·`refers`: 제약 없음

### 5. 종 (기준 종과 관찰)

- `RULE-0338` 정체성 자체가 다르면(다른 유전자 산물, 다른 구성) 새 정의항. 부분적인 차이는 규칙·부위의 `taxa` 조건으로 둔다. _(코드가 알림)_

### 상태 의미 type: "meaning"

- `RULE-0347` `{ id, label, when: { 부위: 특징 }, activity }`. 위에서부터 차례로 보아 첫 번째로 맞는 규칙이 그 묶음의 활성이다. `when` 이 비면 기본값(맨 아래에 둔다). _(코드가 알림)_

### 8. 묶음과 기전 단계 (시뮬레이션 해상도)

- `RULE-0367` 사슬 연결: 한 단계의 출력 묶음 키가 다른 단계의 입력·행위자·조절자 묶음 키와 같으면 이어진다. `minor`(부산물)는 잇지 않는다.

### 8B. 한계 등록부 (Limitation & Constraint Registry) — 형식 v5

- `RULE-0368` Target: 정의항 `D…`, 그 부위 `D…/site/키`·규칙 `D…/rule/키`, 또는 단계 `S…`. 패치에서는 이름도 된다(`TAK1/site/act`).
- `RULE-0373` 상태는 저장하지 않고 계산한다: needs 가 모두 충족되면 `resolved`, manual 이 resolution 으로 닫히면 `resolved_manual`, 아니면 `open`.

### 해상도 (vocab.js 의 resolutionLevels·resolutionThresholds)

- `RULE-0376` 하향 전환(반응 중심 → 풀): 바뀐 부위는 묶음 키의 `부위:특징`으로 남아 무손실이고, 수송·해리는 특징 보존 검사를 받는다.

### 반응 속도 rule.kinetics

- `RULE-0380` 한계 해결 경로 `{ kind: "kinetics", rule: "D…/rule/키", params: ["Kd"] }` — 규칙에 그 상수가 들어오면 자동 resolved.

### 속도 기반 시뮬레이션과 감사

- `RULE-0381` 모든 감사 오류는 한계 등록부에서 찾은 교정 제안을 단다. 맞는 한계가 없으면 등록할 형식을 제안한다. 감사 오류가 있으면 종료 코드 1.

### 분해 규칙

- `RULE-0388` `when` 이 있으면 그 부위:특징을 가진 묶음만, `where` 가 있으면 그 위치의 묶음만 분해된다. 복합체 안의 구성 요소는 분해되지 않는다(묶음의 바탕이 소유자일 때만). _(코드가 알림)_

### 대사물 저장소 (Metabolic Reservoir)

- `RULE-0390` 시작량: 시나리오 `reservoirs` / `amounts` → 데이터(copy_number, 또는 concentration × compartment_volume) → 기본값(1000, 농도 공백 표시).
- `RULE-0391` 공급 규칙은 시뮬레이션의 묶음에 닿으면 켜지고, 그 규칙의 다른 분자도 저장소가 된다(닫힌 집합이 될 때까지). 속도 상수나 부피가 없으면 적용하지 않고 보고한다.

### 속도 기반 시뮬레이션 (v7) — 매 Δt 순서

- `RULE-0392` 단계마다 국소 수지도 첫 발화 때 검사한다: 단계 한 번의 실체 Δ(그 규칙의 화학 실체 제외)와 부분 구조 Δ(공유 결합 수식이면 공유 결합 경로로 기록). 결과에는 묶음별 원장 Δ(반응·공급·분해·재활용), 저장소 표(시작·끝·최소·분류 closed — consumed_only — produced_only — idle), 저장소 분자 사이의 순환 성분(강하게 연결된 성분)이 붙는다.

### 8F. 3 층 다중 규모 엔진 — 형식 v8

- `RULE-0393` `k0`, `dG_act` — 규칙 kinetics — 전이 상태 이론: 함께 적음, dG_act ≥ 0 (J/mol). k 도 있으면 k ≈ k0·e^{−dG_act/RT} (10%, T_ref 310.15 K)
- `RULE-0394` `env { pH_ref, dG_dpH, eps_ref, dG_dinv_eps }` — 규칙 kinetics — ΔG_env = dG_dpH(pH − pH_ref) + dG_dinv_eps(1/ε − 1/eps_ref). 기준 속도가 있을 때만

### 8H. 관찰 기록 — 형식 v10

- `RULE-0407` 정의항의 `obs`(D…/obs/n — 서열 길이·국재 같은 정의 속성)는 그대로 둔다. 엔진·사법부가 쓰는 수치 측정은 관찰 기록으로 넣는다.

### 9. 외부 ID

- `RULE-0408` protein — UniProt — UniProt, PDB, EC, NCBIGene
- `RULE-0409` small_molecule · macromolecule · ion — ChEBI — ChEBI (+ PubChem)
- `RULE-0410` complex — – — GO, PDB, EC
- `RULE-0411` molecule_class — – — ChEBI, EC, GO
- `RULE-0412` pathway — – — GO, Reactome, KEGG
- `RULE-0413` process — – — GO

### 10. 구조 지문 (fingerprint)

- `RULE-0415` `InChIKey` — small_molecule, ion, macromolecule — 표준 InChIKey
- `RULE-0416` `SEQ_SHA256` — protein, nucleic_acid — 정규 서열(대문자, 공백 제거)의 SHA-256
- `RULE-0419` 저분자는 생리적 pH(7.3)의 주 이온 형태를 대표로 하고, 입체이성질체가 생화학적으로 구별되면 별개 개체로 둔다. 단백질은 정규 서열 기준이며, 인산화형 같은 변화는 지문이 아니라 묶음의 특징으로 표현한다.

### 11. 패치 형식

- `RULE-0420` `remove` 에 개념 번호를 주면 그 개념의 뜻도 모두 지워진다. 뜻을 모두 잃은 개념도 지워진다.

### 12. 관문

- `RULE-0423` 바뀐 것 없음 — 저장 안 함
- `RULE-0424` 통과 — `data/db.json` 저장 + `data/patches/시각-이름.json` 에 패치와 매핑 결과 기록

### 8J. 외부 ID 의 역할 — ChEBI 규약 (형식 v10 확장, 2026-10-10)

- `RULE-0437` 지난 도장 — 데이터에서 빠진 주체의 도장은 무효가 아니라 지난 도장(계보 기록)으로 센다 — `attest` 가 따로 보고하고 validate 의 오류가 아니다

### 8I. 기전 프로그램과 시나리오 맥락 — MHC 실험 (형식 v10 확장)

- `RULE-0438` 화학량 — 단계의 입력·출력 그대로(minor 포함). 사법부 독립 검증기는 엔진이 적은 번호를 믿지 않고 `db.steps` 에서 다시 센다
- `RULE-0439` 막 공급 규칙 — 공급 위치가 막(2D)이면 모든 생성·소비 분자가 그 막에 박힌 분자여야 한다 (동시 번역 막 삽입)

### 8L. 분열과 소모 — 복제 노화(헤이플릭 한계) 실험 (형식 바뀌지 않음, 2026-10-10)

- `RULE-0443` 비가역 — 신호를 끊어도 목표 상태로 끝나는 첫 시각(결정 시점). 소모가 비가역이면(연장 규칙이 꺼져 있으면) 정지 뒤에는 늘 통과한다

### 8M. 측정값 사슬과 래칫 — 안전장치 (형식 v11, 2026-10-10)

- `RULE-0445` 측정값의 전후가 기록에 남는다. Patch Report 의 `measured_changed` 가 `이전 → 이후` 를 적는다 —

### 8N. 값 층 — 형식 v12 (2026-10-15, docs/design/format-v12.md)

- `RULE-0449` 정성 관찰 (2차): `observations.O…` 에 `kind: 'qualitative'` — `{ perturbation? { type: knockout — block — inhibit — clamp, target, Ki_M?, dose_M?, conc_M? }, readout { kind: amount — concentration — fraction — event_time, target? }, …

### 8O. 가정 원장 — 시나리오의 가상 숫자 (2026-10-23, build-plan 49 · docs/design/structure-realignment.md §3)

- `RULE-0450` 자리: db.json 밖 `data/assumptions.jsonl`. db 는 확인된 사실만, 가정은 여기. 가정이 db 값(V…)이 되는 길은 관찰(O…)뿐.

### 7.8 하지 말 것

- `RULE-0460` 생성물(`limitations.md`, 부록, `index.html`) 손으로 고치기

### 4. 판정 — "너무 시끄럽다"가 아니라 "가를 수 없다" (구현: 4단계 ②, judicial/obs_compare.js)

- `RULE-0486` CONSISTENT — (사전 등록된 규약의 검증 세트 관찰만 — build-plan 3) 가설 하나: 선언된 δ(근거 등급 parameter 이상) 안임을 동등성 검정(TOST)으로 보임 · 가설 둘: 이 가설만 기각되지 않음 (2026-10-15, M1 — 기각 못 함은 일치가 아님) — FINDING
- `RULE-0487` 잡음 모형은 최소 집합: 정규 · 로그정규 · 계수(포아송). 쓰이지 않는 분기는 넣지 않는다.

### 1. 층과 최상위 키

- `RULE-0488` 층 사이 참조는 한 방향: 값 → 정의(대상) · 값 → 증거(`from`) · 증거 → 정의(측정량 대상). 정의는 값·증거를 가리키지 않는다.

### 3. 외주화 지도

- `RULE-0490` 패치 초안 — 저장소를 읽는 에이전트만 — 관문 — `validate` · `patchPolicy` · 정제 점검. 저장소 밖 AI 에게는 맡기지 않는다(PROMPTS §3)
- `RULE-0491` 적대적 검토 — 다른 AI — 대화 → 거부 시험 — 결론은 주지 않고 코드만 준다(PROMPTS §3)

### 4.4 에이전트와 도구를 가른다 — 외주화의 효율 핵심

- `RULE-0492` 사용자가 만드는 전문 에이전트 = `fetch`·`query` 도구를 부르는 클라이언트(역할: 수집가). 에이전트 안에 HTTP 코드를 두지 않는다.

### 5. 전문 에이전트 명세 (사용자가 만들 것)

- `RULE-0493` 금지 — db·원장·패치 쓰기 · 커밋 · 값 추정·환산(원문 숫자 그대로) · 그림에서 눈으로 읽은 값을 원문 숫자로 적기(적으면 "그림 전사"로 표시)

## 컴퓨터가 막는 규칙

179 개 — 어기면 검사 오류에 그 번호(`RULE-…`)가 붙어 나온다. 이유·맥락은 규칙 장부(`rebuild/rules/rules.jsonl` · 맥락 `links.jsonl`)에서 번호로 찾는다.
