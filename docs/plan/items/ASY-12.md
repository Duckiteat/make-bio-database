# ASY-12 — 출처 고정

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [측정법 계획 — 기초 판독에서 조합·심화로 (만든 방법을 남기며)](../assay.md) · [순서](../ORDER.md)

- **계획 · 부**: assay 12 · 측정법 사다리
- **단계**: 출처 고정
- **무엇**: 관찰마다 원문 위치(받은 파일 sha256 · 쪽/표 · 인용문)와 값을 낸 분석 코드의 commit. 원문 숫자(reported.value)가 인용문에 글자 그대로, 인용문이 받은 원문에 그대로 있는지 기계가 확인 — RULE-0525 는 저장된 원문 숫자와 값만 대조하므로 처음 옮길 때의 잘못을 여기서 닫음(센티넬 대신). 받을 때 출처 DOI 의 철회 여부(Crossref · Retraction Watch) 확인 (docs/reports/2026-11-01-data-integrity.md §4)
- **끝나는 조건**: 인용문에 없는 숫자 거부 · 원문에 없는 인용문 거부 · 철회 DOI 표시 · 옛 관찰 22 의 원문 숫자는 이 위에서 채움
- **상태**: ☐ 대기

## 결과 (날짜별)

- 결과 기록 없음

## 걸어온 길

- `2026-11-01` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 자료 무결성 종합 — 제안 사양서와 다른 방법을 뺄 것은 빼고 묶어 계획에 넣고 순서를 정함 (사용자 요청 2026-11-01, docs/reports/2026-11-01-data-integrity.md)

## 닿는 결정

- [DEC-0046](../decisions/DEC-0046.md) 2026-11-01 자료 무결성 — 제안 사양서를 뺄 것은 빼고 종합 (받음 · 고쳐 받음 · 보류 · 반대)
