# HANDOFF — TASK-003 사람 TCA 효소 상수 15 칸 (2026-10-25, A5–A15 칸별 재확인)

> 과제: `workspace/tasks/TASK-003-tca-enzyme-kinetics.md` (수정 없음). 출처: Europe PMC 초록(PMID)만 — SOURCES.md 규칙 1.
> 기계 기록: `workspace/handoff/tca-enzyme-kinetics.jsonl` (15행, 칸당 한 줄) → `verify-collection` **REVIEW_REQUIRED** (구조 통과; 인용 원문은 수신함에 없어 대조 보류 — 통합가 몫).
> 검색: 칸마다 검색어를 바꿔 2–5회. 커버리지 보장 아님.

## 칸별 결과 (A1–A15, 상태 collected)

| 칸 | 규칙 | 효소 · 상수 · 기질 | 결과 | 사람 값 | 근거 (PMID) | 메모 |
|---|---|---|---|---|---|---|
| A1 | D000151/oxdecarb | IDH3 · Km · NAD⁺ | read_no_value | 없음 | 28139779 · 36375638 | 초록엔 이소시트르산 S0.5 만. 구조 논문도 Km 수치 없음 |
| A2 | D000152/oxdecarb | OGDH · kcat | read_no_value | 없음 | 40206582 (쥐) | 쥐 미토콘드리아 KC 모델 — 사람 아님, 수치 없음 |
| A3 | 〃 | OGDH · Km · 2-옥소글루타르산 | not_found | 없음 | — | 검색 5회 |
| A4 | 〃 | OGDH · Km · CoA | not_found | 없음 | — | 돼지 E2o 돌연변이(10806400)는 사람 아님 |
| A5 | 〃 | OGDH · Km · NAD⁺ | not_found | 없음 | — | 검색 2회 추가 |
| A6 | D000153/slp | SCS(GTP 특이, SUCLG2) · kcat | read_no_value | 없음 | 36189720 (2022) | 사람 효소의 돌연변이 E105αQ 활성 120배 감소(상대값). 야생형 절대 kcat 없음 |
| A7 | 〃 | SCS · Km · 석시닐-CoA | read_no_value | 없음 | 36189720 | 돌연변이의 석신산·CoA Km 상대 증가만. 석시닐-CoA Km 없음 |
| A8 | 〃 | SCS · Km · GDP | not_found | 없음 | — | 검색 2회 |
| A9 | 〃 | SCS · Km · Pi | not_found | 없음 | — | 돼지 심근 SCS 모델(23088689)은 사람 아님·수치 없음 |
| A10 | D000154/oxidize | SDH · kcat · 석신산 | read_no_value | 없음 | 37098072 (2023 구조) | 사람 복합체 II 구조 — 운동학 수치 없음 |
| A11 | 〃 | SDH · Km · 석신산 | **read_value** | **0.9 mM** (apparent) | 6945861 (1981) | 사람 조직 가용화 SDH. 온도·pH·불확도 없음 |
| A12 | 〃 | SDH · Km · 받개 | **read_value** | **0.4 mM** (PMS, 인공 받개) | 6945861 | 받개 PMS — 생리 받개(유비퀴논) 값 아님 |
| A13 | D000156/oxidize | MDH2 · kcat · 말산 | read_no_value | 없음 | 38721782 (2024 종설) | 종설 초록에 수치 없음 — 사람 MDH2 1차 논문 추적 필요 |
| A14 | 〃 | MDH2 · Km · 말산 | read_no_value | 없음 | 42323719 (2026, 사람 CS–MDH2) | 복합체 구조 논문, 말산 Km 수치 없음 |
| A15 | 〃 | MDH2 · Km · NAD⁺ | not_found | 없음 | — | 검색 4회 |

**이미 있는 것은 찾지 않음**: CS·ACO2·IDH3(이소시트르산 S0.5)·FH 정·역 — 관찰 O000001–O000026.

## 판정 (3~5줄)

1. **채울 수 있는 칸: A11·A12 (사람 SDH, 1981)** — 사람 조직 효소의 수치가 초록에 있다. 다만 **A12 는 인공 받개 PMS** 라 생리 받개 칸에 쓰면 안 되고, 두 값 모두 조건·불확도가 없어 추정용 후보다.
2. **사람 값이 없는 칸: A2–A5(OGDH)·A7–A9(SCS)·A10·A13–A15(MDH2)** — 사람 운동학 초록이 안 잡혔다. 나온 다른 종 논문(쥐·돼지·효모)은 사람 칸에 쓰지 않았다. A6·A7 은 사람 SUCLG2 돌연변이 상대값뿐이다.
3. **가장 가까운 1차 추적 리드**: 38721782(MDH 종설, 2024) 표의 사람 MDH2 1차 논문, 그리고 28139779 전문의 NAD⁺ Km(A1).
4. 공통으로 빠진 것: 사람 재조합·조직 효소의 kcat·Km(조건·불확도 포함). Europe PMC 초록 검색은 사람 운동학 논문을 거의 잡지 못했다. 어휘 확장(효소 이름 축약·영문 원어) 또는 BRENDA(통합가 계정)가 필요하다.
