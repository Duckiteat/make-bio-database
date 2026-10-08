# 스키마와 매핑 규칙 (형식 버전 3)

이 데이터베이스는 AI가 채운다. 규칙 없이 쌓이면 같은 개념이 여러 이름으로 생기고, 값이 제각각이 되어 연결이 끊긴다.
그래서 **모든 입력은 패치 → 매핑 → 검사 → 관문**을 거치고, 하나라도 어기면 패치 전체가 거부된다.

```
AI 패치 ──▶ 매핑 (임시 번호·이름·별칭·"이름#n"·외부 ID·지문·어휘 별칭·상태 이름 → 표준 값)
        ──▶ 검사 (아래 규칙 전부)
        ──▶ 관문 (매핑 오류·검사 오류 0, 새 경고 0) ──▶ data/db.json + data/patches/ 기록
```

| 파일 | 내용 | 누가 바꾸나 |
|---|---|---|
| `vocab.js` | 통제 어휘, 외부 ID·지문 형식, 관계의 kind 제약 | 사람이 검토 후 |
| `core.js` | 매핑·검사·관문 로직 | 사람이 검토 후 (테스트 필수) |
| `tests/rules.test.mjs` | 규칙이 실제로 거부하는지 확인하는 테스트 | 규칙을 바꿀 때 함께 |

AI 패치는 데이터(`terms`, `senses`, `states`, `steps`, `remove`)만 바꿀 수 있고 어휘·규칙은 바꿀 수 없다.

## 1. 식별자: 의미 없는 고정 번호

| 대상 | 번호 | 예 |
|---|---|---|
| 개념 (피정의항) | `T` + 6자리 | `T000042` |
| 정의항 (뜻) | `D` + 6자리 | `D000044` |
| 상태 | `D…@키` | `D000044@a` |
| 기전 단계 | `S` + 6자리 | `S000009` |

- **모든 참조는 번호로 저장한다.** 연결 `to`, 참여자 `ref`, `part_of`, 상태 `bound` 는 정의항 번호(D…).
- **번호에는 의미를 넣지 않는다.** 이름·분류·기능처럼 바뀔 수 있는 정보가 번호에 들어가면 지식이 바뀔 때 번호도 바뀌어야 한다.
- **번호는 다시 쓰지 않는다.** `meta.next` 가 다음 번호를 배정하고 줄어들지 않는다. 지운 번호는 영구 결번이다(옛 기록이 다른 것을 가리키게 되는 일을 막는다). 검사는 `meta.next` 가 쓰인 번호보다 큰지 확인한다.
- **이름을 바꿔도 번호와 연결은 그대로다.** 옛 한국어 이름은 자동으로 별칭에 남는다.
- **사람용 꼬리표**: 뜻이 하나인 개념은 `이름`, 여러 개면 `이름#n`(n = 개념 안 뜻 번호, 바뀌지 않음). 화면과 텍스트 출력은 꼬리표와 번호를 함께 보여 준다.
- 패치 안의 새 항목은 임시 번호(`T+1`, `D+gp`, `S+1` …)를 쓰고, 병합 때 실제 번호가 배정된다. 기존 번호를 쓰면 그 항목을 고치는 것이고, 없는 번호는 거부된다.

### 개념과 정의항

```json
"terms":  { "T000042": { "names": { "ko": "글리코겐 인산화효소", "en": "glycogen phosphorylase" }, "aliases": ["포스포릴레이스"] } },
"senses": { "D000044": { "term": "T000042", "n": 1, "kind": "molecule_class", "field": "생화학", "text": "…", "context": "…",
                         "links": [{ "to": "D000009", "rel": "is_a", "span": "효소" }],
                         "xrefs": [{ "db": "EC", "id": "EC 2.4.1.1", "status": "asserted" }],
                         "states": [{ "key": "a", "label": "a형(인산화)", "activity": "active", "modifications": [{ "type": "phosphorylation", "site": "Ser14" }], "bound": [] }] } }
```

## 2. 이름 매핑 (하나의 이름 = 하나의 개념)

**정규화**: 유니코드 NFKC → 소문자 → 그리스 문자를 이름으로(β→beta) → 공백·하이픈·괄호·점·쉼표 등 제거.

