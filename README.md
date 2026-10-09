# Duckiteat's make bio database

맥락 보존형 생명과학 정의·기전 데이터베이스. 입력은 AI가 하고, 사람은 보고 검사한다.

옵시디언·노션처럼 "메모 한 장 = 노드"가 아니라 **정의항(뜻) 하나 = 노드**이고, 정의항이 그 분자의 구조와 규칙을 소유한다.
기전 단계는 그 규칙을 적용한 결과만 가볍게 담는다. 모든 입력은 엄격한 매핑 규칙([`SCHEMA.md`](SCHEMA.md))을 통과해야 저장된다.

## 두 해상도

```
지식 해상도   정의항 D000042  단백질 키네이스 A {complex}
  (원천)       ├ 구성 요소   PKA 조절 소단위 ×2 · PKA 촉매 소단위 ×2
               ├ 부위        (조절 소단위) cnb_a · cnb_b — cAMP 결합 [bound]
               ├ 규칙        holo: (기본) → 비활성
               │             camp_release: 해리, cAMP 가 조절 소단위의 cnb_a·cnb_b 에 흡수
               └ 설명·관찰   맥락(분야·종·조직·세포)별 정의 문장, 종별 수치
                       │
                    규칙이 다리
                       ▼
시뮬레이션     S000006 = D000042/rule/camp_release 적용
  해상도         D000042|cytosol + 4× D000039|cytosol
  (결과)         → 2× D000056|cnb_a:bound|cnb_b:bound|cytosol + 2× D000057|cytosol
```

- **정의항(D)** 은 가능한 가장 높은 구조적 진실을 담는다: 구성 요소(소단위·보조인자), 막 위상(막관통·지질 고정 …, 어느 막의 어느 면),
  부위(`D…/site/키` — 종별 잔기 번호, 막 면, 리간드), 규칙(`D…/rule/키`), 설명(`D…/desc/n`), 관찰(`D…/obs/n`).
  **모르는 값은 지어내지 않고 명시한다** — 잔기 번호는 `residue_unknown`, 외부 ID 는 `unmapped`.
- **묶음(B)** 은 번호가 아니라 파생 키다: `바탕 D|부위:특징|…|위치`. 인산화형·활성형은 새 개념이 아니라 묶음의 특징이고,
  그것이 활성인지는 원천의 **상태 의미 규칙**이 정한다(`reg_phos:phosphorylated → 활성`).
- **단계(S)** 는 "원천의 전이 규칙이 이 묶음들에 적용됨" 이다. 라벨·설명문은 규칙에 있고, 단계에는 규칙 참조와 묶음만 있다.
  검사는 단계가 규칙과 맞는지 본다 — 행위자가 활성인가, 변화량이 규칙과 같은가, 해리된 구성 요소 개수가 맞는가,
  **같은 공간에서 맞닿을 수 있는가**(세포 밖 에피네프린은 세포막 수용체의 바깥면과만, 세포질의 ATP 는 효소의 세포질 쪽 면과만).

## 고정 번호

```
개념    T000042               이름 묶음        글리코겐 인산화효소 / glycogen phosphorylase · 별칭 포스포릴레이스
뜻      D000044               정의항(원천)     "글리코겐 말단의 포도당 잔기를 …" {molecule_class}
부위    D000044/site/reg_phos  수식 부위         사람 Ser14 · 특징 [인산화됨]
묶음    D000044|reg_phos:phosphorylated|cytosol   = a형, 원천 규칙상 활성
기전    S000009               규칙 적용         D000043/rule/gp_phos
```

모든 연결은 의미 없는 고정 번호로만 걸린다. 이름은 번호에 붙은 꼬리표(ko·en·별칭)라서 바꿔도 연결이 끊기지 않고,
지운 번호는 다시 쓰지 않는다. 사람과 AI 는 `글리코겐 인산화효소`, `효소#2`, `CHEBI:15422` 처럼 불러도 되고 병합 때 번호로 바뀐다.
분자의 정체성은 이름이 아니라 **구조 지문**(InChIKey·서열 해시)으로 확인하도록 자리를 마련해 두었다.

### 정의항끼리 잇는 이유
`[[효소]]` 같은 링크는 *말*만 가리키고 **어느 뜻**인지는 잃는다. 여기서는 연결이 정의항 id 끼리 걸린다.
리보자임은 `효소#2`(넓은 뜻, 생화학) 아래에만 있고 `효소#1`(좁은 뜻, 단백질) 아래에는 없다.
어떤 정의항에서 위로 올라가면 그 뜻이 기대고 있는 정의들의 사슬(맥락)이 그대로 나온다.

