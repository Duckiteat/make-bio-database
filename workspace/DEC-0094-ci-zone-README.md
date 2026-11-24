# DEC-0094 승인 묶음 — CI 구역 점검: 선언 없는 커밋은 AI 로 봄, 사람 서명만 예외

> 사용자 커밋 대상. develop 세션은 `rebuild/ci-zone.mjs` · `.github/**` · `tests/registry_policy.test.mjs`(L6)를 쓰지 못한다 — **적용하지 않은 제안** 이다.
> **먼저 할 것: Codespaces 커밋 서명 켜기** (아래 0 단계). 이 묶음이 들어간 PR 은 그 PR 안의 선언 없는 커밋(= 사람이 묶음을 적용한 커밋)마다 사람 서명을 요구한다 — 서명 없이 만든 커밋이 있으면 그 PR 의 `rules` 검사가 실패한다.

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| `DEC-0094-ci-zone-bundle.patch` — `rebuild/ci-zone.mjs`(`HUMANS = ['Duckiteat']` · `humanSigned` · 선언도 사람 서명도 없는 커밋 = 위반 RULE-0550 · `--signatures <파일>`) · `.github/workflows/check.yml`(커밋마다 GitHub API 로 검증된 서명 여부 · 커미터 계정을 모아 ① main 판정 코드 · ② 이 커밋 판정 코드 둘 다에 넘김) · 시험 셋(`ci_zone` · `bypass_scenarios` · `registry_policy` ⑥ — 사람 커밋에는 서명 사실을 줌, 사실이 없거나 봇 계정이면 위반) | 공격 재검토 N8: 따옴표 · eval 속 커밋은 선언(영수증)이 없어 '사람의 커밋' 으로 통과. 작성자 이메일은 저장소 기록에 보여 흉내 낼 수 있다 — 사람임은 서명으로만 | 영수증 없는 AI 커밋은 CI 에서 거부. 사람의 커밋은 서명돼 있어야 알리기만. 웹 흐름(web-flow) 서명(웹 편집 · API 커밋)은 예외가 아님 — **GitHub 웹에서 파일을 고친 커밋 · Squash 병합 커밋도 위반으로 나온다** (병합은 Merge commit 방식으로). 서명 조회가 실패하면 그 커밋은 사람 아님 | 지문 `43fd0db0…` · 거부 0 · 사람 승인 5 · 이 브랜치의 커밋을 새 판정으로: 통과 2 · 위반 0 · 작업 사본에 네 묶음 모두 → 전체 시험 564 통과 · 변이(사람 서명 검사 끄기) → 시험이 잡음 |
| `DEC-0094-rule.ops.json` — RULE-0548 글 · `DEC-0094-rule.spec.json` — 새 기계 규칙 RULE-0550(규칙 · 연결 · 변이 집행) | 새 규칙은 장부에 · 변이가 잡혀야 들어감(RULE-0205) | 장부 사건 4 | 작업 사본에서 `rules.mjs rule` → caught · 장부 검사 0 |

## 적용 순서 (사람 — 다른 세 묶음 뒤, 한 단계씩)

0. (GitHub 웹, **어느 묶음보다 먼저**) Settings(내 계정) → Codespaces → **GPG verification** 켜기 → 이 저장소(Duckiteat/make-bio-database) 선택. 그 뒤 Codespaces 를 다시 열고, 묶음 커밋이 GitHub 에서 **Verified** 로 보이는지 확인
1. `git pull`
2. `node rebuild/bundle.mjs verify workspace/DEC-0094-ci-zone-bundle.patch 43fd0db02f31684905ecaf9cd58f45811453d8175a6e437f3cb6c205adc867cb` — `통과`
3. `git apply workspace/DEC-0094-ci-zone-bundle.patch && git status --short` — 다섯 파일
4. `node rebuild/rules.mjs apply workspace/DEC-0094-rule.ops.json && node rebuild/rules.mjs rule workspace/DEC-0094-rule.spec.json` — 마지막 줄 `통과`(변이 caught 뒤)
5. `node rebuild/regen.mjs && node rebuild/status.mjs --write`
6. `node --test tests/*.test.mjs 2>&1 | tail -6` — `# fail 0`
7. `git add -A && git commit -m "L6: ci-zone undeclared = AI unless human-signed (DEC-0094, bundle 43fd0db02f31)" && git push`
8. PR 의 `rules` 검사 로그에서 `서명 사실: N 커밋 · 검증된 서명 M` 과 `구역 밖 0` 확인

되돌리기: 그 커밋을 `git revert`.
