# PLAN-116 — 거버넌스 — 권한 분리 · 독립 검증 대조 조사

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 116 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **거버넌스 — 권한 분리 · 독립 검증 대조 조사** (DEC-0073 뒤에 일어난 일 2026-11-22) — 사용자 제안서(원문 보존 docs/reports/2026-11-22-governance-architecture-proposal.md): 직무 분리 · 최소 권한 · IV&V · RBAC+ABAC · PDP/PEP · 상태 기계(Deny/Hold 구분) · 사건 기록 · 동시성(fencing token) · L0–L3 위험 단계 · 공통 원인 실패와 독립성 다섯 요소 · 최종 승인 보고서(승인 대상 커밋 동일성, 승인 뒤 변경이면 무효). 먼저 Phase 1 만: 이미 있는 구조(문지기 gate.mjs · 권한 장부 permissions.jsonl · judicial/approval.js · supervise_approval.js · 전환 기록 · 감독 장부 PLAN-099 · 100 · 병합 = 사람 DEC-0069 · PLAN-113 · 승인 증거 판정 PLAN-102 · Governor CI 겹 PLAN-114)와 제안 항목을 대응표로, 항목마다 A 기존 구조로 됨 · B 확장 · C 새 구성요소, 우회 가능한 실행 경로 목록. 중복 구현 금지. 산출물은 조사 보고서 하나(구현은 별도 승인 뒤). DEC-0066 메타 편중 경보를 순서에서 고려
- **자리**: docs/reports/ (조사 보고서) — 구현이 승인되면 rebuild/gate.mjs · judicial/ · rebuild/rules/permissions.jsonl
- **끝나는 조건**: 대응표(A · B · C) · 우회 경로 목록 · 사용자 결정(무엇을 언제 구현할지) — 2026-11-23 DEC-0074: 1 단계 보고서의 G2–G4(Deny/Hold 사유 표 · 검수 독립성 계산 · 승인 보고서 읽기 명령) 구현과 시험까지, PLAN-104 의 선행
- **상태**: ◐ 진행 2026-11-23

## 결과 (날짜별)

