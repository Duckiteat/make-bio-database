# PLAN-117 승인 묶음 — 보안 묶음 마무리 (문지기 fail-closed · CI 의 사람 판정을 계정으로 · CODEOWNERS)

> 사용자 커밋 대상. develop 세션은 이 묶음의 L6 파일(`rebuild/gate.mjs` · `rebuild/ci-zone.mjs` · `.github/**`)을 쓰지 못한다. 그래서 이 묶음은 **적용하지 않은 제안**이다.
> 지문 `82625e9c1dc7cfc933f326d505c04b16be137825e13dcc69e93617decc296363`. 승인 화면 `workspace/PLAN-117-bundle.screen.txt`(11 파일 — 자동 0 · 사람 승인 11 · 거부 0).
> develop 세션의 확인: 저장소 밖 사본에 적용 → gate · ci_zone 시험 13 통과 · 규칙 둘의 변이 시험 caught(검사를 끄면 시험이 빨개짐) · **전체 시험 563 통과** · 적용 스크립트를 다른 사본에서 `DRY=1` 로 끝까지 돌림.

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| `rebuild/gate.mjs` — 훅이 예외를 내면 **fail-closed**: 쓰는 도구(목록에 없는 도구 포함)는 막고, 읽는 도구(Read · Grep · Glob · 읽기 전용 MCP)만 통과 (RULE-0550) | 전에는 모든 예외를 통과시켜, live 영수증에 깨진 줄 하나만 넣으면 문지기가 꺼진 것과 같았다(공격 경로 N11) | 문지기가 고장 나면 세션은 읽기만 할 수 있다 — 사람이 원인을 보고 고친다 | gate ㉓ (끝에서 끝 — 깨진 줄로 재현) |
| `rebuild/ci-zone.mjs` — 모드 선언이 없는 커밋은 **push · PR 을 일으킨 GitHub 계정**(`GITHUB_ACTOR`)으로 가른다. 부모 커밋의 `.github/CODEOWNERS` 에 있는 @계정이면 사람(알리기만), 다른 계정(봇)이면 거부 (RULE-0551). main 에 이미 들어간 커밋은 다시 판정하지 않는다(main 으로 가는 push 는 그대로 판정) | 봇 계정 분리(DEC-0090) 뒤로 "선언 없음 = 사람의 커밋" 이 틀린 가정이 됐다 — AI 는 따옴표 속 커밋으로 선언 없는 커밋을 만들 수 있다(N8) | 봇이 문지기를 거치지 않고 만든 커밋은 CI 에서 빨개진다. 행위자나 사람 목록을 모르면 옛 판정 그대로 | ci_zone 새 시험 둘 |
| 새 `.github/CODEOWNERS` — L6 자리 28 곳 → `@Duckiteat` | L6 를 바꾸는 PR 에 사람 리뷰를 GitHub 이 강제하게 · ci-zone 이 읽는 사람 계정 목록 | 규칙 세트에서 "Require review from Code Owners" 를 켜야 힘이 생긴다(아래 9) | — |
| 저장 지도 한 줄(`.github/CODEOWNERS` L6) · 규칙 장부(RULE-0550 · 0551 + 집행 · 연결 · 봉인) · 감독 규격 §4.5 한 문장 · 시험 둘 | 코드와 같은 커밋에 (RULE-0191 · 0205) | CHANGES.md 한 행은 스크립트가 넣는다 — 승인 묶음 도구가 CHANGES.md 의 옛 긴 줄(2000 자 넘음) 때문에 그 파일 전체를 검토하지 못해서다 | — |

## 적용 (사람 — Codespaces, 한 번에)

1. `git pull` 뒤 `bash workspace/PLAN-117-apply.sh` — 지문 확인 → 적용 → CHANGES 한 행 → 생성물 → 전체 시험. **통과하면 스스로 커밋 · push**, 실패하면 시험 기록만 push 한다(그 기록을 develop 이 읽는다)
2. 이 브랜치(`ccr-b0ff4012-x9uzg9`)의 PR 을 연다(또는 이미 열린 PR) → `rules` · `independent-judge` 결과를 본다

## 병합 전에 꼭 읽을 것 — 지금 L6 PR 은 병합할 수 없을 수 있다

`independent-judge`(`rebuild/trust-check.mjs`)는 L6 를 바꾼 PR 을 일부러 **실패**시킨다("사람 확인 필요 — GitHub 규칙 우회로만 병합, 기록이 남음"). 그런데 봇 신원 확인 때(2026-11-24) 규칙 세트 `main` 의 **우회 목록(Bypass list)을 비웠다**. 그러면 `independent-judge` 가 필수 검사인 동안에는 이 PR 을 아무도 병합할 수 없다 — develop 세션은 규칙 세트 화면을 읽을 수 없어 **확인하지 못했다**(조회 도구 없음). 이 PR 이 첫 사례가 된다.

| 선택 | 무엇 | 보안 | 권장 |
|---|---|---|---|
| 가 | 규칙 세트 Bypass list 에 **Repository admin** 역할(= Duckiteat 만)을 **"For pull requests only"** 로 넣는다 | 봇(write)은 우회할 수 없다. 사람의 우회는 GitHub 이 기록한다 — trust-check 가 처음부터 기대한 모양 | **예** |
| 나 | 병합할 때만 `independent-judge` 를 필수 검사에서 잠깐 뺐다가 다시 넣는다 | 빼 둔 동안 다른 PR 도 지날 수 있고, 기록이 덜 남는다 | 아니오 |
| 다 | trust-check 를 고쳐 "사람 계정이 승인한 PR" 은 통과시킨다 | 판정 코드 변경(L6) · `pull_request_target` 에서 승인 사실을 읽어야 해서 설계가 따로 필요 | 나중(PLAN-118 과 함께 검토) |

## 병합 뒤 (사람 — GitHub 웹)

8. 병합 → main 의 CI 가 녹색인지 본다. ① 기준(main) 판정 코드는 **이 묶음이 main 에 들어간 뒤부터** 새 규칙(RULE-0551)으로 돈다
9. Settings → Rules → 규칙 세트 `main` → **Require a pull request before merging → Require review from Code Owners** 를 켠다. 같은 화면에서 **Dismiss stale pull request approvals when new commits are pushed** 가 켜져 있는지도 본다(전환 기록 #20 의 열린 질문)
10. 확인: 봇 브랜치에서 영수증 없이 만든 커밋(예: `bash -c "git commit …"`)을 push 하면 `rules` 가 RULE-0551 로 빨개지는지 — develop 세션이 시험 브랜치로 해 볼 수 있다(사용자 허락 뒤)

## 하지 않은 것

- 백그라운드로 돌린 `gate finish` 를 커밋 관문이 인정하지 않는 문제(이번 세션에서 찾음 — 시험은 통과하는데 커밋이 막힘). 같은 파일(`gate.mjs`)이지만 이 묶음의 범위(보안)를 넓히지 않으려고 넣지 않았다. 지금은 `finish` 를 앞에서(포그라운드) 돌리면 된다
- trust-check 의 L6 처리 방식(위 "다") — 결정 뒤
