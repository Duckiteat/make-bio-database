# PLAN-122 — MVP ② 순수 함수 넷 최소판

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 122 · 11부 — 자율 오케스트레이션 (주제 → 분해 → 실행 → 통합 → 검증, 사람은 주제 · 결정 · 승락)
- **작업**: MVP ② 순수 함수 넷 최소판 — schedule(실행 가능 집합 · 병렬 한도 1 · develop · field 자동 배정 거부) · reconcile(조정 표) · barrier(목표 관문 아홉 조건) · freshness(입력 지문) + 정책 장부(병렬 한도 · 재시도 · 시간 한도)
- **자리**: `rebuild/supervise.mjs` schedule · reconcile · `judicial/supervise_approval.js` barrier · `judicial/` freshness · 정책 장부(새, L4 — 사용자 결정 H-8)
- **끝나는 조건**: 모두 순수(쓰기 · 실행 없음 — 삼권 시험) · schedule 은 같은 입력 같은 출력 · start 의 admit 이 같은 schedule 을 다시 돌려 집합 밖이면 거부 · 조정 표 일곱 줄 시험 · 관문 조건을 하나씩 빼면 completed 아님 · 변이 시험(검사를 끄면 시험이 빨개짐) · 정책 칸으로 권한을 넓힐 수 없음 시험
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-24` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 사용자 결정 DEC-0096(처음 DEC-0093 으로 적음) · DEC-0097 — main(PR #25)과 번호가 겹쳐 다시 매겨 적용

## 닿는 결정

- [DEC-0096](../decisions/DEC-0096.md) 2026-11-24 오케스트레이터 순서 — MVP(최종 형식으로 · 있는 것 최대한) → 범위 넓히기 → 병렬 → 자율(사람은 주제 · 결정 · 확인 · 승락만)
