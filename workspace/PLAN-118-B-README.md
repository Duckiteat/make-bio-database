# PLAN-118 묶음 B — 보안 셋 섞기 (DEC-0097): ci-zone 사람 서명 판정 · 훅을 끄는 자리 막기 · 훅 exit 2 · 전환 기록 번호

> 사용자 커밋 대상. L6(`rebuild/ci-zone.mjs` · `.github/**` · `.claude/settings.json` · `rebuild/rules/modes.json` · 판정 시험)라 develop 세션은 쓰지 못한다 — **적용하지 않은 제안**.
> 묶음 B 지문 `b1306dc9c64e7da8940858e7dde04eaf251985360888233cd5bfc2341be34a46` (16 파일 — 자동 0 · 사람 승인 16 · 거부 0, 승인 화면 `workspace/PLAN-118-B-bundle.screen.txt`) + 다른 세션의 DEC-0092 묶음 1 지문 `f45217aa…`(그대로).
> develop 세션의 확인: 저장소 밖 사본에서 B → 훅 exit 2 → DEC-0092 → 규칙 ops 순서로 적용해 **전체 시험 567 통과** · RULE-0551 변이 caught(서명 판정을 끄면 시험이 빨개짐) · 적용 스크립트를 새 사본에서 `DRY=1` 로 끝까지.

## 왜 섞기인가 (DEC-0097)

develop 세션 둘이 같은 시각에 같은 보안 셋을 만들었다 — main(PR #25)에는 다른 세션의 묶음 1–5 가 제안으로, 이 브랜치에는 PLAN-117(지금 PLAN-118) 묶음이 사람 커밋 `d600490` 으로 적용됨. 사용자 결정 "섞기":

| 무엇 | 어느 쪽 | 까닭 |
|---|---|---|
| 문지기 fail-closed · CODEOWNERS | 이 브랜치(`d600490`, 이미 적용) — main 의 묶음 2 · 3 은 쓰지 않음 | 같은 일 — 이미 적용된 것을 씀 |
| ci-zone | **DEC-0094(사람 서명)** — main 의 묶음 4 를 이 브랜치에 맞춤 | `d600490` 의 push 계정 판정은 "봇이 선언 없는 커밋을 올린 PR 에 사람이 마지막으로 push 하면 통과" 하는 구멍 — 커밋마다 GitHub 이 검증한 서명을 보는 쪽이 강하다 |
| 훅을 끄는 자리(settings.local.json · .claude/hooks) | main 의 묶음 5 를 이 브랜치의 시험에 맞춤 | `d600490` 이 놓친 구멍(develop 이 disableAllHooks 로 문지기를 끌 수 있었음) |
| 훅 명령 끝 `\|\| exit 2` | main 의 묶음 2 에서 이 한 줄만 | 문지기가 뜨기 전에 죽어도(문법 오류 · 의존 누락) 막힘 — `d600490` 의 fail-closed 는 뜬 뒤의 예외만 다룸 |
| 전환 기록 번호(DEC-0092) | main 의 묶음 1 그대로 | 겹침 없음 — 한 번에 적용하도록 스크립트에 넣음 |

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| `rebuild/ci-zone.mjs` — 선언 없는 커밋은 **사람 서명 커밋**(GitHub 이 검증한 서명 · 커미터가 `HUMANS`)일 때만 알리기만, 아니면 AI 로 거부(RULE-0551 — 뜻을 계정 → 서명으로). main 에 이미 든 커밋은 다시 판정하지 않음(이 브랜치의 덧붙임) | N8 · DEC-0094 | 서명 사실이 없으면 아무도 사람이 아님(fail-closed) | ci_zone · bypass · registry 시험 |
| `.github/workflows/check.yml` — 구역 점검 앞에서 커밋마다 서명 사실을 GitHub API 로 모아 넘김(`--signatures`) | 서명은 GitHub 이 검증한 사실이어야 | 워크플로가 `github.token` 으로 읽기 | — |
| `.claude/settings.json` deny 넷 · `rebuild/rules/modes.json` except 둘 · 권한 장부 PERM-0017 | DEC-0095 | 어느 모드도 훅 설정을 못 씀 | gate ㉔ |
| 훅 명령 끝 `\|\| exit 2` — 스크립트의 sed | 승인 묶음 도구는 훅 줄 변경을 "넓힘" 으로 거부해 묶음에 넣을 수 없음 | — | gate ㉔ |
| 규칙 장부 RULE-0551 · RULE-0548 문장 · CODEOWNERS 머리말 · 저장 지도 한 줄 · 감독 규격 한 문장 | 코드와 같은 커밋에 | CHANGES 한 행은 스크립트가(묶음 도구가 CHANGES.md 의 옛 긴 줄 때문에 그 파일을 검토 못 함) | — |

## 적용 (사람 — Codespaces)

0. **먼저** GitHub Settings → Codespaces → **GPG verification** 켜기(이 저장소). 이 커밋부터 사람 서명 커밋이 된다 — 켜지 않으면 이 커밋도 서명이 없다
1. `git pull` 뒤 `bash workspace/PLAN-118-B-apply.sh` — 지문 둘 → B → 훅 exit 2 → DEC-0092 → CHANGES → 생성물 → 전체 시험. 통과하면 스스로 커밋 · push(끝에 서명 여부를 알려 줌), 실패하면 시험 기록만 push
2. PR(이 브랜치 → main)은 **봇이 연다**(DEC-0095 운영 규칙 — 사람이 연 PR 은 코드 소유자 = 자기라 승인이 안 됨). develop 세션에 "PR 열어" 라고 하면 된다

## 병합 — 이 PR 은 우회 병합이 필요하다

| 검사 | 결과 예상 | 까닭 |
|---|---|---|
| `independent-judge` | **실패** | L6 를 바꾼 PR 은 일부러 "사람 확인 필요" 로 실패 — 설계대로 |
| `rules` ② (이 PR 의 판정 코드) | **실패할 수 있음** | `d600490` 은 서명 없는 선언 없는 커밋 — 새 ci-zone 은 AI 커밋으로 본다. GPG 를 켜기 전 커밋이라 고칠 수 없다(이 브랜치는 강제 push 가 막혀 다시 쓸 수 없음) |
| `rules` ① (main 의 판정 코드) | 통과 | main 의 ci-zone 은 아직 옛 판정 |

그래서 이 PR 은 사람이 **규칙 우회**로 병합한다 — 규칙 세트 Bypass list 에 **Repository admin** 을 **"For pull requests only"** 로 넣으면(PLAN-117 README 의 선택 가) 봇은 못 쓰고 사람의 우회는 GitHub 이 기록한다. 병합 방식은 **Merge commit**(DEC-0095 — Squash · Rebase 는 웹 흐름 커밋을 만들어 사람 서명이 아님).

## 병합 뒤 (사람 — GitHub 웹)

3. 규칙 세트 `main` → Require a pull request → **Require review from Code Owners** 켜기 · **Dismiss stale pull request approvals** 켜짐 확인
4. 그 뒤 PR 은 우회 없이: 봇 커밋은 영수증(선언)이 있어 통과 · 사람 커밋은 GPG 서명으로 통과 · L6 PR 만 우회

## 이 묶음이 대신하는 것

main 의 `workspace/21-security-bundles-README.md` 묶음 2(N11) · 3(CODEOWNERS) · 4(DEC-0094) · 5(DEC-0095)는 **적용하지 않는다** — 이 묶음과 `d600490` 이 대신한다. 묶음 1(DEC-0092)은 이 스크립트가 그대로 적용한다.
