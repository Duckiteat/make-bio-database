# STG-06a — 중심·모드 문서 생성

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [재건 계획 (rebuilding project) — 글이 아니라 구조가 말하게](../rebuild.md) · [순서](../ORDER.md)

- **계획 · 부**: rebuild 6a · 7. 단계
- **단계**: 중심·모드 문서 생성
- **무엇**: 규칙 장부 + 모드 원본(`rebuild/rules/modes.json`)에서 중심 문서·모드 문서 5·스킬 5 를 `rebuild/draft/` 에 생성(`rebuild/render.mjs`, 8 단계에 제자리로 — 사용자 결정 2026-10-29: 문서 + 스킬 둘 다 · 나란히 만들고 8 단계에 교체)
- **끝나는 조건**: 원본에서 바이트 동일 재생성(시험 ①) · 옛 규칙 대조(시험 ⑬)
- **상태**: ☑ 완료 2026-10-29

## 결과 (날짜별)

- `2026-10-29` `60fd2d2`: 중심 6.7 KB · 정보 작성 18 KB · 기초시험 5 · 디벨롭 7 · 적분장 1 · 점검 7 KB (목표 3–5 KB 넘음 — 6b 에서 줄일 길)

## 걸어온 길

- `2026-10-29` `60fd2d2` 계획에 들어옴 (☑ 완료) — 재건 6a: 중심·모드 문서·스킬을 규칙 장부에서 생성 (rebuild/draft — 8 단계에 교체)

## 닿는 결정

- [DEC-0016](../decisions/DEC-0016.md) 2026-10-25 모드 — 어떻게 움직이나 (사용자 결정 2026-10-25)
- [DEC-0024](../decisions/DEC-0024.md) 2026-10-29 모드 문서는 문서 + 스킬 둘 다, 나란히 만들고 8 단계에 교체
