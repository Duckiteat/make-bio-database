# 핸드오프 — TCA 정량 검증의 입력 수집 (2026-10-25)

> 설계: `docs/design/tca-validation-protocol.md` (§9 바닥 = 사람 속도 상수 15 개 없음). 이 파일은 작업 큐다 — db 가 아니다.
> 역할·금지는 `HANDOFF-template.md` 그대로(수집가는 후보만, 적용은 통합가). 후보 줄은 `workspace/handoff/tca-kinetics.jsonl` 에 **붙이기만**
> (MCP `clerk` 의 `put_handoff`, 역할 `collector`).

## 다른 AI 에게 줄 지시 (그대로 붙여 넣기)

```
저장소 duckiteat/make-bio-database 의 수집가(collector) 작업이다. CLAUDE.md 와 workspace/handoff/HANDOFF-template.md 를 먼저 읽고 그 금지 사항을 지킨다
(db.json·규칙 파일 수정 금지, 패치 적용·커밋 금지, 로그인·유료 원천 금지, 지어내지 않음).
workspace/handoff/HANDOFF-tca-kinetics.md 의 과제 A(속도 상수 15 칸)와 과제 B(흐름 측정)를 한다.
칸마다 사람(9606) 값만 찾는다. 찾은 것·못 찾은 것 모두 아래 '줄 형식' 으로 workspace/handoff/tca-kinetics.jsonl 에 붙인다
(MCP clerk 의 put_handoff, BIODB_ROLE=collector — 다른 쓰기 길 없음). 원문 인용(quote)은 수신함에 받은 초록·공개 전문에서 글자 그대로.
다른 종 값만 있으면 값으로 쓰지 말고 outcome "other_species" 로 출처만 남긴다. 끝나면 칸별 결과를 네 칸 표(범위·이유·영향·확인)로 보고한다.
```

## 과제 A — 사람 속도 상수 15 칸

| # | 대상 규칙 | 효소 (EC · UniProt) | 상수 | 기질 · 조건 메모 | 원천 순서 | 상태 |
|---|---|---|---|---|---|---|
| A1 | `D000151/rule/oxdecarb` | NAD 의존 아이소시트르산 탈수소효소 IDH3 (1.1.1.41 · P50213/O43837/P51553) | Km | NAD⁺ | 1 차 논문(아이소시트르산 값의 출처 — 관찰 O000001·O000002 의 논문 Ma et al., 2017 부터) | open |
| A2 | `D000152/rule/oxdecarb` | 2-옥소글루타르산 탈수소효소 복합체 OGDH (1.2.4.2 · Q02218 + DLST P36957 · DLD P09622) | kcat | 복합체 전체 반응 | 1 차 논문 · BRENDA(사용자) | open |
| A3 | 〃 | 〃 | Km | 2-옥소글루타르산 | 〃 | open |
| A4 | 〃 | 〃 | Km | CoA | 〃 | open |
| A5 | 〃 | 〃 | Km | NAD⁺ | 〃 | open |
| A6 | `D000153/rule/slp` | GTP 생성 석시닐-CoA 합성효소 (6.2.1.4 · SUCLG1 P53597 + SUCLG2 Q96I99) | kcat | 석시닐-CoA → 석신산 방향 | 〃 | open |
| A7 | 〃 | 〃 | Km | 석시닐-CoA | 〃 | open |
| A8 | 〃 | 〃 | Km | GDP | 〃 | open |
| A9 | 〃 | 〃 | Km | Pi | 〃 | open |
| A10 | `D000154/rule/oxidize` | 석신산 탈수소효소 · 복합체 II (1.3.5.1 · SDHA P31040 …) | kcat | 실제 받개는 유비퀴논(L000040·L000099) — 받개와 측정 방식(인공 받개 PMS·DCPIP 등)을 꼭 적음 | 〃 | open |
| A11 | 〃 | 〃 | Km | 석신산 | 〃 | open |
| A12 | 〃 | 〃 | Km | 받개(유비퀴논 또는 측정에 쓴 받개) | 〃 | open |
| A13 | `D000156/rule/oxidize` | 말산 탈수소효소 2 MDH2 (1.1.1.37 · P40926) | kcat | 말산 → 옥살로아세트산 방향(역방향 값도 있으면 함께) | 1 차 논문 · 종설 PMID 38721782(2024, 공개)의 표에서 출처 추적 · BRENDA(사용자) | open |
| A14 | 〃 | 〃 | Km | 말산 | 〃 | open |
| A15 | 〃 | 〃 | Km | NAD⁺ | 〃 | open |

