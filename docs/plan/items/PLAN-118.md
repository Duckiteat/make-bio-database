# PLAN-118 — 승인 증거를 GitHub 사실로

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 118 · 11부 — 자율 오케스트레이션 (주제 → 분해 → 실행 → 통합 → 검증, 사람은 주제 · 결정 · 승락)
- **작업**: 승인 증거를 GitHub 사실로 — 사람 승인 = 통합 PR 의 승인 리뷰 · merged_by 가 사람 계정 · awaiting_approval 은 PR 이 있을 때만
- **자리**: `judicial/supervise_approval.js` judge · derive · `rebuild/supervise.mjs` evidence (사실 모으기 — GitHub 읽기)
- **끝나는 조건**: 봇 병합 · 승인 0 · PR 없음 각각 승인 아님 시험 · 사람 승인 + 바이트 일치 → approved 시험 · 규격 4.3 ② 를 Claude 설정 deny 에서 GitHub 사실로 · 설계 보고서 A.5-2 · A.5-3 해소
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-24` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 사용자 결정 DEC-0093 — 오케스트레이터를 MVP(최종 형식) → 범위 → 병렬 → 자율 순서로 계획

## 닿는 결정

- [DEC-0093](../decisions/DEC-0093.md) 2026-11-24 오케스트레이터 순서 — MVP(최종 형식으로 · 있는 것 최대한) → 범위 넓히기 → 병렬 → 자율(사람은 주제 · 결정 · 확인 · 승락만)
