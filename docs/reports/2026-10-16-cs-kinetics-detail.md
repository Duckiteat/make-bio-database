# 상세 보고서 — 사람 시트르산 생성효소 실측 속도 상수 (BRENDA route 1, 2026-10-16)

판정 수준: **자원 입력(실측 상수 추가)**. 이건 관찰과의 "일치 판정"이 아니라, 등급 붙은 실측값을 모델에 넣은 것 — 적분 장이 쓸 자원. 값은 지어내지 않았고 모두 출처·해시로 추적된다.

## 1. 무엇을, 어디서
- 대상 규칙: `D000149/rule/condense` — 시트르산 생성효소(EC 2.3.3.1). 반응: 아세틸-CoA + 옥살로아세트산 → 시트르산 + CoA.
- 출처: **BRENDA** SOAP API (사용자 계정). EC 2.3.3.1, Organism = Homo sapiens. 문헌 번호 756131 → **PMID 31141475** (Schlachter CR, Klapper V, Radford T, Chruszcz M. 2019, *Biol Chem*, DOI 10.1515/hsz-2019-0106 — 사람 CS 와 A. fumigatus 2-메틸시트르산 생성효소 비교 구조·동역학).
- 증거 사본: `data/fetched/brenda/EC2.3.3.1-Homo-sapiens.json` (sha256 `0f971698dbecc089df10c159cf13190582de12e5e16d69d2e46880869c873853`) — getTurnoverNumber·getKmValue 응답 그대로.

## 2. BRENDA 가 준 사람 레코드 전체 (16건)
| 종류 | 값 | 기질 | 효소 | pH | 온도 |
|---|---|---|---|---|---|
| kcat | **260 /s** | **아세틸-CoA** | **WT** | 8.0 | 미기재 |
| kcat | 208 /s | 옥살로아세트산 | WT | 8.0 | 미기재 |
| kcat | 117 /s | 아세틸-CoA | 변이 A348G | 8.0 | 미기재 |
| kcat | 111 /s | 옥살로아세트산 | 변이 A348G | 8.0 | 미기재 |
| Km | **0.0077 mM (7.7 µM)** | **아세틸-CoA** | **WT** | 8.0 | 미기재 |
| Km | 0.0036 mM (3.6 µM) | 옥살로아세트산 | WT | 8.0 | 미기재 |
| Km | 0.0104 mM | 아세틸-CoA | 변이 A348G | 8.0 | 미기재 |
| Km | 0.0057 mM | 옥살로아세트산 | 변이 A348G | 8.0 | 미기재 |
(각 레코드가 BRENDA 에 중복 2행으로 와서 원래 8+8 = 16행, 위는 중복 제거.)

## 3. 어느 값을 골랐나 — 그리고 왜
- **WT 만** 사용(변이 A348G 제외). 야생형이 모델의 정상 효소.
- **아세틸-CoA 쌍**(kcat 260, Km 7.7 µM)을 규칙에 건다. 이유: `core.js` 의 MM 속도식은 **첫 law 입력의 Km** 을 쓴다(`v = kcat·s0/(Km+s0)`, s0 = 첫 입력 농도). condense 입력 순서가 [아세틸-CoA(D000134), 옥살로아세트산(D000136)]이라 첫 입력 = 아세틸-CoA. 그래서 아세틸-CoA 로 잰 kcat·Km 쌍이 자기일관적.
- 옥살로아세트산 값(kcat 208, Km 3.6 µM)과 변이값은 증거 파일에 남고 규칙엔 미사용.

## 4. 넣은 관찰 (실측값은 관찰 먼저, 규칙이 참조)
```
O000023  kinetic_constant D000149/rule/condense · kcat = 260 s^-1
         불확도 {measurement, normal, sd 10}  반복 1  조건 {종 9606, 위치 mito_matrix}
         용도 estimation  근거 curated(DOI 10.1515/hsz-2019-0106 · PMID 31141475)
         provenance {source PMID:31141475, sha256 0f971698…}  recorded_at 2026-10-16T08:19:11Z
O000024  kinetic_constant D000149/rule/condense · Km = 7.7e-6 M
         불확도 {measurement, normal, sd 1e-7}  나머지 동일
```
- 불확도: BRENDA 는 점값만 주고 SD 미보고 → 규약대로 **sd = 유효 숫자 해상도**(kcat 260→10, Km 7.7 µM→0.1 µM), note 에 명시.
- 이미 있던 CS 관찰: `O000007` Km 3.6 µM(옥살로아세트산, UniProt 큐레이션) · `O000008` dG0 −35.9 kJ/mol(eQuilibrator 계산). **condense 는 Km·dG0 는 있었으나 kcat 이 없어 MM 법칙을 못 걸고 있었다** — BRENDA 의 kcat 이 그 빠진 조각.

