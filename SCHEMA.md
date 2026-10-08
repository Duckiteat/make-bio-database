# 스키마와 매핑 규칙 (형식 버전 4)

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
- curated(출처 `source` 필수, 예 `{db:"PMID", id:"…"}`) | computed(도구 `tool` 필수) | asserted | predicted(0–1 `confidence` 필수).

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
| `transport` | `target`, `from`, `to` | 위치 변화 |

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
- **사슬 연결**: 한 단계의 출력 묶음 키가 다른 단계의 입력·행위자·조절자 묶음 키와 같으면 이어진다. `minor`(부산물)는 잇지 않는다.

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
- `status`: `asserted`(적었지만 원본과 대조 안 함) / `verified`(원본과 대조함).
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

## 12. 관문

| 결과 | 처리 |
|---|---|
| 매핑 오류 또는 검사 오류가 새로 생김 | 거부 |
| 새 경고가 생김 (예: 근거 구절 없는 연결, 구성 요소 없는 복합체) | 거부 — `--allow-warnings`(화면에서는 체크) 로만 통과 |
| 바뀐 것 없음 | 저장 안 함 |
| 통과 | `data/db.json` 저장 + `data/patches/시각-이름.json` 에 패치와 매핑 결과 기록 |

## 13. 형식 버전과 변환

- `data/db.json` 의 `version` 이 `core.js` 의 `VERSION` 과 다르면 검사가 오류를 낸다.
- 형식을 바꿀 때는 `migrations/NNN-설명.mjs` 를 추가하고, 그 스크립트로 저장소를 변환한 뒤 아래 변경 기록에 적는다.
- `data/patches/` 의 옛 기록은 당시 형식·ID 로 적혀 있다. 옛 ID ↔ 새 번호 대응은 `migrations/002-id-map.json`.

## 변경 기록

| 날짜 | 버전 | 내용 |
|---|---|---|
| 2026-10-08 | 4 | 두 해상도 구조. 정의항이 원천으로 설명(desc)·막 위상·구성 요소·부위(종별 잔기 번호, 면, 리간드)·규칙(상태 의미·전이)·관찰(obs)을 소유. 상태(states) 폐지 → 묶음 키 `D|부위:특징|위치`. 단계는 규칙 참조 + 묶음만, 위치는 묶음마다. 위치 계층·막 면·공간 접촉 검사, 기준 종, 근거 수준. 어휘: compartments·modifications → locations·faces·associations·siteTypes·features·taxa·tissues·cells·obsProperties·evidenceLevels. 소단위·보조인자 정의항 10개 추가 (`migrations/003-v3-to-v4.mjs`) |
| 2026-10-08 | 3 | 이름이 곧 ID 이던 것을 고정 번호(T/D/S)로 교체, 이름은 names {ko, en} + 별칭, 번호 재사용 금지(meta.next), `이름#n` 주소, 구조 지문 필드 (`migrations/002-v2-to-v3-stable-ids.mjs`) |
| 2026-10-08 | 2 | 상태를 객체로 승격, kind·field·외부 ID·unmapped 추가, 단계 위치를 compartment/cell 로 분리, 통제 어휘·이름 매핑·관문 도입 (`migrations/001-v1-to-v2.mjs`) |
| 2026-10-08 | 1 | 정의항·연결·기전 단계 (F-P 저장소에서 가져옴) |
