# PLAN-115 설계 입력 — 사용자 지시서 원문 (2026-11-22)

> 출처: 사용자가 SUP-0001/r3 (author) 세션 시작 의견으로 낸 지시서 원문. 사용자 결정(세션 답 'ㄱㄱㄱ', 2026-11-22): 이 지시서를 PLAN-115 의 설계 입력으로 등록하고, 실행은 DEC-0073 순서대로 author → inspect 뒤 develop 세션에서 한다.
> 이 파일은 입력 보존용이다 — 설계 보고서가 아니고, 아래 내용은 아직 아무것도 조사 · 확인되지 않았다.
> 받은 세션의 메모(사용자에게 보고한 것, 결정 아님): ① 이 저장소에 없는 SCH-0214 · SCH-0164 · SCHEMA_DATA 카드는 develop 세션에 붙여야 한다 ② 기존 객체(관찰 O… · 실험 · 증거 · attestations · DEC-…) 와 이름 · 역할이 겹치는 것(특히 "Decision")을 §2 에서 먼저 대응표로 ③ Claim → 정의 방향이어야 RULE-0488 과 맞는다 ④ 외부 조사는 채택 후보(PROV-O 최소 · W3C Web Annotation TextQuoteSelector · Nanopublication · SBML/BioModels)만 원문으로 깊게, 나머지는 한 줄 비교 — RULE-0288 · RULE-0301 ⑤ "PROV-K" 는 실재 여부 확인 필요 ⑥ docs/design/transfer-judgment.md (SUP-0001 P3) 와 겹침.

---

TASK: Biological Knowledge Architecture — Claim, Relation, Evidence & Provenance 설계 조사

0. 작업 목적

현재 생물학 데이터베이스의 데이터 모델을 확장하기 위한 논리적 아키텍처를 조사하고 설계하라.

이번 작업의 핵심은 기존 Entity 중심 데이터 구조에 개별 주장(Claim), 생물학적 관계(Relation), 실험 관찰(Observation), 근거(Evidence), 검증 판단(Assessment), 승인 기록(Decision)을 어떻게 통합할 것인지 결정하는 것이다.

단순히 출처를 분자에 연결하는 방식에서 벗어나, 하나의 분자 또는 반응에 관한 세부 주장마다 독립적으로 근거와 검증 상태를 관리할 수 있어야 한다.

최종 목표는 다음과 같다.

- 하나의 Entity에 여러 출처와 상이한 주장이 연결될 수 있어야 한다.
- 관계 자체가 독립적인 검증 대상이 될 수 있어야 한다.
- 동일한 Evidence를 여러 Claim에서 재사용할 수 있어야 한다.
- 실험에서 직접 관찰된 사실과 그로부터 도출한 해석을 구분해야 한다.
- 종, 조직, 세포 유형, 실험 조건 등에 따른 주장 범위를 보존해야 한다.
- 상충하는 근거를 삭제하거나 임의로 하나로 통합하지 않아야 한다.
- 근거 변경이나 철회가 발생하면 영향을 받는 Claim과 파생 모델을 추적할 수 있어야 한다.
- 검증된 데이터만 수치 시뮬레이션 엔진에 적절하게 전달할 수 있어야 한다.

이번 작업은 기존 시스템을 조사하고 설계하는 Develop 작업이다.

기존 데이터, 스키마, 코드, 장부, 기준 파일을 수정하지 마라.
이번 작업에서는 조사와 설계 보고서만 작성한다.

---

1. 기존 저장소 조사

설계에 앞서 현재 저장소의 실제 구조를 확인하라.

특히 다음 항목을 조사한다.

1. Entity의 ID 및 데이터 구조
2. Reaction 및 Reaction 참여자 구조
3. Source와 Evidence의 저장 방식
4. asserted / curated 상태의 의미와 판정 규칙
5. 종, 조직, 조건, 측정 방법 등의 맥락 데이터 처리 방식
6. 데이터의 출처 추적 및 변경 이력
7. 기존 "retraction" 기능
8. 기존 "qualgraph" 기능
9. 기존 감사 및 검증 체계
10. 시뮬레이션 엔진이 현재 데이터를 소비하는 방식

반드시 실제 파일과 코드의 위치를 확인하라.

문서에 적혀 있는 기능과 실제 구현된 기능을 구분하라.

각 항목은 다음 중 하나로 분류한다.

- 구현 확인
- 문서에만 존재
- 일부 구현
- 미구현
- 확인 불가

기존 기능과 중복되는 새 기능을 제안하지 마라.

특히 기존 "retraction", "qualgraph"가 새 Claim 및 Evidence 구조에서 재사용 가능한지 먼저 확인한다.

---

2. 외부 연구 및 표준 조사

