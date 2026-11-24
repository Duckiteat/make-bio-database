# CODEOWNERS 승인 묶음 — 모든 자리의 코드 소유자 = 사람 계정 (DEC-0093 ③)

> 사용자 커밋 대상. develop 세션은 `.github/**`(L6)를 쓰지 못한다 — **적용하지 않은 제안** 이다. 다른 묶음과 순서 상관없음.

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| `CODEOWNERS-bundle.patch` — 새 `.github/CODEOWNERS`(`* @Duckiteat`) · 저장 지도에 그 자리를 L6(guard:gate, 쓰는 이 = 사람)로 | 지금 main 규칙은 "승인 1" 이라 쓰기 권한이 있는 누구의 승인이든 된다. 코드 소유자 검토를 켜면 승인은 사람 계정의 것이어야 한다. L6 만이 아니라 **전부** 인 이유: 판정 코드의 의존(N10)처럼 L6 밖 파일이 판정을 바꿀 수 있어, 자리를 고르면 빈틈이 생긴다 | 모든 PR 에 Duckiteat 의 승인이 필요 — 지금도 사람이 승인 · 병합하므로 흐름은 그대로. 봇 · 다른 협업자의 승인으로는 병합되지 않음 · 독립 판정(trust-check)의 지키는 자리에 CODEOWNERS 가 들어감(저장 지도 L6) | 지문 `0b8613e0…` · 거부 0 · 사람 승인 2 · 작업 사본에 적용 → 전체 시험 통과 · 교과서 부록 최신 |
| (사람 · GitHub 웹) 규칙 세트 'main' → **Require review from Code Owners** 켜기 · 같은 화면에서 **Dismiss stale pull request approvals when new commits are pushed** 켜짐 확인 | 파일만으로는 힘이 없다 · 승인 뒤 커밋을 더 밀어 넣는 길(전환 기록 #20 의 남은 확인) | — | 다음 PR 에서 "Review required from code owners" 표시 |

## 운영 규칙 (DEC-0095 — 2026-11-24 점검: `docs/reports/2026-11-24-security-bundles-check.md`)

- **PR 은 봇(daduteria)이 연다.** 코드 소유자가 Duckiteat 하나라, Duckiteat 가 연 PR 은 GitHub 이 자기 승인을 받지 않아 병합되지 않는다(PR #19 처럼 사람이 연 PR). 사람이 PR 을 열어야 하면 규칙 세트의 우회 목록(사람 계정)으로.
- **사람이 묶음 커밋을 push 한 뒤에는 봇의 대조 커밋이 마지막** — 규칙 세트의 "가장 최근 push 의 승인 필요" 가 켜져 있으면 마지막 push 한 사람의 승인은 세지 않는다(켜짐 여부 미확인 — 사람이 확인).

## 적용 순서 (사람)

1. `git pull`
2. `node rebuild/bundle.mjs verify workspace/CODEOWNERS-bundle.patch 0b8613e0baf1009ca7e52e593ce9219f2dd213385fe11a464bb0cedcfb652000` — `통과`
3. `git apply workspace/CODEOWNERS-bundle.patch && git status --short` — `.github/CODEOWNERS` · `docs/textbook/storage-map.json`
4. `node dbtool.mjs textbook --write && node rebuild/status.mjs --write`
5. `node --test tests/*.test.mjs 2>&1 | tail -6` — `# fail 0`
6. `git add -A && git commit -m "L6: CODEOWNERS = human account (DEC-0093, bundle 0b8613e0baf1)" && git push`
7. GitHub 웹: 위 표의 두 설정

되돌리기: 그 커밋을 `git revert` · 규칙 세트에서 끄기.
