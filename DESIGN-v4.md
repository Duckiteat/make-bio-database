# 형식 v4 설계: 원천 중심 소유 + 위치 의존 기전 (초안 — 구현 전)

> 이 문서는 아직 구현되지 않은 설계다. 현재 코드와 데이터의 규칙은 `SCHEMA.md`(v3)가 정한다.
> 승인되면 이 문서를 바탕으로 `SCHEMA.md` 를 v4 로 고치고 `migrations/003` 으로 변환한다.

## 0. 원칙

1. **원천(정의항)이 속성을 소유한다.** 분류·구조 ID·외부 ID·부위·막 위상·규칙·설명·관찰은 모두 정의항(D)과 그 하위 번호가 가진다.
2. **결과(묶음 B, 단계 S)는 참조의 묶음이다.** 번호·어휘 키·파생 키만 가진다. 라벨·설명문을 갖지 않는다. 화면의 이름은 원천에서 조립한다.
3. **위치는 묶음의 정체성 일부다.** 같은 분자·같은 수식이라도 있는 곳이 다르면 다른 묶음이다. 그래서 위치가 다르면 이어지는 기전도 달라진다.
4. 피정의항(T)은 이름 보따리다. 소속 정의항 목록은 계산으로 얻는다.

## 1. 층과 소유권

| 층 | 번호 | 갖는 것 | 갖지 않는 것 |
|---|---|---|---|
| 피정의항 | `T000001` | names{ko,en}, aliases | 그 밖의 모든 속성 |
| 정의항(원천) | `D000001` | 정체성(kind, fingerprint, xrefs), 막 위상, 하위 객체(아래) | – |
| └ 설명 | `D…/desc/n` | 문장, field, 구조화된 context, genus, links, 근거 | |
| └ 부위 | `D…/site/키` | 잔기·범위, 부위 종류, 막에서 향하는 면(face), 허용 특징 | |
| └ 규칙 | `D…/rule/n` | 상태 의미 규칙, 촉매·결합 규칙, 적용 위치 조건, 설명, 근거 | |
| └ 관찰 | `D…/obs/n` | 속성·값·단위·맥락·근거 (위치 분포, 발현, Km …) | |
| 특징 유형 | 어휘 `F` | phosphorylation, GTP-bound … (공유 정의) | |
| 위치 | 어휘 `L` | 위치 계층, 3D/2D 구분, 인접 관계 | |
| 묶음(결과) | 파생 키 | `D + 정렬된(site:feature) + location` | 라벨·설명·활성값(계산함) |
| 단계(결과) | `S000001` | 적용한 규칙 번호, 입력·출력·행위자 묶음 | label·text (규칙이 소유) |
| 가설 | `H000001` | 대상 번호, 근거 규칙, 점수, 상태 | |

## 2. 정의항 내부

```json
"D000030": {
  "term": "T000028", "n": 1, "kind": "molecule_class",
  "xrefs": [], "fingerprint": null,
  "membrane": { "association": "integral", "location": "L:plasma_membrane" },
  "desc":  [ { "text": "에피네프린과 결합하면 Gs 단백질을 활성화하는 세포막 수용체", "field": "세포생물학",
               "context": { "scope": "간·근육 세포", "species": null, "tissue": null, "cell": null, "condition": null },
               "genus": "D000025", "links": [ … ], "evidence": { "level": "asserted" } } ],
  "site":  { "ligand":   { "type": "binding_site", "face": "extracellular", "ligand": "D000027" },
             "coupling": { "type": "binding_site", "face": "cytosolic",     "ligand": "D000029" } },
  "rule":  [ { "id": "1", "type": "state_meaning", "when": { "ligand": "bound" }, "then": { "activity": "active" } },
             { "id": "2", "type": "catalysis", "action": "뉴클레오타이드 교환", "via_site": "coupling",
               "target": "D000029", "change": { "add": ["GTP-bound"], "remove": ["GDP-bound"] },
               "where": ["L:plasma_membrane"],
               "text": "활성 수용체가 Gs 의 α 소단위에서 GDP 를 내보내고 GTP 가 붙게 한다. 수용체는 그대로 남아 다른 Gs 를 계속 활성화한다." } ],
  "obs":   []
}
```

