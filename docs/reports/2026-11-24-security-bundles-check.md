# 보안 묶음 점검 — CODEOWNERS · 서명 판정 · 문지기 fail-closed (2026-11-24, develop · 21 번 일)

> 사용자 질문(2026-11-24): CODEOWNERS 가 승인 권한을 지키면서 PR 을 막지 않나 · GitHub 서명 검증이 사람 커밋과 병합 커밋을 구별하나 · 문지기가 실패하면 모든 쓰기 길이 막히나. 결정 DEC-0095.
> 방법: git 객체(서명 머리 `gpgsig`) · GitHub PR 조회(#19 · #23) · 봇 GitHub 도구의 입력 칸 · 묶음 1–4 를 적용한 작업 사본에서 문지기 실행 · 쓰기 판정.

| 질문 | 확인한 것 (근거) | 결과 | 남는 구멍 · 처리 |
|---|---|---|---|
| CODEOWNERS 가 PR 을 막나 | PR #23: 연 이 daduteria(봇) · 승인 Duckiteat(review 의 commit_id = head) · 병합 Duckiteat. PR #19: 연 이 Duckiteat | 봇이 연 PR 은 사람 승인 · 병합으로 그대로 | 사람이 연 PR 은 자기 승인이 안 돼 막힘 → 운영 규칙 "PR 은 봇이 연다". "가장 최근 push 의 승인 필요" 켜짐 여부는 읽지 못함 → 운영 규칙 "마지막 커밋은 봇" · 사람이 설정 확인 |
| 서명이 사람 · 병합 커밋을 구별하나 | 사람 커밋 a71393d · d064809 · 749fa2d: 서명 없음. GitHub 병합 커밋 6cc5b27 · 9e916d8: GitHub 서명 · 커미터 GitHub · 부모 둘 | 병합 커밋은 서명과 상관없이 판정 밖(`--no-merges`). 사람 커밋은 지금 서명이 없음 → GPG 를 먼저 켜야 함 | Squash · Rebase 병합 커밋 · 웹 편집 커밋 = 웹 흐름 → AI 로 나옴(조이는 쪽 오판) → 운영 규칙 "Merge commit · Codespaces 에서만" |
| 서명을 흉내 낼 수 있나 | 봇의 GitHub 도구(push_files · create_or_update_file)에 작성자 · 커미터 칸 없음. git push 로 커미터 이메일을 꾸미면 서명이 없음 | 꾸민 이메일은 verified 거짓으로 걸러짐. 검증된 서명 + 커미터 Duckiteat 는 Duckiteat 의 Codespaces 에서만 | **실측 아님** — GPG 를 켠 뒤 첫 커밋의 API 값(verified · committer)이 첫 확인. 같은 계정 탈취는 범위 밖(R3) |
| 문지기 실패 = 모든 쓰기 막힘? | 묶음 적용 사본: 깨진 영수증 → Edit · Write · Bash · mcp__github__* 종료 2, 읽기 전용 서버만 0. 훅 대상 = Bash · Edit · Write · MultiEdit · NotebookEdit · mcp__.* (저장소를 쓰는 도구 전부) | 예외 · 불러지기 전 죽음(`\|\| exit 2`) 모두 막힘 | 시간 초과는 Claude Code 가 통과로 다룸 — 문지기 훅 0.07–0.34 초(기본 한도 60 초)라 실제 위험 낮음 |
| 훅을 끄는 길 | 묶음 적용 정책에서 develop 이 `.claude/settings.local.json` · `.claude/hooks/**` 쓰기 가능(mayWrite true) · settings deny 에 없음 · 그 파일은 git 무시 목록에 없음(문지기가 봄) | ❌ `disableAllHooks` 로 문지기를 통째로 끌 수 있음 — fail-closed 도 훅이 돌아야 함 | 묶음 5(DEC-0095): develop except · settings deny 에 두 자리 · 시험 ㉔. `.git/` 은 문지기가 보지 않지만 git 훅만 바뀜(Claude 훅과 무관) |
