# DEC-0095 승인 묶음 — 훅을 끄는 자리는 어느 모드도 못 쓴다

> 사용자 커밋 대상. develop 세션은 `rebuild/rules/modes.json` · `.claude/settings.json` · `tests/gate.test.mjs`(L6)를 쓰지 못한다 — **적용하지 않은 제안** 이다.
> **1–4 번 묶음을 모두 커밋한 뒤에** — 이 묶음은 그 상태(특히 2 번의 `|| exit 2` 두 줄을 README 명령 그대로 바꾼 설정)를 기준으로 만들었다. 2 번을 손으로 다르게 고쳤으면 지문이 맞지 않는다.

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| `DEC-0095-hooks-bundle.patch` — `rebuild/rules/modes.json` develop 의 except 에 `.claude/settings.local.json` · `.claude/hooks/**` · `.claude/settings.json` deny 에 그 둘의 Edit · Write · `tests/gate.test.mjs` ㉔ | 점검(2026-11-24)에서 찾음: develop 은 쓰기 `**` 라 `.claude/settings.local.json` 을 쓸 수 있고, 거기에 `disableAllHooks` 를 넣으면 문지기가 통째로 꺼진다 — fail-closed(2 번)도 훅이 돌아야 동작한다 | 어느 모드도 그 두 자리를 못 씀(문지기 · 설정 deny 두 겹). 셸로 쓰는 길은 deny 가 못 막지만 문지기가 막는다(쓰기 구역 밖 · 오류면 fail-closed). 다른 모드는 원래 `.claude/` 를 쓰지 못했다 | 지문 `52795fe3…` · 거부 0 · 사람 승인 3 · ㉔ 은 묶음 전 실패 · 뒤 통과 · 1–5 번 적용 사본 전체 시험 565 통과 |
| `DEC-0095-perm.ops.json` — 권한 장부 PERM-0017 설명(wide) | 장부의 설명이 except 와 같게 | 장부 사건 1 · 생성 문서 | 작업 사본에서 적용 통과 |

남는 것: `.git/`(git 훅 · 설정)은 문지기가 보지 않는다 — git 훅만 바뀌고 Claude 의 훅에는 닿지 않는다. 훅 시간 초과는 Claude Code 가 통과로 다룬다 — 문지기 훅은 0.07–0.34 초(기본 한도 60 초).

## 적용 순서 (사람 — 1–4 번 커밋 뒤)

1. `git pull`
2. `node rebuild/bundle.mjs verify workspace/DEC-0095-hooks-bundle.patch 52795fe3b6d624e46058084de5ab1e47fba2864edda8eb18be198d6e017a3a69` — `통과`
3. `git apply workspace/DEC-0095-hooks-bundle.patch && git status --short` — 세 파일
4. `node rebuild/rules.mjs apply workspace/DEC-0095-perm.ops.json && node rebuild/status.mjs --write`
5. `node --test tests/*.test.mjs 2>&1 | tail -6` — `# fail 0`
6. `git add -A && git commit -m "L6: no mode writes hook-disabling settings (DEC-0095, bundle 52795fe3b6d6)" && git push`

되돌리기: 그 커밋을 `git revert`.
