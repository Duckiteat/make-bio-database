# 스키마와 매핑 규칙 (형식 버전 9)

이 데이터베이스는 AI가 채운다. 규칙 없이 쌓이면 같은 개념이 여러 이름으로 생기고, 값이 제각각이 되어 연결이 끊긴다.
그래서 **모든 입력은 패치 → 매핑 → 검사 → 관문**을 거치고, 하나라도 어기면 패치 전체가 거부된다.

```
AI 패치 ──▶ 매핑 (임시 번호·이름·별칭·"이름#n"·외부 ID·지문·어휘 별칭·묶음 객체 → 표준 값)
        ──▶ 검사 (아래 규칙 전부)
        ──▶ 관문 (매핑 오류·검사 오류 0, 새 경고 0) ──▶ data/db.json + data/patches/ 기록
```

| 파일 | 내용 | 누가 바꾸나 |
|---|---|---|
| `vocab.js` | 통제 어휘(종류·분야·위치·막 면·특징·변화 종류·종·조직·관찰 속성 …), 외부 ID·지문 형식, 관계의 kind 제약 | 사람이 검토 후 |
| `core.js` | 매핑·검사·관문 로직 | 사람이 검토 후 (테스트 필수) |
| `tests/rules.test.mjs` | 규칙이 실제로 거부하는지 확인하는 테스트 | 규칙을 바꿀 때 함께 |

AI 패치는 데이터(`terms`, `senses`, `steps`, `remove`)만 바꿀 수 있고 어휘·규칙은 바꿀 수 없다.

## 0. 두 해상도

| | 지식 해상도 — 정의항(D, 원천) | 시뮬레이션 해상도 — 묶음(B)·단계(S, 결과) |
|---|---|---|
| 담는 것 | 가능한 가장 높은 구조적 진실: 구성 요소(소단위·보조인자), 막 위상, 부위(종별 잔기 번호, 막 면, 리간드), 규칙, 설명, 관찰 | 의미 있는 변화만: 어느 부위가 어떤 특징을 갖고 어디에 있는가 |
| 작성 원칙 | **완전성·구조적 깊이 우선** — 구성 요소를 빠뜨리지 않는다. 모르는 값은 `residue_unknown`·`unmapped` 로 명시하고 지어내지 않는다 | **효율·참조 무결성 우선** — 라벨·설명문·중복 구조를 넣지 않는다 |
| 형태 | 하위 번호를 가진 객체 (`D…/site/키`, `D…/rule/키`, `D…/desc/n`, `D…/obs/n`) | 묶음 = 파생 키 `D…|부위:특징|…|위치`, 단계 = "이 규칙이 이 묶음들에 적용됨" |

**규칙**이 두 해상도를 잇는다. 상태 의미 규칙은 묶음의 특징 조합이 원천에게 무엇을 뜻하는지(활성), 전이 규칙은 원천이 일으키는 변화량을 정한다.
단계는 규칙을 가리키기만 하고, 검사가 단계의 묶음이 그 규칙과 맞는지 확인한다.

## 1. 식별자: 의미 없는 고정 번호

| 대상 | 번호 | 예 |
|---|---|---|
| 개념 (피정의항, 이름 묶음) | `T` + 6자리 | `T000042` |
| 정의항 (뜻, 원천) | `D` + 6자리 | `D000044` |
| 정의항의 하위 항목 | `D…/site/키`, `D…/rule/키`, `D…/desc/n`, `D…/obs/n` | `D000044/site/reg_phos` |
| 묶음 (파생 키, 번호 아님) | `D…|부위:특징|…|위치` | `D000044|reg_phos:phosphorylated|cytosol` |
| 기전 단계 | `S` + 6자리 | `S000009` |

- **모든 참조는 번호로 저장한다.** 연결 `to`, 구성 요소 `ref`, 부위 `on`·`ligand`, 규칙의 `target`·`partner`·`consumes`·`produces`, `part_of` 는 정의항 번호(D…).
- **번호에는 의미를 넣지 않는다.** 이름·분류·기능처럼 바뀔 수 있는 정보가 번호에 들어가면 지식이 바뀔 때 번호도 바뀌어야 한다.
- **번호는 다시 쓰지 않는다.** `meta.next` 가 다음 번호를 배정하고 줄어들지 않는다. 지운 번호는 영구 결번이다. 검사는 `meta.next` 가 쓰인 번호보다 큰지 확인한다.
- **이름을 바꿔도 번호와 연결은 그대로다.** 옛 한국어 이름은 자동으로 별칭에 남는다.
- **사람용 꼬리표**: 뜻이 하나인 개념은 `이름`, 여러 개면 `이름#n`(n = 개념 안 뜻 번호, 바뀌지 않음).
- 부위·규칙 키는 영문 소문자·숫자·`_` (`reg_phos`, `gs_gef`). 잔기 번호 같은 종 의존 값은 키에 넣지 않는다(`Ser14` 는 `numbering` 에).
- 패치 안의 새 항목은 임시 번호(`T+1`, `D+gp`, `S+1` …)를 쓰고, 병합 때 실제 번호가 배정된다. 기존 번호를 쓰면 그 항목을 고치는 것이고, 없는 번호는 거부된다.

### 개념과 정의항 (예: 글리코겐 인산화효소)

```json
"terms":  { "T000042": { "names": { "ko": "글리코겐 인산화효소", "en": "glycogen phosphorylase" }, "aliases": ["포스포릴레이스"] } },
"senses": { "D000044": {
  "term": "T000042", "n": 1, "kind": "molecule_class",
  "xrefs": [{ "db": "EC", "id": "EC 2.4.1.1", "status": "asserted" }],
  "desc": [{ "text": "글리코겐 말단의 …", "field": "생화학", "context": { "scope": "생화학 (글리코겐 대사)" },
             "links": [{ "to": "D000009", "rel": "is_a", "span": "효소" }], "evidence": { "level": "asserted" } }],
  "site": { "reg_phos": { "type": "modification_site", "features": ["phosphorylated"], "numbering": { "9606": "Ser14" } } },
  "rule": [
    { "id": "a_form", "type": "meaning", "label": "a형(인산화) — 활성", "when": { "reg_phos": "phosphorylated" }, "activity": "active" },
    { "id": "b_form", "type": "meaning", "label": "b형(비인산화) — 부분 활성", "when": {}, "activity": "partial" },
    { "id": "phosphorolysis", "type": "transition", "label": "글리코겐 가인산분해", "action": "가인산분해", "agent": true,
      "effect": { "type": "convert", "consumes": ["D000047"], "produces": ["D000048"] }, "with": { "consumes": ["D000037"], "produces": [] },
      "regulators": [{ "ref": "D000046", "effect": "inhibits" }] } ],
  "obs": [] } }
```

## 2. 이름 매핑 (하나의 이름 = 하나의 개념)

**정규화**: 유니코드 NFKC → 소문자 → 그리스 문자를 이름으로(β→beta) → 공백·하이픈·괄호·점·쉼표 등 제거.

- 정규화한 이름(`names.ko`, `names.en`, 별칭) 하나는 데이터베이스 전체에서 **개념 하나만** 가리킨다. 겹치면 오류.
- 패치의 새 개념 이름(ko 또는 en)이 기존 이름과 같으면 **기존 개념으로 매핑**되고 새 별칭·영문명만 더해진다.
- 패치의 새 별칭이 다른 개념의 이름이면 거부. 이름에 `#` `@` `|` `/` 금지.
- 이미 뜻이 있는 개념에 새 뜻을 더하려면 `distinction`(기존 뜻과의 차이)이 필수. 없으면 거부.
- 정의항을 다른 개념으로 옮길 수 없다.

**참조 매핑** (패치 안에서만, 저장 전에 번호로 바뀜): 정의항 번호 → 임시 번호 → 개념 번호(뜻이 하나일 때) → `이름#n` → 외부 ID(`CHEBI:15422`) → 구조 지문 → 이름·별칭.
가리키는 개념의 뜻이 여러 개면 거부하고 후보를 보여 준다. 없는 이름이면 거부하고 비슷한 이름을 제안한다.
단, 정의항의 `term` 에 없는 이름을 쓰면 그 이름으로 새 개념이 만들어진다.

## 3. 통제 어휘

| 필드 | 표 (`vocab.js`) |
|---|---|
| 정의항 `kind` | `kinds` |
| 설명 `field` | `fields` |
| 설명·관찰 `context.species` / `tissue` / `cell`, `reference_species`, 잔기 번호의 종 | `taxa` (NCBI Taxonomy 번호, 계층) / `tissues` / `cells` |
| 묶음의 위치, 막 위상 `membrane.location`, 규칙 `where`·수송 `from`/`to` | `locations` |
| 막 위상 `membrane.side`, 부위 `face` | `faces` |
| 막 위상 `membrane.association` | `associations` |
| 부위 `type` | `siteTypes` |
| 부위 `features`, 묶음의 `부위:특징`, 규칙 `when`·`add`·`remove` | `features` |
| 전이 규칙 `action` | `actions` (허용 효과와 반드시 더하거나 빼는 특징 포함) |
| 상태 의미 `activity` | `activity` |
| 조절자 `effect` | `effects` |
| 관찰 `property` | `obsProperties` (값 종류·단위·종 필수 여부) |
| 근거 `level` | `evidenceLevels` |

패치에서는 표의 별칭도 쓸 수 있다(`phosphorylation`, `cytoplasm`, `biochemistry`, `활성`, `human` …). 병합 때 표준 키로 바뀐다.
목록에 없는 값은 거부되고 가까운 값을 제안한다. 목록에 값을 추가하는 것은 사람이 `vocab.js` 를 고쳐서 한다.

## 4. 종류(kind) 규칙

- **참여자 종류**(protein, complex, nucleic_acid, small_molecule, macromolecule, ion, molecule_class)만 묶음의 바탕이 되고, 막 위상·부위·규칙을 가질 수 있다.
- 구성 요소(`components`)는 `complex` 만 가지며, 구성 요소는 참여자 종류여야 한다. 구성 요소가 없는 복합체는 경고.
- 단계의 `part_of` 대상은 `pathway` 정의항이어야 한다.
- 관계의 kind 제약 (`vocab.js` 의 `relationRules`, has_* 는 방향을 뒤집어 같은 표로 검사):
  - `is_a`: 분자 → 같은 kind 또는 molecule_class / molecule_class → molecule_class / pathway → pathway·process / process → process·concept / structure_feature → structure_feature·concept / principle → principle·concept / concept → concept
  - `part_of`: 분자·structure_feature → 분자 / pathway → pathway / process → process·pathway
  - `instance_of`: is_a 와 같음 / `requires`·`contrasts`·`refers`: 제약 없음
- 구성 요소는 색인에서 `has_part` 위계로도 보인다(맥락 탐색용). 경로의 단계 범위 계산에는 들어가지 않는다.

## 5. 종 (기준 종과 관찰)

- 정의항 하나에 **기준 종 하나**(`reference_species`). protein·nucleic_acid 는 필수(패치에서 생략하면 9606 사람), small_molecule·macromolecule·ion·principle 은 금지, 나머지는 선택.
- 종마다 다른 값(Km, 발현, 다른 종의 대응 ID …)은 새 정의항이 아니라 `obs` 에 `context.species` 와 함께 적는다. 종 의존 속성은 `context.species` 필수.
- 잔기 번호는 부위의 `numbering: { "종 번호": "Ser14" }` 로 종마다 적는다.
- 정체성 자체가 다르면(다른 유전자 산물, 다른 구성) 새 정의항. 부분적인 차이는 규칙·부위의 `taxa` 조건으로 둔다.

## 6. 구조 (지식 해상도)

### 막 위상 `membrane`
- `association`: soluble | integral | peripheral | lipid_anchored.
- 막 결합(soluble 이 아님)이면 `location` 은 2D 위치(막). peripheral·lipid_anchored 는 붙은 면 `side` 가 필요하다. soluble 에는 location·side 를 두지 않는다.

### 위치 (`vocab.js` 의 `locations`)
- 3D(부피)와 2D(막 표면). 2D 위치는 `sides`(막 면 → 그 면이 맞닿은 3D 위치)를 가진다. 특수 위치는 `parent`(예: 글리코겐 과립 ⊂ 세포질, 지질 뗏목 ⊂ 세포막).
- 수용성 분자의 묶음은 3D 위치에만, 막 결합 분자의 묶음은 자기 막(또는 그 하위 위치)에만 있을 수 있다.

### 부위 `site`
- `{ type, features, numbering | residue_unknown, on, face, ligand, note, taxa }`.
- `features`: 이 부위가 가질 수 있는 특징. 묶음에서 한 부위는 특징 하나.
- 단백질·핵산의 **수식 부위**는 기준 종 잔기 번호가 필요하다. 모르면 `residue_unknown: true` 로 명시한다(지어내지 않음).
- `on`: 복합체에서 그 부위가 실제로 있는 구성 요소. `face`: 막 결합 분자에서 그 부위가 향한 면(그 막에 있는 면이어야 함). `ligand`: 결합 상대(분자 정의항).

### 설명 `desc`
- `{ text, field, context: { scope, species, tissue, cell, condition }, genus, links, examples, evidence, note, by, at }` — 맥락별 설명을 여러 개 둘 수 있다.
- 연결의 `span` 은 그 설명 문장 속 구절을 원문 그대로. 문장에 없으면 오류, 없으면 경고(`contrasts`·`requires` 제외).

