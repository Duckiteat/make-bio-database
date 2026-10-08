# 특징 층 · 가설 층 설계 (초안 — 아직 구현 전)

> **v4 정렬 (2026-10-08, v4 는 구현됨 — 하위 번호·묶음 키 형식은 [`SCHEMA.md`](SCHEMA.md))**: 원천 중심 소유 원칙([`DESIGN-v4.md`](DESIGN-v4.md))에 따라, 아래의 독립 특징 레코드(`F000001`, `subject` 필드)는
> 만들지 않는다. 특징은 그것을 가진 **정의항이 하위 번호로 소유**하고, `F` 는 특징 *유형* 어휘(phosphorylation, GTP-bound …)가 된다.
> 근거 수준(3절)·가설 층(4절)·추론 규칙(5절)·특징 카드(7절)·시뮬레이션 다리(8절)의 내용은 그대로 유효하고, 대상 번호만 아래처럼 바뀐다.
>
> | 이 문서의 특징 종류 | v4 에서 사는 곳 |
> |---|---|
> | catalytic_activity, substrate_specificity | `D…/rule/n` (촉매 규칙: 행위 · 대상 부위 조건 · 변화) + EC/GO 는 정체성 xrefs |
> | molecular_function | 정체성 xrefs (GO) |
> | domain, sequence_motif, binding_site, modification_site | `D…/site/키` (부위 종류 · 범위 · 막 면 · 허용 특징) |
> | structure_ref | 정체성(구조 참조), 형태별이면 상태 의미 규칙과 연결 |
> | localization, expression, quantity | `D…/obs/n` (맥락 필수) — 단, 단계 안에서 풀이 어디 있는지는 묶음 키의 위치 |
> | 상태 수준 특징 (`D…@키`) | 묶음 키 `D…|site:feature|…|위치` + 원천의 상태 의미 규칙 |
>
> 가설의 `fired` 는 이 하위 번호들(`D…/site/…`, `D…/rule/…`, `D…/obs/…`)을 가리킨다.

## 0. 목적

특징(feature)은 검색용 꼬리표가 아니라 **AI 추론과 시뮬레이션의 입력 신호**다.

- 가설 생성: "X 가 이런 특징을 가졌으니 Y 와 상호작용할 수 있다"
- 시뮬레이션 유도: 특징이 어떤 반응 규칙이 존재할지를 정하고, 물리 시뮬레이션의 탐색 범위를 줄인다

이 신호가 도움이 되려면 세 가지가 지켜져야 한다.

1. **특징은 번호(ID)가 아니라 별도 레코드에 둔다.** 맥락·근거·확신도를 함께 달 수 있고, 지식이 바뀌면 고칠 수 있다.
2. **근거 수준을 엄격히 구분한다.** 원본이 있는 사실, 도구가 계산한 값, 근거 없이 적은 것, 모델 예측은 다르게 취급한다.
3. **가설은 사실과 다른 층에 둔다.** AI 가 만든 가설이 자동으로 사실이 되면, 다음 AI 가 그것을 근거로 또 가설을 만드는 **자기 강화 환각 고리**가 생긴다.

```
사실 층   개념 T · 뜻 D · 상태 D@키 · 기전 단계 S            (지금 있음)
특징 층   F000001 … — 정의항·상태에 붙는 타입 있는 특징 + 맥락 + 근거   (이 문서)
규칙      rules.js — 사람이 검토한 추론 규칙 템플릿            (이 문서)
가설 층   H000001 … — 규칙·AI 가 만든 후보. 사실과 분리, 자동 승격 없음   (이 문서)
시뮬레이션 사실 + (선택한) 가설 → 규칙 기반 모델 → 결과는 관찰 기록으로 돌아옴
```

## 1. 특징 레코드

```json
"features": {
  "F000012": {
    "subject": "D000044",
    "type": "modification_site",
    "value": { "residue": "Ser14", "modification": "phosphorylation", "by": "D000043", "state": "a" },
    "context": null,
    "evidence": { "level": "curated", "source": { "db": "PMID", "id": "…" } },
    "note": "", "by": "Claude", "at": "2026-10-08"
  }
}
```