최신 논문과 공식 표준을 조사하여 설계 근거를 확보하라.

다음 항목을 우선 조사하되, 이 목록에 제한되지 않는다.

A. 주장과 근거의 구조화

- Nanopublication
- PROV-O
- PROV-K
- Claim / Evidence 모델
- Assertion 및 Provenance 모델
- N항 관계의 물화(Reification)
- RDF-star 또는 이에 대응하는 관계 속성 표현 방식

B. 생물학 지식 그래프

- Biolink Model
- LinkML
- OBI
- ISA-Tab / ISA model
- 생물학적 상호작용 및 반응 데이터 모델
- BioModels 및 SBML

C. 근거 철회와 의존성 관리

- Truth Maintenance System (TMS)
- Assumption-based Truth Maintenance System (ATMS)
- Provenance 기반 파생 관계
- Dependency tracking
- Incremental validation

D. 문헌 기반 자동 큐레이션

- 생물학 문헌의 주장 추출
- Evidence sentence classification
- Entity resolution
- Relation extraction
- Contradiction detection
- AI-assisted biocuration

가능하면 2024~2026년 연구를 우선하되, 기초 개념을 정의하는 고전 논문과 공식 표준도 함께 활용한다.

각 자료에 대해 다음을 기록한다.

- 정확한 제목
- 저자
- 발표 연도
- DOI 또는 공식 URL
- 연구가 실제로 입증한 내용
- 이번 DB 설계에 적용 가능한 부분
- 적용할 때의 한계

논문 초록만 확인했다면 전문을 확인한 것처럼 작성하지 마라.

연구 결과와 설계자의 해석을 분리하라.

---

3. 핵심 설계: 혼합형 관계 모델

모든 관계를 무조건 독립 객체로 만들거나, 반대로 모든 관계를 단순한 Edge로 저장하는 방식을 전제하지 마라.

다음 혼합형 구조를 기준으로 장단점을 비교하라.

단순 관계

근거, 맥락, 독립적인 검증이 필요하지 않은 단순 구조적 관계는 일반 Edge로 관리할 수 있는지 검토한다.

예:

- 구조적 소속
- 명확한 분류 관계
- 정적 계층 관계

Claim 객체

다음 특성을 가진 관계는 독립 Claim 객체로 관리하는 방식을 검토한다.

- 여러 출처가 존재함
- 서로 다른 종이나 조건에서 관찰됨
- 근거가 지지하거나 반박할 수 있음
- 검증 상태가 독립적으로 변함
- 여러 참여자가 존재함
- 수치 모델에 영향을 줌

예:

- PKA phosphorylates phosphorylase kinase
- PP1 dephosphorylates glycogen phosphorylase
- AMP inhibits glycogen phosphorylase
- 특정 조건에서 효소 활성이 증가함

관계의 주어와 목적어뿐 아니라 다음 정보를 관리할 수 있어야 한다.

- relation_type
- subject
- object
- directionality
- context
- evidence
- assessment
- provenance

단, 효소 반응처럼 참여자가 여러 개이고 화학양론이 필요한 경우에는 단순한 Claim Edge로 표현하지 말고 기존 Reaction 모델과의 관계를 검토한다.

---

4. 논리적 데이터 모델 설계

다음 객체를 중심으로 설계한다.

Entity

생물학적 실체.

예:

- Molecule
- Protein
- Gene
- Cell
- Tissue
- Reaction

Claim

Entity 또는 Reaction에 관한 개별 생물학적 주장.

하나의 Entity에 여러 Claim이 연결될 수 있어야 한다.

Claim은 단순한 설명 문자열이 아니라 독립적인 ID를 가지는 데이터 객체여야 한다.

Source

논문, 공식 데이터베이스, 문서 등 출처 자체.

Evidence Fragment

Source에서 실제로 근거가 위치하는 부분.

예:

- Abstract sentence
- Full-text paragraph
- Figure
- Table
- Supplementary data
- Database annotation

출처 전체와 개별 근거 위치를 분리한다.

Study / Experiment

실험 설계와 수행 조건.

Observation

실험에서 실제로 관찰하거나 측정한 결과.

Observation과 Claim을 같은 객체로 취급하지 마라.

Assessment

특정 Evidence가 특정 Claim을 얼마나 뒷받침하는지에 대한 평가.

예:

- supports
- partially_supports
- contradicts
- contextualizes
- insufficient
- not_applicable

이것은 초안이므로 기존 프로젝트의 용어와 규칙에 맞춰 재검토한다.

Decision

Assessment를 검토한 결과 실제 데이터베이스에 반영하기로 한 승인 결정.

AI가 제안한 평가와 최종 승인된 판단을 구분한다.

Context

주장의 적용 범위를 정의한다.

