# PLAN-135 — L6 PR 을 우회 없이

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 135 · 11부 — 자율 오케스트레이션 (주제 → 분해 → 실행 → 통합 → 검증, 사람은 주제 · 결정 · 승락)
- **작업**: L6 PR 을 우회 없이 — 독립 판정(trust-check)이 지키는 자리 변경을 "코드 소유자(사람 계정)의 승인 리뷰 + 사람 서명 커밋" 일 때만 통과시킴. 지금은 L6 PR 이 늘 실패해 사람이 규칙 우회(병합 때 모든 규칙을 건너뜀 · 관리자 상시 우회 권한)로만 병합한다
- **자리**: `rebuild/trust-check.mjs`(판정 — 순수) · `.github/workflows/trust.yml`(GitHub API 로 리뷰 · 서명 사실 모으기, 읽기만 · main 코드로만) · 시험 `tests/trust_check.test.mjs` · 모두 L6 → 승인 묶음(첫 적용은 우회 한 번)
- **끝나는 조건**: 조건 셋을 시험으로: ① L6 파일을 바꾼 커밋이 모두 사람 서명 커밋(GitHub 검증 서명 · 커미터 = 사람 계정, DEC-0094 와 같은 판정)이어야 — 승인만으로는 실패(AI 가 만든 L6 변경이 습관적 승인에 묻어가는 길) ② 승인은 PR 머리 커밋 sha 에 묶인 코드 소유자(HUMANS)의 APPROVED 리뷰만 — 봇 리뷰 · 옛 커밋 승인 · 승인 뒤 커밋 추가는 실패 ③ 판정은 main 의 코드로만(pull_request_target) · 다른 세션의 독립 재검토 · 변이 시험(검사를 끄면 빨개짐) · 사실을 못 모으면 실패(fail-closed). 그 뒤 규칙 세트 Bypass list 를 다시 비움(사용자) · 다음 L6 PR 이 우회 없이 승인 + 병합으로 끝남을 실제 PR 로 확인 · 선행: PLAN-117(GitHub 사실 모으기)
- **상태**: ◐ 진행 2026-11-25

## 결과 (날짜별)