- 정규화한 이름(`names.ko`, `names.en`, 별칭) 하나는 데이터베이스 전체에서 **개념 하나만** 가리킨다. 겹치면 오류.
- 패치의 새 개념 이름(ko 또는 en)이 기존 이름과 같으면 **기존 개념으로 매핑**되고 새 별칭·영문명만 더해진다.
- 패치의 새 별칭이 다른 개념의 이름이면 거부. 이름에 `#` `@` `|` 금지.
- 이미 뜻이 있는 개념에 새 뜻을 더하려면 `distinction`(기존 뜻과의 차이)이 필수. 없으면 거부.
- 정의항을 다른 개념으로 옮길 수 없다.

**참조 매핑** (패치 안에서만, 저장 전에 번호로 바뀜): 정의항 번호 → 임시 번호 → 개념 번호(뜻이 하나일 때) → `이름#n` → 외부 ID(`CHEBI:15422`) → 구조 지문 → 이름·별칭.
가리키는 개념의 뜻이 여러 개면 거부하고 후보를 보여 준다. 없는 이름이면 거부하고 비슷한 이름을 제안한다.
단, 정의항의 `term` 에 없는 이름을 쓰면 그 이름으로 새 개념이 만들어진다.

## 3. 통제 어휘

| 필드 | 표 (`vocab.js`) | 필수 |
|---|---|---|
| 정의항 `kind` | `kinds` | 예 |
| 정의항 `field` | `fields` | 예 |
| 단계 `action` | `actions` | 예 |
| 단계 `compartment` | `compartments` | 예 |
| 상태 `activity` | `activity` | 예 (기본 unknown) |
| 상태 수식 `type` | `modifications` | 예 |
| 조절 `effect` | `effects` | 예 |

패치에서는 표의 별칭도 쓸 수 있다(`phosphorylation`, `cytosol`, `biochemistry`, `활성형` …). 병합 때 표준 키로 바뀐다.
목록에 없는 값은 거부되고 가까운 값을 제안한다. 목록에 값을 추가하는 것은 사람이 `vocab.js` 를 고쳐서 한다.

## 4. 종류(kind) 규칙

- **참여자 종류**(protein, complex, nucleic_acid, small_molecule, macromolecule, ion, molecule_class)만 기전 단계에 참여하고 상태를 가질 수 있다.
- 단계의 `part_of` 대상은 `pathway` 정의항이어야 한다.
- 관계의 kind 제약 (`vocab.js` 의 `relationRules`, has_* 는 방향을 뒤집어 같은 표로 검사):
  - `is_a`: 분자 → 같은 kind 또는 molecule_class / molecule_class → molecule_class / pathway → pathway·process / process → process·concept / structure_feature → structure_feature·concept / principle → principle·concept / concept → concept
  - `part_of`: 분자·structure_feature → 분자 / pathway → pathway / process → process·pathway
  - `instance_of`: is_a 와 같음 / `requires`·`contrasts`·`refers`: 제약 없음

## 5. 외부 ID

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

## 6. 구조 지문 (fingerprint)

구조에서 계산되는 **정체성 키**. 참조에는 쓰지 않고(참조는 번호), 중복 차단과 정확 일치 검색에 쓴다.
구조가 고쳐지면 지문만 바뀌고 번호와 연결은 그대로다.

| 방식 | kind | 값 |
|---|---|---|
| `InChIKey` | small_molecule, ion, macromolecule | 표준 InChIKey |
| `SEQ_SHA256` | protein, nucleic_acid | 정규 서열(대문자, 공백 제거)의 SHA-256 |
| `COMPLEX` | complex | `CPX(구성지문x개수+…)` — 구성 요소를 정렬해 이은 것 |

