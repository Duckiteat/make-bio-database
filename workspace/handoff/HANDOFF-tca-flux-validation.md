# HANDOFF — TASK-005 사람 세포 TCA 흐름·중간물 검증 측정 (2026-10-25 수집)

> 과제: `workspace/tasks/TASK-005-tca-flux-validation.md` (수정 없음). 출처: Europe PMC 초록(PMID)만.
> 기계 기록: `workspace/handoff/tca-flux-validation.jsonl` (6행) → `verify-collection` **REVIEW_REQUIRED** (구조 통과; 인용 대조는 수신함 부재로 보류).
> 검색: B1–B4 각 1–2회. 커버리지 보장 아님.

## 칸별 결과 (B1–B4, 상태 collected)

| 칸 | 무엇 | 결과 | 값 | 출처+인용 | 검증 가능? 빠진 것 |
|---|---|---|---|---|---|
| B1 | ¹³C MFA 회로 흐름 | read_no_value | 없음 | 30903027 (2019, HeLa 환원성 글루타민 추적) — 정성 결론만 "…in HeLa cells" | 흐름 **값**·단위 없음 → 검증 불가. 전문 필요 |
| B1′ | (맥락) 젖산 산성증 | read_no_value | 없음 | 42140428 (2026) — 정성 기전 | 세포 종 불명, 수치 없음 |
| B2 | OCR · CO₂ 생성 | not_found | 없음 | — | 사람 세포 수치 초록 없음 (검색 2회) |
| B3 | 독립 측정 중간물 농도 | read_no_value (입력 논문) · not_found (독립) | 없음 | 27565352 (Chen 2016) "measure the matrix concentrations of more than 100 metabolites" — 입력 쪽 논문 | **독립 측정 없음**. Chen 2016 은 같은 논문이라 L000124 조건 위반. 초록에 HeLa 도 수치도 없음 |
| B4 | 글루타민 유입 · 시트르산 유출 | not_found | 없음 | — (30903027 의 환원성 글루타민 경로는 정성) | 검색 0건 |

## 판정 (3~5줄)

1. **검증 측정 0 — 정직한 지도.** B1–B4 어디에도 흐름·중간물의 사람 세포 **수치**가 초록에 없다. TCA 정량 검증(설계 §9 실험)의 검증 세트를 이번 수집으로는 채우지 못한다.
2. 가장 가까운 후보는 **30903027(HeLa 13C 추적, B1)**: 사람 세포 + 동위원소 흐름이지만 정성 결론뿐이다. 흐름 값을 얻으려면 전문의 MFA 표가 필요하다.
3. **B3 가 특히 막혔다**: 독립 측정(다른 연구실·다른 방법)은 찾지 못했고, Chen 2016 은 입력과 같은 논문이라 검증 조건을 못 채운다.
4. 공통으로 빠진 것: 사람 세포 TCA 흐름의 절대 값(단위 포함), OCR·CO₂ 수치, 독립 중간물 농도. 다음 검색은 "¹³C-glucose/glutamine MFA + 세포주 이름 + flux (nmol/mg)" 형태로 어휘를 넓히는 것이 필요하다.
