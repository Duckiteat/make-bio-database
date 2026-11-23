# PLAN-115 — 주장 층 — 칸 단위 근거

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 115 · 8부 — 학회 수준의 신뢰 (바닥 · 실행 · 확률 층 · 가설 고리)
- **작업**: **주장 층 — 칸 단위 근거** (DEC-0073 ⑦) — 지금 규칙 하나에 evidence 하나라 curated 가 via_component · regulators[].note 같은 구조 칸까지 보증하는 것처럼 읽힌다(SUP-0001/r1 P1 검토). 주장 하나 = 대상 칸 경로 + 출처 하나 + 맥락(종 · 조직 · 조건) + 방향(지지 · 반박) + 종류(직접 측정 · 배경 문장 · 해석) + 초록 인용(받은 파일 해시와 함께). 규칙의 근거 수준은 적지 않고 주장에서 계산(핵심 칸 중 가장 약한 칸 · 반박이 있으면 다툼). 기존 규칙 evidence 는 이관으로 '규칙 전체를 덮는 주장 1 건' 이 됨. 함께: 한계 needs xref 해소가 asserted xref 를 세는 문제(L000030 이 resolved 로 나옴). SUP-0001 P3 이전 판정 설계(docs/design/transfer-judgment.md 의 주장 단위 · 맥락)와 겹치므로 같이 설계. 설계 입력(사용자 제공 SCHEMA_DATA 카드, 이 저장소에 없음 — 세션에 붙이거나 다시 받아야 함): SCH-0212 N 항 관계 · SCH-0214 마이크로 이론 · SCH-0164 진리 유지 체계 · SCH-0186 인용 선택자 · SCH-0074 PROV · SCH-0213 관계 특성 선언, 관계 어휘의 역 · 대칭 선언 방식. 기존 dbtool retraction · qualgraph 위에 얹을 수 있는지 먼저 확인 · 설계 지시서(사용자 제공 2026-11-22, 원문 보존 docs/reports/2026-11-22-plan-115-design-brief.md): Claim · Evidence Fragment · Observation · Assessment · Decision · Context 논리 모델, 혼합형 관계(단순 Edge + Claim), 관계 어휘 · 맥락 일반화 · PROV 최소 구조 · TMS 대 retraction · qualgraph, 효율 비교(A 기존 · B 전부 Claim · C 혼합), 글리코겐 인산화효소 시범, 이관 — 산출물은 설계 보고서 하나(구현은 별도 승인 뒤)
- **자리**: judicial/ (근거 판정) · 형식 · migrations/ · data/db.json 이관 · 교과서
- **끝나는 조건**: 형식 · 이관(기존 규칙 evidence 보존) · 거부 말뭉치 · D000051 네 규칙에 칸 단위 주장 시범 · L000030 판정 수정 · 사용자 결정(RULE-0261)
- **상태**: ◐ 진행 2026-11-23

## 결과 (날짜별)

