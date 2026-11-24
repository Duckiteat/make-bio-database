# 21 번 일 — 보안 묶음 다섯 적용 순서 (DEC-0092 · DEC-0093 · DEC-0094 · DEC-0095)

> 이 브랜치(`ccr-9574a8fa-d9r28z`)의 승인 묶음 다섯. 모두 **적용하지 않은 제안** — 사람이 Codespaces 에서 적용 · 커밋 · push 하고, PR 은 사람이 승인 · 병합한다.
> 작업 사본에 이 순서로 다섯을 적용해 전체 시험 565 통과를 확인했다(각 묶음의 지문 확인 포함). 점검 결과는 `docs/reports/2026-11-24-security-bundles-check.md`.

| 순서 | 묶음 · 안내 | 무엇 | 사람이 따로 할 것 |
|---|---|---|---|
| 0 | — | GitHub Settings → Codespaces → **GPG verification** 켜기(이 저장소) — 4 번 묶음이 PR 안의 사람 커밋마다 서명을 요구하므로 **맨 먼저**. 지금까지의 사람 커밋(a71393d · d064809 · 749fa2d)은 서명이 없었다 | 켠 뒤 Codespaces 를 다시 열고, 첫 커밋이 GitHub 에서 Verified 인지 |
| 1 | `DEC-0092-README.md` | 전환 기록 번호 = 일 묶음(번호 + 글자 · opened_by · close) | 규칙 장부 ops 한 번 |
| 2 | `N11-fail-closed-README.md` | 문지기 오류 = 막힘 · 시작 안내에 열린 일 | `.claude/settings.json` 두 줄 — README 의 `sed` 명령 그대로(5 번의 지문이 걸림) |
| 3 | `CODEOWNERS-README.md` | 모든 자리의 코드 소유자 = Duckiteat | 규칙 세트: Require review from Code Owners 켜기 · Dismiss stale approvals · "가장 최근 push 의 승인 필요" 켜짐 여부 확인 |
| 4 | `DEC-0094-ci-zone-README.md` | 선언 없는 커밋 = AI, 사람 서명만 예외 | 규칙 ops · 새 규칙 RULE-0550 |
| 5 | `DEC-0095-hooks-README.md` | 훅을 끄는 자리(settings.local.json · .claude/hooks)는 어느 모드도 못 씀 | 권한 장부 ops |
| 6 | — | develop 세션이 받아 대조(묶음과 바이트 동일 · 전체 시험) · 끝 기록 `21a`(opened_by: DEC-0093) | PR 승인 · 병합 |

## 운영 규칙 (DEC-0095)

| 규칙 | 왜 | 어기면 |
|---|---|---|
| PR 은 봇(daduteria)이 연다 | 코드 소유자가 Duckiteat 하나 — GitHub 은 PR 을 연 사람의 자기 승인을 받지 않는다 | 사람이 연 PR 은 병합되지 않음(우회 목록이 없으면) |
| 사람이 push 한 뒤 마지막 커밋은 봇의 대조 커밋 | "가장 최근 push 의 승인 필요" 가 켜져 있으면 마지막 push 한 사람의 승인은 세지 않는다 | 승인이 모자라 막힘 |
| 병합은 **Merge commit** 방식 | Squash · Rebase 는 커미터가 GitHub(웹 흐름)인 새 커밋을 만든다 — 4 번 판정에서 사람 서명이 아니다 | main push 뒤 `rules` 검사 빨강(병합은 막지 않음) |
| 파일은 Codespaces 에서 고쳐 커밋 (GitHub 웹 편집 안 함) | 웹 편집 커밋은 웹 흐름 서명 — 사람 서명으로 세지 않는다 | 그 PR 의 `rules` 검사 실패 |

막히면(검사 실패 · 패치가 맞지 않음) 그 단계에서 멈추고 화면을 develop 세션에 보여 준다.
