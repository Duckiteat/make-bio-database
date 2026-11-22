# PLAN-116 설계 입력 — 사용자 제안서 원문 (2026-11-22)

> 출처: 사용자가 develop 세션(전환 기록 #16 을 받은 세션) 시작 건의사항으로 낸 제안서 원문. 사용자 결정(세션 답 2026-11-22 — '등록 후 PLAN-115 먼저'): 원문을 보존하고 새 계획 작업(PLAN-116)으로 등록한다. 이 세션은 PLAN-115 설계 보고서만 쓰고, 이 제안의 조사(기존 구조 대응 · A 기존 / B 확장 / C 새 구성요소 분류)는 뒤 세션에서 한다.
> 이 파일은 입력 보존용이다 — 설계 보고서가 아니고, 아래 내용은 아직 아무것도 조사 · 확인되지 않았다.
> 받은 세션의 메모(사용자에게 보고한 것, 결정 아님): ① 이미 있는 것과 겹침 — 문지기 `rebuild/gate.mjs`(PEP) · 권한 장부 `rebuild/rules/permissions.jsonl` · `judicial/approval.js` · `judicial/supervise_approval.js` · 전환 기록 · 사건 기록 · 감독 장부(PLAN-099 · 100) · 병합 = 사람(DEC-0069 · PLAN-113) · 승인 증거 판정(PLAN-102) · Governor CI 겹(PLAN-114) ② "Decision" 이름이 계획의 DEC-… 와 겹침 ③ DEC-0066 메타 편중 경보가 켜져 있음(11/20 이후 개발체계만) — 순서를 정할 때 고려 ④ 외부 표준(NIST SP 800-207 · 800-53 · 800-162 · ISO 27001/27002 · NASA SE Handbook)은 채택 후보만 원문으로.

---

AI 다중 에이전트 개발 운영체계의 권한 분리 및 거버넌스 아키텍처 설계 보고서

문서 유형: 아키텍처 조사 및 설계 제안
대상: 생명 데이터베이스 및 생물학적 시뮬레이터 프로젝트
주요 주제: Multi-Agent Governance, Authorization, Independent Verification, Policy Enforcement
상태: 개념 설계 제안 — 저장소 대조 및 구현 전 검토 필요

---

1. 연구 배경

1.1 문제의 발견

현재 프로젝트는 Supervisor를 중심으로 Author, Inspect 등 복수의 AI 세션이 작업을 수행하는 구조로 발전하고 있다.

초기에는 Supervisor가 작업을 계획하고, 개별 세션에 작업을 배정하며, 결과를 취합하는 방식으로 충분하다고 판단했다.

그러나 실제 오케스트레이션이 작동하기 시작하면서 새로운 문제가 드러났다.

- Supervisor가 작업을 배정하고 실행 결과를 평가한다.
- 작성 세션이 자신의 작업 결과를 설명한다.
- 검수 세션이 작성 결과의 정확성을 판단한다.
- 검수 결과에 따라 다음 작업을 결정한다.
- 승인 또는 거부가 필요한 상황에서 최종 판단 주체가 불분명해진다.

이는 개별 AI의 추론 능력만으로 해결할 수 있는 문제가 아니다.

여러 행위자가 서로 다른 권한을 행사하는 시스템에서는 작업 수행 능력과 권한 행사 능력을 구분해야 한다.

1.2 핵심 문제 정의

기존 자동화 시스템은 일반적으로 다음 질문에 집중한다.

1. 어떤 작업을 수행할 것인가?
2. 어떤 순서로 수행할 것인가?
3. 작업이 성공했는가?

그러나 다중 에이전트 시스템에서는 추가적인 질문이 필요하다.

4. 누가 해당 작업을 수행할 권한이 있는가?
5. 누가 작업 결과를 독립적으로 검증할 수 있는가?
6. 누가 작업을 거부하거나 중단시킬 수 있는가?
7. 누가 최종 반영을 승인할 수 있는가?
8. 잘못된 판단이 발생했을 때 누가 이를 차단하는가?

본 보고서는 이러한 문제를 해결하기 위한 권한 및 거버넌스 아키텍처를 제안한다.

2. 설계 목표

본 설계의 최종 목표는 다음과 같다.

AI는 작업의 계획, 실행, 검증 및 보고를 자율적으로 수행하되, 권한의 부여와 중요한 변경의 최종 승인은 별도의 통제 체계에 의해 관리한다.

이를 위해 다음 원칙을 적용한다.

원칙| 설명
Separation of Duties| 작업 수행과 승인 권한의 분리
Least Privilege| 각 주체에 필요한 최소 권한만 부여
Independent Verification| 작성자와 독립된 검증
Fail-safe Defaults| 판단할 수 없는 상황에서 무조건 허용하지 않음
Defense in Depth| 여러 단계의 독립적인 안전장치
Auditability| 모든 판단과 실행의 추적 가능성
Reversibility| 변경의 복구 가능성 확보
Human Oversight| 중요한 결정에 대한 사람의 통제

3. 핵심 이론 및 기술적 기반

3.1 Separation of Duties

직무 분리는 하나의 주체가 작업의 모든 과정을 독점하지 못하도록 하는 원칙이다.

다중 에이전트 시스템에서는 다음과 같이 적용한다.

- Author: 변경안 작성
- Inspector: 기술적·과학적 검증
- Auditor: 절차 및 증거 감사
- Approver: 정책 적합성 판단
- Human: 최종 중요 의사결정

중요한 것은 에이전트의 수가 아니라 권한과 판단 근거의 독립성이다.

동일한 Supervisor의 지시와 작성자의 설명에 종속된 여러 세션이 동일한 결론을 내렸다고 해서 독립 검증이 성립하는 것은 아니다.

3.2 Independent Verification and Validation

IV&V는 독립적인 검증과 확인을 통해 시스템의 정확성과 적합성을 평가하는 접근이다.

세 가지 검증을 구분한다.

구분| 핵심 질문| 프로젝트 적용
Verification| 설계한 대로 구현했는가?| 코드, 스키마, 테스트
Validation| 의도한 문제를 올바르게 해결하는가?| 생물학적 반응 및 모델 해석
Audit| 절차와 근거가 적절한가?| 출처, Decision, 변경 이력

예를 들어 기능 시험이 모두 통과하더라도 생물학적 반응 규칙이 실제 문헌과 일치하지 않는다면 Validation은 실패한 것이다.

3.3 Least Privilege

각 세션에는 해당 작업에 필요한 최소한의 권한만 제공한다.

예를 들어 Inspector는 다음 권한을 가질 수 있다.

- 원본 데이터 읽기
- 문헌 확인
- 테스트 실행
- 검수 보고서 작성

그러나 다음 권한은 기본적으로 부여하지 않는다.

- 공식 DB 수정
- 승인 상태 변경
- 최종 Merge
- Gate 정책 변경

권한은 역할 이름만으로 통제하지 않고 실제 실행 명령 및 리소스 접근 계층에서도 강제해야 한다.

3.4 RBAC와 ABAC

RBAC(Role-Based Access Control)는 역할에 따라 권한을 부여한다.

ABAC(Attribute-Based Access Control)는 역할 외에도 작업 상태, 데이터 등급, 브랜치, 검증 결과 등의 속성을 판단한다.

예를 들어 다음 조건을 고려할 수 있다.

- 요청자의 역할
- 대상 데이터의 신뢰 등급
- 작업의 위험도
- 변경 대상 브랜치
- 검수 완료 여부
- 작성자와 검수자의 동일성
- 승인된 커밋의 식별자

권장 방향은 RBAC와 ABAC의 조합이다.

역할은 기본 권한을 정의하고, ABAC는 개별 상황에서 실행 가능 여부를 결정한다.

3.5 Policy Decision Point와 Policy Enforcement Point

NIST Zero Trust Architecture의 PDP 및 PEP 개념을 적용한다.

PDP (Policy Decision Point)

정책과 상황을 바탕으로 허용, 거부 또는 추가 검토 여부를 판단한다.

PEP (Policy Enforcement Point)

PDP의 결정을 실제 실행 환경에서 강제한다.

프로젝트에 적용하면 다음과 같다.

- PDP: Policy Authority 또는 Policy Engine
- PEP: Gate 및 실행 권한 통제 계층
- Protected Resources: DB, Git, Schema, Simulation Engine

AI가 승인했다고 선언하는 것만으로 작업이 허용되어서는 안 된다.

실제 실행 계층에서 권한을 확인해야 한다.

3.6 State Machine

모든 작업과 승인 과정을 명시적인 상태로 관리한다.

예상 상태 흐름:

Planned → Executing → Inspecting → Auditing → Approval Pending

이후 다음과 같이 분기한다.

- Approved
- Denied
- Hold

Denied는 수정 절차로 돌아가며, Hold는 추가 정보나 재검토를 요구한다.

Approved 이후에도 승인 대상의 동일성과 권한 유효성을 확인해야 한다.

3.7 Event Sourcing

작업의 최종 상태만 저장하는 것이 아니라, 상태를 변화시킨 사건을 순서대로 기록한다.

예시:

- TASK_CREATED
- AUTHOR_ASSIGNED
- PATCH_CREATED
- INSPECT_STARTED
- INSPECT_FAILED
- PATCH_REVISED
- INSPECT_PASSED
- APPROVAL_REQUESTED
- APPROVAL_DENIED

이러한 기록을 통해 특정 시점의 작업 상태를 재구성하고, 판단의 원인을 추적할 수 있다.

기존 Decision Record 및 Transition Record와의 관계를 우선 조사해야 한다.

3.8 Concurrency Control

복수 세션이 동시에 작업할 경우 발생하는 충돌을 관리한다.

검토 대상 기술:

- Optimistic Concurrency Control
- Compare-and-Swap
- Locking
- Lease
- Fencing Token
- Idempotency

특히 Fencing Token은 작업 권한이 만료된 세션이 늦게 돌아와 오래된 상태를 반영하는 문제를 방지하는 데 활용할 수 있다.

3.9 Fail-safe Defaults 및 Exception Management

정상적인 승인 조건이 충족되지 않으면 기본적으로 실행을 허용하지 않는다.

다만 거부와 보류를 구분한다.

상황| 결과
필수 시험 실패| Deny
권한 부족| Deny
필수 근거 누락| Hold
문헌 해석 불확실| Hold
검증자 간 의견 충돌| Hold
모든 조건 충족| 승인 심사 진행

예외는 일반적인 Gate를 우회하는 수단이 아니라 별도의 승인 절차로 관리해야 한다.

4. 제안하는 거버넌스 아키텍처

4.1 전체 구성

다음 다섯 계층으로 구성하는 방안을 제안한다.

A. Orchestration Layer

담당: Supervisor

기능:

- 작업 계획
- 작업 분배
- 세션 생성
- 상태 관리
- Handoff 관리
- 결과 취합

Supervisor는 작업의 흐름을 관리하지만 최종 승인 권한을 보유하지 않는다.

B. Execution & Verification Layer

담당: Author, Worker, Inspector, Auditor

기능:

- 변경안 작성
- 테스트 실행
- 독립 검증
- 문헌 및 데이터 검증
- 절차 감사

각 세션은 서로 다른 권한을 가진다.

C. Governance Layer

담당: Policy Authority / Policy Engine

기능:

- 권한 정책 평가
- 위험도 평가
- 승인 조건 검토
- Deny / Hold 판단
- 정책 위반 확인
- 승인 요청 생성

Supervisor와 독립적으로 작동해야 한다.

D. Enforcement Layer

담당: Gate 및 실행 권한 통제

기능:

- 실행 전 권한 확인
- 상태 전이 검증
- 승인 여부 확인
- Merge 차단
- 승인 대상 동일성 검증

정책 위반을 실제로 차단하는 계층이다.

E. Human Authority

담당: 사용자

기능:

- 최종 승인
- 최종 거부
- 중요 정책 변경
- 위험 수용 여부 결정

AI가 수행한 조사와 검증을 바탕으로 중요한 의사결정을 수행한다.

4.2 전체 흐름

1. Supervisor가 작업을 생성한다.
2. Author가 변경안을 작성한다.
3. Inspector가 독립 검증한다.
4. Auditor가 절차와 증거를 확인한다.
5. Policy Authority가 승인 조건을 평가한다.
6. Gate가 정책 충족 여부를 강제한다.
7. 최종 Merge 보고서를 사용자에게 제출한다.
8. 사용자가 승인 또는 거부한다.
9. Gate가 승인 대상의 동일성을 확인한다.
10. 승인된 경우에만 Merge를 허용한다.

5. 권한 체계 설계

작업의 위험도와 영향 범위에 따라 네 단계로 구분한다.

단계| 분류| 권한
L0| Autonomous Execution| 자동 실행
L1| Reversible Changes| 제한적 자동 변경
L2| Controlled Changes| 정책 기반 통제
L3| Human Approval Required| 사용자 승인

5.1 L0 — 자율 실행

- 문헌 조사
- 데이터 수집
- 분석
- 보고서 작성
- 세션 생성
- 테스트 실행
- 독립 검수

5.2 L1 — 제한적 변경

- 격리 브랜치 수정
- 테스트 코드 작성
- 임시 파일 생성
- 롤백 가능한 작업

5.3 L2 — 통제된 변경

- 커밋
- 스키마 변경
- 기준 통제 변경
- 데이터 상태 변경
- 공식 브랜치 반영 준비

사전에 정한 정책과 검증 조건을 충족해야 한다.

5.4 L3 — 사용자 승인

- 공식 DB의 중요 데이터 승격
- 최종 Merge
- 핵심 스키마 변경
- 중요 권한 정책 변경
- 복구가 어려운 변경

이 분류는 초기 제안이며, 실제 작업별 위험도 분석을 통해 조정해야 한다.

6. Approver와 Policy Authority 설계

6.1 새로운 권한 주체의 필요성

Supervisor는 작업을 조율하는 주체다.

따라서 Supervisor가 자신이 조율한 작업의 최종 정당성까지 독점적으로 판정하는 구조는 이해충돌과 통제 실패를 발생시킬 수 있다.

별도의 권한 판단 주체가 필요하다.

다만 새로운 AI 세션을 추가하는 것만으로는 충분하지 않다.

실질적인 권한은 실행 계층에서 강제해야 한다.

6.2 권장 구조

Approver는 정책 판단을 수행하는 논리적 주체로 설계한다.

Policy Engine은 명시적인 규칙을 평가하고, 필요할 경우 AI 기반 분석 결과를 참고한다.

Gate는 최종 실행 여부를 통제한다.

이때 AI의 판단과 시스템의 권한 행사는 구분한다.

6.3 Deny와 Hold의 분리

Deny:

- 정책 위반
- 권한 부족
- 필수 검증 실패
- 금지된 작업

Hold:

- 근거 부족
- 검증 결과 불일치
- 추가 조사 필요
- 위험도 평가 불확실

Deny와 Hold에는 각각 명시적인 사유 코드와 근거가 필요하다.

6.4 승인 및 거부 권한

Approver는 정책에 따른 진행 가능 여부를 판단할 수 있다.

그러나 다음을 구분해야 한다.

- 정책상 진행 불가 판정
- 정책상 진행 가능 판정
- 최종 변경 승인

정책상 진행 가능하다는 판단이 곧 사용자 최종 승인을 의미하지는 않는다.

최종 Merge와 중요 데이터 변경은 사용자 승인 이후에만 가능하도록 한다.

7. 다중 에이전트의 독립성 문제

7.1 Common-mode Failure

여러 AI가 동일한 잘못된 정보를 공유하면 모두 동일한 잘못된 결론에 도달할 수 있다.

따라서 단순한 세션 분리는 충분하지 않다.

다음 조치를 권장한다.

- 검수자가 원본 자료를 직접 확인
- 작성자의 결론과 검수 입력을 분리
- 독립적인 판단 기록 유지
- 서로 다른 검증 방법 적용
- 불일치를 합의로 덮지 않고 기록
- 필요시 별도의 외부 자료 검증

7.2 독립성 평가 기준

독립성을 다음 요소로 평가한다.

1. 역할 독립성
2. 권한 독립성
3. 정보 접근 독립성
4. 판단 근거 독립성
5. 실행 권한 독립성

다섯 요소가 모두 확보되지 않았다면 독립 검증 수준을 제한적으로 평가해야 한다.

8. 최종 승인 보고서

최종 Merge 이전에 Supervisor는 전체 작업을 취합한 보고서를 생성한다.

보고서 필수 항목:

항목| 내용
작업 목적| 최초 사용자 요청
실행 내역| 전체 세션 및 작업 결과
변경 내역| 파일별 변경 사항
근거| 문헌, 데이터, 출처
검증| Build, Check, Test, Audit
독립 검수| Inspector 결과
절차 감사| Auditor 결과
실패 이력| 오류 및 재검증
미해결 사항| 불확실성과 위험
영향 분석| DB, Schema, Engine 영향
승인 대상| 정확한 커밋 및 변경 식별자
최종 권고| Merge 가능 여부와 이유

승인 이후 변경사항이 발생하면 기존 승인을 무효화한다.

9. 기존 프로젝트와의 통합 방향

새로운 구성요소를 무조건 추가하기 전에 기존 구조를 조사해야 한다.

특히 다음을 확인한다.

기존 구성요소| 조사할 내용
Supervisor| 실행과 승인 권한의 경계
Gate| 실제 권한 집행 가능 여부
Decision| 승인 및 거부 이력 표현 가능 여부
Transition| 권한에 따른 상태 전이 통제
Task State Machine| 승인 대기 및 거부 상태
Audit| 증거와 판단의 독립적 추적
MCP| 도구별 실행 권한 분리
Git 절차| 승인 대상 커밋의 동일성

각 개선안은 다음 세 가지로 구분한다.

A. 기존 구조로 구현 가능
B. 기존 구조의 확장 필요
C. 새로운 구성요소 필요

기존 Gate, Decision 및 Transition 체계를 중복 구현하지 않는다.

10. 단계별 도입 로드맵

Phase 1. 현재 권한 구조 조사

- 기존 세션 권한 확인
- 승인 지점 파악
- Gate의 실제 강제 능력 확인
- 우회 가능한 실행 경로 조사

산출물: Current Permission Architecture

Phase 2. 권한 및 정책 정의

- RBAC 및 ABAC 적용 범위
- L0~L3 권한 체계
- Deny / Hold 기준
- 예외 처리 정책
- 사람의 승인 범위

산출물: Permission & Approval Policy

Phase 3. 독립적인 권한 판단 계층 설계

- Policy Authority
- Policy Engine
- PDP / PEP 관계
- Supervisor와의 권한 분리

산출물: Governance Architecture

Phase 4. Gate 및 상태 관리 확장

- 승인 상태 추가
- 승인 대상 식별
- 커밋 동일성 검증
- 승인 무효화 조건
- 실행 우회 차단

산출물: Enforcement Design

Phase 5. 통합 시험

- 승인 없이 Merge 시도
- Inspector 생략
- 작성자의 자기 승인 시도
- Supervisor의 우회 시도
- 승인 이후 커밋 변경
- 중복 실행
- 세션 종료 및 복구

산출물: Governance Functional Test

Phase 6. 점진적 자동화 확대

초기에는 보고서 생성과 승인 판단 보조부터 도입한다.

이후 검증된 작업에 한해 자율 실행 범위를 확대한다.

11. 핵심 참고 문헌 및 표준

다음 자료를 우선 조사 대상으로 선정한다.

1. NIST SP 800-207, Zero Trust Architecture.
   
   - PDP, PEP 및 지속적인 접근통제 개념.

2. NIST SP 800-53 Rev. 5, Security and Privacy Controls.
   
   - 접근통제, 책임 추적, 권한 분리 및 감사.

3. NASA Systems Engineering Handbook.
   
   - 시스템 검증, 기술적 권한 및 독립 검토.

4. NIST SP 800-162, Guide to Attribute Based Access Control.
   
   - ABAC 정책 모델과 속성 기반 접근통제.

5. ISO/IEC 27001 및 ISO/IEC 27002.
   
   - 정보보안 관리와 접근통제, 책임 분리.

6. 분산 시스템의 동시성 제어 및 Event Sourcing 관련 기술 문헌.
   
   - 상태 일관성, 이벤트 기록, 중복 실행 방지.

7. 안전공학 및 시스템 안전성 분석 관련 문헌.
   
   - Fail-safe, 위험 분석, 예외 통제.

실제 원문과 적용 범위를 확인한 뒤 구체적인 서지와 근거를 확정한다.

12. 최종 결론

본 프로젝트에서 AI의 자율성을 확대하기 위해서는 AI에게 더 많은 권한을 부여하는 것만으로는 충분하지 않다.

자율 실행과 권한 통제를 동시에 발전시켜야 한다.

핵심은 다음과 같다.

- Supervisor는 작업을 조율한다.
- Author는 변경안을 작성한다.
- Inspector는 독립적으로 검증한다.
- Auditor는 절차와 증거를 감사한다.
- Approver는 정책 적합성을 판단한다.
- Gate는 권한을 실제 실행 환경에서 강제한다.
- Human은 중요한 변경을 최종 승인한다.

가장 중요한 설계 원칙은 다음과 같다.

AI의 판단 능력과 시스템의 권한 행사 능력을 분리한다.

AI가 올바른 판단을 내릴 것이라고 가정하는 것이 아니라, 잘못된 판단을 내리더라도 시스템이 위험한 실행을 차단할 수 있도록 설계해야 한다.

궁극적으로 목표하는 시스템은 AI가 사람의 지시를 기다리며 움직이는 시스템이 아니다.

AI가 스스로 계획하고, 실행하고, 검증하고, 보고하되, 중요한 권한 행사는 명시적인 정책과 독립적인 통제 아래에서 이루어지는 시스템이다.

이를 통해 사람의 개입은 일상적인 작업 관리에서 벗어나 최종적인 책임과 중요한 의사결정에 집중될 수 있다.
