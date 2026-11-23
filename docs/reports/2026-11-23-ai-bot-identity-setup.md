# AI 전용 GitHub 신원 — 봇 계정 1 개 만들기 절차 (DEC-0090 · DEC-0088 Q1)

> 2026-11-23 · develop 세션 · 사용자 결정 "봇 계정 1개로 가자, 절차 정리해줘". 이 문서는 **사람이 GitHub · claude.ai 에서 할 일** 을 적는다 — develop 세션은 계정 · 설정을 만들거나 바꾸지 않는다.
> 비밀번호 · 복구 코드 · 토큰은 채팅 · 저장소 · 전환 기록 어디에도 붙여 넣지 않는다(RULE-0518). 사용자의 비밀번호 관리자에만.
> 화면 이름은 GitHub · claude.ai 가 바꿀 수 있다 — 메뉴 이름이 다르면 같은 뜻의 메뉴를 찾는다.

## 0. 끝난 모습

| 신원 | 누가 | 권한 | 지키는 것 |
|---|---|---|---|
| 사람 계정 (지금 계정) | 사용자 | 저장소 주인 · 관리자 · 규칙 우회는 이 계정만 | 승인 · 병합 · 설정 · L6 커밋 |
| AI 봇 계정 (새) | 모든 Claude 세션 (claude.ai 의 GitHub 연결) | 협업자 Write — 읽기 · 커밋 · 작업 브랜치 push · PR 열기 · 댓글 | main 에는 사람 승인 없이 못 들어감 · 설정에 못 닿음 |
| GitHub Actions | `independent-judge` · `rules` | 읽기만 (워크플로에 고정) | 판정만 — 쓰지 않음 |

## 1. 봇 계정 만들기 (사람 — 브라우저, 사람 계정에서 로그아웃하거나 다른 브라우저 프로필에서)

| 단계 | 무엇 | 왜 | 확인 |
|---|---|---|---|
| 1-1 | 새 이메일 주소 준비(지금 메일의 별칭 `+bot` 등도 됨) | GitHub 계정마다 이메일이 따로 필요 | 메일 수신 |
| 1-2 | github.com 에서 새 계정 가입 — 이름 예: `<사람계정>-claude-bot` | GitHub 약관은 사람 한 명당 무료 기계 계정 하나를 허용 | 가입 완료 |
| 1-3 | 그 계정에 2 단계 인증 켜기 · 복구 코드는 비밀번호 관리자에 | 봇 계정을 남이 쥐면 AI 신원 위조 | Settings → Password and authentication 에 2FA 켜짐 |
| 1-4 | 프로필에 "Claude Code 세션이 쓰는 기계 계정 — 주인: <사람계정>" 한 줄 | 기록에 보이는 actor 가 누구인지 사람이 알게 | 프로필 |

## 2. 저장소에 봇을 Write 로 들이기 (사람 계정)

| 단계 | 무엇 | 왜 | 확인 |
|---|---|---|---|
| 2-1 | 저장소 Settings → Collaborators → Add people → 봇 계정 | 개인 계정 저장소의 협업자는 Write(쓰기)만 — 설정 · 규칙에 못 닿음 | 초대 보냄 |
| 2-2 | 봇 계정으로 초대 수락 | — | 협업자 목록에 봇 |
| 2-3 | 사람 계정이 **유일한 관리자** 인지 확인 (다른 협업자 없음) | 규칙 우회 = 관리자 — 그 자리는 사람 하나 | Collaborators 목록 |

## 3. claude.ai 의 GitHub 연결을 봇으로 바꾸기 (사람)

| 단계 | 무엇 | 왜 | 확인 |
|---|---|---|---|
| 3-1 | 진행 중인 Claude 세션의 push 할 일을 먼저 끝냄 (이 세션 포함) | 연결을 바꾸는 순간 세션의 GitHub 권한이 바뀜 | 열린 세션 없음 |
| 3-2 | claude.ai → 설정 → 연결(Connectors) → GitHub 연결 끊기 | 지금 Claude 의 push · PR · CI actor 가 사람 계정으로 남음(재검토 §5) | 연결 끊김 |
| 3-3 | 브라우저에서 GitHub 를 **봇 계정으로** 로그인한 상태로 https://claude.ai/connect-github 에서 다시 연결 | 이제 Claude 세션은 봇 신원으로 움직임 | 연결된 계정 이름 = 봇 |
| 3-4 | Claude GitHub App 은 저장소 주인(사람 계정)에 이미 설치됨 — 그대로. 봇이 그 저장소에 닿는지는 새 세션에서 확인(6 장) | App 설치는 저장소 쪽, 연결은 사람 쪽 | 6-1 |
| 3-5 | **Codespaces · 사람 기기에서는 Claude Code 를 사람 계정 토큰으로 돌리지 않는다** — 승인 묶음 적용은 사람이 손으로 | 사람 토큰이 있는 곳에서 AI 가 돌면 신원 분리가 무너짐(설계 검토 C2) | 습관 |