- `2026-11-25` 커밋 전 기록: 2026-11-25 선행 DEC-0100: 사람 서명은 사용자 자신의 SSH 서명 키로(Codespaces GPG 는 커미터가 web-flow 라 DEC-0094 판정을 통과 못 함 — PR #27 의 c298b23). 절차서 docs/reports/2026-11-25-human-signing-key-setup.md — 사용자 설정 뒤 다음 사람 커밋의 커미터 · Verified 로 확인
- `2026-11-25` 커밋 전 기록: · 2026-11-25 찾은 것(RULE-0262): PR #27 에서 independent-judge 가 통과 — 새 파일 .github/workflows/approval.yml 은 main 의 저장 지도 L6 에 아직 없어 지키는 자리로 잡히지 않음. L6 폴더(.github/** 등) 아래 새 파일을 못 잡는 구멍 — 지키는 자리를 저장 지도의 파일 목록이 아니라 모드표 except 의 글롭(.github/** · 문지기 셋 · 판정 코드)에서도 계산해야. 병합에는 코드 소유자 리뷰가 여전히 필요(CODEOWNERS /.github/)라 지금 열린 길은 아님. 또 PR #27 의 rules 실패: c298b23 은 Codespaces GPG 서명(검증됨)이지만 커미터 web-flow → DEC-0100(사용자 SSH 서명 키)
- `2026-11-25` 커밋 전 기록: · 2026-11-25 승인 묶음 workspace/PLAN-135-bundle.patch (지문 2ea71e6a6cd2… · 10 파일 · 거부 0): trust-check signedPaths · trust.yml 서명 사실 · 저장 지도 글롭 · CODEOWNERS /.claude/hooks/ · RULE-0553(변이 caught) · 시험 trust_check 넷 · 감독 규격 §4.3 ⑤. 사본 전체 572 통과. 만들며 잡은 것: judge 에서 ...sp 가 ok 를 덮어써 등록부 정책 실패가 사라지던 것 — 기존 N9 시험이 잡음. 이 PR 이 마지막 우회(main 의 판정 코드가 옛것) — 병합 뒤 우회 목록을 비우고 다음 서명된 L6 PR 이 녹색이면 끝
- `2026-11-25` 커밋 전 기록: · 2026-11-25 PR #28 병합 fb53c5f(Duckiteat · 승인 리뷰 + 마지막 우회 · Merge commit) — 사람 커밋 7da772e 의 L6 파일이 묶음 2ea71e6a6c 와 바이트 동일. CI: rules ✗(7da772e 커미터 GitHub · PGP — 사용자 SSH 서명 키가 아직 안 걸림, DEC-0100 점검 중) · independent-judge ✗(main 의 옛 판정 코드 — 예상). 남은 끝나는 조건: 사용자가 규칙 세트 우회 목록을 비움 · 서명 설정 고침(SSH 서명 · 커미터 Duckiteat) · 다음 서명된 L6 PR 이 우회 없이 independent-judge · rules 녹색으로 병합
- `2026-11-25` 커밋 전 기록: · 2026-11-25 서명 설정 성공(사용자 Codespace — workspace/sign-setup.sh: SSH 서명 · 커미터 Duckiteat). 원인 둘: 태블릿 키보드가 -- 를 줄표로 · 따옴표를 바꿔 손으로 친 명령이 틀림 / Codespaces 가 터미널에 GIT_COMMITTER_NAME=GitHub 을 넣어 git 설정보다 우선 — 대본이 지우고 ~/.bashrc 에 한 줄. 확인 PR 묶음 workspace/PLAN-135-verify-bundle.patch(CODEOWNERS 주석 두 줄 · 지문 eaf08d8c82 · DEC-0102)

## 걸어온 길

- `2026-11-24` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 사용자 결정 DEC-0098 — L6 PR 을 우회 없이 (PLAN-135)
- `2026-11-25` 커밋 전 기록 결과 처음 적힘 — 사용자 결정 DEC-0100 — 사람 서명은 사용자 자신의 키로
- `2026-11-25` 커밋 전 기록 결과 덧붙음 — PR #27 병합 · approval 워크플로 첫 실행 approved
- `2026-11-25` 커밋 전 기록 상태 ☐ → ◐ 2026-11-25 — 사용자 결정 DEC-0101 · PLAN-135 묶음
- `2026-11-25` 커밋 전 기록 결과 덧붙음 — 사용자 결정 DEC-0101 · PLAN-135 묶음
- `2026-11-25` 커밋 전 기록 결과 덧붙음 — PR #28 병합 — 마지막 우회
- `2026-11-25` 커밋 전 기록 결과 덧붙음 — 사용자 결정 DEC-0102 · 서명 설정 성공

## 닿는 결정

- [DEC-0098](../decisions/DEC-0098.md) 2026-11-24 L6 PR 은 이번(PR #26)만 우회 병합 — 앞으로는 독립 판정이 "코드 소유자 승인 + 사람 서명 커밋" 이면 통과(조건 셋), 그 뒤 우회 목록을 비움
- [DEC-0099](../decisions/DEC-0099.md) 2026-11-24 PLAN-117 — 승인 사실(병합한 계정 · 승인 리뷰)은 CI 가 모으고 판정도 CI 에서, 세션은 그 결과만 읽는다
- [DEC-0100](../decisions/DEC-0100.md) 2026-11-25 사람 서명 = 사용자 자신의 SSH 서명 키 — Codespaces 의 GPG verification(GitHub 키 · 커미터 web-flow)은 끈다
- [DEC-0101](../decisions/DEC-0101.md) 2026-11-25 PLAN-135 조건 ②(머리 커밋에 묶인 사람 승인)는 GitHub 규칙 세트에 맡긴다 — 독립 판정은 사람 서명 커밋 · 병합 커밋 속 변경 · 새 파일 구멍을 본다
- [DEC-0102](../decisions/DEC-0102.md) 2026-11-25 승인 판정 코드(judicial/supervise_approval.js · rebuild/supervise.mjs)는 MVP 실증(PLAN-124) 끝에 L6 로 — PLAN-135 확인 PR 은 CODEOWNERS 주석 두 줄