### 기전 사슬
한 단계의 출력 묶음 키가 다른 단계의 입력·행위자·조절자 묶음 키와 같으면 **자동으로 이어진다**.
단계는 경로(`pathway`) 정의항에 `part_of` 로 묶이고, 작은 경로는 큰 경로의 `has_part` 가 된다.

현재 예: **에피네프린에 의한 글리코겐 분해** (⊃ cAMP 신호 전달), 11단계
```
에피네프린(세포 밖) → 수용체[ligand:결합](세포막) → Gs[nucleotide:GTP](세포막) → 아데닐산 고리화효소[gs_site:결합](세포막)
 → cAMP(세포질) → PKA 해리 → 촉매 소단위 → 인산화효소 키네이스[pka_phos:인산화] → 글리코겐 인산화효소[reg_phos(Ser14):인산화]
 → 글리코겐(글리코겐 과립) 가인산분해 → 포도당-1-인산 (⊣ 포도당)      ⇄ PP1 이 reg_phos 탈인산화
 cAMP → AMP (신호 종료)            Gs[GTP] → Gs 자체 비활성화 → Gs[GDP]
```

### 스트레스 시험: LPS → TLR4 → NF-κB (19단계, 정의항 43개)
```
LPS(세포 밖) → LBP 결합 → CD14 로 전달 → TLR4–MD-2 의 MD-2 주머니로 전달 → (TLR4–MD-2)₂ 다량체 → TIRAP 모집
 → 마이도솜 조립 (MyD88 6 · IRAK4 4 · IRAK1 4) → IRAK1 Thr209 인산화 → TRAF6 모집 → K63 사슬 → TAK1 활성화
 → IKKβ Ser177·Ser181 → IκBα Ser32·Ser36 → SCF–βTrCP 의 K48 유비퀴틴화 → 26S 프로테아좀이 IκBα 만 분해
 → NF-κB p50–p65 핵 이동(수송) → TNF 유전자 κB 자리 결합 → TNF mRNA 전사
```
`node dbtool.mjs simulate "LPS–TLR4–NF-κB 신호 전달" --until "TNF mRNA" --from LPS` 로 실제로 발화시켜 확인한다 (LPS 를 0 으로 두면 전사에 이르지 못함).
문헌 근거는 서지(저자·연도·DOI/PMID)를 확인한 것만 curated, 추론은 `[Abstracted Logic: Derived from the inferred mechanistic flow]` 로 표시된다.

### 한계 등록부와 개념 진화
- [`limitations.md`](limitations.md): 지금 모델이 못 하는 것 16건 — `[Target | Type | Requirement]`. 데이터가 들어오면 자동으로 resolved (예: TNF 유전자 사본 수 2 를 넣자 L000001 이 1/3 충족).
- 상위 개념 10개(키네이스 연쇄, 막–핵 신호 연쇄, 억제자 분해에 의한 전사 인자 방출 …)는 패턴 검출기로 사례 경로를 스스로 찾는다 — `node dbtool.mjs pattern "키네이스 연쇄"`.
- 구획 농도 모델: 시뮬레이션 시작량을 기본값 대신 copy_number·농도 × 구획 부피 데이터에서 가져온다.

### 혼합 해상도와 반응 속도 (형식 v6)
- **3차원은 필요한 곳에만.** `node dbtool.mjs resolution <경로>` — LPS 경로 19단계 중 R2(구조)가 필요한 단계는 0, 글리코겐 경로는 cAMP 를 두고 PKA 활성화·PDE 가 경쟁하는 2단계뿐(속도 상수가 들어오면 R1 로 해결). 확인된 구조 참조: 3FXI(TLR4–MD-2–LPS 주머니).
- **속도 기반 시뮬레이션** `simulate --rate`: 규칙의 `kinetics`(binding·michaelis_menten·mass_action)를 농도 × 부피로 적분. 시험용 값은 가상 시나리오(`examples/scenarios/`)에만.
- **감사** `audit-run`: 질량 보존·해상도 일관성·속도 무결성 위반을 Audit Error 로 내고, 한계 등록부에서 교정 제안을 찾는다. 예: Gs 를 AC 의 리간드와 행위자로 두 번 센 단순화를 질량 감사가 찾아 L000018 로 등록.