## 5. 규칙에 건 법칙 (보기)
```json
{"law":"michaelis_menten","kcat":260,"Km":7.7e-6,
 "context":{"scope":"사람 CS (EC 2.3.3.1) — BRENDA, 아세틸-CoA 변화 기질, WT, pH 8.0 (온도 미기재)","species":"9606","location":"mito_matrix"},
 "from":[{"param":"kcat","obs":"O000023"},{"param":"Km","obs":"O000024"}],
 "evidence":{"level":"curated","sources":[DOI 10.1515/hsz-2019-0106, PMID 31141475]}}
```
사법부 검사(checkKineticsFrom): from 의 관찰이 같은 규칙·같은 칸·같은 값(260·7.7e-6)·같은 종(9606)·같은 위치(mito_matrix)인지 대조 — 통과.

## 6. 등급 (계산값, 데이터에 쓰지 않음)
- 관찰 O000023·O000024: **S3 D4** (출처 식별자 DOI·PMID → S3, 불확도+반복≥1 → D4).
- 규칙 kinetics: **S3 D3 → parameter** (주 매개변수로 사용 가능; 추세 미점검이라 anchor 아님). 보고 시 이 등급을 함께 밝힌다.

## 7. 시뮬레이션 전후 (rate, `tca-measured-kinetics` 시나리오)
- **전**: condense(단계 S000031)가 속도 상수 없음 → 사건 기반 즉시 처리. AUDIT_KINETIC_GAP 가 "kcat·Km (D000149/rule/condense) 채우라"(L000038·L000096)고 지적.
- **후**: S000031 = `michaelis_menten [data] kcat=260 Km=7.7e-6` 로 rate-active. 회로가 MM 율속으로 돌고(진행량 3289 바퀴/60 s, 가상 농도), kinetic gap 목록에서 빠짐.
- 한계 진행: **L000038 2/8 → 3/8**, **L000096 0/6 → 1/6** (condense 몫 메움).
- 질량 수지 위반 없음(AUDIT_MASS 0). 아세틸-CoA 재생 경로 없음은 기존 Resource_Gap (가상 시나리오).

## 8. 교차 확인
- BRENDA Km(아세틸-CoA 7.7 µM, 옥살로아세트산 3.6 µM) = UniProt O75390 Km(7.7·3.6 µM) — 같은 1차 문헌(PMID 31141475)에서 두 DB 가 독립 큐레이션, 값 일치.

## 9. 근사·한계 (정직하게)
- **단일 기질 MM**: 모델은 아세틸-CoA 한 기질로만 MM, 옥살로아세트산은 포화 가정. 실제 CS 는 순서 bi-bi. → 규칙 text 에 명시.
- **pH 8.0 assay**: 측정 pH 8.0 은 미토콘드리아 기질 pH(≈7.8)와 가깝지만 같지 않다. 온도는 원문·BRENDA 모두 미기재 → `temperature_K` 안 적음.
- **사람 kcat 희소**: 같은 방식으로 다른 TCA 효소를 시도했으나 BRENDA 에 사람 kcat 이 거의 없다 — 석시닐-CoA 합성효소·석신산 탈수소효소·말산 탈수소효소 사람 kcat 0건(MDH 는 사람 Km 6건만). 대부분 kinetics 가 돼지·소·세균 → 사람 상수로 쓰지 않음. → L000110.

## 10. 거버넌스 자취
- 패치 3: `20261016-cs-kinetics.json`(관찰 2 + condense MM) · `20261016-L110-brenda.json`(한계 갱신). 사건 사슬 #14·#15, 재생 = 지금 db.
- 증거는 `evidence` 구역(data/fetched/brenda/), db·patches 는 `registry` 구역(관문 봉인).
- **자격증명 처리**: BRENDA 비밀번호는 API 에 **SHA256 해시로만** 전달. 평문·해시 어느 것도 저장소·커밋·로그·db 에 없음(스크래치패드 자격 파일은 작업 후 삭제, `grep` 0건 확인). 관찰은 BRENDA 항목·PMID 만 인용.

## 11. 재현
```
# (BRENDA 자격은 환경에서) EC 2.3.3.1 Homo sapiens kcat·Km 조회 → data/fetched/brenda/EC2.3.3.1-Homo-sapiens.json
node dbtool.mjs simulate D000148 --rate --scenario examples/scenarios/tca-measured-kinetics-hypothetical.json --t 60   # S000031 이 MM [data] 로
node dbtool.mjs grade        # kinetics parameter 3
node dbtool.mjs log          # 사건 사슬 재생 = 지금 db
```
