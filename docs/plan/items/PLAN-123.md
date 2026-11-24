# PLAN-123 — MVP ③ Supervisor 루프 · 끝 알림 · 깨우기 · 정지

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 123 · 11부 — 자율 오케스트레이션 (주제 → 분해 → 실행 → 통합 → 검증, 사람은 주제 · 결정 · 승락)
- **작업**: MVP ③ Supervisor 루프 · 끝 알림 · 깨우기 · 정지 — 클라우드 세션 도구로 띄우고 첫 지시를 정해진 꼴로 · 끝 알림 형식 · 시간 한도(send_later) · 정지 스위치
- **자리**: `docs/design/supervisor.md` §6 · 첫 지시 틀(`docs/templates/`) · 정책 장부
- **끝나는 조건**: 절차 문서와 첫 지시 틀 · Supervisor 가 저장소에 쓰지 않음(영수증) · 배정 사실이 실행 세션의 start 에 남음 · 끝 알림 · 시간 한도 · 정지가 각각 한 번 실제로 동작 · 규격 §8 열린 것 셋 닫음
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-24` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 사용자 결정 DEC-0096(처음 DEC-0093 으로 적음) · DEC-0097 — main(PR #25)과 번호가 겹쳐 다시 매겨 적용

## 닿는 결정

- [DEC-0096](../decisions/DEC-0096.md) 2026-11-24 오케스트레이터 순서 — MVP(최종 형식으로 · 있는 것 최대한) → 범위 넓히기 → 병렬 → 자율(사람은 주제 · 결정 · 확인 · 승락만)
