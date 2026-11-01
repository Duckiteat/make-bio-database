# ASY-14 — 내부 일관성

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [측정법 계획 — 기초 판독에서 조합·심화로 (만든 방법을 남기며)](../assay.md) · [순서](../ORDER.md)

- **계획 · 부**: assay 14 · 측정법 사다리
- **단계**: 내부 일관성
- **무엇**: 원문 안의 앞뒤 — 평균·SD·SEM·n·신뢰구간이 서로 맞는지(SEM = SD/√n 등) · 정수 자료에서 나올 수 없는 평균(GRIM) · SD 와 SEM 을 바꿔 적은 흔적. 걸리면 거부가 아니라 사유를 붙여 사람에게(원문이 틀렸을 수 있음) (docs/reports/2026-11-01-data-integrity.md §4)
- **끝나는 조건**: 알려진 불가능 조합을 잡음 · 바꿔 적힌 SD/SEM 표시 시험
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-01` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 자료 무결성 종합 — 제안 사양서와 다른 방법을 뺄 것은 빼고 묶어 계획에 넣고 순서를 정함 (사용자 요청 2026-11-01, docs/reports/2026-11-01-data-integrity.md)

## 닿는 결정

- [DEC-0046](../decisions/DEC-0046.md) 2026-11-01 자료 무결성 — 제안 사양서를 뺄 것은 빼고 종합 (받음 · 고쳐 받음 · 보류 · 반대)
