# PLAN-067 — 생화학 기준 B0 확장

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 67 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **생화학 기준 B0 확장** — 2차 속도 차원(확산 한계) + 가정 원장·시나리오 인라인 숫자에도 물리 상한, 추상화 선언(기원 abstracted + 한계) 없이 물리 값이 아니면 거부 (`rules-regulation-tests.md` §6)
- **자리**: `vocab.physicalBounds` · `judicial/assumption_audit.js` · 시나리오 감사
- **끝나는 조건**: kon 1e30 거부 사례 · 선언하면 통과
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-10-23` `78db189` 계획에 들어옴 (☐ 대기) — 규약·규제·시험 지도 + 생화학 기준 제안(B0 물리 불가능·B1 생리 범위·B2 비율·추상화 선언), build-plan 67–69