### 근거 `evidence`
- `{ level, sources: [{ db: "DOI"|"PMID", id, citation: "저자, 연도" }], basis, tool, confidence, note }`
- **curated**: 실제로 확인한 문헌만. DOI 또는 PMID + citation 필수. **인용을 지어내지 않는다** — 식별자를 확인하지 못하면 curated 로 쓰지 않는다.
- **abstracted** = `[Abstracted Logic: Derived from the inferred mechanistic flow]`: 문헌이 직접 말하지 않고 기전 흐름에서 추론한 주장. 무엇에서 추론했는지 `basis` 필수.
- computed(도구 `tool` 필수) | asserted(출처 없이 적은 일반 지식) | predicted(0–1 `confidence` 필수).

## 7. 규칙 (두 해상도의 다리)

### 상태 의미 `type: "meaning"`
- `{ id, label, when: { 부위: 특징 }, activity }`. 위에서부터 차례로 보아 **첫 번째로 맞는 규칙**이 그 묶음의 활성이다. `when` 이 비면 기본값(맨 아래에 둔다).
- `when` 의 부위·특징은 그 정의항에 정의된 것이어야 한다.

### 전이 `type: "transition"`
- `{ id, label, action, agent, via_site, via_component, effect, with, regulators, where, taxa, text, evidence }`.
- `agent: true` 면 소유자(규칙을 가진 정의항)가 행위자로 단계에 들어가야 한다. `via_site`·`via_component` 는 행위가 일어나는 소유자의 부위·구성 요소.
- `effect`:

| type | 필드 | 뜻 |
|---|---|---|
| `modify` | `target`(생략하면 소유자), `site`, `add`, `remove`, `partner` | 대상 부위의 특징 변화 (각각 하나까지). `partner` 는 그 부위에 흡수되는 결합 상대 |
| `convert` | `consumes`, `produces` | 기질 → 생성물 |
| `dissociate` / `associate` | `complex`(생략하면 소유자), `partner`, `partner_site: { component, sites }` | 복합체 ⇄ 구성 요소. 결합 상대가 흡수되는 구성 요소의 부위들 |
| `transport` | `target`, `from`, `to` | 위치 변화 — 위치를 바꾸는 유일한 방법 |
| `transfer` | `partner`(리간드), `from_site`(소유자 부위), `target`, `site` | 리간드를 소유자의 부위에서 대상의 부위로 넘김 (LBP → CD14 → MD-2) |
| `degrade` | `complex`, `component`, `produces` | 복합체의 한 구성 요소를 분해 산물로 바꾸고 나머지 구성 요소를 풀어 줌 (IκBα 분해 → NF-κB) |

- `effect.requires: [{ ref, site, feature }]` — 전제 조건. 입력 묶음(ref 생략 = 대상/복합체)이 이미 그 특징을 가져야 한다 (예: Ser32·Ser36 인산화된 IκBα 만 βTrCP 가 유비퀴틴화).

- `action` 은 어휘의 허용 효과만 쓸 수 있고, `adds`·`removes` 가 정해진 action(인산화 +phosphorylated, 탈인산화 −phosphorylated, 뉴클레오타이드 교환 −GDP_bound +GTP_bound)은 그 특징을 반드시 더하거나 뺀다.
- `with`: 보조 기질·생성물(ATP→ADP 등). `regulators`: `[{ ref, effect, note }]` — 단계의 조절자는 여기 정의된 것만. `where`: 규칙이 작동하는 위치(부모 위치에서 성립해도 특수 위치로 자동 상속되지 않음).

## 8. 묶음과 기전 단계 (시뮬레이션 해상도)

- 묶음 키: `바탕 D|부위:특징|…|위치`. 특징은 부위 이름순으로 정렬한 표준 형식이어야 한다. 빈 특징(비수식형)은 아무것도 적지 않는다.
- 단계: `{ rule: "D…/rule/키", agents, inputs, outputs, regulators, part_of }`. 참여자 `{ b: 묶음 키, n, minor }`. 단계에는 라벨·설명문·위치를 따로 두지 않는다(규칙과 묶음에 있다).
- 패치에서는 참여자를 `{ ref, features: { 부위: 특징 } | ["부위:특징"], location, n, minor }` 로 써도 되고, 병합 때 묶음 키로 바뀐다. `rule` 도 `{ owner, id }` 로 쓸 수 있다.
- **검사**
  1. 규칙은 원천의 전이 규칙이어야 한다.
  2. 행위자: `agent` 규칙이면 소유자의 묶음이 agents 에 있고, 소유자의 상태 의미 규칙상 **비활성이 아니어야** 한다.
  3. 변화량 = 규칙 효과: modify 는 대상의 입력·출력 묶음이 정확히 하나씩, 규칙의 부위만 `remove → add` 로 바뀐다. convert 는 기질·생성물, 해리·결합은 **구성 요소 개수**(복합체 정의 × 개수)와 결합 상대가 흡수된 부위(`partner_site`)를 확인한다. 결합 상대는 출력에 따로 남지 않는다.
  4. 위치: 수송이 아닌 단계에서 대상의 위치가 바뀌면 오류. 수송은 `from → to` 와 일치, 특징은 그대로.
  5. 위치 조건(`where`)과 **공간 접촉**: 반응 중심(행위자, 없으면 대상)과 모든 참여자가 맞닿을 수 있어야 한다. 3D–3D 는 같은 부피(또는 부모·자식), 2D–3D 는 그 막 면이 맞닿은 부피(작용 부위의 `face` 로 판정), 2D–2D 는 같은 막이면서 작용 면과 붙은 면이 같아야 한다.
  6. 보조 기질·생성물, 조절자는 규칙에 정의된 것만.
  7. **동일성 보존**: 결합(상대 흡수)·해리·결합체 형성·전달·분해·수송 단계는 입력과 출력의 실체가 같아야 한다. 묶음은 복합체 → 구성 요소(재귀), 리간드가 정해진 부위가 채워져 있으면 그 리간드(부위가 구성 요소 위면 그 개수만큼, 리간드가 복합체면 그 구성 요소)로 펼쳐 센다. 행위자와 보조 기질(`with`)은 빼고, 분해는 분해된 구성 요소와 분해 산물을 뺀다.
- **사슬 연결**: 한 단계의 출력 묶음 키가 다른 단계의 입력·행위자·조절자 묶음 키와 같으면 이어진다. `minor`(부산물)는 잇지 않는다.

## 8A. 시뮬레이션 (`node dbtool.mjs simulate <경로> --until D… --from D…`)

- 경로의 단계를 규칙 그대로 발화시켜 묶음 풀의 변화를 따라간다. 단계 순서대로, 한 라운드에 행위자(촉매) 수만큼·입력이 허락하는 만큼 발화.
- 시작 풀: 어떤 단계도 만들지 않는 묶음(원천)은 `--amount`(기본 10), 부산물·보조 기질로 쓰이는 묶음(ATP 등)은 넉넉히. 순환 안에서만 만들어지는 휴지 상태(Gs[GDP], 빈 LBP …)는 가장 상류의 순환부터 하나씩 자동 보충하고 출력에 밝힌다.
- 목표(`--until`)에 도달하면 그 묶음을 처음 만든 단계에서 거꾸로 유도 경로와 뿌리(원천 묶음)를 찾고, `--from` 이 뿌리에 있는지 확인한다. 도달하지 못하거나 유도되지 않으면 종료 코드 1.
- `--init "묶음키=N;…"` 으로 시작 양을 바꾼다 (음성 대조: `--init "D000064|extracellular=0"` → LPS 없으면 TNF 전사 없음).
- 속도·농도는 다루지 않는 이산(토큰) 시뮬레이션이다.

## 8B. 한계 등록부 (Limitation & Constraint Registry) — 형식 v5

실패를 일시적 오류로 버리지 않고, 다음 버전의 요구 사항으로 남긴다. 모든 한계는 `[Target | Type | Requirement]` 구조의 데이터(`limitations`, 번호 `L…`)다.

```json
{ "id": "L+1", "target": "TNF 유전자/rule/kb_binding", "type": "Kinetic_Gap",
  "requirement": { "text": "무엇이 모자라 무엇을 못 하는지",
                   "needs": [ { "kind": "obs", "property": "Kd", "on": "TNF 유전자", "cell": "macrophage", "location": "nucleoplasm" },
                              { "kind": "residue", "site": "TAK1/site/act" },
                              { "kind": "xref", "db": "PDB", "on": "마이도솜" },
                              { "kind": "manual", "text": "어휘·형식이 아직 없는 요구" } ] },
  "found_in": "어디서 드러났나 (시뮬레이션·변환·시연)", "resolution": { "note": "…", "evidence": { … } } }
```

- **Target**: 정의항 `D…`, 그 부위 `D…/site/키`·규칙 `D…/rule/키`, 또는 단계 `S…`. 패치에서는 이름도 된다(`TAK1/site/act`).
- **Type** (`vocab.js` 의 `gapTypes`): `Kinetic_Gap`(속도·Kd·시간 상수) · `Concentration_Gap`(몰 농도·부피·질량 수지) · `Structural_Gap`(3차원 좌표·위상·잔기·화학량) · `Resource_Gap`(재생·공급 경로나 속도가 없어 저장소가 고갈되는 곳 — 사후 분석의 제한 요인) · `Identity_Gap`(unmapped 필수 외부 ID — 해결 경로 `xref`, 어휘에 없는 ID 체계면 `manual`).
- **Requirement**: 사람이 읽는 `text` + 기계가 확인하는 해결 경로 `needs`.
  - `obs`: 그 정의항에 그 관찰(세포·위치 맥락)이 들어오면 충족 · `residue`: 그 부위에 기준 종 잔기 번호가 들어오면 충족 · `xref`: 그 외부 ID 가 붙으면 충족 · `manual`: 형식으로 확인할 수 없는 요구 — `resolution` 으로만 닫힘.
- **상태는 저장하지 않고 계산한다**: needs 가 모두 충족되면 `resolved`, manual 이 resolution 으로 닫히면 `resolved_manual`, 아니면 `open`.
- `limitations.md` 는 이 데이터에서 생성된다(`node dbtool.mjs limitations --write`). CI 가 최신인지 검사한다. `--detect` 는 등록되지 않은 한계 후보(잔기 모름 부위)를 찾는다.
- 시뮬레이터는 기본값·무한 풀로 시작량을 정한 묶음을 표시하고, 그 경로의 Concentration_Gap 이 등록되어 있지 않으면 등록하라고 알린다.

## 8C. 상위 개념 (Evolution Engine)

- **Step A — 아래에서 위로 추상화**: kind `process` 정의항에 `motif`(경로에서 찾는 패턴, `core.js` 의 `MOTIFS`)를 주면 그 정의항은 실행 가능한 상위 개념이 된다. 사례 경로는 링크로 저장하지 않고 매번 계산한다 — 새 경로도 자동으로 잡힌다. `node dbtool.mjs pattern <경로|상위 개념>`.
  - 패턴: receptor_signaling · ligand_relay · receptor_clustering · scaffold_assembly · second_messenger · kinase_cascade · gtpase_timer · inhibitor_degradation_release · nuclear_translocation_transcription · membrane_to_nucleus
- **Step B — 한계에서 나온 확장**: 한계를 해결하는 새 개념은 `addresses: [{ limitation: L…, how }]` 로 어떤 한계를 어떻게 해결하는지 적는다. 해결하지 않는 상위 개념은 `gap_review` 에 이유를 적는다 — motif 정의항은 둘 중 하나가 없으면 거부된다.
- **구획 농도 모델**(principle): 시뮬레이터가 시작량을 데이터에서 정한다 — 정의항의 `copy_number` 관찰(세포·위치 맥락), 없으면 `concentration` × 구획 부피(`compartment_volume`, 구획 농도 모델 정의항이 세포·위치별로 소유) × 아보가드로 수. 둘 다 없으면 기본값이고 출력에 "농도 공백"으로 표시된다. 관찰 맥락에는 `context.location` 을 쓸 수 있다.

## 8D. 혼합 해상도와 반응 속도 — 형식 v6

### 해상도 (`vocab.js` 의 `resolutionLevels`·`resolutionThresholds`)
모든 것을 3차원으로 다루지 않는다. 단계마다 필요한 해상도를 전환 문턱으로 계산하고 갖춘 해상도와 비교한다 (`node dbtool.mjs resolution <경로>`).

| 해상도 | 담는 것 | 언제 |
|---|---|---|
| R0 위상 | 위치·상태(묶음 키) | 풀 안의 분자, 수송, 부위 없는 변환 |
| R1 부위 | 이름 붙은 부위·특징·잔기 번호·막 면 | **T1** 부위 사건(site·from_site·partner_site·via_site·requires), **T2** 구성 요소 화학량(결합체 형성·해리·분해) |
| R2 구조 | 반응 중심 부위의 3차원 구조 참조 `site.structure: { db: "PDB", id, chain, residues }` | **T3** 같은 묶음을 두 단계 이상이 소비하는 경쟁 — 속도 상수가 있으면 R1 에서 해결, 없을 때만 구조가 필요 |

- 하향 전환(반응 중심 → 풀): 바뀐 부위는 묶음 키의 `부위:특징`으로 남아 무손실이고, 수송·해리는 특징 보존 검사를 받는다.
- 해상도 일관성: 부위의 구조 참조는 정의항 `xrefs` 의 같은 PDB 여야 한다. 좌표 자체는 저장하지 않고 구조 데이터베이스를 가리킨다.

