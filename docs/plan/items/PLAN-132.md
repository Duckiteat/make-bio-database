# PLAN-132 — 자율 ① Planner

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 132 · 11부 — 자율 오케스트레이션 (주제 → 분해 → 실행 → 통합 → 검증, 사람은 주제 · 결정 · 승락)
- **작업**: 자율 ① Planner — 주제 한 줄에서 목표 계획(DAG · 계약 · 완료 조건 · 사람 관문) 초안 · 사람은 계획 지문 하나를 결정으로 승인 · 재계획 절차
- **자리**: 계획 절차 문서 · 계획 초안 꼴 · `rebuild/supervise.mjs` propose
- **끝나는 조건**: 주제 → 초안 → 사람 결정 하나 → 실행까지 사람 손 한 번 · Planner 와 Supervisor 가 같은 AI 여도 계획 지문 밖으로 못 나감(시험) · 재계획 = 새 propose + 새 결정
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-24` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 사용자 결정 DEC-0096(처음 DEC-0093 으로 적음) · DEC-0097 — main(PR #25)과 번호가 겹쳐 다시 매겨 적용

## 닿는 결정

- [DEC-0096](../decisions/DEC-0096.md) 2026-11-24 오케스트레이터 순서 — MVP(최종 형식으로 · 있는 것 최대한) → 범위 넓히기 → 병렬 → 자율(사람은 주제 · 결정 · 확인 · 승락만)
