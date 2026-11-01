# PLAN-049 — 가정 원장

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 49 · 7부 — 구조 재편 (가정·판정·측정법을 1급으로)
- **작업**: **가정 원장** `data/assumptions.jsonl`(A…, 추가 전용 사슬, revises) + 시나리오 번호 참조 + 컴파일러 풀기
- **자리**: 입법·서기 `registry` · `judicial/assumption_audit.js` · `compiler/assumptions.js` · `scenarios.js` · `migrations/012`
- **끝나는 조건**: 미등록 시나리오 변환 전후 풀린 시나리오 동일 · 등록 5건 불변 · 감사 거부 시험
- **상태**: ☑ 완료 2026-10-23

## 결과 (날짜별)

- `2026-10-23` `9c71dbe`: 시나리오 34개·숫자 자리 1,696 → 기록 360(assumed 208·unrecorded 152), 무손실. 연결 규약: 번호는 자기 자리에만·최신 따라가기 없음·새 등록은 인라인 숫자 거부·사전 등록 사건에 번호 목록. `assume`·`assume uses`·`assume add`, validate 포함. 시험 `tests/assumptions.test.mjs`(8). 첫 장면 기원에 저장소 양(reservoirs)도 셈(합계 실측 12·추상 40·가정 1,108·기원 없음 540, 43 시나리오)

## 걸어온 길

- `2026-10-23` `60110ae` 계획에 들어옴 (☐ 대기) — 구조 재편 설계 — 가정·판정·측정법을 1급 기록으로 (7부 49–57)
- `2026-10-23` `9c71dbe` '자리' 칸이 바뀜 — 가정 원장 (build-plan 49) — 시나리오의 가상 숫자에 번호, 고쳐 쓰지 않는 사슬

  <details><summary>이전 · 이후</summary>

이전: 입법·서기 `registry` · `judicial/assumption_audit.js` · `compiler/ir_builder.js` · `migrations/012`

이후: 입법·서기 `registry` · `judicial/assumption_audit.js` · `compiler/assumptions.js` · `scenarios.js` · `migrations/012`

</details>
- `2026-10-23` `9c71dbe` '끝나는 조건' 칸이 바뀜 — 가정 원장 (build-plan 49) — 시나리오의 가상 숫자에 번호, 고쳐 쓰지 않는 사슬

  <details><summary>이전 · 이후</summary>

이전: 미등록 시나리오 변환 전후 IR 해시·궤적 비트 동일 · 등록 5건 불변 · 감사 거부 시험

이후: 미등록 시나리오 변환 전후 풀린 시나리오 동일 · 등록 5건 불변 · 감사 거부 시험

</details>
- `2026-10-23` `9c71dbe` 상태 ☐ → ☑ 2026-10-23 — 가정 원장 (build-plan 49) — 시나리오의 가상 숫자에 번호, 고쳐 쓰지 않는 사슬
- `2026-10-23` `9c71dbe` 결과 처음 적힘 — 가정 원장 (build-plan 49) — 시나리오의 가상 숫자에 번호, 고쳐 쓰지 않는 사슬

## 닿는 결정

- [DEC-0012](../decisions/DEC-0012.md) 2026-10-23 구조 재편 — 가정·판정·측정법을 1급 기록으로 (7부)
- [DEC-0013](../decisions/DEC-0013.md) 2026-10-23 순서 바꿈 ② — 49 뒤에 58–60(전문 받는 쪽)을 먼저
