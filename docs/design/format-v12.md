# 형식 v12 명세 — 값 층 분리 (결정 A: 정의 그래프 유지, 값·증거·맥락·번호 개편)

상태: **1차 구현됨 (2026-10-15)** — §2·§3·§7 과 두 시간(recorded_at·asOf). **남음**: §4 정성 관찰·실험 묶음, §5 맥락 열쇠 정준화, §6 번호 이동, evidence_at 채우기. 구현에서 정한 것: 값의 `context` 는 기존 맥락 모양 그대로 저장하고(자유 문장 condition 포함), 열쇠 정준화는 §5 단계에서. 패치 작성법은 그대로(obs·kinetics) — 병합이 값 기록으로 접는다. 근거: `integral-field-engine.md` §17, `build-plan.md` 6·13·14 를 흡수. 그릇(조각 저장·색인)은 15–19 에서 따로.

## 0. 왜

지금 값은 정의 구조 안에 끼어 있다 — 정의항 `obs`(52 개: 서열 길이 46 · 구획 부피 3 · 농도 2 · 복사 수 1)와 규칙 `kinetics`(2 개). 앞으로 가장 많이 늘고(정의항 20 만 × 속성 × 맥락 × 개정) 가장 자주 형식이 바뀌는 것이 값이므로, 값을 독립된 층으로 빼서 분포·두 시간·출처·철회 전파를 한 곳에서 다룬다. 정의 그래프(T·D·연결·부위·규칙·단계·묶음·세포 상태)는 안정적이고 관문·래칫이 이 모양에 맞춰 있으므로 그대로 둔다.

## 1. 층과 최상위 키

| 층 | 키 | v10 → v12 |
|---|---|---|
| 법칙 | `vocab.js` | `contextKeys`·`valueProperties`·`qualitativeExpectations` 추가 |
| 정의 | `terms` · `senses` · `steps` · `limitations` | 정의항 `obs` 삭제(→ 값), 규칙 `kinetics` 는 **법칙 모양만** 남김(`{ law, order }`) |
| 값 | **`values`** (새, 번호 V…) | 정의항 `obs` + 규칙 `kinetics` 의 수치가 여기로 |
| 증거 | `observations` (O…) | 정성 관찰 · 실험 묶음 · 근거 시각 추가 |
| 번호 | **`moved`** (새) | 병합·분리된 번호의 이동 표시 |
| 메타 | `meta.next` | `V` 추가 |

층 사이 참조는 한 방향: 값 → 정의(대상) · 값 → 증거(`from`) · 증거 → 정의(측정량 대상). 정의는 값·증거를 가리키지 않는다.

## 2. 값 기록 `values.V…`

```json
{
  "subject": "D000165/rule/synthesis",
  "property": "k",
  "context": { "species": "9606", "cell": null, "location": "cytosol", "condition": null, "temperature_K": null, "pH": null },
  "value": { "dist": "normal", "mean": 1.2e-3, "sd": 1e-4, "unit": "s^-1" },
  "from": ["O000004"],
  "derivation": "direct",
  "evidence": { "level": "curated", "sources": [{ "db": "DOI", "id": "…", "citation": "…" }] },
  "evidence_at": "2019",
  "recorded_at": "2026-10-15T12:00:00.000Z",
  "supersedes": null
}
```

- **열쇠** = (`subject`, `property`, 정준 `context`). 같은 열쇠의 **현재 값** = 철회되지 않고 다른 값이 대체하지 않은 마지막 기록. 열쇠는 조각 저장·색인·SBML 매개변수 대응의 단위다.
- `subject`: 정의항 `D…` · 규칙 `D…/rule/키` · 묶음 키 · 위치(`vocab.locations`). 이 밖은 거부.
- `property`: `vocab.valueProperties` 만 — 지금의 `obsProperties`(서열 길이·복사 수·구획 부피·농도 …) + 속도 칸(`k`·`k0`·`k_r`·`kcat`·`Km`·`k_on`·`k_off`·`Kd`·`half_life`·`dG0`·조절 `K`·`n`·`fmax`·`fmin`). 속성마다 정준 단위와 허용 대상 종류를 어휘에 적는다.
- `value.dist`: `point`(mean만, 도구 계산·정의 사실) · `normal`(mean·sd) · `lognormal`(mean·sd, ln 척도 sd 를 함께 적음) · `interval`(low·high) · `categorical`(level). 단위는 정준 SI 만, 값은 `vocab.physicalBounds` 안.
  불확도를 보고하지 않은 문헌 값은 sd = 유효 숫자 해상도, `note` 에 그 사실(기존 규약).