### 반응 속도 `rule.kinetics`
```json
{ "law": "binding", "k_on": 1e6, "k_off": 1e-3, "Kd": 1e-9, "context": { "species": "9606" }, "evidence": { … } }
```
- 값은 SI 정준 단위만: `k_on` M⁻¹s⁻¹, `k_off`·`kcat` s⁻¹, `Kd`·`Km` M, `mass_action` 의 `k` 는 M^(1−order)·s⁻¹.
- 법칙(`kineticLaws`): `mass_action`(k, order — 차수 = 반응물 분자 수 + 행위자 수) · `binding`(k_on·k_off 또는 Kd — 두 분자 결합만) · `michaelis_menten`(kcat·Km — 행위자가 있는 규칙만).
- 속도 무결성: Kd 와 k_off/k_on 이 10% 안에서 맞아야 하고, 차수·분자 수·효소 조건이 맞아야 한다. 근거(evidence)는 다른 근거와 같은 규칙.
- 한계 해결 경로 `{ kind: "kinetics", rule: "D…/rule/키", params: ["Kd"] }` — 규칙에 그 상수가 들어오면 자동 resolved.

### 속도 기반 시뮬레이션과 감사
- `node dbtool.mjs simulate <경로> --rate [--scenario s.json] [--t 60] [--dt 0.001]`: 농도 = 분자 수 / (N_A × 반응 부피), 속도 법칙을 dt 마다 적분. 속도 상수가 없는 단계는 즉시(사건 기반)로 처리하고 보고한다. 막(2D) 분자는 인접 3D 부피의 농도로 환산한다(한계 등록).
- 시나리오(`examples/scenarios/*.json`): 부피·시작량·속도 상수를 덧씌우는 시험용 층. `hypothetical: true` 면 출력에 가상 값임을 표시하고, 데이터베이스에는 들어가지 않는다.
- `node dbtool.mjs audit-run <경로> [--scenario s.json]`: 감사 오류(Audit Error)
  - `AUDIT_SCHEMA` 저장소 검사 · `AUDIT_RESOLUTION` 필요 해상도 > 갖춘 해상도, 2D 환산 · `AUDIT_KINETIC` 속도 무결성, 평형(닫힌 결합에서 [A][B]/[AB] ≈ Kd) · `AUDIT_KINETIC_GAP` 속도 상수 없음 · `AUDIT_CONCENTRATION` 반응 부피 없음 · `AUDIT_MASS` 질량·동일성 보존(대사물 풀과 주고받은 양까지 계산; 변환·분해되는 실체 제외)
  - 모든 감사 오류는 한계 등록부에서 찾은 교정 제안을 단다. 맞는 한계가 없으면 등록할 형식을 제안한다. 감사 오류가 있으면 종료 코드 1.

## 8E. 생애 주기와 대사물 저장소 — 형식 v7

물질은 만들어지고, 소비되고, 분해되고, 돌아온다. v7 은 이것을 규칙 두 종류와 부분 구조 수지로 표현하고, 시뮬레이터가 매 Δt 질량을 감사한다.

### 규칙 종류 (`vocab.js` 의 `ruleTypes`)
| `type` | 소유자 | 무엇 | 누가 적용 |
|---|---|---|---|
| `meaning` | 분자 종류 | 부위:특징 조합 → 활성 | 행위자 검사·화면 |
| `transition` | 분자 종류 | 변화 (효과 7종) | 단계(S)가 참조 |
| `supply` (**Metabolic_Supply_Rule**) | 아무 정의항 (경로·과정·효소 부류 …) | 저장소의 소비 → 생성 | 시뮬레이터가 전역으로, 매 Δt |
| `degradation` (**Degradation_Rule**) | 분자 종류 (분해되는 쪽) | 그 정의항의 묶음이 1차로 분해 | 시뮬레이터가 묶음마다, 매 Δt |

경로·과정·원리 정의항은 `supply` 규칙만 가질 수 있다. 단계는 `transition` 규칙만 참조한다.

### 공급 규칙
```json
{ "id": "gtp_regeneration", "type": "supply", "label": "GTP 재생",
  "consumes": [{ "ref": "GDP", "n": 1 }, { "ref": "ATP", "n": 1 }], "produces": [{ "ref": "GTP", "n": 1 }, { "ref": "ADP", "n": 1 }],
  "where": ["cytosol"], "kinetics": { "law": "mass_action", "k": …, "order": 2, "evidence": { … } }, "evidence": { … } }
```
- `where` 는 부피(3D) 위치 정확히 하나 — 저장소 묶음 = `정의항|위치`.
- 속도 법칙은 `zero_order`(k, M·s⁻¹ — 소비가 없는 공급) 또는 `mass_action`(차수 = 소비 분자 수). `zero_order` 는 공급 규칙에만.
- 소비가 없거나 부분 구조가 맞지 않는 공급(계 밖에서 들어오는 원료)은 `source: true` 로 명시해야 한다.

### 분해 규칙
```json
{ "id": "turnover", "type": "degradation", "label": "TNF mRNA 분해", "fate": "recycled",
  "recycle_to": [{ "ref": "뉴클레오타이드", "n": "sequence_length", "location": "nucleoplasm" }],
  "when": { "부위": "특징" }, "where": ["nucleoplasm"],
  "kinetics": { "law": "mass_action", "order": 1, "half_life": 1800, "evidence": { … } } }
```
- `fate` (`lifecycleFates`): `lost` 계 밖으로(질량 감사의 소실 원장) · `recycled` 구성 단위가 저장소로(`recycle_to` 필수).
- `recycle_to[].n` 은 양수 또는 `"sequence_length"` (그 정의항의 `sequence_length` 관찰을 읽음 — 없으면 시뮬레이터가 그 단위를 소실로 처리하고 감사에 보고).
- 속도는 1차(`mass_action`, order 1): `k`(= k_deg, s⁻¹) 또는 `half_life`(s). 둘 다 있으면 k = ln2 / t½ 가 10% 안에서 맞아야 한다. 한계 해결 경로에서 `k` 와 `half_life` 는 서로를 대신한다.
- `when` 이 있으면 그 부위:특징을 가진 묶음만, `where` 가 있으면 그 위치의 묶음만 분해된다. 복합체 안의 구성 요소는 분해되지 않는다(묶음의 바탕이 소유자일 때만).

### 부분 구조 `moieties` 와 특징별 리간드 `site.ligands`
- 정의항 `moieties: [{ ref: 구조 요소(structure_feature) 정의항, n: 정수 }]` — 원자 대신 반응에서 깨지지 않는 부분(아데노신·구아노신·인산기 단위)을 센다. 분자 종류만.
- **부분 구조 수지 (검사)**: `convert`·`degrade` 효과는 보조 기질(`with`)까지 합쳐, `supply` 규칙은 소비·생성 사이에서 부분 구조가 같아야 한다 (예: ATP → cAMP 만으로는 인산기 3 → 1 — 피로인산을 산물에 적어야 통과). 어느 쪽에도 부분 구조가 선언되지 않은 분자는 0 으로 센다.
- 부위 `ligands: { 특징: 정의항 }` — 특징마다 다른 리간드(예: Gs 뉴클레오타이드 부위 GDP_bound → GDP, GTP_bound → GTP). 질량 감사는 채워진 부위의 리간드를 실체로 센다. 수식 규칙이 리간드를 바꾸면(GTP → GDP) 그 리간드는 화학 변환 실체로 본다.

### 대사물 저장소 (Metabolic Reservoir)
- 보조 기질·부산물(minor)·`with`·만들어지지 않는 변환 기질 묶음, 그리고 켜진 공급 규칙·재활용이 닿는 묶음 = 저장소.
- 방식(`reservoirModes`): `finite`(기본) — 단계가 소비하면 줄고, 공급·재활용이 채운다. 바닥나면 그 단계는 멈춘다(오류가 아니라 결과). `infinite` — v6 동작(양 고정, 교환 원장).
- 시작량: 시나리오 `reservoirs` / `amounts` → 데이터(copy_number, 또는 concentration × compartment_volume) → 기본값(1000, 농도 공백 표시).
- 공급 규칙은 시뮬레이션의 묶음에 닿으면 켜지고, 그 규칙의 다른 분자도 저장소가 된다(닫힌 집합이 될 때까지). 속도 상수나 부피가 없으면 적용하지 않고 보고한다.

### 속도 기반 시뮬레이션 (v7) — 매 Δt 순서
1. 반응 단계 (유한 저장소면 저장소 입력도 화학량대로 소비; 비가산 입력은 속도 법칙에, minor 입력은 한도로만)
2. 공급 규칙
3. 분해 규칙 — 결정론 N(1 − e^{−kΔt}) 또는 `--stochastic` 이항 분포(`--seed` 고정)
4. 전역 질량 감사 — 실체: 시작 + 생성 − 소멸(분해·재활용·공급 합성) (+ 무한 풀이면 교환) = 지금, 부분 구조: 시작 + 공유 결합 수식·계 밖 공급·소실·재활용 = 지금
5. 고갈·재생 사건 — 저장소가 1 분자 아래로 내려가면 `exhausted`, 다시 올라오면 `regenerated`; 저장소 때문에 덜 일어난 단계는 `stalled`

단계마다 국소 수지도 첫 발화 때 검사한다: 단계 한 번의 실체 Δ(그 규칙의 화학 실체 제외)와 부분 구조 Δ(공유 결합 수식이면 공유 결합 경로로 기록). 결과에는 묶음별 원장 Δ(반응·공급·분해·재활용), 저장소 표(시작·끝·최소·분류 closed | consumed_only | produced_only | idle), 저장소 분자 사이의 순환 성분(강하게 연결된 성분)이 붙는다.

### 정지까지 실행과 사후 분석 (Survival-to-Exhaustion)
- 단계 순환: 저장소가 아닌 비가산 묶음으로 이어진 단계 고리(SCC). 완료한 바퀴 = ⌊min(고리 단계들의 누적 진행량)⌋.
- 정지: 창(`window`, 기본 1 s) 동안 1 바퀴 미만(회로가 없으면 1 분자 미만) 또는 `death_frac` > 0 이면 최고 속도의 그 비율 미만 — 단, 한 바퀴 이상 돈 뒤에만. `until_death`(`--until-death`)면 정지 확인 시 실행을 멈춘다.
- 사후 분석 `postMortem`: `cause` exhaustion(감시 단계 입력 저장소 < 1 분자) | equilibrium(가역 단계 역/정 > 0.5) | intermediate_drained | kinetic_stall · `t_death`(고갈 시각, 아니면 마지막 바퀴 시각) · `last_turn` · `limiting{bundle, starved, regeneration}` · `bottleneck{sid, ratio}` · `cycles[{steps, completed}]` · `firstToZero`(끝까지 0 인 입력) · `waste`(생성만 되는 저장소 + 입력으로 안 쓰이는 산물) · `dp`(저장소 순소비 ÷ 순생산, 폐기물 포함). AUDIT_RESOURCE 로 보고하고 Resource_Gap(고갈) / Kinetic_Gap(평형·속도) 한계를 교정 제안.
- 적분 안정성: 속도 법칙 단계가 한 Δt 에 입력의 20% 넘게 쓰려 하면 AUDIT_KINETIC (Δt 를 줄여 결과가 같은지 확인).

### 감사 코드 (v7 추가·변경)
- `AUDIT_MASS` — 국소(단계·첫 발화 시각) · 전역(실체·부분 구조, 처음 어긋난 시각) · 음수 저장소(엔진 오류)
- `AUDIT_RESOURCE` — 소비만 되고 재생 경로가 없는 저장소(켜진 공급·재활용 없음), 재활용 화학량(서열 길이)을 모름
- `AUDIT_CONCENTRATION` — 저장소 시작량이 기본값
- `AUDIT_KINETIC_GAP` — 속도 상수가 없어 적용하지 않은 공급·분해 규칙도 보고

## 8F. 3 층 다중 규모 엔진 — 형식 v8

설계: `docs/design/hybrid-multiscale-engine.md` (§A 층, §B 불변식). 실행 층 참조 구현: `engine/hmse.js`, 인터페이스: `engine/interfaces/hmse.{hpp,py}`, 통신 스키마: `schemas/v8/*.schema.json`. 행정부 → 사법부 원자료 계약(FFI): `schemas/ffi/fate-raw.schema.json` — JS·Rust 어느 운명 엔진이든 이 모양을 내고(`irHash` = 먹은 IR 의 sha256, `engine` = js | rust 포함), `judicial/contract.js` 가 검사한다(위반이면 판정 거부). 운명 IR 은 `compiler/ir_builder.js`(형식 `definition-db-fate-ir` v3 — 활성 규칙 전체의 `jac.active`·`jac.S`, 희소 LU 기호 분석 `jac.lu`(순서·채움·연산 수, `compiler/sparse_lu.js`)·J 항 값 위치 `jac.scatter`, 테이프 명령표 `compiler/tape.js`), 결합점(`hill_s_floor`, 결합 Rodas3 단계 제어 `integrator.*`, 희소 LU 피벗 문턱 `integrator.pivot_rel`)은 `engine/coupling.js`. 경로 속도 시뮬레이션(`simulateRate`)의 IR 은 `compiler/rate_ir.js`(형식 `definition-db-rate-ir` v1, 원자료 `irHash`). 원자료의 적분 기록은 `integrator`(받아들인·거부한 단계, h 범위, Δ 당 단계 수)와 `trajectory[].steps·rejects`. 이식 계획 `docs/design/engine-port-roadmap.md`.

