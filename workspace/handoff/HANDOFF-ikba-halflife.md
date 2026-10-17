# HANDOFF — TASK-002 사람 유리 IκBα 기저 분해 반감기 (2026-10-17)

> 대상: 한계 **L000025** · 규칙 `D000086/rule/basal_turnover` (Kinetic_Gap, 요구: half_life). 수집가 기록(상태 collected).
> 기계 검증용 `workspace/handoff/ikba-halflife.jsonl` → `verify-collection` 결과 **REVIEW_REQUIRED (5건, 구조 통과)**.

## 후보 표

| # | 반감기 | 종·세포·조건·측정 | 불확도 | 출처+인용 | 사람? | 상태 |
|---|---|---|---|---|---|---|
| 1 | ≤10 min (상한) | 사람 IκBα 전이유전자 · **생쥐** nfkb-null 세포 · CHX chase | 없음(상한 표현) | Mathes et al., EMBO J 2008, PMID 18401342 · "shows a remarkably short half-life of 10 min or less" | 아니오(세포 생쥐) | collected · 모호 |
| 2 | ~7 min | 사람 IκBα 전이유전자 · **생쥐** nfkb3KO MEF(유리형) · CHX chase, 2회 통합 적합 | SD 없음 | Truhlar et al., J Mol Biol 2008, PMID 18511071 · "WT IκBα was degraded with a half-life of ~7 min" | 아니오(세포 생쥐) | collected · 값 후보 |
| 3 | 5–10 min (범위) | **생쥐** MEF(nfkb1/rela/crel 결손) · IκB 계열(IκBα 전용 아님) | 없음·방법 미기재 | O'Dea et al., Mol Syst Biol 2007, PMID 17486138 · "Half-lives for free IκB proteins were determined to be 5–10 min" | 아니오 | collected · 모호 |
| 4 | <15 min | **생쥐** 3T3 · GFP-IκBα 절편(210–317) · CHX chase, n=3 | SD | Fortmann et al., J Mol Biol 2015, PMID 26191773 · "the fusion protein showed a half-life of less than 15 minutes" | 아니오·절편 | collected · 전장 아님 |
| 5 | — | **사람** 세포(HeLa·HEK293·THP-1·U937 등) 유리 IκBα | — | 웹 검색 결과에 없음 | — | **없음** |

## 참고 리드 (수집했으나 1차 확인 전이라 후보 표에 넣지 않음)

- eLife 부록 그림의 "free IκBα ~5 min, CHX chase, NF-κB 결손 세포" — 원 논문·세포종 식별 못 함. 값만 보고 출처 없음.
- Pando & Verma 2000(J Biol Chem): "bound IκB 가 unstimulated 세포에서 free 보다 5배 길다" 는 O'Dea 2007 의 인용문. 원문 미확인.
- "bound 형은 IKK 인산화 없이 >12 h" (Truhlar 2008 리뷰 인용) — 결합형 값이며 기저 유리형 아님.
- 2010년대 바이오센서 ~35 min 은 TNFα 자극 후 분해 값. 기저 유리형 아님 — 넣으면 안 됨.

## 판정

1. **사람(9606) 세포에서 측정한 유리 IκBα 반감기는 찾지 못했다** (웹 검색 한정 — 커버리지 보장 아님, 통합가 재검색 필요). 가장 가까운 값은 **사람 IκBα 전이유전자를 생쥐 세포에서 잰 ~7 min(#2)·≤10 min(#1)** 으로, 사람 단백질이지만 세포가 생쥐라 사람 칸에는 못 쓴다 (통합가가 "사람 단백질·생쥐 세포" 를 어떻게 둘지 정할 것).
2. 공통으로 빠진 것: 사람 세포 측정, SD/n 이 있는 단일 값, 조건(유리 vs 결합) 명시. #2 는 SD 없이 두 실험 통합 적합이라 불확도가 없다.
3. 채움 가능성: 사람 값이 나오기 전까지 L000025 는 open 유지 권고. 다음 리드는 O'Dea 2007 전문 Figure 2C/S2 의 세포종 확인과 Pando & Verma 2000 원문.