- `from`: 근거 관찰 번호들. 측정량이 있는 속성의 문헌 값은 필수(기존 v11 규약 — 이제 값 하나의 규칙). `derivation`: `direct` · `unit_conversion` · `lumped`(매개 단계를 묶어 맞춘 상수, 원 관찰 필수) · `computed`(도구가 원본에서 계산).
- **두 시간**: `evidence_at` = 근거가 말하는 시각(논문 연도 또는 측정일, ISO 일부 허용) · `recorded_at` = 이 저장소에 기록한 시각. `recorded_at` 은 **병합 전에 dbtool 이 패치에 찍고 관문이 봉인한다** — 그래서 사건 기록을 재생하면 같은 값이 나온다(결정론). "그날 기준의 db" = `recorded_at ≤ 그날` 인 기록으로 계산한 현재 값.
- **값은 바꾸지 않는다**(관찰과 같은 규약): 고칠 때는 새 기록이 `supersedes: 'V…'` 로 이전 기록을 대체하고, 틀린 기록은 `retracted { note, evidence }` 를 더한다. 이것이 매개변수의 델타 이력이다.
- **등급은 저장하지 않는다**: 신뢰 지표가 `evidence`·`from`·도장에서 계산한다(기존 규약).

## 3. 규칙 `kinetics` (정의 층에 남는 것)

`{ "law": "binding" | "mass_action" | "michaelis_menten" | "zero_order" | …, "order": 정수? }` — 어떤 법칙인지(구조)만. 수치(k·Kd·kcat …)는 값 층의 (`D…/rule/키`, 칸, 맥락) 기록. 엔진·컴파일러·사법부는 **하나의 접근자** `model.kineticsOf(db, 규칙, 맥락)` 로 법칙 + 현재 값을 합친 지금 모양의 객체를 받는다 — 읽는 자리를 한 곳으로 모아, 바꾼 뒤에도 시뮬레이션 결과가 비트 단위로 같게 한다.

## 4. 관찰 `observations.O…` 확장

- `kind`: `quantitative`(기존 필드 그대로) · **`qualitative`**(새):
  ```json
  { "kind": "qualitative", "perturbation": { "type": "knockout", "target": "D000189" },
    "readout": { "kind": "amount", "target": "D000201|plasma_membrane" }, "expect": "decrease",
    "condition": { "species": "9606", "cell": "dendritic_cell" }, "quote": "원문 구절 그대로",
    "provenance": { "source": { "db": "DOI", "id": "…" } }, "use": "validation", "experiment": "…" }
  ```
  `expect`: `increase` · `decrease` · `present` · `absent` · `no_change` · `{ order: [사건, 사건] }` · `monotone_increase` · `monotone_decrease` (`vocab.qualitativeExpectations`). 교란 형식은 `compiler/perturb.js` 와 같다. 출처 DOI·PMID 와 원문 구절(`quote`)은 필수 — 교과서·추론은 정성 관찰이 될 수 없다(후보는 한계·메모로).
- `experiment`: 같은 실험(같은 논문의 같은 실험계)의 관찰을 묶는 문자열 — 독립 판정(M3)·결합 판정의 단위.
- `evidence_at`: 측정·출판 시각. 관찰도 `recorded_at` 은 병합 때 찍는다.
- 불변·철회·추정/검증 분리 규약 그대로.

## 5. 맥락 열쇠 `vocab.contextKeys`

