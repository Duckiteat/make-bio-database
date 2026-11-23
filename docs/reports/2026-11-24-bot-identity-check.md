# 봇 신원 확인 — AI 전용 GitHub 신원(daduteria)이 실제로 쓰이는가

> inspect 세션 · 2026-11-24 · 전환 기록 #20 의 첫 열린 일 · 절차서 `docs/reports/2026-11-23-ai-bot-identity-setup.md` 6 장.
> 이 세션은 develop 세션이 "너가해"(사용자) 로 맡긴 지시로 열렸다. 기대와 다른 결과는 고치지 않고 재현 절차와 함께 적는다(RULE-0262).
> data/ · attestations/ 변경 없음. 계정 · 토큰 값은 어디에도 적지 않는다(RULE-0518) — 로그인 이름만.

## 결과

| 확인 | 결과 | 근거 | 의미 |
|---|---|---|---|
| 세션의 GitHub 신원 (6-1 전제) | daduteria | GitHub 도구 `get_me` → login daduteria (계정 생성 2026-11-23) | claude.ai 연결이 봇으로 바뀌었다 — 사람 계정으로 GitHub 도구를 쓰지 않는다 |
| 협업자 역할 (6-4 대신 조회만) | daduteria = write · Duckiteat = admin | `list_repository_collaborators` | 신원 분리(DEC-0090) 가 GitHub 사실로 맞다. 봇은 Settings 권한이 없다(admin 아님). Settings 열기 시도는 하지 않음(지시 6) |
| 커밋의 author · committer | _채움 대기_ | `git log -1 --format` | |
| push 의 actor (6-1) | _채움 대기_ | Actions `check` 실행(push 이벤트)의 actor | |
| PR 을 연 사람 (6-1) | _채움 대기_ | PR `user.login` | |
| PR 의 `check`(rules) | _채움 대기_ | Actions 실행 | |
| PR 의 `independent-judge` (trust.yml, pull_request_target — 처음 돎) | _채움 대기_ | Actions 실행 | |
| PR 의 병합 가능 상태 (6-2 대신 조회만) | _채움 대기_ | PR `mergeable_state` | 병합 시도 · 자동 병합 시도는 하지 않음(설정 deny, 지시 5) |

## 사람이 할 일

| 일 | 누가 | 어디서 | 왜 |
|---|---|---|---|
| (가) 이 PR 을 승인 · 병합 (6-3) | 사람(Duckiteat) | GitHub PR 화면 | merged_by = 사람 확인. 봇은 병합 · 승인하지 않는다 |
| (나) main 규칙 세트의 필수 검사에 `independent-judge` 추가 | 사람(Duckiteat) | Settings → Rules | 첫 PR 에서 independent-judge 가 돈 뒤라야 검사 이름이 목록에 뜬다 — 이 PR 이 그 첫 실행 |
