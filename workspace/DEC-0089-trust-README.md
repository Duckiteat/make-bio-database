# DEC-0089 승인 묶음 2 — 독립 판정 워크플로 (main 의 코드로만 · 사람 클릭에 기대지 않는 첫 겹)

> 사용자 커밋 대상. develop 세션은 `.github/**` · 모드표를 쓰지 못한다 — 이 묶음은 **적용하지 않은 제안** 이다. 판정 코드 `rebuild/trust-check.mjs` 와 시험 `tests/trust_check.test.mjs` 는 develop 이 이미 커밋했다(L2). 이 묶음이 그 둘과 워크플로를 L6 로 올린다.
> develop 세션의 확인: 시험 5 통과(N9 병합 커밋 속 도장 지우기 · N10 model.js 한 줄 · PR 이 저장 지도를 낮춤 — 모두 실패로 잡음, 보통 변경은 통과) · 묶음을 메모리에서 적용한 모드표로 어느 모드도 새 L6 셋을 못 씀 · develop 은 자기 검사 시험 8 만. **워크플로가 GitHub 에서 실제로 도는 것은 아직 못 봄** — 아래 10 단계가 첫 확인.

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| 새 `.github/workflows/trust.yml` — `pull_request_target`, 권한 읽기만, 비밀 값 없음. main 을 꺼내고 PR 은 `refs/pull/N/head` 를 git 객체로만 가져와 `node rebuild/trust-check.mjs <base> <head>` | 지금 CI 의 다른 단계는 push 된 커밋 자신의 워크플로 · 판정 코드로 돎 — 같은 push 가 검사를 끄거나(C6) 의존 파일 한 줄(N10) · 병합 커밋(N9)으로 지남 | PR 마다 `independent-judge` 검사가 생김. 등록부 정책 위반 · 지키는 자리 변경이면 실패 | 시험 5 · 실제 저장소에 직접 실행 |
| `rebuild/rules/modes.json` — develop except 에 두 파일 · field except 에 시험 | 판정 코드를 AI 가 약하게 고치지 못하게 | develop 은 두 파일을 못 씀 | 메모리 대조 |
| `docs/textbook/storage-map.json` — 두 파일 L2 → L6 · 워크플로 L6 새 줄 | 저장 지도의 L6 는 그 자체로 지키는 자리 목록 | trust-check 가 이 셋도 지킴 | 메모리 대조 |
| `tests/guard-matrix.test.mjs` 기준(CORE)에 셋 | 기준을 글자로 고정 — 빠지면 시험이 빨개짐 | — | 5 · 7 단계 |

## 적용 순서 (사람 — Codespaces, 한 단계씩)

1. `git pull`
2. `node rebuild/bundle.mjs verify workspace/DEC-0089-trust-bundle.patch 9a18ecb7c060524debe4b164d05b9bd38ee30944118da1423bcb0db7ae0b7aef` — `통과`
3. `git apply workspace/DEC-0089-trust-bundle.patch && git status --short` — 네 줄: modes.json · storage-map.json · guard-matrix.test.mjs · `.github/workflows/trust.yml`(새)
4. `node rebuild/status.mjs --write && node dbtool.mjs textbook --write`
5. `node --test tests/guard-matrix.test.mjs tests/trust_check.test.mjs tests/authority.test.mjs 2>&1 | tail -6` — `# fail 0`
6. `node --test tests/*.test.mjs 2>&1 | tail -6` — `# fail 0`
7. `git add -A && git commit -m "L6: independent judge workflow (DEC-0089, bundle 9a18ecb7c060)" && git push`
8. 이 브랜치를 main 에 병합 (사람) — `pull_request_target` 은 main 에 있는 워크플로만 돌므로 **병합 뒤 다음 PR 부터** 힘이 생긴다
9. GitHub 설정(웹) → Rules(또는 Branches) → main 규칙 → **Require status checks** 에 `independent-judge` 추가
10. 확인: 아무 작업 브랜치에서 PR 을 열어 `independent-judge` 가 돌고, 판정 코드 파일(예: `model.js`)을 한 줄 바꾼 시험 PR 이 실패하는지 본다 (확인 뒤 그 PR 은 닫음)

지키는 자리를 바꾸는 정당한 PR(사람의 L6 커밋 · 판정 코드 수정)은 이 검사가 실패한다 — 사람이 규칙 우회로 병합하고, GitHub 이 그 우회를 기록한다. **같은 GitHub 계정을 AI 도 쓰는 동안은 우회도 그 계정이 할 수 있다** — AI 전용 신원(DEC-0088 Q1) 뒤에 완성된다.
