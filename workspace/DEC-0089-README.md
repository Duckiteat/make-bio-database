# DEC-0089 — git push 확인 창 없애기 (가) · 자동 병합 막기

> **적용 끝 — 다시 적용하지 않는다.** 2026-11-23 사용자 커밋 `d064809`(Duckiteat). develop 대조: settings.json 이 묶음 + 손 편집과 바이트 동일 · PERM-0012 allow · 장부 오류 0 · 권한 · 승인 · 보호 기준 시험 20 통과 · data · attestations 변경 0 · 다음 작업 프로세스에서 자동 병합 도구가 도구 목록에서 빠짐.

> 사용자 커밋 대상. develop 세션은 `.claude/settings.json`(L6)을 쓰지 못한다 — 이 묶음은 **적용하지 않은 제안** 이다.
> 승인 도구는 권한을 넓히는 변경(allow 추가 · ask 제거)을 묶음으로 받지 않는다(RULE-0528 — "클릭이 규칙을 대신하지 못함", RULE-0461). 그래서 **둘로 나눴다**: 막는 줄 더하기는 승인 묶음, push 를 ask → allow 로 옮기는 한 줄은 사람이 손으로.
> develop 세션의 확인: 묶음 지문 · 화면(거부 0 · 사람 승인 1) · 권한 장부 변경 `rules.mjs apply --dry` 통과. 설정을 넓힌 상태의 시험(RULE-0521 설정 ↔ 장부 대조)은 **돌리지 못했다** — 사본에서 설정을 넓혀 보는 것도 세션 권한이 거부함. 아래 5 단계가 첫 시험이다.

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| `DEC-0089-deny-bundle.patch` — deny 에 `Bash(git push -f:*)` · `Bash(git push origin main:*)` · `mcp__github__enable_pr_auto_merge` | push 를 묻지 않게 하는 대신 위험한 꼴만 막음. 자동 병합 켜기는 공격 재검토 N12 | 설정 deny 3 줄 더함 | 지문 `5c9b9532…` · 거부 0 |
| 손 편집 — `Bash(git push:*)` 를 ask 에서 allow 로 | 사용자 결정 DEC-0089 가: 확인 창은 약한 보안이면서 자율성을 깎음. main 은 GitHub 보호(PR 필수 · 필수 검사)가 지킴 | push 할 때 확인 창이 뜨지 않음. 문지기는 여전히 `finish --full` 뒤에만 push 를 엶 | 5 단계 시험 |
| `DEC-0089-push-bundle.ops.json` — 권한 장부 PERM-0012 list ask → allow · PERM-0007 설명 | 장부에 없는 권한은 없다(RULE-0521) — 설정과 같은 커밋에 | 장부 봉인 사건 2 | `--dry` 통과 |

## 적용 순서 (사람 — Codespaces, 한 단계씩)

1. `git pull`
2. `node rebuild/bundle.mjs verify workspace/DEC-0089-deny-bundle.patch 5c9b9532c29562a4c71e22bf0e5028e1a3382441598048aea49e75ca639ebc32` — `통과`
3. `git apply workspace/DEC-0089-deny-bundle.patch`
4. `.claude/settings.json` 을 손으로: `"ask"` 목록의 `"Bash(git push:*)",` 줄을 지우고, `"allow"` 목록의 `"Bash(git commit:*)",` 바로 아래에 `"Bash(git push:*)",` 를 넣는다
5. `node rebuild/rules.mjs apply workspace/DEC-0089-push-bundle.ops.json && node rebuild/status.mjs --write`
6. `node --test tests/permissions.test.mjs tests/approval.test.mjs 2>&1 | tail -6` — `# fail 0` (실패하면 멈추고 화면을 develop 세션에)
7. `node --test tests/*.test.mjs 2>&1 | tail -6` — `# fail 0`
8. `git add -A && git commit -m "L6: git push allow + deny force/main/auto-merge (DEC-0089, bundle 5c9b9532c295)" && git push`
9. GitHub 설정(웹): Settings → General → Pull Requests → **Allow auto-merge 끄기** (N12 의 서버 쪽)

되돌리기: 4 의 줄을 ask 로 되돌리고 PERM-0012 의 list 를 ask 로 (`rules.mjs apply`).