## 4. main 규칙 (사람 계정 — 저장소 Settings → Rules → Rulesets, 없으면 Branches → Branch protection)

| 규칙 | 값 | 왜 | 막는 공격 |
|---|---|---|---|
| 대상 | `main` (기본 브랜치) | — | — |
| Require a pull request before merging | 켬 · 필수 승인 **1** · Require review from Code Owners 켬 · Dismiss stale approvals 켬 · Require approval of the most recent reviewable push 켬 | 봇이 연 PR 은 사람 승인 없이 못 들어감 · 승인 뒤 바뀌면 승인 무효(PLAN-102 와 같은 뜻을 GitHub 이 강제) | N12 · 병합 주체 · 승인 뒤 바꿔치기 |
| Require status checks to pass | `rules` · `independent-judge`(묶음 2 병합 뒤) · Require branches to be up to date 켬 | 판정 통과 없이는 병합 불가 | N9 · N10 · C6 |
| Block force pushes · Restrict deletions | 켬 | main 역사 고쳐 쓰기 막기 | — |
| Bypass list | **Repository admin 만** (봇 넣지 않음) | 사람의 L6 PR 은 사람 자신이 승인할 수 없어(자기 PR 승인 불가) 우회로 병합 — GitHub 이 우회를 기록 | 우회 = 사람만 |

CODEOWNERS 파일(`* @<사람계정>`)은 다음 승인 묶음으로 만든다 — 그 파일 자체가 L6 이어야 해서(봇이 고치면 검토자가 바뀜). 그 전까지는 "필수 승인 1" 만으로도 봇은 자기 PR 을 승인할 수 없으므로 사람 승인이 강제된다.

## 5. 저장소 일반 설정 (사람 계정)

| 자리 | 값 | 왜 | 확인 |
|---|---|---|---|
| Settings → General → Pull Requests → Allow auto-merge | 끔 | N12 서버 쪽 | 체크 해제 |
| Settings → Actions → General → Workflow permissions | Read repository contents · "Allow GitHub Actions to create and approve pull requests" 끔 | 워크플로가 PR 을 승인하는 길 막기 | 저장 |
| Settings → Actions → General → Fork pull request workflows | 기본(외부 협업자 승인 필요) 유지 | `pull_request_target` 은 비공개 · 협업자 저장소에서만 쓰지만 기본값을 낮추지 않음 | — |

## 6. 확인 (새 Claude 세션 — 봇 신원으로)

| 단계 | 무엇 | 기대 | 결과를 남길 곳 |
|---|---|---|---|
| 6-1 | 새 세션에서 작업 브랜치에 빈 커밋 push · PR 열기 | push · PR 성공 · Actions 실행의 actor = 봇 | 전환 기록 / PLAN-116 결과 |
| 6-2 | 그 PR 을 GitHub 도구로 병합 시도 · 자동 병합 켜기 시도 | 둘 다 실패(설정 deny + 규칙: 승인 없음) | 같은 곳 |
| 6-3 | 사람 계정으로 그 PR 승인 → 병합 | 성공 · merged_by = 사람 | 같은 곳 (그 뒤 PR 은 되돌리거나 빈 커밋이면 그대로) |
| 6-4 | 봇으로 Settings 열기 | 404 · 권한 없음 | 같은 곳 |

## 7. 이것 뒤에 develop 이 할 일 (코드 — 사용자 결정 뒤)

| 일 | 무엇이 바뀌나 | 자리 | 방식 |
|---|---|---|---|
| CODEOWNERS | `.github/CODEOWNERS` = 사람 계정 · L6 로 | 새 파일 | 승인 묶음 |
| 승인 증거(PLAN-102) | 영수증 추정(병합 앞뒤 시간 창) 대신 GitHub 사실: merged_by 와 승인 리뷰어가 사람 계정 | `judicial/supervise_approval.js` 사실 칸 · `rebuild/supervise.mjs` 모으기 | develop |
| CI 구역 점검(PLAN-114) | "선언 없음 = 사람의 커밋" 을 버리고 push · 작성자 신원으로 — 봇이 만든 커밋은 선언이 없어도 AI | `rebuild/ci-zone.mjs` | 승인 묶음 |
| 문지기 fail-closed (N11) | 오류 시 쓰는 도구를 막음 | `rebuild/gate.mjs` | 승인 묶음 |
| 사람 서명 (DEC-0069 나) | 사람 커밋은 사람 기기의 서명 키 · main 규칙 "Require signed commits" 는 봇 서명 방식이 정해진 뒤 | GitHub 설정 · 사람 기기 | 나중 |
