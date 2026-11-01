# STG-10b — 변이 시험 무커밋

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [재건 계획 (rebuilding project) — 글이 아니라 구조가 말하게](../rebuild.md) · [순서](../ORDER.md)

- **계획 · 부**: rebuild 10b · 7. 단계
- **단계**: 변이 시험 무커밋
- **무엇**: tests/mutation/run.mjs 가 지금 작업 파일을 브랜치를 건드리지 않는 임시 스냅숏(git stash create 의 커밋 개체)으로 사본에 올림 — 새 기계 규칙도 커밋 하나로
- **끝나는 조건**: 커밋하지 않은 변경으로 변이 시험 결과를 냄 · 브랜치·작업 트리 그대로
- **상태**: ☑ 완료 2026-10-30

## 결과 (날짜별)

- `2026-10-30` 커밋 전 기록: 2026-10-30: tests/mutation/run.mjs 가 사본(git worktree)을 HEAD 대신 지금 작업 파일의 스냅숏 커밋 개체에서 만든다 — 임시 색인(GIT_INDEX_FILE)에 HEAD 를 읽고 작업 트리 전부(.gitignore 밖)를 더해 write-tree · commit-tree. 계획의 git stash create 대신 이 방식: stash create 는 추적하지 않는 새 파일(새 시험 파일 등)을 담지 않음. 브랜치 · 작업 트리 · 실제 색인 · stash 는 그대로. 확인: 새 시험 rebuild ㉒(복제본에서 고친 추적 파일 · 새 파일을 변이 시험이 봄 + 없는 것은 absent, 전후 상태 같음) · 옛 실행기는 같은 입력에서 absent · error · 실제 행 RULE-0004(test_only) --check 차이 0 · RULE-0027(disable) caught 그대로

## 걸어온 길

- `2026-10-29` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 재건 10 단계 계획 — 6b 세션의 사용 평가에서 나온 비용·구멍을 작업으로 (DEC-0037)
- `2026-10-30` 커밋 전 기록 상태 ☐ → ☑ 2026-10-30 — 재건 10b 변이 시험 무커밋 — 사본을 작업 파일 스냅숏에서 (사용자 '2번 ㄱ')
- `2026-10-30` 커밋 전 기록 결과 처음 적힘 — 재건 10b 변이 시험 무커밋 — 사본을 작업 파일 스냅숏에서 (사용자 '2번 ㄱ')

## 닿는 결정

- [DEC-0037](../decisions/DEC-0037.md) 2026-10-29 10 단계 — 작업 비용 줄이기: 목적 · 합치기 전 범위 · 커밋 검사
