# PLAN-107 — M1 관측 묶음

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 107 · 10부 — 자기 개선 루프 (관측 · 제안 · 승인 · 증거)
- **작업**: **M1 관측 묶음** — 기존 탐지기(validate · probe --check · limitations --detect · attest · trend · grade · 상태판 · merge-check)의 결과를 한 모양(탐지기 · 판 · 커밋 · 값 · 기준선 · 항목 지문)의 **생성물**로 묶음 + 새 탐지기 넷(모듈 그래프의 데드존 · 서기 밖 쓰기 · 장부 밖 계획 꼴 절 · 낡은 진행). 과학 축 지표(실측 상수 · 정량 검증 관찰 · D000051 · 실험 비교)를 같은 묶음에 따로. 근거 `docs/reports/2026-11-21-self-improvement-loop-minimal.md` §4 · §6
- **자리**: `rebuild/status.mjs` · 상태판 생성물 · 새 생성기(rebuild 아래)
- **끝나는 조건**: 생성물 · 시험 · 지금 값이 보고서 §5.3 기준선과 같음 · 두 축을 함께 보고(과학 축 먼저)
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-21` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0066 · DEC-0067 — 자기 개선 루프 최소판 채택 · 권장 결정 전부 · 개발 순서는 조율(오케스트레이터)부터

## 닿는 결정

- [DEC-0066](../decisions/DEC-0066.md) 2026-11-21 자기 개선 루프 — 최소판(관측 묶음 · 제안 연결 · 사람 승인 · 증거 완료) · RP1 · RP2 첫 사이클 · 탐지기 보호 · 과학 진척 지표 분리 · 권장 결정 전부
