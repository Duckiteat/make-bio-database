# 21 번 일 — 보안 묶음 넷 적용 순서 (DEC-0092 · DEC-0093 · DEC-0094)

> 이 브랜치(`ccr-9574a8fa-d9r28z`)의 승인 묶음 넷. 모두 **적용하지 않은 제안** — 사람이 Codespaces 에서 적용 · 커밋 · push 하고, PR 은 사람이 승인 · 병합한다.
> 작업 사본에 이 순서로 넷을 적용해 전체 시험 564 통과를 확인했다(각 묶음의 지문 확인 포함).

| 순서 | 묶음 · 안내 | 무엇 | 사람이 따로 할 것 |
|---|---|---|---|
| 0 | — | GitHub Settings → Codespaces → **GPG verification** 켜기(이 저장소) — 4 번 묶음이 PR 안의 사람 커밋마다 서명을 요구하므로 **맨 먼저** | 켠 뒤 Codespaces 를 다시 열기 |
| 1 | `DEC-0092-README.md` | 전환 기록 번호 = 일 묶음(번호 + 글자 · opened_by · close) | 규칙 장부 ops 한 번 |
| 2 | `N11-fail-closed-README.md` | 문지기 오류 = 막힘 · 시작 안내에 열린 일 | `.claude/settings.json` 두 줄 손 편집(`\|\| exit 2`) — 1 번 뒤에 |
| 3 | `CODEOWNERS-README.md` | 모든 자리의 코드 소유자 = Duckiteat | 규칙 세트: Require review from Code Owners 켜기 · Dismiss stale approvals 확인 |
| 4 | `DEC-0094-ci-zone-README.md` | 선언 없는 커밋 = AI, 사람 서명만 예외 | 규칙 ops · 새 규칙 RULE-0550 |
| 5 | — | develop 세션이 받아 대조(묶음과 바이트 동일 · 전체 시험) · 끝 기록 `21a`(opened_by: DEC-0093) | PR 승인 · 병합(Merge commit 방식 — Squash 는 4 번 판정에서 웹 흐름 커밋이 됨) |

막히면(검사 실패 · 패치가 맞지 않음) 그 단계에서 멈추고 화면을 develop 세션에 보여 준다.