이미 있는 것(다시 찾지 않음): CS kcat·Km(아세틸-CoA·옥살로아세트산) · ACO2 kcat·Km · IDH3 kcat·S0.5(아이소시트르산) · FH 정·역 kcat·Km.

## 과제 B — 흐름(나)의 측정 찾기

| # | 무엇 | 조건 | 상태 |
|---|---|---|---|
| B1 | HeLa(또는 사람 세포주) TCA 흐름의 직접 측정 — ¹³C 동위원소 흐름 분석(MFA) 값, 단위 포함 | 사람 · 가능하면 Chen 2016 과 같은 세포·배지 | open |
| B2 | 산소 소비 속도(OCR) · CO₂ 생성 — 세포당 또는 단백질당, 측정 조건 | 같은 세포 · 환산(P/O·회로당 NADH)은 하지 말고 원값만 | open |
| B3 | 같은 세포의 기질 중간물 농도를 **다른 연구실·다른 방법**으로 잰 측정(독립 검증용, L000124) | 사람 | open |
| B4 | 글루타민 유입·시트르산 유출 흐름(L000121) | 같은 세포 | open |

## 막힌 원천 (2026-10-25 기준 — 다시 시도해도 됨)

| 원천 | 상태 |
|---|---|
| UniProt 큐레이션 | OGDH·SUCLG1/2·SDHA·MDH2 에 운동학 없음 · IDH3 NAD⁺ Km 없음 |
| SABIO-RK REST | 주소가 오류 쪽지로 넘어감 — 새 주소를 찾으면 쓸 것(무료·로그인 없음) |
| BRENDA | **로그인 필요 — AI 는 하지 않는다.** 사용자가 직접 조회해 이 표의 'BRENDA(사용자)' 칸을 채움 |
| Chen 2016 (PMID 27565352) | PMC 무료 열람(공개 전문 아님) — 본문 저장 금지, 사람이 보충 표에서 옮김 |
| Nagaraj 2011 (PMID 22068331) | 공개 전문이지만 값은 보충 파일 — `fetch` 서버가 보충 파일을 아직 못 받음 |

## 줄 형식 (`tca-kinetics.jsonl`, 한 줄 = 한 후보)

```json
{"task":"A13","outcome":"read_value","target":"D000156/rule/oxidize","param":"kcat","value":123,"unit":"s^-1",
 "species":"9606","enzyme_form":"재조합 MDH2 (태그 · 발현 숙주)","conditions":{"pH":7.4,"temperature_C":25,"direction":"malate→OAA","acceptor":null},
 "uncertainty":{"sd":null,"n":null},"source":{"db":"PMID","id":"…"},"quote":"원문 글자 그대로","use":"estimation","note":"…"}
```

- `outcome`: `read_value`(값을 읽음) · `ambiguous`(범위·상한만, 조건 불명) · `other_species`(사람 값 없음 — 출처만) · `not_found`(찾아봤으나 없음 — 검색어·원천 기록) · `needs_user`(BRENDA·유료 등 사람 몫).
- 단위는 원문 그대로 적고 환산하지 않는다(통합가가 `vocab.unitFactors` 로). 반복 수가 원문에 없으면 `n: null`(1 로 적지 않음).
- `quote` 는 수신함(`data/fetched/europepmc/`)에 받은 초록·공개 전문과 글자 그대로 맞아야 통합가의 인용 대조(`verify-collection`)를 통과한다.

## 통합가가 할 일 (수집이 끝난 뒤)

1. `node dbtool.mjs verify-collection workspace/handoff/tca-kinetics.jsonl` — 인용·출처 대조
2. 통과분을 관찰(O+1, `use: estimation`) + `kinetics.from` 패치로 → `validate` → `augment apply`
3. 남은 칸 수를 설계 §9 에 다시 셈 — 자유 매개변수 ≤ 3 이면 실험 진행, 아니면 '부분 실험'
4. 다른 종 값만 있는 칸은 한계로(종 규칙 — 사람 값으로 적지 않음)
