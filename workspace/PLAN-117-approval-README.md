# PLAN-117 승인 묶음 — 승인 판정 워크플로 (DEC-0099: 사실도 판정도 CI 에서)

> 사용자 커밋 대상. `.github/**` 는 L6 라 develop 세션이 쓰지 못한다 — **적용하지 않은 제안**.
> 지문 `809921d774154edb8ee065e966a3b60a0c10a9ad6f04915242822f5e101d5d6f` (2 파일 — 자동 0 · 사람 승인 2 · 거부 0, 승인 화면 `workspace/PLAN-117-approval-bundle.screen.txt`).
> 판정 코드(`judicial/supervise_approval.js` · `rebuild/supervise.mjs` verdicts · RULE-0552)는 이미 이 브랜치에 커밋됨(`c128697`) — 이 묶음은 그것을 main 에서 돌리는 워크플로 하나.
> develop 세션의 확인: 사실 모으기 대본을 모의 `gh` 로 다섯 경우 돌림 — approved(PR #26 의 실제 사실 모양) 종료 0 · unreviewed 1 · merged_ai 1 · PR 없음 0 · 조회 실패(no_facts) 0. 저장소 밖 사본에 적용해 전체 시험 568 통과.

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| 새 `.github/workflows/approval.yml` — main 에 push 될 때(그리고 손으로 workflow_dispatch) main 의 코드로: 이 push 의 커밋과 감독 장부 상위 작업들의 승인 대상 커밋(`supervise.mjs hits`)마다 GitHub API 로 PR · 병합한 계정 · 머리 커밋 · 리뷰를 모아 `supervise.mjs verdicts` 로 판정 → 실행 요약(Summary)에 표 | DEC-0099 — 세션(봇 신원)이 사실을 모으거나 받아 오면 꾸밀 자리가 생긴다 | 이 push 의 PR 병합이 사람 승인이 아니면(봇 병합 · 사람 승인 리뷰 없음 · 승인 뒤 커밋 추가) **main 에서 빨개진다**. PR 없는 직접 push · 조회 실패는 표에만(승인 아님) | 모의 gh 다섯 경우 |
| 사실 모으기 대본을 **워크플로 파일 안에** (따로 `.sh` 를 두지 않음) | 대본이 L6 밖에 있으면 AI 가 보통 PR 로 사실 모으는 법을 바꿀 수 있다 | 대본을 바꾸려면 L6 변경 = 사람 | — |
| 권한 `contents: read` · `pull-requests: read` · 비밀 값 없음 | 읽기만 | — | — |
| 저장 지도 한 줄 (`approval.yml` L6) | 새 파일 분류 | trust-check 가 이 파일도 지킴 | — |

## 적용 (사람 — Codespaces)

1. GPG verification 이 걸린 Codespace 에서(켠 뒤 **새로 만든** Codespace 가 안전) `git pull` 뒤 `bash workspace/PLAN-117-approval-apply.sh` — 통과하면 스스로 서명 커밋 · push, 끝에 서명 여부를 알려 줌
2. develop 세션에 **"PR 열어"** — PR 은 봇이 연다(DEC-0095)
3. 병합: L6 PR 이라 `independent-judge` 는 실패한다(DEC-0098 — PLAN-135 전까지) → 사람이 **승인 리뷰 → 우회 병합(Merge commit)**. 이번엔 사람 커밋이 서명돼 `rules` 는 통과해야 한다 — 실패하면 서명이 안 걸린 것

## 병합 뒤 — 첫 실제 실행

병합 커밋이 main 에 들어가면 이 워크플로가 처음 돈다. Actions → approval → 그 실행의 Summary 에 **"이 push | … | approved | PR #… — Duckiteat 가 병합 · Duckiteat 가 머리 커밋 … 을 승인"** 이 나오면 끝나는 조건(실제 실행 확인)이 채워진다. develop 세션이 실행 기록을 읽어 대조한다.

## 따로 권하는 것 (이 묶음에 넣지 않음)

판정 코드(`judicial/supervise_approval.js` · `rebuild/supervise.mjs`)는 지금 L6 가 아니다 — 병합(사람 승인)을 거쳐야 main 에서 돌지만, 오케스트레이터의 "완료" 를 정하는 코드라 L6 로 올리는 것을 PLAN-135 와 함께 검토할 만하다.