| 필드 | 위치 | 규칙 |
|---|---|---|
| `tier` | 정의항 | 분자 종류 필수 `T1`(연속 장: 저분자·이온·고분자·대사물 부류) \| `T2`(규칙 행위자: 단백질·복합체·핵산·효소 부류). 저분자·이온·고분자 → T1, 단백질·복합체·핵산 → T2 가 병합 기본값, 분자 부류는 명시. T1 은 부위를 갖지 못함. `T3` 는 영역 상태라 정의항에 쓸 수 없음. 그 밖의 kind 는 두지 않음 |
| `diffusion_coefficient` | 관찰 | SI `m^2/s` 만, `context.location` 필수, 양수 |
| `pH` · `ionic_strength`(M) · `relative_permittivity` | 관찰 (보통 구획 농도 모델 정의항) | `context.location` 필수 — Tier 1 환경 장. pH 0–14 |
| `k0`, `dG_act` | 규칙 kinetics | 전이 상태 이론: 함께 적음, dG_act ≥ 0 (J/mol). k 도 있으면 k ≈ k0·e^{−dG_act/RT} (10%, T_ref 310.15 K) |
| `dG0` | 규칙 kinetics | 표준 반응 자유 에너지 (J/mol, 음수 가능). 가역 mass_action 의 k/k_r ≈ e^{−dG0/RT} (10%) — **미시적 가역성** |
| `env { pH_ref, dG_dpH, eps_ref, dG_dinv_eps }` | 규칙 kinetics | ΔG_env = dG_dpH(pH − pH_ref) + dG_dinv_eps(1/ε − 1/eps_ref). 기준 속도가 있을 때만 |

- 시뮬레이터: mass_action 규칙에 k0·dG_act·dG0·env 가 있으면 구획 환경(시나리오 `environment[위치] = { pH, relative_permittivity }` → 관찰)으로 k 를 계산하고, dG0 가 있으면 k_r = k·e^{dG0/RT} 로 정해 가역으로 돌린다 (환경은 장벽만 옮기고 평형은 옮기지 않음).
- `audit-run`: **AUDIT_THERMO** — 경로의 단계 순환 중 순 화학량이 0 인 닫힌 고리에서 ΣdG0 ≠ 0 (허용 `vocab.thermo.loop_tolerance` J/mol) — Wegscheider 조건 위반.
- 실행 상태(영역·원장·경계 거래·영역 점수)는 데이터베이스가 아니라 시나리오 `domains`(domain-config 스키마)와 실행 층(`engine/hmse.js`)에 둔다 — 지식과 실행 상태를 섞지 않는다.

## 8G. 세포 운명 층 — 형식 v9

설계: `docs/design/cell-fate-engine.md`. 실행: `engine/fate_engine.js` (`node dbtool.mjs fate <세포 상태> --scenario s.json`). "운명 = 상태 전이": 세포 상태는 표지 서명으로 정의되고, 신호 → 대사 → 전사 인자 사슬(조절 규칙)이 상태를 옮긴다.

| 필드 | 위치 | 규칙 |
|---|---|---|
| kind `cell_state` | 정의항 | 분자가 아닌 상태 — 규칙·부위·부분 구조·구성 요소·층 없음. `signature` 필수. 외부 ID 는 `CL`(Cell Ontology, `CL:0000000`)만 |
| `signature: [{ ref, level, location }]` | cell_state | 표지 분자(분자 종류) · 수준 `high | low`(`signatureLevels`) · 위치 — 수용성 분자는 부피(3D), 막 분자는 그 분자가 박힌 막(2D, 예: 세포 표면 펩타이드–MHC). 같은 묶음 두 번 금지. 문턱 값(분자 수)은 시나리오 `thresholds[묶음] = { high, low }` |
| `metabolome: [{ ref: "D…/rule/키", level }]` | cell_state | 그 상태의 대사 프로그램 — 공급 규칙(supply)만. 수준은 기록용(속도는 조절 규칙과 시나리오가 정함) |
| `mechanisms: [{ ref }]` | cell_state | 그 상태에서 돌아가는 기전 경로(kind `pathway`) — 그 경로에 속한 단계(S 의 `part_of`)가 운명 엔진의 반응 규칙이 된다. 단계가 없는 경로는 거부 |
| `transitions: [{ to, signals, commitment: { criterion }, text, evidence }]` | cell_state | `to` 는 cell_state, `signals` 는 분자 종류(하나 이상), `criterion` = `withdrawal`(신호 철회 시험 — 비가역 결정) \| `threshold`(표지 문턱 도달) (`commitmentCriteria`) |
| 규칙 `type: modulation` | 분자 종류 정의항 (조절자) | `{ target: "D…/rule/키", effect: activates | inhibits, at: 3D 위치, via: [D…], kinetics: { law: hill, K, n, fmax | fmin } }`. 대상은 supply · transition · degradation, 자기 자신 금지. 조절자 묶음 = `소유자|at`, 배율: 활성화 f = 1 + (fmax − 1)·sⁿ/(Kⁿ + sⁿ) (fmax > 1), 억제 f = fmin + (1 − fmin)·Kⁿ/(Kⁿ + sⁿ) (0 ≤ fmin < 1). 여러 조절은 곱한다. `via` 는 생략한 매개 분자(출처) |
| 속도 법칙 `hill` | kinetics | 조절 규칙에만, 조절 규칙은 hill 만. `K`(M) > 0, `n` > 0. 활성화에 fmin, 억제에 fmax 를 두지 않음 |
| 공급 소비 `saturating: true` | supply 의 consumes 항목 | 포화 보조 기질 — 화학량대로 소비(수지·원장)하지만 질량 작용 차수에서 빠진다. 속도에는 c/(c + K_sat) (K_sat 기본 1 µM, 시나리오 `saturation_K`) — 바닥날 때 속도를 끄는 수치 정칙화. 생성물에는 못 쓰고, 모든 소비가 포화일 수는 없음 |
| `elements: { C, N, P, S … }` | kind structure_feature | 그 부분 구조가 분자 안에서 기여하는 원자 수(원소 기호 → 0 이상 정수). 자동 보강의 화학식 대조가 읽는다 — 엔진 코드에 화학을 두지 않으려고 데이터에 |
| 한계 종류 `Regulatory_Gap` | 한계 | 신호 전달·유전자 조절 매개를 조절 규칙 하나로 묶었거나 힐 상수를 모르는 곳. `detectGaps` 가 힐 상수 없는 조절 규칙을 후보로 잡는다 |

- `simulateRate`(경로 시뮬레이션)도 조절 규칙을 적용한다 — 단계·공급·분해의 속도에 배율을 곱하고, 힐 상수가 없으면 배율 1 로 두고 `modulationGaps` 로 보고.
- 운명 엔진(시나리오 층, 데이터베이스 밖): `volumes` · `amounts` · `buffered[묶음] = { conc_M, total }`(완충 저장소 — 남은 양이 한 구획분 이상이면 농도 고정, 질량은 정확히 줄어듦 — 배지 + 수송체 근사) · `signals[묶음] = [{ t, n }]`(경계 조건 — 질량 감사 밖) · `thresholds` · `kinetics` · `dt_slow`(관찰 격자 Δ — 신호·기록·탐침 스냅숏 간격, 적분 오차와 무관) · `t_end` · `integrator { rtol, atol, h0, h_min, safety, fac_min, fac_max, neg_shrink }`(결합 Rodas3 단계 제어, 기본은 결합점 등록부) · `commitment { horizon, coarse }` · `arrest_window` · `target` · `stochastic { seed, ssa_max, ode_min, fast, hysteresis, leap_eps, atol, ssa_tol }`(4단계 ④ — 있으면 혼성 확률 실행, seed 는 입력 해시에; 궤적 번호는 조정자가 준다) · `expect { final, limiting, commit_before_h }`(실행 전에 적은 가설 — 과정 보고서가 관찰과 대조) · `exclude_rules [규칙 ref]`·`rule_scale { 규칙 ref: 배율 }`(교란 결과 필드 — 손으로 쓰지 않고 `compiler/perturb.js` 가 기준 시나리오에서 만든다: knockout = 시작량 0 + 생성 규칙 제외 + 신호 0, block = 규칙 제외, inhibit = 속도 × 1/(1+dose/Ki), clamp = 완충 저장소. 컴파일러가 IR 에 반영하고 사법부 `derivative` 가 같은 배율로 법칙을 재구성) · `protocol { question, matched_experiment { source(DOI·PMID), system { species, cell, condition }, readout_times_s }, controls { negative(필수), positive, baseline }, perturbations [{ type, target }], readouts [{ observable { kind, target }, time_s }], replicates { n, effect_size, sd, alpha, power }, validation [O…], equivalence [{ observable, delta, scale, evidence }], stopping { fixed_n: true } }`(모의 실험 규약 — 검증에 쓰는 실행에만, `perturbations` 의 type 은 knockout·block·inhibit·clamp·dose_series(`compiler/perturb.js`), 시나리오 전체를 `register` 로 실행 전에 사전 등록, 판정 `judicial/protocol.js`. 최상위 `equivalence` 는 쓰지 않음) · `report { ratios: [[묶음, 묶음]] }`(시계열에 함께 보일 비율; 경쟁 계통 표지 비율은 자동). **파생 시나리오**(build-plan 9): `{ base: '같은 폴더의 기준.json', perturbation: { 교란 하나 }, name?, context?, expect?, hypothetical?, _설명? }` — 교란 실험은 복사본이 아니라 기준 + 교란 한 줄. 그 밖의 필드는 거부(교란 외의 차이를 숨길 자리가 없게), 기준은 파생이 아니어야 함(한 단계). `compiler/perturb.js derive` 가 풀고 dbtool(`fate`·`observe`·`compare`)이 같은 폴더의 기준을 읽어 넘긴다. 규약(`protocol`)은 파생 시나리오에 둘 수 없다(등록 해시가 db 에 따라 풀린 결과로 바뀌므로 — 검증 실행은 풀린 시나리오로).
- **과정 분석 보고서** (`judicial/process_report.js`, `dbtool fate` 의 기본 출력): 엔진이 매 관찰 격자 단계 기록하는 원자료(사법부 `judicial/verifier.js` 가 독립 재계산) — 부분 구조 원장 편차·저장소 재생 편차(모든 묶음 = 시작 + Σ 화학량 × 규칙 누적 진행량, double-double)·신호 값·규칙 누적 진행량·Δ 당 적분 단계 수·궤적 해시 — 로 변곡점·구간·무결성 증명서(원장·재생 ≤ 1e-14 매 단계, 신호 = 일정, 결정론, 매개변수 출처, 음수 없음)·인과 추적·예측과의 차이를 만든다.
- **부분 구조 수지 허용 오차**: 규칙 검사(`moietyImbalance`)와 운명 엔진 원장 모두 상대 1e-14 (`MASS_REL_TOL`). 운명 엔진은 상태·원장·합계를 보상 산술(TwoSum·TwoProduct, double-double)로 셈해 실제 편차는 ≈ 1e-27.
- **정제 점검 `refineCheck`**: duplicate_rule(같은 화학량·위치의 공급 / 같은 소유자·대상·효과·위치의 조절 — 참조 없는 쪽을 지우는 리팩터링 패치 제안) · lumped_contradiction(경로가 가진 공급 규칙 ↔ 그 경로 단계들의 화학량 합; 그 규칙을 대상으로 한 열린 Structural_Gap 이 있으면 known). `validate <patch>`·`augment apply` 는 새로 생긴 duplicate 나 known 이 아닌 모순이 있으면 거부.
- **비교 검토 `judicial/compare.js`** (`dbtool compare`, 변형 실행은 `orchestrator.js`): 판정 Optimization-Negative(비용 ↑, 수치 이득 < 1e-5 또는 궤적 차 < 1e-5) · Optimization-Positive · Neutral · Trade-off · Behavior-Changing(결과가 바뀜 — 관찰로 고름).
- 감사: `AUDIT_FATE`(목표 상태 도달 실패 — 사후 분석 원인 resource_exhaustion | signal_insufficient | antagonist_dominance | alternative_fate | kinetic_stall, 제한 묶음, 교정 제안), `AUDIT_MASS`(부분 구조 원장 — 매 느린 단계), `AUDIT_RESOURCE`(소비만 되는 저장소), `AUDIT_CONCENTRATION`(부피·문턱 없음).

## 8H. 관찰 기록 — 형식 v10

실측값은 모델 표현이 아니라 **무엇을 쟀는가**로 저장한다. 표현(묶음 나열 → 규칙 기반, 매개 단계 세분)이 바뀌어도 다시 잴 필요가 없게 하기 위해서다. 설계와 원칙은 `docs/design/observation-port.md` 에 있다.

