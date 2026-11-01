# PLAN-077 — 추세 재확인 자동화가 실제로 돌게

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 77 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **추세 재확인 자동화가 실제로 돌게** (평가 §3) — 예약 작업 '추세 재확인 (매달)'(매달 3일 08:41 서울, trig_01F8u8Uv6zMLRRdiignASP1P)은 저장소·커넥터 없이 만들어졌다. 사용자가 claude.ai 예약 작업 화면에서 저장소 duckiteat/make-bio-database 와 GitHub 커넥터를 붙여야 한다. 안 되면 11/11 부터 anchor 74 → 45, 12/6 부터 0
- **자리**: 운영
- **끝나는 조건**: 11/3 첫 실행 결과(받음·match·도장·PR)
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-10-25` `d0f6b92` 계획에 들어옴 (☐ 대기) — Handoff for other sessions: direction priorities, build-plan rows 74-79, NEXT note

## 닿는 결정

- [DEC-0030](../decisions/DEC-0030.md) 2026-10-25 구조 평가 뒤 순서 — 77 → 78 → 52 → 71 → 79
- [DEC-0042](../decisions/DEC-0042.md) 2026-11-01 순서와 내용을 뗀다 — 순서 파일 하나(세 계획을 한 줄로) + 작업·결정마다 내용 파일, 큰 계획 문서 둘은 이것으로 대체
