# 스키마와 매핑 규칙 (형식 버전 2)

이 데이터베이스는 AI가 채운다. 규칙 없이 쌓이면 같은 개념이 여러 이름으로 생기고, 값이 제각각이 되어 연결이 끊긴다.
그래서 **모든 입력은 패치 → 매핑 → 검사 → 관문**을 거치고, 하나라도 어기면 패치 전체가 거부된다.

```
AI 패치 ──▶ 매핑 (이름·별칭·외부 ID·어휘 별칭·상태 이름 → 표준 값)
        ──▶ 검사 (아래 규칙 전부)
        ──▶ 관문 (매핑 오류·검사 오류 0, 새 경고 0) ──▶ data/db.json + data/patches/ 기록
```

규칙의 원천은 세 곳이다.

| 파일 | 내용 | 누가 바꾸나 |
|---|---|---|
| `vocab.js` | 통제 어휘: kind, field, action, compartment, activity, modification, effect, 외부 ID 형식, 관계의 kind 제약 | 사람이 검토 후 |
| `core.js` | 매핑·검사·관문 로직 | 사람이 검토 후 (테스트 필수) |
| `tests/rules.test.mjs` | 규칙이 실제로 거부하는지 확인하는 테스트 | 규칙을 바꿀 때 함께 |

AI 패치는 데이터(`terms`, `states`, `steps`, `remove`)만 바꿀 수 있고 어휘·규칙은 바꿀 수 없다.

## 1. 식별자

| 대상 | 형식 | 예 |
|---|---|---|
| 피정의항 | 이름 그대로. `#` `@` `\|` 금지, `step:` 으로 시작 금지 | `글리코겐 인산화효소` |
| 정의항 | `피정의항#번호` | `글리코겐 인산화효소#1` |
| 상태 | `정의항id@키` (키: 영문·숫자·한글·`_-`) | `글리코겐 인산화효소#1@a` |
| 기전 단계 | `step:번호` | `step:9` |
| 새 항목(패치 안) | 임시 id `이름#+1`, `step:+1` → 병합 때 번호 배정 | |

- 저장된 데이터의 모든 참조(연결 `to`, 참여자 `ref`, `part_of`, 상태 `bound`)는 **정확한 정의항 id** 여야 한다.
- 번호는 다시 쓰지 않는다. 기존 id 로 쓰면 그 항목을 고치는 것이고, 없는 기존 id 는 거부된다.

## 2. 이름 매핑 (중복 개념 방지)

**정규화**: 유니코드 NFKC → 소문자 → 그리스 문자를 이름으로(β→beta) → 공백·하이픈·괄호·점·쉼표 등 제거.
`β-아드레날린 수용체`, `beta 아드레날린수용체`, `Beta-아드레날린 수용체` 는 같은 이름이다.

- 데이터베이스 전체에서 정규화한 이름(피정의항 이름 + 별칭) 하나는 **피정의항 하나만** 가리킨다. 겹치면 오류.
- 패치의 새 피정의항 이름이 기존 이름·별칭과 같으면 **기존 피정의항으로 매핑**된다.
- 패치의 새 별칭이 다른 피정의항의 이름이면 거부.
- 이미 정의항이 있는 피정의항에 새 뜻을 더하려면 `distinction`(기존 뜻과의 차이)이 필수다. 없으면 거부.

**참조 매핑** (패치 안에서만, 저장 전에 id 로 바뀜): 정의항 id → 별칭 id(`adenylyl cyclase#1`) → 외부 ID(`CHEBI:15422`) → 이름·별칭.
이름이 가리키는 피정의항의 뜻이 여러 개면 거부하고 후보 id 를 보여 준다. 없는 이름이면 거부하고 비슷한 이름을 제안한다.

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

- 형식은 `vocab.js` 의 정규식으로 검사한다 (`CHEBI:15422`, `P06737`, `EC 2.7.11.11`, `GO:0007165` …).
- 같은 외부 ID 는 정의항 하나에만 붙는다 → 이름이 달라도 같은 실체면 중복으로 잡힌다.
- **추측 금지**: 필수 ID 를 확실히 모르면 ID 를 지어내지 말고 `unmapped` 에 사유를 적는다. 사유가 있으면 통과하고 `audit` 목록에 남는다.
- `status`: `asserted`(적었지만 원본과 대조 안 함) / `verified`(원본 데이터베이스와 대조함). 현재 모든 ID 는 asserted 이다.

## 6. 상태와 기전 단계

- 인산화형·GTP 결합형처럼 같은 분자의 다른 형태는 새 피정의항이 아니라 그 정의항의 **상태**로 둔다.
- 상태: `key`, `label`, `aliases`, `activity`, `modifications[{type, site}]`(site 는 `Ser14` 형식), `bound[정의항 id]`, `note`.
  한 정의항 안에서 상태의 키·이름·별칭은 정규화 후 겹칠 수 없다.
- 단계 참여자의 `state`·`after` 는 그 정의항에 **정의된 상태 키**여야 한다(패치에서는 상태 이름·별칭도 받아 키로 바꾼다).
- 상태가 정의된 분자를 참여자로 쓸 때는 `state` 가 필수다(부산물 `minor` 제외). 그래야 사슬이 모호해지지 않는다.
- 사슬 연결: 한 단계의 출력(`정의항@상태`)이 다른 단계의 입력·행위자·조절자와 같으면 이어진다. `minor` 는 잇지 않는다.

## 7. 관문

| 결과 | 처리 |
|---|---|
| 매핑 오류 또는 검사 오류가 새로 생김 | 거부 |
| 새 경고가 생김 (예: 근거 구절 없는 연결) | 거부 — `--allow-warnings`(화면에서는 체크) 로만 통과 |
| 바뀐 것 없음 | 저장 안 함 |
| 통과 | `data/db.json` 저장 + `data/patches/시각-이름.json` 에 패치와 매핑 결과 기록 |

## 8. 형식 버전과 변환

- `data/db.json` 의 `version` 이 `core.js` 의 `VERSION` 과 다르면 검사가 오류를 낸다.
- 형식을 바꿀 때는 `migrations/NNN-설명.mjs` 를 추가하고, 그 스크립트로 저장소를 변환한 뒤 이 문서의 변경 기록에 적는다.

## 변경 기록

| 날짜 | 버전 | 내용 |
|---|---|---|
| 2026-10-08 | 2 | 상태를 객체로 승격, kind·field·외부 ID·unmapped 추가, 단계 위치를 compartment/cell 로 분리, 통제 어휘·이름 매핑·관문 도입 (`migrations/001-v1-to-v2.mjs`) |
| 2026-10-08 | 1 | 정의항·연결·기전 단계 (F-P 저장소에서 가져옴) |
