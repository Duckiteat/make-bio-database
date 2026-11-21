# PLAN-113 — AI 의 PR 병합 막기

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 113 · 8부 — 학회 수준의 신뢰 (바닥 · 실행 · 확률 층 · 가설 고리)
- **작업**: **AI 의 PR 병합 막기** (DEC-0069 다 — 지금은 가) — `.claude/settings.json` 의 permissions.deny 에 GitHub 병합 도구(mcp__github__merge_pull_request)를 더해 Claude Code 세션이 PR 을 병합하지 못하게 한다. 설정은 문지기 보호(L6)라 **사용자가 GitHub 웹에서 직접 커밋**. 권한 장부는 allow · ask 만 다루므로 deny 한 줄은 장부 줄이 필요 없다(tests/permissions.test.mjs). 이것으로 "병합 = 사람" 이 **Claude Code 안에서는** 성립 — 다른 실행 환경(훅 · 설정을 읽지 않는 AI)에는 걸리지 않으므로 GitHub 쪽 통제(브랜치 보호 · 규칙 집합)는 플랫폼 독립 검토에서
- **자리**: `.claude/settings.json` (사용자 커밋)
- **끝나는 조건**: 설정에 deny 줄 · 사용자 커밋 해시 · 이 세션 다음의 세션에서 병합 도구 호출이 거부됨을 영수증으로 확인
- **상태**: ◐ 진행 2026-11-21

## 결과 (날짜별)

- `2026-11-21` 커밋 전 기록: 2026-11-21 사용자 GitHub 웹 커밋 `6c78179` (main, 'Update settings.json', 작성 Duckiteat · 커밋 GitHub) — `.claude/settings.json` 한 파일, deny 21 → 22, 끝에 mcp__github__merge_pull_request. JSON 정상. 이 세션 영수증에 그 시각의 PR 병합 호출 없음. 남은 끝나는 조건: 이 설정이 든 브랜치에서 시작한 다음 세션에서 병합 도구 호출이 거부됨을 영수증으로 확인 · main CI(run 444) 결과.

## 걸어온 길

- `2026-11-21` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0069 — 사람 승인의 증거를 다로 확정 · AI 의 PR 병합 막기(PLAN-113)
- `2026-11-21` 커밋 전 기록 상태 ☐ → ◐ 2026-11-21 — PLAN-113 — 사용자가 main 에 설정 deny 한 줄을 커밋함
- `2026-11-21` 커밋 전 기록 결과 처음 적힘 — PLAN-113 — 사용자가 main 에 설정 deny 한 줄을 커밋함

## 닿는 결정

- [DEC-0069](../decisions/DEC-0069.md) 2026-11-21 사람 승인의 증거 — 다: 지금은 AI 의 PR 병합을 설정으로 막아 병합 = 사람, 높은 위험 변경(권한 · 판정 기준)에는 나중에 사용자 기기 키 서명을 더함