- `2026-11-22` 커밋 전 기록: 2026-11-22 설계 보고서 docs/reports/2026-11-22-plan-115-claim-layer-design.md — 권고 C 혼합 최소판: 새 모음 claims.C… 하나(칸 경로 하나 + 근거 줄 여러 개: 출처 · 인용 위치(파일 sha256 + exact) · 방향 supports/contradicts/qualifies · 종류 direct/background/interpretation/absent · 맥락 · by), 생물 술어 어휘는 새로 만들지 않음(규칙 칸이 이미 표현), Assessment = 근거 줄 · Decision = 병합(DEC- 이름 충돌 피함), 칸 · 규칙 상태는 저장하지 않고 계산(새 TMS 없음), retractionImpact 를 출처 · 근거 줄 출발로 확장, quoteCheck 재사용, 이관 = 규칙마다 '#*' 주장 1 건(curated 를 supported 로 올리지 않음, 등급 · 궤적 비트 동일). 조사에서 찾은 것: 엔진 · 컴파일러는 근거를 보지 않고 관문은 속도 상수에만 — 규칙 구조는 asserted 30 · abstracted 64 도 시뮬레이션에 들어감 · needMet xref 가 상태를 안 봄(L000030). 시범 표: S000009 via_component · Ser14 unsupported · D000043 basal 은 contested. 사용자 결정 대기 Q1–Q11 (보고서 §16). SCH-… 카드는 여전히 없음 — 확인 불가로 표시
- `2026-11-23` 커밋 전 기록: 2026-11-23 단계 1–2 구현: 최상위 선택 칸 claims{C…}(있을 때만 — db.json 바이트 그대로) · 근거 줄(source · from · locator{file_sha256, exact} · stance · kind · context · by · at) · 어휘 일곱(vocab claimStances · claimEvidenceKinds · claimAgents · locatorParts · contextSystems · claimFields · claimStates) · 종 9986 · 관찰 조건 tissue · system · 관문 validateClaims · claimImmutability(RULE-0537–0541, 변이 다섯 caught) · 인용 대조는 조정자 fetchedTexts(FETCH_LOG sha256 그대로인 Europe PMC 원문 138) → 사법부 normText 대조 · 칸 상태 계산 judicial/claims.js · dbtool claims [--assume] · 거부 말뭉치 7a–7c · 시험 tests/claims.test.mjs 8 · SCHEMA §8Q · 교과서 3.8 · 4.5.1. 단계 0(needs xref 는 verified 만 — L000030)은 빠짐: 한계 상태가 바뀌면 limitations.md 를 다시 만들어야 하는데 그 명령(dbtool limitations --write)은 author · inspect 몫이라 develop 커밋이 끝내기 시험(limitations.md 최신)을 통과할 수 없음 — 사용자 결정 대기(develop 에 그 명령을 허락 · 또는 develop 이 코드만 커밋하지 않고 author 가 같은 브랜치에서 이어 받는 절차). 남은 끝나는 조건: 단계 0 · D000051 칸 단위 주장 시범(PLAN-112)
- `2026-11-23` 커밋 전 기록: 2026-11-23 단계 0: needMet 의 xref need 는 status verified 만 — 한계 127 중 L000030 하나만 resolved → open(시험 claims ⑨ 가 옛 판정과 견줘 정확히 L000030 만인지 확인) · 명령 장부 'dbtool limitations' modes 에 develop(DEC-0076 — 쓰는 갈래는 --write 하나, limitations.md 손 고침 권한은 넓히지 않음, 최신성 시험이 거부) · 재생성 전후 지문: data/ · attestations/ · limitations.md 509 파일 중 limitations.md 만 바뀜(요약 Identity_Gap 3/9 → 4/8 · L000030 행) · 자기 검사 시험 gate ② 를 결정에 맞춤(사용자 확인) · 일반화 검토 docs/reports/2026-11-23-derived-artifact-freshness-review.md (원칙 P1–P4 초안 — 장부화는 하지 않음). 남은 끝나는 조건: D000051 칸 단위 주장 시범(PLAN-112)

## 걸어온 길

- `2026-11-22` 커밋 전 기록 계획에 들어옴 (☐ 대기) — SUP-0001/r1 P1 독립 검토(docs/reports/2026-11-22-sup-0001-r1-p1-review.md) 뒤 사용자 결정 — 패치를 그대로 병합하지 않고 수정 권고를 author 에서 반영, 그 뒤 inspect 재검토, 규칙 단위 근거 문제는 develop 과제로
- `2026-11-22` 커밋 전 기록 '작업' 칸이 바뀜 — 사용자 결정(세션 답 2026-11-22 ㄱㄱㄱ — SUP-0001/r3 author 시작 의견): 설계 지시서를 PLAN-115 의 설계 입력으로 등록, 실행 순서는 DEC-0073 그대로(author → inspect → develop)

  <details><summary>이전 · 이후</summary>

이전: **주장 층 — 칸 단위 근거** (DEC-0073 ⑦) — 지금 규칙 하나에 evidence 하나라 curated 가 via_component · regulators[].note 같은 구조 칸까지 보증하는 것처럼 읽힌다(SUP-0001/r1 P1 검토). 주장 하나 = 대상 칸 경로 + 출처 하나 + 맥락(종 · 조직 · 조건) + 방향(지지 · 반박) + 종류(직접 측정 · 배경 문장 · 해석) + 초록 인용(받은 파일 해시와 함께). 규칙의 근거 수준은 적지 않고 주장에서 계산(핵심 칸 중 가장 약한 칸 · 반박이 있으면 다툼). 기존 규칙 evidence 는 이관으로 '규칙 전체를 덮는 주장 1 건' 이 됨. 함께: 한계 needs xref 해소가 asserted xref 를 세는 문제(L000030 이 resolved 로 나옴). SUP-0001 P3 이전 판정 설계(docs/design/transfer-judgment.md 의 주장 단위 · 맥락)와 겹치므로 같이 설계. 설계 입력(사용자 제공 SCHEMA_DATA 카드, 이 저장소에 없음 — 세션에 붙이거나 다시 받아야 함): SCH-0212 N 항 관계 · SCH-0214 마이크로 이론 · SCH-0164 진리 유지 체계 · SCH-0186 인용 선택자 · SCH-0074 PROV · SCH-0213 관계 특성 선언, 관계 어휘의 역 · 대칭 선언 방식. 기존 dbtool retraction · qualgraph 위에 얹을 수 있는지 먼저 확인