| 필드 | 뜻 |
|---|---|
| `subject` | 정의항 번호(`D…`) 또는 상태(`D…@키`). 상태 수준 특징(예: 그 상태에서의 활성)은 상태에 붙인다 |
| `type` | 특징 종류 (2절). `vocab.js` 에 추가할 `featureTypes` 표의 값만 |
| `value` | 종류마다 정해진 모양 (2절). 안의 참조는 모두 번호 |
| `context` | 맥락 특징이면 필수: `{ species, tissue, cell, compartment, condition }` (compartment 는 기존 어휘) |
| `evidence` | 근거 수준과 출처 (3절) |

번호는 `F` + 6자리, 기존 규칙(재사용 금지, 패치에서는 `F+1` 임시 번호)과 같다.

## 2. 특징 종류

| type | value | 분류 | subject kind | 출처 어휘 |
|---|---|---|---|---|
| `catalytic_activity` | `{ ec, go }` | 고유 | protein, complex, molecule_class | EC, GO(MF) |
| `molecular_function` | `{ go }` | 고유 | 분자 | GO(MF) |
| `domain` | `{ interpro, start, end }` | 고유 | protein | InterPro |
| `sequence_motif` | `{ pattern, start, end }` | 고유 | protein, nucleic_acid | PROSITE 형식 패턴 |
| `substrate_specificity` | `{ pattern, note }` | 고유 | 효소 (protein, complex, molecule_class) | 예: PKA 인식 서열 `R-R-x-[ST]` |
| `binding_site` | `{ residues[], ligand: D…, ligand_state }` | 고유 | protein, complex | – |
| `modification_site` | `{ residue, modification, by: D…, state }` | 고유 | protein, complex, molecule_class | modifications 어휘 |
| `localization` | `{ compartment, go }` | **맥락** | 분자 | compartments 어휘, GO(CC) |
| `expression` | `{ level: high/medium/low/absent }` | **맥락** | protein, nucleic_acid | – |
| `structure_ref` | `{ db: PDB/AlphaFold, id, chains, state, method, resolution }` | 고유 | protein, complex | 구조 층으로 가는 다리 |
| `quantity` | `{ property: Km/kcat/Kd/…, value, unit, partner: D… }` | **맥락** | 분자 | 시뮬레이션 매개변수 |

- **고유 특징**은 서열·구조에서 오는 성질이라 맥락 없이 정의항(또는 상태)에 붙는다.
- **맥락 특징**은 조직·세포·조건에 따라 달라지므로 `context` 없이는 거부한다. "간 특이적" 은 분자의 성질이 아니라 맥락이 붙은 관찰이다.
- 상태와 맞물림: 상태의 `modifications[{type, site}]` 는 같은 정의항의 `modification_site` 특징과 대응해야 한다(검사 규칙 6절).

## 3. 근거 수준

| level | 뜻 | 필수 출처 | 추론에서의 무게 |
|---|---|---|---|
| `curated` | 문헌·큐레이션 데이터베이스에 근거 | `source` (PMID·DOI·UniProt·InterPro …) | 가장 높음 |
| `computed` | 도구가 구조·서열에서 계산 | `tool {name, version}` + `input` (지문 또는 서열 해시) — 다시 계산해 재현 가능해야 함 | 높음 |
| `asserted` | AI·사람이 적었지만 출처 없음 | – | 낮음 — 규칙은 보조 신호로만 사용 |
| `predicted` | 예측 모델의 출력 | `tool` + `confidence` (0–1) | 확신도에 비례 |

- AI 패치는 출처 없이 `curated` 를, 도구 정보 없이 `computed` 를 쓸 수 없다(관문에서 거부). AI 가 기억으로 적은 특징은 `asserted` 다.
- 외부 ID 의 `asserted`/`verified` 와 같은 원리를 특징 전체로 넓힌 것이다. 문헌 근거를 쓰려면 `vocab.js` 외부 ID 표에 `PMID`, `DOI` 를 추가한다.
- **가설은 특징이 아니다.** 가설은 4절의 별도 층에만 있고, 특징의 근거로 쓸 수 없다.

## 4. 가설 층

