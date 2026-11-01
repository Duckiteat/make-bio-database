# PLAN-059 — 정량 판정 맥락 이전

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 59 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **정량 판정 맥락 이전** (§6 ②)
- **자리**: 조정자 `observeFate` · `judicial/protocol.js`
- **끝나는 조건**: 정량 판정에 context_transfer · 시험
- **상태**: ☑ 완료 2026-10-23

## 결과 (날짜별)

- `2026-10-23` `8d9db0c`: `orchestrator.quantContext`(측정 = 관찰 condition, 판정 = 시나리오·세포 상태·기준 종, 종·세포만) · `obs_compare.verdictText` 가 표시 · 판정은 막지 않음 · 시험 `dose_slope ⑥`(생쥐 10090 → 사람 9606). 종 정책은 보류

## 걸어온 길

- `2026-10-23` `5796eea` 계획에 들어옴 (☐ 대기) — 외주화와 MCP 분리 설계 — 만드는 일은 밖에, 판정·쓰기는 안에
- `2026-10-23` `8d9db0c` 상태 ☐ → ☑ 2026-10-23 — 정량 판정의 맥락 이전 (build-plan 59) — 생쥐 측정을 사람 모델로 판정하면 표시
- `2026-10-23` `8d9db0c` 결과 처음 적힘 — 정량 판정의 맥락 이전 (build-plan 59) — 생쥐 측정을 사람 모델로 판정하면 표시

## 닿는 결정

- [DEC-0013](../decisions/DEC-0013.md) 2026-10-23 순서 바꿈 ② — 49 뒤에 58–60(전문 받는 쪽)을 먼저