- **설명이 여러 개일 수 있다.** 같은 실체의 교과서 정의와 생화학 정의는 정의항 하나 안의 `desc` 두 개다.
  외연(가리키는 범위)이 다른 뜻(효소#1 단백질 촉매 / 효소#2 리보자임 포함)은 지금처럼 다른 정의항이다.
- **genus**: 정의가 기대는 상위 개념 번호. `is_a` 연결과 같아야 한다(검사).
- **차이(종차)**는 문장에서 뽑아 부위·규칙·관찰로 옮긴다.
- **context** 는 구조화한다: `{scope, species, tissue, cell, condition}`. tissue·cell 은 어휘(추가할 표).

## 3. 위치 모델

### 3.1 위치 어휘 (L) — 계층과 차원

| 키 | 이름 | 차원 | 부모 | 인접(경계를 맞댐) |
|---|---|---|---|---|
| `L:extracellular` | 세포 밖 | 3D | – | plasma_membrane(바깥면) |
| `L:plasma_membrane` | 세포막 | 2D | – | extracellular, cytosol |
| `L:lipid_raft` | 지질 뗏목 | 2D | plasma_membrane | (부모와 같음) |
| `L:cytosol` | 세포질 | 3D | – | plasma_membrane(안쪽면), 각 소기관 막의 바깥면 |
| `L:glycogen_granule` | 글리코겐 과립 | 3D(미세영역) | cytosol | (부모와 같음) |
| `L:nuclear_envelope` | 핵막 | 2D | – | cytosol, nucleoplasm |
| `L:nucleoplasm` | 핵질 | 3D | – | nuclear_envelope |
| `L:er_membrane` / `L:er_lumen` | 소포체 막 / 내강 | 2D / 3D | – | cytosol ↔ er_membrane ↔ er_lumen |
| `L:mito_outer` / `L:mito_ims` / `L:mito_inner` / `L:mito_matrix` | 미토콘드리아 외막 / 막사이공간 / 내막 / 기질 | 2D/3D/2D/3D | – | 순서대로 인접 |
| `L:golgi_membrane`, `L:golgi_lumen`, `L:endosome_membrane`, `L:endosome_lumen`, `L:lysosome_lumen` … | | | | |

- **차원**: 3D(부피) 위치의 분자와 2D(막 표면) 위치의 분자는 시뮬레이션에서 농도 단위·반응 속도 취급이 다르다
  (규칙 기반 모델의 compartment 확장이 부피/표면을 구분하는 것과 같다).
- **부모(특수 위치)**: 지질 뗏목·글리코겐 과립·시냅스 같은 미세영역은 부모 위치 안의 특수 위치다.
  부모에서 성립하는 규칙이 특수 위치에서도 성립하는지는 규칙의 `where` 가 정한다(자동 상속하지 않음 — 특수 위치는 기전이 다를 수 있으므로).
- **인접**: 막(2D)과 그 양쪽 부피(3D)만 인접하다. 서로 다른 부피끼리는 직접 반응할 수 없다(수송 단계가 필요).

### 3.2 막 위상 — 정의항이 소유하는 고유 성질

```
membrane.association : soluble | integral(막관통) | peripheral(막 표면 결합) | lipid_anchored(지질 고정)
membrane.location    : 그 분자가 박히는 막 (L 의 2D 위치)
site.face            : extracellular | cytosolic | lumenal | transmembrane   (막 단백질 부위가 향하는 쪽)
```

- 막관통 수용체: 리간드 결합 부위는 바깥면, G 단백질 결합 부위는 안쪽(세포질)면.
- 지질 고정 단백질(Gs): 세포막 안쪽면에 붙어 있다.
- 수용성 단백질: 부피 위치(세포질·핵질 …)에 있다.

### 3.3 묶음의 위치

```
묶음 키 = D000044 | Ser14:phosphorylated | L:cytosol
```

- 위치는 묶음 키에 반드시 들어간다.
- 위치는 분자의 막 위상과 맞아야 한다: integral·lipid_anchored·peripheral → 2D 위치, soluble → 3D 위치. 어긋나면 오류.

### 3.4 위치가 기전을 바꾸는 네 가지 방식 (모두 검사 규칙으로 강제)

1. **공간 접촉 검사** — 한 단계에서 상호작용하는 두 묶음은 같은 위치이거나 인접해야 하고,
   막 단백질의 부위를 통해 상호작용하면 상대는 그 부위가 향하는 쪽에 있어야 한다.
   - 에피네프린(세포 밖) ↔ 수용체 `site/ligand`(바깥면) : 통과
   - 수용체 `site/coupling`(안쪽면) ↔ Gs(세포막 안쪽면) : 통과
   - 에피네프린(세포 밖) ↔ PKA(세포질) : **거부** — 부피끼리는 막을 건너 직접 반응할 수 없다
2. **위치 조건이 붙은 규칙** — 원천의 규칙에 `where` 를 단다. 그 위치의 묶음에만 그 규칙(기전)이 적용된다.
   같은 효소라도 세포질형과 막 결합형의 기질이 다르면 규칙을 따로 둔다.
3. **수송 단계** — action `수송`(또는 막 삽입·이탈)은 위치만 바꾸고 특징은 그대로 둔다.
   반대로 수송이 아닌 단계에서 같은 분자의 위치가 바뀌면 오류. 위치 변화도 단계의 변화량(델타)으로 자동 계산된다.
4. **위치가 다르면 사슬이 갈라진다** — 묶음 키에 위치가 있으므로, 세포질의 PKA 촉매 소단위와 핵으로 들어간 촉매 소단위는
   다른 묶음이고 각자 다른 다음 단계(다른 기질)로 이어진다.

### 3.5 위치 관찰

"이 단백질이 간세포에서는 주로 세포질에 있다" 같은 분포 정보는 묶음이 아니라 원천의 관찰(`D…/obs/n`, 맥락 포함)이다.
묶음의 위치는 "이 단계에서 이 풀(pool)이 어디 있었나" 이고, 관찰은 "실험에서 어디서 보였나" 다.

## 4. 단계 (S) 형식

```json
"S000001": { "rule": "D000030/rule/2",
             "agents":  ["D000030|ligand:bound|L:plasma_membrane"],
             "inputs":  ["D000029|GDP-bound|L:plasma_membrane", "D000035|L:cytosol*"],
             "outputs": ["D000029|GTP-bound|L:plasma_membrane", "D000036|L:cytosol*"],
             "part_of": ["D000050"] }
```

- 단계는 "이 규칙이 이 묶음들에 적용되었다" 는 기록이다. 이름·설명은 규칙(`D…/rule/n`)에서 가져온다.
- 변화량은 입력·출력 묶음 키의 차이로 계산된다: 추가·제거된 특징, 형성·해제된 결합, 위치 변화.
- 검사: 변화량이 규칙의 `change` 와 일치, `action` 과 일치(인산화는 phosphorylation 추가 …), 3.4 의 위치 검사, 규칙의 `where` 조건.
- `*` 는 부산물 표시(사슬을 잇지 않음).

## 5. 현재 데이터 변환 계획

### 5.1 정의항 병합
없음. 뜻이 여러 개인 개념은 효소(#1 좁은 뜻 / #2 넓은 뜻)와 유전자(#1 분자생물학 / #2 고전 유전학)뿐이고 둘 다 외연이 다른 별개의 뜻이다.

### 5.2 막 위상

| 정의항 | association | 막 | 부위·면 |
|---|---|---|---|
| β-아드레날린 수용체 D000030 | integral | 세포막 | ligand(바깥면, 에피네프린), coupling(안쪽면, Gs) |
| Gs 단백질 D000029 | lipid_anchored | 세포막(안쪽면) | nucleotide(GDP/GTP 결합 부위) |
| 아데닐산 고리화효소 D000031 | integral | 세포막 | catalytic(안쪽면), Gs 결합(안쪽면) |
| 나머지 분자 | soluble | – | – |

### 5.3 상태 → 부위 + 규칙 + 묶음

| 현재 상태 | 부위 | 상태 의미 규칙 | 묶음 (위치 포함) |
|---|---|---|---|
| 수용체 inactive / active | ligand | ligand:bound → active | `D030|L:pm`, `D030|ligand:bound|L:pm` |
| Gs GDP / GTP | nucleotide | GTP-bound → active | `D029|GDP-bound|L:pm`, `D029|GTP-bound|L:pm` |
| AC inactive / active | gs_binding | gs_binding:bound → active | `D031|L:pm`, `D031|gs_binding:bound|L:pm` |
| PKA R2C2 / C_free | (복합체 해리) | 아래 주의 | `D042|L:cytosol`, `D042|dissociated|L:cytosol` |
| PhK unphos / phos | 잔기 미상 | phosphorylated → active | `D043|unspecified:phosphorylated|L:cytosol` |
| GP b / a | Ser14 | Ser14:phosphorylated → active, 없으면 partial | `D044|L:cytosol`, `D044|Ser14:phosphorylated|L:cytosol` |

- **잔기를 모르는 인산화**(PhK)는 `unspecified` 부위로 명시한다. 잔기를 지어내지 않는다.
- **PKA 주의**: 활성화는 조절 소단위와 촉매 소단위가 갈라지는 해리다. 엄밀하게는 홀로효소(복합체)·조절 소단위·촉매 소단위가
  각각 원천이 되어야 한다(2절 기준: 부분으로 계산되지 않는 성질을 가진 것은 정의항). 1차 변환에서는 `dissociated` 특징으로 두고
  경고를 남긴 뒤, 소단위 정의항을 추가하는 패치로 고친다.
- 글리코겐 인산화효소와 인산화효소 키네이스는 실제로 글리코겐 과립에 모여 있다. 1차 변환에서는 `L:cytosol` 로 두고,
  글리코겐 과립 위치를 쓸지는 자료가 들어올 때 정한다.

### 5.4 단계 → 규칙 + 묶음, 위치 바로잡기

| 단계 | 현재 기록 위치 | v4 참여자 위치 | 규칙 소유자 |
|---|---|---|---|
| S000001 수용체 활성화 | 세포막 (하나) | 에피네프린 **세포 밖**, 수용체 세포막 | 수용체(리간드 결합 규칙) |
| S000002 Gs 활성화 | 세포막 | 수용체·Gs 세포막, GTP·GDP 세포질 | 수용체(rule 2) |
| S000003 AC 활성화 | 세포막 | Gs·AC 세포막 | Gs |
| S000004 Gs 자체 비활성화 | 세포막 | Gs 세포막, 무기 인산 세포질 | Gs(자체 GTP 가수분해) |
| S000005 cAMP 합성 | 세포막 | AC 세포막, **ATP·cAMP 세포질** | AC |
| S000006 PKA 활성화 | 세포질 | 세포질 | PKA(cAMP 결합 규칙) |
| S000007 cAMP 분해 | 세포질 | 세포질 | 포스포다이에스터레이스 |
| S000008 PhK 활성화 | 세포질 | 세포질 | PKA |
| S000009 GP 활성화 | 세포질 | 세포질 | PhK |
| S000010 가인산분해 | 세포질 | 세포질 | GP |
| S000011 GP 비활성화 | 세포질 | 세포질 | PP1 |

변환 후 3.4 의 공간 접촉 검사를 돌리면 위 11단계는 모두 통과해야 한다(S000001·S000005 는 막과 인접 부피 사이 상호작용).
단계의 `label`·`text` 는 규칙 소유자의 규칙 설명으로 옮긴다.

## 6. 추가할 검사 규칙

1. T 는 names·aliases 외의 속성을 가질 수 없다. B·S 는 라벨·설명문을 가질 수 없다.
2. 하위 번호(`D…/site/키`, `D…/rule/n`, `D…/desc/n`, `D…/obs/n`) 형식, 소유자 존재, 재사용 금지.
3. `desc.genus` 는 그 정의항의 `is_a` 대상 중 하나.
4. 막 위상 ↔ 묶음 위치 차원 일치. 부위의 `face` 는 막 단백질에만.
5. 묶음 특징은 그 원천의 부위에 정의된 허용 특징만. 같은 부위에 특징 둘 금지.
6. 단계: 규칙 존재, 변화량 = 규칙의 change, action 일치, 위치 조건(`where`), 공간 접촉(3.4-1), 수송 외 위치 변화 금지(3.4-3).
7. 활성 등 상태 의미는 묶음에 쓰지 않고 원천 규칙으로 계산. 묶음에 붙은 관찰이 규칙의 계산과 어긋나면 경고(이상 탐지 — 발견의 단서).

## 7. 구현 순서

1. 어휘: 위치 계층(L)·특징 유형(F)·막 위상·face·tissue·cell 표 추가
2. core: 정의항 하위 객체, 묶음 키 파생, 단계 변화량 계산, 6절 검사, 이름·상태 이름 → 묶음 키 매핑
3. `migrations/003-v3-to-v4.mjs`: 5절 표대로 변환 (막 위상·부위·규칙은 변환 스크립트에 명시한 표로)
4. 테스트: 6절 각 규칙의 거부 테스트 + 공간 접촉 사례(에피네프린→PKA 직접 반응 거부 등)
5. 화면·`context`·`mechanism`·AI 지침을 v4 형식으로
6. `SCHEMA.md` v4, `FEATURES.md` 정리, 변경 기록

## 8. 정할 것

- **종(species)**: context 에 넣을 종의 기본값을 사람으로 둘지, 비워 두고 필수로 할지.
- **위치 어휘 범위**: 3.1 표로 시작하고 필요할 때 늘린다(사람이 검토해 추가) — 이 방식으로 괜찮은지.
- **PKA 소단위 분리**: 1차 변환에서 바로 소단위 정의항까지 만들지, 경고로 남기고 다음 패치로 고칠지.
