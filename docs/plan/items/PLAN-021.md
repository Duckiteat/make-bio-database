# PLAN-021 — 정수 초월 함수

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 21 · 3부 — 판정 강화
- **작업**: **정수 초월 함수**(exp·log·pow) 두 백엔드 + "libm 호출 0" + FMA 금지
- **끝나는 조건**: 확률 실행 JS = Rust 비트
- **상태**: ☐ 대기

## 결과 (날짜별)

- `2026-11-02` 커밋 전 기록: 0단계 완료 (2026-11-02): 고치기 전후 비트 대조 도구 `tests/fingerprint.js` (snapshot · compare, 운명 엔진 52 + 속도 엔진 6 지문, 칸별 해시). 다음은 단계 쪼개기와 사용자 확인.

## 걸어온 길

- `2026-10-15` `ca92cdd` 계획에 들어옴 (☐ 대기) — 구현 계획: 검증·저장·적분 엔진 작업 40개 (docs/design/build-plan.md)
- `2026-11-02` 커밋 전 기록 결과 처음 적힘 — PLAN-021 0단계(지문 대조 도구)를 끝냄 — 정수 초월 함수로 바꾸기 전에 결과 비교 수단을 먼저 둠 (DEC-0049)

## 닿는 결정

- [DEC-0004](../decisions/DEC-0004.md) 2026-10-15 북극성 — 살아 있는 생명체의 기전 연구, 자원 먼저 장 나중
- [DEC-0005](../decisions/DEC-0005.md) 2026-10-16 측정·기록 인프라 점검 + 계측기 시기(TIER A·B·C)
- [DEC-0007](../decisions/DEC-0007.md) 2026-10-16 보존 분류를 기저 데이터로 — 범용 BigInt 고정소수점은 반려
- [DEC-0049](../decisions/DEC-0049.md) 2026-11-02 엔진 먼저 — 시계 안전망 시험 → 시계 정리(관찰 격자 한정) 순서로
