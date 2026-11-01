# STG-01 — 분류 1차

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [재건 계획 (rebuilding project) — 글이 아니라 구조가 말하게](../rebuild.md) · [순서](../ORDER.md)

- **계획 · 부**: rebuild 1 · 7. 단계
- **단계**: 분류 1차
- **무엇**: CLAUDE.md + agent-rules → 장부
- **끝나는 조건**: 모든 문장이 단위 하나 이상 · 모드별 개수와 빈 모드가 관리 파일에
- **상태**: ☑ 완료 2026-10-25

## 결과 (날짜별)

- `2026-10-25` `7e94179`: 단위 431 (CLAUDE.md 241 · agent-rules 190, 그중 사본 98) · 집행 칸에 `unchecked` 추가 · 집행 자리 존재 확인 · 빠진 줄 검사

## 걸어온 길

- `2026-10-25` `82fc060` 계획에 들어옴 (☐ 대기) — 재건 시작: 계획 문서와 자동 갱신 관리 파일 (rebuilding-project)
- `2026-10-25` `7e94179` 상태 ☐ → ☑ 2026-10-25 — 재건 1: 분류 1차 — CLAUDE.md·agent-rules 를 문장 단위 431 로 (모드·종류·집행·사본)
- `2026-10-25` `7e94179` 결과 처음 적힘 — 재건 1: 분류 1차 — CLAUDE.md·agent-rules 를 문장 단위 431 로 (모드·종류·집행·사본)

## 닿는 결정

- [DEC-0021](../decisions/DEC-0021.md) 2026-10-25 분류 방법 — 언어보다 구조가 말하게
