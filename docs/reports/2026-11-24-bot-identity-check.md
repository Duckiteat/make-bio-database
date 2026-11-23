# 봇 신원(daduteria) 확인 — inspect 세션

- 날짜: 2026-11-24 · 모드: inspect · 브랜치: `claude/bot-identity-check` (main 9e916d8 에서)
- 근거 문서: `docs/reports/2026-11-23-ai-bot-identity-setup.md` 6 장 (브랜치 `claude/attack-matrix-independent-review`) · 전환 기록 #20
- 종합: **기대와 다름 — 이 세션의 GitHub 신원은 봇이 아니라 사람 계정(Duckiteat, admin)이다.** 그래서 6 장의 push · PR 확인(6-1 ~ 6-4)은 봇 신원으로 할 수 없어 멈췄다(RULE-0262 — 고치지 않고 재현 절차와 함께 보고).

| 확인 | 결과 | 근거 | 의미 |
|---|---|---|---|
| 세션 GitHub 신원 (`get_me`) | **Duckiteat** (기대: daduteria) | GitHub 도구 `get_me` → `login: Duckiteat` | claude.ai 의 GitHub 연결이 아직 사람 계정이다 — 봇 분리(DEC-0090)의 첫 고리가 실제로는 걸리지 않음 |
| 협업자 역할 | Duckiteat = admin · daduteria = write | `list_repository_collaborators` | 봇 계정 자체는 기대대로 준비됨(write) — 연결만 바뀌지 않음 |
| 최근 Actions 실행 actor | 최근 5 건 모두 Duckiteat (actor · triggering_actor) | `actions_list list_workflow_runs` (run 522–526) | 지금까지의 AI push 는 사람 신원으로 기록됨 — 기록상 사람과 AI 가 구분되지 않음 |
| 로컬 git 작성자 | `Claude <noreply@anthropic.com>` | `git config user.name/email` | 커밋 작성자 표기는 Claude 이나, push · PR · Actions actor 는 연결 계정(Duckiteat)을 따른다 |
| PR 열기 · independent-judge 첫 실행 (6-1) | **하지 않음** | 신원이 Duckiteat 이면 PR 작성자 = 사람 → 사람이 자기 PR 을 승인할 수 없어 6-3 이 성립하지 않고, 봇 확인도 아님 | 연결을 봇으로 바꾼 뒤 새 세션에서 다시 |
| 병합 · 자동 병합 시도 (6-2) · Settings 열기 (6-4) | 하지 않음 | 지시 5 · 6 (병합 시도 금지 · 설정 변경 시도 금지) | admin 신원에서는 의미 없는 확인 — 봇 신원에서만 뜻이 있음 |

## 재현 절차

1. 이 저장소로 claude.ai 클라우드 세션을 연다.
2. GitHub 도구 `get_me` 를 부른다 → `login` 이 `Duckiteat`.
3. `list_workflow_runs` 의 `actor.login` 도 `Duckiteat`.

## 사람이 할 일

1. claude.ai 의 GitHub 연결을 봇 계정 daduteria 로 바꾼다 — 브라우저에서 GitHub 를 daduteria 로 로그인한 상태로 https://claude.ai/connect-github 에서 다시 연결. Claude GitHub App 이 저장소에 설치되어 있어야 함(같은 페이지).
2. 새 세션을 열어 이 확인(6-1 ~ 6-4)을 다시 한다. 그때 `get_me` = daduteria 이면 PR 을 열고 `check` · `independent-judge` 결과를 본다.
3. 그 뒤: (가) 사람 계정으로 PR 승인 · 병합 (나) main 규칙의 필수 검사에 `independent-judge` 추가.