최소한 다음을 검토한다.

- species
- tissue
- cell_type
- experimental_system
- temperature
- pH
- concentration
- time
- measurement_method
- other_conditions

모든 필드를 무조건 필수로 지정하지 말고, 정보가 없는 경우와 해당 사항이 없는 경우를 구분한다.

---

5. 맥락과 생물학적 일반화

SCH-0214의 마이크로 이론 개념을 참고하여 맥락별로 주장의 적용 범위를 표현하는 방법을 설계하라.

예:

- Rabbit skeletal muscle
- Human liver
- Rat liver cells
- Recombinant human protein
- In vitro assay

동일한 Claim이 서로 다른 맥락에서 지지되거나 반박될 수 있어야 한다.

특히 다음 사항을 검토한다.

1. 종이 다른 Evidence를 어떻게 표현하는가?
2. 조직이 다른 Evidence를 어떻게 표현하는가?
3. In vitro와 in vivo 결과를 어떻게 구분하는가?
4. 실험 조건이 다르면 별개의 Claim으로 만들어야 하는가?
5. 서로 다른 맥락의 주장을 일반화할 수 있는 기준은 무엇인가?
6. 일반화 판단은 자동화할 수 있는가?

종 간 일반화와 조건 간 일반화는 자동 승격하지 않는다.

맥락의 상하위 관계를 정의하되, 상위 맥락의 근거가 하위 맥락의 주장을 자동으로 증명한다고 간주하지 마라.

---

6. 관계 어휘 및 스키마 규칙

SCHEMA_DATA의 다음 개념을 참고한다.

- 관계 어휘의 중앙 선언
- 관계의 방향성
- 역관계
- 대칭성
- 관계 유형 검사
- N항 관계의 물화
- OWL 2 속성 특성

단, SCHEMA_DATA의 관계 어휘를 그대로 생물학에 적용하지 마라.

생물학에 맞는 관계 유형을 별도로 설계한다.

예:

- supports
- contradicts
- derived_from
- qualified_by
- phosphorylates
- binds_to
- activates
- inhibits
- catalyzes
- transports
- expressed_in

이 예시를 확정 목록으로 취급하지 마라.

각 관계에 대해 다음을 정의한다.

- 의미
- 방향성
- 대칭 여부
- 역관계
- 허용되는 주체 및 객체 유형
- 적용 가능한 맥락
- 검증 필요 여부

단순 관계와 Claim 관계에 서로 다른 규칙을 적용할 수 있는지도 검토한다.

---

7. Provenance와 인용 위치 추적

다음 개념을 검토한다.

- W3C PROV-O
- W3C TextQuoteSelector
- Source hash
- Evidence Fragment locator
- derived_from
- generated_by
- reviewed_by
- approved_by

최소한 다음 계보를 추적할 수 있어야 한다.

원본 Source
→ 수집된 Evidence
→ Observation
→ Claim
→ Assessment
→ Decision
→ Computational Model
→ Simulation Result

모든 PROV-O 요소를 그대로 도입하지 말고, 현재 프로젝트에서 실제로 필요한 최소 구조를 제안한다.

인용 문구가 원본에 실제로 존재하는지 자동 검증하는 방법도 검토한다.

단, 문구 존재 확인과 의미적 근거 적합성 판단은 분리한다.

---

8. TMS / ATMS와 기존 기능의 통합

SCH-0164를 참고하되 새로운 TMS를 무조건 구현하자는 결론을 내리지 마라.

기존 "retraction", "qualgraph"가 담당하는 기능과 비교한다.

다음 시나리오를 분석한다.

1. Claim을 지지하던 Evidence가 철회됨.
2. 다른 독립적인 Evidence는 여전히 남아 있음.
3. 새로운 Evidence가 기존 Claim과 충돌함.
4. 기존 Claim에서 파생된 해석이 존재함.
5. 파생 Claim이 Computational Model에 반영되어 있음.

이때 어떤 객체를 재평가해야 하는지, 어떤 객체는 유지해야 하는지 정의한다.

특히 Evidence 하나가 철회되었다고 Claim 전체를 무조건 철회하지 마라.

근거의 독립성, 대체 근거, 반박 근거를 고려한 의존성 관리가 필요하다.

---

9. 효율성 분석

이번 설계에서 효율성은 핵심 평가 항목이다.

다음 항목을 반드시 비교한다.

