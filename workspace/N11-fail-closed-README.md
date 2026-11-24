# N11 승인 묶음 — 문지기 오류 = 막힘 (fail-closed · DEC-0093 ②) + 시작 안내의 열린 일 (DEC-0092)

> 사용자 커밋 대상. develop 세션은 `rebuild/gate.mjs` · `tests/gate.test.mjs` · `.claude/settings.json`(L6)을 쓰지 못한다 — **적용하지 않은 제안** 이다.
> **DEC-0092 묶음(`DEC-0092-README.md`)을 먼저 적용한 뒤에** — 시작 안내가 그 묶음의 `openWorks` 를 부른다.
> 승인 도구는 훅 명령의 변경을 조이는 쪽이라도 묶음으로 받지 않는다(RULE-0528 "훅이 사라지거나 바뀜" — 설계대로). 그래서 DEC-0089 때처럼 **둘로 나눴다**: 코드 · 시험은 묶음, 설정 두 줄은 사람이 손으로.

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| `N11-fail-closed-bundle.patch` — `rebuild/gate.mjs`: 훅 예외 때 `failClosed` — 도구 앞(pre)은 종료 2(막힘), 읽기 전용 서버(`mcp__biodb-query__*` · `mcp__biodb-run__*`)만 통과 · 도구 뒤(post)는 2(AI 에게 알림) · 시작 · 멈춤은 알리기만(멈춤을 막으면 되풀이) / 시작 안내에 열린 일 한 줄 · `tests/gate.test.mjs` ㉓ | 공격 재검토 N11: live 영수증에 깨진 줄 하나로 문지기 전체가 종료 0("통과시킴") — 같은 기계 알림 장치를 통째로 끄는 길 | 문지기가 오류면 셸 · 편집 · 쓰는 도구가 막힘. Read · Grep · Glob 은 훅을 거치지 않아 원인은 읽을 수 있다. 셸은 읽기만인지 가릴 수 없어 함께 막힌다 — 사람이 원인을 고친다 | 지문 `74185256…` · 거부 0 · 사람 승인 2 · 새 시험 ㉓ 은 지금 문지기에서 실패 · 새 문지기에서 통과(대조함) · 작업 사본에 세 묶음 모두 적용 → 전체 시험 564 통과 |
| 손 편집 — `.claude/settings.json` 의 PreToolUse · PostToolUse 명령 끝에 ` \|\| exit 2` | 문지기 스크립트가 불러지기 전에 죽으면(문법 오류 · 의존 누락) node 는 1 로 끝나고, Claude Code 는 2 만 막힘으로 본다 — 그 길도 막힘으로 | 권한은 넓어지지 않음(어떤 종료 코드든 막힘 쪽으로만) · 권한 장부 변경 없음 | ㉓ 이 설정 두 줄을 확인 — 손 편집을 빼먹으면 ㉓ 실패 |

남는 것: 훅 자체가 꺼진 세션(설정에서 지움 · disableAllHooks)은 이 장치로 잡을 수 없다 — CI 겹(영수증 없는 커밋)과 사람의 PR 검토 몫.

## 적용 순서 (사람 — DEC-0092 묶음 커밋 뒤, 한 단계씩)

1. `git pull`
2. `node rebuild/bundle.mjs verify workspace/N11-fail-closed-bundle.patch 74185256122eda5b1a8b040d665fb3685f82c0f6bd16a6404c181061ab8bacd0` — `통과`
3. `git apply workspace/N11-fail-closed-bundle.patch`
4. `.claude/settings.json` 을 손으로: `"node rebuild/gate.mjs hook pre"` → `"node rebuild/gate.mjs hook pre || exit 2"`, `"node rebuild/gate.mjs hook post"` → `"node rebuild/gate.mjs hook post || exit 2"` (따옴표 안 끝에 붙임 — 두 줄만)
5. `git status --short` — `rebuild/gate.mjs` · `tests/gate.test.mjs` · `.claude/settings.json` 셋만
6. `node rebuild/status.mjs --write && node --test tests/gate.test.mjs 2>&1 | tail -6` — `# fail 0`
7. `node --test tests/*.test.mjs 2>&1 | tail -6` — `# fail 0`
8. `git add -A && git commit -m "L6: gate fail-closed (N11, DEC-0093, bundle 74185256122e) + hook exit 2" && git push`

되돌리기: 그 커밋을 `git revert`.
