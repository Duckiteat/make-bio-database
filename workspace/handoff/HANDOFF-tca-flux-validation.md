# HANDOFF — TASK-005 사람 세포 TCA 흐름·중간물 검증 측정 (2026-10-25, 칸별 재확인)

> 과제: `workspace/tasks/TASK-005-tca-flux-validation.md` (수정 없음). 출처: Europe PMC 초록(PMID)만 — SOURCES.md 규칙 1.
> 기계 기록: `workspace/handoff/tca-flux-validation.jsonl` (9행) → `verify-collection` **REVIEW_REQUIRED** (구조 통과; 인용 원문은 수신함에 없어 대조 보류 — 통합가 몫).
> 검색: 칸마다 검색어를 바꿔 2–4회. 커버리지 보장 아님.

## 칸별 결과 (B1–B4, 상태 collected)

| 칸 | 무엇 | 결과 | 사람 값 | 근거 (PMID) | 검증에 쓸 수 있나 · 빠진 것 |
|---|---|---|---|---|---|
| B1 | ¹³C MFA 회로 흐름 | read_no_value | 없음 | 30903027 (2019, HeLa 환원성 글루타민 — 정성) · 37980339 (2023, 배양 세포 흐름·농도 **모형 추론**) · 42009164 (2026, 다형성 세포 동위원소 추적) | 수치·단위 없음. 37980339 는 추론값이라 독립 측정 아님. 전문 필요 |
| B2 | OCR 또는 CO₂ 생성 | read_no_value (맥락) · not_found (TCA 기질) | 없음 | 42551828 (2026, CO₂ 측정 플랫폼 — 지방산 산화, 심장 오가노이드) | TCA 기질 사람 세포 OCR·CO₂ 수치 초록 없음 (검색 4회) |
| B3 | 독립 측정 중간물 농도 | read_no_value (입력 논문) · not_found (독립) | 없음 | 27565352 (Chen 2016, 입력 쪽) "measure the matrix concentrations of more than 100 metabolites" | **독립 측정 없음**. Chen 2016 은 입력과 같은 논문이라 L000124 조건 위반. 초록에 HeLa·수치도 없음 |
| B4 | 글루타민 유입·시트르산 유출 흐름 | read_no_value (글루타민) · not_found (시트르산) | 없음 | 42631795 (2026, 사람 관상동맥 내피세포 1차 — "increasing extracellular glutamine concentration did increase oxidative respiration and TCA cycle isotope enrichment") | 방향성만, 흐름 수치 없음. 시트르산 유출은 검색 0 |

## 판정 (3~5줄)

1. **검증 측정 0 — 정직한 지도.** B1–B4 어디에도 흐름·중간물·OCR 의 사람 세포 **수치**가 초록에 없다. 설계 §9 실험의 검증 세트는 이번 수집으로 채우지 못한다.
2. 가장 가까운 후보는 **42631795(사람 1차 내피세포, 글루타민→TCA 동위원소 농축 증가)** 와 **30903027(HeLa 13C 추적)**. 둘 다 사람 세포지만 수치가 없어 전문 MFA 표가 필요하다.
3. **B3 가 특히 막혔다**: 독립 측정(다른 연구실·다른 방법)은 찾지 못했다. 37980339 의 농도는 모형 추론이라 독립 측정 조건에 안 맞고, Chen 2016 은 입력과 같은 논문이다.
4. 공통으로 빠진 것: 사람 세포 TCA 흐름의 절대 값(단위 포함), OCR·CO₂ 수치(TCA 기질), 독립 중간물 농도, 시트르산 유출 흐름. 다음 검색은 "¹³C MFA + 세포주 이름 + nmol/mg 또는 nmol/10⁶ cells" 처럼 단위를 넣은 어휘가 필요하다.
