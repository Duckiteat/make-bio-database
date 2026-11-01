# PLAN-078 — 실측 상수 늘리기

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 78 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **실측 상수 늘리기** (평가 §1 — 북극성 ① 이 가장 약함) — 시뮬레이션 속도 상수 중 데이터 값 4 · 가상 186(약 2 %). 사람 값(BRENDA·SABIO-RK·1차 논문, 무료만)을 관찰(O+1)로 넣고 `kinetics.from` 으로 잇는다. 2차 정리 값은 1차 논문을 확인해 새 관찰로 대체(L 3건). 지표: 시뮬레이션 상수의 실측 비율
- **자리**: 수집 고리(`fetch`·핸드오프) · 패치
- **끝나는 조건**: 비율 전후 · 궤적 전후 비교
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-10-25` `d0f6b92` 계획에 들어옴 (☐ 대기) — Handoff for other sessions: direction priorities, build-plan rows 74-79, NEXT note

## 닿는 결정

- [DEC-0030](../decisions/DEC-0030.md) 2026-10-25 구조 평가 뒤 순서 — 77 → 78 → 52 → 71 → 79
- [DEC-0042](../decisions/DEC-0042.md) 2026-11-01 순서와 내용을 뗀다 — 순서 파일 하나(세 계획을 한 줄로) + 작업·결정마다 내용 파일, 큰 계획 문서 둘은 이것으로 대체
