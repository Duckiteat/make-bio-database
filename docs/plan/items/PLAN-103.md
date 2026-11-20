# PLAN-103 — 첫 순환 — cAMP (손으로, 순차)

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 103 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **첫 순환 — cAMP (손으로, 순차)** — ORCH-0001: 전환 기록 #8 의 D000050 cAMP 신호 경로 중 데이터만으로 되는 부분(출처 보강)을 author 세션 → inspect 세션(판정 · 도장) → PR(승인 묶음 지문) → 사용자 병합 → baseline 세션으로 한 번 돈다. 각 세션은 스스로 gate open · finish. 사람이 세션을 띄우고 장부는 orch 명령으로만. #9 에서 막힌 끄는 단계(효과 형식 없음)는 이 순환 밖
- **자리**: `workspace/orchestration/` · 기존 handoff · receipts · transitions
- **끝나는 조건**: ORCH-0001 completed — 모든 사건이 영수증 · 전환 기록 · 병합 커밋을 가리키고 되짚힘 · 순환에서 깨진 곳 목록(이것이 PLAN-104 의 입력)
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-20` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0064 — 여러 모드 세션을 잇는 상위 작업 조율(오케스트레이션), 사용자 요청 2026-11-20

## 닿는 결정

- [DEC-0064](../decisions/DEC-0064.md) 2026-11-20 작업 조율(오케스트레이션) — Hybrid · DB 반영은 사람 승인 · 모드 권한 유지 · 기존 기록 재사용 · 승인 증거는 사람이 병합한 PR
- [DEC-0065](../decisions/DEC-0065.md) 2026-11-20 작업 조율 보강 다섯 + 가상 실행 — Supervisor 는 쓰지 않음 · 전환 형식 불변 · 세션 브랜치 잇기 · 077 뒤 순환 · 안전장치