```json
"hypotheses": {
  "H000003": {
    "claim": { "type": "step", "payload": { "label": "…", "action": "인산화", "agents": [{ "ref": "D000040", "state": "C_free" }], "inputs": [{ "ref": "D0000xx", "state": "…" }], "outputs": [ … ], "part_of": [] } },
    "rationale": { "rule": "R-KIN-MOTIF", "fired": ["F000021", "F000057", "F000058"], "text": "PKA 인식 서열이 표적에 있고 같은 세포질에 있음" },
    "score": 0.41,
    "status": "open",
    "evidence": [ { "stance": "supports", "source": { "db": "PMID", "id": "…" }, "note": "" } ],
    "generated": { "by": "rule-engine 0.1", "at": "2026-10-08" }
  }
}
```

- `claim.payload` 는 패치 항목과 같은 모양이다. 그래서 검증된 가설은 같은 형식 그대로 사실 패치가 된다.
- `status`: `open` → `supported` / `refuted` → `promoted`(사실로 들어감) · `retired`.
- **자동 승격 금지.** 사실로 넣으려면 `curated` 근거를 단 일반 패치가 필요하고, 그 패치에 가설 번호를 적어 연결을 남긴다.
- 사실 화면·사슬·`context` 출력은 기본으로 가설을 빼고 보여 준다. "가정해 보기" 모드에서만 가설 단계를 점선으로 사슬에 넣는다.
- 반박된 가설도 지우지 않는다. 같은 가설이 다시 생기는 것을 막고, 규칙의 정확도를 재는 기록이 된다.

## 5. 추론 규칙 (`rules.js`, 사람이 검토)

어휘처럼 규칙도 사람이 검토한 파일에 둔다. 규칙은 특징·상태·단계를 조건으로 가설을 만든다.

| 규칙 | 조건 | 만드는 가설 |
|---|---|---|
| `R-KIN-MOTIF` | K 에 `catalytic_activity`=단백질 키네이스 + `substrate_specificity` 패턴 P / S 에 P 와 맞는 `sequence_motif`(computed) / 같은 맥락의 `localization` 겹침 | 단계: K(활성 상태) ⚙ S → S(인산화 상태) |
| `R-PHOS-REVERSE` | 인산화 단계는 있는데 그 부위를 되돌리는 탈인산화 단계가 없음 + 같은 맥락에 탈인산화효소가 있음 | 단계: 탈인산화효소 ⚙ S(인산화) → S |
| `R-DOMAIN-LIGAND` | A 가 도메인 X 로 L 에 결합(`binding_site`) / B 도 도메인 X 를 가짐 | 특징: B 가 L 에 결합 (가설로만) |
| `R-DEAD-END` (이상 탐지) | 어떤 상태가 만들어지기만 하고 어떤 단계에서도 쓰이지 않음 | "이 상태를 소비하는 단계가 빠졌을 수 있음" |
| `R-CONTEXT-CONFLICT` (이상 탐지) | 한 단계 참여자들의 `localization` 이 같은 맥락에서 겹치지 않음 | "위치가 맞지 않음 — 수송 단계가 빠졌거나 단계가 틀림" |

- **점수**: 발동한 특징들의 근거 수준 무게 × 규칙의 특이도 × (반박 기록이 있으면 감점). `asserted` 특징만으로 발동한 규칙은 점수 상한을 둔다.
- **이상 탐지 규칙**이 따로 있는 이유: 특징 기반 생성은 *예상되는* 기전에 치우친다. 실제 발견은 예외(겸업 단백질, 비정형 기질)에서 자주 나오므로,
  "현재 연결망으로 설명되지 않는 것" 을 찾는 규칙을 함께 돌린다.
- AI(LLM)는 규칙이 만든 후보의 순위를 매기고 설명을 붙이거나, 규칙에 없는 가설을 제안할 수 있다. 어느 쪽이든 결과는 가설 층으로만 간다.

## 6. 검사 규칙 (구현할 것)

1. `subject` 는 존재하는 정의항·상태, `type` 은 어휘, `value` 는 종류별 모양, 안의 참조는 모두 존재하는 번호.
2. `subject` 의 kind 가 종류의 허용 kind 에 포함.
3. 맥락 특징은 `context` 필수, `context.compartment` 는 어휘.
4. 근거 수준별 필수 출처 (3절). `confidence` 는 `predicted` 에만, 0–1.
5. 잔기 표기(`Ser14`), 패턴 문법(PROSITE 형식), 범위(`start ≤ end`) 형식 검사.
6. 상태의 수식 `{type, site}` ↔ 같은 정의항의 `modification_site` 특징 대응. 하나만 있으면 경고.
7. 같은 subject·type·value·context 의 특징 중복 금지.
8. 가설: `claim.payload` 는 그 자체로 패치 검사를 통과하는 모양, `fired` 는 존재하는 특징, 가설을 특징의 근거로 인용 금지.