### 생애 주기와 대사물 저장소 (형식 v7)
- **유한 대사물 저장소**: ATP·GTP·뉴클레오타이드·아미노산 같은 보조 기질은 구획마다 하나의 유한한 풀. 단계가 소비하면 줄고, 바닥나면 그 단계가 멈춘다(기질 고갈 — 오류가 아니라 결과).
- **공급 규칙 (Metabolic_Supply_Rule)**: NDPK(GDP + ATP → GTP + ADP)·ATP 재생(ADP + Pi → ATP)·아데닐산 키네이스·PPase·뉴클레오타이드 공급. 켜지면 GTP–GDP·ATP–ADP 순환이 닫힌다(순환 재생, 자원 순환 성분으로 보고).
- **분해 규칙 (Degradation_Rule)**: 1차 k_deg(또는 반감기), 산물은 소실(lost) 또는 구성 단위로 재활용(recycled — 화학량은 서열 길이 관찰). 결정론 또는 `--stochastic --seed`.
- **매 Δt 질량 감사**: 단계 국소 수지(첫 발화 시각) + 전역 합계 = 시작 + 원장(분해·재활용·공급). 원자 대신 부분 구조(`moieties`: 아데노신·구아노신·인산기 단위)를 센다 — 이 검사가 AC 고리화의 피로인산, 유비퀴틴 활성화의 피로인산, 프로테아좀의 Pi 누락을 찾아 데이터를 고쳤다.
- 시험: `node dbtool.mjs simulate "에피네프린에 의한 글리코겐 분해" --rate --scenario examples/scenarios/gtp-exhaustion-hypothetical.json` 대 `gtp-regeneration-hypothetical.json` (가상 값).

### 소진 시험 (Survival-to-Exhaustion)
- `node dbtool.mjs simulate "시트르산 회로" --rate --scenario examples/scenarios/tca-acetylcoa-exhaustion-hypothetical.json --until-death` — 유한 저장소에서 회로를 정지까지 돌리고 사후 분석(정지 시각·원인·제한 요인·완료 바퀴·폐기물·소비/생산 비)을 낸다. 제한 요인은 Resource_Gap/Kinetic_Gap 한계로 연결된다 (가상 값).

### 3 층 엔진 (형식 v8)
- 정의항마다 기본 층 `tier`(T1 연속 장 / T2 규칙 행위자), Tier 1 환경(pH·유전율)과 전이 상태 이론 k(r), ΔG° 로 정해지는 역 상수(미시적 가역성), 닫힌 고리 ΣΔG° = 0 감사(AUDIT_THERMO).
- 실행 층 `engine/hmse.js`: 정수 원장·인접 경계 거래(두 원장만 잠금)·이동량 표본(포아송·나머지 이월)·영역 점수와 히스테리시스. 인터페이스 `engine/interfaces/hmse.{hpp,py}`, 스키마 `schemas/v8/`, 설계 `docs/design/hybrid-multiscale-engine.md`.

### 실행 층 P3
- `node tests/p3_end_to_end.js` — 3차원 FV 영역(T3) + 규칙 노드(T2, SSA + τ-도약/CLE)를 Parallel-DEVS 로 결합해 10,000 단계, 원장·경계 버퍼 질량 보존을 콘솔에 출력 (`engine/devs_scheduler.js`, `engine/fv_solver.js`).

### 실행 층 P4
- `node tests/p4_benchmark.js` — 스펙트럼 신경 연산자 대리 모델(FV 궤적에서 학습, O(N log N), Δt 무관) 대 P3 FV 의 속도·L2 오차. 강성 영역(FV 부분 단계 ≳ 70)에서 11–56×, 비강성에서는 더 느림.
- `node tests/p4_end_to_end.js [--fallback worker]` — 대리 모델 영역 + T2 노드 10,000 단계, 디랙 충격을 같은 단계에서 탐지해 FV(인라인/일꾼)로 대체, |ΔN| = 0.

### 실행 층 P5
- `node tests/p5_dynamic_promotion.js` — 확산 계수 일정으로 강성(N_sub)이 오르내리는 영역 + T2 노드 10,000 단계. 관문이 강성 구간(N_sub 76)에서만 대리 모델로 승격(≈ 10–15×), 비강성·히스테리시스·적대적 교대 구간은 FV(≈ 1×), 충격은 같은 단계 강등 + 20 단계 냉각, |ΔN| = 0, 장–원장 ≤ 1e-15.

### 외부 ID 원본 대조 (자동 보강 고리)
- `node dbtool.mjs augment plan | fetch | build | apply` — unmapped·Identity_Gap·대조 안 된 UniProt·ChEBI 를 원본에서 받아(`data/fetched/`) 번호·종·이름·중복·화학식 ↔ 부분 구조로 확인한 것만 verified 로 병합. 네트워크가 막히면 `data/fetched/RETRIEVAL_TASKS.md` (수동 수집 과제).

