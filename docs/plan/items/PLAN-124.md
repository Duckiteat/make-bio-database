# PLAN-124 — MVP ④ 실증

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 124 · 11부 — 자율 오케스트레이션 (주제 → 분해 → 실행 → 통합 → 검증, 사람은 주제 · 결정 · 승락)
- **작업**: MVP ④ 실증 — PLAN-112(D000051 주장 층 시범)를 SUP-0002 로, Supervisor 가 세션을 실제로 띄워 순차로 completed 까지 · 통합 브랜치 + 통합 PR 사람 승인 하나
- **자리**: 감독 장부 · 통합 브랜치 `sup/SUP-0002` · PR
- **끝나는 조건**: SUP-0002 계산 상태 completed · 사람이 한 일 = 주제 결정(propose 의 DEC) · 관문 · 통합 PR 승인뿐(영수증 · 장부로 셈) · 증거 사슬(계획 지문 → 작업 → run → 영수증 · 전환 기록 · 커밋 → 통합 트리 → main 병합) 되짚힘 · PLAN-103 의 남은 끝나는 조건 채움 · 깨진 곳 목록 = 2 단계 입력 · 사용자 결정 H-4 · H-10 뒤
- **상태**: ☐ 대기

## 결과 (날짜별)

- `2026-11-25` 커밋 전 기록: · 2026-11-25 DEC-0102: 끝나는 조건에 더함 — 실증이 끝나면 승인 판정 코드(judicial/supervise_approval.js · rebuild/supervise.mjs)를 L6 로(저장 지도 · 모드표 except · CODEOWNERS · 서명 커밋)

## 걸어온 길

- `2026-11-24` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 사용자 결정 DEC-0096(처음 DEC-0093 으로 적음) · DEC-0097 — main(PR #25)과 번호가 겹쳐 다시 매겨 적용
- `2026-11-25` 커밋 전 기록 결과 처음 적힘 — 사용자 결정 DEC-0102 · 서명 설정 성공

## 닿는 결정

- [DEC-0096](../decisions/DEC-0096.md) 2026-11-24 오케스트레이터 순서 — MVP(최종 형식으로 · 있는 것 최대한) → 범위 넓히기 → 병렬 → 자율(사람은 주제 · 결정 · 확인 · 승락만)
- [DEC-0102](../decisions/DEC-0102.md) 2026-11-25 승인 판정 코드(judicial/supervise_approval.js · rebuild/supervise.mjs)는 MVP 실증(PLAN-124) 끝에 L6 로 — PLAN-135 확인 PR 은 CODEOWNERS 주석 두 줄