이후: **주장 층 — 칸 단위 근거** (DEC-0073 ⑦) — 지금 규칙 하나에 evidence 하나라 curated 가 via_component · regulators[].note 같은 구조 칸까지 보증하는 것처럼 읽힌다(SUP-0001/r1 P1 검토). 주장 하나 = 대상 칸 경로 + 출처 하나 + 맥락(종 · 조직 · 조건) + 방향(지지 · 반박) + 종류(직접 측정 · 배경 문장 · 해석) + 초록 인용(받은 파일 해시와 함께). 규칙의 근거 수준은 적지 않고 주장에서 계산(핵심 칸 중 가장 약한 칸 · 반박이 있으면 다툼). 기존 규칙 evidence 는 이관으로 '규칙 전체를 덮는 주장 1 건' 이 됨. 함께: 한계 needs xref 해소가 asserted xref 를 세는 문제(L000030 이 resolved 로 나옴). SUP-0001 P3 이전 판정 설계(docs/design/transfer-judgment.md 의 주장 단위 · 맥락)와 겹치므로 같이 설계. 설계 입력(사용자 제공 SCHEMA_DATA 카드, 이 저장소에 없음 — 세션에 붙이거나 다시 받아야 함): SCH-0212 N 항 관계 · SCH-0214 마이크로 이론 · SCH-0164 진리 유지 체계 · SCH-0186 인용 선택자 · SCH-0074 PROV · SCH-0213 관계 특성 선언, 관계 어휘의 역 · 대칭 선언 방식. 기존 dbtool retraction · qualgraph 위에 얹을 수 있는지 먼저 확인 · 설계 지시서(사용자 제공 2026-11-22, 원문 보존 docs/reports/2026-11-22-plan-115-design-brief.md): Claim · Evidence Fragment · Observation · Assessment · Decision · Context 논리 모델, 혼합형 관계(단순 Edge + Claim), 관계 어휘 · 맥락 일반화 · PROV 최소 구조 · TMS 대 retraction · qualgraph, 효율 비교(A 기존 · B 전부 Claim · C 혼합), 글리코겐 인산화효소 시범, 이관 — 산출물은 설계 보고서 하나(구현은 별도 승인 뒤)

</details>
- `2026-11-22` 커밋 전 기록 결과 처음 적힘 — PLAN-115 설계 보고서 완료 (지시서대로 조사 · 설계만, 구현은 별도 승인 뒤) — 전환 기록 #16 을 받은 develop 세션
- `2026-11-23` 커밋 전 기록 상태 ☐ → ◐ 2026-11-23 — PLAN-115 구현 단계 1–2 (DEC-0075) — 단계 0 은 모드 경계에 걸려 빠짐
- `2026-11-23` 커밋 전 기록 결과 덧붙음 — PLAN-115 구현 단계 1–2 (DEC-0075) — 단계 0 은 모드 경계에 걸려 빠짐
- `2026-11-23` 커밋 전 기록 결과 덧붙음 — PLAN-115 단계 0 (DEC-0076 조건부 승인)

## 닿는 결정

- [DEC-0073](../decisions/DEC-0073.md) 2026-11-22 P1 패치는 그대로 병합하지 않는다 — 검토 권고를 author 의 독립 변경으로 반영 → inspect 재검토(필드별 근거) → develop 주장 층
- [DEC-0074](../decisions/DEC-0074.md) 2026-11-23 사람 손을 덜 타는 구조 먼저 — 주장 층(115) → 승인 보조(116 G2–G4) → 자동 배정(104) → D000051 주장 층 시범(112, 자동 순환) · author P1 손 고침은 시범으로 흡수
- [DEC-0075](../decisions/DEC-0075.md) 2026-11-23 주장 층 형식 — 권고 그대로: 새 모음 claims 하나 · 생물 술어 어휘 없음 · via_component 는 보조 칸 · L000030 은 (가) 검증된 외부 ID 만 해소 · 관찰 조건에 tissue · system
- [DEC-0076](../decisions/DEC-0076.md) 2026-11-23 develop 에 생성물 재생성 하나만 — 명령 장부 'dbtool limitations' 의 쓰는 갈래(--write)를 develop 에 허락 · limitations.md 직접 수정 권한으로 넓히지 않음
- [DEC-0091](../decisions/DEC-0091.md) 2026-11-24 main 병합은 거버넌스만 먼저 — P1 데이터 커밋(178c43a)을 뺀 새 브랜치 · 주장 층 시험은 자체 시험 재료로