- **최상위 `observations`**: `{ O000001: {...} }`. 번호는 `meta.next.O` 로만 배정하고, 패치에서는 임시 번호 `O+1` 을 쓴다.
- **필드**
  - `observable { kind, target, param?, denominator?, also? }`: 측정량(`vocab.observables`). 대상은 종류에 따라 다름 — amount·concentration 은 묶음 키, fraction·event_time 은 cell_state 정의항, kinetic_constant 는 `D…/rule/키` 와 `param`, `ratio` 는 두 묶음의 몫(target/denominator, 무차원 unit 1 — 정규화 밴드·활성 분율·fold-change), `fraction_above` 는 게이팅 문턱(threshold, 분자 수) 이상인 실행의 비(%양성, 앙상블 평균이 0–1). `also`(묶음 키 목록)는 측정이 못 가르는 형태를 합산한다(amount·concentration·ratio 분자·fraction_above).
  - `value`·`unit`: SI 정준 단위만. 단위는 molecule · M · 1 · s, 속도 상수는 `vocab.kineticUnits` 를 따르고 k·k0·k_r 은 `M^(1−order) s^-1`.
  - `uncertainty { kind: measurement | biological | combined, model: normal | lognormal | poisson, sd ≥ 0 }`: 필수. 값만 있는 관찰은 받지 않는다. poisson 은 amount 에만, lognormal 은 값 > 0 에만.
  - `replicates`(1 이상의 정수), `precision`·`detection_limit`·`saturation`(선택, 0 이상). 검출 한계 아래 값은 상한 검정, 포화 상한 위 값은 하한 검정 — 장치의 눈먼 곳을 판정에 담는다(`judicial/obs_compare.js`). 정성 관찰 `readout.instrument_resolution`(선택, 0 이상)은 측정이 가르는 최소 차이로, 모의 분해능 바닥(수치 오차 + 양자)을 그 값까지 올린다.
  - `condition { species(필수), location, cell, temperature_K, pH, time_s, states:[묶음 키] }`.
  - `calibration { kind: identity | linear(a, b) | table(points) }` + `raw`: 값은 `compiler/obs_operator.js` 로 다시 계산되어 `value` 와 같아야 한다(상대 1e-12). 표의 범위 밖이면 거부.
  - `provenance.sha256`(원본 파일), `method`, `note`.
  - `use: estimation | validation`: 추정에 쓴 관찰을 검증에 쓰지 않는다.
  - `evidence`: curated(문헌) 또는 computed(포트 변환 도구)만.
- **합성 관찰 금지**: `hypothetical: true` 는 거부한다. 합성 관찰은 `examples/observations/` 에만 둔다.
- **변경 불가**: 관찰 기록은 바꾸거나 지울 수 없다. 기존 번호에 할 수 있는 것은 `retracted { note, evidence }` 를 한 번 더하는 것뿐이다. 관문(`judicial.observationImmutability`)이 병합 결과 전체를 비교해서 입법부를 우회한 변경도 잡는다.
- **실측 상수 = 관찰의 파생값 (`rule.kinetics.from: [{ param, obs }]`)**
  - 참조한 관찰은 같은 규칙·같은 칸을 같은 값으로 잰 `estimation` 용도의 철회되지 않은 기록이어야 한다.
  - 근거가 curated 인 속도 상수는 order 를 뺀 모든 칸에 `from` 이 있어야 한다.
  - `lumped: true`(매개 단계를 생략해 맞춘 상수)는 원 관찰 참조(`from`)가 필수이고, 값 대조는 하지 않는다. 기전을 세분하면 다시 재는 것이 아니라 원 관찰에서 다시 계산한다.
- **계약**: 포트 입력의 모양은 `schemas/obs/observation.schema.json`(`judicial/contract.js checkObservation`)이 검사하고, 의미는 관문(`judicial.validateObservation`)이 검사한다.
- **한계 종류 `Observation_Gap`**: 오차 막대로 경쟁 가설을 가를 수 없거나 판정할 관찰이 없는 곳.
- 정의항의 `obs`(D…/obs/n — 서열 길이·국재 같은 정의 속성)는 그대로 둔다. 엔진·사법부가 쓰는 수치 측정은 관찰 기록으로 넣는다.

## 9. 외부 ID

| kind | 필수 | 허용 |
|---|---|---|
| protein | UniProt | UniProt, PDB, EC, NCBIGene |
| small_molecule · macromolecule · ion | ChEBI | ChEBI (+ PubChem) |
| complex | – | GO, PDB, EC |
| molecule_class | – | ChEBI, EC, GO |
| pathway | – | GO, Reactome, KEGG |
| process | – | GO |

- 형식은 `vocab.js` 의 정규식으로 검사한다. 같은 외부 ID 는 정의항 하나에만 붙는다.
- **추측 금지**: 필수 ID 를 확실히 모르면 `unmapped` 에 사유를 적는다. 사유가 있으면 통과하고 `audit` 목록에 남는다.
- `status`: `asserted`(적었지만 원본과 대조 안 함) / `verified`(원본과 대조함 — **사법부 증명 도장 필수**: `attestations/registry.json` 에 그 정의항·DB·번호의 유효한 도장이 없으면 `validate(db, { attestations })` 오류. 지문의 `status: verified` 도 같다).
- **증명 등록부** `attestations/registry.json` = `{ format: 'definition-db-attestations', version: 1, stamps: [{ subject: { sense, field: 'xref'|'fingerprint', ns, value }, claim: 'verified', evidence: { kind, key, file, sha256 }, checks, issuer: { module, code_sha256 }, issued_at, digest }] }` — digest = 나머지의 정준 JSON sha256. 검증 = digest · 증거 파일 sha256 · 같은 확인 재실행. 쓰기는 입법 서기만 (`docs/design/tripartite-governance.md` §3).
- **원본 대조 = 자동 보강 고리** (`node dbtool.mjs augment plan | fetch | build | apply` — 확인 `judicial/identity.js`, 초안 `legislative/augment_draft.js`, 받기·저장 `legislative/clerk.mjs`): 원본 응답을 `data/fetched/` 에 그대로 두고, 번호·종(기준 종)·이름(개념 이름·별칭)·중복·화학식(C·N·P·S 원자 수 = 선언된 부분 구조의 원자 수)을 확인한 것만 `verified` 로 올리며 `note` 에 조회 날짜·파일·sha256 을 적는다. 함께 넣는 것: 단백질 `sequence_length` 관찰(근거 computed)·`SEQ_SHA256` 지문(computed), 저분자 InChIKey(verified). 이름 검색은 이름이 정확히 하나로 맞을 때만 고르고, 아니면 unmapped 를 두고 Identity_Gap 의 `note` 에 후보를 적는다. 다른 값의 asserted 는 `--sync` 없이는 바꾸지 않는다. 네트워크가 막히면 `data/fetched/RETRIEVAL_TASKS.md`(수동 수집 과제). 모든 Patch Report 의 Verification 에 '자동 보강 후보' 수가 나온다.
- 효소 번호는 활성을 가진 정의항에 둔다(예: PKA 의 EC 는 전효소가 아니라 촉매 소단위에).

## 10. 구조 지문 (fingerprint)

구조에서 계산되는 **정체성 키**. 참조에는 쓰지 않고(참조는 번호), 중복 차단과 정확 일치 검색에 쓴다.

| 방식 | kind | 값 |
|---|---|---|
| `InChIKey` | small_molecule, ion, macromolecule | 표준 InChIKey |
| `SEQ_SHA256` | protein, nucleic_acid | 정규 서열(대문자, 공백 제거)의 SHA-256 |
| `COMPLEX` | complex | `CPX(구성지문x개수+…)` — 구성 요소를 정렬해 이은 것 |

- 같은 지문은 정의항 하나에만 붙는다. `status`: `computed`(도구로 계산) / `asserted` / `verified`.
- 저분자는 생리적 pH(7.3)의 주 이온 형태를 대표로 하고, 입체이성질체가 생화학적으로 구별되면 별개 개체로 둔다. 단백질은 정규 서열 기준이며, 인산화형 같은 변화는 지문이 아니라 묶음의 특징으로 표현한다.
- 지문은 AI가 머릿속으로 계산하지 않는다. 도구(RDKit·InChI 등)가 계산해 `computed` 로 넣는다.

## 11. 패치 형식

```json
{ "format": "definition-db-patch", "version": 4,
  "terms":  [ { "id": "T+1", "names": { "ko": "…", "en": "…" }, "aliases": [] } ],
  "senses": [ { "id": "D+1", "term": "T+1", "kind": "…", "reference_species": "9606", "membrane": {}, "xrefs": [], "unmapped": "…",
                "components": [], "desc": [ { "text": "…", "field": "…", "context": { "scope": "…" }, "links": [] } ],
                "site": {}, "rule": [], "obs": [] } ],
  "steps":  [ { "id": "S+1", "rule": "D…/rule/키", "agents": [], "inputs": [], "outputs": [], "regulators": [], "part_of": [] } ],
  "remove": [ "번호" ] }
```

- 기존 정의항을 고치면 **패치에 적은 최상위 필드만** 교체된다. 적지 않은 필드는 유지. 배열·객체 필드(`desc`, `site`, `rule` …)는 통째로 바뀌므로 유지할 항목도 함께 적는다.
- `remove` 에 개념 번호를 주면 그 개념의 뜻도 모두 지워진다. 뜻을 모두 잃은 개념도 지워진다.
- 이전 형식(v2·v3) 패치(`terms` 가 객체, `definientia`, `states`)는 거부된다.
- 예: `examples/pgm-isomerization.json`.

### Patch Report (v7 확장)
- 패치 최상위 `why`(문자열) — `dbtool merge` 에서 필수. 없으면 거부.
- `merge` 는 `patchReport(이전 db, 병합 결과, 패치, 관문)` 로 계산한 보고서를 출력하고 기록 `data/patches/…json` 의 `report` 에 저장한다:
  `{ scope: { files, added, updated, removed (종류별), fields: { 번호: [바뀐 최상위 필드] } }, why, impact: { rules, senses, steps, pathways(상위 경로 포함), limitations[{id,before,after}], limitation_status_changed, regenerate }, verification: { gate, errors, warnings, new_errors, new_warnings, undetected_gaps } }`
- 하류(impact) = 바뀐 정의항을 참조하는 다른 정의항의 규칙(효과·with·조절자·공급·재활용)·정의항(구성 요소·부분 구조·연결·리간드), 바뀐 정의항·규칙·묶음을 쓰는 단계, 그 단계의 경로와 상위 경로, 바뀐 것을 대상·해결 경로로 가진 한계.
- `undetected_gaps > 0` 이면 `dbtool merge` 가 거부한다 (`limitations --detect` 후보 0 이 병합 조건).

## 12. 관문

| 결과 | 처리 |
|---|---|
| 매핑 오류 또는 검사 오류가 새로 생김 | 거부 |
| 새 경고가 생김 (예: 근거 구절 없는 연결, 구성 요소 없는 복합체) | 거부 — `--allow-warnings`(화면에서는 체크) 로만 통과 |
| 바뀐 것 없음 | 저장 안 함 |
| 통과 | `data/db.json` 저장 + `data/patches/시각-이름.json` 에 패치와 매핑 결과 기록 |

## 13. 형식 버전과 변환

- `data/db.json` 의 `version` 이 `core.js` 의 `VERSION` 과 다르면 검사가 오류를 낸다.
- 형식을 바꿀 때는 `migrations/NNN-설명.mjs` 를 추가하고(v12 부터는 순수 `transform` 을 내보내는 CommonJS `.js` — 기원 체크포인트 뒤의 변환은 사건 사슬의 `migration` 사건으로 남고 재생 때 다시 돌린다), 그 스크립트로 저장소를 변환한 뒤 아래 변경 기록에 적는다.
- `data/patches/` 의 옛 기록은 당시 형식·ID 로 적혀 있다. 옛 ID ↔ 새 번호 대응은 `migrations/002-id-map.json`.

## 8K. 신뢰 지표 — 무엇을 무엇에 쓸 수 있는가 (`judicial/reliability.js`, `dbtool grade`)

값마다 **두 축을 독립으로** 계산한다. 점수를 데이터에 저장하지 않는다 — 도장·근거·관찰 기록에서 계산하므로 데이터가 스스로 등급을 올릴 수 없다.

| 축 | 값 | 어디서 계산되나 |
|---|---|---|
| S 출처 | 4 권위 DB + 유효한 사법부 도장 · 3 동료 심사 문헌 식별자(DOI·PMID) · 2 그 밖(출처 없음·추론·예측) · 0 확인 불가(도장 없는 verified·지난 도장·unmapped·철회) | 증명 등록부(`attestations/registry.json`)와 근거의 `sources` |
| D 성질 | 4 추적 가능한 실측·도구가 도장받은 원본에서 계산한 값 · 3 요약 상수·정체성 사실 · 2 추론·단순화·출처 없는 값 | 관찰 기록(v10 — 불확도·반복 수)·`evidence.level`·`tool` 의 sha256 |

- **곱(S × D)은 판정에 쓰지 않는다.** (2,4) 와 (4,2) 가 모두 8 이 되어 "출처가 약한 실측" 과 "권위 DB 에서 온 추론" 을 가르지 못한다. 보고서에 참고 숫자로만 적고, 관문은 쌍을 사전식으로 본다.
- 등급은 **권한의 이름**이다: `anchor` 기준값(S4 ∧ D4 ∧ 추세 일치 — 시뮬레이션의 고정점) · `parameter` 매개변수(S ≥ 3 ∧ D ≥ 3) · `bounded` 구간값(S4 ∧ D2 — 오차 막대와 함께) · `legacy` 지난값(추세 불일치 — 지우지 않고 비교에만) · `reference` 참고(계산 금지) · `blocked` 차단(한계로만).
- 추세 점검(시간 축)은 아직 없다 — 모든 항목의 `trend` 가 `unchecked` 이므로 **지금은 `anchor` 가 하나도 없다**. 추세 점검이 들어오면 날짜가 박힌 도장으로 기록한다(재현되지 않는 웹 검색 결과를 상태로 저장하지 않기 위해).
- `node dbtool.mjs grade [<D…>] [--min <등급>]` — 등급 분포·쌍 분포·항목별 표, `--min` 미달이 있으면 종료 코드 1.