`species`(NCBI taxon, 필수) · `cell`(어휘 `cells`) · `location`(어휘 `locations`) · `condition`(정의항 번호 목록 — 자극·약물 등, 없으면 null) · `temperature_K` · `pH`. 이 여섯만, 빈 칸은 `null` 로 채워 **정준 문자열**(키 정렬 JSON)을 만든다. 자유 문장은 `note` 로 — 열쇠에 들어가지 않는다. 다른 맥락의 값·관찰은 섞지 않는다(맥락 이전은 V8 로만).

## 6. 번호 이동 `moved`

`{ "D000123": { "to": ["D000045"], "kind": "merge" | "split", "at": "…", "why": "…" } }`. 번호는 재사용하지 않는다. 새 패치가 이동된 번호를 가리키면 관문이 거부하고 이동 대상을 알려 준다. 조회(`map`·`resolveRef`)는 이동을 따라간다.

## 7. 형식 변환 v10 → v12 (`migrations/010-v10-to-v12-values.mjs`)

- 정의항 `obs` 52 개 → 값 기록(대상 = 그 정의항, 속성·단위·맥락·근거·`from` 그대로, `dist` 는 근거가 도구 계산이면 `point`, 문헌이면 기존 sd 규약으로 `normal`).
- 규칙 `kinetics` 2 개 → 법칙 모양은 규칙에, 칸마다 값 기록.
- `recorded_at` = 기원 체크포인트 시각, `evidence_at` = 근거에서 읽을 수 있으면 그 연도, 없으면 null.
- 사건 기록: 변환을 **사건 종류 `migration`**(스크립트 경로·sha256, 전후 db sha256)으로 사슬에 추가. 재생은 그 스크립트의 순수 함수(`transform(db) → db`)를 다시 돌려 같은 해시를 확인한다 — 형식 변환도 재현된다.
- 끝나는 조건: ① 모든 예제 시나리오의 운명·속도 시뮬레이션 결과가 변환 전후 **비트 단위로 같음** ② `validate` 오류 0 ③ `grade` 분포 같음 ④ 시험 전부 ⑤ 재생 = 지금 db ⑥ 거부 말뭉치에 v12 위반(값 수정, 맥락 열쇠 밖, 이동 번호 참조, 정성 관찰 구절 없음) 추가.

## 8. 바뀌는 코드 (영향)

| 자리 | 바뀜 |
|---|---|
| `model.js` | 정규화(값·이동·정성 관찰), 접근자 `kineticsOf`·`valuesOf`·`currentValue`·`contextKey`, 색인(값 열쇠·역참조) |
| `vocab.js` | `contextKeys`·`valueProperties`(= obsProperties + 속도 칸)·`qualitativeExpectations` |
| `legislative/` | 병합: 값 추가·대체·철회, `recorded_at` 확인, 이동 |
| `judicial/` | 값 검사(열쇠·단위·상한·from 대조 — 기존 `checkSenseObsFrom`·`checkKineticsFrom` 을 값 하나의 검사로 합침), 값·관찰 불변, 이동 번호 참조 거부, 정성 관찰 검사, 신뢰 지표가 값 층을 읽음 |
| `compiler/` · `core.js` | 상수를 `kineticsOf` 로만 읽음(결과 비트 동일) |
| `dbtool` · 뷰어 | 조회·출력이 값 층을 읽음 (`viewer.html` = `index.html`) |
| 시험 | 값 모양을 쓰는 시험 갱신 + v12 거부 말뭉치 |

## 9. 정할 것 (승인 시)

1. 값 불변(대체·철회만) — 추천 **예**.
2. `recorded_at` 은 병합 전에 dbtool 이 찍어 봉인 — 추천 **예**(재생 결정론).
3. 맥락 `condition` 은 정의항 번호 목록 — 추천 **예**(자유 문장은 열쇠 밖).
4. 규칙 `kinetics` 에 법칙 모양만 남기기 — 추천 **예**(법칙은 구조, 수치는 값).
5. 정성 관찰의 출처는 DOI·PMID + 원문 구절 필수 — 추천 **예**.