- `2026-11-23` 커밋 전 기록: 2026-11-23 1 단계 보고서 docs/reports/2026-11-23-plan-116-phase1-governance-mapping.md — 제안서 13 항목: A 7 · B 5 · C 1(Auditor, 만들지 않기를 권함). 비교(제안서 · 앞선 결정 DEC-0064–0070 · 구현): 틀은 앞선 결정이 나음(Supervisor 비작성 · 판정은 코드 · 상태와 승인은 계산), 빈칸은 제안서가 나음(Deny/Hold 사유 · 독립성 다섯 요소 · 승인 보고서 12 칸 · 우회 대본 시험). 이름 겹침: 제안서 L0–L3 ↔ 권한 등급 L0–L6 → R0–R3 로 바꾸고 자리 등급에서 계산 권고. 우회 경로 아홉 — 무거운 것: 훅 없는 커밋 · 선언 없음은 알리기만(main 보호는 사용자 설정 V3) · 세션 중 브랜치 바꾸기(이 세션 영수증 violation 1 건 · 다시 열기는 아무것도 바꾸지 않음 — 2026-11-22 보고 정정). 권고 G1–G8 · 사용자 결정 U1–U6 (보고서 §5 · §6) — G1–G5 는 PLAN-112 뒤 · PLAN-104 앞
- `2026-11-23` 커밋 전 기록: 2026-11-23 G2–G4 구현 (DEC-0077): G2 원인 태그 일곱 → 거부 deny(ENGINE_DEFECT · COMPILER_DEFECT · EXEC_FAILURE) · 보류 hold(FINDING · DATA_GAP · DOMAIN_CONFLICT · NUMERICAL) — rebuild/supervise.mjs CAUSE_KIND, 사건 형식 그대로 · G3 검수 독립성 다섯 요소 계산(judicial/supervise_approval.js independence — 정보 접근 · 판단 근거는 영수증 명령 글에서 추정) · G4 승인 보고서 node rebuild/supervise.mjs report <SUP-…> (제안서 §8 12 칸 · 최종 권고는 규칙 recommend · 승인 아님). SUP-0001 에 돌린 결과: r2 독립성 limited — 권한 요소 ✗(author 와 inspect 의 쓰기 자리가 attestations/** 에서 겹침 — 모드 표의 사실, 바꾸지 않음 · 사용자 결정 대기) · 정보 접근 ○ · 판단 근거 ○(작성 패치 PMID 11 모두 검수 영수증이 가리킴) · 최종 권고 hold. 남은 것: G1 위험 단계 이름 · G5 우회 대본 시험 · G6–G8
- `2026-11-23` 커밋 전 기록: 2026-11-23 G3 권한: author(augment apply 신원 도장 · trend 추세 도장)와 inspect(accept 승인 도장 · trend)가 attestations/** 를 함께 씀 — 메모리 시험으로 author 의 승인 도장 위조 · 도장 지우기가 탐지되지 않음을 확인. 사용자 결정 DEC-0078: 도장 종류로 나눔(author verified · trend / inspect accept · 승인 도장은 추가만) · trend 는 author 만. develop 커밋 bc9bfad — 판정 registryPolicy(RULE-0542) · CI 강제 · 독립성 권한 요소가 내용 정책을 봄(정책이 없으면 그대로 limited). L6(모드표 stamps · 문지기 · 권한 장부 PERM-0024 · 0025 · 자기 검사 시험)은 승인 묶음 workspace/PLAN-116-G3-bundle.* (git apply --check 통과 · 지문 28d566583c1e…) — 사용자 커밋 대기, 그 전까지 SUP-0001 r2 권한 요소 ✗ 그대로. G5: 시나리오 A–E 대조 보고서 docs/reports/2026-11-23-plan-116-g5-bypass-scenarios.md — 탐지되지 않던 셋을 고침(DEC-0079): 검수 뒤 작성 넘김 · 독립성 unknown 은 hold(RULE-0543) · 감독 장부 · 전환 기록 덧붙이기만(CI, RULE-0544) · 시험 tests/bypass_scenarios.test.mjs. SUP-0001 최종 권고 hold — 검수 뒤 r3 author. 미해결: E3(전환 기록에 상위 작업 칸 — 형식 변경) · D4(PLAN-104 미구현) · 문지기의 장부 덧붙이기만 검사(다음 묶음). 남은 것: G1 · G6–G8

## 걸어온 길

- `2026-11-22` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 사용자 결정(세션 답 2026-11-22 — develop 세션 시작 건의사항, '등록 후 PLAN-115 먼저'): 거버넌스 아키텍처 제안서를 원문 보존하고 새 작업으로 등록. 이 세션은 PLAN-115 설계 보고서만 — 이 작업은 뒤 세션
- `2026-11-23` 커밋 전 기록 결과 처음 적힘 — 사용자 요청(세션 답 2026-11-23 '그거 PLAN-116 1 단계 보고서로 저장해 주고, 내가 말한것도 싹 비교해서 머가 나은지 생각해보자') — 1 단계(지금 권한 구조 조사) 보고서
- `2026-11-23` 커밋 전 기록 '끝나는 조건' 칸이 바뀜 — 사용자 결정(세션 답 2026-11-23 '나는 구조가 지금 내손을 덜타야 더빨리 빠르게 쌓인다고 보거든. 왜냐면 지금 데이터 싹 갈게생겼는데 이걸 그냥 둘순없으니따' · 선택 '권고 순서로')

  <details><summary>이전 · 이후</summary>

이전: 대응표(A · B · C) · 우회 경로 목록 · 사용자 결정(무엇을 언제 구현할지)

이후: 대응표(A · B · C) · 우회 경로 목록 · 사용자 결정(무엇을 언제 구현할지) — 2026-11-23 DEC-0074: 1 단계 보고서의 G2–G4(Deny/Hold 사유 표 · 검수 독립성 계산 · 승인 보고서 읽기 명령) 구현과 시험까지, PLAN-104 의 선행

</details>
- `2026-11-23` 커밋 전 기록 상태 ☐ → ◐ 2026-11-23 — PLAN-116 G2–G4 구현 (DEC-0077)
- `2026-11-23` 커밋 전 기록 결과 덧붙음 — PLAN-116 G2–G4 구현 (DEC-0077)
- `2026-11-23` 커밋 전 기록 결과 덧붙음 — PLAN-116 G3 권한 개선 · G5 우회 시나리오 (DEC-0078 · DEC-0079)

## 닿는 결정

- [DEC-0074](../decisions/DEC-0074.md) 2026-11-23 사람 손을 덜 타는 구조 먼저 — 주장 층(115) → 승인 보조(116 G2–G4) → 자동 배정(104) → D000051 주장 층 시범(112, 자동 순환) · author P1 손 고침은 시범으로 흡수
- [DEC-0077](../decisions/DEC-0077.md) 2026-11-23 PLAN-116 G2–G4 만 — Deny/Hold 사유 표 · 검수 독립성 계산 · 승인 보고서 읽기 명령 (모두 계산, 장부에 새 칸 없음)
- [DEC-0078](../decisions/DEC-0078.md) 2026-11-23 도장 등록부 — 모드마다 낼 수 있는 도장 종류(author: verified · trend / inspect: accept) · 승인 도장은 누구도 지우거나 바꾸지 못함 · trend --write 는 author 만
- [DEC-0079](../decisions/DEC-0079.md) 2026-11-23 G5 — 검수 뒤 바뀐 대상 · 검수 영수증 없음은 보류 · 감독 장부와 전환 기록은 CI 에서 덧붙이기만 (탐지되지 않던 우회 셋)