### 관문 (②) — 시뮬레이션이 읽는 상수의 등급

쓸 수 있는가를 **쓰는 자리에서** 판정한다. 사법부는 엔진을 부르지 않고 쓰인 상수의 `src`·`evidence` 만 읽는다 (운명 경로는 IR 의 `rules[].k`·`mods[].k`, 속도 경로는 원자료의 `kinUsed[].kin`).

| 항목 | 규칙 |
|---|---|
| `src: 'data'` | 그 상수의 근거로 (S, D) 를 계산해 등급을 내고, **문턱 미달이면 Audit Error**(`AUDIT_KINETIC` · fault `DATA_GAP`) |
| `src: 'scenario'` | 시나리오가 준 값은 등급 밖(`hypothetical`) — 시나리오가 `hypothetical: true` 를 선언했을 때만 허용, 아니면 미달과 같이 거부 |
| 문턱 | 기본 `parameter`. 시나리오 `min_grade` 로 올릴 수 있다(등급 이름 하나). 모르는 이름이면 판정하지 않고 그 사실을 Audit Error 로 낸다 |
| 보고 | 과정 보고서의 무결성 증명서에 한 줄(상수 등급), §5 기술 부록에 분포. 운명 판정의 `grades` (`judicial/reliability.js` `constantVerdict`) |

지금 이 저장소의 규칙 `kinetics` 는 0건이다 — 확인한 속도 상수가 없으므로 모든 상수가 `hypothetical` 시나리오에서 온다. 그래서 `src: 'data'` 분기는 시험에서만 돌고, 확인된 상수가 들어오는 날 그대로 작동한다.

### 추세 축 (③) — 지금도 합의와 같은가 (`judicial/trend.js`, `dbtool trend`)

S·D 는 "그때 맞았다" 까지만 말한다. 등급 `anchor`(기준값)는 "지금도 합의와 같다" 를 요구하므로 **시간 축**이 하나 더 있다. 재현되지 않는 웹 검색 결과를 상태로 저장하는 대신, **같은 확인을 더 새 원본에 다시 돌린다**.

| 단계 | 하는 일 |
|---|---|
| 점검 대상 | 유효한 신원 도장(claim `verified`)이 있는 주체(외부 ID·지문)만. 도장이 없으면 S 가 이미 낮아 추세를 물을 자리가 아니다 |
| 합의 수신함 | `data/fetched/consensus/` — 같은 과제 이름 규약. 신원 수신함(`data/fetched/`)은 신원 도장의 증거이므로 **덮지 않는다**. 받기는 입법 서기(`dbtool trend --fetch`) |
| 판정 | 새 원본으로 신원 확인을 다시 돌려 같은 결론·같은 값이면 `match`, 결론이나 값이 달라지면 `mismatch`, 새 원본이 없으면 `unchecked` |
| 도장 | 날짜가 박힌 claim `trend` — 주체·판정·증거 파일 sha256·점검일·발급 모듈 코드 sha256·digest. 같은 등록부(`attestations/registry.json`)에 살지만 신원 도장과 다른 주장이라 검증 모듈이 다르다(`verifyTrendStamp`) |
| 만료 | 점검일이 합의 창(`vocab.consensus.window_days` = 365일)보다 오래되면 다시 `unchecked` — **`anchor` 는 영구하지 않다** |
| `mismatch` | 값을 지우지 않는다. 등급이 `legacy`(지난값, 비교에만)로 내려가고 `Consensus_Gap` 한계 후보가 된다 — 왜 달라졌는지(원본의 개정 / 우리 쪽 오류)가 데이터다 |

지금 분포: 주체 170 중 match 170 · mismatch 0 → **지문 70개가 `anchor`** (S4 ∧ D4 ∧ 추세 일치). 외부 ID 는 정체성 사실(D3)이므로 추세가 맞아도 `parameter` 가 상한이다.
추세 도장이 증명하지 못하는 것: 원본이 **실제로 더 새 것인지**는 바이트로 알 수 없다 (한계 L000085) — 그래서 창으로 만료시킨다.

## 8J. 외부 ID 의 역할 — ChEBI 규약 (형식 v10 확장, 2026-10-10)

ChEBI 에는 같은 물질에 세 종류의 항목이 있다 — 중성 모체(ATP CHEBI:15422, 전하 0), pH 7.3 우세 이온 종(ATP(4−) CHEBI:30616), 이온화 상태를 묶은 분류(succinate CHEBI:26806, 화학식 없음). 규약을 선언하지 않으면 셋이 섞이고, 분류 항목은 화학식이 없어 **부분 구조 대조가 조용히 건너뛰어진다**.

| 항목 | 규칙 |
|---|---|
| `xrefs[].role` (`xrefRoles`) | `physiological`(pH 7.3 우세 종 — **엔진·상호 운용이 읽는 단 하나**) · `parent`(중성 모체, 우세 종과 다를 때만) · `class`(단일 종이 없는 물질 — 중합체·불균일 물질) |
| 한 db 에 항목이 둘 이상 | 역할이 서로 달라야 하고, 그중 하나는 `physiological` 이어야 한다. 같은 번호를 두 번 적을 수 없다 |
| 분류 항목 | kind `small_molecule`·`ion` 에는 쓸 수 없다(거부). `macromolecule`·`molecule_class`(글리코겐·지질다당류)만 |
| 모체만 적힌 저분자 | 경고 — 반응 참여자(physiological)를 함께 적는 것이 규약 |
| 신원 확인 (`judicial/identity.js`) | `physiological` 주장은 두 가지를 통과해야 verified 가 된다: ① **켤레 관계** — 짝 역할 항목과 수소·전하만 달라야 함(H 차이 = 전하 차이, 무거운 원자 수는 같음; 짝 항목 파일이 수신함에 있어야 한다) ② **반응 참여** — 큐레이션된 반응 DB(Rhea)가 그 번호를 반응식 참여자로 3회 이상 씀(`rhea_usage` 과제, `data/fetched/rhea/*.tsv`) |
| 지난 도장 | 데이터에서 빠진 주체의 도장은 무효가 아니라 **지난 도장**(계보 기록)으로 센다 — `attest` 가 따로 보고하고 validate 의 오류가 아니다 |
| 재검증 범위 | 도장마다 **주체 하나만** 다시 본다 — 그 정의항만 새로 만든 얕은 겹침 사본과 그 과제 하나(`identity.plan(opt.only)`), 정규화·색인은 등록부 전체에 한 번(`validStamps`). 중복 검사는 전체 db 의 색인으로 하므로 좁혀도 약해지지 않는다 (측정: 등록부 341 도장 12.1 s → 0.32 s) |

## 8I. 기전 프로그램과 시나리오 맥락 — MHC 실험 (형식 v10 확장)

세포 상태가 표지의 근거를 가지려면 그 표지를 만드는 기전이 같은 계 안에서 돌아야 한다. `mechanisms` 로 경로를 걸면 그 경로의 단계(S)가 결합 적분(Rodas3) IR 의 반응이 된다 — 예전에는 공급·분해 규칙만 들어갔다.

| 항목 | 규칙 |
|---|---|
| 단계의 속도 법칙 | `mass_action`(차수대로) · `binding`(정·역 두 채널로 낮춤 — 확률 층의 성향이 음수가 되지 않게) · `michaelis_menten`(행위자 농도 × 포화). 그 밖의 법칙이나 전이 상태 이론 항(`k0`·`dG0`·`env`)이 있으면 단계를 끄고 `step_law_unsupported` 로 보고한다 |
| 반응 부피 | 참여자(minor 제외) 중 첫 부피(3D) 위치. 그것이 없으면(소포 수송·막 안 조립) 시나리오 `volumes[막]` 을 그 막의 유효 부피로 쓴다. `simulateRate` 는 같은 단계를 '즉시'로 다루므로 두 경로의 궤적을 서로의 수렴 기준으로 쓰지 않는다 (한계 L000081) |
| 화학량 | 단계의 입력·출력 그대로(minor 포함). 사법부 독립 검증기는 엔진이 적은 번호를 믿지 않고 `db.steps` 에서 다시 센다 |
| 부위 조건이 있는 분해 | 분해 규칙의 `when`(부위:특징)이 묶음의 특징과 맞을 때만 계에 들어간다 (예: CLIP 이 잘린 불변 사슬만 분해) |
| 막 공급 규칙 | 공급 위치가 막(2D)이면 모든 생성·소비 분자가 그 막에 박힌 분자여야 한다 (동시 번역 막 삽입) |
| 막 이동 경로 `membrane.route` | 막 단백질이 분비·섭취 경로에서 거쳐 가는 다른 막들. 묶음·표지의 위치 검사가 이 목록도 허용한다 |
| 시나리오 `context { role, state, note }` | 이 실행이 무엇을 보이려는 것인지 선언한다 — `cause`(그 상태에 이르는 원인: 전이 신호가 켜져 있고 그 상태에 도달) · `requirement`(필수성: 같은 신호에서 무엇을 끊으면 도달하지 못함) · `baseline`(일반 상황: 시작 상태, 구동된 전이 없음). 입력 해시에 들어가고, 사법부가 선언과 실행의 일관성을 판정한다 — 어긋나면 무결성 증명서 FAIL |

## 8L. 분열과 소모 — 복제 노화(헤이플릭 한계) 실험 (형식 바뀌지 않음, 2026-10-10)

"분열마다 줄어드는 것"과 "임계값에서의 비가역 상태 전이"는 새 규칙 종류 없이 기존 어휘로 표현된다. 아래가 그 규약이다.

| 항목 | 규약 |
|---|---|
| 분열(이산 사건) | **0차 공급 규칙 하나** (`zero_order`, k = 분열 간격의 역수 ÷ N_A·V). 그 규칙의 **누적 진행량이 곧 분열 횟수**이고, 소비 화학량이 분열당 소실량(ΔL)이다 — 분열 횟수를 담는 가짜 분자를 만들지 않는다. 길이 ↔ 횟수는 구성상 맞는다: 분열 횟수 = (L₀ − L)/ΔL (측정 상대 ≤ 1.4e-14) |
| 소모된 것의 행방 | 공급 규칙은 생성물이 필요하다(`produces` 필수). 떨어져 나간 반복 단위는 뉴클레오타이드로 핵의 풀로 돌아간다(단위당 양쪽 가닥 12 개) — 수지를 닫는 추론이며, 들어오는 쪽의 `source: true` 에 대응하는 '나가는 쪽' 표시는 형식에 없다 |
| 분열 허가·정지 | 조절 규칙(힐)의 배율. 허가는 신호의 **활성**(`activates`), 정지는 억제자의 **억제**(`inhibits`) |
| 임계 문턱 | 억제 힐의 K 를 임계값에, n 을 문턱의 급격함으로. **K 는 임계값보다 10 % 아래에 둔다** — 힐은 K 에서 이미 절반 켜져 있으므로 K 를 임계값에 정확히 두면 정지 되먹임이 임계 통과 자체를 늦춘다(측정: K = L_crit 이면 통과가 28 % 늦고 임계 위에서 멈춰 상태에 닿지 못함; K = 0.9·L_crit 이면 상대 지연 4.5e-12) |
| 상태 전이 | `cell_state` 의 서명(표지 문턱) + `transitions[].commitment.criterion` `withdrawal`. 도달 시각은 격자가 아니라 **근 찾기**로 정해지므로 관찰 격자 Δ 를 4 배 바꿔도 같다 (측정: 상대 ≤ 7.2e-16, 기계 정밀도) |
| 비가역 | 신호를 끊어도 목표 상태로 끝나는 첫 시각(결정 시점). 소모가 비가역이면(연장 규칙이 꺼져 있으면) 정지 뒤에는 늘 통과한다 |
| 활성 힐의 기준선 (형식의 비대칭) | `activates` 는 `1 + (fmax − 1)·occ` 이므로 **신호가 없을 때의 배율이 1 로 고정**된다 — "신호 없으면 속도 0" 을 쓸 수 없다. 억제는 `fmin` 까지 내려간다. 그래서 정지(quiescence)는 1/fmax 근사로 적고 한계로 등록한다 (L000091) |
| 화학량을 재는 관찰이 없다 | 분열당 소실 염기쌍(ΔL)은 규칙의 **화학량**인데 `vocab.observables` 에는 화학량을 가리키는 측정량이 없다 — 문헌 측정값을 관찰 기록으로 받아 `kinetics.from` 으로 묶을 수 없다 (L000088) |

데이터: 텔로미어 반복 단위 · 소모 과정 · 텔로머레이스(TERT) · p53 · p21 · FGF2 · 세포 상태 2(증식·복제 노화), 한계 9건(L000087–L000095). 모든 속도·힐 상수는 가상 시나리오 값이다.

## 8M. 측정값 사슬과 래칫 — 안전장치 (형식 v11, 2026-10-10)

