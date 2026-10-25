# TASK-003 — 사람 TCA 회로 효소 kcat·Km (종류 K)

먼저 `workspace/START-HERE.md` 와 `workspace/SOURCES.md` 를 읽어라.

**대상**: 한계 **L000038 · L000096 · L000097** · 경로 `D000148`(시트르산 회로).
**왜 지금** (2026-10-25 갱신): TCA 정량 검증 실험(`docs/design/tca-validation-protocol.md`)의 **바닥**이 이 칸들이다 — 다기질로 셀 때 사람 상수 15 개가 비어 있고, 실험은 가정을 3 개까지만 허용한다(§9).

**이미 있는 것 — 다시 찾지 마라**: CS kcat·Km(아세틸-CoA·옥살로아세트산) · ACO2 kcat·Km · IDH3 kcat·S0.5(아이소시트르산) · FH 정·역 kcat·Km (관찰 O000001–O000026).

**임무 — 아래 15 칸의 사람(9606) 실측값**

| 칸 | 규칙 | 효소 (EC · UniProt) | 상수 · 기질 |
|---|---|---|---|
| A1 | `D000151/rule/oxdecarb` | IDH3 (1.1.1.41 · P50213·O43837·P51553) | Km · NAD⁺ (출발: O000001·O000002 의 출처 Ma 2017, PMID 28139779) |
| A2–A5 | `D000152/rule/oxdecarb` | OGDH 복합체 (1.2.4.2 · Q02218 + DLST P36957 · DLD P09622) | kcat · Km 2-옥소글루타르산 · Km CoA · Km NAD⁺ |
| A6–A9 | `D000153/rule/slp` | GTP 생성 석시닐-CoA 합성효소 (6.2.1.4 · SUCLG1 P53597 · SUCLG2 Q96I99) | kcat · Km 석시닐-CoA · Km GDP · Km Pi |
| A10–A12 | `D000154/rule/oxidize` | 석신산 탈수소효소 · 복합체 II (1.3.5.1 · SDHA P31040 …) | kcat · Km 석신산 · Km 받개 — **측정에 쓴 받개(유비퀴논·PMS·DCPIP 등)를 꼭 적어라** (L000040·L000099) |
| A13–A15 | `D000156/rule/oxidize` | 말산 탈수소효소 2 (1.1.1.37 · P40926) | kcat · Km 말산 · Km NAD⁺ (방향 적기 — 역방향 값도 있으면) |

**이미 알려진 상황 (2026-10-16 보고서 `docs/reports/2026-10-16-kinetics-brenda.md`·`-kinetics-sourcing.md`)**:
- UniProt 큐레이션에 OGDH·SUCLG1/2·SDHA·MDH2 운동학 없음, IDH3 NAD⁺ Km 없음(2026-10-25 재확인).
- BRENDA(계정 — **통합가 전용, 너는 손대지 마라**)에 사람 값: SCS Km 1 · MDH Km 6 · SDH 0 · 사람 kcat 은 거의 없음. 이 값들은 아직 증거 파일로 저장되지 않았다(통합가 몫).
- SABIO-RK REST 폐지 · eQuilibrator api 막힘.
- 그래서 **네 몫은 1차 논문**이다: Europe PMC 에서 사람(재조합·정제·세포 추출) 효소의 kcat·Km 을 보고한 논문을 찾아 초록에서 값을 읽는다. 초록에 숫자가 없으면 `read_no_value`("전문 필요"). 출발점 예: MDH 종설 PMID 38721782(2024, 공개 전문 — 표의 **1차 출처**를 따라가서 그 1차 논문 초록에서 읽어라. 종설 문장을 값 근거로 쓰지 마라).

**각 후보에 반드시**: 칸 번호 · 규칙(D…/rule/…) · 값·단위(원문 그대로, 환산하지 마라) · 종(9606)·효소 형태(재조합·조직)·조건(pH·온도·방향·받개) · 불확도·반복 수(원문에 없으면 null — 1 로 적지 마라) · 출처(PMID)+**원문 인용구**(Europe PMC 가 돌려준 초록 글자 그대로) · "채움 가능? 빠진 것". 다른 종(돼지·소·쥐) 값만 있으면 값 칸을 쓰되 종을 그대로 적고 "사람 아님" — 사람 칸에 못 쓴다.

**반환**:
- `workspace/handoff/HANDOFF-tca-enzyme-kinetics.md` — 칸 A1–A15 마다 한 줄(상태 collected) + 3~5줄 판정(채울 수 있는 칸 / 사람 값이 없는 칸 / 공통으로 빠진 것).
- `workspace/handoff/tca-enzyme-kinetics.jsonl` — START-HERE §3 계약 그대로, 한 줄 한 후보. `outcome` ∈ `not_searched|not_found|unreadable|read_no_value|read_value|ambiguous|reused`. 값을 적으면 반드시 source + quote. 줄마다 `"task":"A…"`·`"param":"kcat|Km"`·`"substrate":"…"` 를 덧붙여라.

**통합가(상위 AI·사람) 몫 — 네 몫 아님**:
1. 사용자 BRENDA 계정으로 SCS Km 1 · MDH Km 6 을 다시 받아 증거 파일(`data/fetched/brenda/`)로 저장 → 칸 A7–A9·A14–A15 대조.
2. `node dbtool.mjs verify-collection workspace/handoff/tca-enzyme-kinetics.jsonl` → 1차 출처 재확인 → 관찰(O+1) + `kinetics.from` 패치.
3. 남은 빈칸을 설계 §9 에 다시 세어 자유 매개변수 ≤ 3 인지 판정.