### 비교 검토·정제 점검
- `node dbtool.mjs compare --state <세포 상태> --scenario A.json [--scenario-b B.json | --patch p.json]` — 복잡도·수치 L2·결과를 나란히, 판정 Optimization-Negative 이면 종료 코드 1.
- `node dbtool.mjs validate <patch.json>` → `node dbtool.mjs augment apply <patch.json>` — 관문 + 정제 점검(중복 규칙·화학량 모순) 후 병합·CHANGES·limitations.md·부록 자동 갱신.

### 세포 운명 (v9)
- `node dbtool.mjs fate "활성화된 CD8 T 세포" --scenario examples/scenarios/fate-effector-il12-hypothetical.json` — 신호(IL-12/IL-15) → 대사(해당과정/β-산화) → 전사 인자(T-bet/Eomes) 다중 속도 적분(P5 관문), 결정 시점(신호 철회 시험), 분화 정지 사후 분석. 시나리오 8개(`fate-*-hypothetical.json`, 가상 값).
- `node tests/fate_suite.js` — Fate-Test 30 검사: 계통 충실도, 경쟁, 결정 비가역성, 포도당·지방산 결핍 분화 정지, 포도당 결핍 → 다른 운명(기억 전구), 수렴 기준 대비 L2·속도 향상, 질량. 설계 `docs/design/cell-fate-engine.md`.

### 교과서
구조·저장 방식·알고리즘·상호작용·출력 해석·AI 작업 절차는 [`docs/textbook/`](docs/textbook/00-목차.md). 파일마다 저장 분류는 [`storage-map.json`](docs/textbook/storage-map.json), 지금 값은 자동 생성 부록.

## 매핑 규칙 요약 (자세히는 SCHEMA.md)

- **통제 어휘** (`vocab.js`): kind·분야·위치(3D/2D, 막 면, 특수 위치의 부모)·막 결합 방식·부위 종류·특징·변화 종류·활성·종(NCBI)·조직·세포·관찰 속성·근거 수준은 목록의 값만. 별칭은 표준 값으로 바뀐다.
- **이름 하나 = 개념 하나**: 띄어쓰기·하이픈·대소문자·그리스 문자 차이를 없앤 이름이 두 개념을 가리키면 오류. 새 이름이 기존 별칭과 같으면 기존 개념으로 합쳐진다.
- **참조는 번호로 저장**: 패치에서 이름·영문명·`이름#n`·`CHEBI:…`·지문으로 가리켜도 병합 때 정의항 번호로 바뀐다. 뜻이 여러 개인 이름은 거부.
- **번호 재사용 금지**: 지운 번호는 영구 결번. 이름을 바꾸면 옛 이름은 별칭으로 남는다.
- **외부 ID·구조 지문·잔기 번호**: 형식·kind 검사, 같은 ID·지문 중복 금지. 모르면 지어내지 말고 `unmapped`·`residue_unknown`.
- **종**: 정의항의 기준 종은 하나(단백질·핵산은 필수, 기본 사람 9606). 종마다 다른 값은 `obs` 에 `context.species` 와 함께.
- **구조**: 구성 요소는 복합체만, 부위의 `on` 은 구성 요소, 막 면은 그 막에 있는 면, 막 결합 분자는 2D 위치에만.
- **단계는 규칙의 적용**: 행위자 활성, 변화량 = 규칙 효과, 해리 구성 요소 개수, 수송 외 위치 변화 금지, 위치 조건, 공간 접촉.
- **관문**: 오류가 하나라도 있거나 패치가 새 경고를 만들면 패치 전체 거부. 통과한 패치는 `data/patches/` 에 매핑 결과와 함께 기록.

규칙은 `tests/rules.test.mjs`(73개)가 지키고, GitHub Actions 가 푸시마다 테스트와 전체 검사를 돌린다.

## 사용법

### 화면
`index.html`(= `viewer.html`), `vocab.js`, `core.js` 를 같은 폴더에 두고 브라우저로 연다.
웹 서버로 열면 `data/db.json` 을 자동으로 읽고, 파일로 열었다면 **불러오기**로 고른다.

1. **AI 지침**: 자료를 넣고 복사 → AI 에게 준다. 규칙·어휘·현재 색인(부위·규칙·구성 요소 포함)·기존 단계가 함께 들어간다.
2. **AI 결과 반영**: AI 가 준 JSON 을 붙여 넣으면 매핑 결과와 규칙 위반이 바로 보인다. 위반이 있으면 반영 버튼이 잠긴다.
3. **검사**: 전체 규칙 검사 + 매핑 현황(외부 ID 대조 여부, 미매핑 목록).
4. 화면에서 반영한 것은 브라우저에만 남는다. 저장소에 넣으려면 **저장**한 파일로 `data/db.json` 을 바꾸거나 AI 에이전트에게 병합을 맡긴다.

