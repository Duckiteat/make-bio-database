# PLAN-116 — 거버넌스 — 권한 분리 · 독립 검증 대조 조사

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 116 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **거버넌스 — 권한 분리 · 독립 검증 대조 조사** (DEC-0073 뒤에 일어난 일 2026-11-22) — 사용자 제안서(원문 보존 docs/reports/2026-11-22-governance-architecture-proposal.md): 직무 분리 · 최소 권한 · IV&V · RBAC+ABAC · PDP/PEP · 상태 기계(Deny/Hold 구분) · 사건 기록 · 동시성(fencing token) · L0–L3 위험 단계 · 공통 원인 실패와 독립성 다섯 요소 · 최종 승인 보고서(승인 대상 커밋 동일성, 승인 뒤 변경이면 무효). 먼저 Phase 1 만: 이미 있는 구조(문지기 gate.mjs · 권한 장부 permissions.jsonl · judicial/approval.js · supervise_approval.js · 전환 기록 · 감독 장부 PLAN-099 · 100 · 병합 = 사람 DEC-0069 · PLAN-113 · 승인 증거 판정 PLAN-102 · Governor CI 겹 PLAN-114)와 제안 항목을 대응표로, 항목마다 A 기존 구조로 됨 · B 확장 · C 새 구성요소, 우회 가능한 실행 경로 목록. 중복 구현 금지. 산출물은 조사 보고서 하나(구현은 별도 승인 뒤). DEC-0066 메타 편중 경보를 순서에서 고려
- **자리**: docs/reports/ (조사 보고서) — 구현이 승인되면 rebuild/gate.mjs · judicial/ · rebuild/rules/permissions.jsonl
- **끝나는 조건**: 대응표(A · B · C) · 우회 경로 목록 · 사용자 결정(무엇을 언제 구현할지)
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-22` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 사용자 결정(세션 답 2026-11-22 — develop 세션 시작 건의사항, '등록 후 PLAN-115 먼저'): 거버넌스 아키텍처 제안서를 원문 보존하고 새 작업으로 등록. 이 세션은 PLAN-115 설계 보고서만 — 이 작업은 뒤 세션
