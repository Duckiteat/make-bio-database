# 봇 신원 확인 — AI 전용 GitHub 신원(daduteria)이 실제로 쓰이는가

> inspect 세션 · 2026-11-24 · 전환 기록 #20 의 첫 열린 일 · 절차서 `docs/reports/2026-11-23-ai-bot-identity-setup.md` 6 장.
> 이 세션은 develop 세션이 "너가해"(사용자) 로 맡긴 지시로 열렸다. 기대와 다른 결과는 고치지 않고 재현 절차와 함께 적는다(RULE-0262).
> data/ · attestations/ 변경 없음. 계정 · 토큰 값은 어디에도 적지 않는다(RULE-0518) — 로그인 이름만.

## 결과

| 확인 | 결과 | 근거 | 의미 |
|---|---|---|---|
| 세션의 GitHub 신원 (6-1 전제) | daduteria | GitHub 도구 `get_me` → login daduteria (계정 생성 2026-11-23) | claude.ai 연결이 봇으로 바뀌었다 — 사람 계정으로 GitHub 도구를 쓰지 않는다 |
| 협업자 역할 (6-4 대신 조회만) | daduteria = write · Duckiteat = admin | `list_repository_collaborators` | 신원 분리(DEC-0090) 가 GitHub 사실로 맞다. 봇은 Settings 권한이 없다(admin 아님). Settings 열기 시도는 하지 않음(지시 6) |
| 커밋의 author · committer | 둘 다 `Claude <noreply@anthropic.com>` | `git log -1 --format='%an %cn'` (dad607c · 0881854) | git 메타데이터는 세션 컨테이너의 git 설정이 정한다 — GitHub 신원과 별개. 누가 밀었는지는 아래 push actor 가 말한다 |
| push 의 actor (6-1) | daduteria (actor · triggering_actor 둘 다) | `check` 실행 #528 · #529 (push, 이 브랜치) | 6-1 충족. 비교: 앞 inspect 세션(브랜치 claude/bot-identity-check, 실행 #527)은 actor = Duckiteat 이었다 — 연결 전환은 그 뒤에 일어남 |
| PR 을 연 사람 (6-1) | daduteria | PR #20 `user.login` | 6-1 충족. PR 은 봇 이름으로 열린다 |
| PR 의 `check`(rules) | 돎 — 결과는 다음 갱신에서 | 실행 #530 (pull_request, actor daduteria) · #528 · #529 (push) | 봇 PR 에도 기존 검사가 그대로 돈다 |
| PR 의 `independent-judge` (trust.yml, pull_request_target — 처음 돎) | **돌지 않음** — 기대와 다름 | 워크플로 목록(`list_workflows`)에 `check` 하나만 · `trust.yml` 조회 404 · pull_request_target 실행 0 건 · PR #20 검사 목록에 `rules` 만. 그런데 `.github/workflows/trust.yml` 은 main(9e916d8)에 있고(커밋 898e3b7) YAML 은 정상(`on.pull_request_target.branches: [main]`, 탭 없음) | 독립 판정의 첫 겹이 아직 GitHub 에 등록되지 않았다 — 필수 검사에 걸 이름도 아직 없다. 원인 모름(고치지 않음, RULE-0262) — 아래 재현 절차 |
| PR 의 병합 가능 상태 (6-2 대신 조회만) | `blocked` | PR #20 `mergeable_state` (head 0881854) | main 규칙이 봇 PR 을 막고 있다(승인 필요로 읽힘 — 정확한 사유는 사람 화면에서). 병합 시도 · 자동 병합 시도는 하지 않음(설정 deny, 지시 5) |

## 재현 절차 — independent-judge 가 돌지 않음

| 단계 | 무엇 | 본 것 | 다음에 볼 곳 |
|---|---|---|---|
| 1 | `git ls-tree origin/main .github/workflows/` | check.yml · trust.yml 둘 다 있음 | — |
| 2 | GitHub 도구 `actions_list list_workflows` | check(id 378257409) 하나뿐 | 사람 계정으로 Actions 탭 → 왼쪽 목록에 trust 가 있는지 · 비활성인지 |
| 3 | `actions_list list_workflow_runs` resource_id=trust.yml · event=pull_request_target | 404 · 0 건 | Settings → Actions → General 의 허용 범위 · 워크플로 권한 |
| 4 | PR #20 열기(17:34:52Z; main 병합 9e916d8 은 16:55Z) | pull_request 의 check 는 돌고 pull_request_target 은 없음 | 재등록이 필요하면 trust.yml 을 main 에 다시 넣는 일 — L6 자리라 develop · 승인 묶음 + 사람 |

## 사람이 할 일

| 일 | 누가 | 어디서 | 왜 |
|---|---|---|---|
| (가) 이 PR 을 승인 · 병합 (6-3) | 사람(Duckiteat) | GitHub PR 화면 | merged_by = 사람 확인. 봇은 병합 · 승인하지 않는다 |
| (나) main 규칙 세트의 필수 검사에 `independent-judge` 추가 | 사람(Duckiteat) | Settings → Rules | 첫 PR 에서 independent-judge 가 돈 뒤라야 검사 이름이 목록에 뜬다. **이 PR 에서는 돌지 않았다** — 먼저 Actions 탭에서 trust 워크플로가 등록 · 활성인지 보고(위 재현 절차), 한 번 돈 뒤 추가. 그 전에 (가) 로 병합해도 이 PR 은 지키는 자리를 바꾸지 않는다(docs/reports · 생성물 · 영수증만) |