### 명령줄 (Node 18+) — AI 에이전트용

```sh
node dbtool.mjs status                          # 규모·오류 수·다음 번호
node dbtool.mjs map "adenylyl cyclase" 효소#2 CHEBI:15422   # 이름·외부 ID → 정의항 번호
node dbtool.mjs prompt [자료.txt]                # AI 작성 지침
node dbtool.mjs merge patch.json --dry          # 관문 통과 여부만 확인
node dbtool.mjs merge patch.json                # 병합 + data/patches/ 기록
node dbtool.mjs context PKA                      # 정의 맥락·구조(구성 요소·부위·규칙)·기전 참여
node dbtool.mjs mechanism "에피네프린에 의한 글리코겐 분해"
node dbtool.mjs mechanism S000009 --up 3 --down 3
node dbtool.mjs simulate <경로> --until D… --from D…   # 규칙대로 발화시켜 도달·유도 확인
node dbtool.mjs limitations [--open|--write|--detect]  # 한계 등록부
node dbtool.mjs pattern <경로|상위 개념>              # 상위 패턴·사례 경로
node dbtool.mjs resolution <경로>                     # 혼합 해상도 계획 (R0·R1·R2, 전환 문턱)
node dbtool.mjs simulate <경로> --rate --scenario s.json [--reservoirs finite|infinite] [--stochastic --seed N]   # 속도 기반 시뮬레이션 (저장소·공급·분해)
node dbtool.mjs audit-run <경로> [--scenario s.json]  # 감사 (Audit Error + 교정 제안)
node dbtool.mjs textbook [--write|--check]             # 교과서 부록 생성·검사 (파일 분류 포함)
node dbtool.mjs audit                           # 매핑·채움 현황 (미매핑, 잔기 모름, 지문 없음)
node dbtool.mjs vocab locations actions         # 통제 어휘 보기
node --test tests/*.test.mjs                    # 규칙 테스트
```

## 파일

| 경로 | 내용 |
|---|---|
| `data/db.json` | 데이터베이스 원본 (형식 v7) |
| `examples/scenarios/` | 속도 기반 시뮬레이션용 가상 시나리오 (지식이 아님) |
| `limitations.md` | 한계 등록부 (data/db.json 에서 생성, 직접 고치지 않음) |
| `data/patches/` | 병합된 패치 기록 |
| `vocab.js` | 통제 어휘(위치·특징·종 …)·외부 ID 형식·관계의 kind 제약 |
| `core.js` | 매핑·검사·관문·색인 (브라우저와 Node 공용) |
| `dbtool.mjs` | 명령줄 도구 |
| `viewer.html`, `index.html` | 화면 |
| `SCHEMA.md` | 규칙 명세와 변경 기록 |
| `docs/textbook/` | 교과서 (00-목차부터), storage-map.json, 자동 생성 부록 |
| `migrations/` | 형식 변환 스크립트, 옛 ID ↔ 번호 대응표 |
| `tests/` | 규칙 테스트 |
| `examples/` | 패치 예시 (`pgm-isomerization.json`: 원천이 규칙을 소유하고 단계는 규칙 참조 + 묶음, 이름·별칭이 번호로 매핑되는 예) |
| `FEATURES.md` | 특징 층·가설 층 설계 (가설 층은 아직 구현 전) |
| `DESIGN-v4.md` | 형식 v4 설계 배경: 원천(정의항) 중심 소유, 위치 의존 기전, 종 |

## 아직 안 된 것

- **외부 ID 원본 대조**: 지금 ID 는 모두 `asserted`. UniProt·ChEBI 등에 접속해 확인하고 `verified` 로 바꾸는 명령은 아직 없다.
- **구조 지문 계산**: 필드와 검사는 있지만 값은 아직 없음. RDKit 등으로 계산하는 도구가 필요하다.
- **가설 층**: [`FEATURES.md`](FEATURES.md) 에 설계만 있음. (특징은 v4 에서 정의항의 부위·규칙·관찰로 구현됨)
- **3차원 구조**: 부위·막 위상·구성 요소는 있지만, PDB 구조 참조·좌표·결합/충돌의 물리 결과는 아직 없음.
- **수송 단계 예시**: 수송 효과와 검사는 있지만 저장소에 수송 단계는 아직 없음.
- **저장 방식**: 지금은 JSON 파일 하나. 구조 데이터가 들어오면 SQLite 로 옮길 계획.
