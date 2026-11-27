# PLAN-121 — MVP ① 감독 장부 형식 일반화

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 121 · 11부 — 자율 오케스트레이션 (주제 → 분해 → 실행 → 통합 → 검증, 사람은 주제 · 결정 · 승락)
- **작업**: MVP ① 감독 장부 형식 일반화 — 목표 = SUP, steps → tasks(DAG: depends_on · 계약 · human_gate 노드) · run 을 작업 아래로 · 계획 지문 + 결정 번호 · start 에 dispatch 칸 · 옛 장부 그대로 읽힘
- **자리**: `rebuild/supervise.mjs` (shape · fold · admit · FIELDS) · `docs/design/supervisor.md` v1 · `docs/textbook/` 해당 장 · 시험
- **끝나는 조건**: 옛 SUP-0001 이 같은 상태로 접힘(호환 시험) · 고리 있는 DAG 거부 · 계획 지문이 결정과 다르면 거부 · 계약 쓰기 구역이 모드 구역보다 넓으면 거부(좁히기만 — RULE-0461) · 권한 · 승인 칸 거부 그대로 · 사용자 결정 H-2 · H-3 · H-5 · H-7 (설계 보고서 H 장) 뒤. 병렬 1 이어도 형식은 최종 모양 — 뒤 단계가 형식을 다시 바꾸지 않게
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-24` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 사용자 결정 DEC-0096(처음 DEC-0093 으로 적음) · DEC-0097 — main(PR #25)과 번호가 겹쳐 다시 매겨 적용

## 닿는 결정

- [DEC-0096](../decisions/DEC-0096.md) 2026-11-24 오케스트레이터 순서 — MVP(최종 형식으로 · 있는 것 최대한) → 범위 넓히기 → 병렬 → 자율(사람은 주제 · 결정 · 확인 · 승락만)
- [DEC-0102](../decisions/DEC-0102.md) 2026-11-25 승인 판정 코드(judicial/supervise_approval.js · rebuild/supervise.mjs)는 MVP 실증(PLAN-124) 끝에 L6 로 — PLAN-135 확인 PR 은 CODEOWNERS 주석 두 줄
