# HANDOFF — TASK-004 사람 텔로미어 정량 측정 (2026-10-22)

> 과제: `workspace/tasks/TASK-004-telomere-quantitative.md` (수정 없음). 대상 `D000210`·`D000211`.
> 출처: Europe PMC 초록(PMID)만 — SOURCES.md 규칙 1. 웹 스니펫·2차 리뷰 미사용.
> 기계 기록: `workspace/handoff/telomere-quantitative.jsonl` (5행) → `verify-collection` **REVIEW_REQUIRED** (구조 통과, 값 후보 3건 통합가 재확인 필요).

## 후보 표

| # | 대상 | 값·단위 | 종·세포·시각·불확도 | 출처+인용 | 현재 use | 규약 가능? 빠진 것 | 상태 |
|---|---|---|---|---|---|---|---|
| 1 | D000210 분열 소실 | 10 doublings / kb (복제 능력 대 초기 텔로미어 길이 기울기) | 사람 섬유아세포, 공여자 31명(0–93세). r=0.76, P=0.004. 측정법·SD 없음 | 1438199 (Allsopp 1992) · "m = 10 doublings per kilobase pair; r = 0.76; P = 0.004" | estimation | 측정법·표본 SD·음성 대조·시각 없음 → 검증 불가 | collected · read_value |
| 2 | D000210 소실률 | −15 bp / 공여자 나이 1년 | 세포·조직 종 초록에 없음. r=−0.43, P=0.02 | 1438199 · "m = -15 base pairs per yr" | estimation | **단위 불일치**(분열당 아님) → 소실률 칸 사용 금지 | collected · ambiguous |
| 3 | D000211 복제 수명 | ≥20 population doublings 초과 (텔로머레이즈 발현 클론) | 사람 망막색소상피·포피 섬유아세포. 대조 클론 수치·배수 변화 없음 | 9454332 (Bodnar 1998) · "exceeded their normal life-span by at least 20 doublings" | estimation | 하한 표현, 배수 변화 없음 → 배수 칸 비움 | collected · ambiguous |
| 4 | D000210 소실률 | 정량 값 없음(계대 감소는 정성) | 사람 섬유아세포, 체외 계대 | 2342578 (Harley 1990) · "the amount and length of telomeric DNA in human fibroblasts does in fact decrease as a function of serial passage" | estimation | 수치 없음 → 전문 필요 | collected · read_no_value |
| 5 | D000210 소실률 | ~120 bp / 세포 분열 | **림프구**(섬유아세포 아님), 4명, 체외 10–30 PD. 초록 250단어 절단 | 8460632 (1993) · "The rate of telomere loss was approximately 120 bp/cell doubling" | estimation | 세포 종 불일치 → 대상 축 근거로 쓰지 않음, 참고용 | collected · read_value |

## 판정 (3~5줄)

1. **초록 수준 검증값 0 — 정직한 지도.** 이번 배치에서 정량 검증(use: validation)에 쓸 값은 하나도 없다. 확보한 정량 값은 측정법·표본 SD·음성 대조가 초록에 없어 추정용 후보일 뿐이다.
2. 가장 가까운 후보는 **#1**(사람 섬유아세포, 공여자 31명, 기울기와 상관·P 값 제시). 다만 복제 능력과 텔로미어 길이의 상관이지 분열당 소실률이 아니다.
3. 공통으로 빠진 것: 섬유아세포 분열당 소실률(bp/PD)의 초록 수치, 텔로머레이즈 재도입 시 배수 변화, 측정 방법(TRF·qPCR)과 불확도. 이 공백은 통합가가 한계로 등록할 데이터다.
4. 전문 필요 목록: Harley 1990(PMID 2342578)의 소실률 수치, Allsopp 1992(PMID 1438199)의 측정법, Bodnar 1998(PMID 9454332)의 대조 클론 수치. BioNumbers 는 엔드포인트 미확정이라 "통합가 필요".