레드팀 시험(사용자가 설계한 공격 5 가지, 11 패치)에서 **7 건이 통과**했다. 통과한 경로는 모두 한 자리였다:
`kinetics` 는 `kinetics.from` 으로 관찰 기록과 묶여 있었고 **정의항 `obs` 는 묶여 있지 않았다**.
그래서 관찰 기록(불변)은 그대로 둔 채 그 파생값만 바꾸면 관문이 "새 오류 0" 으로 통과시켰고,
엔진의 시작량이 8.916e7 → 1.308e8 로 오염되면서 출력은 `data: concentration 1200 µM` 라고 측정값인 척했다.

- **정의항 `obs` 는 측정의 파생값이다.** 측정량이 있는 속성(`obsProperties[*].observable`)의 문헌(`curated`) 값은
  `from: 'O…'` 로 관찰 기록을 가리켜야 하고, 사법부가 **단위 환산 뒤 값·종·세포·위치**를 그 관찰과 대조한다
  (`checkSenseObsFrom` — `checkKineticsFrom` 의 거울). 철회된 관찰이나 `use: validation` 관찰은 출처로 쓸 수 없다.
- **파생값은 지울 수 없다.** 패치는 배열을 통째로 교체하므로 `obs` 한 줄을 빼면 측정값이 조용히 사라진다.
  `from` 이 달린 항목이 사라지는 패치는 거부되고, **가리키는 관찰 기록에 `retracted` 가 있을 때만** 지울 수 있다.
  관찰 기록을 지울 수 없게 한 것과 같은 규약이다.
- **단위 환산표는 하나다 (`vocab.unitFactors`).** 엔진(`core.js`·`model.js` 의 `VOL`)과 사법부가 같은 계수를 읽는다 —
  표가 둘이면 대조 검사가 자기 환산으로 틀린 판정을 낸다. 부피의 정준은 `L` 로 둔다(농도 정준이 M = mol/L).
- **물리적 상한 (`vocab.physicalBounds`).** "불가능" 만 걸러낸다 — 농도 ≤ 100 M(순수한 물 55.5 M), 구획 부피 ≤ 1e-6 L,
  분자 수 ≤ 1e20, 서열 ≤ 1e6. 그럴듯함은 판정하지 않는다. 818 µM 을 818 M 로 적는 실수를 잡는 것이 목적이다.
- **종이 다른 값은 상수로도 못 쓴다.** `kinetics.from` 도 `context.species`·`location` 을 관찰의 조건과 대조한다.
- **측정값의 전후가 기록에 남는다.** Patch Report 의 `measured_changed` 가 `이전 → 이후` 를 적는다 —
  선언된 기록(`data/patches/*.json`)만 읽는 사람도 무엇이 바뀌었는지 안다.
- **거부 말뭉치와 래칫 (`tests/fixtures/rejections/`, `tests/rejections.test.mjs`).** 방어 규칙을 느슨하게 하는 공격은
  규칙 한 줄을 무력화하고 **그것을 잡던 시험을 건너뛰면** 시험이 전부 초록이 된다(실측: 202 pass / 0 fail).
  말뭉치 11 건이 기대 거부 사유(`EXPECT.json`)와 함께 있어 규칙이 느슨해지면 통과해 버려서 빨개지고,
  바닥값(`tests/fixtures/FLOOR.json` — 말뭉치 수·사법부 검사 자리 수·시험 수)과 `skip` 금지가 ②를 막는다.
  바닥값을 내리는 변경은 그 자체로 눈에 보이는 커밋이 된다.
- 새 측정량 **`volume`**(대상 = 위치, 단위 L)으로 부피도 관찰 기록이 된다 — L000102 해결.

## 8N. 값 층 — 형식 v12 (2026-10-15, `docs/design/format-v12.md`)

- **저장**: 정의항 `obs` 와 규칙 `kinetics` 의 수치는 최상위 `values { V… }` 에만 있다. 규칙에는 법칙 모양 `kinetic_law { law, order?, reversible?, env?, context?, lumped?, evidence }` 만 남는다. `meta.next.V`.
- **값 기록**: `{ subject: D… | D…/rule/키, property, value { dist: point | normal | lognormal | interval | categorical, mean | sd | low | high | level }, unit?, context?, evidence, from? [O…], derivation: direct | unit_conversion | lumped | computed, note?, evidence_at?, recorded_at, supersedes?, retracted? { note, at?, evidence? } }`. 정의항 대상의 속성은 `obsProperties`, 규칙 대상은 속도 칸(차수 제외).
- **보기**: 정규화가 현재 값(철회·대체되지 않은 기록)으로 정의항 `obs` 와 규칙 `kinetics` 를 지금 모양 그대로 **열거되지 않는 속성**으로 붙인다 — 읽는 코드·패치 작성법은 그대로이고, JSON 에는 값 층만 나간다.
- **패치**: 값은 지금처럼 정의항 `obs`·규칙 `kinetics` 로 적는다. 병합(`legislative foldValues`)이 바뀐 값을 새 기록(`supersedes`)으로, 빠진 값을 철회로 접는다. 이전 기록은 바뀌지 않는다. 패치가 `values` 를 직접 쓰면 거부. 값이 바뀌는 병합은 패치의 `recorded_at`(병합 전에 dbtool 이 찍음)이 필요하다 — 사건 사슬 재생 결정론.
- **두 시간**: `recorded_at`(기록 시각)·`evidence_at`(근거 시각). `model.asOf(db, 그날)` 은 그날까지 기록된 값만으로 보기를 다시 세운다 — 과거 보고서 재현.
- **사법부**: `validateValues`(대상·속성 어휘·분포·유도 방식·기록 시각·근거 관찰·대체 사슬) · 관문 `valueImmutability`(값 기록은 바꾸거나 지울 수 없음, 철회 표시만). 단위·상한·from 대조·종 검사는 보기에 대한 기존 검사가 그대로 한다.
- **정성 관찰** (2차): `observations.O…` 에 `kind: 'qualitative'` — `{ perturbation? { type: knockout | block | inhibit | clamp, target, Ki_M?, dose_M?, conc_M? }, readout { kind: amount | concentration | fraction | event_time, target? }, expect: increase | decrease | no_change | present | absent | monotone_increase | monotone_decrease | { order: [대상, …] }, condition, quote, provenance { source { db: DOI | PMID, id } }, use: 'validation', evidence (curated), replicates? }`. 값·단위·불확도는 없다. 대조군 비교 기대(increase·decrease·no_change)는 교란 필수, 순서 기대는 `readout.target` 대신 `expect.order`. 수치(속도 상수·정의항 obs)의 근거가 될 수 없다. 어휘 `qualitativeExpectations`·`qualitativeSources`, 측정량의 `qualitative: true`. 입력 계약 `schemas/obs/observation.schema.json` 은 `$defs.quantitative | qualitative` 를 `kind` 로 고른다. 판정: 0 층 `judicial/qual_graph.js`(build-plan 7), 모의 `judicial/qual_compare.js`(build-plan 8) — 어휘 `qualitativeExpectations[*].chance` 는 우연 기준선(결과 칸을 똑같이 고르는 영 가설, 순서는 1/m!).
- **관찰 공통** (2차): `experiment`(같은 실험의 관찰 묶음 — 독립 판정 단위) · `evidence_at`(YYYY · YYYY-MM · YYYY-MM-DD) · `recorded_at`(병합이 패치의 시각을 새 관찰에 찍음, 관문이 새 관찰에 요구) · `provenance { sha256?, source? }`.
- **맥락 열쇠** (2차): `vocab.contextKeys` 여섯 칸(species · cell · location · condition · temperature_K · pH). `model.contextKey(맥락)` = 빈 칸 null·조건 정렬·키 정렬 JSON — `scope`·`tissue`·`note` 같은 설명은 열쇠 밖. `condition` 은 정의항 번호 목록(문장 거부 → `scope` 로). 사법부: 현재 값의 맥락 칸 검사 · 같은 열쇠(대상·속성·맥락, 범주 값은 수준까지)의 현재 값이 둘이면 거부. 종 필수 여부는 지금처럼 속성 어휘(`speciesRequired`)·관찰 조건이 정한다. 데이터: 자유 문장 조건 6 건을 `scope` 로 옮긴 패치(값은 대체 기록).
- **번호 이동** (2차): 최상위 `moved { 옛 번호: { to: [번호…], kind: merge | split, at, why } }` — 있을 때만 직렬화. 패치 `moved` 를 병합이 처리(옛 번호를 표에서 빼고, 합쳐진 정의항을 가리키던 설명 연결은 대상으로 옮김, 시각 = 패치 `recorded_at`). 이동된 번호를 가리키는 패치는 병합 단계에서 대상을 알려 주며 거부, 정의 층(개념·정의항·단계·한계)에 남은 참조는 사법부 `validateMoved` 가 거부. 값·관찰(불변 층)은 옛 번호를 그대로 둔다. `resolveRef`·`followMoved` 는 이동을 따라간다(나뉜 번호는 하나를 고르라고 답함).
- **아직**: 기존 기록의 `evidence_at` 채우기(근거에서 읽을 수 있는 연도 — 데이터 패치로).

## 변경 기록

