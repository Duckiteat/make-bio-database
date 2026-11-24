# DEC-0092 승인 묶음 — 전환 기록 번호를 일 묶음 단위로 (DEC-0093 세부)

> 사용자 커밋 대상. develop 세션은 `judicial/transition_audit.js`(L6)를 쓰지 못한다 — 이 묶음은 **적용하지 않은 제안** 이다.
> 서기(`legislative/clerk.mjs`)와 그 시험은 새 검사 함수를 부르므로 따로 들어가면 깨진다 — 셋을 한 묶음으로 (승인 화면에서 셋 다 '사람 승인').

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| `DEC-0092-bundle.patch` — `judicial/transition_audit.js`(새 선택 칸 work · opened_by · close · `nextSeq` · `checkLedger` · `openWorks` · 글자 z → aa) · `legislative/clerk.mjs`(work 를 받아 다음 글자 · 장부 전체 검사 뒤 붙임 · 선택 칸 sup · opened_by · close 를 저장 — 지금까지는 sup 을 받고도 버렸음) · `tests/transitions.test.mjs`(시험 4 → 5, 실제 장부 검사 · opened_by 결정이 계획에 있는지) | 번호가 줄 수 + 1 이라 브랜치가 갈리면 같은 번호가 둘(main #20 · 브랜치 #20). 일마다 번호, 같은 글자를 두 브랜치가 쓰면 검사가 잡음 | 새 전환 기록은 `work` 가 필수 — 이 세션의 끝 기록은 `{ work: 21, opened_by: "DEC-0093" }` → `21a`. 옛 #1–#20 은 그대로 | 지문 `f45217aa…` · 거부 0 · 사람 승인 3 · 작업 사본에서 적용 → 전체 시험 563 통과 · 계획 검사 0 · validate 오류 0 |
| `DEC-0092-rule.ops.json` — 규칙 장부 RULE-0513 글 · 자리 | 규칙 설명이 새 번호 방식을 말하게 | 장부 봉인 사건 1 · 생성 문서 갱신 | `--dry` 통과 |

결정이 계획에 있는지(opened_by)는 서기가 보지 않는다 — 서기는 재건 관리 구역(`rebuild/`)을 읽지 않는다(읽기 점검 ②). 그 대조는 시험이 실제 장부로 한다(CI 에서 PR 마다).

## 적용 순서 (사람 — Codespaces, 한 단계씩)

1. `git fetch origin ccr-9574a8fa-d9r28z && git checkout ccr-9574a8fa-d9r28z && git pull`
2. `node rebuild/bundle.mjs verify workspace/DEC-0092-bundle.patch f45217aaa87a4ac50e6a6cb2f1de6b81e656b26fe7ee939bcfa6412332bac00c` — `통과`
3. `git apply workspace/DEC-0092-bundle.patch && git status --short` — 세 파일만
4. `node rebuild/rules.mjs apply workspace/DEC-0092-rule.ops.json && node rebuild/status.mjs --write`
5. `node --test tests/transitions.test.mjs 2>&1 | tail -6` — `# fail 0`
6. `node --test tests/*.test.mjs 2>&1 | tail -6` — `# fail 0` (실패하면 멈추고 화면을 develop 세션에)
7. `git add -A && git commit -m "L6: transition numbering by work bundle (DEC-0092, bundle f45217aaa87a)" && git push`
8. develop 세션이 받아 대조(묶음과 바이트 동일 · 전체 시험) → PR 은 사람이 승인 · 병합

되돌리기: 그 커밋을 `git revert`.