- 같은 지문은 정의항 하나에만 붙는다. `status`: `computed`(도구로 계산) / `asserted` / `verified`.
- **같은 개체로 볼 범위**: 저분자는 생리적 pH(7.3)의 주 이온 형태를 대표로 하고, 입체이성질체가 생화학적으로 구별되면 별개 개체로 둔다. 단백질은 정규 서열 기준이며, 인산화형 같은 변화는 지문이 아니라 상태로 표현한다.
- 지문은 AI가 머릿속으로 계산하지 않는다. 구조를 다루는 도구(RDKit·InChI 등)가 계산해 `computed` 로 넣는다. 현재 저장소에는 아직 지문이 없다(구조 층에서 채움).

## 7. 상태와 기전 단계

- 같은 분자의 다른 형태는 새 개념이 아니라 정의항의 **상태**로 둔다.
- 상태: `key`, `label`, `aliases`, `activity`, `modifications[{type, site}]`(site 는 `Ser14` 형식), `bound[정의항 번호]`, `note`. 한 정의항 안에서 상태의 키·이름·별칭은 정규화 후 겹칠 수 없다.
- 단계 참여자의 `state`·`after` 는 그 정의항에 **정의된 상태 키**여야 한다(패치에서는 상태 이름·별칭도 받아 키로 바꾼다).
- 상태가 정의된 분자를 참여자로 쓸 때는 `state` 가 필수다(부산물 `minor` 제외).
- 사슬 연결: 한 단계의 출력(`D…@상태`)이 다른 단계의 입력·행위자·조절자와 같으면 이어진다. `minor` 는 잇지 않는다.

## 8. 패치 형식

```json
{ "format": "definition-db-patch", "version": 3,
  "terms":  [ { "id": "T+1", "names": { "ko": "…", "en": "…" }, "aliases": [] } ],
  "senses": [ { "id": "D+1", "term": "T+1", "kind": "…", "field": "…", "text": "…", "context": "…", "links": [], "xrefs": [], "states": [] } ],
  "states": { "정의항 참조": [ { "key": "…", "label": "…", "activity": "…" } ] },
  "steps":  [ { "id": "S+1", "label": "…", "action": "…", "compartment": "…", "agents": [], "inputs": [], "outputs": [], "regulators": [], "part_of": [] } ],
  "remove": [ "번호" ] }
```

- 기존 정의항을 고치면 정의항 전체가 교체된다. `states`·`xrefs`·`unmapped`·`fingerprint` 는 생략하면 유지된다.
- `remove` 에 개념 번호를 주면 그 개념의 뜻도 모두 지워진다. 뜻을 모두 잃은 개념도 지워진다.

## 9. 관문

| 결과 | 처리 |
|---|---|
| 매핑 오류 또는 검사 오류가 새로 생김 | 거부 |
| 새 경고가 생김 (예: 근거 구절 없는 연결) | 거부 — `--allow-warnings`(화면에서는 체크) 로만 통과 |
| 바뀐 것 없음 | 저장 안 함 |
| 통과 | `data/db.json` 저장 + `data/patches/시각-이름.json` 에 패치와 매핑 결과 기록 |

## 10. 형식 버전과 변환

- `data/db.json` 의 `version` 이 `core.js` 의 `VERSION` 과 다르면 검사가 오류를 낸다.
- 형식을 바꿀 때는 `migrations/NNN-설명.mjs` 를 추가하고, 그 스크립트로 저장소를 변환한 뒤 아래 변경 기록에 적는다.
- `data/patches/` 의 옛 기록은 당시 형식·ID 로 적혀 있다. 옛 ID ↔ 새 번호 대응은 `migrations/002-id-map.json`.

## 변경 기록

| 날짜 | 버전 | 내용 |
|---|---|---|
| 2026-10-08 | 3 | 이름이 곧 ID 이던 것을 고정 번호(T/D/S)로 교체, 이름은 names {ko, en} + 별칭, 번호 재사용 금지(meta.next), `이름#n` 주소, 구조 지문 필드 (`migrations/002-v2-to-v3-stable-ids.mjs`) |
| 2026-10-08 | 2 | 상태를 객체로 승격, kind·field·외부 ID·unmapped 추가, 단계 위치를 compartment/cell 로 분리, 통제 어휘·이름 매핑·관문 도입 (`migrations/001-v1-to-v2.mjs`) |
| 2026-10-08 | 1 | 정의항·연결·기전 단계 (F-P 저장소에서 가져옴) |
