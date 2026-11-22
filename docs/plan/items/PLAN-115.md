# PLAN-115 — 주장 층 — 칸 단위 근거

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 115 · 8부 — 학회 수준의 신뢰 (바닥 · 실행 · 확률 층 · 가설 고리)
- **작업**: **주장 층 — 칸 단위 근거** (DEC-0073 ⑦) — 지금 규칙 하나에 evidence 하나라 curated 가 via_component · regulators[].note 같은 구조 칸까지 보증하는 것처럼 읽힌다(SUP-0001/r1 P1 검토). 주장 하나 = 대상 칸 경로 + 출처 하나 + 맥락(종 · 조직 · 조건) + 방향(지지 · 반박) + 종류(직접 측정 · 배경 문장 · 해석) + 초록 인용(받은 파일 해시와 함께). 규칙의 근거 수준은 적지 않고 주장에서 계산(핵심 칸 중 가장 약한 칸 · 반박이 있으면 다툼). 기존 규칙 evidence 는 이관으로 '규칙 전체를 덮는 주장 1 건' 이 됨. 함께: 한계 needs xref 해소가 asserted xref 를 세는 문제(L000030 이 resolved 로 나옴). SUP-0001 P3 이전 판정 설계(docs/design/transfer-judgment.md 의 주장 단위 · 맥락)와 겹치므로 같이 설계. 설계 입력(사용자 제공 SCHEMA_DATA 카드, 이 저장소에 없음 — 세션에 붙이거나 다시 받아야 함): SCH-0212 N 항 관계 · SCH-0214 마이크로 이론 · SCH-0164 진리 유지 체계 · SCH-0186 인용 선택자 · SCH-0074 PROV · SCH-0213 관계 특성 선언, 관계 어휘의 역 · 대칭 선언 방식. 기존 dbtool retraction · qualgraph 위에 얹을 수 있는지 먼저 확인 · 설계 지시서(사용자 제공 2026-11-22, 원문 보존 docs/reports/2026-11-22-plan-115-design-brief.md): Claim · Evidence Fragment · Observation · Assessment · Decision · Context 논리 모델, 혼합형 관계(단순 Edge + Claim), 관계 어휘 · 맥락 일반화 · PROV 최소 구조 · TMS 대 retraction · qualgraph, 효율 비교(A 기존 · B 전부 Claim · C 혼합), 글리코겐 인산화효소 시범, 이관 — 산출물은 설계 보고서 하나(구현은 별도 승인 뒤)
- **자리**: judicial/ (근거 판정) · 형식 · migrations/ · data/db.json 이관 · 교과서
- **끝나는 조건**: 형식 · 이관(기존 규칙 evidence 보존) · 거부 말뭉치 · D000051 네 규칙에 칸 단위 주장 시범 · L000030 판정 수정 · 사용자 결정(RULE-0261)
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-22` 커밋 전 기록 계획에 들어옴 (☐ 대기) — SUP-0001/r1 P1 독립 검토(docs/reports/2026-11-22-sup-0001-r1-p1-review.md) 뒤 사용자 결정 — 패치를 그대로 병합하지 않고 수정 권고를 author 에서 반영, 그 뒤 inspect 재검토, 규칙 단위 근거 문제는 develop 과제로
- `2026-11-22` 커밋 전 기록 '작업' 칸이 바뀜 — 사용자 결정(세션 답 2026-11-22 ㄱㄱㄱ — SUP-0001/r3 author 시작 의견): 설계 지시서를 PLAN-115 의 설계 입력으로 등록, 실행 순서는 DEC-0073 그대로(author → inspect → develop)

  <details><summary>이전 · 이후</summary>

이전: **주장 층 — 칸 단위 근거** (DEC-0073 ⑦) — 지금 규칙 하나에 evidence 하나라 curated 가 via_component · regulators[].note 같은 구조 칸까지 보증하는 것처럼 읽힌다(SUP-0001/r1 P1 검토). 주장 하나 = 대상 칸 경로 + 출처 하나 + 맥락(종 · 조직 · 조건) + 방향(지지 · 반박) + 종류(직접 측정 · 배경 문장 · 해석) + 초록 인용(받은 파일 해시와 함께). 규칙의 근거 수준은 적지 않고 주장에서 계산(핵심 칸 중 가장 약한 칸 · 반박이 있으면 다툼). 기존 규칙 evidence 는 이관으로 '규칙 전체를 덮는 주장 1 건' 이 됨. 함께: 한계 needs xref 해소가 asserted xref 를 세는 문제(L000030 이 resolved 로 나옴). SUP-0001 P3 이전 판정 설계(docs/design/transfer-judgment.md 의 주장 단위 · 맥락)와 겹치므로 같이 설계. 설계 입력(사용자 제공 SCHEMA_DATA 카드, 이 저장소에 없음 — 세션에 붙이거나 다시 받아야 함): SCH-0212 N 항 관계 · SCH-0214 마이크로 이론 · SCH-0164 진리 유지 체계 · SCH-0186 인용 선택자 · SCH-0074 PROV · SCH-0213 관계 특성 선언, 관계 어휘의 역 · 대칭 선언 방식. 기존 dbtool retraction · qualgraph 위에 얹을 수 있는지 먼저 확인

이후: **주장 층 — 칸 단위 근거** (DEC-0073 ⑦) — 지금 규칙 하나에 evidence 하나라 curated 가 via_component · regulators[].note 같은 구조 칸까지 보증하는 것처럼 읽힌다(SUP-0001/r1 P1 검토). 주장 하나 = 대상 칸 경로 + 출처 하나 + 맥락(종 · 조직 · 조건) + 방향(지지 · 반박) + 종류(직접 측정 · 배경 문장 · 해석) + 초록 인용(받은 파일 해시와 함께). 규칙의 근거 수준은 적지 않고 주장에서 계산(핵심 칸 중 가장 약한 칸 · 반박이 있으면 다툼). 기존 규칙 evidence 는 이관으로 '규칙 전체를 덮는 주장 1 건' 이 됨. 함께: 한계 needs xref 해소가 asserted xref 를 세는 문제(L000030 이 resolved 로 나옴). SUP-0001 P3 이전 판정 설계(docs/design/transfer-judgment.md 의 주장 단위 · 맥락)와 겹치므로 같이 설계. 설계 입력(사용자 제공 SCHEMA_DATA 카드, 이 저장소에 없음 — 세션에 붙이거나 다시 받아야 함): SCH-0212 N 항 관계 · SCH-0214 마이크로 이론 · SCH-0164 진리 유지 체계 · SCH-0186 인용 선택자 · SCH-0074 PROV · SCH-0213 관계 특성 선언, 관계 어휘의 역 · 대칭 선언 방식. 기존 dbtool retraction · qualgraph 위에 얹을 수 있는지 먼저 확인 · 설계 지시서(사용자 제공 2026-11-22, 원문 보존 docs/reports/2026-11-22-plan-115-design-brief.md): Claim · Evidence Fragment · Observation · Assessment · Decision · Context 논리 모델, 혼합형 관계(단순 Edge + Claim), 관계 어휘 · 맥락 일반화 · PROV 최소 구조 · TMS 대 retraction · qualgraph, 효율 비교(A 기존 · B 전부 Claim · C 혼합), 글리코겐 인산화효소 시범, 이관 — 산출물은 설계 보고서 하나(구현은 별도 승인 뒤)

</details>

## 닿는 결정

- [DEC-0073](../decisions/DEC-0073.md) 2026-11-22 P1 패치는 그대로 병합하지 않는다 — 검토 권고를 author 의 독립 변경으로 반영 → inspect 재검토(필드별 근거) → develop 주장 층
