# STG-06e — 관리 파일 JSON 원본 · 삼권 분립 점검

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [재건 계획 (rebuilding project) — 글이 아니라 구조가 말하게](../rebuild.md) · [순서](../ORDER.md)

- **계획 · 부**: rebuild 6e · 7. 단계
- **단계**: 관리 파일 JSON 원본 · 삼권 분립 점검
- **무엇**: status 를 JSON 원본 + 렌더로, governance 와 같은 커밋
- **끝나는 조건**: governance 통과
- **상태**: ☑ 완료 2026-10-29

## 결과 (날짜별)

- `2026-10-29` `e4423d8`: `rebuild/status/status.json`: 관리 파일마다 제목·절·표(머리·행)·글을 기계용으로(`status.mjs` `toJson`), 표를 다시 그리면 .md 와 칸까지 같음(시험 ⑰ — 칸 안의 맨 `|` 를 표 도우미가 `\|` 로). 삼권 점검: 새 쓰기는 모두 서기 구역(`transition` · `rebuild` 에 `rebuild/state/` 추가, `writeState`), `rebuild/read·render·state.mjs` 와 `judicial/transition_audit.js` 는 쓰지 않음(governance ① 통과 21/21). md 는 8 단계까지 사람이 읽는 원본 보기로 남김

## 걸어온 길

- `2026-10-29` `60fd2d2` 계획에 들어옴 (☐ 대기) — 재건 6a: 중심·모드 문서·스킬을 규칙 장부에서 생성 (rebuild/draft — 8 단계에 교체)
- `2026-10-29` `e4423d8` 상태 ☐ → ☑ 2026-10-29 — 재건 6c′·6e: 상태 기록 · 관리 파일 JSON · 삼권 점검
- `2026-10-29` `e4423d8` 결과 처음 적힘 — 재건 6c′·6e: 상태 기록 · 관리 파일 JSON · 삼권 점검

## 닿는 결정

- [DEC-0017](../decisions/DEC-0017.md) 2026-10-25 두 독자 — 원본은 기계용, 사람은 읽기 모드로만 (사용자 결정 2026-10-25)
- [DEC-0023](../decisions/DEC-0023.md) 2026-10-25 관리 파일 — 자동 갱신, 읽기 점검용