## 7. AI 에게 주는 특징 카드

추론할 때는 후보마다 아래 같은 카드를 맥락에 넣는다. 이름이 아니라 특징과 근거가 신호가 된다.

```
D000044 글리코겐 인산화효소 {molecule_class} — EC 2.4.1.1
  상태  b(비인산화, 부분 활성) · a(인산화 Ser14, 활성)
  특징  modification_site Ser14 인산화, by D000043 인산화효소 키네이스 → 상태 a   [curated]
        localization 세포질 〈간세포〉                                            [asserted]
  기전  S000009 에서 b→a (행위자 인산화효소 키네이스@phos), S000011 에서 a→b (PP1)
  가설  (없음)
```

## 8. 시뮬레이션 다리

- **기전 수준**: 정의항+상태 → 분자 타입과 부위(부위는 `modification_site`·`binding_site` 특징에서), 단계 → 반응 규칙,
  `quantity` 특징 → 속도 매개변수. BioNetGen·Kappa 같은 규칙 기반 모델 형식으로 내보낸다.
  매개변수가 없는 반응은 목록으로 알려 주고, 가설 단계는 켜고 끌 수 있는 규칙으로 넣는다.
- **물리 수준**: `structure_ref` + `binding_site` → 도킹·분자동역학 작업 명세(어떤 구조, 어떤 사슬, 어느 부위). 계산은 외부 도구가 한다.
- **결과 회수**: 시뮬레이션 결과는 "관찰" 기록(어떤 모델·어떤 가설을 켰는지·결과)으로 돌아와 가설의 `evidence` 가 된다.
  시뮬레이션만으로 가설이 사실로 승격되지는 않는다.

## 9. 저장

지금처럼 `data/db.json` 의 `features`, `hypotheses` 구역으로 시작한다. 특징이 수만 개를 넘거나 구조 데이터가 들어오면 SQLite 로 옮긴다.

```
terms(id, ko, en)          senses(id, term, n, kind, field, …)      states(sense, key, …)
features(id, subject, type, value_json, context_json, level, source_json, confidence)
hypotheses(id, claim_json, rule, score, status)   hypothesis_features(hypothesis, feature)
steps(id, …)   step_participants(step, role, sense, state, minor)
```

## 10. 구현 순서

1. `vocab.js` 에 `featureTypes`, 근거 수준, `PMID`·`DOI` 외부 ID 추가 → 특징 레코드 정규화·검사·병합·관문, 테스트
2. 화면과 `context` 출력에 특징 표시, AI 지침에 특징 형식 추가, 7절의 특징 카드 출력 명령
3. 기존 데이터에 확실한 특징부터 채움 (예: 글리코겐 인산화효소 Ser14, PKA 인식 서열)
4. 가설 층 + `rules.js` + 규칙 엔진 (`R-DEAD-END`, `R-PHOS-REVERSE` 처럼 서열 없이 되는 규칙부터)
5. 서열·구조 도구 연동 (Python): 지문 계산, 모티프 스캔(`computed` 특징), 외부 데이터베이스 대조 → `R-KIN-MOTIF` 가능
6. 규칙 기반 모델 내보내기와 시뮬레이션

## 11. 정할 것 (사용자 결정)

- **종 범위**: 사람만 다룰지, 종을 맥락으로 함께 다룰지. 종에 따라 서열·잔기 번호가 달라진다.
- **문헌 근거**: `curated` 에 PMID·DOI 를 요구할지. 요구하면 이 환경에서는 원본 확인이 막혀 있어(네트워크) 당분간 `asserted` 가 대부분이 된다.
- **승격 승인**: 가설을 사실로 넣는 패치를 사람이 승인할지, 근거 수준만 맞으면 AI 가 넣을 수 있을지.
- **확신도 보정**: `predicted` 의 0–1 값을 어떤 기준으로 맞출지 (규칙별 반박 기록으로 사후 보정 가능).