| 날짜 | 버전 | 내용 |
|---|---|---|
| 2026-10-15 | 12 (2차) | §8N 정성 관찰(`kind: qualitative`)·관찰 `experiment`·`evidence_at`·`recorded_at`·`provenance.source` · 맥락 열쇠(`contextKeys`·`contextKey`, 조건 = 정의항 번호 목록) · 번호 이동 `moved`. 버전 번호는 그대로(추가 필드만, 기존 db 직렬화 불변). 데이터: 자유 문장 조건 6 건 → `scope` (값 대체 기록, IR 해시 238 조합 같음) |
| 2026-10-15 | **12** | 값 층 분리(§8N): `values { V… }`·`kinetic_law`·보기(열거되지 않는 obs·kinetics)·병합의 대체·철회 접기·`recorded_at` 필수·`asOf`·사법부 `validateValues`·`valueImmutability`. 데이터: 값 기록 58(정의항 obs 52 · 속도 칸 6) — 보기 무손실, IR 해시 238 조합 같음, 등급 분포 같음. 변환은 사건 사슬의 `migration` 사건 #1 (`migrations/010-v10-to-v12-values.js`) |
| 2026-10-10 | **11** | 측정값 사슬과 래칫(§8M, 레드팀 7/7 차단): 정의항 `obs` 에 `from`(관찰 기록 참조) — 측정량이 있는 속성의 `curated` 값은 필수이고 단위 환산 뒤 값·종·세포·위치를 관찰과 대조(`checkSenseObsFrom`) · 파생값 삭제 금지(관찰이 `retracted` 일 때만) · 새 측정량 `volume`(대상 위치, 단위 L — L000102 해결) · 단위 환산표 하나로(`vocab.unitFactors`, `core.js`·`model.js` 가 그 표를 읽음 — 값 동일, 궤적 비트 불변) · 물리적 상한(`vocab.physicalBounds`) · `kinetics.from` 에 종·위치 대조 · Patch Report `measured_changed`(측정값 전후) · 거부 말뭉치 11 + 래칫(`tests/fixtures/FLOOR.json`, `skip` 금지) · 관찰 계약에 `volume` |
| 2026-10-10 | 10 (확장 6) | 분열과 소모 규약(형식·엔진 바뀌지 않음, §8L): 분열 = 0차 공급 규칙의 진행량, 임계 문턱 = 억제 힐(K 는 임계의 0.9 배), 상태 전이 = 서명 문턱 + 근 찾기. 어휘에 세포 `fibroblast` 하나 추가. 데이터: 텔로미어 반복 단위·소모 과정·TERT·p53·p21·FGF2·세포 상태 2(정의항 8·한계 9, L000087–L000095), 시나리오 5(가상), `tests/telomere.test.mjs` 7 검사. 형식의 빈칸 둘을 한계로: 활성 힐의 기준선이 1 로 고정(L000091) · 화학량을 재는 측정량이 없음(L000088) |
| 2026-10-10 | 10 (확장 5) | 신뢰 지표 ③ 추세 축: 새 `judicial/trend.js`(합의 수신함 `data/fetched/consensus/` · 판정 match·mismatch·unchecked · claim `trend` 도장 · 합의 창 만료 · Consensus_Gap 후보), `dbtool trend [--fetch] [--write]`, 어휘 `gapTypes.Consensus_Gap`·`consensus.window_days`, `reliability.items(opt.trend)` 로 추세 축 연결, `validStamps` 가 추세 도장을 분리해 넘김, 입법 서기가 주장별 검증 모듈로 보냄. 지문 70개가 `anchor` 로 올라감(이전 0). 한계 2건(L000085 신선도는 바이트로 증명 못 함 · L000086 지문은 하나인데 ChEBI 역할은 여럿) (§8K 추세 축) |
| 2026-10-10 | 10 (확장 4) | 신뢰 지표 ② 관문: 쓰인 상수마다 등급을 판정한다 — `reliability.constants`·`constantVerdict`·`constantText`, 속도 감사의 새 절 ②′(`judicial.auditRate`), 운명 판정의 `grades`(`fate_audit`), 과정 보고서의 무결성 증명서 한 줄 + §5 분포. 시나리오가 준 값은 등급 밖이므로 `hypothetical: true` 선언 아래에서만 쓸 수 있고, 문턱(기본 `parameter`)은 시나리오 `min_grade` 로 올린다. `reliability.js` 는 UMD(뷰어도 읽는다), 원자료에 `min_grade` 선언 전달 (§8K 관문) |
| 2026-10-10 | 10 (확장 3) | 신뢰 지표: 새 `judicial/reliability.js`(S·D 쌍 계산·등급 6·보고서), `dbtool grade`, 서열 지문(SEQ_SHA256)도 사법부 도장을 받음(재확인 증거 과제 포함). 점수는 저장하지 않고 계산한다 — 곱은 보고용(겹침 때문에 판정 불가). 지금 분포: parameter 306 · reference 274 · blocked 1 · anchor 0(추세 점검 없음) (§8K) |
| 2026-10-10 | 10 (확장 2) | 외부 ID 역할: `xrefs[].role`(`xrefRoles` physiological·parent·class), 역할 검사 넷(분류 항목 금지·역할 겹침·physiological 필수·같은 번호 두 번), 신원 확인에 켤레 관계(수소·전하만 차이)와 반응 참여(Rhea ≥ 3, 새 과제 종류 `rhea_usage`·수신함 `data/fetched/rhea/`), 증명 등록부의 '지난 도장' 구분. 데이터: ChEBI 항목 46개에 역할 선언(physiological 30·parent 14·class 2), 미확인 12건 닫음(Rhea 빈도로 고른 우세 종), 석신산의 분류 번호 CHEBI:26806 → succinate(2−) CHEBI:30031 교체, 원본 이름을 별칭으로 6건. 한계 2건(전하·양성자 수지 미검사, 중합체 단위 셈) (§8J) |
| 2026-10-09 | 10 (확장) | 기전 프로그램: cell_state `mechanisms`(경로 → 그 경로의 단계가 결합 적분 IR 의 반응), 단계 속도 법칙 세 가지(질량 작용·가역 결합 정·역·미카엘리스–멘텐), 막에서만 일어나는 단계의 유효 부피 규약, 부위 조건이 있는 분해 규칙, 막(2D) 공급 규칙, 표지의 막 위치 허용, `membrane.route`(분비·섭취 경로의 막), 시나리오 `context { role: cause \| requirement \| baseline, state, note }` 와 사법부 맥락 판정, 어휘 세포 `dendritic_cell`. 데이터: MHC I·II 항원 처리·제시(정의항 27·단계 18·수지상 세포 상태 2·한계 9) — 모든 속도 상수는 가상 시나리오 값 (§8I) |
| 2026-10-09 | 10 | 관찰 기록: 최상위 `observations`(O…, 측정량·SI 값·불확도·반복 수·조건·보정·출처·용도), `meta.next.O`, `kinetics.from`·`kinetics.lumped`(실측 상수 = 관찰의 파생값), 한계 종류 `Observation_Gap`, 어휘 observables·kineticUnits·uncertaintyKinds·noiseModels·calibrationKinds·obsUses, 계약 `schemas/obs/observation.schema.json`, 관찰 연산자 `compiler/obs_operator.js`. 관찰 기록은 바뀌지 않음(철회 표시만), 추정용과 검증용 관찰 분리. 데이터: 관찰 0건(실측값 없음 — 지어내지 않음), 규칙 kinetics 0건이라 이행할 상수 없음 (`migrations/009-v9-to-v10-observations.mjs`, 무손실) |
| 2026-10-09 | 9 (확장 4) | 삼권 분립: `model.js`(공유 헌법 층) · `core.js`(행정 — 원자료만) · `judicial/`(검증·증명) · `legislative/`(병합·초안, 쓰기는 서기 `clerk.mjs` 만). xref·지문의 `status: verified` 는 증명 등록부 `attestations/registry.json` 의 유효한 도장이 있어야 통과(새 검사 규칙). `simulateRate` 결과에서 `audit`·`postMortem` 이 빠지고 원자료(`facts`·`kinUsed`·`firstFire`·기록점 원장)가 들어감 — 판정은 `judicial.auditRate`. 운명 엔진 결과에서 `audit`·`postMortem`·`arrest`·`mass.worst/series` 가 빠지고 `process.lo`·`process.cumDD` 가 들어감 — 판정은 `judicial/fate_audit.js`. 수치 결합점 등록부 `engine/coupling.js`. db.json 형식 변화 없음(지금 verified 0 건 — 마이그레이션 불필요). |
| 2026-10-09 | 9 (확장 3) | 과정 분석 보고서: 운명 엔진이 매 단계 저장소 재생 편차·부분 구조 원장 편차·신호·규칙 누적 진행량·궤적 해시를 기록, `engine/process_report.js`, 시나리오 `expect`·`report.ratios`. 형식 버전 그대로 |
| 2026-10-09 | 9 (확장 2) | 구조 요소 `elements`(원자 수, 화학식 대조를 엔진 코드에서 데이터로), 어휘 `defaultVolumeLocation`, 부분 구조 수지 허용 오차 상대 1e-14, 운명 엔진 보상 산술 원장, 정제 점검 `refineCheck`, 비교 검토 `engine/compare.js`, `validate <patch>`, `augment apply <patch>`. 데이터: 부분 구조 7개의 elements, L000054·L000055 비교 검토 메모. 형식 버전 그대로 |
| 2026-10-08 | 9 (확장) | 자동 보강 고리: xref `note` 에 원본 출처(조회 날짜·수신함 파일·sha256), 확인 규칙(번호·종·이름·중복·화학식 ↔ 부분 구조 원자 수), 수신함 `data/fetched/`, Patch Report 의 자동 보강 후보 수. 형식 버전 그대로 |
| 2026-10-08 | 9 | 세포 운명 층: kind `cell_state`(signature · metabolome · transitions), 규칙 종류 `modulation`(대상 규칙의 힐 배율 — 신호 → 대사, 대사 → 유전자 조절), 속도 법칙 `hill`, 공급 소비 `saturating`, 외부 ID `CL`, 한계 종류 `Regulatory_Gap`, 어휘 `signatureLevels`·`commitmentCriteria`·세포 `cd8_t_cell`(그리고 `ruleTypes` 에 빠져 있던 degradation). `simulateRate` 가 조절 배율을 적용. 실행 층 `engine/fate_engine.js`(다중 속도 적분·P5 관문·결정 탐침·분화 정지 사후 분석). 데이터: CD8 T 세포 효과기/기억 전구 프로그램(정의항 16·조절 규칙 12·공급 규칙 6·분해 규칙 3·세포 상태 3), 회로 순 반응, 한계 20건(L000049–L000068) (`migrations/008-v8-to-v9-cell-fate.mjs`) |
| 2026-10-08 | 8 | 3 층 다중 규모 엔진: 정의항 `tier`(T1/T2, 마이그레이션이 kind·쓰임으로 배정: T1 32, T2 86), 관찰 diffusion_coefficient·pH·ionic_strength·relative_permittivity(위치 필수, SI), kinetics k0·dG_act·dG0·env(전이 상태 이론·미시적 가역성 검사), `rateAt`·`thermoLoops`·AUDIT_THERMO, 시뮬레이터의 구획 환경 반영, 어휘 tiers·thermo. 실행 층 `engine/hmse.js`(정수 원장·인접 경계 거래·이동량 표본·영역 점수·히스테리시스·보존적 투영), 스키마 `schemas/v8`, 인터페이스 `engine/interfaces/hmse.{hpp,py}`. 데이터: 한계 5건(L000044–L000048) (`migrations/007-v7-to-v8-three-tier.mjs`) |
| 2026-10-08 | 7 (확장 2) | Survival-to-Exhaustion: 단계 순환·완료 바퀴 수, 정지 감지(`until_death`·`window`·`death_frac`), 사후 분석(`postMortem`), 적분 안정성 감사, 한계 종류 `Resource_Gap`, 변화 종류 축합·수화, Patch Report 하류에 공급 규칙의 저장소 도달 포함. 데이터: 시트르산 회로(경로 1·효소 8·단계 8·대사물 15·부분 구조 4·재생 경로 3·CO₂ 배출), 기질 NDPK 공급 규칙, 한계 10건(L000034–L000043). 형식 버전 그대로 |
| 2026-10-08 | 7 (확장) | Traceable Evolution Protocol: 패치 `why` 필수, Patch Report(`patchReport`·`patchReportText`, 기록의 `report`, `dbtool report`), 미등록 한계 후보가 있으면 병합 거부. 한계 종류 `Identity_Gap`(unmapped 외부 ID — `detectGaps` 가 후보로 잡음). 데이터: Identity_Gap 6건(L000028–L000033). 형식 버전은 그대로 (`CHANGES.md` 도입) |
| 2026-10-08 | 7 | 생애 주기·대사물 저장소: 규칙 종류 `supply`(Metabolic_Supply_Rule)·`degradation`(Degradation_Rule, fate lost/recycled, recycle_to, sequence_length), 정의항 `moieties`(부분 구조)와 부분 구조 수지 검사, 부위 `ligands`(특징별 리간드), 속도 법칙 `zero_order`, 속도 필드 `half_life`, 관찰 `sequence_length`, 어휘 `lifecycleFates`·`reservoirModes`·`ruleTypes`. 시뮬레이터: 유한 저장소(기본)·공급·분해(결정론/확률적)·매 Δt 질량 감사(국소·전역, 실체·부분 구조)·고갈/재생 사건·원장 Δ·자원 순환, 감사 코드 `AUDIT_RESOURCE`. 데이터: 부분 구조 3개·피로인산, ATP·ADP·AMP·cAMP·GTP·GDP·Pi·G1P 부분 구조, Gs 특징별 리간드, AC·E1·프로테아좀 규칙의 빠진 산물(피로인산·Pi) 교정, 공급 규칙 5개(NDPK·아데닐산 키네이스·PPase·ATP 재생·뉴클레오타이드 공급), 분해 규칙 2개(TNF mRNA·IκBα), 원리 2개(생애 주기 모델·대사물 저장소 모델), 한계 9건 (`migrations/006-v6-to-v7-lifecycle.mjs`) |
| 2026-10-08 | 6 | 혼합 해상도(R0 위상·R1 부위·R2 구조, 전환 문턱 T1–T3, 부위 구조 참조 `site.structure`), 반응 속도(`rule.kinetics`, 법칙 3종, SI 정준 단위, 속도 무결성 검사), 한계 해결 경로 `kinetics`, 속도 기반 시뮬레이터·시나리오 층, 감사 명령(`audit-run`). 데이터: 혼합 해상도 모델·반응 속도 모델 원리, 3FXI 구조 참조, Kinetic_Gap 해결 경로 교정, 한계 2건 추가(2D 환산, Gs–AC 이중 계산) (`migrations/005-v5-to-v6-hybrid-kinetics.mjs`) |
| 2026-10-08 | 5 | 한계 등록부 `limitations`(L…, `[Target | Type | Requirement]`, 계산되는 상태, `limitations.md` 생성·CI 검사), 상위 개념 `motif`·`addresses`·`gap_review`, 패턴 검출기(`pattern`), 구획 농도 모델(시작량을 copy_number 또는 농도 × 구획 부피에서), 관찰 맥락 `location`, 관찰 속성 copy_number·compartment_volume, 어휘 gapTypes. 한계 16건·상위 개념 10개·구획 농도 모델 등록 (`migrations/004-v4-to-v5-limitations.mjs`) |
| 2026-10-08 | 4 (확장) | LPS → TLR4 → NF-κB 스트레스 시험으로 엔진 확장: 효과 `transfer`·`degrade`, 전제 조건 `requires`, 동일성 보존 검사, 수송 대상의 접촉 검사 예외, 근거 `sources[{db,id,citation}]`·`basis`·근거 수준 `abstracted`, 시뮬레이터(`simulate`). 어휘: 변화 종류 전달·유비퀴틴화·단백질 분해·전사, 특징 K48/K63 폴리유비퀴틴, 분야 면역학, 세포 대식세포·단핵구. 데이터 형식 버전은 그대로(기존 데이터에 curated 근거가 없어 변환 불필요) |
| 2026-10-08 | 4 | 두 해상도 구조. 정의항이 원천으로 설명(desc)·막 위상·구성 요소·부위(종별 잔기 번호, 면, 리간드)·규칙(상태 의미·전이)·관찰(obs)을 소유. 상태(states) 폐지 → 묶음 키 `D|부위:특징|위치`. 단계는 규칙 참조 + 묶음만, 위치는 묶음마다. 위치 계층·막 면·공간 접촉 검사, 기준 종, 근거 수준. 어휘: compartments·modifications → locations·faces·associations·siteTypes·features·taxa·tissues·cells·obsProperties·evidenceLevels. 소단위·보조인자 정의항 10개 추가 (`migrations/003-v3-to-v4.mjs`) |
| 2026-10-08 | 3 | 이름이 곧 ID 이던 것을 고정 번호(T/D/S)로 교체, 이름은 names {ko, en} + 별칭, 번호 재사용 금지(meta.next), `이름#n` 주소, 구조 지문 필드 (`migrations/002-v2-to-v3-stable-ids.mjs`) |
| 2026-10-08 | 2 | 상태를 객체로 승격, kind·field·외부 ID·unmapped 추가, 단계 위치를 compartment/cell 로 분리, 통제 어휘·이름 매핑·관문 도입 (`migrations/001-v1-to-v2.mjs`) |
| 2026-10-08 | 1 | 정의항·연결·기전 단계 (F-P 저장소에서 가져옴) |
