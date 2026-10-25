# HANDOFF — TASK-003 사람 TCA 효소 상수 15 칸 (2026-10-25 수집)

> 과제: `workspace/tasks/TASK-003-tca-enzyme-kinetics.md` (수정 없음). 출처: Europe PMC 초록(PMID)만 — SOURCES.md 규칙 1.
> 기계 기록: `workspace/handoff/tca-enzyme-kinetics.jsonl` (11행) → `verify-collection` **REVIEW_REQUIRED** (구조 통과; 인용 원문이 수신함에 없어 대조 불가 — 통합가 몫).
> 검색 범위: 효소별 Europe PMC 검색 2–3회씩(사람·운동학 어휘). 커버리지 보장 아님. 웹·2차 리뷰 미사용.

## 칸별 결과 (A1–A15, 상태 collected)

| 칸 | 규칙 | 효소 | 상수·기질 | 결과 | 사람 값 | 출처+인용 | 비고 |
|---|---|---|---|---|---|---|---|
| A1 | D000151/oxdecarb | IDH3 | Km · NAD⁺ | read_no_value | 없음 | 28139779 (2017, 사람 IDH3 α₂βγ) — 초록에 S0.5 이소시트르산만 | 전문 필요 |
| A2 | D000152/oxdecarb | OGDH | kcat | not_found | 없음 | — | 돼지 E2o 돌연변이만(10806400) → 사람 아님 |
| A3 | D000152 | OGDH | Km · 2-옥소글루타르산 | not_found | 없음 | — | 〃 |
| A4 | D000152 | OGDH | Km · CoA | not_found | 없음 | — | 〃 |
| A5 | D000152 | OGDH | Km · NAD⁺ | not_found | 없음 | — | 〃 |
| A6 | D000153/slp | SCS | kcat | not_found | 없음 | — | 돼지 심근 SCS 모델 논문(23088689) — 수치 없음, 사람 아님 |
| A7 | D000153 | SCS | Km · 석시닐-CoA | not_found | 없음 | — | 〃 |
| A8 | D000153 | SCS | Km · GDP | not_found | 없음 | — | 〃 |
| A9 | D000153 | SCS | Km · Pi | not_found | 없음 | — | 〃 |
| A10 | D000154/oxidize | SDH | kcat | not_found | 없음 | — | 받개 명시 필요(L000040·L000099) |
| A11 | D000154 | SDH | Km · 석신산 | **read_value** | **0.9 mM** (apparent) | 6945861 (1981, 사람 SDH 가용화) "apparent Km values for succinate (0.9 mM)" | 온도·pH·불확도·n 없음 |
| A12 | D000154 | SDH | Km · 받개 | **read_value** | **0.4 mM** (PMS, 인공 받개) | 6945861 "PMS (0.4 mM)" | 받개 PMS — 생리 받개(유비퀴논) 값 아님 |
| A13 | D000156/oxidize | MDH2 | kcat · 말산 | not_found | 없음 | — | 종설 38721782(2024) 초록엔 수치 없음 — 표의 1차 논문 추적 필요 |
| A14 | D000156 | MDH2 | Km · 말산 | not_found | 없음 | — | 〃 (효모·Candida MDH 는 사람 아님, 18772936) |
| A15 | D000156 | MDH2 | Km · NAD⁺ | not_found | 없음 | — | 〃 |

**이미 있는 것은 찾지 않음**: CS·ACO2·IDH3(이소시트르산 S0.5)·FH 정·역 — 관찰 O000001–O000026.

## 판정 (3~5줄)

1. **채울 수 있는 칸: A11·A12 (사람 SDH, 1981)** — 두 값 다 사람 조직 효소이고 수치가 초록에 있다. 다만 **A12 는 인공 받개 PMS** 라 생리 받개 칸으로 쓰면 안 된다. 이 두 값은 조건(pH·온도)과 불확도가 없어 추정용 후보다.
2. **사람 값이 없는 칸: A2–A5(OGDH)·A6–A9(SCS)·A10·A13–A15(MDH2)** — 검색에서 사람 운동학 초록이 나오지 않았다. 나온 다른 종 논문(돼지 E2o·돼지 SCS·효모 MDH)은 사람 칸에 쓰지 않는다.
3. **가장 가까운 1차 추적 리드**: 38721782(MDH 종설, 2024) 표의 사람 MDH2 1차 논문 — 종설 초록엔 수치가 없어 표를 전문에서 봐야 한다. 같은 방식으로 IDH3 Km·NAD⁺ 는 28139779 전문 확인.
4. 공통으로 빠진 것: 사람 재조합 효소의 kcat·Km(조건·불확도 포함). Europe PMC 초록 검색으로는 2000년대 이후 사람 운동학 논문이 거의 안 잡혔다 — 어휘 확장(효소 이름 축약·영문 원어) 또는 BRENDA(통합가 계정)가 필요하다.