| 평가 항목 | 확인할 내용 |
|---|---|
| 저장 비용 | Entity / Claim / Evidence 증가에 따른 저장량 |
| 입력 비용 | 논문 한 편을 등록하는 데 필요한 작업 |
| 검수 비용 | Claim 하나를 검증하는 데 필요한 작업 |
| 중복 비용 | 동일 Evidence의 재사용 가능성 |
| 조회 비용 | 특정 분자와 관련된 근거 조회 |
| 영향 분석 비용 | Claim 변경 시 재검증 대상 검색 |
| 계산 비용 | 시뮬레이터용 데이터 추출 |
| 유지보수 비용 | 스키마 변경과 마이그레이션 |
| AI 비용 | 문헌 추출 및 검토에 드는 연산·토큰 비용 |

다음 구조를 비교한다.

A. 기존 Entity + Source 연결 방식

B. 모든 관계를 Claim 객체로 관리하는 방식

C. 단순 Edge + Claim 객체의 혼합형 방식

단순히 혼합형이 좋다고 결론 내리지 말고 실제 사용 사례에 따라 비교한다.

가능하다면 현재 Glycogen phosphorylase 관련 데이터로 간단한 데이터 규모와 관계 복잡도를 추정한다.

---

10. 실제 데이터로 검증할 시범 사례

현재 프로젝트의 Glycogen phosphorylase 관련 데이터를 활용한다.

특히 다음 사례를 사용한다.

- PKA → phosphorylase kinase
- phosphorylase kinase → glycogen phosphorylase
- glycogen phosphorylase의 glycogen phosphorolysis
- PP1 → glycogen phosphorylase

다음 상황을 포함한다.

1. 동일 Claim을 여러 논문이 지지함.
2. 서로 다른 종에서 관찰된 근거가 있음.
3. 동일 종에서도 조직이 다름.
4. 실험 조건에 따라 결과가 달라짐.
5. 직접 관찰과 해석이 혼합되어 있음.
6. 상충하는 근거가 존재함.
7. Evidence 철회가 파생 Claim에 영향을 줌.

실제 저장소 데이터에서 확인할 수 없는 사실을 임의로 채우지 마라.

---

11. 마이그레이션 및 호환성

기존 데이터 구조를 보존하면서 새 구조로 전환하는 방법을 제안한다.

다음 항목을 포함한다.

- 기존 Entity ID 보존
- 기존 Reaction ID 보존
- 기존 Source ID 보존
- 기존 Evidence와 Claim의 연결 규칙
- asserted / curated의 새 구조 대응
- 기존 데이터 중 자동 변환할 수 없는 항목
- 수동 검토가 필요한 항목
- 역변환 또는 호환성 유지 방법
- 마이그레이션 전후 데이터 동등성 검사

기존 curated 데이터를 새 Claim 구조의 supported로 일괄 승격하지 마라.

기존 상태의 의미와 새 상태의 의미가 동일하다는 근거가 있을 때만 자동 변환한다.

---

12. 최종 보고서 구성

다음 순서로 보고서 하나를 작성한다.

1. Executive Summary
2. 기존 저장소 구조 조사 결과
3. 기존 구조의 한계
4. 최신 논문 및 공식 표준 조사
5. Claim-Evidence-Observation-Assessment 논리 모델
6. 혼합형 관계 모델
7. Context 모델
8. 관계 어휘 및 스키마 규칙
9. Provenance 모델
10. TMS / ATMS 통합 방안
11. 효율성 비교
12. Glycogen phosphorylase 시범 적용
13. 기존 데이터 마이그레이션 방안
14. 보안·검증·승인 경계
15. 단계별 구현 로드맵
16. 미해결 질문 및 설계 결정 목록
17. 참고문헌

각 설계 결정에는 다음을 표시한다.

- 확인된 사실
- 외부 연구에서 가져온 개념
- 설계자의 제안
- 아직 검증되지 않은 가정

---

13. 작업 제한 및 완료 조건

이번 작업은 Develop 조사 단계다.

- 기존 데이터 수정 금지
- 기존 스키마 수정 금지
- 기존 코드 수정 금지
- 기존 기준 파일 수정 금지
- 기존 승인 장부 수정 금지
- 자동 마이그레이션 실행 금지
- 새 기능 구현 금지

보고서 작성 전에는 기존 저장소의 파일 구조와 기능을 충분히 조사한다.

외부 논문은 실제 원문 또는 공식 자료를 확인하고 출처를 기록한다.

확인하지 못한 내용은 확인 필요로 남긴다.

설계의 장점을 강조하기보다 기존 구조와 충돌하는 부분, 구현 비용, 새로운 복잡성도 적극적으로 기록한다.

이번 작업의 성공 기준은 새로운 스키마를 많이 제안하는 것이 아니다.

기존 구조를 최대한 재사용하면서, 생물학적 주장의 근거·맥락·검증·계보를 독립적으로 관리할 수 있는 가장 단순하고 확장 가능한 구조를 찾아내는 것이다.

최종 산출물은 설계 보고서 하나이며, 구현은 별도 승인 이후에만 시작한다.
