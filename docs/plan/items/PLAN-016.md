# PLAN-016 — SQLite 색인

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 16 · 2부 — 보고서 · 저장 확장
- **작업**: **SQLite 색인**(`node:sqlite`, 파생) + 해시 대조
- **자리**: 색인 모듈 · 사법부 대조
- **끝나는 조건**: 색인 삭제 후 재생성 동일
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-10-15` `ca92cdd` 계획에 들어옴 (☐ 대기) — 구현 계획: 검증·저장·적분 엔진 작업 40개 (docs/design/build-plan.md)

## 닿는 결정

- [DEC-0003](../decisions/DEC-0003.md) 2026-10-15 순서 조정 — 12A 정성 관찰 수집을 넣고 15–19 를 뒤로
- [DEC-0004](../decisions/DEC-0004.md) 2026-10-15 북극성 — 살아 있는 생명체의 기전 연구, 자원 먼저 장 나중
- [DEC-0029](../decisions/DEC-0029.md) 2026-10-22 우선순위 — 데이터 먼저 · 공간 관찰이 공간 엔진보다 먼저 · 2부는 가독성·검증부터
